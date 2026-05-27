import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { ADAPTER_LABELS, detectAdapter } from "@/hooks/ble/adapters";

interface RawBleDevice {
  id: string;
  name: string | null;
  rssi: number | null;
  adapter: string;
  manufacturerDataHex: string | null;
  lastSeenMs: number;
}

function base64ToHex(b64: string | null | undefined): string | null {
  if (!b64) return null;
  try {
    const str = atob(b64);
    return Array.from(str, (c) =>
      c.charCodeAt(0).toString(16).padStart(2, "0"),
    )
      .join(" ")
      .toUpperCase();
  } catch {
    return null;
  }
}

async function requestBlePermissionsAndroid(): Promise<boolean> {
  const { PermissionsAndroid } = await import("react-native");
  try {
    if ((Platform.Version as number) >= 31) {
      const results = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return Object.values(results).every(
        (r) => r === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: "Bluetooth Permission",
        message:
          "knowyourpit needs Bluetooth and location access to scan for nearby thermometers.",
        buttonPositive: "Allow",
      },
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch {
    return false;
  }
}

function RssiBar({ rssi }: { rssi: number | null }) {
  const colors = useColors();
  if (rssi == null) return <Text style={[s.rssiText, { color: colors.mutedForeground }]}>—</Text>;
  const color = rssi > -60 ? "#22c55e" : rssi > -80 ? "#EAB308" : "#ef4444";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <Feather name="radio" size={11} color={color} />
      <Text style={[s.rssiText, { color }]}>{rssi} dBm</Text>
    </View>
  );
}

function DeviceRow({ device, colors }: { device: RawBleDevice; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  const adapterLabel =
    device.adapter in ADAPTER_LABELS
      ? ADAPTER_LABELS[device.adapter as keyof typeof ADAPTER_LABELS]
      : "Unknown";
  const isKnown = device.adapter !== "unknown";
  const age = Math.round((Date.now() - device.lastSeenMs) / 1000);

  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      style={[
        s.deviceRow,
        {
          backgroundColor: colors.card,
          borderColor: isKnown ? "#3B82F640" : colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={s.deviceRowHeader}>
        <View
          style={[
            s.adapterIcon,
            { backgroundColor: isKnown ? "#3B82F620" : colors.border + "60" },
          ]}
        >
          <Feather
            name="bluetooth"
            size={15}
            color={isKnown ? "#3B82F6" : colors.mutedForeground}
          />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={[s.deviceName, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {device.name ?? "(no name)"}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <View
              style={[
                s.adapterBadge,
                {
                  backgroundColor: isKnown ? "#3B82F615" : colors.border + "40",
                },
              ]}
            >
              <Text
                style={[
                  s.adapterBadgeText,
                  { color: isKnown ? "#3B82F6" : colors.mutedForeground },
                ]}
              >
                {adapterLabel}
              </Text>
            </View>
            <RssiBar rssi={device.rssi} />
            <Text style={[s.ageText, { color: colors.mutedForeground }]}>
              {age < 2 ? "just now" : `${age}s ago`}
            </Text>
          </View>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={14}
          color={colors.mutedForeground}
        />
      </View>

      {expanded && (
        <View style={[s.expandedBody, { borderTopColor: colors.border }]}>
          <Text style={[s.expandedLabel, { color: colors.mutedForeground }]}>
            Device ID
          </Text>
          <Text
            style={[s.expandedValue, { color: colors.foreground }]}
            selectable
          >
            {device.id}
          </Text>
          <Text style={[s.expandedLabel, { color: colors.mutedForeground }]}>
            Manufacturer Data (hex)
          </Text>
          <Text
            style={[
              s.expandedValue,
              {
                color: device.manufacturerDataHex
                  ? colors.foreground
                  : colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
            selectable
          >
            {device.manufacturerDataHex ?? "none"}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const FAQ_ITEMS = [
  {
    icon: "x-circle" as const,
    title: "Close the manufacturer app before scanning",
    body: "Inkbird, MEATER, and Govee apps can lock the BLE connection, making the device invisible to other apps. Force-quit the manufacturer app and try again.",
  },
  {
    icon: "zap" as const,
    title: "Power on the thermometer",
    body: "Make sure the probe or display unit is powered on and within about 10 metres of your phone. BLE signals don't penetrate thick metal well — keep the phone in the same room.",
  },
  {
    icon: "bluetooth" as const,
    title: "Ensure your phone's Bluetooth is on",
    body: "Check Control Center (iOS) or Quick Settings (Android). If Bluetooth was toggled off recently, toggle it back on and tap Scan again.",
  },
  {
    icon: "wifi" as const,
    title: "Wi-Fi probes need the same network",
    body: "MEATER Block, Fireboard, and ThermoWorks Signals connect over Wi-Fi, not Bluetooth. They appear in the Connected Devices screen only when your phone and the probe are on the same Wi-Fi network.",
  },
  {
    icon: "settings" as const,
    title: "Grant Bluetooth permission in Settings",
    body: "If the app was denied Bluetooth access, iOS and Android won't prompt again automatically. Open Settings → knowyourpit → enable Bluetooth.",
  },
];

export default function BleDiagnosticsScreen() {
  const colors = useColors();
  const botPad = useBottomInset();

  const [devices, setDevices] = useState<Map<string, RawBleDevice>>(new Map());
  const [scanning, setScanning] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [scanCount, setScanCount] = useState(0);

  const deviceMapRef = useRef<Map<string, RawBleDevice>>(new Map());
  const managerRef = useRef<any>(null);
  const mountedRef = useRef(true);
  const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!mountedRef.current) return;
    setDevices(new Map(deviceMapRef.current));
  }, []);

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

    if (Platform.OS === "android") {
      const granted = await requestBlePermissionsAndroid();
      if (!mountedRef.current) return;
      if (!granted) {
        setPermissionDenied(true);
        return;
      }
    }

    try {
      const { BleManager } = await import("react-native-ble-plx");
      if (!mountedRef.current) return;

      if (!managerRef.current) {
        managerRef.current = new BleManager();
      }

      // iOS: check Bluetooth authorization state before starting the scan so
      // we surface the permission-denied banner instead of silently showing nothing.
      if (Platform.OS === "ios") {
        const bleState = await new Promise<string>((resolve) => {
          let settled = false;
          const sub = managerRef.current.onStateChange((state: string) => {
            if (state !== "Unknown" && state !== "Resetting") {
              if (!settled) {
                settled = true;
                try { sub?.remove?.(); } catch {}
                resolve(state);
              }
            }
          }, true);
          setTimeout(() => {
            if (!settled) {
              settled = true;
              try { sub?.remove?.(); } catch {}
              resolve("Unknown");
            }
          }, 3000);
        });
        if (!mountedRef.current) return;
        if (bleState === "Unauthorized") {
          setPermissionDenied(true);
          return;
        }
      }

      if (mountedRef.current) setScanning(true);
      if (mountedRef.current) setScanCount((n) => n + 1);

      managerRef.current.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error: any, device: any) => {
          if (!mountedRef.current) return;
          if (error) {
            if (Platform.OS === "ios") {
              const code = error?.errorCode ?? error?.code;
              const reason = String(error?.reason ?? error?.message ?? "").toLowerCase();
              if (code === 102 || reason.includes("unauthorized") || reason.includes("not authorized")) {
                setPermissionDenied(true);
                setScanning(false);
              }
            }
            return;
          }
          if (!device) return;

          const adapter = detectAdapter(device);
          const hex = base64ToHex(device.manufacturerData as string | null | undefined);

          const existing = deviceMapRef.current.get(device.id as string);
          deviceMapRef.current.set(device.id as string, {
            id: device.id as string,
            name:
              (device.name as string | null) ??
              (device.localName as string | null) ??
              existing?.name ??
              null,
            rssi: (device.rssi as number | null) ?? existing?.rssi ?? null,
            adapter: adapter ?? "unknown",
            manufacturerDataHex: hex ?? existing?.manufacturerDataHex ?? null,
            lastSeenMs: Date.now(),
          });

          flush();
        },
      );

      scanTimerRef.current = setTimeout(stopScan, 20_000);
    } catch {
      if (mountedRef.current) setScanning(false);
    }
  }, [flush, stopScan]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      stopScan();
      try {
        managerRef.current?.destroy();
      } catch {}
    };
  }, [stopScan]);

  const deviceList = Array.from(devices.values()).sort((a, b) => {
    const knownA = a.adapter !== "unknown" ? 0 : 1;
    const knownB = b.adapter !== "unknown" ? 0 : 1;
    if (knownA !== knownB) return knownA - knownB;
    return (b.rssi ?? -999) - (a.rssi ?? -999);
  });

  const knownCount = deviceList.filter((d) => d.adapter !== "unknown").length;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="BLE Diagnostics" showBack dark />

      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: botPad + 40,
          gap: 16,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            s.infoCard,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <Feather name="info" size={15} color={colors.mutedForeground} />
          <Text style={[s.infoText, { color: colors.mutedForeground }]}>
            Raw scan of every BLE device visible to your phone — not just
            thermometers. Use this to confirm your probe is advertising.
          </Text>
        </View>

        <Pressable
          onPress={scanning ? stopScan : startScan}
          style={[
            s.scanBtn,
            {
              backgroundColor: scanning ? colors.card : colors.primary,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {scanning ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Feather name="radio" size={15} color="#fff" />
          )}
          <Text
            style={[
              s.scanBtnText,
              { color: scanning ? colors.mutedForeground : "#fff" },
            ]}
          >
            {scanning ? "Scanning… (tap to stop)" : "Start Raw Scan"}
          </Text>
        </Pressable>

        {permissionDenied && (
          <View
            style={[
              s.permDeniedCard,
              {
                backgroundColor: "#ef444412",
                borderColor: "#ef444440",
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="alert-circle" size={18} color="#ef4444" />
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={s.permDeniedTitle}>Bluetooth access denied</Text>
              <Text style={[s.permDeniedBody, { color: colors.mutedForeground }]}>
                knowyourpit cannot scan for BLE devices without Bluetooth
                permission. Open Settings and enable Bluetooth access for
                knowyourpit to continue.
              </Text>
              <Pressable
                onPress={() => Linking.openSettings()}
                style={s.openSettingsBtn}
              >
                <Feather name="settings" size={13} color="#fff" />
                <Text style={s.openSettingsBtnText}>Open Settings</Text>
              </Pressable>
            </View>
          </View>
        )}

        {scanCount > 0 && (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>
                {deviceList.length === 0
                  ? "No devices found yet"
                  : `${deviceList.length} device${deviceList.length === 1 ? "" : "s"} found`}
                {knownCount > 0 && (
                  <Text style={{ color: "#3B82F6" }}>
                    {" "}· {knownCount} recognised
                  </Text>
                )}
              </Text>
            </View>

            {deviceList.length === 0 && !scanning && (
              <View
                style={[
                  s.emptyCard,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name="bluetooth" size={24} color={colors.mutedForeground} />
                <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                  Nothing found. Make sure Bluetooth is on and your thermometer
                  is powered on within ~10 m.
                </Text>
              </View>
            )}

            {deviceList.map((device) => (
              <DeviceRow key={device.id} device={device} colors={colors} />
            ))}
          </View>
        )}

        <View style={{ gap: 8, marginTop: 8 }}>
          <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>
            Troubleshooting
          </Text>
          {FAQ_ITEMS.map((item) => (
            <View
              key={item.title}
              style={[
                s.faqCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View
                style={[
                  s.faqIcon,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Feather name={item.icon} size={15} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[s.faqTitle, { color: colors.foreground }]}>
                  {item.title}
                </Text>
                <Text style={[s.faqBody, { color: colors.mutedForeground }]}>
                  {item.body}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  infoText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  scanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
  },
  scanBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  permDeniedCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  permDeniedTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ef4444",
  },
  permDeniedBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  openSettingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ef4444",
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    marginTop: 4,
  },
  openSettingsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  emptyCard: {
    alignItems: "center",
    gap: 10,
    padding: 28,
    borderWidth: 1,
  },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },
  deviceRow: {
    borderWidth: 1,
    overflow: "hidden",
  },
  deviceRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
  },
  adapterIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  adapterBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 99,
  },
  adapterBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  rssiText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  ageText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  expandedBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  expandedLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4, marginTop: 6 },
  expandedValue: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 17 },
  faqCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  faqIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  faqTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  faqBody: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
});
