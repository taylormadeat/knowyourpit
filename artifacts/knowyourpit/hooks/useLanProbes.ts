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
 *
 * IP-change recovery
 * ------------------
 * Persisted (mDNS-cached) hosts are tracked for consecutive poll failures.
 * After CONSECUTIVE_FAIL_THRESHOLD failures against a cached host the hook
 * automatically evicts that host from both the in-memory discovered map and
 * AsyncStorage, then triggers a fresh mDNS rescan.  This lets the app recover
 * quickly when a device's IP changes (DHCP reassignment, router reboot) rather
 * than waiting up to 24 hours for the TTL to expire.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { pollFireboard } from "./lan/fireboard";
import { pollMeaterBlock } from "./lan/meaterBlock";
import { pollThermoworksSignals } from "./lan/thermoworksSignals";
import type { ZeroconfDeviceType } from "./lan/zeroconf";
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

/**
 * Number of consecutive failed polls against a cached (mDNS-discovered) host
 * before it is evicted and a rescan is triggered.
 */
const CONSECUTIVE_FAIL_THRESHOLD = 3;

interface HostResult {
  host: string;
  readings: LanProbeReading[];
}

export function useLanProbes({
  enabled,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseLanProbesOptions): UseLanProbesResult {
  const [devices, setDevices] = useState<LanDeviceStatus[]>([]);
  const [probes, setProbes] = useState<LanProbeReading[]>([]);
  const [scanning, setScanning] = useState(false);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Per-host consecutive-failure counter.  Only hosts that came from the
   * mDNS-discovered map are tracked here; hardcoded .local fallbacks are
   * intentionally excluded so a missing device doesn't trigger a rescan.
   */
  const failCountsRef = useRef<Map<string, number>>(new Map());

  const {
    discovered,
    mdnsAvailable,
    scanning: mdnsScanning,
    rescan,
    evictHost,
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

      // ── Poll all hosts, tracking per-host results ──────────────────────────
      // We need individual host attribution (not just a flat merged array) so
      // we can maintain accurate consecutive-failure counts for discovered hosts.
      async function pollAllHosts<T extends LanProbeReading>(
        hosts: string[],
        pollFn: (host: string) => Promise<T[]>,
      ): Promise<HostResult[]> {
        return Promise.all(
          hosts.map(async (host) => ({
            host,
            readings: await pollFn(host).catch(() => [] as T[]),
          })),
        );
      }

      const [fireboardPerHost, meaterPerHost, signalsPerHost] = await Promise.all([
        pollAllHosts(fireboardHosts, pollFireboard),
        pollAllHosts(meaterHosts, pollMeaterBlock),
        pollAllHosts(signalsHosts, pollThermoworksSignals),
      ]);

      if (!mountedRef.current) return;

      // ── Track consecutive failures for mDNS-discovered hosts ───────────────
      // Only hosts that originated from the discovered map are subject to
      // eviction — the hardcoded .local fallbacks are always-tried and a miss
      // there simply means the device is absent, not that the IP changed.
      let shouldRescan = false;

      function trackFailures(
        type: ZeroconfDeviceType,
        perHost: HostResult[],
        discoveredForType: string[] | undefined,
      ): void {
        if (!discoveredForType?.length) return;
        const discoveredSet = new Set(discoveredForType);

        for (const { host, readings } of perHost) {
          if (!discoveredSet.has(host)) continue; // skip hardcoded fallback names

          if (readings.length > 0) {
            // Successful poll — reset any accumulated failure count
            failCountsRef.current.delete(host);
          } else {
            const prev = failCountsRef.current.get(host) ?? 0;
            const next = prev + 1;

            if (next >= CONSECUTIVE_FAIL_THRESHOLD) {
              // IP has changed or device is gone — evict the stale address
              failCountsRef.current.delete(host);
              evictHost(type, host);
              shouldRescan = true;
            } else {
              failCountsRef.current.set(host, next);
            }
          }
        }
      }

      trackFailures("fireboard", fireboardPerHost, discovered.fireboard);
      trackFailures("meater_block", meaterPerHost, discovered.meater_block);
      trackFailures("thermoworks_signals", signalsPerHost, discovered.thermoworks_signals);

      // Trigger a single rescan after all evictions so mDNS can rediscover
      // the device at its new IP address.
      if (shouldRescan) rescan();

      // ── Flatten and deduplicate readings ──────────────────────────────────
      const allReadings: LanProbeReading[] = [
        ...fireboardPerHost,
        ...meaterPerHost,
        ...signalsPerHost,
      ].flatMap((r) => r.readings);

      // Deduplicate by deviceId + channelIndex
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
  }, [discovered, evictHost, rescan]);

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
    if (!enabled) return;
    rescan();
    doPoll();
  }, [enabled, rescan, doPoll]);

  return {
    devices,
    probes,
    scanning: scanning || mdnsScanning,
    mdnsAvailable,
    scan: scanAll,
  };
}
