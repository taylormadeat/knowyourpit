/**
 * useInkbirdBLE
 *
 * Scans for nearby Inkbird wireless thermometers (IBT-2X, IBT-4XS, IBT-6XS)
 * over BLE and returns live probe temperature readings without requiring any
 * account, pairing, or cloud connection.
 *
 * Inkbird IBT-series devices broadcast manufacturer data in their BLE
 * advertisement packets. Byte format (after base64 decode):
 *   [0:1] = manufacturer ID (skipped)
 *   [2:3] = probe channel 0 temp (little-endian uint16, units = 1/10 °F)
 *   [4:5] = probe channel 1 temp
 *   … up to 6 channels
 *   0xFFFF / 0xFFFE = probe not inserted
 *
 * NOTE: Byte format may need calibration per firmware revision. If readings
 * look off, toggle INKBIRD_TEMP_UNIT_IS_CELSIUS below.
 */

import { useEffect, useRef, useState } from "react";
import { Platform, PermissionsAndroid } from "react-native";

export interface InkbirdProbeReading {
  deviceId: string;
  deviceName: string;
  probeIndex: number;
  tempF: number | null;
  lastSeenMs: number;
}

interface UseInkbirdBLEOptions {
  enabled: boolean;
}

interface UseInkbirdBLEResult {
  probes: InkbirdProbeReading[];
  permissionDenied: boolean;
  scanning: boolean;
}

// Inkbird IBT-series advertisement format: values are in 1/10 °C by default.
// Set to false only if your specific firmware revision reports in 1/10 °F.
const INKBIRD_TEMP_UNIT_IS_CELSIUS = true;

// Device name prefixes used by Inkbird thermometers (case-insensitive)
const INKBIRD_PREFIXES = ["ibbq", "inkbird", "ibt-", "ibt_"];

// Service UUID advertised by Inkbird IBT-series devices (16-bit: 0xFFF0)
const INKBIRD_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";

// Remove devices from the list if not seen within this window
const STALE_TIMEOUT_MS = 30_000;

function isInkbirdDevice(device: any): boolean {
  const name = (device?.name ?? device?.localName ?? "") as string;
  if (INKBIRD_PREFIXES.some((p) => name.toLowerCase().startsWith(p))) return true;
  // Fallback: match on advertised service UUID (some models omit a known name)
  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  if (serviceUUIDs.some((u: string) => u.toLowerCase() === INKBIRD_SERVICE_UUID)) return true;
  const serviceData: Record<string, string> = device?.serviceData ?? {};
  if (Object.keys(serviceData).some((k) => k.toLowerCase() === INKBIRD_SERVICE_UUID)) return true;
  return false;
}

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

/**
 * Parse probe temperatures from an Inkbird IBT-series BLE advertisement.
 * Returns an array of tempF values, one per inserted probe channel.
 * Channels with no probe inserted are omitted.
 */
function parseInkbirdTemps(manufacturerData: string | null): number[] {
  if (!manufacturerData) return [];
  const bytes = base64ToBytes(manufacturerData);
  if (bytes.length < 4) return [];

  const temps: number[] = [];
  // Skip 2-byte manufacturer ID prefix, then read pairs
  for (let i = 2; i + 1 < bytes.length; i += 2) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1] ?? 0;
    const raw = b0 | (b1 << 8); // little-endian uint16
    if (raw >= 0xFFFE) continue; // probe not inserted

    const value = raw / 10;
    const tempF = INKBIRD_TEMP_UNIT_IS_CELSIUS
      ? (value * 9) / 5 + 32
      : value;
    temps.push(tempF);
  }
  return temps;
}

async function requestBlePermissionsAndroid(): Promise<boolean> {
  try {
    if ((Platform.Version as number) >= 31) {
      // Android 12+: dedicated BLE scan/connect permissions
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
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

export function useInkbirdBLE({ enabled }: UseInkbirdBLEOptions): UseInkbirdBLEResult {
  const [probes, setProbes] = useState<InkbirdProbeReading[]>([]);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Internal mutable map: `${deviceId}_${probeIndex}` → reading
  const probeMapRef = useRef<Map<string, InkbirdProbeReading>>(new Map());
  const managerRef = useRef<any>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // BLE is not available on web or when disabled
    if (Platform.OS === "web" || !enabled) {
      setScanning(false);
      return;
    }

    let mounted = true;

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

        managerRef.current.startDeviceScan(
          null, // scan all service UUIDs
          { allowDuplicates: true }, // needed to receive updated temp advertisements
          (error: any, device: any) => {
            if (!mounted) return;
            if (error) return; // Bluetooth disabled / permission revoked

            if (!isInkbirdDevice(device)) return;

            const deviceName = (device.name ?? device.localName ?? "Inkbird") as string;
            const temps = parseInkbirdTemps(device.manufacturerData as string | null);

            const now = Date.now();

            if (temps.length === 0) {
              // Device detected but advertisement doesn't carry temp data —
              // show it so the user knows it was found (tempF = null)
              const key = `${device.id}_0`;
              probeMapRef.current.set(key, {
                deviceId: device.id,
                deviceName,
                probeIndex: 0,
                tempF: null,
                lastSeenMs: now,
              });
            } else {
              temps.forEach((tempF, idx) => {
                const key = `${device.id}_${idx}`;
                probeMapRef.current.set(key, {
                  deviceId: device.id as string,
                  deviceName,
                  probeIndex: idx,
                  tempF,
                  lastSeenMs: now,
                });
              });
            }

            if (mounted) {
              setProbes(Array.from(probeMapRef.current.values()));
            }
          },
        );

        // Prune stale entries every 10 s
        staleTimerRef.current = setInterval(() => {
          const now = Date.now();
          let changed = false;
          for (const [key, probe] of probeMapRef.current) {
            if (now - probe.lastSeenMs > STALE_TIMEOUT_MS) {
              probeMapRef.current.delete(key);
              changed = true;
            }
          }
          if (changed && mounted) {
            setProbes(Array.from(probeMapRef.current.values()));
          }
        }, 10_000);
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
      if (managerRef.current) {
        try {
          managerRef.current.stopDeviceScan();
          managerRef.current.destroy();
        } catch {
          // ignore cleanup errors
        }
        managerRef.current = null;
      }
      probeMapRef.current.clear();
      setProbes([]);
      setScanning(false);
    };
  }, [enabled]);

  return { probes, permissionDenied, scanning };
}
