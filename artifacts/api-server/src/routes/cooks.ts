import { Router, type IRouter } from "express";
import { eq, and, desc, count } from "drizzle-orm";
import { db, cooksTable, grillsTable, alertsTable, cookCheckins, temperatureReadingsTable, cookPhotosTable } from "@workspace/db";
import { deleteFromStorage } from "./cookPhotos";
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
import { clearHomeInsightsCache } from "./ai";
import { endLiveActivitiesForCook } from "../lib/liveActivityPush";
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

  const cooks = await db.select().from(cooksTable)
    .where(and(...conditions))
    .orderBy(cooksTable.createdAt);

  const result = await Promise.all(cooks.map(async (cook) => {
    let grillName: string | null = null;
    if (cook.grillId) {
      const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
      grillName = grill?.name ?? null;
    }
    const [{ photoCount }] = await db
      .select({ photoCount: count() })
      .from(cookPhotosTable)
      .where(and(eq(cookPhotosTable.cookId, cook.id), eq(cookPhotosTable.userId, req.userId)));
    return { ...cook, grillName, photoCount: Number(photoCount) };
  }));
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
    // (fromFrozen, isCompetition). Strip null → undefined so the DB default
    // (false) is used when the value is absent from the request body.
    fromFrozen: parsed.data.fromFrozen ?? undefined,
    isCompetition: parsed.data.isCompetition ?? undefined,
    ...(analysisResult !== null ? { analysisResult } : {}),
    ...(sequenceData !== null ? { sequenceData } : {}),
  }).returning();
  if (cook.grillId) {
    await db.update(grillsTable).set({ totalCooks: (await db.select({ tc: grillsTable.totalCooks }).from(grillsTable).where(eq(grillsTable.id, cook.grillId)))[0]?.tc + 1 || 1 }).where(eq(grillsTable.id, cook.grillId));
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
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
    // Append to history — fetch current history first, then accumulate
    const [current] = await db
      .select({ analysisHistory: cooksTable.analysisHistory })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    const existingHistory = Array.isArray(current?.analysisHistory) ? (current.analysisHistory as unknown[]) : [];
    updateData.analysisHistory = [
      ...existingHistory,
      { ...req.body.analysisResult, savedAt: new Date().toISOString() },
    ];
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
  const isTimestampCorrection =
    ("actualStartAt" in req.body && req.body.actualStartAt !== undefined) ||
    ("actualThawStartAt" in req.body && req.body.actualThawStartAt !== undefined);

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
    }
  }

  // Canonical judgeScore derivation: when any KCBS sub-score is being written,
  // recompute the compatibility total (appearance + taste + texture) so that
  // judgeScore always reflects the sub-scores rather than an independent client value.
  const hasSubScoreUpdate =
    "judgeScoreAppearance" in updateData ||
    "judgeScoreTaste" in updateData ||
    "judgeScoreTexture" in updateData;
  if (hasSubScoreUpdate) {
    // Fetch current persisted sub-scores so we can fill in unchanged axes.
    const [existing] = await db
      .select({ a: cooksTable.judgeScoreAppearance, t: cooksTable.judgeScoreTaste, x: cooksTable.judgeScoreTexture })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    // Distinguish explicit null (client clearing a value) from absent (not changing it).
    const incomingApp = "judgeScoreAppearance" in updateData
      ? (updateData.judgeScoreAppearance as number | null)
      : existing?.a ?? null;
    const incomingTaste = "judgeScoreTaste" in updateData
      ? (updateData.judgeScoreTaste as number | null)
      : existing?.t ?? null;
    const incomingTexture = "judgeScoreTexture" in updateData
      ? (updateData.judgeScoreTexture as number | null)
      : existing?.x ?? null;
    // Recompute total only when at least one axis has a real value; clear when all are null.
    if (incomingApp != null || incomingTaste != null || incomingTexture != null) {
      updateData.judgeScore = (incomingApp ?? 0) + (incomingTaste ?? 0) + (incomingTexture ?? 0);
    } else {
      updateData.judgeScore = null;
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
  res.json({ ...cook, grillName });
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
  for (const cook of cooks) {
    const cookPhotoRows = await db.select().from(cookPhotosTable).where(eq(cookPhotosTable.cookId, cook.id));
    for (const p of cookPhotoRows) {
      await deleteFromStorage(p.storageKey).catch(() => {});
    }
    await db.delete(cookPhotosTable).where(eq(cookPhotosTable.cookId, cook.id));
    await db.delete(cookCheckins).where(eq(cookCheckins.cookId, cook.id));
    await db.delete(alertsTable).where(eq(alertsTable.cookId, cook.id));
  }
  await db.delete(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
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
  const cookPhotoRows = await db.select().from(cookPhotosTable).where(eq(cookPhotosTable.cookId, params.data.id));
  for (const p of cookPhotoRows) {
    await deleteFromStorage(p.storageKey).catch(() => {});
  }
  await db.delete(cookPhotosTable).where(eq(cookPhotosTable.cookId, params.data.id));
  await db.delete(cookCheckins).where(eq(cookCheckins.cookId, params.data.id));
  await db.delete(alertsTable).where(eq(alertsTable.cookId, params.data.id));
  await db.delete(cooksTable).where(eq(cooksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
