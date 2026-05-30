/**
 * useInkbirdBLE
 *
 * Scans for nearby Inkbird wireless thermometers (IBT-2X, IBT-4XS, IBT-6XS,
 * IBS-TH) over BLE and returns live probe temperature readings without
 * requiring any account, pairing, or cloud connection.
 *
 * Inkbird IBT-series devices broadcast manufacturer data in their BLE
 * advertisement packets. Byte format (after base64 decode):
 *   [0:1] = manufacturer ID (skipped)
 *   [2:3] = probe channel 0 temp (little-endian uint16)
 *   [4:5] = probe channel 1 temp
 *   … up to 6 channels (IBT-6XS)
 *   0xFFFF / 0xFFFE = probe not inserted
 *
 * Temperature unit: Inkbird firmware sends values in 1/10 °C by default.
 * Some older firmware revisions report 1/10 °F — toggle
 * INKBIRD_TEMP_UNIT_IS_CELSIUS below if readings look ~32 °F too low.
 *
 * IBS-TH1/TH2 (temperature + humidity sensors) use the same advertisement
 * structure; their single channel carries ambient temperature.
 *
 * Auto-reconnect: when assignedProbeKeys contains ble_ keys that are absent
 * from the module cache (i.e. the probe dropped), the hook restarts the BLE
 * device scan every reconnectIntervalMs (default 30 s) until the probe
 * reappears, eliminating the need for the user to tap "Scan" manually.
 */

import { useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";
import {
  INKBIRD_NAME_PREFIXES,
  INKBIRD_SERVICE_UUIDS,
  parseInkbirdTemps,
} from "@/hooks/ble/adapters/inkbird";

export interface InkbirdProbeReading {
  deviceId: string;
  deviceName: string;
  probeIndex: number;
  tempF: number | null;
  lastSeenMs: number;
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
}

const STALE_TIMEOUT_MS = 30_000;
const DEFAULT_RECONNECT_INTERVAL_MS = 30_000;

/**
 * Module-level probe cache so last-seen readings survive unmount/remount.
 * Cache key = `${deviceId}_${probeIndex}` (no "ble_" prefix).
 */
const moduleProbeCache = new Map<string, InkbirdProbeReading>();

function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (INKBIRD_NAME_PREFIXES.some((p) => name.startsWith(p))) return true;

  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  const lowerUUIDs = serviceUUIDs.map((u: string) => u.toLowerCase());
  if (INKBIRD_SERVICE_UUIDS.some((uuid) => lowerUUIDs.includes(uuid))) return true;

  const serviceData: Record<string, string> = device?.serviceData ?? {};
  const lowerKeys = Object.keys(serviceData).map((k) => k.toLowerCase());
  return INKBIRD_SERVICE_UUIDS.some((uuid) => lowerKeys.includes(uuid));
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

  const managerRef = useRef<any>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

      const deviceName = (device.name ?? device.localName ?? "Inkbird") as string;
      const temps = parseInkbirdTemps(device.manufacturerData as string | null);
      const now = Date.now();

      if (temps.length === 0) {
        // Device detected but no temp payload — record so the user sees it found
        const key = `${device.id}_0`;
        moduleProbeCache.set(key, {
          deviceId: device.id as string,
          deviceName,
          probeIndex: 0,
          tempF: null,
          lastSeenMs: now,
        });
      } else {
        temps.forEach((tempF, idx) => {
          const key = `${device.id}_${idx}`;
          moduleProbeCache.set(key, {
            deviceId: device.id as string,
            deviceName,
            probeIndex: idx,
            tempF,
            lastSeenMs: now,
          });
        });
      }

      syncState();
    }

    /**
     * (Re)starts the BLE device scan on the existing manager. Safe to call
     * multiple times — stops any in-progress scan before starting a new one.
     */
    function restartDeviceScan() {
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

        setScanning(true);
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
        reconnectTimerRef.current = setInterval(() => {
          if (!mounted || !managerRef.current) return;
          if (hasMissingAssignedProbe()) {
            restartDeviceScan();
          }
        }, reconnectIntervalMs);
      } catch {
        // BLE unavailable (simulator, Expo Go without dev client, etc.) — fail silently
      }
    };

    startScan();

    return () => {
      mounted = false;
      if (staleTimerRef.current) {
        clearInterval(staleTimerRef.current);
        staleTimerRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearInterval(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
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

  return { probes, permissionDenied, scanning, reconnecting };
}
