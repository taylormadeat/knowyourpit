/**
 * MEATER Block — local WiFi HTTP adapter.
 *
 * Well-known hostname: meaterblock.local (port 2345)
 * Custom hosts: pass any IP or mDNS name as the optional `host` param.
 *
 * GET http://<host>:2345/v1/devices → device list
 *
 * Response shape (simplified):
 *   {
 *     "data": {
 *       "devices": [
 *         {
 *           "id": "...",
 *           "temperature": {
 *             "internal": <float °C>,
 *             "ambient": <float °C>
 *           },
 *           "cook": { "name": "...", "state": "..." }
 *         }
 *       ]
 *     }
 *   }
 *
 * Reference: MEATER Block local API (public, no auth required on LAN)
 */

import type { LanProbeReading } from "@/hooks/useLanProbes";

const DEFAULT_MEATER_BLOCK_HOST = "meaterblock.local";
const MEATER_BLOCK_PORT = 2345;
const MEATER_BLOCK_TIMEOUT_MS = 3000;

function toF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

export async function pollMeaterBlock(host = DEFAULT_MEATER_BLOCK_HOST): Promise<LanProbeReading[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MEATER_BLOCK_TIMEOUT_MS);
  try {
    const res = await fetch(
      `http://${host}:${MEATER_BLOCK_PORT}/v1/devices`,
      { signal: controller.signal },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as any;
    const devices: any[] = json?.data?.devices ?? [];
    const now = Date.now();
    return devices
      .filter((d) => d?.temperature?.internal != null)
      .map((d, idx) => ({
        deviceId: `${host}_${d.id ?? idx}`,
        deviceName: "MEATER Block",
        channelLabel: d.cook?.name ?? `Probe ${idx + 1}`,
        channelIndex: idx,
        probeTempF: toF(d.temperature.internal),
        ambientTempF: d.temperature.ambient != null ? toF(d.temperature.ambient) : null,
        source: "lan" as const,
        host,
        lastSeenMs: now,
      }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
