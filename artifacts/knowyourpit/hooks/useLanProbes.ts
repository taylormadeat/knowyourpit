/**
 * useLanProbes
 *
 * Discovers and polls WiFi thermometer base stations on the local network.
 * Supported devices: Fireboard 2/Drive, MEATER Block, ThermoWorks Signals.
 *
 * Strategy #1 — well-known .local mDNS hostnames: many consumer routers
 * forward mDNS PTR records so `fireboard.local`, `meaterblock.local`, and
 * `thermoworks-signals.local` resolve without any OS-level Zeroconf support.
 * Fetch simply times out after 3 s if the host isn't reachable.
 *
 * Strategy #2 — user-supplied custom hosts: for devices that don't respond
 * to .local names (e.g. router with mDNS disabled, or using a static IP),
 * the user can add raw IP addresses / hostnames from the Devices screen.
 * These are persisted to AsyncStorage under CUSTOM_HOSTS_KEY and included in
 * every poll cycle alongside the well-known hosts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { pollFireboard } from "./lan/fireboard";
import { pollMeaterBlock } from "./lan/meaterBlock";
import { pollThermoworksSignals } from "./lan/thermoworksSignals";

const CUSTOM_HOSTS_KEY = "knowyourpit:lan:customHosts";

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
  customHosts: string[];
  scan: () => void;
  addCustomHost: (host: string) => void;
  removeCustomHost: (host: string) => void;
}

const DEFAULT_POLL_INTERVAL_MS = 15_000;

async function tryPollCustomHost(host: string): Promise<LanProbeReading[]> {
  // Try each known adapter against the user-supplied host. We attempt all three
  // adapters in order and return the first non-empty result.
  for (const poll of [pollFireboard, pollMeaterBlock, pollThermoworksSignals]) {
    try {
      const readings = await poll(host);
      if (readings.length > 0) return readings;
    } catch {
      // adapter not supported on this host — try next
    }
  }
  return [];
}

export function useLanProbes({
  enabled,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: UseLanProbesOptions): UseLanProbesResult {
  const [devices, setDevices] = useState<LanDeviceStatus[]>([]);
  const [probes, setProbes] = useState<LanProbeReading[]>([]);
  const [scanning, setScanning] = useState(false);
  const [customHosts, setCustomHosts] = useState<string[]>([]);
  const customHostsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load persisted custom hosts on mount
  useEffect(() => {
    AsyncStorage.getItem(CUSTOM_HOSTS_KEY)
      .then((raw) => {
        if (raw) {
          const parsed: string[] = JSON.parse(raw);
          customHostsRef.current = parsed;
          if (mountedRef.current) setCustomHosts(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const persistCustomHosts = useCallback((hosts: string[]) => {
    AsyncStorage.setItem(CUSTOM_HOSTS_KEY, JSON.stringify(hosts)).catch(() => {});
  }, []);

  const addCustomHost = useCallback((host: string) => {
    const trimmed = host.trim();
    if (!trimmed) return;
    const next = [...customHostsRef.current.filter((h) => h !== trimmed), trimmed];
    customHostsRef.current = next;
    setCustomHosts(next);
    persistCustomHosts(next);
  }, [persistCustomHosts]);

  const removeCustomHost = useCallback((host: string) => {
    const next = customHostsRef.current.filter((h) => h !== host);
    customHostsRef.current = next;
    setCustomHosts(next);
    persistCustomHosts(next);
  }, [persistCustomHosts]);

  const doPoll = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!mountedRef.current) return;
    setScanning(true);

    try {
      // Poll well-known .local hostnames and user-supplied custom hosts concurrently
      const customHostPolls = customHostsRef.current.map((h) =>
        tryPollCustomHost(h).catch(() => [] as LanProbeReading[]),
      );

      const [fireboardReadings, meaterBlockReadings, signalsReadings, ...customReadingsArrays] =
        await Promise.all([
          pollFireboard().catch(() => [] as LanProbeReading[]),
          pollMeaterBlock().catch(() => [] as LanProbeReading[]),
          pollThermoworksSignals().catch(() => [] as LanProbeReading[]),
          ...customHostPolls,
        ]);

      if (!mountedRef.current) return;

      const allReadings = [
        ...fireboardReadings,
        ...meaterBlockReadings,
        ...signalsReadings,
        ...customReadingsArrays.flat(),
      ];

      // Deduplicate by deviceId in case a custom host duplicates a .local hit
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
  }, []);

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

  return { devices, probes, scanning, customHosts, scan: doPoll, addCustomHost, removeCustomHost };
}
