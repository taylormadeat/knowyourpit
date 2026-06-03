import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, cooksTable, cookEvents } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import type { CookCheckin, CookEvent } from "@workspace/db";
import { getAssessment } from "./ai/shared";
const router: IRouter = Router();

const CookEventIdParams = z.object({ id: z.coerce.number().int().positive() });

const EVENT_TYPES = [
  "lid_open",
  "flare_up",
  "spritz",
  "mop",
  "charcoal_add",
  "wood_add",
  "fuel_low",
  "vent_adjust",
  "user_note",
  "proactive_alert",
  "voice_note",
] as const;

type EventType = (typeof EVENT_TYPES)[number];

const CreateCookEventBodySchema = z.object({
  eventType: z.enum(EVENT_TYPES).transform((v) => (v === "mop" ? "spritz" : v) as EventType),
  note: z.string().nullable().optional(),
  occurredAt: z.string().datetime({ offset: true }).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Health score computation
// ---------------------------------------------------------------------------

const VERDICT_SCORE: Record<string, number> = {
  perfect: 100,
  good: 75,
  needs_work: 50,
  overcooked: 25,
  undercooked: 25,
};

export interface CookHealthInput {
  checkins: Pick<CookCheckin, "internalTempF" | "pitTempF" | "statusFlag" | "phaseKey" | "scheduledAt" | "firedAt">[];
  events: { eventType: CookEvent["eventType"] }[];
  cookTempF: number | null | undefined;
  verdict?: string | null;
  planAccuracyScore?: number | null;
}

export interface CookHealthResult {
  grade: "A" | "B" | "C" | "D" | "F";
  reason: string;
  factors: {
    tempTracking: string;
    stepTiming: string;
    issueCount: number;
    stallDetected: boolean;
    pitDrift: boolean;
    aiVerdict: string | null;
    planAccuracyScore: number | null;
  };
}

export function computePlanAccuracy(cook: {
  plannedStartAt?: Date | string | null;
  plannedEndAt?: Date | string | null;
  actualEndAt?: Date | string | null;
  actualStartAt?: Date | string | null;
  fromFrozen?: boolean | null;
  sequenceData?: unknown;
}): number | null {
  if (!cook.plannedStartAt || !cook.plannedEndAt || !cook.actualEndAt) return null;
  const frozenMeatOnAt: string | null = cook.fromFrozen
    ? ((cook.sequenceData as any)?.schedule?.[0]?.meatOnAt ?? null)
    : null;
  const effectiveActualStart = frozenMeatOnAt ?? cook.actualStartAt;
  if (!effectiveActualStart) return null;
  const planned = new Date(cook.plannedEndAt).getTime() - new Date(cook.plannedStartAt).getTime();
  const actual = new Date(cook.actualEndAt).getTime() - new Date(effectiveActualStart).getTime();
  if (planned < 5 * 60 * 1000) return null;
  const deviationPct = (Math.abs(actual - planned) / planned) * 100;
  return Math.max(0, Math.round(100 - deviationPct));
}

export function computeCookHealthScore(input: CookHealthInput): CookHealthResult {
  const { checkins, events, cookTempF, verdict = null, planAccuracyScore = null } = input;

  // ── Check-in process score (0–100) ──────────────────────────────────────
  let issueCount = 0;
  let stallDetected = false;
  let pitDrift = false;

  for (const ci of checkins) {
    if (ci.statusFlag === "flare_up" || ci.statusFlag === "running_behind") {
      issueCount++;
    }
  }
  issueCount += events.filter(
    (e) => e.eventType === "flare_up" || e.eventType === "fuel_low",
  ).length;

  for (let i = 1; i < checkins.length; i++) {
    const prev = checkins[i - 1].internalTempF;
    const curr = checkins[i].internalTempF;
    if (prev != null && curr != null && Math.abs(curr - prev) < 3) {
      stallDetected = true;
    }
  }

  if (cookTempF != null) {
    for (const ci of checkins) {
      if (ci.pitTempF != null && Math.abs(ci.pitTempF - cookTempF) > 30) {
        pitDrift = true;
        break;
      }
    }
  }

  let lateCount = 0;
  for (const ci of checkins) {
    if (ci.scheduledAt && ci.firedAt) {
      const schedMs = new Date(ci.scheduledAt).getTime();
      const firedMs = new Date(ci.firedAt).getTime();
      if (firedMs - schedMs > 30 * 60_000) lateCount++;
    }
  }

  let checkinScore = 100;
  checkinScore -= issueCount * 15;
  if (stallDetected) checkinScore -= 10;
  if (pitDrift) checkinScore -= 10;
  checkinScore -= lateCount * 5;
  checkinScore = Math.max(0, Math.min(100, checkinScore));

  // ── Blended score: 60% AI verdict + 25% check-in process + 15% plan ───
  const verdictScore = verdict ? (VERDICT_SCORE[verdict] ?? null) : null;
  const hasCheckinData = checkins.length > 0 || events.length > 0;

  let weightedSum = 0;
  let totalWeight = 0;
  if (verdictScore != null)      { weightedSum += verdictScore      * 0.60; totalWeight += 0.60; }
  if (hasCheckinData)            { weightedSum += checkinScore      * 0.25; totalWeight += 0.25; }
  if (planAccuracyScore != null) { weightedSum += planAccuracyScore * 0.15; totalWeight += 0.15; }

  const score = totalWeight > 0
    ? Math.max(0, Math.min(100, Math.round(weightedSum / totalWeight)))
    : checkinScore;

  // ── Letter grade + reason ────────────────────────────────────────────────
  let grade: "A" | "B" | "C" | "D" | "F";
  let reason: string;

  if (score >= 90) {
    grade = "A";
    reason = verdict === "perfect"
      ? "Perfect cook — excellent process and outcome."
      : "Outstanding cook — everything on track from start to finish.";
  } else if (score >= 75) {
    grade = "B";
    reason = verdict === "good"
      ? "Good result — solid process with minor deviations."
      : issueCount > 0
        ? "Minor issue(s) flagged but overall on track."
        : stallDetected
          ? "Stall detected — normal for this cook, otherwise tracking well."
          : "Cook progressed well with minor deviations.";
  } else if (score >= 60) {
    grade = "C";
    reason = verdict === "needs_work"
      ? "Result needs improvement — keep an eye on temps and timing."
      : pitDrift
        ? "Pit temp drifted significantly — check vents or fuel."
        : issueCount >= 2
          ? "Multiple issues flagged — close monitoring needed."
          : "Cook encountered obstacles but stayed on track.";
  } else if (score >= 45) {
    grade = "D";
    reason = (verdict === "overcooked" || verdict === "undercooked")
      ? `Cook finished ${verdict === "overcooked" ? "overcooked" : "undercooked"} — review temps and timing for next time.`
      : issueCount >= 3
        ? "Several issues detected — consider adjusting your approach."
        : "Cook ran significantly off-plan — temps or timing need attention.";
  } else {
    grade = "F";
    reason = "Major issues detected — review your setup, temps, and process.";
  }

  return {
    grade,
    reason,
    factors: {
      tempTracking: pitDrift ? "Off by >30°F" : "Within range",
      stepTiming: lateCount > 0 ? `${lateCount} step(s) late` : "On time",
      issueCount,
      stallDetected,
      pitDrift,
      aiVerdict: verdict ?? null,
      planAccuracyScore: planAccuracyScore ?? null,
    },
  };
}

// ---------------------------------------------------------------------------
// Finish range computation
// ---------------------------------------------------------------------------

/**
 * Computes a confidence interval around an estimated finish time.
 * The range narrows as more on-track check-ins arrive.
 */
export function computeFinishRange(
  estimatedFinishAt: Date,
  checkinCount: number,
  issueCount: number,
): { lower: Date; upper: Date } {
  // Start at ±45 min, narrow by 10 min per on-track check-in, floor at ±10 min.
  const baseWindowMins = Math.max(10, 45 - checkinCount * 10 + issueCount * 5);
  const lowerMs = estimatedFinishAt.getTime() - baseWindowMins * 60_000;
  const upperMs = estimatedFinishAt.getTime() + baseWindowMins * 60_000;
  return { lower: new Date(lowerMs), upper: new Date(upperMs) };
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

router.get("/cooks/:id/events", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookEventIdParams.safeParse(req.params);
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

  const events = await db
    .select()
    .from(cookEvents)
    .where(eq(cookEvents.cookId, params.data.id))
    .orderBy(asc(cookEvents.occurredAt));

  res.json(events);
});

router.post("/cooks/:id/events", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookEventIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateCookEventBodySchema.safeParse(req.body);
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

  const occurredAt = parsed.data.occurredAt ? new Date(parsed.data.occurredAt) : new Date();

  const [event] = await db
    .insert(cookEvents)
    .values({
      cookId: params.data.id,
      eventType: parsed.data.eventType,
      note: parsed.data.note ?? null,
      occurredAt,
      metadata: parsed.data.metadata ?? null,
    })
    .returning();

  res.status(201).json(event);
});

const DeleteCookEventParams = z.object({
  id: z.coerce.number().int().positive(),
  eventId: z.coerce.number().int().positive(),
});

router.delete("/cooks/:id/events/:eventId", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookEventParams.safeParse(req.params);
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

  const [deleted] = await db
    .delete(cookEvents)
    .where(and(eq(cookEvents.id, params.data.eventId), eq(cookEvents.cookId, params.data.id)))
    .returning({ id: cookEvents.id });

  if (!deleted) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  res.status(204).end();
});

router.get("/cooks/:id/health", requireAuth, async (req: any, res): Promise<void> => {
  const params = CookEventIdParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const { cookCheckins } = await import("@workspace/db");

  const [cook] = await db
    .select({
      id: cooksTable.id,
      cookTempF: cooksTable.cookTempF,
      healthScore: cooksTable.healthScore,
      healthScoreReason: cooksTable.healthScoreReason,
      analysisResult: cooksTable.analysisResult,
      plannedStartAt: cooksTable.plannedStartAt,
      plannedEndAt: cooksTable.plannedEndAt,
      actualStartAt: cooksTable.actualStartAt,
      actualEndAt: cooksTable.actualEndAt,
      fromFrozen: cooksTable.fromFrozen,
      sequenceData: cooksTable.sequenceData,
      isOutlier: cooksTable.isOutlier,
      outlierDismissed: cooksTable.outlierDismissed,
    })
    .from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  // Outlier cooks that haven't been dismissed have unreliable data — return a
  // neutral grade so the score card communicates "review pending" instead of
  // a misleading letter grade derived from incomplete cook history.
  if (cook.isOutlier && !cook.outlierDismissed) {
    res.json({
      cookId: params.data.id,
      grade: null,
      reason: "This cook has been flagged for review. Check-ins or duration data appear unusual. Dismiss the flag to restore scoring.",
      factors: { issueCount: 0, stallDetected: false, pitDrift: false },
      computedAt: new Date().toISOString(),
    });
    return;
  }

  const checkins = await db
    .select()
    .from(cookCheckins)
    .where(eq(cookCheckins.cookId, params.data.id))
    .orderBy(asc(cookCheckins.scheduledAt));

  const evts = await db
    .select({ eventType: cookEvents.eventType })
    .from(cookEvents)
    .where(eq(cookEvents.cookId, params.data.id));

  const verdict = getAssessment(cook.analysisResult)?.verdict ?? null;
  const planAccuracyScore = computePlanAccuracy(cook);

  const result = computeCookHealthScore({
    checkins,
    events: evts,
    cookTempF: cook.cookTempF,
    verdict,
    planAccuracyScore,
  });

  res.json({
    cookId: params.data.id,
    grade: result.grade,
    reason: result.reason,
    factors: result.factors,
    computedAt: new Date().toISOString(),
  });
});

export default router;
