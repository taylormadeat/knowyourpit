/**
 * Canonical grill type classification.
 *
 * Maps free-form grills.type strings (e.g. "Pellet Grill", "Offset Smoker",
 * "Kamado") to a stable class used to tailor PitMaster coaching and preheat
 * defaults across predict, multi-cook, and chat prompts.
 */

export type GrillClass =
  | "pellet"
  | "offset"
  | "kamado"
  | "cabinet"
  | "kettle"
  | "charcoal"
  | "gas"
  | "griddle"
  | "combo"
  | "other";

/**
 * Classify a raw grills.type string into a canonical GrillClass.
 * Case-insensitive; returns "other" for nullish or unrecognised values.
 */
export function classifyGrillType(type: string | null | undefined): GrillClass {
  if (!type) return "other";
  const t = type.toLowerCase();
  if (t.includes("pellet")) return "pellet";
  if (t.includes("offset") || t.includes("reverse flow") || t.includes("stick burner")) return "offset";
  if (t.includes("kamado") || t.includes("ceramic") || t.includes("egg")) return "kamado";
  if (t.includes("cabinet") || t.includes("vertical") || t.includes("bullet")) return "cabinet";
  if (t.includes("kettle")) return "kettle";
  // "charcoal" check must come before "gas" so "charcoal gas" combos still hit charcoal
  if (t.includes("charcoal")) return "charcoal";
  if (t.includes("gas") || t.includes("propane") || t.includes("natural gas")) return "gas";
  if (t.includes("griddle")) return "griddle";
  if (t.includes("combo")) return "combo";
  return "other";
}

/**
 * Returns a concise, actionable coaching note to inject into AI prompts.
 * Tailored by grill class and, where relevant, the cooking method.
 * Returns an empty string for the "other" class so callers can skip it safely.
 */
export function grillClassCoachingNote(
  grillClass: GrillClass,
  cookingMethod?: string | null,
): string {
  // Use the canonical isDirectHeat helper so the logic stays in sync with
  // the rest of the codebase (covers "direct", "sear", and "griddle" methods).
  const isDirect = isDirectHeat(cookingMethod);

  switch (grillClass) {
    case "pellet":
      return isDirect
        ? "Pellet grill note: Pellet grills top out lower than gas or charcoal — use the highest temp setting and preheat grates 15+ min. Open the flame broiler insert if the model has one. Sear marks will be lighter than cast-iron; a cast-iron grate insert helps. No wrap guidance applies for direct-heat cooks on a pellet grill."
        : "Pellet grill note: Temperature is self-regulated — set it and trust it. Smoke ring will be lighter than offset or charcoal; enable Super Smoke mode (if available) in the first 1–2 hours for maximum penetration. Check the hopper level before long cooks and add extra time in cold weather (pellet augers slow down below 35°F).";

    case "offset":
      return isDirect
        ? "Offset smoker note: For direct-heat cooking on an offset, position food close to the firebox side where temps run highest. Maintain a hot, active fire — avoid choking it down. Monitor closely; offset temps near the firebox are intense and food cooks fast. No wrap guidance applies for direct-heat cooks on an offset."
        : "Offset smoker note: Active fire management required. Maintain thin blue smoke — white billowing smoke means incomplete combustion and bitter flavor. Add pre-split hardwood splits every 45–90 min. There is a significant left-to-right heat gradient (firebox side runs hotter) — rotate the cook at the midpoint for even results. Butcher paper at the stall is the classic offset approach.";

    case "kamado":
      return isDirect
        ? "Kamado note: Ceramics retain heat exceptionally well — fully preheat 30+ min before searing. Remove the plate setter / heat deflector for direct searing. Use small vent adjustments; kamados respond slowly but hold temp rock-solid once dialed in. No wrap guidance applies for direct-heat cooks on a kamado."
        : "Kamado note: Ceramics retain heat exceptionally well — set vents small and be patient. Never fully open dampers or temp will overshoot badly and be very hard to bring back down. Very fuel-efficient; refueling is rarely needed even for 12-hour cooks. Dial in temp before adding meat. Stall behavior is similar to offset — wrap timing applies normally.";

    case "cabinet":
      return isDirect
        ? "Cabinet/vertical smoker note: For direct-heat cooking, position racks closest to the heat source — the top rack runs hottest. Keep the door closed as much as possible to hold heat. No wrap guidance applies for direct-heat cooks in a cabinet smoker."
        : "Cabinet/vertical smoker note: Vertical airflow means the top rack runs 10–20°F hotter than the bottom. Place thicker cuts up top for faster bark or rotate racks halfway through. Fill the water pan before lighting to stabilize temps. Load fuel from the side door to avoid heat loss from the main chamber. Wrap timing applies normally.";

    case "kettle":
      return isDirect
        ? "Kettle grill note: Two-zone fire — coals banked on one side, open space on the other. Sear directly over the coals. Bottom vent controls airflow and heat intensity (more open = hotter); top vent controls smoke draw. Keep lid on to prevent flare-ups. No wrap guidance applies for direct-heat cooks on a kettle."
        : "Kettle grill note: Two-zone indirect setup — coals banked to one side, meat on the opposite side over a drip pan. Add 2–3 hardwood chunks directly on the coals for smoke (no soaking needed). Adjust top and bottom vents in small increments; kettles respond quickly. Add fresh coals every 60–90 min for long cooks. Wrap timing applies normally.";

    case "charcoal":
      return isDirect
        ? "Charcoal grill note: Wait until coals are fully ashed over (20+ min) before cooking — flames mean flare-up risk. Two-zone setup: coals on one side for direct heat, open space for finishing. Watch for fat flare-ups; close the lid briefly to smother them. No wrap guidance applies for direct-heat charcoal cooks."
        : "Charcoal grill note: Two-zone indirect setup with coals banked to the sides and a drip pan in the center. Add hardwood chunks directly on the coals for smoke (no soaking needed). Bottom vent controls heat; top vent controls draw. Add coals every 60–90 min for long cooks. Wrap timing applies normally.";

    case "gas":
      return isDirect
        ? "Gas grill note: Preheat all burners on high for 10–15 min, then set zones. Sear over lit burners — clean, oiled grates give the best marks. Quick cook; watch internal temp closely. No wrap guidance applies for direct-heat gas grill cooks."
        : "Gas grill note: For indirect cooking, light only the outer burners and leave the center burners off. Add a smoker box or foil packet of wood chips over a lit burner for smoke flavor — without it this will taste oven-roasted, not smoked. Gas produces a lighter smoke profile; don't expect a heavy smoke ring. Wrap timing applies to push through the stall.";

    case "griddle":
      return "Griddle note: Season the surface and preheat all zones for 10 min. Use different heat zones — high for searing, medium for cooking through, low for holding warm. Push food to the cooler zone to finish without burning. Manage grease toward the drain channel throughout the cook.";

    case "combo":
      return isDirect
        ? "Combo grill note: For direct-heat items, use the gas or griddle side — high heat with short cook times. Keep the smoke chamber closed unless you are running a low-and-slow cook there simultaneously. No wrap guidance applies for direct-heat cooks."
        : "Combo grill note: Use the right zone for each item — smoke chamber for low-and-slow cuts, gas/griddle side for direct-heat items. If running both zones simultaneously, the smoke chamber won't reach gas-side temps — factor that into timing when sequencing items. Wrap timing applies to items in the smoke chamber only.";

    default:
      return "";
  }
}

// ── Cooking method classification ────────────────────────────────────────────

export type CookingMethodClass =
  | "smoke"
  | "indirect"
  | "direct"
  | "sear"
  | "reverse_sear"
  | "rotisserie"
  | "griddle"
  | "unknown";

/**
 * Classify a raw cookingMethod string into a canonical CookingMethodClass.
 * Case-insensitive; returns "unknown" for nullish or unrecognised values.
 */
export function classifyCookingMethod(method: string | null | undefined): CookingMethodClass {
  if (!method) return "unknown";
  const m = method.toLowerCase();
  if (m.includes("reverse sear") || m.includes("reverse-sear")) return "reverse_sear";
  if (m.includes("sear")) return "sear";
  if (m.includes("rotisserie") || m.includes("rotary")) return "rotisserie";
  if (m.includes("griddle")) return "griddle";
  if (m.includes("direct")) return "direct";
  if (m.includes("smoke") || m.includes("low and slow") || m.includes("low & slow")) return "smoke";
  if (m.includes("indirect")) return "indirect";
  return "unknown";
}

/**
 * Returns true for cooking methods that use direct/high heat and should NOT
 * receive wrap, stall, bark, or smoke-ring coaching.
 */
export function isDirectHeat(method: string | null | undefined): boolean {
  const cls = classifyCookingMethod(method);
  return cls === "direct" || cls === "sear" || cls === "griddle";
}

/**
 * Returns a short human-readable display label for a cooking method.
 * Falls back to grill-class inference when method is unknown.
 */
export function cookMethodDisplayLabel(
  method: string | null | undefined,
  grillClass?: GrillClass,
): string {
  const cls = classifyCookingMethod(method);
  switch (cls) {
    case "smoke":        return "Smoking";
    case "indirect":     return "Indirect";
    case "direct":       return "Grilling";
    case "sear":         return "Searing";
    case "reverse_sear": return "Reverse Searing";
    case "rotisserie":   return "Rotisserie";
    case "griddle":      return "Griddling";
    default:
      if (grillClass === "griddle")                            return "Griddling";
      if (grillClass === "offset" || grillClass === "cabinet") return "Smoking";
      return "Cooking";
  }
}

// ── Preheat defaults ─────────────────────────────────────────────────────────

/**
 * Returns the recommended preheat time in minutes for a given grill class.
 * Used to fix the preheat default logic that was always returning 25 min
 * due to a case-mismatch between catalog values and the old string literals.
 */
export function grillClassPreheatMins(grillClass: GrillClass): number {
  switch (grillClass) {
    case "gas":      return 15; // gas heats up quickly
    case "pellet":   return 20; // auger + fire-pot startup
    case "kamado":   return 30; // ceramics need time to soak heat
    case "griddle":  return 15; // flat top heats fast
    default:         return 25; // charcoal, offset, cabinet, kettle, combo, other
  }
}
