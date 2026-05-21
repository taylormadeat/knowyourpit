export const QP_COOK_METHODS = [
  "Low & Slow",
  "Hot & Fast",
  "Rotisserie",
  "Reverse Sear",
  "Direct Heat",
  "Indirect Heat",
  "Braised",
  "Sous Vide + Smoke",
] as const;

export const QP_MEAT_START_TEMPS = [
  "Cold from Fridge",
  "Tempered to Room Temp",
] as const;

export const QP_INJECTION_OPTIONS = [
  "Not Injected",
  "Injected",
] as const;

export const QP_SPRITZ_FREQUENCIES = [
  "No Spritz",
  "Every 30 min",
  "Every Hour",
  "Every 2 Hours",
  "Once at Stall",
  "As Needed",
] as const;

export const QP_SPRITZ_LIQUIDS = [
  "Apple Juice",
  "Apple Cider Vinegar",
  "ACV + Apple Juice Mix",
  "Water",
  "Beer",
  "Butter",
  "Beef Tallow",
  "Worcestershire + Water",
  "Maple Syrup Mix",
  "Mop Sauce",
] as const;

export const QP_WRAP_FINISH_OPTIONS = [
  "No Wrap",
  "Butcher Paper at Stall",
  "Foil at Stall (Texas Crutch)",
  "Foil Boat",
  "Braised in Foil with Liquid",
  "Pulled and Rested in Cooler",
  "Sauced and Returned to Smoker",
] as const;

export type QpCookMethod = (typeof QP_COOK_METHODS)[number];
export type QpMeatStartTemp = (typeof QP_MEAT_START_TEMPS)[number];
export type QpInjectionOption = (typeof QP_INJECTION_OPTIONS)[number];
export type QpSpritzFrequency = (typeof QP_SPRITZ_FREQUENCIES)[number];
export type QpSpritzLiquid = (typeof QP_SPRITZ_LIQUIDS)[number];
export type QpWrapFinishOption = (typeof QP_WRAP_FINISH_OPTIONS)[number];
