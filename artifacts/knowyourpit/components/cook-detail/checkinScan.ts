export type CheckinScanTemperatures = {
  pitTempF: number | null;
  internalTempF: number | null;
};

type ScanProbe = {
  probeName?: unknown;
  finishingTempF?: unknown;
};

const MIN_TEMP_F = 32;
const MAX_TEMP_F = 700;
const PIT_TERMS = /\b(pit|ambient|chamber|grill|smoker|bbq)\b/i;
const INTERNAL_TERMS = /\b(internal|meat|food|protein|brisket|pork|chicken|turkey|probe)\b/i;

function validTemp(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value < MIN_TEMP_F || value > MAX_TEMP_F) return null;
  return Math.round(value * 10) / 10;
}

function findLabeledTemp(text: string, terms: RegExp): number | null {
  const match = text.match(
    new RegExp(
      String.raw`${terms.source}[^0-9]{0,24}([0-9]{2,3}(?:\.[0-9]+)?)\s*°?\s*F?`,
      "i",
    ),
  );
  return validTemp(match?.[2] ? Number(match[2]) : null);
}

function allTemperatures(text: string): number[] {
  return Array.from(text.matchAll(/(\d{2,3}(?:\.\d+)?)\s*°?\s*(?:F|°F)\b/gi))
    .map((match) => validTemp(Number(match[1])))
    .filter((value): value is number => value != null);
}

/**
 * Converts the existing cook-image analysis response into values that can be
 * reviewed in the editable check-in fields. Probe labels are preferred; raw
 * extraction is only a fallback for thermometer screenshots whose channels
 * were readable but not structured.
 */
export function extractCheckinScanTemperatures(result: any): CheckinScanTemperatures {
  const probes = Array.isArray(result?.probes) ? (result.probes as ScanProbe[]) : [];
  let pitTempF: number | null = null;
  let internalTempF: number | null = null;

  for (const probe of probes) {
    const temp = validTemp(probe.finishingTempF);
    if (temp == null) continue;
    const label = typeof probe.probeName === "string" ? probe.probeName : "";
    if (pitTempF == null && PIT_TERMS.test(label)) pitTempF = temp;
    else if (internalTempF == null && INTERNAL_TERMS.test(label)) internalTempF = temp;
    else if (internalTempF == null) internalTempF = temp;
  }

  const raw = typeof result?.rawExtraction === "string" ? result.rawExtraction : "";
  if (raw) {
    pitTempF ??= findLabeledTemp(raw, PIT_TERMS);
    internalTempF ??= findLabeledTemp(raw, INTERNAL_TERMS);

    const temps = allTemperatures(raw);
    if (internalTempF == null && temps.length > 0) {
      internalTempF = temps.find((temp) => temp !== pitTempF) ?? temps[0];
    }
    if (pitTempF == null && temps.length > 1) {
      pitTempF = temps.find((temp) => temp !== internalTempF) ?? null;
    }
  }

  return { pitTempF, internalTempF };
}

export function classifyCheckinScanFailure(error: unknown): "offline" | "limit" | "error" {
  const candidate = error as any;
  const status = candidate?.status ?? candidate?.statusCode ?? candidate?.response?.status;
  if (status === 402 || status === 429 || candidate?.kind === "limit") return "limit";
  const message = String(candidate?.message ?? candidate?.error ?? "").toLowerCase();
  if (
    candidate?.kind === "offline" ||
    message.includes("network") ||
    message.includes("offline") ||
    message.includes("timeout") ||
    message.includes("fetch failed") ||
    message.includes("internet")
  ) {
    return "offline";
  }
  return "error";
}