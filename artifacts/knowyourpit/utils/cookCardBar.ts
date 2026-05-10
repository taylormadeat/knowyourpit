import { clamp, barColor } from "@/components/cook-detail/CookProgressBar";

export interface CookCardBar {
  color: string;
  progress: number;
}

export function getCookCardBar(item: any, nowMs: number): CookCardBar | null {
  if (item.status === "completed") {
    return { color: "#22c55e", progress: 1 };
  }
  if (item.status === "active" && item.actualStartAt) {
    const startMs = new Date(item.actualStartAt).getTime();
    const endMs = item.plannedEndAt ? new Date(item.plannedEndAt).getTime() : null;
    if (endMs === null) {
      const elapsed = Math.max(0, nowMs - startMs);
      const indeterminate = Math.min(elapsed / (12 * 3600 * 1000), 0.5);
      return { color: "#FF6B2B60", progress: indeterminate };
    }
    const totalMs = endMs - startMs;
    const elapsedMs = nowMs - startMs;
    const rawProgress = totalMs > 0 ? elapsedMs / totalMs : 0;
    const isOver = rawProgress >= 1;
    const progress = clamp(rawProgress, 0, 1);
    return { color: barColor(progress, isOver), progress };
  }
  return null;
}
