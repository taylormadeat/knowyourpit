import { Router, type IRouter } from "express";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { db, cooksTable, grillsTable, cookCheckins, temperatureReadingsTable } from "@workspace/db";
import {
  CreateCookBody,
  UpdateCookBody,
  GetCookParams,
  UpdateCookParams,
  DeleteCookParams,
  ListCooksQueryParams,
  UpdateSessionParams,
  UpdateSessionBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import type { AiCheckinItem } from "@workspace/checkin-schedule";
import { clearHomeInsightsCache } from "./ai";
import { endLiveActivitiesForCook } from "../lib/liveActivityPush";
import { thinTemperatureReadings } from "../lib/thinTemperatureReadings";
import { computeCookHealthScore } from "./cookEvents";
import { getAssessment } from "./ai/shared";
import {
  FREE_COOK_LIMIT,
  respondPaywall,
  countCooksForUser,
  countActiveCooksForUser,
  countPlannedCooksForUser,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../lib/paywall";

const router: IRouter = Router();

// ── Outlier detection ──────────────────────────────────────────────────────
// A completed cook is flagged as an outlier if it meets at least 2 of:
//   1. Zero check-ins logged during a cook that lasted > 45 minutes.
//   2. Actual duration deviates > 40% from the AI-predicted end time.
//   3. No rating provided at the moment of completion.
// Outlier cooks are excluded from grill fingerprint calculations until
// the user dismisses the flag ("Mark as accurate").
async function detectOutlier(cookId: number, cook: {
  actualStartAt: Date | null;
  actualEndAt: Date | null;
  plannedEndAt: Date | null;
  ratingTenderness: number | null;
  ratingBark: number | null;
  ratingFlavor: number | null;
  rating: number | null;
}): Promise<boolean> {
  let criteriaCount = 0;

  // Criterion 1: zero check-ins for a cook > 45 minutes
  const actualMs =
    cook.actualStartAt && cook.actualEndAt
      ? new Date(cook.actualEndAt).getTime() - new Date(cook.actualStartAt).getTime()
      : null;
  if (actualMs !== null && actualMs > 45 * 60_000) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(cookCheckins)
      .where(eq(cookCheckins.cookId, cookId));
    if (n === 0) criteriaCount++;
  }

  // Criterion 2: actual duration deviates > 40% from planned end
  if (cook.actualStartAt && cook.actualEndAt && cook.plannedEndAt) {
    const actual = new Date(cook.actualEndAt).getTime() - new Date(cook.actualStartAt).getTime();
    const planned = new Date(cook.plannedEndAt).getTime() - new Date(cook.actualStartAt).getTime();
    if (planned > 0 && Math.abs(actual - planned) / planned > 0.40) criteriaCount++;
  }

  // Criterion 3: no rating at all
  const hasRating =
    (typeof cook.ratingTenderness === "number" && cook.ratingTenderness > 0) ||
    (typeof cook.ratingBark       === "number" && cook.ratingBark       > 0) ||
    (typeof cook.ratingFlavor     === "number" && cook.ratingFlavor     > 0) ||
    (typeof cook.rating           === "number" && cook.rating           > 0);
  if (!hasRating) criteriaCount++;

  return criteriaCount >= 2;
}

router.get("/cooks/technique-stats", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const completedCooks = await db
    .select({
      cookingMethod: cooksTable.cookingMethod,
      foodType: cooksTable.foodType,
      rating: cooksTable.rating,
      ratingTenderness: cooksTable.ratingTenderness,
      ratingBark: cooksTable.ratingBark,
      ratingFlavor: cooksTable.ratingFlavor,
    })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "completed")));

  function cookAvgRating(c: {
    rating: number | null;
    ratingTenderness: number | null;
    ratingBark: number | null;
    ratingFlavor: number | null;
  }): number | null {
    const subs = [c.ratingTenderness, c.ratingBark, c.ratingFlavor].filter(
      (v): v is number => typeof v === "number" && v > 0,
    );
    if (subs.length > 0) return subs.reduce((a, b) => a + b, 0) / subs.length;
    if (typeof c.rating === "number" && c.rating > 0) return c.rating;
    return null;
  }

  const byTechnique = new Map<
    string,
    { ratings: number[]; meatCounts: Map<string, number> }
  >();

  for (const cook of completedCooks) {
    if (!cook.cookingMethod) continue;
    const r = cookAvgRating(cook);
    if (r === null) continue;

    if (!byTechnique.has(cook.cookingMethod)) {
      byTechnique.set(cook.cookingMethod, { ratings: [], meatCounts: new Map() });
    }
    const bucket = byTechnique.get(cook.cookingMethod)!;
    bucket.ratings.push(r);
    const meat = cook.foodType || "Unknown";
    bucket.meatCounts.set(meat, (bucket.meatCounts.get(meat) ?? 0) + 1);
  }

  const result: {
    technique: string;
    cookCount: number;
    avgRating: number;
    topMeatType: string | null;
  }[] = [];

  for (const [technique, { ratings, meatCounts }] of byTechnique.entries()) {
    if (ratings.length < 2) continue;
    const avgRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    let topMeatType: string | null = null;
    let topCount = 0;
    for (const [meat, cnt] of meatCounts.entries()) {
      if (cnt > topCount) {
        topCount = cnt;
        topMeatType = meat;
      }
    }
    result.push({ technique, cookCount: ratings.length, avgRating, topMeatType });
  }

  result.sort((a, b) => b.avgRating - a.avgRating);
  res.json(result);
});

router.get("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListCooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { grillId, status } = parsed.data;
  const conditions: ReturnType<typeof eq>[] = [eq(cooksTable.userId, req.userId)];
  if (grillId != null) conditions.push(eq(cooksTable.grillId, grillId));
  if (status != null) conditions.push(eq(cooksTable.status, status));

  const rows = await db
    .select({ cook: cooksTable, grillName: grillsTable.name })
    .from(cooksTable)
    .leftJoin(grillsTable, eq(grillsTable.id, cooksTable.grillId))
    .where(and(...conditions))
    .orderBy(cooksTable.createdAt);

  const result = rows.map(({ cook, grillName }) => ({ ...cook, grillName: grillName ?? null }));
  res.json(result);
});

router.post("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Free-tier caps. Pro subscribers and PAYWALL_ENABLED=false bypass all gates.
  if (!(await userBypassesPaywall(req))) {
    // 1. Total cook cap
    const existingCount = await countCooksForUser(req.userId);
    if (existingCount >= FREE_COOK_LIMIT) {
      respondPaywall(res, {
        code: "cook_limit_reached",
        limit: FREE_COOK_LIMIT,
        used: existingCount,
        message: `Free plan is capped at ${FREE_COOK_LIMIT} cooks. Upgrade to Pro for unlimited.`,
      });
      return;
    }
    // 2. Planned cook cap (default status is "planned")
    const incomingStatus = parsed.data.status ?? "planned";
    if (incomingStatus === "planned") {
      const plannedCount = await countPlannedCooksForUser(req.userId);
      if (plannedCount >= 1) {
        respondPaywall(res, {
          code: "planned_cook_limit_reached",
          message: "Free plan only allows one planned cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    // 2b. Active cook cap (if POST is called with status="active" directly)
    if (incomingStatus === "active") {
      const activeCount = await countActiveCooksForUser(req.userId);
      if (activeCount >= 1) {
        respondPaywall(res, {
          code: "active_cook_limit_reached",
          message: "Free plan only allows one active cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    // No lifetime gradedCooks gate. Manual analyze is bounded only by the
    // daily AI scan cap enforced on the /analyze endpoint (3/day for free).
    // Live auto-grading every 30 minutes is a Pro feature gated client-side.
  }

  const analysisResult = req.body.analysisResult ?? null;
  const sequenceData = req.body.sequenceData ?? null;
  const [cook] = await db.insert(cooksTable).values({
    ...parsed.data,
    userId: req.userId,
    status: parsed.data.status ?? "planned",
    // Drizzle's insert type does not accept `null` for boolean NOT NULL columns
    // (fromFrozen). Strip null → undefined so the DB default
    // (false) is used when the value is absent from the request body.
    fromFrozen: parsed.data.fromFrozen ?? undefined,
    ...(analysisResult !== null ? { analysisResult } : {}),
    ...(sequenceData !== null ? { sequenceData } : {}),
  }).returning();
  // Run the totalCooks increment and grill-name fetch in parallel.
  // Use a SQL += 1 increment so we never need a prior SELECT for the current count.
  let grillName: string | null = null;
  if (cook.grillId) {
    const [, grillRow] = await Promise.all([
      db.update(grillsTable)
        .set({ totalCooks: sql`${grillsTable.totalCooks} + 1` })
        .where(eq(grillsTable.id, cook.grillId)),
      db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId))
        .then(r => r[0] ?? null),
    ]);
    grillName = grillRow?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  res.status(201).json({ ...cook, grillName });
});

router.get("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  let currentTempF: number | null = null;
  if (cook.status === "active") {
    const [latest] = await db
      .select({ tempF: temperatureReadingsTable.tempF })
      .from(temperatureReadingsTable)
      .where(eq(temperatureReadingsTable.cookId, cook.id))
      .orderBy(desc(temperatureReadingsTable.recordedAt))
      .limit(1);
    currentTempF = latest?.tempF ?? null;
  }
  res.json({ ...cook, grillName, currentTempF });
});

router.patch("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // Free-tier caps on status transitions and graded-cook saves.
  if (!(await userBypassesPaywall(req))) {
    if (parsed.data.status === "planned") {
      // Exclude the current cook so re-saving an already-planned cook is never blocked.
      const plannedCount = await countPlannedCooksForUser(req.userId, params.data.id);
      if (plannedCount >= 1) {
        respondPaywall(res, {
          code: "planned_cook_limit_reached",
          message: "Free plan only allows one planned cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    if (parsed.data.status === "active") {
      // Exclude the current cook so re-saving an already-active cook is never blocked.
      const activeCount = await countActiveCooksForUser(req.userId, params.data.id);
      if (activeCount >= 1) {
        respondPaywall(res, {
          code: "active_cook_limit_reached",
          message: "Free plan only allows one active cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    // No lifetime gradedCooks gate on PATCH either. The /analyze endpoint
    // enforces the 3/day AI scan cap; once analyze succeeds, persisting the
    // resulting verdict on the cook record is always allowed.
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  if (req.body.analysisResult !== undefined) {
    updateData.analysisResult = req.body.analysisResult;
    // Append to history — fetch current history + healthScore first, then accumulate
    const [current] = await db
      .select({ analysisHistory: cooksTable.analysisHistory, healthScore: cooksTable.healthScore })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    const existingHistory = Array.isArray(current?.analysisHistory) ? (current.analysisHistory as unknown[]) : [];
    updateData.analysisHistory = [
      ...existingHistory,
      { ...req.body.analysisResult, savedAt: new Date().toISOString() },
    ];
    // If no health score has been stored yet (cook has no check-ins), derive one
    // from the verdict so the list card shows a consistent grade without waiting
    // for the first check-in.
    if (!current?.healthScore) {
      const verdict = getAssessment(req.body.analysisResult)?.verdict ?? null;
      if (verdict) {
        const health = computeCookHealthScore({
          checkins: [],
          events: [],
          cookTempF: null,
          verdict,
          planAccuracyScore: null,
        });
        updateData.healthScore = String(health.grade);
        updateData.healthScoreReason = health.reason;
      }
    }
  }
  if ("sessionId" in req.body) {
    const sid = req.body.sessionId;
    if (sid !== null && typeof sid !== "string") {
      res.status(400).json({ error: "sessionId must be a string or null" });
      return;
    }
    updateData.sessionId = sid ?? null;
  }
  if ("confirmedSteps" in req.body) {
    const cs = req.body.confirmedSteps;
    if (cs !== null && (typeof cs !== "object" || Array.isArray(cs))) {
      res.status(400).json({ error: "confirmedSteps must be an object or null" });
      return;
    }
    updateData.confirmedSteps = cs ?? null;
  }
  if ("sequenceData" in req.body) {
    const sd = req.body.sequenceData;
    if (sd !== null && (typeof sd !== "object" || Array.isArray(sd))) {
      res.status(400).json({ error: "sequenceData must be an object or null" });
      return;
    }
    updateData.sequenceData = sd ?? null;
  }
  // ── Timestamp correction: re-plan schedule when actualStartAt / actualThawStartAt
  // is corrected on an active cook. Shifting the meatOnAt anchor by the delta
  // propagates the correction through the full schedule so countdowns stay accurate.
  // Also triggers when sequenceData is directly updated so AI check-in offsets can
  // be rescaled when estimatedFinishAt changes without a corresponding actualStartAt edit.
  const isTimestampCorrection =
    ("actualStartAt" in req.body && req.body.actualStartAt !== undefined) ||
    ("actualThawStartAt" in req.body && req.body.actualThawStartAt !== undefined) ||
    ("sequenceData" in req.body && req.body.sequenceData !== null);

  if (isTimestampCorrection) {
    const [existing] = await db
      .select({
        status: cooksTable.status,
        actualStartAt: cooksTable.actualStartAt,
        actualThawStartAt: cooksTable.actualThawStartAt,
        plannedEndAt: cooksTable.plannedEndAt,
        sequenceData: cooksTable.sequenceData,
      })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

    if (existing?.status === "active") {
      type SeqScheduleItem = {
        meatOnAt?: string | null;
        estimatedFinishAt?: string | null;
        grillLightAt?: string | null;
        [key: string]: unknown;
      };
      type SeqFrozen = {
        thawStartAt?: string | null;
        thawEndAt?: string | null;
        [key: string]: unknown;
      };
      type SeqData = {
        schedule: SeqScheduleItem[];
        frozen?: SeqFrozen | null;
        aiCheckins?: AiCheckinItem[] | null;
        [key: string]: unknown;
      };

      const seqData = existing.sequenceData as SeqData | null;

      // ── Shift schedule timestamps when actualStartAt (meat-on) changes ──
      const newActualStartAt = req.body.actualStartAt;
      if (
        newActualStartAt &&
        typeof newActualStartAt === "string" &&
        seqData?.schedule?.length
      ) {
        const anchorMs = existing.actualStartAt
          ? new Date(existing.actualStartAt).getTime()
          : seqData.schedule[0].meatOnAt
            ? new Date(seqData.schedule[0].meatOnAt).getTime()
            : null;

        if (anchorMs !== null) {
          const newMs = new Date(newActualStartAt).getTime();
          const deltaMs = newMs - anchorMs;

          if (Math.abs(deltaMs) >= 60_000) {
            const updatedSchedule: SeqScheduleItem[] = seqData.schedule.map((item) => ({
              ...item,
              meatOnAt: item.meatOnAt
                ? new Date(new Date(item.meatOnAt).getTime() + deltaMs).toISOString()
                : item.meatOnAt,
              estimatedFinishAt: item.estimatedFinishAt
                ? new Date(new Date(item.estimatedFinishAt).getTime() + deltaMs).toISOString()
                : item.estimatedFinishAt,
            }));

            // Merge with any client-supplied sequenceData update (client wins on
            // non-timestamp fields; our derived timestamps take priority).
            const baseSeq = (updateData.sequenceData as SeqData | undefined) ?? seqData;
            updateData.sequenceData = { ...baseSeq, schedule: updatedSchedule };

            // ── Rescale AI check-in offsets when meat-on time shifts ──────────
            // AI check-in offsetMinutes are stored relative to meatOnAt, so when
            // meatOnAt shifts all absolute scheduled times shift automatically.
            // When both meatOnAt and estimatedFinishAt shift by the same delta the
            // cook duration is unchanged (scale = 1.0) and offsets need no
            // adjustment. This block handles the general case: if a future path
            // shifts only one of the two timestamps, offsets are proportionally
            // rescaled so they stay in the same relative position in the cook.
            const existingAiCheckins = seqData.aiCheckins as AiCheckinItem[] | null | undefined;
            if (Array.isArray(existingAiCheckins) && existingAiCheckins.length > 0) {
              const oldFinishMs = seqData.schedule[0]?.estimatedFinishAt
                ? new Date(seqData.schedule[0].estimatedFinishAt).getTime()
                : null;
              const newMeatOnMs = anchorMs + deltaMs;
              const newFinishMs = updatedSchedule[0]?.estimatedFinishAt
                ? new Date(updatedSchedule[0].estimatedFinishAt).getTime()
                : null;
              if (oldFinishMs !== null && newFinishMs !== null) {
                const oldDurationMs = oldFinishMs - anchorMs;
                const newDurationMs = newFinishMs - newMeatOnMs;
                if (oldDurationMs > 0 && Math.abs(newDurationMs - oldDurationMs) > 1000) {
                  const durationScale = newDurationMs / oldDurationMs;
                  const nowMs = Date.now();
                  const rescaled = existingAiCheckins.map((ci) => {
                    const absMs = newMeatOnMs + ci.offsetMinutes * 60_000;
                    if (absMs <= nowMs) return ci; // already fired — don't shift
                    return { ...ci, offsetMinutes: Math.round(ci.offsetMinutes * durationScale) };
                  });
                  updateData.sequenceData = {
                    ...(updateData.sequenceData as SeqData),
                    aiCheckins: rescaled,
                  };
                }
              }
            }

            // Persist the corrected finish time on the cook row so queries that
            // sort or filter by plannedEndAt stay accurate.
            const newFinish = updatedSchedule[0]?.estimatedFinishAt;
            if (newFinish) {
              updateData.plannedEndAt = new Date(newFinish);
            }
          }
        }
      }

      // ── Shift frozen timestamps when actualThawStartAt changes ──
      const newActualThawStartAt = req.body.actualThawStartAt;
      if (
        newActualThawStartAt &&
        typeof newActualThawStartAt === "string" &&
        seqData?.frozen
      ) {
        const anchorMs = existing.actualThawStartAt
          ? new Date(existing.actualThawStartAt).getTime()
          : seqData.frozen.thawStartAt
            ? new Date(seqData.frozen.thawStartAt).getTime()
            : null;

        if (anchorMs !== null) {
          const newMs = new Date(newActualThawStartAt).getTime();
          const deltaMs = newMs - anchorMs;

          if (Math.abs(deltaMs) >= 60_000) {
            const updatedFrozen: SeqFrozen = {
              ...seqData.frozen,
              thawStartAt: newActualThawStartAt,
              thawEndAt: seqData.frozen.thawEndAt
                ? new Date(new Date(seqData.frozen.thawEndAt).getTime() + deltaMs).toISOString()
                : seqData.frozen.thawEndAt,
            };
            const existingSeq = (updateData.sequenceData as SeqData | undefined) ?? seqData;
            updateData.sequenceData = { ...existingSeq, frozen: updatedFrozen };
          }
        }
      }

      // ── Rescale AI check-in offsets for direct estimatedFinishAt edits ───────
      // When a client patches sequenceData directly (e.g. an "adjust finish time"
      // action on a live cook) without also sending actualStartAt, meatOnAt stays
      // fixed but estimatedFinishAt changes. Detect that shift and proportionally
      // rescale stored AI check-in offsetMinutes so they stay at the correct
      // relative position within the new cook duration.
      // This is a no-op when actualStartAt also changed (handled by the deltaMs
      // path above which already rescales via the same durationScale logic).
      if (
        !newActualStartAt &&
        "sequenceData" in req.body &&
        req.body.sequenceData !== null &&
        Array.isArray(seqData?.aiCheckins) &&
        seqData.aiCheckins!.length > 0
      ) {
        const incomingSd = req.body.sequenceData as SeqData | null;
        const newFinishStr = incomingSd?.schedule?.[0]?.estimatedFinishAt;
        const oldFinishStr = seqData!.schedule?.[0]?.estimatedFinishAt;
        const meatOnStr = seqData!.schedule?.[0]?.meatOnAt;

        if (newFinishStr && oldFinishStr && meatOnStr && newFinishStr !== oldFinishStr) {
          const oldFinishMs = new Date(oldFinishStr).getTime();
          const newFinishMs = new Date(newFinishStr).getTime();
          const meatOnMs = new Date(meatOnStr).getTime();

          if (!isNaN(oldFinishMs) && !isNaN(newFinishMs) && !isNaN(meatOnMs)) {
            const oldDurationMs = oldFinishMs - meatOnMs;
            const newDurationMs = newFinishMs - meatOnMs;

            if (oldDurationMs > 0 && newDurationMs > 0 && Math.abs(newDurationMs - oldDurationMs) > 1000) {
              const durationScale = newDurationMs / oldDurationMs;
              const nowMs = Date.now();
              const rescaled = (seqData!.aiCheckins as AiCheckinItem[]).map((ci) => {
                const absMs = meatOnMs + ci.offsetMinutes * 60_000;
                if (absMs <= nowMs) return ci; // already fired — don't shift
                return { ...ci, offsetMinutes: Math.round(ci.offsetMinutes * durationScale) };
              });
              // Merge into whatever sequenceData update the client sent
              const baseForMerge = (updateData.sequenceData as SeqData | undefined) ?? seqData!;
              updateData.sequenceData = { ...baseForMerge, aiCheckins: rescaled };
            }
          }
        }
      }
    }
  }

  const [cook] = await db.update(cooksTable).set(updateData)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)))
    .returning();
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  if (cook.status === "completed" || cook.status === "cancelled") {
    void endLiveActivitiesForCook(cook.id).catch((err) =>
      req.log.warn({ err: err.message, cookId: cook.id }, "endLiveActivitiesForCook failed")
    );
  }
  // ── Temperature thinning (fire-and-forget, only on completion) ────────────
  // Bucket the cook's readings down to 1 per 15-min window per probe so the
  // table stays bounded without any impact on chart quality or calibration.
  if (cook.status === "completed") {
    void thinTemperatureReadings(cook.id).catch((err: Error) =>
      req.log.warn({ err: err.message, cookId: cook.id }, "thinTemperatureReadings failed")
    );
  }
  // ── Outlier detection (fire-and-forget, only on fresh completions) ─────────
  // Only evaluate when the cook just transitioned to completed AND hasn't already
  // been dismissed by the user. Re-evaluating on every PATCH would re-flag a cook
  // the user deliberately marked as accurate.
  if (cook.status === "completed" && !cook.outlierDismissed) {
    void (async () => {
      try {
        const outlier = await detectOutlier(cook.id, {
          actualStartAt: cook.actualStartAt,
          actualEndAt: cook.actualEndAt,
          plannedEndAt: cook.plannedEndAt,
          ratingTenderness: cook.ratingTenderness,
          ratingBark: cook.ratingBark,
          ratingFlavor: cook.ratingFlavor,
          rating: cook.rating,
        });
        if (outlier !== cook.isOutlier) {
          await db
            .update(cooksTable)
            .set({ isOutlier: outlier })
            .where(and(eq(cooksTable.id, cook.id), eq(cooksTable.userId, req.userId)));
        }
      } catch (err: unknown) {
        req.log.warn({ err, cookId: cook.id }, "detectOutlier failed");
      }
    })();
  }
  res.json({ ...cook, grillName });
});

router.post("/cooks/:id/outlier-dismiss", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db
    .update(cooksTable)
    .set({ outlierDismissed: true })
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)))
    .returning();
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  clearHomeInsightsCache(req.userId);
  res.json({ ok: true });
});

router.get("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const cooks = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  if (!cooks.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const result = await Promise.all(cooks.map(async (cook) => {
    let grillName: string | null = null;
    if (cook.grillId) {
      const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
      grillName = grill?.name ?? null;
    }
    return { ...cook, grillName };
  }));
  result.sort((a, b) => {
    const aTime = a.plannedStartAt ? new Date(a.plannedStartAt).getTime() : Infinity;
    const bTime = b.plannedStartAt ? new Date(b.plannedStartAt).getTime() : Infinity;
    return aTime - bTime;
  });
  res.json(result);
});

router.patch("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [first] = await db.select({ id: cooksTable.id }).from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)))
    .limit(1);
  if (!first) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.sessionLabel !== undefined) updateData.sessionLabel = parsed.data.sessionLabel;
  if (parsed.data.sessionNotes !== undefined) updateData.sessionNotes = parsed.data.sessionNotes;
  if (parsed.data.sequenceData !== undefined) updateData.sequenceData = parsed.data.sequenceData;
  await db.update(cooksTable).set(updateData)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  res.json({ sessionId: params.data.sessionId, ...parsed.data });
});

router.delete("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const cooks = await db.select({ id: cooksTable.id }).from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  if (!cooks.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await db.transaction(async (tx) => {
    for (const cook of cooks) {
      await tx.delete(temperatureReadingsTable).where(eq(temperatureReadingsTable.cookId, cook.id));
      await tx.delete(cookCheckins).where(eq(cookCheckins.cookId, cook.id));
    }
    await tx.delete(cooksTable)
      .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  });
  res.sendStatus(204);
});

router.delete("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  await db.transaction(async (tx) => {
    await tx.delete(temperatureReadingsTable).where(eq(temperatureReadingsTable.cookId, params.data.id));
    await tx.delete(cookCheckins).where(eq(cookCheckins.cookId, params.data.id));
    await tx.delete(cooksTable).where(eq(cooksTable.id, params.data.id));
  });
  res.sendStatus(204);
});

export default router;
