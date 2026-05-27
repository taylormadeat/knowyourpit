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
}

interface UseInkbirdBLEResult {
  probes: InkbirdProbeReading[];
  permissionDenied: boolean;
  scanning: boolean;
}

const STALE_TIMEOUT_MS = 30_000;

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

            const deviceName = ((device.name ?? device.localName ?? "Inkbird") as string);
            const temps = parseInkbirdTemps(device.manufacturerData as string | null);

            const now = Date.now();

            if (temps.length === 0) {
              // Device detected but advertisement doesn't carry temp data —
              // show it so the user knows it was found (tempF = null)
              const key = `${device.id}_0`;
              probeMapRef.current.set(key, {
                deviceId: device.id as string,
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
