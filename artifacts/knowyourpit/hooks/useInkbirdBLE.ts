/**
 * useInkbirdBLE
 *
 * Scans for nearby Inkbird wireless thermometers (IBT-2X, IBT-4XS, IBT-6XS,
 * IBS-TH) over BLE and returns live probe temperature readings without
 * requiring any account, pairing, or cloud connection.
 *
 * Inkbird IBT-series devices broadcast manufacturer data in their BLE
 * advertisement packets. Byte format (after base64 decode):
 *   [0:1]  = manufacturer ID (skipped)
 *   [2:3]  = probe channel 0 temp (little-endian uint16)
 *   [4:5]  = probe channel 1 temp
 *   …      up to N channels (2/4/6 depending on model)
 *   [2+N*2]   = unit flag: 0x00 → °C, 0xFF/0x01 → °F
 *   [2+N*2+1] = battery % (0–100, may be absent on older firmware)
 *   0xFFFF / 0xFFFE = probe not inserted
 *
 * Temperature unit: Inkbird firmware sends values in 1/10 °C by default.
 * Some older firmware revisions report 1/10 °F.
 *
 * IBS-TH1/TH2 (temperature + humidity sensors) use the same advertisement
 * structure; their single channel carries ambient temperature.
 *
 * Auto-reconnect: when assignedProbeKeys contains ble_ keys that are absent
 * from the module cache (i.e. the probe dropped), the hook restarts the BLE
 * device scan every reconnectIntervalMs (default 30 s) until the probe
 * reappears, eliminating the need for the user to tap "Scan" manually.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  INKBIRD_NAME_PREFIXES,
  parseInkbirdTemps,
} from "@/hooks/ble/adapters/inkbird";
import { saveLastInkbird, loadLastInkbird } from "@/utils/probePersistence";

export interface InkbirdProbeReading {
  deviceId: string;
  deviceName: string;
  probeIndex: number;
  tempF: number | null;
  lastSeenMs: number;
  rssi?: number | null;
  /** Rolling average of the last 3 RSSI samples (dBm). Null until first sample. */
  rssiAvg?: number | null;
  /**
   * True when the rolling RSSI average is below -85 dBm. Clears when the
   * average recovers above -80 dBm (hysteresis prevents rapid flicker).
   */
  signalWeak?: boolean;
  /** Battery percentage (0–100) parsed from the advertisement payload. Null when unavailable. */
  batteryPct?: number | null;
}

interface UseInkbirdBLEOptions {
  enabled: boolean;
  /**
   * Probe keys (e.g. `ble_AA:BB:CC:DD:EE:FF_0`) that are currently assigned
   * to this cook. When any of these keys is absent from the module cache the
   * hook sets reconnecting=true and restarts the BLE scan periodically until
   * the device reappears or enabled goes false.
   */
  assignedProbeKeys?: string[];
  /**
   * How often (in ms) to restart the BLE device scan when a probe is missing.
   * Defaults to 30 000 ms.
   */
  reconnectIntervalMs?: number;
}

interface UseInkbirdBLEResult {
  probes: InkbirdProbeReading[];
  permissionDenied: boolean;
  scanning: boolean;
  /**
   * True when at least one key from assignedProbeKeys starts with "ble_" and
   * is absent from the module cache. Stays true until the probe reappears or
   * enabled becomes false.
   */
  reconnecting: boolean;
  /**
   * Device ID of the last Inkbird probe that was successfully read during a
   * cook, persisted across app restarts via AsyncStorage under `ble_last_inkbird`.
   * Null until the first read or on fresh install.
   */
  lastKnownDeviceId: string | null;
  /**
   * Manually trigger a fresh BLE scan. Sets scanning=true, cancels any
   * pending scan-window timer, starts a new 15 s window, and calls
   * restartDeviceScan(). No-op when the hook is not yet initialised.
   */
  rescan: () => void;
}

/**
 * Stale-probe timeout: channels not seen for this long are evicted from the
 * module cache. Reduced from 30 s → 20 s so dropped channels clear faster
 * and the user sees a more accurate probe list.
 */
const STALE_TIMEOUT_MS = 20_000;
const DEFAULT_RECONNECT_INTERVAL_MS = 30_000;
/**
 * Scan silence watchdog threshold: if no BLE advertisement arrives within this
 * window while a scan is active, the scan is automatically restarted. iOS can
 * silently kill a BLE scan after the app is backgrounded or the screen locks,
 * leaving startDeviceScan running in name only.
 *
 * Reduced from 60 s → 30 s: IBT-4XS re-advertises every ~1 s, so 30 s of
 * genuine silence is an unambiguous signal that the OS has killed the scan.
 */
const SCAN_SILENCE_WATCHDOG_MS = 30_000;

/** RSSI below this threshold (dBm) triggers the weak-signal warning. */
const RSSI_WEAK_THRESHOLD = -85;
/** RSSI must recover above this level (dBm) to clear the warning (hysteresis). */
const RSSI_RECOVER_THRESHOLD = -80;
/** Number of samples kept in the rolling RSSI average. */
const RSSI_BUFFER_SIZE = 3;

/**
 * Module-level probe cache so last-seen readings survive unmount/remount.
 * Cache key = `${deviceId}_${probeIndex}` (no "ble_" prefix).
 */
const moduleProbeCache = new Map<string, InkbirdProbeReading>();
/**
 * Module-level rolling RSSI buffer per device (keyed by deviceId, shared
 * across all channels of the same device since RSSI is per-advertisement).
 */
const moduleRssiBuffers = new Map<string, number[]>();

/**
 * Derives the weak-signal boolean with hysteresis:
 * - Goes weak when rssiAvg < RSSI_WEAK_THRESHOLD (-85 dBm)
 * - Clears when rssiAvg >= RSSI_RECOVER_THRESHOLD (-80 dBm)
 * - Between the two thresholds the previous value is preserved to prevent flicker.
 */
function deriveSignalWeakInkbird(rssiAvg: number | null, prevWeak: boolean): boolean {
  if (rssiAvg === null) return false;
  if (prevWeak) return rssiAvg < RSSI_RECOVER_THRESHOLD;
  return rssiAvg < RSSI_WEAK_THRESHOLD;
}

/**
 * Returns true when the scanned BLE device is an Inkbird thermometer.
 *
 * Two-stage guard:
 *  1. Name-prefix match against INKBIRD_NAME_PREFIXES.
 *  2. Manufacturer data must be ≥ 6 bytes (2-byte mfr ID + ≥ 2 channel pairs).
 *     Non-Inkbird devices whose names share a prefix typically carry no or
 *     very short manufacturer data payloads.
 *
 * Service UUID fallback removed: 0xFFF0 / 0xFFE0 are generic UUIDs shared by
 * hundreds of unrelated BLE categories and caused false positives.
 */
function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (!INKBIRD_NAME_PREFIXES.some((p) => name.startsWith(p))) return false;
  // Require ≥ 6 bytes of manufacturer data to reject non-Inkbird devices
  // that happen to match a name prefix (fitness trackers, speakers, etc.).
  const mfr = device?.manufacturerData as string | null | undefined;
  if (!mfr) return false;
  try {
    return atob(mfr).length >= 6;
  } catch {
    return false;
  }
}

async function requestBlePermissionsAndroid(): Promise<boolean> {
  try {
    if ((Platform.Version as number) >= 31) {
      // Android 12+: dedicated BLE scan/connect permissions.
      // ACCESS_FINE_LOCATION is also required when scanning for devices
      // whose MAC address has not been previously paired.
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    // Android < 12: BLE scanning requires ACCESS_FINE_LOCATION
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Bluetooth Permission",
        message:
          "knowyourpit needs Bluetooth access to read temperatures from your Inkbird probe.",
        buttonPositive: "Allow",
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function useInkbirdBLE({
  enabled,
  assignedProbeKeys = [],
  reconnectIntervalMs = DEFAULT_RECONNECT_INTERVAL_MS,
}: UseInkbirdBLEOptions): UseInkbirdBLEResult {
  // Pre-populate from module cache so probes appear instantly on remount.
  const [probes, setProbes] = useState<InkbirdProbeReading[]>(
    () => Array.from(moduleProbeCache.values()),
  );
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [lastKnownDeviceId, setLastKnownDeviceId] = useState<string | null>(null);

  // Load persisted last-used Inkbird device on mount.
  useEffect(() => {
    if (Platform.OS === "web") return;
    loadLastInkbird(AsyncStorage)
      .then((data) => { if (data) setLastKnownDeviceId(data.deviceId); })
      .catch(() => {});
  }, []);

  const managerRef = useRef<any>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceWatchdogTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Clears the scanning spinner after the initial discovery window (15 s). */
  const scanWindowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Stable ref to the inner restartDeviceScan function. Set once the BLE
   * manager is initialised; allows the public rescan() callback to trigger a
   * fresh scan window without adding dependencies to the main effect.
   */
  const restartDeviceScanRef = useRef<(() => void) | null>(null);
  /** Timestamp of the last received Inkbird BLE advertisement (ms). */
  const lastAdvertisementAtRef = useRef<number>(0);
  /**
   * Prevents overlapping scan restarts when the silence watchdog and the
   * assigned-probe reconnect timer fire at the same time.
   */
  const restartingRef = useRef(false);

  // Keep a ref so interval callbacks always see the latest assigned keys
  // without needing them in the effect dependency array.
  const assignedProbeKeysRef = useRef<string[]>(assignedProbeKeys);
  assignedProbeKeysRef.current = assignedProbeKeys;

  useEffect(() => {
    // BLE is not available on web or when disabled
    if (Platform.OS === "web" || !enabled) {
      setScanning(false);
      setReconnecting(false);
      return;
    }

    let mounted = true;

    /**
     * Returns true when at least one assigned ble_ probe is missing from the
     * module cache. "Missing" means the probe dropped or was never seen.
     */
    function hasMissingAssignedProbe(): boolean {
      const bleKeys = assignedProbeKeysRef.current.filter((k) =>
        k.startsWith("ble_"),
      );
      if (bleKeys.length === 0) return false;
      // Cache key = `${deviceId}_${probeIndex}` (strip the "ble_" prefix).
      return bleKeys.some((k) => !moduleProbeCache.has(k.slice(4)));
    }

    /** Sync React state from the module cache and update reconnecting flag. */
    function syncState() {
      if (!mounted) return;
      setProbes(Array.from(moduleProbeCache.values()));
      setReconnecting(hasMissingAssignedProbe());
    }

    /**
     * BLE advertisement callback shared by both the initial scan and every
     * reconnect restart. Defined here so it closes over the correct `mounted`
     * flag from this effect invocation.
     */
    function handleScanResult(error: any, device: any) {
      if (!mounted) return;
      if (error) return; // Bluetooth disabled / permission revoked

      if (!isInkbirdDevice(device)) return;

      // Reset the silence watchdog on every valid advertisement so it only
      // fires during genuine scan silence, not between normal packets.
      lastAdvertisementAtRef.current = Date.now();

      const deviceName = (device.name ?? device.localName ?? "Inkbird") as string;
      const { temps, batteryPct } = parseInkbirdTemps(
        device.manufacturerData as string | null,
        deviceName,
      );
      const now = Date.now();

      const rssi = (device.rssi as number | null | undefined) ?? null;

      // Update rolling RSSI buffer (per device — RSSI is the same for all channels).
      const rssiBuf = moduleRssiBuffers.get(device.id as string) ?? [];
      if (rssi != null) {
        rssiBuf.push(rssi);
        if (rssiBuf.length > RSSI_BUFFER_SIZE) rssiBuf.splice(0, rssiBuf.length - RSSI_BUFFER_SIZE);
        moduleRssiBuffers.set(device.id as string, rssiBuf);
      }
      const rssiAvg = rssiBuf.length > 0
        ? rssiBuf.reduce((a, b) => a + b, 0) / rssiBuf.length
        : null;
      // Use channel-0 entry for hysteresis reference (all channels share the same RSSI).
      const prevWeak = moduleProbeCache.get(`${device.id}_0`)?.signalWeak ?? false;
      const signalWeak = deriveSignalWeakInkbird(rssiAvg, prevWeak);

      if (temps.length > 0) {
        // Only store channels with a physically inserted probe.
        // Do NOT emit a placeholder row for devices where no valid temps were
        // decoded — this prevents phantom "Ch 1: —" rows in the probe list
        // when the advertisement carries garbage or sentinel-only values.
        temps.forEach((tempF, idx) => {
          const key = `${device.id}_${idx}`;
          moduleProbeCache.set(key, {
            deviceId: device.id as string,
            deviceName,
            probeIndex: idx,
            tempF,
            lastSeenMs: now,
            rssi,
            rssiAvg,
            signalWeak,
            batteryPct: batteryPct ?? null,
          });
        });
      }

      syncState();

      // Persist last-used probe when the device matches an assigned probe for
      // this cook. This lets the next session highlight it immediately.
      const deviceId = device.id as string;
      if (assignedProbeKeysRef.current.some((k) => k.startsWith(`ble_${deviceId}_`))) {
        saveLastInkbird({ deviceId, deviceName }, AsyncStorage);
        setLastKnownDeviceId(deviceId);
      }
    }

    /**
     * (Re)starts the BLE device scan on the existing manager. Safe to call
     * multiple times — stops any in-progress scan before starting a new one.
     * No-op on web (BLE manager is never initialised there).
     */
    function restartDeviceScan() {
      if (Platform.OS === "web") return;
      if (!managerRef.current) return;
      try {
        managerRef.current.stopDeviceScan();
        managerRef.current.startDeviceScan(
          null, // scan all service UUIDs
          { allowDuplicates: true }, // needed to receive updated temp advertisements
          handleScanResult,
        );
      } catch {
        // BLE unavailable or adapter reset — fail silently; next timer tick will retry
      }
    }

    const startScan = async () => {
      try {
        // Dynamic import so the native module is never loaded on web/Expo Go
        const { BleManager } = await import("react-native-ble-plx");
        if (!mounted) return;

        if (Platform.OS === "android") {
          const granted = await requestBlePermissionsAndroid();
          if (!mounted) return;
          if (!granted) {
            setPermissionDenied(true);
            return;
          }
        }

        managerRef.current = new BleManager();

        if (!mounted) {
          managerRef.current.destroy();
          managerRef.current = null;
          return;
        }

        // Monitor Bluetooth state changes on iOS so we can surface the
        // permissionDenied banner when the user toggles Bluetooth off mid-cook
        // or the app is denied Bluetooth access.
        if (Platform.OS === "ios" && managerRef.current) {
          managerRef.current.onStateChange((state: string) => {
            if (!mounted) return;
            if (state === "Unauthorized") {
              // App was denied Bluetooth permission — user must go to Settings.
              setPermissionDenied(true);
            } else if (state === "PoweredOff" || state === "Unsupported") {
              // Bluetooth is off or unavailable — surface the same banner so
              // the user knows probes will not be detected until it is turned
              // back on. The banner will clear if the user re-enables BT and
              // the hook reinitialises (enabled prop cycles false → true).
              setPermissionDenied(true);
            } else if (state === "PoweredOn") {
              // Bluetooth came back on — clear the denied banner so scanning
              // can resume without requiring the user to leave and re-enter.
              setPermissionDenied(false);
            }
          }, true);
        }

        // Expose restartDeviceScan via ref so the public rescan() callback can
        // trigger a fresh window from outside the effect without extra deps.
        restartDeviceScanRef.current = restartDeviceScan;

        setScanning(true);

        // Auto-clear the scanning spinner after 15 s so the UI doesn't show a
        // permanent ActivityIndicator. Background reconnect / watchdog timers
        // continue independently — only the UI flag is cleared here.
        if (scanWindowTimerRef.current) clearTimeout(scanWindowTimerRef.current);
        scanWindowTimerRef.current = setTimeout(() => {
          if (mounted) setScanning(false);
          scanWindowTimerRef.current = null;
        }, 15_000);

        // Initialise the advertisement timestamp at scan-start so the silence
        // watchdog doesn't immediately fire before any packet has been received.
        lastAdvertisementAtRef.current = Date.now();

        restartDeviceScan();

        // Prune stale entries every 10 s and update reconnecting flag
        staleTimerRef.current = setInterval(() => {
          const now = Date.now();
          let changed = false;
          for (const [key, probe] of moduleProbeCache) {
            if (now - probe.lastSeenMs > STALE_TIMEOUT_MS) {
              moduleProbeCache.delete(key);
              changed = true;
            }
          }
          if (changed) syncState();
          // Always refresh reconnecting even when no probes were evicted,
          // in case assignedProbeKeys changed since the last sync.
          else if (mounted) setReconnecting(hasMissingAssignedProbe());
        }, 10_000);

        // Auto-reconnect: when an assigned probe is missing, restart the BLE
        // scan periodically. This recovers from OS-killed scans, adapter
        // resets, and momentary signal drops without requiring a manual "Scan".
        // Gated with restartingRef to prevent overlapping restarts when the
        // silence watchdog fires at the same time.
        reconnectTimerRef.current = setInterval(() => {
          if (!mounted || !managerRef.current) return;
          if (restartingRef.current) return;
          if (hasMissingAssignedProbe()) {
            restartingRef.current = true;
            if (__DEV__) console.warn("[useInkbirdBLE] Assigned probe missing — restarting BLE scan");
            lastAdvertisementAtRef.current = Date.now(); // reset silence timer too
            restartDeviceScan();
            setTimeout(() => { restartingRef.current = false; }, 2_000);
          }
        }, reconnectIntervalMs);

        // Scan silence watchdog: if the OS has silently killed the scan (common
        // after backgrounding or screen-lock on iOS), no advertisements arrive
        // even though startDeviceScan is still "running". Restart the scan when
        // we detect genuine silence for SCAN_SILENCE_WATCHDOG_MS (30 s).
        silenceWatchdogTimerRef.current = setInterval(() => {
          if (!mounted || !managerRef.current) return;
          if (restartingRef.current) return;
          if (Date.now() - lastAdvertisementAtRef.current > SCAN_SILENCE_WATCHDOG_MS) {
            restartingRef.current = true;
            if (__DEV__) {
              console.warn("[useInkbirdBLE] No BLE advertisements for 30 s — restarting scan");
            }
            lastAdvertisementAtRef.current = Date.now(); // reset before restart
            restartDeviceScan();
            setTimeout(() => { restartingRef.current = false; }, 2_000);
          }
        }, 15_000);
      } catch {
        // BLE unavailable (simulator, Expo Go without dev client, etc.) — fail silently
      }
    };

    startScan();

    return () => {
      mounted = false;
      if (scanWindowTimerRef.current) {
        clearTimeout(scanWindowTimerRef.current);
        scanWindowTimerRef.current = null;
      }
      if (staleTimerRef.current) {
        clearInterval(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (silenceWatchdogTimerRef.current) {
        clearInterval(silenceWatchdogTimerRef.current);
        silenceWatchdogTimerRef.current = null;
      }
      restartingRef.current = false;
      if (managerRef.current) {
        try {
          managerRef.current.stopDeviceScan();
          managerRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        managerRef.current = null;
      }
      // Note: do NOT clear moduleProbeCache — last-seen readings survive remounts
      // so the probe reappears instantly when the user returns to the cook screen.
      setScanning(false);
      setReconnecting(false);
    };
  }, [enabled, reconnectIntervalMs]);

  const rescan = useCallback(() => {
    if (!restartDeviceScanRef.current) return;
    if (scanWindowTimerRef.current) clearTimeout(scanWindowTimerRef.current);
    setScanning(true);
    scanWindowTimerRef.current = setTimeout(() => {
      setScanning(false);
      scanWindowTimerRef.current = null;
    }, 15_000);
    restartDeviceScanRef.current();
  }, []);

  return { probes, permissionDenied, scanning, reconnecting, lastKnownDeviceId, rescan };
}
