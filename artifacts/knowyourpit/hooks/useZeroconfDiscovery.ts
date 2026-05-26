/**
 * useZeroconfDiscovery
 *
 * Runs an mDNS browser via react-native-zeroconf and returns a map of
 * device-type → discovered hosts (IP addresses or .local names).
 *
 * The browser scans `_http._tcp` on the local network.  Each resolved
 * service is classified by name / host / port into one of the known
 * thermometer device types.  The caller passes those hosts to the
 * matching polling adapter instead of the hardcoded .local defaults.
 *
 * Persistence
 * -----------
 * Each resolved host is written to AsyncStorage keyed by device type so
 * that the previously-seen address is available immediately on the next
 * app launch (before the 8-second scan window completes).  Entries that
 * have not been re-confirmed by a live mDNS resolve within the last 24 h
 * are evicted on load to avoid polling stale IPs indefinitely.
 *
 * Platform behaviour
 * ------------------
 * - On web `discovered` is always an empty map and `mdnsAvailable` is false.
 * - If the native Zeroconf module failed to load (e.g. Expo Go without a
 *   dev-client rebuild), the hook falls back silently: `discovered` stays
 *   empty and `mdnsAvailable` is false so callers can fall back to well-known
 *   hostnames.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import {
  createZeroconfBrowser,
  classifyService,
  type ZeroconfDeviceType,
  type ZeroconfService,
  type ZeroconfBrowser,
} from "./lan/zeroconf";

export type DiscoveredHosts = Partial<Record<ZeroconfDeviceType, string[]>>;

export interface UseZeroconfDiscoveryResult {
  /** Map of device-type → list of discovered hosts (IP / .local names) */
  discovered: DiscoveredHosts;
  /** Whether the native mDNS module loaded successfully */
  mdnsAvailable: boolean;
  /** Whether a scan is actively running */
  scanning: boolean;
  /** Manually trigger a fresh scan (stops current scan, restarts) */
  rescan: () => void;
}

/** How long (ms) to keep a scan active before stopping */
const SCAN_DURATION_MS = 8_000;

/** Persisted entries older than this are evicted on load */
const PERSIST_TTL_MS = 24 * 60 * 60 * 1000;

const STORAGE_KEY_PREFIX = "@knowyourpit/mdns/";

interface PersistedEntry {
  host: string;
  discoveredAt: number;
}

function storageKey(type: ZeroconfDeviceType): string {
  return `${STORAGE_KEY_PREFIX}${type}`;
}

/** Load persisted hosts for a device type, filtering out expired entries. */
async function loadPersistedHosts(type: ZeroconfDeviceType): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    if (!raw) return [];
    const entries: PersistedEntry[] = JSON.parse(raw);
    const cutoff = Date.now() - PERSIST_TTL_MS;
    return entries.filter((e) => e.discoveredAt >= cutoff).map((e) => e.host);
  } catch {
    return [];
  }
}

/**
 * Upsert a host for a device type in AsyncStorage, refreshing its
 * discoveredAt timestamp.  Stale entries are evicted at the same time.
 */
async function persistHost(type: ZeroconfDeviceType, host: string): Promise<void> {
  if (type === "unknown") return;
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    const existing: PersistedEntry[] = raw ? JSON.parse(raw) : [];
    const cutoff = Date.now() - PERSIST_TTL_MS;
    // Keep non-stale entries that aren't the current host
    const filtered = existing.filter((e) => e.discoveredAt >= cutoff && e.host !== host);
    const updated: PersistedEntry[] = [...filtered, { host, discoveredAt: Date.now() }];
    await AsyncStorage.setItem(storageKey(type), JSON.stringify(updated));
  } catch {
    // Non-fatal — persistence is best-effort
  }
}

function addHost(map: DiscoveredHosts, type: ZeroconfDeviceType, host: string): DiscoveredHosts {
  if (type === "unknown") return map;
  const existing = map[type] ?? [];
  if (existing.includes(host)) return map;
  return { ...map, [type]: [...existing, host] };
}

function removeHost(map: DiscoveredHosts, type: ZeroconfDeviceType, host: string): DiscoveredHosts {
  const existing = map[type];
  if (!existing) return map;
  const next = existing.filter((h) => h !== host);
  return { ...map, [type]: next.length ? next : undefined };
}

/** Known classifiable device types (excludes "unknown") */
const KNOWN_TYPES: ZeroconfDeviceType[] = ["fireboard", "meater_block", "thermoworks_signals"];

export function useZeroconfDiscovery(enabled: boolean): UseZeroconfDiscoveryResult {
  const [discovered, setDiscovered] = useState<DiscoveredHosts>({});
  const [mdnsAvailable, setMdnsAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);
  const browserRef = useRef<ZeroconfBrowser | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // Seed discovered state from AsyncStorage before the first scan completes
  useEffect(() => {
    if (Platform.OS === "web" || !enabled) return;

    let cancelled = false;
    (async () => {
      const seedMap: DiscoveredHosts = {};
      await Promise.all(
        KNOWN_TYPES.map(async (type) => {
          const hosts = await loadPersistedHosts(type);
          if (hosts.length > 0) {
            seedMap[type] = hosts;
          }
        }),
      );
      if (!cancelled) {
        setDiscovered((prev) => {
          // Merge: persisted hosts fill slots not yet populated by live scan
          let next = { ...prev };
          for (const type of KNOWN_TYPES) {
            const seeded = seedMap[type];
            if (!seeded) continue;
            const live = prev[type] ?? [];
            const merged = [...new Set([...live, ...seeded])];
            if (merged.length > 0) next = { ...next, [type]: merged };
          }
          return next;
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const stopScan = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    try {
      browserRef.current?.stop();
    } catch {
      // ignore
    }
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(() => {
    const browser = browserRef.current;
    if (!browser) return;

    stopScan();
    if (!mountedRef.current) return;

    setScanning(true);

    try {
      // type and protocol are passed WITHOUT leading underscores;
      // the native module prepends them: 'http' → '_http._tcp.local.'
      browser.scan("http", "tcp", "local.");
    } catch {
      if (mountedRef.current) setScanning(false);
      return;
    }

    // Auto-stop after SCAN_DURATION_MS
    scanTimerRef.current = setTimeout(() => {
      stopScan();
    }, SCAN_DURATION_MS);
  }, [stopScan]);

  // Initialise the native browser once
  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS === "web" || !enabled) return;

    const browser = createZeroconfBrowser();
    if (!browser) {
      return;
    }

    browserRef.current = browser;
    setMdnsAvailable(true);

    browser.on("resolved", (service: ZeroconfService) => {
      if (!mountedRef.current) return;
      // Prefer an IPv4 address so polling adapters can build valid URLs.
      // Avoid raw IPv6 addresses — they need bracket notation in URLs and
      // many thermometer firmwares don't support IPv6 HTTP at all.
      // Fall back to the .local mDNS hostname when no IPv4 is present.
      const ipv4 = service.addresses?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipv4 ?? service.host;
      const type = classifyService(service.name, service.host, service.port);
      setDiscovered((prev) => addHost(prev, type, host));
      // Persist in the background — fire-and-forget
      persistHost(type, host);
    });

    browser.on("removed", (service: ZeroconfService) => {
      if (!mountedRef.current) return;
      const ipv4 = service.addresses?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipv4 ?? service.host;
      const type = classifyService(service.name, service.host, service.port);
      setDiscovered((prev) => removeHost(prev, type, host));
      // Note: we intentionally do NOT remove from AsyncStorage on "removed"
      // events — the device may just have gone quiet for a moment. The 24 h
      // TTL is the eviction mechanism; a re-discovery refreshes the timestamp.
    });

    browser.on("error", (_err: Error) => {
      if (mountedRef.current) setScanning(false);
    });

    // Kick off the first scan
    // Use a small delay so the listeners are registered before scan() runs
    const initTimer = setTimeout(() => {
      if (mountedRef.current) startScan();
    }, 200);

    return () => {
      mountedRef.current = false;
      clearTimeout(initTimer);
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      try {
        browser.stop();
        browser.removeDeviceListeners();
      } catch {
        // ignore
      }
      browserRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { discovered, mdnsAvailable, scanning, rescan: startScan };
}
