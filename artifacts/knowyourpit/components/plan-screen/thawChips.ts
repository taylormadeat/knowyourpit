/**
 * Thaw-method chip definitions shared between MultiCookAddItemModal and its
 * unit tests.  This file has NO React Native imports so it is safe to import
 * in a plain Jest/Node environment.
 */

import type { ThawMethod } from "./frozenSchedule";

export type AnyThawMethod = ThawMethod | "microwave" | "counter" | "cook_from_frozen";

export const THAW_CHIPS: { value: AnyThawMethod; label: string }[] = [
  { value: "fridge",            label: "Refrigerator  (~24h / 4–5 lbs)" },
  { value: "cold_water",        label: "Cold Water  (~1h per lb)" },
  { value: "microwave",         label: "Microwave  (cook immediately)" },
  { value: "counter",           label: "Counter Thaw" },
  { value: "cook_from_frozen",  label: "Cook from Frozen  (+~50% time)" },
];
