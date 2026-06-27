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

import AsyncStorage from "@react-native-async-storage/async-storage";
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
  /** True for entries the user manually added by IP/hostname */
  isManual?: boolean;
}

/** Device type for a manually-added LAN device */
export type ManualDeviceType = "meater_block" | "fireboard" | "thermoworks_signals";

/** A user-supplied manual LAN entry persisted across sessions */
export interface ManualEntry {
  host: string;
  type: ManualDeviceType;
}

/** Human-readable label for each manual device type */
export const MANUAL_DEVICE_LABELS: Record<ManualDeviceType, string> = {
  meater_block: "MEATER Block",
  fireboard: "Fireboard",
  thermoworks_signals: "ThermoWorks Signals",
};

interface UseLanProbesOptions {
  enabled: boolean;
  pollIntervalMs?: number;
}

interface UseLanProbesResult {
  devices: LanDeviceStatus[];
  probes: LanProbeReading[];
  scanning: boolean;
  mdnsAvailable: boolean;
  /**
   * True after at least one mDNS scan cycle completed with an empty result.
   * Proxy for "iOS Local Network permission denied" — the module loaded but
   * browsing the LAN returned nothing.  See useZeroconfDiscovery for details.
   */
  mdnsScanEmpty: boolean;
  scan: () => void;
  /** User-supplied manual device entries (host + type), persisted across sessions */
  manualEntries: ManualEntry[];
  /** Add a host to the manual poll list and persist it */
  addManualHost: (host: string, type: ManualDeviceType) => Promise<void>;
  /** Remove a host from the manual poll list */
  removeManualHost: (host: string) => Promise<void>;
}

const DEFAULT_POLL_INTERVAL_MS = 15_000;

const DEFAULT_FIREBOARD_HOST = "fireboard.local";
/**
 * Multiple well-known hostnames tried in parallel on every poll cycle.
 * Different MEATER Block firmware versions use different names.
 */
const DEFAULT_MEATER_BLOCK_HOSTS = ["meaterblock.local", "meater-block.local", "MEATER_block.local"];
const DEFAULT_SIGNALS_HOSTS = ["thermoworks-signals.local", "signals.local", "thermoworks.local", "rfx.local", "rfx-gateway.local"];

/**
 * AsyncStorage key for user-supplied manual device entries.
 * Format: ManualEntry[]
 */
const MANUAL_DEVICES_KEY = "@knowyourpit/lan/manual_v2";

/**
 * Legacy key used before typed entries were introduced (stored string[]).
 * Read once on first mount to migrate existing MEATER Block manual hosts.
 */
const LEGACY_MANUAL_KEY = "@knowyourpit/lan/manual";

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
  // Ref that always holds the latest discovered map so doPoll can read it
  // without closing over the state value (which would change its identity on
  // every mDNS resolution event and restart the polling interval).
  const discoveredRef = useRef<import("./useZeroconfDiscovery").DiscoveredHosts>({});

  /**
   * Per-host consecutive-failure counter.  Only hosts that came from the
   * mDNS-discovered map are tracked here; hardcoded .local fallbacks are
   * intentionally excluded so a missing device doesn't trigger a rescan.
   */
  const failCountsRef = useRef<Map<string, number>>(new Map());

  /** User-supplied manual device entries — persisted to AsyncStorage */
  const [manualEntries, setManualEntries] = useState<ManualEntry[]>([]);
  const manualEntriesRef = useRef<ManualEntry[]>([]);

  const {
    discovered,
    mdnsAvailable,
    scanning: mdnsScanning,
    mdnsScanEmpty,
    rescan,
    evictHost,
  } = useZeroconfDiscovery(enabled && Platform.OS !== "web");

  // Keep the ref in sync so doPoll always sees the latest discovered map
  // without needing it in its dependency array.
  discoveredRef.current = discovered;

  // Load persisted manual device entries on mount.
  // One-time migration: if the new key is absent, check the legacy key and
  // promote any saved MEATER Block hosts to typed ManualEntry records, then
  // delete the old key so this only runs once per installation.
  useEffect(() => {
    if (!enabled) return;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(MANUAL_DEVICES_KEY);

        if (raw) {
          // New key exists — parse and use it
          const parsed: unknown = JSON.parse(raw);
          if (!Array.isArray(parsed)) return;
          const entries: ManualEntry[] = parsed.map((item) =>
            typeof item === "string"
              ? { host: item, type: "meater_block" as ManualDeviceType }
              : (item as ManualEntry),
          );
          manualEntriesRef.current = entries;
          setManualEntries(entries);
        } else {
          // New key absent — attempt one-time migration from legacy key
          const legacyRaw = await AsyncStorage.getItem(LEGACY_MANUAL_KEY);
          if (legacyRaw) {
            try {
              const legacyHosts: unknown = JSON.parse(legacyRaw);
              if (Array.isArray(legacyHosts)) {
                const entries: ManualEntry[] = (legacyHosts as string[])
                  .filter((h) => typeof h === "string" && h.trim())
                  .map((h) => ({ host: h.trim(), type: "meater_block" as ManualDeviceType }));
                if (entries.length > 0) {
                  manualEntriesRef.current = entries;
                  setManualEntries(entries);
                  await AsyncStorage.setItem(MANUAL_DEVICES_KEY, JSON.stringify(entries));
                }
              }
            } catch { /* ignore malformed legacy data */ }
            // Remove old key regardless so migration only runs once
            await AsyncStorage.removeItem(LEGACY_MANUAL_KEY);
          }
        }
      } catch { /* ignore storage errors */ }
    })();
  }, [enabled]);

  const addManualHost = useCallback(async (host: string, type: ManualDeviceType) => {
    const trimmed = host.trim();
    if (!trimmed) return;
    // Deduplicate by host string — a host can only be in the list once
    const next: ManualEntry[] = [
      ...manualEntriesRef.current.filter((e) => e.host !== trimmed),
      { host: trimmed, type },
    ];
    manualEntriesRef.current = next;
    setManualEntries(next);
    await AsyncStorage.setItem(MANUAL_DEVICES_KEY, JSON.stringify(next));
    // Poll immediately so the new host is checked right away
    doPollRef.current();
  }, []);

  const removeManualHost = useCallback(async (host: string) => {
    const next = manualEntriesRef.current.filter((e) => e.host !== host);
    manualEntriesRef.current = next;
    setManualEntries(next);
    await AsyncStorage.setItem(MANUAL_DEVICES_KEY, JSON.stringify(next));
  }, []);

  // Stable ref to doPoll so the interval effect doesn't need doPoll as a dep.
  const doPollRef = useRef<() => Promise<void>>(async () => {});

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

      const snap = discoveredRef.current;

      // Partition manual entries by device type so each goes to the right adapter
      const manualMeater = manualEntriesRef.current.filter((e) => e.type === "meater_block").map((e) => e.host);
      const manualFireboard = manualEntriesRef.current.filter((e) => e.type === "fireboard").map((e) => e.host);
      const manualSignals = manualEntriesRef.current.filter((e) => e.type === "thermoworks_signals").map((e) => e.host);

      const fireboardHosts = dedup([
        ...(snap.fireboard ?? []),
        DEFAULT_FIREBOARD_HOST,
        ...manualFireboard,
      ]);

      const meaterHosts = dedup([
        ...(snap.meater_block ?? []),
        ...DEFAULT_MEATER_BLOCK_HOSTS,
        ...manualMeater,
      ]);

      // Build a deduplicated list that includes mDNS hosts + the two
      // well-known Signals aliases.  Pass each as explicit hosts to the
      // adapter so it doesn't run its own internal alias loop on top.
      const signalsHosts = dedup([
        ...(snap.thermoworks_signals ?? []),
        ...DEFAULT_SIGNALS_HOSTS,
        ...manualSignals,
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

      trackFailures("fireboard", fireboardPerHost, snap.fireboard);
      trackFailures("meater_block", meaterPerHost, snap.meater_block);
      trackFailures("thermoworks_signals", signalsPerHost, snap.thermoworks_signals);

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

      // Ensure every manually-added host appears in the device list even when
      // offline so users can see its status and remove stale entries.
      for (const entry of manualEntriesRef.current) {
        if (!deviceMap.has(entry.host)) {
          deviceMap.set(entry.host, {
            host: entry.host,
            deviceName: MANUAL_DEVICE_LABELS[entry.type],
            connected: false,
            lastSeenMs: null,
            probes: [],
            isManual: true,
          });
        } else {
          const existing = deviceMap.get(entry.host)!;
          deviceMap.set(entry.host, { ...existing, isManual: true });
        }
      }

      setDevices(Array.from(deviceMap.values()));
      setProbes(deduped);
    } finally {
      if (mountedRef.current) setScanning(false);
    }
  }, [evictHost, rescan]);

  // Keep the ref pointing at the latest doPoll so the interval always calls
  // the current version without needing to be in the effect's dep array.
  doPollRef.current = doPoll;

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled || Platform.OS === "web") return;

    doPollRef.current();
    intervalRef.current = setInterval(() => doPollRef.current(), pollIntervalMs);

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // doPollRef is a stable ref — intentionally excluded from deps so the
    // interval is only torn down / restarted when enabled or the interval
    // duration truly changes, not on every mDNS resolution.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, pollIntervalMs]);

  const scanAll = useCallback(() => {
    if (!enabled) return;
    rescan();
    doPollRef.current();
  }, [enabled, rescan]);

  return {
    devices,
    probes,
    scanning: scanning || mdnsScanning,
    mdnsAvailable,
    mdnsScanEmpty,
    scan: scanAll,
    manualEntries,
    addManualHost,
    removeManualHost,
  };
}
