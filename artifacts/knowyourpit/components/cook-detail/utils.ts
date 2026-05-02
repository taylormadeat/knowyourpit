import { fmtDurationMs, fmtRelMinutes } from "@/utils/duration";
import type {
  NextStep,
  NextStepKey,
  PlanGrade,
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
