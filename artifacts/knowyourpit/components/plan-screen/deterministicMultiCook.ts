import type { MeatCut } from "@/constants/meatCuts";
import { isProduce } from "@/constants/meatCuts";
import { calcSchedule, type FrozenSchedule, type ThawMethod } from "./frozenSchedule";

export interface DeterministicMultiCookInput {
  cut: MeatCut;
  weightLbs: number | null | undefined;
  grill: unknown | null;
  grillId: number | null | undefined;
  cookingMethod?: string | null;
  wrapFinish?: string | null;
  isFrozen?: boolean;
  thawMethod?: ThawMethod | "microwave" | "counter" | "cook_from_frozen";
  notes?: string | null;
}

export interface DeterministicMultiCookScheduleItem {
  foodType: string;
  estimatedDurationMinutes: number;
  preheatMinutes: number;
  restMinutes: number;
  grillLightAt: string;
  meatOnAt: string;
  estimatedFinishAt: string;
  wrapMethod: "foil" | "butcher_paper" | "none";
  wrapAtMinutes: number | null;
  wrapTempF: number | null;
  wrapReason: string | null;
  notes?: string;
  isSharedGrillFollowOn: boolean;
}

export interface DeterministicMultiCookPlan {
  schedule: DeterministicMultiCookScheduleItem[];
  serveAt: string;
  summary: string;
  frozenSchedules: Array<FrozenSchedule | null>;
}

function localFrozenMethod(
  input: DeterministicMultiCookInput,
): { enabled: boolean; method: ThawMethod } | undefined {
  if (!input.isFrozen || isProduce(input.cut.category)) return undefined;
  if (input.thawMethod === "fridge" || input.thawMethod === "cold_water") {
    return { enabled: true, method: input.thawMethod };
  }
  return undefined;
}

/**
 * Produces a complete, conservative baseline without relying on PitMaster or
 * the API. AI may later refine the schedule, but this result is always safe to
 * persist and show immediately.
 */
export function buildDeterministicMultiCookPlan(
  serveAt: Date,
  inputs: DeterministicMultiCookInput[],
): DeterministicMultiCookPlan {
  const usedGrills = new Set<string>();
  const frozenSchedules: Array<FrozenSchedule | null> = [];

  const schedule = inputs.map((input) => {
    const weightLbs = input.weightLbs && input.weightLbs > 0 ? input.weightLbs : 1;
    const cookMinsOverride = input.thawMethod === "cook_from_frozen"
      ? Math.round(input.cut.minsPerLb * weightLbs * 1.5)
      : undefined;
    const baseline = calcSchedule(
      serveAt,
      input.cut,
      weightLbs,
      input.grill,
      localFrozenMethod(input),
      { cookMinsOverride },
      input.cookingMethod ?? input.cut.cookMethod ?? null,
    );
    frozenSchedules.push(baseline.frozen ?? null);

    const grillKey = input.grillId == null ? null : String(input.grillId);
    const isSharedGrillFollowOn = grillKey != null && usedGrills.has(grillKey);
    if (grillKey != null) usedGrills.add(grillKey);
    const wrapMethod: DeterministicMultiCookScheduleItem["wrapMethod"] = baseline.wrap
      ? input.wrapFinish?.toLowerCase().includes("butcher")
        ? "butcher_paper"
        : "foil"
      : "none";

    return {
      foodType: input.cut.name,
      estimatedDurationMinutes: baseline.cookMins,
      preheatMinutes: baseline.preheatMins,
      restMinutes: baseline.restMins,
      grillLightAt: (isSharedGrillFollowOn ? baseline.meatOnAt : baseline.startAt).toISOString(),
      meatOnAt: baseline.meatOnAt.toISOString(),
      estimatedFinishAt: baseline.pullAt.toISOString(),
      wrapMethod,
      wrapAtMinutes: baseline.wrap
        ? Math.round((baseline.wrap.wrapAt.getTime() - baseline.meatOnAt.getTime()) / 60_000)
        : null,
      wrapTempF: baseline.wrap?.wrapTempF ?? null,
      wrapReason: baseline.wrap ? "Wrap through the stall to protect moisture." : null,
      ...(input.notes?.trim() ? { notes: input.notes.trim() } : {}),
      isSharedGrillFollowOn,
    };
  });

  const first = [...schedule].sort(
    (a, b) => new Date(a.meatOnAt).getTime() - new Date(b.meatOnAt).getTime(),
  )[0];
  const last = [...schedule].sort(
    (a, b) => new Date(b.meatOnAt).getTime() - new Date(a.meatOnAt).getTime(),
  )[0];

  return {
    schedule,
    serveAt: serveAt.toISOString(),
    summary: first && last && first !== last
      ? `Start ${first.foodType} first, then ${last.foodType} last.`
      : first
        ? `Start ${first.foodType} at the scheduled time.`
        : "",
    frozenSchedules,
  };
}