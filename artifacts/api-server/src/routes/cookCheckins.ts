import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, cookCheckins } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import {
  CHECKIN_SCHEDULES,
  getCheckinSchedule,
  generateCheckinSchedule,
} from "@workspace/checkin-schedule";

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
  const wrapAtMinutes =
    typeof firstItem.wrapAtMinutes === "number" ? firstItem.wrapAtMinutes : null;
  // foodType drives which meat-specific phase keys/labels are returned.
  // Prefer the cook's own foodType column; fall back to the AI plan's embedded value.
  const foodType =
    cook.foodType ??
    (typeof firstItem.foodType === "string" ? firstItem.foodType : null);
  const weightLbs =
    typeof firstItem.weightLbs === "number" ? firstItem.weightLbs : null;

  if (isNaN(meatOnAt.getTime()) || isNaN(estimatedFinishAt.getTime())) {
    res.json([]);
    return;
  }

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
      phaseLabel: parsed.data.phaseLabel ?? null,
      phaseKey: parsed.data.phaseKey ?? null,
    })
    .returning();

  // Adaptive ETA update: if the actual internal temp deviates significantly
  // from the expected range for this phase, recompute the cook's estimated
  // finish time and persist it back to the sequence data so subsequent
  // schedule fetches and client display reflect the adjustment.
  if (parsed.data.internalTempF != null && parsed.data.phaseKey) {
    const range = PHASE_EXPECTED_RANGES[parsed.data.phaseKey];
    if (range) {
      const [lo, hi] = range;
      const mid = (lo + hi) / 2;
      const deviation = parsed.data.internalTempF - mid;

      if (Math.abs(deviation) >= 15) {
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
        } catch {
          // ETA update is best-effort; don't fail the check-in save
        }
      }
    }
  }

  res.status(201).json(checkin);
});

export default router;
