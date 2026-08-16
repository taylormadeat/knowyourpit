/**
 * Static rule-based PitMaster defaults for the five cook technique quick-picks.
 * Defaults are applied only when no last-used value exists for a cut — they are
 * the fallback, never overriding saved or preset choices.
 */

import type { MeatCut } from "@/constants/meatCuts";
import type {
  QpCookMethod,
  QpMeatStartTemp,
  QpInjectionOption,
  QpSpritzFrequency,
  QpWrapFinishOption,
} from "@/constants/cookQuickPicks";

export interface PitmasterDefaults {
  cookMethod: QpCookMethod;
  meatStartTemp: QpMeatStartTemp;
  injection: QpInjectionOption;
  spritz: QpSpritzFrequency;
  wrapFinish: QpWrapFinishOption;
}

// ── Cut-name sets ─────────────────────────────────────────────────────────────

/** Large low-and-slow cuts that benefit most from injection. */
const INJECTION_CUTS = new Set([
  "brisket (whole packer)",
  "brisket (flat)",
  "brisket (point)",
  "chuck roast",
  "beef short ribs (plate)",
  "beef short ribs (chuck)",
  "prime rib (bone-in)",
  "whole turkey",
  "spatchcock turkey",
  "pork shoulder / boston butt",
  "picnic shoulder",
  "pulled pork (competition)",
  "whole hog (suckling)",
]);

/** Beef cuts that get butcher paper at the stall. */
const BUTCHER_PAPER_CUTS = new Set([
  "brisket (whole packer)",
  "brisket (flat)",
  "brisket (point)",
  "pastrami",
  "chuck roast",
  "beef cheeks",
  "beef short ribs (plate)",
  "beef short ribs (chuck)",
  "beef back ribs",
]);

/** Pork (and lamb) rib cuts — foil crutch at stall. */
const FOIL_RIB_CUTS = new Set([
  "baby back ribs",
  "spare ribs (st. louis)",
  "spare ribs (full)",
  "country style ribs",
  "lamb ribs",
]);

/** Shoulder / butt / pulled cuts — rested in cooler after pull. */
const COOLER_REST_CUTS = new Set([
  "pork shoulder / boston butt",
  "picnic shoulder",
  "pulled pork (competition)",
  "whole hog (suckling)",
  "lamb shoulder",
  "pulled lamb",
  "goat shoulder",
  "pork belly burnt ends",
]);

/** Wing-style cuts — sauced and returned to smoker. */
const WING_CUTS = new Set([
  "chicken wings",
  "smoked wings (low & slow)",
]);

// ── Cook-method mapping ───────────────────────────────────────────────────────

/** Map the raw `cookMethod` string on a MeatCut to the matching QpCookMethod value. */
function mapCookMethod(raw: string | undefined): QpCookMethod {
  if (!raw) return "Low & Slow";
  switch (raw.toLowerCase()) {
    case "low & slow":         return "Low & Slow";
    case "hot & fast":         return "Hot & Fast";
    case "rotisserie":         return "Rotisserie";
    case "reverse sear":       return "Reverse Sear";
    case "direct heat":        return "Direct Heat";
    case "indirect":
    case "indirect heat":      return "Indirect Heat";
    case "braised":            return "Braised";
    case "sous vide + smoke":  return "Sous Vide + Smoke";
    default:                   return "Low & Slow";
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Returns the five PitMaster recommended defaults for a given cut.
 * These are static, rule-based suggestions — no network calls required.
 */
export function getPitmasterDefaults(cut: MeatCut): PitmasterDefaults {
  const name = cut.name.toLowerCase().trim();
  const cookMethod = mapCookMethod(cut.cookMethod);

  // Meat starting temp — standard recommendation for better bark and cook
  const meatStartTemp: QpMeatStartTemp = "Tempered to Room Temp";

  // Injection
  const injection: QpInjectionOption = INJECTION_CUTS.has(name) ? "Injected" : "Not Injected";

  // Spritz/Mop
  let spritz: QpSpritzFrequency;
  if (cookMethod === "Low & Slow" || cookMethod === "Hot & Fast") {
    spritz = "Every Hour";
  } else if (cookMethod === "Direct Heat" || cookMethod === "Reverse Sear") {
    spritz = "No Spritz";
  } else {
    spritz = "As Needed";
  }

  // Wrap/Finish — specific cut overrides take precedence, then category fallbacks
  let wrapFinish: QpWrapFinishOption;
  if (BUTCHER_PAPER_CUTS.has(name)) {
    wrapFinish = "Butcher Paper at Stall";
  } else if (COOLER_REST_CUTS.has(name)) {
    wrapFinish = "Pulled and Rested in Cooler";
  } else if (FOIL_RIB_CUTS.has(name)) {
    wrapFinish = "Foil at Stall (Texas Crutch)";
  } else if (WING_CUTS.has(name)) {
    wrapFinish = "Sauced and Returned to Smoker";
  } else if (
    cookMethod === "Direct Heat" ||
    cookMethod === "Reverse Sear" ||
    cut.category === "Seafood" ||
    cut.category === "Vegetables" ||
    cut.category === "Fruit"
  ) {
    wrapFinish = "No Wrap";
  } else {
    wrapFinish = "No Wrap";
  }

  return { cookMethod, meatStartTemp, injection, spritz, wrapFinish };
}
