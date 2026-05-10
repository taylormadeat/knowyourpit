import { fmtDurationMs, fmtRelMinutes } from "@/utils/duration";
import type {
  NextStep,
  NextStepKey,
  PlanGrade,
  ScheduleItem,
  SequenceData,
} from "./types";

/** Replace any ISO-8601 timestamps in a string with human-readable local time */
export function fmtISOInText(text: string): string {
  return text.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g,
    (match) => {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    },
  );
}

export function fmtElapsed(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

export function formatDT(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const h = dt.getHours() % 12 || 12;
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ampm = dt.getHours() < 12 ? "AM" : "PM";
  return `${m}/${day}/${dt.getFullYear()} ${h}:${min} ${ampm}`;
}

export function relCountdown(targetMs: number, nowMs: number): string {
  return fmtRelMinutes(targetMs, nowMs);
}

export function getEditDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 30; i >= -7; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

export function formatEditDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatEditTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function fmtDuration(ms: number): string {
  return fmtDurationMs(ms);
}

export function computePlanGrade(c: {
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
}): PlanGrade | null {
  const pStart = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
  const pEnd = c.plannedEndAt ? new Date(c.plannedEndAt).getTime() : null;
  const aStart = c.actualStartAt ? new Date(c.actualStartAt).getTime() : null;
  const aEnd = c.actualEndAt ? new Date(c.actualEndAt).getTime() : null;
  if (!pStart || !pEnd || !aStart || !aEnd) return null;
  const plannedMs = pEnd - pStart;
  if (plannedMs <= 0) return null;
  const actualMs = aEnd - aStart;
  const diff = actualMs - plannedMs;
  const deviationRatio = Math.abs(diff) / plannedMs;
  const accuracy = Math.max(0, Math.round((1 - deviationRatio) * 100));
  const overUnder =
    diff > 0
      ? `ran ${fmtDuration(diff)} over`
      : diff < 0
        ? `wrapped up ${fmtDuration(-diff)} early`
        : "right on schedule";
  let grade: string, color: string, note: string;
  if (accuracy >= 88) {
    grade = "A";
    color = "#22c55e";
    note = "Nailed the timeline";
  } else if (accuracy >= 74) {
    grade = "B";
    color = "#84cc16";
    note = "Close to the plan";
  } else if (accuracy >= 57) {
    grade = "C";
    color = "#eab308";
    note = "Some variation from plan";
  } else if (accuracy >= 38) {
    grade = "D";
    color = "#f97316";
    note = "Notable deviation";
  } else {
    grade = "F";
    color = "#ef4444";
    note = "Far off the plan";
  }
  return { grade, color, accuracy, deviation: overUnder, note };
}

export function getOutdoorTempEffect(tempF: number | null): string | null {
  if (tempF == null) return null;
  if (tempF < 20)
    return "Extreme cold — expect 30%+ longer cook times. Pit will struggle to hold temp.";
  if (tempF < 40)
    return "Cold conditions — allow 20-25% extra cook time. Use windbreaks and monitor closely.";
  if (tempF < 55)
    return "Cool weather — preheat thoroughly and budget 10-15% extra time.";
  if (tempF < 80) return "Good conditions. No major weather adjustments needed.";
  if (tempF < 95)
    return "Warm day — pit temps may run hot. Check vents frequently.";
  return "Very hot — your pit needs less fuel. Watch for temperature spikes.";
}

/**
 * Resolve the pull temperature for a schedule item.
 *
 * Resolution order:
 *   1. item.targetTempF when present (explicit value set by the AI sequencer)
 *   2. 203°F as the universal low-and-slow fallback when targetTempF is absent
 *
 * 203°F is the most common low-and-slow pull temp (brisket, pork shoulder,
 * pork butt) and is conservative — it errs toward a longer remaining estimate
 * rather than under-cooking. Items like chicken or ribs should have an
 * explicit targetTempF supplied by the AI sequencer so that scaling uses
 * their correct pull temperature instead of this fallback.
 */
function resolvePullTempF(item: ScheduleItem): number {
  return item.targetTempF ?? 203;
}

/**
 * When the user confirms a schedule step at an actual time, shift all
 * downstream timestamps for that item forward or backward by the same delta.
 * Returns a new schedule array (immutable). Ignores deltas < 1 minute to
 * avoid noise from tap-timing jitter.
 *
 * For the "wrap" step an optional `actualWrapTempF` may be supplied (the
 * internal temperature the user read off their probe at wrap time).  When
 * provided, the remaining post-wrap time is scaled to account for how far the
 * meat actually is from done compared to where the plan assumed it would be:
 *
 *   scaleFactor = (pullTempF − actualWrapTempF) / (pullTempF − targetWrapTempF)
 *
 * A scale > 1 means the meat is cooler than planned → more time needed.
 * A scale < 1 means the meat is hotter than planned → less time needed.
 * The factor is clamped to [0.5, 2.0] to prevent wild swings from bad input.
 *
 * Temperature-based scaling is applied independently of whether the wrap was
 * clock-triggered (wrapAtMinutes > 0) or temp-triggered (wrapTempF only), so
 * the feature works for both wrap styles.
 */
export function rippleScheduleTimestamps(
  schedule: ScheduleItem[],
  itemIdx: number,
  step: "grillLight" | "meatOn" | "wrap" | "pullOff",
  actualTimeMs: number,
  actualWrapTempF?: number | null,
): ScheduleItem[] {
  return schedule.map((item, idx) => {
    if (idx !== itemIdx) return item;
    const updated = { ...item };

    if (step === "grillLight" && item.grillLightAt) {
      const plannedMs = new Date(item.grillLightAt).getTime();
      const deltaMs = actualTimeMs - plannedMs;
      if (Math.abs(deltaMs) < 60_000) return item;
      updated.grillLightAt = new Date(actualTimeMs).toISOString();
      if (item.meatOnAt) {
        updated.meatOnAt = new Date(new Date(item.meatOnAt).getTime() + deltaMs).toISOString();
      }
      if (item.estimatedFinishAt) {
        updated.estimatedFinishAt = new Date(
          new Date(item.estimatedFinishAt).getTime() + deltaMs,
        ).toISOString();
      }
    } else if (step === "meatOn" && item.meatOnAt) {
      const plannedMs = new Date(item.meatOnAt).getTime();
      const deltaMs = actualTimeMs - plannedMs;
      if (Math.abs(deltaMs) < 60_000) return item;
      updated.meatOnAt = new Date(actualTimeMs).toISOString();
      if (item.estimatedFinishAt) {
        updated.estimatedFinishAt = new Date(
          new Date(item.estimatedFinishAt).getTime() + deltaMs,
        ).toISOString();
      }
      // wrapAtMinutes is relative to meatOnAt — wrap time shifts automatically
    } else if (step === "wrap") {
      // --- Timing adjustment (clock-triggered wraps only) ---
      // Only applicable when the schedule includes a planned clock-based wrap
      // offset (wrapAtMinutes > 0). Temp-triggered wraps have no planned clock
      // time to compare against, so timing delta is skipped for them.
      let timingDeltaMs = 0;
      if (item.meatOnAt && (item.wrapAtMinutes ?? 0) > 0) {
        const plannedWrapMs =
          new Date(item.meatOnAt).getTime() + (item.wrapAtMinutes ?? 0) * 60_000;
        const deltaMs = actualTimeMs - plannedWrapMs;
        if (Math.abs(deltaMs) >= 60_000) {
          timingDeltaMs = deltaMs;
          // Update wrapAtMinutes to reflect actual wrap time offset from meatOnAt
          updated.wrapAtMinutes = Math.round(
            (actualTimeMs - new Date(item.meatOnAt).getTime()) / 60_000,
          );
        }
      }

      if (item.estimatedFinishAt) {
        // Step 1 — shift finish time by the timing delta.
        let newFinishMs = new Date(item.estimatedFinishAt).getTime() + timingDeltaMs;

        // Step 2 — apply a temperature-based scale to the remaining post-wrap
        // time when the caller supplies the actual internal temp at wrap.
        // This applies for both clock-triggered and temp-triggered wraps.
        //
        //   scaleFactor = (pullTempF − actualWrapTempF) / (pullTempF − targetWrapTempF)
        //
        // This is a proportional model: the fraction of the temperature journey
        // still ahead of the meat determines how much cook time remains relative
        // to the original post-wrap window.
        if (actualWrapTempF != null) {
          const targetWrapTempF = item.wrapTempF ?? actualWrapTempF; // fallback: no-op (scale = 1)
          const pullTempF = resolvePullTempF(item);
          const tempRange = pullTempF - targetWrapTempF;

          if (tempRange > 0) {
            // Remaining time from actual wrap moment to the (timing-adjusted) finish.
            const remainingMs = newFinishMs - actualTimeMs;

            if (remainingMs > 0) {
              const scaleFactor = Math.min(
                2.0,
                Math.max(0.5, (pullTempF - actualWrapTempF) / tempRange),
              );
              newFinishMs = actualTimeMs + remainingMs * scaleFactor;
            }
          }
        }

        if (timingDeltaMs !== 0 || actualWrapTempF != null) {
          updated.estimatedFinishAt = new Date(newFinishMs).toISOString();
        }
      }
    } else if (step === "pullOff" && item.estimatedFinishAt) {
      updated.estimatedFinishAt = new Date(actualTimeMs).toISOString();
    }

    return updated;
  });
}

export function computeNextStep(
  seqData: SequenceData | null | undefined,
  cookStatus: string | undefined,
  nowMs: number,
): NextStep | null {
  if (cookStatus !== "active" || !seqData?.schedule?.length) return null;
  let bestDiff = Infinity;
  let result: NextStep | null = null;
  seqData.schedule.forEach((item, idx) => {
    const candidates: Array<{ step: NextStepKey; ms: number | null }> = [
      {
        step: "grillLight",
        ms: item.grillLightAt ? new Date(item.grillLightAt).getTime() : null,
      },
      {
        step: "meatOn",
        ms: item.meatOnAt ? new Date(item.meatOnAt).getTime() : null,
      },
      {
        step: "pullOff",
        ms: item.estimatedFinishAt
          ? new Date(item.estimatedFinishAt).getTime()
          : null,
      },
    ];
    // Wrap is only a banner/next-step candidate when we have an explicit
    // wrapAtMinutes offset — otherwise the wrap is temp-triggered and we have
    // no clock time to count down to. The "≈ 3:15 PM around the stall"
    // inference shown in the schedule timeline is intentionally NOT used here
    // to avoid a fake countdown for an estimate.
    if (
      item.wrapMethod &&
      item.wrapMethod !== "none" &&
      (item.wrapAtMinutes ?? 0) > 0 &&
      item.meatOnAt
    ) {
      candidates.push({
        step: "wrap",
        ms:
          new Date(item.meatOnAt).getTime() +
          (item.wrapAtMinutes ?? 0) * 60000,
      });
    }
    if ((item.restMinutes ?? 0) > 0 && item.estimatedFinishAt) {
      candidates.push({
        step: "serve",
        ms:
          new Date(item.estimatedFinishAt).getTime() +
          (item.restMinutes ?? 0) * 60000,
      });
    }
    candidates.forEach(({ step, ms }) => {
      if (ms === null) return;
      const diff = ms - nowMs;
      if (diff > 0 && diff < bestDiff) {
        bestDiff = diff;
        result = { itemIdx: idx, step };
      }
    });
  });
  return result;
}
