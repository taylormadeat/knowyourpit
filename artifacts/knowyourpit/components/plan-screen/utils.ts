import { fmtMinutes } from "@/utils/duration";

export const UPCOMING_DAYS = 14;

export function getUpcomingDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 0; i < UPCOMING_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

export function formatDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function formatDateTime(d: Date): string {
  return `${formatDate(d)} at ${formatTime(d.getHours(), d.getMinutes())}`;
}

export function preheatMinsForGrill(grill: any | null): number {
  if (!grill) return 25;
  const t = (grill.type || "").toLowerCase();
  if (t.includes("gas")) return 15;
  if (t.includes("electric")) return 20;
  if (t.includes("pellet")) return 30;
  if (t.includes("charcoal") || t.includes("kettle")) return 25;
  if (t.includes("drum")) return 30;
  if (t.includes("kamado") || t.includes("ceramic")) return 45;
  if (t.includes("offset") || t.includes("reverse flow")) return 40;
  return 25;
}

export function fmtDuration(mins: number): string {
  return fmtMinutes(mins);
}

export function fmtElapsedPlan(ms: number): string {
  if (ms <= 0) return "0m";
  return fmtMinutes(Math.floor(ms / 60000));
}

// Friendly "in 2 days" / "in 5 hrs" / "in 30 min" helper for the
// hero call-to-action banner above the timeline.
export function fmtFromNow(target: Date): string {
  const diffMs = target.getTime() - Date.now();
  if (diffMs <= 0) return "now";
  const mins = Math.round(diffMs / 60_000);
  if (mins < 60) return `in ${mins} min`;
  const hrs = mins / 60;
  if (hrs < 24) {
    const rounded = Math.round(hrs);
    return `in ${rounded} hr${rounded === 1 ? "" : "s"}`;
  }
  const days = hrs / 24;
  if (days < 1.5) return "tomorrow";
  return `in ${Math.round(days)} days`;
}

export const TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 6; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();
