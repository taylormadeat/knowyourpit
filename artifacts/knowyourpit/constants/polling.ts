/** Returns the probe-reading refetch interval in milliseconds.
 *
 * Tier logic (fixed at cook-screen mount, does not change mid-cook):
 *  - Probe actively connected AND estimated cook is under 2 h → 15 min
 *    (short cook — ~12 rows for a 90-min steak, readable chart)
 *  - All other cases → 20 min
 *    (long cook / no plan — ~60 rows for a 10-hr brisket, still smooth chart;
 *    also the safe default when estimatedDurationMinutes is unknown)
 */
export function getProbePollingIntervalMs(
  estimatedDurationMinutes: number | null | undefined,
  probeConnected: boolean,
): number {
  if (
    probeConnected &&
    estimatedDurationMinutes != null &&
    estimatedDurationMinutes < 120
  ) {
    return 15 * 60 * 1000;
  }
  return 20 * 60 * 1000;
}

/** Backward-compat alias — resolves to the 20-min default tier.
 *  Prefer calling `getProbePollingIntervalMs(duration, probeConnected)` directly
 *  from any context that has cook-duration and probe-connection state. */
export const PROBE_POLL_INTERVAL_MS = getProbePollingIntervalMs(null, false);
