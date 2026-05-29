import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, cooksTable, cookCheckins, cookEvents } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import {
  CHECKIN_SCHEDULES,
  getCheckinSchedule,
  generateCheckinSchedule,
} from "@workspace/checkin-schedule";
import { computeCookHealthScore, computeFinishRange, computePlanAccuracy } from "./cookEvents";
import { getAssessment } from "./ai/shared";
import type { AiCheckinItem } from "@workspace/checkin-schedule";

// ---------------------------------------------------------------------------
// Derived lookup: expected internal temp range per phase key.
// Built from the shared CHECKIN_SCHEDULES so there is a single definition.
// ---------------------------------------------------------------------------

const PHASE_EXPECTED_RANGES: Record<string, [number, number]> = Object.fromEntries(
  CHECKIN_SCHEDULES.flatMap((s) => s.phases)
    .filter((p) => p.expectedInternalTempRange != null)
    .map((p) => [p.key, p.expectedInternalTempRange as [number, number]]),
);

const router: IRouter = Router();

const CookCheckinIdParams = z.object({ id: z.coerce.number().int().positive() });

const CreateCookCheckinBodySchema = z.object({
  scheduledAt: z.string(),
  internalTempF: z.number().nullable().optional(),
  pitTempF: z.number().nullable().optional(),
  statusFlag: z.enum(["all_good", "running_behind", "flare_up", "low_fuel"]).nullable().optional(),
  userNote: z.string().nullable().optional(),
  photoKey: z.string().nullable().optional(),
  aiGuidanceShown: z.string().nullable().optional(),
  autoDismissed: z.boolean().optional(),
  isAutomatic: z.boolean().optional(),
  probeSource: z.string().nullable().optional(),
  phaseLabel: z.string().nullable().optional(),
  phaseKey: z.string().nullable().optional(),
});

// ---------------------------------------------------------------------------
// Schedule generation — delegates to the shared generateCheckinSchedule()
// so server and mobile always produce identical phase keys, labels, and times.
// ---------------------------------------------------------------------------

interface ScheduleItem {
  phaseKey: string;
  phaseLabel: string;
  scheduledAt: string;
  anchorType: "sequence" | "percent";
}

function buildSchedule(
  meatOnAt: Date,
  estimatedFinishAt: Date,
  wrapAtMinutes: number | null,
  foodType: string | null | undefined,
  weightLbs: number | null | undefined,
): ScheduleItem[] {
  const meatOnMs = meatOnAt.getTime();
  const finishMs = estimatedFinishAt.getTime();
  if (finishMs <= meatOnMs) return [];

  const scheduled = generateCheckinSchedule(
    foodType,
    meatOnMs,
    finishMs,
    wrapAtMinutes != null && wrapAtMinutes > 0
      ? { wrapAtMinutes }
      : null,
    weightLbs,
  );

  const useAnchors = wrapAtMinutes != null && wrapAtMinutes > 0;

  return scheduled.map((sc) => ({
    phaseKey: sc.phaseKey,
    phaseLabel: sc.phaseLabel,
    scheduledAt: new Date(sc.scheduledAt).toISOString(),
    anchorType: useAnchors ? ("sequence" as const) : ("percent" as const),
  }));
}


// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/cooks/:id/checkins", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookCheckinIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [cook] = await db
    .select({ id: cooksTable.id })
    .from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  const checkins = await db
    .select()
    .from(cookCheckins)
    .where(eq(cookCheckins.cookId, params.data.id))
    .orderBy(cookCheckins.scheduledAt);

  res.json(checkins);
});

router.get("/cooks/:id/checkins/schedule", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookCheckinIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [cook] = await db
    .select({
      id: cooksTable.id,
      foodType: cooksTable.foodType,
      sequenceData: cooksTable.sequenceData,
    })
    .from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  // sequenceData is jsonb — may come back as object or string depending on driver
  let seqData: Record<string, unknown> | null = null;
  try {
    seqData =
      typeof cook.sequenceData === "string"
        ? JSON.parse(cook.sequenceData)
        : (cook.sequenceData as Record<string, unknown> | null);
  } catch {}

  const schedule = seqData?.schedule;
  const firstItem = Array.isArray(schedule) ? (schedule[0] as Record<string, unknown>) : null;

  if (!firstItem?.meatOnAt || !firstItem?.estimatedFinishAt) {
    res.json([]);
    return;
  }

  const meatOnAt = new Date(firstItem.meatOnAt as string);
  const estimatedFinishAt = new Date(firstItem.estimatedFinishAt as string);

  if (isNaN(meatOnAt.getTime()) || isNaN(estimatedFinishAt.getTime())) {
    res.json([]);
    return;
  }

  // ── AI-generated check-ins (primary path) ──────────────────────────────
  // If sequenceData contains an AI-generated checkins array, resolve each
  // offsetMinutes to an absolute scheduledAt and return those directly.
  // The static library is only used as a fallback for cooks that have no
  // AI plan (legacy records or cooks started without running the AI predictor).
  const aiCheckins = seqData?.aiCheckins;
  if (Array.isArray(aiCheckins) && aiCheckins.length > 0) {
    const meatOnMs = meatOnAt.getTime();
    const items = (aiCheckins as AiCheckinItem[]).map((ci, idx) => ({
      phaseKey: `ai_checkin_${idx}`,
      phaseLabel: ci.label,
      scheduledAt: new Date(meatOnMs + ci.offsetMinutes * 60_000).toISOString(),
      anchorType: "ai" as const,
      coachingNote: ci.coachingNote,
      visualCues: ci.visualCues,
      expectedInternalTempRange: ci.expectedInternalTempRange ?? null,
    }));
    res.json(items);
    return;
  }

  // ── Static library fallback ───────────────────────────────────────────
  const wrapAtMinutes =
    typeof firstItem.wrapAtMinutes === "number" ? firstItem.wrapAtMinutes : null;
  const foodType =
    cook.foodType ??
    (typeof firstItem.foodType === "string" ? firstItem.foodType : null);
  const weightLbs =
    typeof firstItem.weightLbs === "number" ? firstItem.weightLbs : null;

  const items = buildSchedule(meatOnAt, estimatedFinishAt, wrapAtMinutes, foodType, weightLbs);
  res.json(items);
});

router.post("/cooks/:id/checkins", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookCheckinIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateCookCheckinBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [cook] = await db
    .select({ id: cooksTable.id })
    .from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  const [checkin] = await db
    .insert(cookCheckins)
    .values({
      cookId: params.data.id,
      scheduledAt: new Date(parsed.data.scheduledAt),
      firedAt: new Date(),
      internalTempF: parsed.data.internalTempF ?? null,
      pitTempF: parsed.data.pitTempF ?? null,
      statusFlag: parsed.data.statusFlag ?? null,
      userNote: parsed.data.userNote ?? null,
      photoKey: parsed.data.photoKey ?? null,
      aiGuidanceShown: parsed.data.aiGuidanceShown ?? null,
      autoDismissed: parsed.data.autoDismissed ?? false,
      isAutomatic: parsed.data.isAutomatic ?? false,
      probeSource: parsed.data.probeSource ?? null,
      phaseLabel: parsed.data.phaseLabel ?? null,
      phaseKey: parsed.data.phaseKey ?? null,
    })
    .returning();

  // Adaptive ETA update: if the actual internal temp deviates significantly
  // from the expected range for this phase, recompute the cook's estimated
  // finish time and persist it back to the sequence data so subsequent
  // schedule fetches and client display reflect the adjustment.
  //
  // Range source priority:
  //   1. Static PHASE_EXPECTED_RANGES dict (built from the shared checkin-schedule lib)
  //   2. expectedInternalTempRange stored on the AI-generated check-in itself
  //      (phaseKey pattern "ai_checkin_<idx>" → sequenceData.aiCheckins[idx])
  if (parsed.data.internalTempF != null && parsed.data.phaseKey) {
    const staticRange: [number, number] | undefined = PHASE_EXPECTED_RANGES[parsed.data.phaseKey];
    const aiCheckinMatch = /^ai_checkin_(\d+)$/.exec(parsed.data.phaseKey);

    if (staticRange != null || aiCheckinMatch != null) {
      try {
        const [cookWithSeq] = await db
          .select({ id: cooksTable.id, sequenceData: cooksTable.sequenceData })
          .from(cooksTable)
          .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

        if (cookWithSeq?.sequenceData) {
          const seq: Record<string, unknown> =
            typeof cookWithSeq.sequenceData === "string"
              ? JSON.parse(cookWithSeq.sequenceData as string)
              : (cookWithSeq.sequenceData as Record<string, unknown>);

          // Resolve the expected temp range for this check-in phase
          let range: [number, number] | null = staticRange ?? null;
          if (range == null && aiCheckinMatch) {
            const idx = parseInt(aiCheckinMatch[1], 10);
            const aiCheckins = seq?.aiCheckins as AiCheckinItem[] | undefined;
            const aiRange = aiCheckins?.[idx]?.expectedInternalTempRange;
            if (Array.isArray(aiRange) && aiRange.length === 2) {
              range = aiRange as [number, number];
            }
          }

          if (range != null) {
            const [lo, hi] = range;
            const mid = (lo + hi) / 2;
            const deviation = parsed.data.internalTempF - mid;

            if (Math.abs(deviation) >= 15) {
              const schedule = seq?.schedule;
              if (Array.isArray(schedule) && schedule.length > 0) {
                const first = schedule[0] as Record<string, unknown>;
                if (first.estimatedFinishAt) {
                  const finishMs = new Date(first.estimatedFinishAt as string).getTime();
                  const nowMs = Date.now();
                  const remaining = finishMs - nowMs;

                  if (remaining > 0) {
                    // Positive deviation = temp ahead = faster cook = compress remaining time.
                    // Negative deviation = temp behind = slower cook = extend remaining time.
                    // Clamped to ±25% of remaining duration.
                    const rangeWidth = hi - lo;
                    const scaleFactor = 1 - (deviation / rangeWidth) * 0.25;
                    const clampedScale = Math.max(0.75, Math.min(1.25, scaleFactor));
                    const newFinishMs = nowMs + remaining * clampedScale;

                    // ── Rescale AI check-in offsets ──────────────────────────
                    // When estimatedFinishAt shifts, rescale the remaining unfired
                    // AI check-in offsetMinutes proportionally so they stay in the
                    // same relative position within the cook. Phase labels and
                    // coaching notes are never touched — only times shift.
                    let updatedAiCheckins: AiCheckinItem[] | null = null;
                    const storedAiCheckins = seq?.aiCheckins;
                    if (Array.isArray(storedAiCheckins) && storedAiCheckins.length > 0) {
                      const meatOnMs = first.meatOnAt
                        ? new Date(first.meatOnAt as string).getTime()
                        : null;
                      if (meatOnMs !== null && !isNaN(meatOnMs)) {
                        const oldTotalMs = finishMs - meatOnMs;
                        const newTotalMs = newFinishMs - meatOnMs;
                        if (oldTotalMs > 0 && newTotalMs > 0) {
                          const durationScale = newTotalMs / oldTotalMs;
                          updatedAiCheckins = (storedAiCheckins as AiCheckinItem[]).map((ci) => {
                            const scheduledMs = meatOnMs + ci.offsetMinutes * 60_000;
                            // Only rescale check-ins that haven't fired yet
                            if (scheduledMs <= nowMs) return ci;
                            return {
                              ...ci,
                              offsetMinutes: Math.round(ci.offsetMinutes * durationScale),
                            };
                          });
                        }
                      }
                    }

                    const newSeq = {
                      ...seq,
                      schedule: schedule.map((item: unknown, idx: number) =>
                        idx === 0
                          ? {
                              ...(item as Record<string, unknown>),
                              estimatedFinishAt: new Date(newFinishMs).toISOString(),
                            }
                          : item,
                      ),
                      ...(updatedAiCheckins !== null ? { aiCheckins: updatedAiCheckins } : {}),
                    };

                    await db
                      .update(cooksTable)
                      .set({ sequenceData: newSeq })
                      .where(
                        and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)),
                      );
                  }
                }
              }
            }
          }
        }
      } catch {
        // ETA update is best-effort; don't fail the check-in save
      }
    }
  }

  // Compute and persist health score + finish confidence range after each checkin
  try {
    const allCheckins = await db
      .select()
      .from(cookCheckins)
      .where(eq(cookCheckins.cookId, params.data.id))
      .orderBy(asc(cookCheckins.scheduledAt));

    const allEvents = await db
      .select({ eventType: cookEvents.eventType })
      .from(cookEvents)
      .where(eq(cookEvents.cookId, params.data.id));

    const [cookForHealth] = await db
      .select({
        cookTempF: cooksTable.cookTempF,
        sequenceData: cooksTable.sequenceData,
        analysisResult: cooksTable.analysisResult,
        plannedStartAt: cooksTable.plannedStartAt,
        plannedEndAt: cooksTable.plannedEndAt,
        actualStartAt: cooksTable.actualStartAt,
        actualEndAt: cooksTable.actualEndAt,
        fromFrozen: cooksTable.fromFrozen,
      })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

    if (cookForHealth) {
      const verdict = getAssessment(cookForHealth.analysisResult)?.verdict ?? null;
      const planAccuracyScore = computePlanAccuracy(cookForHealth);
      const health = computeCookHealthScore({
        checkins: allCheckins,
        events: allEvents,
        cookTempF: cookForHealth.cookTempF,
        verdict,
        planAccuracyScore,
      });

      const updatePayload: Record<string, unknown> = {
        healthScore: String(health.grade),
        healthScoreReason: health.reason,
      };

      // Compute finish range if sequence data is available
      const seqData = cookForHealth.sequenceData;
      const seq = typeof seqData === "string" ? JSON.parse(seqData) : seqData;
      const firstItem = Array.isArray(seq?.schedule) ? (seq.schedule[0] as Record<string, unknown>) : null;
      if (firstItem?.estimatedFinishAt) {
        const estimatedFinishAt = new Date(firstItem.estimatedFinishAt as string);
        if (!isNaN(estimatedFinishAt.getTime())) {
          const issueCount = allCheckins.filter(
            (ci) => ci.statusFlag === "flare_up" || ci.statusFlag === "running_behind",
          ).length;
          const range = computeFinishRange(estimatedFinishAt, allCheckins.length, issueCount);
          updatePayload.finishTimeRangeLower = range.lower.toISOString();
          updatePayload.finishTimeRangeUpper = range.upper.toISOString();
        }
      }

      await db
        .update(cooksTable)
        .set(updatePayload)
        .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    }
  } catch {
    // health score update is best-effort; don't fail the checkin save
  }

  res.status(201).json(checkin);
});

export default router;
