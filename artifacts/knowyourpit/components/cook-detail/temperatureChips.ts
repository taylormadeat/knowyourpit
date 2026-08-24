export type TemperatureChipSource = "live" | "manual";

export type TemperatureVarianceStatus = "above" | "below" | "at";

export interface TemperatureVariance {
  deltaF: number;
  status: TemperatureVarianceStatus;
  text: string;
}

export interface TemperatureChipReadout {
  tempF: number;
  source: TemperatureChipSource;
  recencyLabel: string | null;
}

export interface CenterTemperatureReadouts {
  source: TemperatureChipSource;
  meat: TemperatureChipReadout | null;
  pit: TemperatureChipReadout | null;
}

function isTemperature(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Returns a readable difference from a target. Differences below one degree
 * are intentionally treated as at-target so probe noise does not create a
 * misleading "above/below" status.
 */
export function getTemperatureVariance(
  currentTempF: number | null | undefined,
  targetTempF: number | null | undefined,
  targetLabel: string,
): TemperatureVariance | null {
  if (!isTemperature(currentTempF) || !isTemperature(targetTempF)) return null;

  const rawDelta = currentTempF - targetTempF;
  if (Math.abs(rawDelta) < 1) {
    return {
      deltaF: 0,
      status: "at",
      text: `±0°F · at ${targetLabel}`,
    };
  }

  const deltaF = Math.round(Math.abs(rawDelta));
  const status: TemperatureVarianceStatus = rawDelta > 0 ? "above" : "below";
  const signedDelta = rawDelta > 0 ? `+${deltaF}` : `−${deltaF}`;
  return {
    deltaF: rawDelta > 0 ? deltaF : -deltaF,
    status,
    text: `${signedDelta}°F · ${status} ${targetLabel}`,
  };
}

export function formatCheckinRecency(
  createdAt: string | number | Date | null | undefined,
  nowMs: number,
): string | null {
  if (createdAt == null) return null;
  const createdAtMs = createdAt instanceof Date
    ? createdAt.getTime()
    : new Date(createdAt).getTime();
  if (!Number.isFinite(createdAtMs)) return null;

  const diffMs = Math.max(0, nowMs - createdAtMs);
  if (diffMs < 60_000) return "just now";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Live readings win as a group. When either live channel is present, missing
 * channels stay omitted rather than being silently filled with an older
 * manual check-in. Manual values are a fallback only when no live channel is
 * available at all.
 */
export function buildCenterTemperatureReadouts(input: {
  liveMeatTempF?: number | null;
  livePitTempF?: number | null;
  manualMeatTempF?: number | null;
  manualPitTempF?: number | null;
  manualCreatedAt?: string | number | Date | null;
  nowMs: number;
}): CenterTemperatureReadouts {
  const liveMeatTempF = isTemperature(input.liveMeatTempF) ? input.liveMeatTempF : null;
  const livePitTempF = isTemperature(input.livePitTempF) ? input.livePitTempF : null;
  const hasLiveReading = liveMeatTempF != null || livePitTempF != null;
  const source: TemperatureChipSource = hasLiveReading ? "live" : "manual";
  const recencyLabel = hasLiveReading
    ? null
    : formatCheckinRecency(input.manualCreatedAt, input.nowMs);

  const meatTempF = hasLiveReading ? liveMeatTempF : (
    isTemperature(input.manualMeatTempF) ? input.manualMeatTempF : null
  );
  const pitTempF = hasLiveReading ? livePitTempF : (
    isTemperature(input.manualPitTempF) ? input.manualPitTempF : null
  );

  return {
    source,
    meat: meatTempF == null ? null : { tempF: meatTempF, source, recencyLabel },
    pit: pitTempF == null ? null : { tempF: pitTempF, source, recencyLabel },
  };
}