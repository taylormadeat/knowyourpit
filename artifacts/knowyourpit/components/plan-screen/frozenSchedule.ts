import type { MeatCut } from "@/constants/meatCuts";
import { preheatMinsForGrill } from "./utils";

// USDA-aligned thaw rate estimates. Fridge: ~24h per 4-5 lbs (we use 4.5).
// Cold water: ~1h per lb (with water changed every 30 min).
export const THAW_FRIDGE_HOURS_PER_LB = 24 / 4.5;
export const THAW_COLD_WATER_HOURS_PER_LB = 1;
// USDA / food-safety minimum for refrigerator thaw: always at least 24 h
// regardless of weight. The formula above gives sub-24h results for cuts
// under 4.5 lbs, which contradicts the AI tips and food safety guidance.
export const THAW_FRIDGE_MIN_HOURS = 24;
// Fixed temper window — sit at room temp before going on the grill.
export const TEMPER_MINUTES = 90;

export type ThawMethod = "fridge" | "cold_water";

export interface FrozenOptions {
  enabled: boolean;
  method: ThawMethod;
}

export function calcThawMinutes(
  weightLbs: number,
  method: ThawMethod,
): number {
  if (weightLbs <= 0) return 0;
  // Quick-thaw and no-thaw methods don't need a schedule buffer.
  const rawHours =
    method === "fridge"
      ? weightLbs * THAW_FRIDGE_HOURS_PER_LB
      : weightLbs * THAW_COLD_WATER_HOURS_PER_LB;
  // Fridge thaw: enforce the USDA-safe 24-hour minimum regardless of weight.
  // The per-lb formula produces sub-24h results for cuts under 4.5 lbs.
  const hours = method === "fridge" ? Math.max(rawHours, THAW_FRIDGE_MIN_HOURS) : rawHours;
  return Math.round(hours * 60);
}

export interface FrozenSchedule {
  method: ThawMethod;
  thawStartAt: Date; // Move to fridge / start cold-water thaw
  thawEndAt: Date; // Meat fully thawed (= temper start)
  temperStartAt: Date; // Same as thawEndAt
  temperEndAt: Date; // Same as preheat start (cook startAt)
  thawMins: number;
  temperMins: number;
}

export interface WrapStage {
  wrapAt: Date; // when to wrap (mid-cook stall)
  wrapTempF: number; // estimated internal temp at wrap
}

export interface CookSchedule {
  startAt: Date; // preheat start
  meatOnAt: Date; // preheat end / meat goes on
  pullAt: Date; // cook end / pull off the grill
  restEndAt: Date; // rest end / time to serve
  preheatMins: number;
  cookMins: number;
  restMins: number;
  totalMins: number;
  wrap?: WrapStage; // only for low-and-slow cuts that hit the stall
  frozen?: FrozenSchedule;
}

// Heuristic: a cut hits the stall (and benefits from a wrap) if the
// cookMethod is "Low & Slow" or it's a long cook (≥30 min/lb at low temp).
export function cutHasStall(cut: MeatCut): boolean {
  const method = (cut.cookMethod ?? "").toLowerCase();
  if (method.includes("low") && method.includes("slow")) return true;
  // Long-and-slow cuts that aren't tagged but still stall
  if (cut.minsPerLb >= 30 && cut.cookTempF <= 275) return true;
  return false;
}

export interface CalcScheduleOverrides {
  cookMinsOverride?: number;
  preheatMinsOverride?: number;
}

export function calcSchedule(
  serveAt: Date,
  cut: MeatCut,
  weightLbs: number,
  grill: any | null,
  frozenOptions?: FrozenOptions,
  overrides?: CalcScheduleOverrides,
): CookSchedule {
  const preheatMins = overrides?.preheatMinsOverride ?? preheatMinsForGrill(grill);
  const cookMins = overrides?.cookMinsOverride ?? Math.round(cut.minsPerLb * weightLbs);
  const restMins = cut.restMins;
  const totalMins = preheatMins + cookMins + restMins;
  const startAt = new Date(serveAt.getTime() - totalMins * 60 * 1000);
  const meatOnAt = new Date(startAt.getTime() + preheatMins * 60_000);
  const pullAt = new Date(meatOnAt.getTime() + cookMins * 60_000);
  const restEndAt = serveAt;

  // Wrap typically happens around the stall (≈60% of cook time, ~160-170°F).
  const wrap: WrapStage | undefined = cutHasStall(cut)
    ? {
        wrapAt: new Date(
          meatOnAt.getTime() + Math.round(cookMins * 0.6) * 60_000,
        ),
        wrapTempF: 165,
      }
    : undefined;

  if (!frozenOptions?.enabled) {
    return {
      startAt,
      meatOnAt,
      pullAt,
      restEndAt,
      preheatMins,
      cookMins,
      restMins,
      totalMins,
      wrap,
    };
  }

  const thawMins = calcThawMinutes(weightLbs, frozenOptions.method);
  const temperMins = TEMPER_MINUTES;
  const temperEndAt = startAt;
  const temperStartAt = new Date(temperEndAt.getTime() - temperMins * 60_000);
  const thawEndAt = temperStartAt;
  const thawStartAt = new Date(thawEndAt.getTime() - thawMins * 60_000);

  return {
    startAt,
    meatOnAt,
    pullAt,
    restEndAt,
    preheatMins,
    cookMins,
    restMins,
    totalMins,
    wrap,
    frozen: {
      method: frozenOptions.method,
      thawStartAt,
      thawEndAt,
      temperStartAt,
      temperEndAt,
      thawMins,
      temperMins,
    },
  };
}
