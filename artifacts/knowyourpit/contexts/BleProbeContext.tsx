/**
 * BleProbeContext
 *
 * Singleton BLE manager that:
 *  - Scans for nearby BLE thermometer devices (Govee, Weber iGrill, Inkbird)
 *    using react-native-ble-plx
 *  - Maintains a registry of known/paired devices persisted to AsyncStorage
 *  - Reads temperature and battery level from GATT connections (iGrill)
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
  RFX_ADAPTER,
  type BleAdapterKey,
} from "@/hooks/ble/adapters";
import {
  decodeGoveeAdvertisement,
} from "@/hooks/ble/adapters/govee";
import {
  parseInkbirdTemps,
} from "@/hooks/ble/adapters/inkbird";
import {
  decodeIGrillProbeChar,
  decodeIGrillBatteryChar,
  IGRILL_SERVICE_UUID,
  IGRILL_PROBE_CHAR_UUIDS,
  IGRILL_BATTERY_CHAR_UUID,
} from "@/hooks/ble/adapters/weberIGrill";
import {
  getBleAvailability,
  shouldClearSavedPermissionWarning,
  type BleAvailability,
  type BleScanStartResult,
} from "@/hooks/ble/availability";

const STORAGE_KEY = "knowyourpit:ble:pairedDevices";
const PERM_DENIED_KEY = "knowyourpit:ble:permDenied";
const STALE_DEVICE_MS = 45_000;
const SCAN_DURATION_MS = 15_000;
/** How often to re-read GATT characteristics from connected devices (ms). */
const GATT_POLL_MS = 15_000;
/** RSSI below this threshold (dBm) triggers the weak-signal warning. */
const RSSI_WEAK_THRESHOLD = -85;
/** RSSI must recover above this level (dBm) to clear the warning (hysteresis). */
const RSSI_RECOVER_THRESHOLD = -80;
/** Number of samples kept in the rolling RSSI average. */
const RSSI_BUFFER_SIZE = 3;

/**
 * Derives the weak-signal boolean with hysteresis:
 * - Goes weak when rssiAvg < -85 dBm
 * - Clears when rssiAvg >= -80 dBm
 * - Between the two thresholds the previous value is preserved to prevent flicker.
 */
function deriveSignalWeak(rssiAvg: number | null, prevWeak: boolean): boolean {
  if (rssiAvg === null) return false;
  if (prevWeak) return rssiAvg < RSSI_RECOVER_THRESHOLD;
  return rssiAvg < RSSI_WEAK_THRESHOLD;
}
/**
 * Advertisement watchdog threshold: if a paired advertisement-based device
 * (Govee / Inkbird in BleProbeContext) has not been seen for this long during
 * an active cook, the stale-timer interval restarts the BLE scan to find it.
 * Must be > STALE_DEVICE_MS so the device is first marked disconnected, then
 * the watchdog fires on the next interval tick.
 */
const ADV_WATCHDOG_MS = 60_000;

export type BleConnectionState =
  | "scanning"
  | "connecting"
  | "connected"
  | "disconnected"
  | "unsupported";

export interface BleDevice {
  id: string;
  name: string;
  adapter: BleAdapterKey;
  connectionState: BleConnectionState;
  probeTempF: number | null;
  ambientTempF: number | null;
  batteryPct: number | null;
  /** Multi-channel temps for advertisement-based probes (e.g. Inkbird IBT-series). */
  channelTempsF: number[] | null;
  lastSeenMs: number;
  paired: boolean;
  /** Latest RSSI (dBm) from the most recent advertisement or GATT readRSSI(). */
  rssi?: number | null;
  /** Rolling average of the last 3 RSSI samples (dBm). Null until first sample. */
  rssiAvg?: number | null;
  /**
   * True when the rolling RSSI average is below -85 dBm. Clears when the
   * average recovers above -80 dBm (hysteresis prevents rapid flicker).
   */
  signalWeak?: boolean;
}

export interface ReconnectBanner {
  deviceName: string;
}

interface BleProbeContextValue {
  devices: BleDevice[];
  scanning: boolean;
  permissionDenied: boolean;
  bluetoothAvailability: BleAvailability;
  reconnectBanner: ReconnectBanner | null;
  dismissReconnectBanner: () => void;
  startScan: () => Promise<BleScanStartResult>;
  stopScan: () => void;
  pairDevice: (deviceId: string) => void;
  unpairDevice: (deviceId: string) => void;
  setHasActiveCook: (val: boolean) => void;
  /**
   * True when any BLE device is in an active recovery cycle — either a GATT
   * reconnect timer is pending (Weber iGrill) or the advertisement
   * watchdog restarted the scan for a silent paired device (Govee / Inkbird).
   */
  reconnecting: boolean;
}

const BleProbeContext = createContext<BleProbeContextValue>({
  devices: [],
  scanning: false,
  permissionDenied: false,
  bluetoothAvailability: "initializing",
  reconnectBanner: null,
  dismissReconnectBanner: () => {},
  startScan: async () => "blocked",
  stopScan: () => {},
  pairDevice: () => {},
  unpairDevice: () => {},
  setHasActiveCook: () => {},
  reconnecting: false,
});

export function useBleProbes() {
  return useContext(BleProbeContext);
}

async function requestBlePermissionsAndroid(): Promise<boolean> {
  const { PermissionsAndroid, Alert } = await import("react-native");
  try {
    if ((Platform.Version as number) >= 31) {
      // Android 12+: show a rationale before the system dialog appears so
      // the pitmaster understands why Bluetooth access is needed.
      await new Promise<void>((resolve) => {
        Alert.alert(
          "Bluetooth Access Needed",
          "knowyourpit needs Bluetooth to scan for nearby probes (Inkbird, Govee, Weber iGrill). Your location data is never stored or shared.",
          [{ text: "Continue", onPress: () => resolve() }],
        );
      });
      // Request BLUETOOTH_SCAN, BLUETOOTH_CONNECT, and ACCESS_FINE_LOCATION
      // together. ACCESS_FINE_LOCATION is required on API 31+ when scanning
      // for devices that have not been previously paired (neverForLocation
      // flag is not set in the manifest).
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
  const [bluetoothAvailability, setBluetoothAvailability] =
    useState<BleAvailability>("initializing");
  const [reconnectBanner, setReconnectBanner] = useState<ReconnectBanner | null>(null);
  const [reconnecting, setReconnecting] = useState(false);

  const managerRef = useRef<any>(null);
  const deviceMapRef = useRef<Map<string, BleDevice>>(new Map());
  const pairedIdsRef = useRef<Set<string>>(new Set());
  const prevConnectedRef = useRef<Set<string>>(new Set());
  const wasDroppedRef = useRef<Set<string>>(new Set());
  const hasActiveCookRef = useRef(false);
  const permissionDeniedRef = useRef(false);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const gattPollTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());
  const mountedRef = useRef(true);
  // Tracks per-device GATT reconnect timers (Weber iGrill)
  const gattReconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  /** Rolling RSSI buffer per device (keyed by device ID). Shared for all probe sources. */
  const rssiBuffersRef = useRef<Map<string, number[]>>(new Map());
  // Set to true when the stale-timer watchdog triggers a scan restart for a
  // silent paired advertisement-based device (Govee / Inkbird in BleProbeContext).
  const scanningForLostAdvDeviceRef = useRef(false);
  /**
   * Timestamp of the last BLE advertisement received during recovery scanning.
   * Initialised to Date.now() when recovery mode is first entered; updated on
   * every advertisement in the scan callback; reset to 0 when recovery mode
   * ends. Never written by startScan() — only actual advertisements and the
   * recovery-mode state machine update it, so silence accumulates across
   * consecutive 15 s scan windows rather than resetting at every restart.
   */
  const lastScanAdvertisementAtRef = useRef<number>(0);
  /**
   * Persistent recovery-mode indicator. True while a paired advertisement-based
   * device is missing during an active cook. Unlike scanningForLostAdvDeviceRef
   * (which is cleared in stopScan every 15 s), this ref survives scan-window
   * boundaries so the silence watchdog can accumulate silence across them.
   */
  const inRecoveryModeRef = useRef(false);
  /**
   * Prevents the scan silence watchdog from triggering overlapping startScan()
   * calls if the stale timer fires while a restart is already in progress.
   */
  const scanSilenceRestartingRef = useRef(false);

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
        channelTempsF: null,
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

  const markPermDenied = useCallback(async () => {
    permissionDeniedRef.current = true;
    if (mountedRef.current) setPermissionDenied(true);
    if (mountedRef.current) setBluetoothAvailability("permissionDenied");

    // Stop any active scan immediately so stale nearby devices stop showing.
    if (scanTimerRef.current) {
      clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    try { managerRef.current?.stopDeviceScan(); } catch {}
    if (mountedRef.current) setScanning(false);

    // Remove non-paired advertisement-based devices from the map — we cannot
    // scan for them anymore, so there is no point keeping them visible.
    let changed = false;
    for (const [id, d] of deviceMapRef.current) {
      if (
        !pairedIdsRef.current.has(id) &&
        (d.adapter === "govee" || d.adapter === "inkbird")
      ) {
        deviceMapRef.current.delete(id);
        changed = true;
      }
    }
    if (changed && mountedRef.current) flushDevices();

    try {
      await AsyncStorage.setItem(PERM_DENIED_KEY, "1");
    } catch {}
  }, [flushDevices]);

  const clearPermDenied = useCallback(async () => {
    permissionDeniedRef.current = false;
    if (mountedRef.current) setPermissionDenied(false);
    try {
      await AsyncStorage.removeItem(PERM_DENIED_KEY);
    } catch {}
  }, []);

  const readLiveBleState = useCallback(async (manager: any): Promise<string> => {
    try {
      const currentState = await manager.state();
      if (currentState !== "Unknown" && currentState !== "Resetting") {
        return currentState;
      }
    } catch {}

    return new Promise<string>((resolve) => {
      let settled = false;
      let subscription: any = null;
      const finish = (state: string) => {
        if (settled) return;
        settled = true;
        try { subscription?.remove?.(); } catch {}
        resolve(state);
      };
      subscription = manager.onStateChange((state: string) => {
        if (state !== "Unknown" && state !== "Resetting") finish(state);
      }, true);
      if (settled) {
        try { subscription?.remove?.(); } catch {}
      }
      setTimeout(() => finish("Unknown"), 1500);
    });
  }, []);

  /**
   * Saved denial state is only a hint. Every iOS foreground and scan request
   * reconciles it with the live manager before showing a blocking message.
   */
  const reconcileBleAvailability = useCallback(async (): Promise<BleAvailability> => {
    if (Platform.OS === "web") return "initializing";
    try {
      if (Platform.OS === "ios") {
        const { BleManager } = await import("react-native-ble-plx");
        const mgr: any = managerRef.current ?? new BleManager();
        const ownedMgr = !managerRef.current;
        const bleState = await readLiveBleState(mgr);
        if (ownedMgr) {
          try { mgr.destroy(); } catch {}
        }
        const availability = getBleAvailability(bleState);
        if (mountedRef.current) setBluetoothAvailability(availability);
        if (availability === "permissionDenied") {
          await markPermDenied();
        } else if (shouldClearSavedPermissionWarning(bleState)) {
          await clearPermDenied();
        }
        return availability;
      } else if (Platform.OS === "android") {
        const { PermissionsAndroid } = await import("react-native");
        let granted: boolean;
        if ((Platform.Version as number) >= 31) {
          const results = await Promise.all([
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN),
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT),
            PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION),
          ]);
          granted = results.every(Boolean);
        } else {
          granted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          );
        }
        if (granted) {
          await clearPermDenied();
        }
      }
    } catch {}
    return "initializing";
  }, [clearPermDenied, markPermDenied, readLiveBleState]);

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
      deviceMapRef.current.delete(deviceId);
      flushDevices();
      savePairedIds();
    },
    [flushDevices, savePairedIds],
  );

  /** Read the latest temps/battery from an already-connected GATT device. */
  const readGattCharacteristics = useCallback(
    async (connected: any, deviceId: string, adapter: BleAdapterKey) => {
      if (!mountedRef.current) return "blocked";
      const now = Date.now();
      if (adapter === "weber_igrill") {
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

      // Clear any pending GATT reconnect timer — we're actively connecting now
      const pendingReconnect = gattReconnectTimersRef.current.get(deviceId);
      if (pendingReconnect) {
        clearTimeout(pendingReconnect);
        gattReconnectTimersRef.current.delete(deviceId);
        if (mountedRef.current) {
          setReconnecting(
            gattReconnectTimersRef.current.size > 0 || scanningForLostAdvDeviceRef.current,
          );
        }
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
        if (!mountedRef.current) return "blocked";

        await connected.discoverAllServicesAndCharacteristics();
        if (!mountedRef.current) return "blocked";

        upsertDevice(deviceId, {
          name: connected.name ?? deviceMapRef.current.get(deviceId)?.name ?? "Device",
          adapter,
          connectionState: "connected",
        });

        // Explicitly recompute reconnecting: the 30 s retry timer deletes its
        // own map entry *before* calling connectGatt, so the "clear pending
        // timer" block at the top of this function will find no entry and skip
        // setReconnecting.  Calling it here ensures the state is correct
        // regardless of whether this is an initial connect or a retry.
        if (mountedRef.current) {
          setReconnecting(
            gattReconnectTimersRef.current.size > 0 || scanningForLostAdvDeviceRef.current,
          );
        }

        // Initial read immediately after connect
        await readGattCharacteristics(connected, deviceId, adapter);

        // Periodic polling — keeps readings live without requiring GATT notifications
        const pollTimer = setInterval(async () => {
          if (!mountedRef.current) return;
          const current = deviceMapRef.current.get(deviceId);
          if (current?.connectionState !== "connected") return;
          await readGattCharacteristics(connected, deviceId, adapter);
          // Poll RSSI for GATT devices (Weber iGrill) and fold into the
          // rolling buffer so the weak-signal chip works for tethered probes.
          try {
            const devWithRssi = await connected.readRSSI();
            const rssi = (devWithRssi?.rssi as number | null | undefined) ?? null;
            if (rssi != null && mountedRef.current) {
              const buf = rssiBuffersRef.current.get(deviceId) ?? [];
              buf.push(rssi);
              if (buf.length > RSSI_BUFFER_SIZE) buf.splice(0, buf.length - RSSI_BUFFER_SIZE);
              rssiBuffersRef.current.set(deviceId, buf);
              const rssiAvg = buf.reduce((a, b) => a + b, 0) / buf.length;
              const d = deviceMapRef.current.get(deviceId);
              if (d) {
                const signalWeak = deriveSignalWeak(rssiAvg, d.signalWeak ?? false);
                deviceMapRef.current.set(deviceId, { ...d, rssi, rssiAvg, signalWeak });
                flushDevices();
              }
            }
          } catch {
            // readRSSI not supported on all platforms / adapters — ignore
          }
        }, GATT_POLL_MS);
        gattPollTimersRef.current.set(deviceId, pollTimer);

        connected.onDisconnected(() => {
          const t = gattPollTimersRef.current.get(deviceId);
          if (t) { clearInterval(t); gattPollTimersRef.current.delete(deviceId); }
          if (!mountedRef.current) return;

          // Route through upsertDevice so checkReconnect fires correctly:
          // this triggers haptic feedback, marks wasDropped, and removes from
          // prevConnected — allowing the reconnect banner to fire later.
          const d = deviceMapRef.current.get(deviceId);
          if (d) {
            upsertDevice(deviceId, { name: d.name, adapter, connectionState: "disconnected" });
          }

          // Auto-reconnect loop: while a cook is active and the device is
          // paired, schedule a retry every 30 s until the probe comes back.
          if (hasActiveCookRef.current && pairedIdsRef.current.has(deviceId)) {
            const reconnectTimer = setTimeout(() => {
              gattReconnectTimersRef.current.delete(deviceId);
              if (!mountedRef.current || !managerRef.current || !hasActiveCookRef.current) {
                if (mountedRef.current) {
                  setReconnecting(
                    gattReconnectTimersRef.current.size > 0 || scanningForLostAdvDeviceRef.current,
                  );
                }
                return;
              }
              connectGatt(managerRef.current, deviceId, adapter);
            }, 30_000);
            gattReconnectTimersRef.current.set(deviceId, reconnectTimer);
            if (mountedRef.current) setReconnecting(true);
          }
        });
      } catch {
        const d = deviceMapRef.current.get(deviceId);
        if (d) {
          deviceMapRef.current.set(deviceId, { ...d, connectionState: "disconnected" });
          flushDevices();
        }
        // If the connection attempt itself fails during an active cook, schedule
        // a retry so we keep trying until the probe comes back into range.
        if (hasActiveCookRef.current && pairedIdsRef.current.has(deviceId) && mountedRef.current) {
          const reconnectTimer = setTimeout(() => {
            gattReconnectTimersRef.current.delete(deviceId);
            if (!mountedRef.current || !managerRef.current || !hasActiveCookRef.current) {
              if (mountedRef.current) {
                setReconnecting(
                  gattReconnectTimersRef.current.size > 0 || scanningForLostAdvDeviceRef.current,
                );
              }
              return;
            }
            connectGatt(managerRef.current, deviceId, adapter);
          }, 30_000);
          gattReconnectTimersRef.current.set(deviceId, reconnectTimer);
          if (mountedRef.current) setReconnecting(true);
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

    // Mark advertisement-based devices (govee, inkbird) as disconnected if they
    // haven't been seen recently — they only exist while actively advertising,
    // so a scan ending means we can no longer confirm they're present.
    const now = Date.now();
    let changed = false;
    for (const [id, d] of deviceMapRef.current) {
      if (
        (d.adapter === "govee" || d.adapter === "inkbird") &&
        d.connectionState !== "disconnected" &&
        now - d.lastSeenMs > STALE_DEVICE_MS
      ) {
        deviceMapRef.current.set(id, { ...d, connectionState: "disconnected" });
        changed = true;
      }
    }
    if (changed && mountedRef.current) {
      setDevices(Array.from(deviceMapRef.current.values()));
    }

    // Clear advertisement watchdog flag — the scan is ending, so we're no
    // longer actively hunting for a lost paired device.
    if (scanningForLostAdvDeviceRef.current) {
      scanningForLostAdvDeviceRef.current = false;
      if (mountedRef.current) {
        setReconnecting(gattReconnectTimersRef.current.size > 0);
      }
    }

    // Clear the scan silence restarting guard so the next watchdog check can
    // trigger a restart if needed. Do NOT reset lastScanAdvertisementAtRef —
    // it must persist across scan windows so the watchdog can measure total
    // silence time, not just silence within a single 15 s window.
    scanSilenceRestartingRef.current = false;

    if (mountedRef.current) setScanning(false);
  }, []);

  const startScan = useCallback(async (): Promise<BleScanStartResult> => {
    if (Platform.OS === "web") return "blocked";
    if (!mountedRef.current) return "blocked";

    try {
      const { BleManager } = await import("react-native-ble-plx");
      if (!mountedRef.current) return "blocked";

      if (Platform.OS === "android") {
        const granted = await requestBlePermissionsAndroid();
        if (!mountedRef.current) return "blocked";
        if (!granted) {
          await markPermDenied();
          return "blocked";
        }
      }

      if (!managerRef.current) {
        managerRef.current = new BleManager();
      }

      if (Platform.OS === "ios") {
        if (!mountedRef.current) return "blocked";
        const availability = await reconcileBleAvailability();
        if (
          availability === "permissionDenied" ||
          availability === "poweredOff" ||
          availability === "unsupported"
        ) {
          return "blocked";
        }
      }

      setScanning(true);

      managerRef.current.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error: any, device: any) => {
          if (!mountedRef.current) return;
          if (error) {
            // Detect iOS Bluetooth unauthorized errors (errorCode 102 =
            // BLEError.BluetoothUnauthorized in react-native-ble-plx).
            if (Platform.OS === "ios") {
              const code = error?.errorCode ?? error?.code;
              const reason = String(error?.reason ?? error?.message ?? "").toLowerCase();
              if (code === 102 || reason.includes("unauthorized") || reason.includes("not authorized")) {
                markPermDenied();
              } else if (reason.includes("powered off")) {
                setBluetoothAvailability("poweredOff");
                stopScan();
              } else if (reason.includes("unsupported")) {
                setBluetoothAvailability("unsupported");
                stopScan();
              }
            }
            return;
          }
          if (!device) return;

          const adapter = detectAdapter(device);
          if (!adapter) return;

          const deviceName =
            (device.name ?? device.localName ?? ADAPTER_LABELS[adapter]) as string;
          const now = Date.now();

          // Reset the scan silence watchdog on every valid advertisement so it
          // only fires during genuine scan silence, not between normal packets.
          lastScanAdvertisementAtRef.current = now;

          const deviceRssi = (device.rssi as number | null | undefined) ?? null;

          // Update rolling RSSI buffer and derive weak-signal flag for this device.
          const rssiBuf = rssiBuffersRef.current.get(device.id as string) ?? [];
          if (deviceRssi != null) {
            rssiBuf.push(deviceRssi);
            if (rssiBuf.length > RSSI_BUFFER_SIZE) rssiBuf.splice(0, rssiBuf.length - RSSI_BUFFER_SIZE);
            rssiBuffersRef.current.set(device.id as string, rssiBuf);
          }
          const deviceRssiAvg = rssiBuf.length > 0
            ? rssiBuf.reduce((a, b) => a + b, 0) / rssiBuf.length
            : null;
          const deviceSignalWeak = deriveSignalWeak(
            deviceRssiAvg,
            deviceMapRef.current.get(device.id as string)?.signalWeak ?? false,
          );

          if (adapter === RFX_ADAPTER) {
            // RFX discovery is useful for guidance, but RFX readings are
            // account/cloud-based and do not have a supported BLE GATT path.
            // Keep it in the registry so Connected Devices can explain the
            // next step instead of silently dropping the advertisement.
            upsertDevice(device.id, {
              name: deviceName,
              adapter,
              connectionState: "unsupported",
              lastSeenMs: now,
              rssi: deviceRssi,
              rssiAvg: deviceRssiAvg,
              signalWeak: deviceSignalWeak,
            });
          } else if (GATT_ADAPTERS.includes(adapter)) {
            const existing = deviceMapRef.current.get(device.id);
            if (!existing || existing.connectionState === "disconnected") {
              upsertDevice(device.id, {
                name: deviceName,
                adapter,
                connectionState: "scanning",
                lastSeenMs: now,
                rssi: deviceRssi,
                rssiAvg: deviceRssiAvg,
                signalWeak: deviceSignalWeak,
              });
              if (pairedIdsRef.current.has(device.id)) {
                connectGatt(managerRef.current, device.id, adapter);
              }
            } else {
              deviceMapRef.current.set(device.id, {
                ...existing,
                lastSeenMs: now,
                rssi: deviceRssi,
                rssiAvg: deviceRssiAvg,
                signalWeak: deviceSignalWeak,
              });
              flushDevices();
            }
          } else {
            let probeTempF: number | null = null;
            let ambientTempF: number | null = null;
            let batteryPct: number | null = null;
            let channelTempsF: number[] | null = null;

            if (adapter === "govee") {
              const reading = decodeGoveeAdvertisement(device.manufacturerData ?? null);
              probeTempF = reading.probeTempF;
              batteryPct = reading.batteryPct;
            } else if (adapter === "inkbird") {
              const deviceName =
                (device.name ?? device.localName ?? ADAPTER_LABELS[adapter]) as string;
              const parsed = parseInkbirdTemps(device.manufacturerData ?? null, deviceName);
              if (parsed.temps.length > 0) {
                channelTempsF = parsed.temps;
                probeTempF = parsed.temps[0] ?? null;
              }
              batteryPct = parsed.batteryPct;
            }

            upsertDevice(device.id, {
              name: deviceName,
              adapter,
              connectionState: adapter === "inkbird" || probeTempF != null ? "connected" : "scanning",
              probeTempF,
              ambientTempF,
              batteryPct,
              channelTempsF,
              lastSeenMs: now,
              rssi: deviceRssi,
              rssiAvg: deviceRssiAvg,
              signalWeak: deviceSignalWeak,
            });
          }
        },
      );

      // Clear any existing stop timer before scheduling a new one — rapid
      // restarts (e.g. from the silence watchdog) could leave a stale timer
      // that would prematurely end the fresh scan.
      if (scanTimerRef.current) {
        clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      scanTimerRef.current = setTimeout(stopScan, SCAN_DURATION_MS);
      return "started";
    } catch {
      if (mountedRef.current) setScanning(false);
      return "blocked";
    }
  }, [upsertDevice, flushDevices, connectGatt, stopScan, markPermDenied, reconcileBleAvailability]);

  useEffect(() => {
    mountedRef.current = true;

    // A stored denial is never shown by itself. Verify current iOS state first,
    // otherwise a permission fixed in Settings can remain falsely blocking.
    loadPairedIds();
    reconcileBleAvailability();

    if (Platform.OS !== "web") {
      staleTimerRef.current = setInterval(() => {
        const now = Date.now();
        let changed = false;
        // True when a paired advertisement device has been silent for ADV_WATCHDOG_MS
        // and warrants a scan restart.
        let hasMissingPairedAdvDevice = false;

        for (const [id, d] of deviceMapRef.current) {
          const isAdvAdapter = d.adapter === "govee" || d.adapter === "inkbird";

          if (isAdvAdapter) {
            // Advertisement-based devices are only visible during an active scan.
            // Check staleness regardless of current connectionState — a device
            // can be left as "connected" after a scan window even though it has
            // since gone silent (this was the original bug: the old
            // `connectionState !== "connected"` guard skipped these devices).
            if (now - d.lastSeenMs > STALE_DEVICE_MS) {
              if (d.paired) {
                // Keep paired ad-devices in the map so the watchdog can continue
                // tracking them; mark disconnected to reflect the signal loss.
                if (d.connectionState !== "disconnected") {
                  // Route through upsertDevice so checkReconnect fires, updating
                  // wasDroppedRef and prevConnectedRef — this is required for the
                  // reconnect-banner to fire when the device is rediscovered.
                  upsertDevice(id, { name: d.name, adapter: d.adapter, connectionState: "disconnected" });
                  // upsertDevice already calls flushDevices; set changed so the
                  // outer flush is still accurate for other branches in this tick.
                  changed = true;
                }
                // Trigger a scan restart only after ADV_WATCHDOG_MS (60 s) of
                // silence, giving the device a chance to reappear naturally before
                // we restart the scan.
                if (now - d.lastSeenMs > ADV_WATCHDOG_MS) {
                  hasMissingPairedAdvDevice = true;
                }
              } else {
                // Non-paired stale advertisement device → remove from the map.
                deviceMapRef.current.delete(id);
                changed = true;
              }
            }
          } else {
            // GATT / unknown adapters: original behaviour — remove if stale and
            // not currently GATT-connected (GATT state is managed by onDisconnected).
            if (d.connectionState !== "connected" && now - d.lastSeenMs > STALE_DEVICE_MS) {
              deviceMapRef.current.delete(id);
              changed = true;
            }
          }
        }

        if (changed && mountedRef.current) flushDevices();

        // Recovery-mode state machine.
        //
        // inRecoveryModeRef persists across stopScan() calls (unlike
        // scanningForLostAdvDeviceRef which is cleared every 15 s) so the
        // silence watchdog can accumulate silence across consecutive scan windows.
        //
        // Entering recovery mode: initialise the silence timestamp once so it
        // represents "how long since we last heard any advertisement."
        // Leaving recovery mode: reset both refs so the watchdog won't re-fire.
        if (hasMissingPairedAdvDevice && hasActiveCookRef.current) {
          if (!inRecoveryModeRef.current) {
            inRecoveryModeRef.current = true;
            // Treat "now" as the start of measured silence so the watchdog fires
            // after a genuine 60 s window with no advertisements, not immediately.
            if (lastScanAdvertisementAtRef.current === 0) {
              lastScanAdvertisementAtRef.current = now;
            }
          }
        } else if (inRecoveryModeRef.current) {
          // Device found or cook ended — exit recovery mode.
          inRecoveryModeRef.current = false;
          lastScanAdvertisementAtRef.current = 0;
        }

        // Advertisement watchdog: if an active cook is running and a paired
        // advertisement-based device has gone silent for > ADV_WATCHDOG_MS,
        // restart the scan to rediscover it.
        if (hasMissingPairedAdvDevice && hasActiveCookRef.current && !scanningForLostAdvDeviceRef.current) {
          scanningForLostAdvDeviceRef.current = true;
          if (mountedRef.current) setReconnecting(true);
          startScan();
        }

        // Scan silence watchdog — active only during recovery mode.
        //
        // BleProbeContext scan windows are 15 s (SCAN_DURATION_MS), so a 60 s
        // silence threshold cannot be reached within a single window. Instead
        // this watchdog measures silence across consecutive windows: the adv
        // watchdog above calls startScan() every ~15 s, and each scan restart
        // does NOT update lastScanAdvertisementAtRef (only real advertisements
        // do). If iOS kills the underlying scan, silence accumulates across
        // windows until 60 s is reached and this path fires.
        //
        // Independent of the advertisement watchdog — each path guards itself
        // with its own persistent ref (scanningForLostAdvDeviceRef and
        // scanSilenceRestartingRef respectively) and they can both fire in the
        // same tick if needed (a second startScan() call safely replaces the
        // existing scan timer).
        if (
          inRecoveryModeRef.current &&
          !scanSilenceRestartingRef.current &&
          lastScanAdvertisementAtRef.current > 0 &&
          now - lastScanAdvertisementAtRef.current > ADV_WATCHDOG_MS
        ) {
          scanSilenceRestartingRef.current = true;
          if (__DEV__) {
            console.warn("[BleProbeContext] No BLE advertisements for 60 s during recovery — restarting scan");
          }
          startScan().finally(() => {
            if (mountedRef.current) scanSilenceRestartingRef.current = false;
          });
        }
      }, 15_000);

      // When the app foregrounds:
      //  1. Reconcile the persisted warning with the current iOS state.
      //  2. Attempt to reconnect already-paired GATT devices that are currently
      //     disconnected — no full BLE scan.
      const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
        if (state === "active" && mountedRef.current) {
          reconcileBleAvailability();
          if (managerRef.current) {
            for (const id of pairedIdsRef.current) {
              const d = deviceMapRef.current.get(id);
              if (d && GATT_ADAPTERS.includes(d.adapter) && d.connectionState === "disconnected") {
                connectGatt(managerRef.current, id, d.adapter);
              }
            }
          }
        }
      });

      return () => {
        mountedRef.current = false;
        sub.remove();
        stopScan();
        if (staleTimerRef.current) clearInterval(staleTimerRef.current);
        for (const t of gattPollTimersRef.current.values()) clearInterval(t);
        gattPollTimersRef.current.clear();
        for (const t of gattReconnectTimersRef.current.values()) clearTimeout(t);
        gattReconnectTimersRef.current.clear();
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
      for (const t of gattReconnectTimersRef.current.values()) clearTimeout(t);
      gattReconnectTimersRef.current.clear();
      try {
        managerRef.current?.destroy();
      } catch {}
    };
  }, [loadPairedIds, reconcileBleAvailability, connectGatt, stopScan, flushDevices, startScan]);

  const dismissReconnectBanner = useCallback(() => {
    setReconnectBanner(null);
  }, []);

  const setHasActiveCook = useCallback((val: boolean) => {
    hasActiveCookRef.current = val;
    if (!val) {
      // Cook ended — cancel all pending GATT reconnect timers and clear both
      // the advertisement watchdog flag and the persistent recovery-mode state
      // so we stop trying to recover probes after the cook is done.
      for (const timer of gattReconnectTimersRef.current.values()) {
        clearTimeout(timer);
      }
      gattReconnectTimersRef.current.clear();
      scanningForLostAdvDeviceRef.current = false;
      inRecoveryModeRef.current = false;
      lastScanAdvertisementAtRef.current = 0;
      scanSilenceRestartingRef.current = false;
      if (mountedRef.current) setReconnecting(false);
    }
  }, []);

  return (
    <BleProbeContext.Provider
      value={{
        devices,
        scanning,
        permissionDenied,
        bluetoothAvailability,
        reconnectBanner,
        dismissReconnectBanner,
        startScan,
        stopScan,
        pairDevice,
        unpairDevice,
        setHasActiveCook,
        reconnecting,
      }}
    >
      {children}
    </BleProbeContext.Provider>
  );
}
