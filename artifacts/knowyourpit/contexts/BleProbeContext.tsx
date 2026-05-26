/**
 * BleProbeContext
 *
 * Singleton BLE manager that:
 *  - Scans for nearby BLE thermometer devices (Govee, MEATER single probe,
 *    Weber iGrill, Inkbird) using react-native-ble-plx
 *  - Maintains a registry of known/paired devices persisted to AsyncStorage
 *  - Reads temperature and battery level from GATT connections (MEATER, iGrill)
 *    or from advertisement packets (Govee, Inkbird — passive, no connection)
 *  - Tracks connection drops and fires a haptic + in-app banner when a
 *    previously-connected device reconnects
 *  - Exposes a clean hook API to the rest of the app
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Platform, AppState, type AppStateStatus } from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  detectAdapter,
  GATT_ADAPTERS,
  ADAPTER_LABELS,
  type BleAdapterKey,
} from "@/hooks/ble/adapters";
import {
  decodeMeaterTempChar,
  decodeBatteryChar,
  MEATER_PROBE_SERVICE_UUID,
  MEATER_PROBE_TEMP_CHAR_UUID,
  MEATER_BATTERY_CHAR_UUID,
} from "@/hooks/ble/adapters/meaterProbe";
import {
  decodeGoveeAdvertisement,
} from "@/hooks/ble/adapters/govee";
import {
  decodeIGrillProbeChar,
  decodeIGrillBatteryChar,
  IGRILL_SERVICE_UUID,
  IGRILL_PROBE_CHAR_UUIDS,
  IGRILL_BATTERY_CHAR_UUID,
} from "@/hooks/ble/adapters/weberIGrill";

const STORAGE_KEY = "knowyourpit:ble:pairedDevices";
const STALE_DEVICE_MS = 45_000;
const SCAN_DURATION_MS = 15_000;
/** How often to re-read GATT characteristics from connected devices (ms). */
const GATT_POLL_MS = 15_000;

export type BleConnectionState = "scanning" | "connecting" | "connected" | "disconnected";

export interface BleDevice {
  id: string;
  name: string;
  adapter: BleAdapterKey;
  connectionState: BleConnectionState;
  probeTempF: number | null;
  ambientTempF: number | null;
  batteryPct: number | null;
  lastSeenMs: number;
  paired: boolean;
}

export interface ReconnectBanner {
  deviceName: string;
}

interface BleProbeContextValue {
  devices: BleDevice[];
  scanning: boolean;
  permissionDenied: boolean;
  reconnectBanner: ReconnectBanner | null;
  dismissReconnectBanner: () => void;
  startScan: () => void;
  stopScan: () => void;
  pairDevice: (deviceId: string) => void;
  unpairDevice: (deviceId: string) => void;
  setHasActiveCook: (val: boolean) => void;
}

const BleProbeContext = createContext<BleProbeContextValue>({
  devices: [],
  scanning: false,
  permissionDenied: false,
  reconnectBanner: null,
  dismissReconnectBanner: () => {},
  startScan: () => {},
  stopScan: () => {},
  pairDevice: () => {},
  unpairDevice: () => {},
  setHasActiveCook: () => {},
});

export function useBleProbes() {
  return useContext(BleProbeContext);
}

async function requestBlePermissionsAndroid(): Promise<boolean> {
  const { PermissionsAndroid } = await import("react-native");
  try {
    if ((Platform.Version as number) >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Bluetooth Permission",
        message: "knowyourpit needs Bluetooth access to read temperatures from nearby probes.",
        buttonPositive: "Allow",
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

export function BleProbeProvider({ children }: { children: React.ReactNode }) {
  const [devices, setDevices] = useState<BleDevice[]>([]);
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [reconnectBanner, setReconnectBanner] = useState<ReconnectBanner | null>(null);

  const managerRef = useRef<any>(null);
  const deviceMapRef = useRef<Map<string, BleDevice>>(new Map());
  const pairedIdsRef = useRef<Set<string>>(new Set());
  const prevConnectedRef = useRef<Set<string>>(new Set());
  const wasDroppedRef = useRef<Set<string>>(new Set());
  const hasActiveCookRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gattPollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const mountedRef = useRef(true);

  const flushDevices = useCallback(() => {
    if (!mountedRef.current) return;
    setDevices(Array.from(deviceMapRef.current.values()));
  }, []);

  const checkReconnect = useCallback((device: BleDevice) => {
    if (device.connectionState === "connected") {
      if (!prevConnectedRef.current.has(device.id) && wasDroppedRef.current.has(device.id)) {
        // Genuine reconnect after a drop — show banner only (no haptic)
        setReconnectBanner({ deviceName: device.name });
        const timer = setTimeout(() => {
          if (mountedRef.current) setReconnectBanner(null);
        }, 6000);
        wasDroppedRef.current.delete(device.id);
        return () => clearTimeout(timer);
      }
      prevConnectedRef.current.add(device.id);
    } else if (device.connectionState === "disconnected") {
      if (prevConnectedRef.current.has(device.id)) {
        // Probe dropped — haptic only during a live cook
        if (hasActiveCookRef.current) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        }
        wasDroppedRef.current.add(device.id);
        prevConnectedRef.current.delete(device.id);
      }
    }
  }, []);

  const upsertDevice = useCallback(
    (id: string, update: Partial<BleDevice> & { name: string; adapter: BleAdapterKey }) => {
      const existing = deviceMapRef.current.get(id);
      const merged: BleDevice = {
        connectionState: "disconnected",
        probeTempF: null,
        ambientTempF: null,
        batteryPct: null,
        lastSeenMs: Date.now(),
        paired: pairedIdsRef.current.has(id),
        ...existing,
        ...update,
        id,
      };
      deviceMapRef.current.set(id, merged);
      checkReconnect(merged);
      flushDevices();
    },
    [flushDevices, checkReconnect],
  );

  const loadPairedIds = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const ids: string[] = JSON.parse(raw);
        pairedIdsRef.current = new Set(ids);
      }
    } catch {}
  }, []);

  const savePairedIds = useCallback(async () => {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(Array.from(pairedIdsRef.current)),
      );
    } catch {}
  }, []);

  const unpairDevice = useCallback(
    (deviceId: string) => {
      pairedIdsRef.current.delete(deviceId);
      const d = deviceMapRef.current.get(deviceId);
      if (d) deviceMapRef.current.set(deviceId, { ...d, paired: false });
      flushDevices();
      savePairedIds();
    },
    [flushDevices, savePairedIds],
  );

  /** Read the latest temps/battery from an already-connected GATT device. */
  const readGattCharacteristics = useCallback(
    async (connected: any, deviceId: string, adapter: BleAdapterKey) => {
      if (!mountedRef.current) return;
      const now = Date.now();
      if (adapter === "meater_probe") {
        try {
          const tempChar = await connected.readCharacteristicForService(
            MEATER_PROBE_SERVICE_UUID,
            MEATER_PROBE_TEMP_CHAR_UUID,
          );
          const temps = decodeMeaterTempChar(tempChar?.value ?? "");
          const batChar = await connected
            .readCharacteristicForService(
              "0000180f-0000-1000-8000-00805f9b34fb",
              MEATER_BATTERY_CHAR_UUID,
            )
            .catch(() => null);
          const batteryPct = batChar ? decodeBatteryChar(batChar.value ?? "") : null;
          upsertDevice(deviceId, {
            name: connected.name ?? deviceMapRef.current.get(deviceId)?.name ?? "MEATER Probe",
            adapter,
            connectionState: "connected",
            probeTempF: temps.probeTempF,
            ambientTempF: temps.ambientTempF,
            batteryPct,
            lastSeenMs: now,
          });
        } catch {}
      } else if (adapter === "weber_igrill") {
        try {
          const probeTempF = await connected
            .readCharacteristicForService(IGRILL_SERVICE_UUID, IGRILL_PROBE_CHAR_UUIDS[0]!)
            .then((c: any) => decodeIGrillProbeChar(c?.value ?? ""))
            .catch(() => null);
          const batteryPct = await connected
            .readCharacteristicForService(IGRILL_SERVICE_UUID, IGRILL_BATTERY_CHAR_UUID)
            .then((c: any) => decodeIGrillBatteryChar(c?.value ?? ""))
            .catch(() => null);
          upsertDevice(deviceId, {
            name: connected.name ?? deviceMapRef.current.get(deviceId)?.name ?? "Weber iGrill",
            adapter,
            connectionState: "connected",
            probeTempF: probeTempF ?? null,
            ambientTempF: null,
            batteryPct: batteryPct ?? null,
            lastSeenMs: now,
          });
        } catch {}
      }
    },
    [upsertDevice],
  );

  const connectGatt = useCallback(
    async (manager: any, deviceId: string, adapter: BleAdapterKey) => {
      if (!mountedRef.current) return;

      // Stop any existing poll timer for this device before reconnecting
      const existingTimer = gattPollTimersRef.current.get(deviceId);
      if (existingTimer) {
        clearInterval(existingTimer);
        gattPollTimersRef.current.delete(deviceId);
      }

      try {
        upsertDevice(deviceId, {
          name: deviceMapRef.current.get(deviceId)?.name ?? "Device",
          adapter,
          connectionState: "connecting",
        });

        const connected = await manager.connectToDevice(deviceId, {
          autoConnect: true,
        });
        if (!mountedRef.current) return;

        await connected.discoverAllServicesAndCharacteristics();
        if (!mountedRef.current) return;

        upsertDevice(deviceId, {
          name: connected.name ?? deviceMapRef.current.get(deviceId)?.name ?? "Device",
          adapter,
          connectionState: "connected",
        });

        // Initial read immediately after connect
        await readGattCharacteristics(connected, deviceId, adapter);

        // Periodic polling — keeps readings live without requiring GATT notifications
        const pollTimer = setInterval(async () => {
          if (!mountedRef.current) return;
          const current = deviceMapRef.current.get(deviceId);
          if (current?.connectionState !== "connected") return;
          await readGattCharacteristics(connected, deviceId, adapter);
        }, GATT_POLL_MS);
        gattPollTimersRef.current.set(deviceId, pollTimer);

        connected.onDisconnected(() => {
          const t = gattPollTimersRef.current.get(deviceId);
          if (t) { clearInterval(t); gattPollTimersRef.current.delete(deviceId); }
          if (!mountedRef.current) return;
          const d = deviceMapRef.current.get(deviceId);
          if (d) {
            deviceMapRef.current.set(deviceId, { ...d, connectionState: "disconnected" });
            prevConnectedRef.current.delete(deviceId);
            flushDevices();
          }
        });
      } catch {
        const d = deviceMapRef.current.get(deviceId);
        if (d) {
          deviceMapRef.current.set(deviceId, { ...d, connectionState: "disconnected" });
          flushDevices();
        }
      }
    },
    [upsertDevice, flushDevices, readGattCharacteristics],
  );

  // pairDevice is declared AFTER connectGatt so it can reference it directly.
  const pairDevice = useCallback(
    (deviceId: string) => {
      pairedIdsRef.current.add(deviceId);
      const d = deviceMapRef.current.get(deviceId);
      if (d) deviceMapRef.current.set(deviceId, { ...d, paired: true });
      flushDevices();
      savePairedIds();
      // Immediately attempt GATT connection if this is a connectable adapter
      // and we already have a manager (i.e. scanning has run at least once).
      if (d && GATT_ADAPTERS.includes(d.adapter) && d.connectionState !== "connected" && managerRef.current) {
        connectGatt(managerRef.current, deviceId, d.adapter);
      }
    },
    [flushDevices, savePairedIds, connectGatt],
  );

  const stopScan = useCallback(() => {
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    try {
      managerRef.current?.stopDeviceScan();
    } catch {}
    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(async () => {
    if (Platform.OS === "web") return;
    if (!mountedRef.current) return;

    try {
      const { BleManager } = await import("react-native-ble-plx");
      if (!mountedRef.current) return;

      if (Platform.OS === "android") {
        const granted = await requestBlePermissionsAndroid();
        if (!mountedRef.current) return;
        if (!granted) {
          setPermissionDenied(true);
          return;
        }
      }

      if (!managerRef.current) {
        managerRef.current = new BleManager();
      }

      setScanning(true);

      managerRef.current.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error: any, device: any) => {
          if (!mountedRef.current || error || !device) return;

          const adapter = detectAdapter(device);
          if (!adapter) return;

          const deviceName =
            (device.name ?? device.localName ?? ADAPTER_LABELS[adapter]) as string;
          const now = Date.now();

          if (GATT_ADAPTERS.includes(adapter)) {
            const existing = deviceMapRef.current.get(device.id);
            if (!existing || existing.connectionState === "disconnected") {
              upsertDevice(device.id, {
                name: deviceName,
                adapter,
                connectionState: "scanning",
                lastSeenMs: now,
              });
              if (pairedIdsRef.current.has(device.id)) {
                connectGatt(managerRef.current, device.id, adapter);
              }
            } else {
              deviceMapRef.current.set(device.id, {
                ...existing,
                lastSeenMs: now,
              });
              flushDevices();
            }
          } else {
            let probeTempF: number | null = null;
            let ambientTempF: number | null = null;
            let batteryPct: number | null = null;

            if (adapter === "govee") {
              const reading = decodeGoveeAdvertisement(device.manufacturerData ?? null);
              probeTempF = reading.probeTempF;
              batteryPct = reading.batteryPct;
            } else if (adapter === "inkbird") {
              // Inkbird temps decoded by useInkbirdBLE — here we just track presence
            }

            upsertDevice(device.id, {
              name: deviceName,
              adapter,
              connectionState: adapter === "inkbird" || probeTempF != null ? "connected" : "scanning",
              probeTempF,
              ambientTempF,
              batteryPct,
              lastSeenMs: now,
            });
          }
        },
      );

      scanTimerRef.current = setTimeout(stopScan, SCAN_DURATION_MS);
    } catch {
      if (mountedRef.current) setScanning(false);
    }
  }, [upsertDevice, flushDevices, connectGatt, stopScan]);

  useEffect(() => {
    mountedRef.current = true;

    // Load paired IDs, then immediately scan so previously-paired devices
    // reconnect without the user needing to press "Scan" manually.
    loadPairedIds().then(() => {
      if (mountedRef.current && Platform.OS !== "web") {
        startScan();
      }
    });

    if (Platform.OS !== "web") {
      staleTimerRef.current = setInterval(() => {
        const now = Date.now();
        let changed = false;
        for (const [id, d] of deviceMapRef.current) {
          if (
            d.connectionState !== "connected" &&
            now - d.lastSeenMs > STALE_DEVICE_MS
          ) {
            deviceMapRef.current.delete(id);
            changed = true;
          }
        }
        if (changed && mountedRef.current) flushDevices();
      }, 15_000);

      // Re-scan whenever the app comes back to the foreground so previously-
      // paired devices that went out of range and returned get reconnected
      // automatically (BLE connections drop when the phone screen is off).
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active" && mountedRef.current) {
          startScan();
        }
      });

      return () => {
        mountedRef.current = false;
        sub.remove();
        stopScan();
        if (staleTimerRef.current) clearInterval(staleTimerRef.current);
        for (const t of gattPollTimersRef.current.values()) clearInterval(t);
        gattPollTimersRef.current.clear();
        try {
          managerRef.current?.destroy();
        } catch {}
      };
    }

    return () => {
      mountedRef.current = false;
      stopScan();
      if (staleTimerRef.current) clearInterval(staleTimerRef.current);
      for (const t of gattPollTimersRef.current.values()) clearInterval(t);
      gattPollTimersRef.current.clear();
      try {
        managerRef.current?.destroy();
      } catch {}
    };
  }, [loadPairedIds, startScan, stopScan, flushDevices]);

  const dismissReconnectBanner = useCallback(() => {
    setReconnectBanner(null);
  }, []);

  const setHasActiveCook = useCallback((val: boolean) => {
    hasActiveCookRef.current = val;
  }, []);

  return (
    <BleProbeContext.Provider
      value={{
        devices,
        scanning,
        permissionDenied,
        reconnectBanner,
        dismissReconnectBanner,
        startScan,
        stopScan,
        pairDevice,
        unpairDevice,
        setHasActiveCook,
      }}
    >
      {children}
    </BleProbeContext.Provider>
  );
}
