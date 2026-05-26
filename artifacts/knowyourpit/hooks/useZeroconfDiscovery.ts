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
 * Platform behaviour
 * ------------------
 * - On web `discovered` is always an empty map and `mdnsAvailable` is false.
 * - If the native Zeroconf module failed to load (e.g. Expo Go without a
 *   dev-client rebuild), the hook falls back silently: `discovered` stays
 *   empty and `mdnsAvailable` is false so callers can fall back to well-known
 *   hostnames.
 */

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

export function useZeroconfDiscovery(enabled: boolean): UseZeroconfDiscoveryResult {
  const [discovered, setDiscovered] = useState<DiscoveredHosts>({});
  const [mdnsAvailable, setMdnsAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);
  const browserRef = useRef<ZeroconfBrowser | null>(null);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

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
    });

    browser.on("removed", (service: ZeroconfService) => {
      if (!mountedRef.current) return;
      const ipv4 = service.addresses?.find((a) => /^\d{1,3}(\.\d{1,3}){3}$/.test(a));
      const host = ipv4 ?? service.host;
      const type = classifyService(service.name, service.host, service.port);
      setDiscovered((prev) => removeHost(prev, type, host));
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
