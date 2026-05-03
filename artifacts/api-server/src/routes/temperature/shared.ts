import { type Request } from "express";
import { rateLimit } from "express-rate-limit";

export interface AuthedRequest extends Request {
  userId: string;
}

export const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before uploading again." },
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment before trying again." },
});

export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export interface LiveReading { timeMinutes: number; tempF: number; }

export type CookPhase = "heat_up" | "stall" | "finishing" | "done";

/** Least-squares linear regression slope in °F/min over the last N readings. */
export function computeSlope(readings: LiveReading[], windowSize = 8): number | null {
  if (readings.length < 2) return null;
  const pts = readings.slice(-windowSize);
  const n = pts.length;
  const sumX = pts.reduce((s, r) => s + r.timeMinutes, 0);
  const sumY = pts.reduce((s, r) => s + r.tempF, 0);
  const sumXY = pts.reduce((s, r) => s + r.timeMinutes * r.tempF, 0);
  const sumX2 = pts.reduce((s, r) => s + r.timeMinutes * r.timeMinutes, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 0.001) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

/** Classify the current cook phase from slope + current temp. */
export function detectPhase(
  slope: number | null,
  currentTempF: number,
  targetTempF?: number | null,
): CookPhase {
  if (targetTempF != null && currentTempF >= targetTempF - 5) return "done";
  if (currentTempF > 180) return "finishing";
  if (currentTempF < 140) return "heat_up";
  if (slope != null && Math.abs(slope) < 0.2) return "stall";
  return slope != null && slope > 0 ? "heat_up" : "stall";
}

/** Heuristic time-to-stall, stall duration, and time-to-finish estimates. */
export function computeHeuristics(
  phase: CookPhase,
  currentTempF: number,
  slope: number | null,
  targetTempF?: number | null,
  weightLbs?: number | null,
  pitTempF?: number | null,
): { timeToStallMinutes: number | null; stallDurationMinutes: number | null; timeToFinishMinutes: number | null } {
  const STALL_ENTRY_TEMP = 158;
  const STALL_EXIT_TEMP  = 175;
  const FINISH_SLOPE     = 0.35;
  const pit = pitTempF && pitTempF > 150 ? pitTempF : 225;
  const pitFactor = pit / 225;

  const stallDurationBase = weightLbs && weightLbs > 0 ? Math.round(weightLbs * 10 / pitFactor) : 90;
  const stallDuration = Math.min(Math.max(stallDurationBase, 45), 360);

  let timeToStall: number | null = null;
  let timeToFinish: number | null = null;

  if (phase === "heat_up") {
    timeToStall = slope && slope > 0.05
      ? Math.max(0, Math.round((STALL_ENTRY_TEMP - currentTempF) / slope))
      : null;
    const finishAfterStall = targetTempF
      ? Math.max(0, Math.round((targetTempF - STALL_EXIT_TEMP) / (FINISH_SLOPE * pitFactor)))
      : null;
    timeToFinish = timeToStall != null && finishAfterStall != null
      ? timeToStall + stallDuration + finishAfterStall
      : null;
  } else if (phase === "stall") {
    timeToStall = 0;
    const finishAfterStall = targetTempF
      ? Math.max(0, Math.round((targetTempF - STALL_EXIT_TEMP) / (FINISH_SLOPE * pitFactor)))
      : null;
    const remainingStall = Math.round(stallDuration * 0.5);
    timeToFinish = finishAfterStall != null ? remainingStall + finishAfterStall : null;
  } else if (phase === "finishing" && targetTempF) {
    timeToStall = 0;
    const s = slope && slope > 0.05 ? slope : FINISH_SLOPE * pitFactor;
    timeToFinish = Math.max(0, Math.round((targetTempF - currentTempF) / s));
  }

  return {
    timeToStallMinutes: timeToStall,
    stallDurationMinutes: phase !== "done" ? stallDuration : null,
    timeToFinishMinutes: timeToFinish,
  };
}
