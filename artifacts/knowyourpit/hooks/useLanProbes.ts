/**
 * useLanProbes
 *
 * Discovers and polls WiFi thermometer base stations on the local network.
 * Supported devices: Fireboard 2/Drive, MEATER Block, ThermoWorks Signals.
 *
 * Discovery strategy (two layers, both run concurrently):
 *
 *   1. mDNS / Zeroconf — `useZeroconfDiscovery` actively browses `_http._tcp`
 *      on the LAN using the native react-native-zeroconf module.  Discovered
 *      hosts are fed directly to the matching polling adapter.  This works on
 *      any network topology without router mDNS forwarding.
 *
 *   2. Well-known .local fallback — many consumer routers do forward mDNS PTR
 *      records, so `fireboard.local`, `meaterblock.local`, and
 *      `thermoworks-signals.local` are still tried when no Zeroconf host is
 *      available for a given device type.  Fetch times out after 3 s if the
 *      host isn't reachable.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { pollFireboard } from "./lan/fireboard";
import { pollMeaterBlock } from "./lan/meaterBlock";
import { pollThermoworksSignals } from "./lan/thermoworksSignals";
import { useZeroconfDiscovery } from "./useZeroconfDiscovery";

export interface LanProbeReading {
  deviceId: string;
  deviceName: string;
  channelLabel: string;
  channelIndex: number;
  probeTempF: number;
  ambientTempF: number | null;
  source: "lan";
  host: string;
  lastSeenMs: number;
}

export interface LanDeviceStatus {
  host: string;
  deviceName: string;
  connected: boolean;
  lastSeenMs: number | null;
  probes: LanProbeReading[];
}

interface UseLanProbesOptions {
  enabled: boolean;
  pollIntervalMs?: number;
}

interface UseLanProbesResult {
  devices: LanDeviceStatus[];
  probes: LanProbeReading[];
  scanning: boolean;
  mdnsAvailable: boolean;
  scan: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 15_000;

const DEFAULT_FIREBOARD_HOST = "fireboard.local";
const DEFAULT_MEATER_BLOCK_HOST = "meaterblock.local";
const DEFAULT_SIGNALS_HOSTS = ["thermoworks-signals.local", "signals.local"];

export function useLanProbes({
  enabled,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseLanProbesOptions): UseLanProbesResult {
  const [devices, setDevices] = useState<LanDeviceStatus[]>([]);
  const [probes, setProbes] = useState<LanProbeReading[]>([]);
  const [scanning, setScanning] = useState(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    discovered,
    mdnsAvailable,
    scanning: mdnsScanning,
    rescan,
  } = useZeroconfDiscovery(enabled && Platform.OS !== "web");

  const doPoll = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!mountedRef.current) return;
    setScanning(true);

    try {
      // ── Build host lists ──────────────────────────────────────────────────
      // Always include both mDNS-discovered hosts AND the well-known .local
      // fallback names.  Discovered hosts come first so they're tried in
      // parallel; if they return no readings, the .local poll still runs in
      // the same batch.  Duplicates are removed so the same address isn't
      // polled twice when mDNS resolves the .local name directly.
      function dedup(hosts: string[]): string[] {
        return [...new Set(hosts)];
      }

      const fireboardHosts = dedup([
        ...(discovered.fireboard ?? []),
        DEFAULT_FIREBOARD_HOST,
      ]);

      const meaterHosts = dedup([
        ...(discovered.meater_block ?? []),
        DEFAULT_MEATER_BLOCK_HOST,
      ]);

      // Build a deduplicated list that includes mDNS hosts + the two
      // well-known Signals aliases.  Pass each as explicit hosts to the
      // adapter so it doesn't run its own internal alias loop on top.
      const signalsHosts = dedup([
        ...(discovered.thermoworks_signals ?? []),
        ...DEFAULT_SIGNALS_HOSTS,
      ]);

      const [fireboardResults, meaterResults, signalsResults] = await Promise.all([
        // Poll all Fireboard hosts in parallel; take any that respond
        Promise.all(
          fireboardHosts.map((h) => pollFireboard(h).catch(() => [] as LanProbeReading[])),
        ).then((arrays) => arrays.flat()),

        // Poll all MEATER Block hosts in parallel; take any that respond
        Promise.all(
          meaterHosts.map((h) => pollMeaterBlock(h).catch(() => [] as LanProbeReading[])),
        ).then((arrays) => arrays.flat()),

        // Poll all Signals hosts in parallel; take any that respond
        Promise.all(
          signalsHosts.map((h) =>
            pollThermoworksSignals(h).catch(() => [] as LanProbeReading[]),
          ),
        ).then((arrays) => arrays.flat()),
      ]);

      if (!mountedRef.current) return;

      const allReadings: LanProbeReading[] = [
        ...fireboardResults,
        ...meaterResults,
        ...signalsResults,
      ];

      // Deduplicate by deviceId
      const seen = new Set<string>();
      const deduped: LanProbeReading[] = [];
      for (const r of allReadings) {
        const key = `${r.deviceId}_${r.channelIndex}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(r);
        }
      }

      // Group into per-device status objects
      const deviceMap = new Map<string, LanDeviceStatus>();

      for (const reading of deduped) {
        const existing = deviceMap.get(reading.host);
        if (existing) {
          existing.probes.push(reading);
          if (reading.lastSeenMs > (existing.lastSeenMs ?? 0)) {
            existing.lastSeenMs = reading.lastSeenMs;
          }
        } else {
          deviceMap.set(reading.host, {
            host: reading.host,
            deviceName: reading.deviceName,
            connected: true,
            lastSeenMs: reading.lastSeenMs,
            probes: [reading],
          });
        }
      }

      setDevices(Array.from(deviceMap.values()));
      setProbes(deduped);
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, [discovered]);

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || Platform.OS === "web") return;

    doPoll();
    intervalRef.current = setInterval(doPoll, pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, doPoll]);

  const scanAll = useCallback(() => {
    rescan();
    doPoll();
  }, [rescan, doPoll]);

  return {
    devices,
    probes,
    scanning: scanning || mdnsScanning,
    mdnsAvailable,
    scan: scanAll,
  };
}
