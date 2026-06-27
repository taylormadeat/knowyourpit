/**
 * useZeroconfDiscovery
 *
 * Runs an mDNS browser via react-native-zeroconf and returns a map of
 * device-type → discovered hosts (IP addresses or .local names).
 *
 * The browser scans both `_http._tcp` and `_meater._tcp` on the local
 * network concurrently using two independent browser instances.  Each
 * resolved service is classified into one of the known thermometer device
 * types.  The caller passes those hosts to the matching polling adapter
 * instead of the hardcoded .local defaults.
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
  /**
   * True after at least one full mDNS scan cycle has completed (scanning went
   * true → false) with an empty result.  This is the best available in-app
   * proxy for "iOS Local Network permission was denied": the module loads fine
   * (mdnsAvailable === true) but browsing returned nothing.  Resets to false
   * whenever a service is resolved.
   */
  mdnsScanEmpty: boolean;
  /** Manually trigger a fresh scan (stops current scan, restarts) */
  rescan: () => void;
  /**
   * Remove a host from both the in-memory discovered map and AsyncStorage.
   * Call this when consecutive poll failures indicate the cached IP is stale.
   */
  evictHost: (type: ZeroconfDeviceType, host: string) => void;
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

/** Remove a single host entry from AsyncStorage for a given device type. */
async function removePersistedHost(type: ZeroconfDeviceType, host: string): Promise<void> {
  if (type === "unknown") return;
  try {
    const raw = await AsyncStorage.getItem(storageKey(type));
    if (!raw) return;
    const existing: PersistedEntry[] = JSON.parse(raw);
    const updated = existing.filter((e) => e.host !== host);
    await AsyncStorage.setItem(storageKey(type), JSON.stringify(updated));
  } catch {
    // Non-fatal — persistence is best-effort
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

export function addHost(map: DiscoveredHosts, type: ZeroconfDeviceType, host: string): DiscoveredHosts {
  if (type === "unknown") return map;
  const existing = map[type] ?? [];
  if (existing.includes(host)) return map;
  return { ...map, [type]: [...existing, host] };
}

export function removeHost(map: DiscoveredHosts, type: ZeroconfDeviceType, host: string): DiscoveredHosts {
  const existing = map[type];
  if (!existing) return map;
  const next = existing.filter((h) => h !== host);
  return { ...map, [type]: next.length ? next : undefined };
}

/** Known classifiable device types (excludes "unknown") */
const KNOWN_TYPES: ZeroconfDeviceType[] = ["fireboard", "meater_block"];

export function useZeroconfDiscovery(enabled: boolean): UseZeroconfDiscoveryResult {
  const [discovered, setDiscovered] = useState<DiscoveredHosts>({});
  const [mdnsAvailable, setMdnsAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [mdnsScanEmpty, setMdnsScanEmpty] = useState(false);
  const browserRef = useRef<ZeroconfBrowser | null>(null);
  // Second browser instance for _meater._tcp — MEATER Block's native service type
  const meaterBrowserRef = useRef<ZeroconfBrowser | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  // Keep a ref to the latest discovered map so the scan-completion effect can
  // read its current value without adding discovered to its dependency array
  // (which would fire on every resolve event instead of just on scan end).
  const discoveredRef = useRef<DiscoveredHosts>({});
  discoveredRef.current = discovered;
  const prevScanningRef = useRef(false);

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
    try { browserRef.current?.stop(); } catch {}
    try { meaterBrowserRef.current?.stop(); } catch {}
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(() => {
    const httpBrowser = browserRef.current;
    const meaterBrowser = meaterBrowserRef.current;
    if (!httpBrowser && !meaterBrowser) return;

    stopScan();
    if (!mountedRef.current) return;
    setScanning(true);

    let anyStarted = false;
    if (httpBrowser) {
      try {
        // type and protocol WITHOUT leading underscores — native module prepends them
        // e.g. "http" + "tcp" → _http._tcp.local.
        httpBrowser.scan("http", "tcp", "local.");
        anyStarted = true;
      } catch { /* ignore */ }
    }
    if (meaterBrowser) {
      try {
        // Scan _meater._tcp — MEATER Block's native service advertisement type
        meaterBrowser.scan("meater", "tcp", "local.");
        anyStarted = true;
      } catch { /* ignore */ }
    }

    if (!anyStarted) {
      if (mountedRef.current) setScanning(false);
      return;
    }

    scanTimerRef.current = setTimeout(stopScan, SCAN_DURATION_MS);
  }, [stopScan]);

  // Initialise both native browser instances once
  useEffect(() => {
    mountedRef.current = true;

    if (Platform.OS === "web" || !enabled) return;

    // httpBrowser  → scans _http._tcp (all LAN thermometers, classified by name/port)
    // meaterBrowser → scans _meater._tcp (always MEATER Blocks — no classification needed)
    const httpBrowser = createZeroconfBrowser();
    // createZeroconfBrowser wraps `new Zeroconf()` in a try/catch, so if the
    // native module only supports one instance this returns null gracefully.
    const meaterBrowser = createZeroconfBrowser();

    if (!httpBrowser && !meaterBrowser) return;

    // ── Shared event helpers ─────────────────────────────────────────────────
    // forcedType is supplied by the meater browser (always "meater_block"),
    // skipping the name/port heuristics in classifyService for those events.
    const onResolved = (service: ZeroconfService, forcedType?: ZeroconfDeviceType) => {
      if (!mountedRef.current) return;
      // Prefer an IPv4 address so polling adapters can build valid URLs.
      // Avoid raw IPv6 — bracket notation is needed there and many firmwares
      // don't support IPv6 HTTP.  Fall back to .local when no IPv4 is present.
      const ipv4 = service.addresses?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipv4 ?? service.host;
      const type = forcedType ?? classifyService(service.name, service.host, service.port);
      setDiscovered((prev) => addHost(prev, type, host));
      // Persist in the background — fire-and-forget
      persistHost(type, host);
    };

    const onRemoved = (service: ZeroconfService, forcedType?: ZeroconfDeviceType) => {
      if (!mountedRef.current) return;
      const ipv4 = service.addresses?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipv4 ?? service.host;
      const type = forcedType ?? classifyService(service.name, service.host, service.port);
      setDiscovered((prev) => removeHost(prev, type, host));
      // Note: we intentionally do NOT remove from AsyncStorage on "removed"
      // events — the device may just have gone quiet for a moment. The 24 h
      // TTL is the eviction mechanism; a re-discovery refreshes the timestamp.
    };

    // ── Register handlers ────────────────────────────────────────────────────
    if (httpBrowser) {
      browserRef.current = httpBrowser;
      httpBrowser.on("resolved", (s: ZeroconfService) => onResolved(s));
      httpBrowser.on("removed", (s: ZeroconfService) => onRemoved(s));
      httpBrowser.on("error", (_err: Error) => {
        if (mountedRef.current) setScanning(false);
      });
    }

    if (meaterBrowser) {
      meaterBrowserRef.current = meaterBrowser;
      // All _meater._tcp services are MEATER Blocks — skip classifyService
      meaterBrowser.on("resolved", (s: ZeroconfService) => onResolved(s, "meater_block"));
      meaterBrowser.on("removed", (s: ZeroconfService) => onRemoved(s, "meater_block"));
      meaterBrowser.on("error", () => { /* MEATER scan error is non-fatal */ });
    }

    if (httpBrowser || meaterBrowser) setMdnsAvailable(true);

    return () => {
      mountedRef.current = false;
      if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
      try { httpBrowser?.stop(); httpBrowser?.removeDeviceListeners(); } catch {}
      try { meaterBrowser?.stop(); meaterBrowser?.removeDeviceListeners(); } catch {}
      browserRef.current = null;
      meaterBrowserRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const evictHost = useCallback((type: ZeroconfDeviceType, host: string) => {
    setDiscovered((prev) => removeHost(prev, type, host));
    // Remove from AsyncStorage so it doesn't seed the next session
    removePersistedHost(type, host);
  }, []);

  // After each mDNS scan cycle completes, record whether anything was discovered.
  // This is the best available in-app proxy for "iOS Local Network permission denied":
  // the module loads fine (mdnsAvailable=true) but browsing the LAN returned nothing
  // after the full 8-second window.  Resets to false if a service is resolved later
  // (handled in the "resolved" listener above via setDiscovered which causes a re-check).
  useEffect(() => {
    if (!enabled) {
      setMdnsScanEmpty(false);
      prevScanningRef.current = false;
      return;
    }
    // Trailing edge: scanning was true, is now false → scan just ended
    if (prevScanningRef.current && !scanning) {
      const hasResults = KNOWN_TYPES.some((t) => (discoveredRef.current[t]?.length ?? 0) > 0);
      setMdnsScanEmpty(!hasResults);
    }
    prevScanningRef.current = scanning;
  }, [scanning, enabled]);

  return { discovered, mdnsAvailable, scanning, mdnsScanEmpty, rescan: startScan, evictHost };
}
