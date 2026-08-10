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
  | "unknown";

export function classifyCookingMethod(method: string | null | undefined): CookingMethodClass {
  if (!method) return "unknown";
  const m = method.toLowerCase();
  if (m.includes("reverse sear") || m.includes("reverse-sear")) return "reverse_sear";
  if (m.includes("sear")) return "sear";
  if (m.includes("rotisserie") || m.includes("rotary")) return "rotisserie";
  if (m.includes("griddle")) return "griddle";
  // Check "indirect" before "direct" — "indirect" contains the substring
  // "direct" and would otherwise be mis-classified as direct heat.
  if (m.includes("indirect")) return "indirect";
  if (m.includes("direct")) return "direct";
  if (m.includes("smoke") || m.includes("low and slow") || m.includes("low & slow")) return "smoke";
  return "unknown";
}

/** True for high-heat direct-fire methods that don't involve wrapping or stall coaching. */
export function isDirectHeat(method: string | null | undefined): boolean {
  const cls = classifyCookingMethod(method);
  return cls === "direct" || cls === "sear" || cls === "griddle";
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
