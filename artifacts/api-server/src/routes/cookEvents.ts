import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, cooksTable, cookEvents } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";
import type { CookCheckin, CookEvent } from "@workspace/db";
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

export interface CookHealthInput {
  checkins: Pick<CookCheckin, "internalTempF" | "pitTempF" | "statusFlag" | "phaseKey" | "scheduledAt" | "firedAt">[];
  events: { eventType: CookEvent["eventType"] }[];
  cookTempF: number | null | undefined;
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
  };
}

export function computeCookHealthScore(input: CookHealthInput): CookHealthResult {
  const { checkins, events, cookTempF } = input;

  let issueCount = 0;
  let stallDetected = false;
  let pitDrift = false;

  // Count flagged issues from checkins
  for (const ci of checkins) {
    if (ci.statusFlag === "flare_up" || ci.statusFlag === "running_behind") {
      issueCount++;
    }
  }

  // Count issue events
  issueCount += events.filter(
    (e) => e.eventType === "flare_up" || e.eventType === "fuel_low",
  ).length;

  // Stall detection: if two consecutive checkins have internal temps within 3°F
  for (let i = 1; i < checkins.length; i++) {
    const prev = checkins[i - 1].internalTempF;
    const curr = checkins[i].internalTempF;
    if (prev != null && curr != null && Math.abs(curr - prev) < 3) {
      stallDetected = true;
    }
  }

  // Pit drift detection: pit temp deviates >30°F from target
  if (cookTempF != null) {
    for (const ci of checkins) {
      if (ci.pitTempF != null && Math.abs(ci.pitTempF - cookTempF) > 30) {
        pitDrift = true;
        break;
      }
    }
  }

  // Step timing: checkins fired significantly late (>30 min after scheduled)
  let lateCount = 0;
  for (const ci of checkins) {
    if (ci.scheduledAt && ci.firedAt) {
      const schedMs = new Date(ci.scheduledAt).getTime();
      const firedMs = new Date(ci.firedAt).getTime();
      if (firedMs - schedMs > 30 * 60_000) lateCount++;
    }
  }

  // Compute a numeric score (0–100)
  let score = 100;
  score -= issueCount * 15;
  if (stallDetected) score -= 10;
  if (pitDrift) score -= 10;
  score -= lateCount * 5;
  score = Math.max(0, Math.min(100, score));

  let grade: "A" | "B" | "C" | "D" | "F";
  let reason: string;

  if (score >= 90) {
    grade = "A";
    reason = "Temps tracking well, no issues detected — keep it up!";
  } else if (score >= 75) {
    grade = "B";
    reason =
      issueCount > 0
        ? `Minor issue(s) flagged but overall on track.`
        : stallDetected
          ? "Stall detected — this is normal, cook is otherwise tracking well."
          : "Cook is progressing well with minor deviations.";
  } else if (score >= 60) {
    grade = "C";
    reason =
      pitDrift
        ? "Pit temp has drifted significantly — check vents or fuel."
        : issueCount >= 2
          ? "Multiple issues flagged — keep a close eye on temps."
          : "Cook is running behind or has encountered obstacles.";
  } else if (score >= 45) {
    grade = "D";
    reason =
      issueCount >= 3
        ? "Several issues detected — consider adjusting your approach."
        : "Cook is significantly off-plan — temps or timing need attention.";
  } else {
    grade = "F";
    reason = "Major issues detected — consider reviewing your setup and temps.";
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
    })
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
    .orderBy(asc(cookCheckins.scheduledAt));

  const evts = await db
    .select({ eventType: cookEvents.eventType })
    .from(cookEvents)
    .where(eq(cookEvents.cookId, params.data.id));

  const result = computeCookHealthScore({
    checkins,
    events: evts,
    cookTempF: cook.cookTempF,
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
