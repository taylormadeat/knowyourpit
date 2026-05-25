/**
 * ThermoWorks Signals — local WiFi HTTP adapter.
 *
 * Well-known hostnames: thermoworks-signals.local, signals.local (port 80)
 * Custom hosts: pass any IP or mDNS name as the optional `host` param —
 * the adapter will try that single host rather than the well-known aliases.
 *
 * GET /status → JSON with channel readings:
 *   {
 *     "channels": [
 *       { "channel": 1, "label": "Probe 1", "temp": 225.4, "units": "F", "connected": true }
 *     ]
 *   }
 *
 * Note: The Signals local API format is community-documented and may differ
 * across firmware versions.
 *
 * Reference: https://github.com/ietf-urn/thermoworks-signals-local (community)
 */

import type { LanProbeReading } from "@/hooks/useLanProbes";

const DEFAULT_SIGNALS_HOSTS = ["thermoworks-signals.local", "signals.local"];
const SIGNALS_PORT = 80;
const SIGNALS_TIMEOUT_MS = 3000;

function toF(value: number, units: string): number {
  if (units.toUpperCase() === "C") return Math.round((value * 9) / 5 + 32);
  return Math.round(value);
}

async function tryFetchSignalsStatus(host: string): Promise<LanProbeReading[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SIGNALS_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}:${SIGNALS_PORT}/status`, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as any;
    const channels: any[] = json?.channels ?? [];
    const now = Date.now();
    return channels
      .filter((ch) => ch.connected !== false && typeof ch.temp === "number")
      .map((ch, idx) => ({
        deviceId: `${host}_ch${ch.channel ?? idx}`,
        deviceName: "ThermoWorks Signals",
        channelLabel: ch.label ?? `Ch ${ch.channel ?? idx + 1}`,
        channelIndex: ch.channel ?? idx,
        probeTempF: toF(ch.temp, ch.units ?? "F"),
        ambientTempF: null,
        source: "lan" as const,
        host,
        lastSeenMs: now,
      }));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function pollThermoworksSignals(host?: string): Promise<LanProbeReading[]> {
  if (host) {
    // Custom host — try only this one
    const result = await tryFetchSignalsStatus(host);
    return result ?? [];
  }
  // Default: try well-known aliases in order
  for (const h of DEFAULT_SIGNALS_HOSTS) {
    const result = await tryFetchSignalsStatus(h);
    if (result !== null) return result;
  }
  return [];
}
