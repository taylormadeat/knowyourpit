/**
 * Cooking-method classification utilities for the mobile app.
 * Mirror of the server-side classifiers in api-server/src/lib/grillClassify.ts —
 * kept in sync manually since mobile and server can't share that module directly.
 */

export type CookingMethodClass =
  | "smoke"
  | "indirect"
  | "direct"
  | "sear"
  | "reverse_sear"
  | "rotisserie"
  | "griddle"
  | "hot_fast"
  | "braised"
  | "unknown";

export function classifyCookingMethod(method: string | null | undefined): CookingMethodClass {
  if (!method) return "unknown";
  const m = method.toLowerCase();
  if (m.includes("reverse sear") || m.includes("reverse-sear")) return "reverse_sear";
  if (m.includes("sear")) return "sear";
  if (m.includes("rotisserie") || m.includes("rotary") || m.includes("spit")) return "rotisserie";
  if (m.includes("griddle")) return "griddle";
  // "hot and fast" / "hot & fast" / "hot fast" before indirect/direct so it
  // isn't mis-classified. AI may omit the connector ("Hot Fast").
  if (m.includes("hot and fast") || m.includes("hot & fast") || m.includes("hot fast")) return "hot_fast";
  // "braised" / "braise" before indirect so it isn't mis-classified
  if (m.includes("brais")) return "braised";
  // Check "indirect" before "direct" — "indirect" contains the substring
  // "direct" and would otherwise be mis-classified as direct heat.
  // Also accept "two-zone" and "2-zone" which AIs commonly use for indirect cooking.
  if (m.includes("indirect") || m.includes("two-zone") || m.includes("2-zone")) return "indirect";
  if (m.includes("direct")) return "direct";
  if (m.includes("smoke") || m.includes("low and slow") || m.includes("low & slow")) return "smoke";
  return "unknown";
}

/** True for high-heat direct-fire methods that don't involve wrapping or stall coaching. */
export function isDirectHeat(method: string | null | undefined): boolean {
  const cls = classifyCookingMethod(method);
  return cls === "direct" || cls === "sear" || cls === "griddle";
}

/**
 * True for any method that includes a searing phase — direct, sear, griddle,
 * and reverse_sear (which ends with a direct-heat sear). Use this for tip
 * selection so reverse-sear cooks see grilling-specific advice.
 */
export function includesSear(method: string | null | undefined): boolean {
  const cls = classifyCookingMethod(method);
  return cls === "direct" || cls === "sear" || cls === "griddle" || cls === "reverse_sear";
}

/** Short display label for a cooking method, e.g. "Smoking", "Grilling". */
export function cookMethodDisplayLabel(method: string | null | undefined): string {
  const cls = classifyCookingMethod(method);
  switch (cls) {
    case "smoke":        return "Smoking";
    case "indirect":     return "Indirect";
    case "direct":       return "Grilling";
    case "sear":         return "Searing";
    case "reverse_sear": return "Reverse Searing";
    case "rotisserie":   return "Rotisserie";
    case "griddle":      return "Griddling";
    default:             return "Cooking";
  }
}

/**
 * Method-aware label for the cook-chamber temperature sensor.
 * Direct-heat methods → "Grill Temp"
 * Smoke / indirect / rotisserie → "Pit Temp"
 * Unknown → "Cook Temp"
 */
export function pitTempLabel(
  method: string | null | undefined,
  withUnit = false,
): string {
  const cls = classifyCookingMethod(method);
  let label: string;
  switch (cls) {
    case "direct":
    case "sear":
    case "griddle":
      label = "Grill Temp";
      break;
    case "smoke":
    case "indirect":
    case "reverse_sear":
    case "rotisserie":
      label = "Pit Temp";
      break;
    default:
      label = "Cook Temp";
  }
  return withUnit ? `${label} (°F)` : label;
}

/**
 * Returns true when the method string is non-empty but is not recognised by
 * `classifyCookingMethod` (i.e. would produce the "unknown" fall-through).
 * Use this to gate UI warnings for AI-suggested methods that don't map to any
 * known category — the caller can then surface a notice rather than silently
 * falling back to smoke-style advice.
 */
export function isUnrecognisedCookMethod(method: string | null | undefined): boolean {
  if (!method) return false;
  return classifyCookingMethod(method) === "unknown";
}

/** Verb phrase for use in context copy, e.g. "on the smoker" → "on the grill". */
export function cookMethodContextPhrase(method: string | null | undefined): string {
  const cls = classifyCookingMethod(method);
  switch (cls) {
    case "smoke":        return "on the smoker";
    case "indirect":     return "on the grill";
    case "direct":       return "on the grill";
    case "sear":         return "on the grill";
    case "reverse_sear": return "on the grill";
    case "rotisserie":   return "on the rotisserie";
    case "griddle":      return "on the griddle";
    default:             return "on the grill";
  }
}
