/**
 * Fireboard 2 / Fireboard Drive — local WiFi HTTP adapter.
 *
 * Well-known hostname: fireboard.local (port 80)
 * Custom hosts: pass any IP or mDNS name as the optional `host` param.
 *
 * GET /cook → JSON array of channel objects:
 *   { channel: number, channel_label: string, temp: number, tempguid: string }
 *   temp is in °F by default.
 *
 * Reference: Fireboard local API documentation (fireboard.io/support)
 */

import type { LanProbeReading } from "@/hooks/useLanProbes";

const DEFAULT_FIREBOARD_HOST = "fireboard.local";
const FIREBOARD_TIMEOUT_MS = 3000;

export interface FireboardChannel {
  channel: number;
  channel_label: string;
  temp: number | null;
}

async function fetchFireboardChannels(host: string): Promise<FireboardChannel[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FIREBOARD_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${host}/cook`, { signal: controller.signal });
    if (!res.ok) return [];
    const json = await res.json() as any[];
    return (Array.isArray(json) ? json : []).map((ch: any) => ({
      channel: ch.channel ?? 0,
      channel_label: ch.channel_label ?? `Ch ${ch.channel ?? "?"}`,
      temp: typeof ch.temp === "number" ? ch.temp : null,
    }));
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function pollFireboard(host = DEFAULT_FIREBOARD_HOST): Promise<LanProbeReading[]> {
  const channels = await fetchFireboardChannels(host);
  if (channels.length === 0) return [];
  const now = Date.now();
  return channels
    .filter((ch) => ch.temp != null)
    .map((ch) => ({
      deviceId: `${host}_ch${ch.channel}`,
      deviceName: "Fireboard",
      channelLabel: ch.channel_label,
      channelIndex: ch.channel,
      probeTempF: ch.temp!,
      ambientTempF: null,
      source: "lan" as const,
      host,
      lastSeenMs: now,
    }));
}
