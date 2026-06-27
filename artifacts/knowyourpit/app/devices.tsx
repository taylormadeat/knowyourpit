import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
  type AppStateStatus,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { usePaywall } from "@/contexts/PaywallContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { LockedFeatureCard } from "@/components/LockedFeatureCard";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { useBleProbes, type BleDevice } from "@/contexts/BleProbeContext";
import {
  useLanProbes,
  type LanDeviceStatus,
  type ManualDeviceType,
  MANUAL_DEVICE_LABELS,
} from "@/hooks/useLanProbes";
import { ADAPTER_LABELS } from "@/hooks/ble/adapters";
import {
  useGetMeaterStatus,
  getGetMeaterStatusQueryKey,
  useLinkMeater,
  useUnlinkMeater,
  useGetThermoworksStatus,
  getGetThermoworksStatusQueryKey,
  useLinkThermoworks,
  useUnlinkThermoworks,
  useSendThermoworksReset,
} from "@workspace/api-client-react";

const THERMOWORKS_COLOR = "#B22222";

const LAN_PERMISSION_KEY = "@knowyourpit/mdns/scan_explanation_shown";

function fmtLastSeen(lastSeenMs: number): string {
  const diffMs = Date.now() - lastSeenMs;
  if (diffMs < 60_000) return "just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ago`;
}

function BatteryBadge({ pct }: { pct: number }) {
  const color = pct > 50 ? "#22c55e" : pct > 20 ? "#EAB308" : "#ef4444";
  const icon: any = pct > 50 ? "battery" : pct > 20 ? "battery" : "battery";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: color + "20" }}>
      <Feather name="battery" size={10} color={color} />
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color }}>{pct}%</Text>
    </View>
  );
}

function ConnectionTypeBadge({ type }: { type: "ble" | "lan" }) {
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 3,
      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
      backgroundColor: type === "ble" ? "#3B82F620" : "#0EA5E920",
    }}>
      <Feather name={type === "ble" ? "bluetooth" : "wifi"} size={10} color={type === "ble" ? "#3B82F6" : "#0EA5E9"} />
      <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: type === "ble" ? "#3B82F6" : "#0EA5E9" }}>
        {type === "ble" ? "BLE" : "WiFi"}
      </Text>
    </View>
  );
}

function BleDeviceCard({ device, colors, onPair, onUnpair }: {
  device: BleDevice;
  colors: any;
  onPair: () => void;
  onUnpair: () => void;
}) {
  const isConnected = device.connectionState === "connected";
  const isConnecting = device.connectionState === "connecting";
  const isPaired = device.paired;
  const isOffline = isPaired && !isConnected && !isConnecting;

  const confirmRemove = () => {
    Alert.alert(
      "Remove Device",
      `Remove "${device.name}" from your paired devices? It will no longer appear in your device list.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onUnpair },
      ],
    );
  };

  return (
    <Pressable
      onLongPress={isOffline ? confirmRemove : undefined}
      delayLongPress={400}
      style={[s.deviceCard, { backgroundColor: colors.card, borderColor: isConnected ? "#22c55e40" : colors.border, borderRadius: colors.radius }]}
    >
      <View style={s.deviceRow}>
        <View style={[s.deviceIcon, { backgroundColor: "#3B82F620" }]}>
          <Feather name="bluetooth" size={20} color="#3B82F6" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[s.deviceName, { color: colors.foreground }]}>{device.name}</Text>
            <ConnectionTypeBadge type="ble" />
            {device.batteryPct != null && <BatteryBadge pct={device.batteryPct} />}
          </View>
          <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
            {ADAPTER_LABELS[device.adapter]}
            {isConnecting && " · Connecting…"}
            {isConnected && " · Connected"}
            {!isConnected && !isConnecting && ` · Last seen ${fmtLastSeen(device.lastSeenMs)}`}
          </Text>
        </View>
        {isConnecting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : isConnected ? (
          <View style={s.connectedBadge}>
            <Feather name="check-circle" size={13} color="#22c55e" />
            <Text style={s.connectedText}>Active</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99, backgroundColor: colors.border + "60" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.mutedForeground }} />
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>Offline</Text>
          </View>
        )}
      </View>

      {isConnected && (
        (device.channelTempsF && device.channelTempsF.length > 0) ||
        device.probeTempF != null ||
        device.ambientTempF != null
      ) && (
        <View style={[s.deviceList, { borderTopColor: colors.border, flexDirection: "row", gap: 12, flexWrap: "wrap" }]}>
          {device.channelTempsF && device.channelTempsF.length > 0 ? (
            device.channelTempsF.map((tempF, idx) => (
              <View key={idx} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name="thermometer" size={13} color="#FF6B2B" />
                <Text style={[s.probeName, { color: colors.foreground }]}>{tempF}°F</Text>
                <Text style={[s.deviceSub, { color: colors.mutedForeground, marginTop: 0 }]}>
                  {device.channelTempsF!.length > 1 ? `probe ${idx + 1}` : "probe"}
                </Text>
              </View>
            ))
          ) : (
            <>
              {device.probeTempF != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Feather name="thermometer" size={13} color="#FF6B2B" />
                  <Text style={[s.probeName, { color: colors.foreground }]}>{device.probeTempF}°F</Text>
                  <Text style={[s.deviceSub, { color: colors.mutedForeground, marginTop: 0 }]}>internal</Text>
                </View>
              )}
              {device.ambientTempF != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  <Feather name="wind" size={13} color="#3b82f6" />
                  <Text style={[s.probeName, { color: colors.foreground }]}>{device.ambientTempF}°F</Text>
                  <Text style={[s.deviceSub, { color: colors.mutedForeground, marginTop: 0 }]}>ambient</Text>
                </View>
              )}
            </>
          )}
        </View>
      )}

      <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
        {isPaired ? (
          <Pressable
            onPress={confirmRemove}
            style={[s.unlinkBtn, { borderColor: colors.border }]}
          >
            <Text style={s.unlinkText}>Unpair Device</Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={onPair}
            style={[s.linkBtn, { backgroundColor: "#3B82F6", marginTop: 0, marginHorizontal: 0 }]}
          >
            <Feather name="link" size={14} color="#fff" />
            <Text style={s.linkBtnText}>Pair Device</Text>
          </Pressable>
        )}
      </View>
      {isOffline && (
        <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", paddingBottom: 8, opacity: 0.6 }}>
          Hold to remove
        </Text>
      )}
    </Pressable>
  );
}

/** Returns true when the host string is an IPv4 or IPv6 address (mDNS-resolved). */
function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function LanDeviceCard({ device, colors, onRemove }: { device: LanDeviceStatus; colors: any; onRemove?: () => void }) {
  const autoDiscovered = isIpAddress(device.host);
  const isOfflineManual = device.isManual && !device.connected;

  const handleRemove = () => {
    Alert.alert(
      "Remove Device",
      `Remove ${device.deviceName} (${device.host}) from your device list?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: onRemove },
      ],
    );
  };

  return (
    <View style={[s.deviceCard, { backgroundColor: colors.card, borderColor: device.connected ? "#22c55e40" : (isOfflineManual ? "#EAB30840" : colors.border), borderRadius: colors.radius }]}>
      <View style={s.deviceRow}>
        <View style={[s.deviceIcon, { backgroundColor: "#0EA5E920" }]}>
          <Feather name="wifi" size={20} color="#0EA5E9" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[s.deviceName, { color: colors.foreground }]}>{device.deviceName}</Text>
            <ConnectionTypeBadge type="lan" />
            {autoDiscovered && !device.isManual && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 3,
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
                backgroundColor: "#a855f720",
              }}>
                <Feather name="zap" size={9} color="#a855f7" />
                <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: "#a855f7" }}>
                  Auto-discovered
                </Text>
              </View>
            )}
            {device.isManual && (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 3,
                paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
                backgroundColor: "#6b728020",
              }}>
                <Feather name="edit-2" size={9} color={colors.mutedForeground} />
                <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>
                  Manual
                </Text>
              </View>
            )}
          </View>
          <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
            {device.host}
            {device.connected && " · Connected"}
            {!device.connected && device.lastSeenMs != null && ` · Last seen ${fmtLastSeen(device.lastSeenMs)}`}
            {isOfflineManual && device.lastSeenMs == null && " · Not reachable"}
          </Text>
        </View>
        {device.connected ? (
          <View style={s.connectedBadge}>
            <Feather name="check-circle" size={13} color="#22c55e" />
            <Text style={s.connectedText}>Active</Text>
          </View>
        ) : isOfflineManual ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 99, backgroundColor: "#EAB30820" }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EAB308" }} />
            <Text style={{ fontSize: 10, fontFamily: "Inter_500Medium", color: "#EAB308" }}>Offline</Text>
          </View>
        ) : null}
      </View>

      {device.connected && device.probes.length > 0 && (
        <View style={[s.deviceList, { borderTopColor: colors.border }]}>
          {device.probes.map((probe) => (
            <View key={probe.deviceId} style={s.probeRow}>
              <Feather name="thermometer" size={13} color={colors.mutedForeground} />
              <Text style={[s.probeName, { color: colors.foreground }]}>{probe.channelLabel}</Text>
              <Text style={[s.probeName, { color: "#FF6B2B", flex: 0 }]}>{probe.probeTempF}°F</Text>
              {probe.ambientTempF != null && (
                <Text style={[s.deviceSub, { color: colors.mutedForeground, marginTop: 0 }]}>
                  · pit {probe.ambientTempF}°F
                </Text>
              )}
            </View>
          ))}
        </View>
      )}

      {onRemove && (
        <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
          <Pressable onPress={handleRemove} style={[s.unlinkBtn, { borderColor: colors.border }]}>
            <Text style={s.unlinkText}>Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function DevicesScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const botPad = useBottomInset();
  const effectivePro = useEffectivePro();
  const { showPaywall, parseAndShowFromError } = usePaywall();

  const { data: meaterStatus, isLoading: meaterLoading } = useGetMeaterStatus({
    query: {
      queryKey: getGetMeaterStatusQueryKey(),
      // Serve cached data on tab re-navigation so isLoading stays false and
      // the "Checking…" spinner never appears for a reconnect that already
      // resolved. Background refetch still fires silently after 60 s.
      staleTime: 60_000,
      placeholderData: keepPreviousData,
    },
  });
  const [meaterEmail, setMeaterEmail] = useState("");
  const [meaterPassword, setMeaterPassword] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [meaterLinkError, setMeaterLinkError] = useState<string | null>(null);
  const linkMeater = useLinkMeater({
    mutation: {
      onError: (e: any) => {
        if (parseAndShowFromError(e)) return;
        const isNetworkError = !e?.status;
        const isSessionError = e?.status === 401 && e?.data?.error === "Unauthorized";
        const message = isNetworkError
          ? "Could not reach the server. Please check your connection and try again."
          : isSessionError
            ? "Your session has expired — sign out and sign back in, then try again."
            : e?.data?.error ?? e?.message ?? "Could not link MEATER account. Check your credentials.";
        setMeaterLinkError(message);
      },
    },
  });
  const unlinkMeater = useUnlinkMeater();

  const invalidateMeaterStatus = () =>
    qc.invalidateQueries({ queryKey: getGetMeaterStatusQueryKey() });

  const { data: thermoworksStatus, isLoading: thermoworksLoading } = useGetThermoworksStatus({
    query: {
      queryKey: getGetThermoworksStatusQueryKey(),
      // Same staleTime / placeholderData contract as useGetMeaterStatus above.
      staleTime: 60_000,
      placeholderData: keepPreviousData,
    },
  });
  const linkThermoworks = useLinkThermoworks();
  const unlinkThermoworks = useUnlinkThermoworks();
  const sendThermoworksReset = useSendThermoworksReset();
  const [thermoworksEmail, setThermoworksEmail] = useState("");
  const [thermoworksPassword, setThermoworksPassword] = useState("");
  const [showThermoworksLinkForm, setShowThermoworksLinkForm] = useState(false);
  const [twResetSent, setTwResetSent] = useState(false);
  const [twResetError, setTwResetError] = useState<string | null>(null);
  const [twLinkError, setTwLinkError] = useState<string | null>(null);

  const invalidateThermoworksStatus = () =>
    qc.invalidateQueries({ queryKey: getGetThermoworksStatusQueryKey() });

  const {
    devices: bleDevices,
    scanning: bleScanning,
    permissionDenied: blePermDenied,
    startScan: startBleScan,
    pairDevice,
    unpairDevice,
  } = useBleProbes();

  const [lanScanEnabled, setLanScanEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(LAN_PERMISSION_KEY).then((val) => {
      setLanScanEnabled(val === "1");
    });
  }, []);

  const handleAllowLanScan = async () => {
    await AsyncStorage.setItem(LAN_PERMISSION_KEY, "1");
    setLanScanEnabled(true);
  };

  const lanHookEnabled =
    effectivePro &&
    (Platform.OS !== "ios" || lanScanEnabled === true);

  const {
    devices: lanDevices,
    scanning: lanScanning,
    mdnsAvailable,
    mdnsScanEmpty,
    scan: scanLan,
    addManualHost,
    removeManualHost,
  } = useLanProbes({ enabled: lanHookEnabled, pollIntervalMs: 30_000 });

  const [showAddManual, setShowAddManual] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [selectedDeviceType, setSelectedDeviceType] = useState<ManualDeviceType>("meater_block");

  const handleAddManual = useCallback(async () => {
    const trimmed = manualInput.trim();
    if (!trimmed) return;
    setAddingManual(true);
    try {
      await addManualHost(trimmed, selectedDeviceType);
      setManualInput("");
      setShowAddManual(false);
    } finally {
      setAddingManual(false);
    }
  }, [manualInput, selectedDeviceType, addManualHost]);

  const handleScan = useCallback(() => {
    if (!effectivePro) {
      showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" });
      return;
    }
    setUserScanning(true);
    startBleScan();
    // On iOS, only trigger the LAN scan once the user has acknowledged the
    // local-network permission card. On other platforms no gate is needed.
    if (Platform.OS !== "ios" || lanScanEnabled === true) {
      scanLan();
    }
  }, [effectivePro, showPaywall, startBleScan, scanLan, lanScanEnabled]);

  // Track whether the permission-denied notice ("No WiFi thermometers found /
  // Open Settings") was visible when the user last left the app.  When they
  // return to the foreground after visiting Settings we auto-rescan so they
  // don't have to tap "Scan for Devices" manually.
  const permNoticedWhenBackgroundedRef = useRef(false);

  useEffect(() => {
    if (Platform.OS !== "ios") return;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        // Returned to foreground — rescan if the permission-denied notice was
        // showing when the user left (lanScanEnabled true but mDNS found nothing).
        if (permNoticedWhenBackgroundedRef.current) {
          permNoticedWhenBackgroundedRef.current = false;
          scanLan();
        }
      } else if (nextState === "background" || nextState === "inactive") {
        // Record whether the "Open Settings" notice is currently visible.
        // Condition mirrors the render branch below:
        //   lanScanEnabled === true && mdnsAvailable && mdnsScanEmpty
        // Also covers the case where mdnsAvailable is still false (module not
        // yet loaded) while lanScanEnabled is true.
        permNoticedWhenBackgroundedRef.current =
          lanScanEnabled === true && (!mdnsAvailable || mdnsScanEmpty);
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, [lanScanEnabled, mdnsAvailable, mdnsScanEmpty, scanLan]);

  const isScanning = bleScanning || lanScanning;

  // Tracks whether *the user* initiated the current scan via "Scan for Devices".
  // Background polls (on mount, on interval) run silently — they should not
  // change the button label or disable the button until the user taps it.
  const [userScanning, setUserScanning] = useState(false);
  const prevIsScanningRef = useRef(false);
  useEffect(() => {
    if (prevIsScanningRef.current && !isScanning) {
      setUserScanning(false);
    }
    prevIsScanningRef.current = isScanning;
  }, [isScanning]);

  const handleLinkThermoworks = async () => {
    if (!thermoworksEmail.trim() || !thermoworksPassword.trim()) {
      Alert.alert("Required", "Enter your ThermoWorks Cloud email and password.");
      return;
    }
    try {
      await linkThermoworks.mutateAsync({
        data: { email: thermoworksEmail.trim(), password: thermoworksPassword },
      });
      setThermoworksEmail("");
      setThermoworksPassword("");
      setShowThermoworksLinkForm(false);
      invalidateThermoworksStatus();
    } catch (e: any) {
      if (parseAndShowFromError(e)) return;
      const isNetworkError = !e?.status;
      const isSessionError = e?.status === 401 && e?.data?.error === "Unauthorized";
      const message = isNetworkError
        ? "Could not reach the server. Please check your connection and try again."
        : isSessionError
          ? "Your session has expired — sign out and sign back in, then try again."
          : e?.data?.error ?? e?.message ?? "Could not link ThermoWorks account. Check your credentials.";
      setTwLinkError(message);
    }
  };

  const handleUnlinkThermoworks = () => {
    Alert.alert("Unlink ThermoWorks", "Remove your ThermoWorks Cloud connection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          try {
            await unlinkThermoworks.mutateAsync();
            setShowThermoworksLinkForm(false);
            invalidateThermoworksStatus();
          } catch {
            Alert.alert("Error", "Could not unlink. Please try again.");
          }
        },
      },
    ]);
  };

  const handleLinkMeater = async () => {
    if (!meaterEmail.trim() || !meaterPassword.trim()) {
      Alert.alert("Required", "Enter your MEATER email and password.");
      return;
    }
    setMeaterLinkError(null);
    try {
      await linkMeater.mutateAsync({
        data: { email: meaterEmail.trim(), password: meaterPassword },
      });
      setMeaterEmail("");
      setMeaterPassword("");
      setMeaterLinkError(null);
      setShowLinkForm(false);
      invalidateMeaterStatus();
    } catch {
      // Error is handled by the mutation's onError callback above
    }
  };

  const handleUnlinkMeater = () => {
    Alert.alert("Unlink MEATER", "Remove your MEATER account connection?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unlink",
        style: "destructive",
        onPress: async () => {
          try {
            await unlinkMeater.mutateAsync();
            setShowLinkForm(false);
            invalidateMeaterStatus();
          } catch {
            Alert.alert("Error", "Could not unlink. Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader
        title="Connected Devices"
        showBack
        dark
        right={
          <Pressable
            onPress={() => router.push("/ble-diagnostics" as any)}
            style={{ paddingHorizontal: 4, paddingVertical: 4, flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <Feather name="activity" size={15} color="#F3EDE1" style={{ opacity: 0.7 }} />
            <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: "#F3EDE1", opacity: 0.7 }}>
              Diagnostics
            </Text>
          </Pressable>
        }
      />

      <AppKeyboardAvoidingView style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Scan Button ── */}
          <Pressable
            onPress={handleScan}
            disabled={userScanning}
            style={[
              s.scanButton,
              { backgroundColor: userScanning ? colors.card : colors.primary, borderColor: colors.border },
            ]}
          >
            {userScanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="radio" size={15} color="#fff" />
            )}
            <Text style={[s.scanButtonText, { color: userScanning ? colors.mutedForeground : "#fff" }]}>
              {userScanning ? "Scanning…" : "Scan for Devices"}
            </Text>
            <Text style={[s.scanButtonSub, { color: userScanning ? colors.mutedForeground : "#ffffff99" }]}>
              BLE + local WiFi
            </Text>
          </Pressable>

          {/* ── Section: WiFi Devices ── */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="wifi" size={13} color={colors.mutedForeground} />
              <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>WiFi Devices</Text>
              {effectivePro && mdnsAvailable && (
                <View style={{
                  flexDirection: "row", alignItems: "center", gap: 3,
                  paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
                  backgroundColor: "#22c55e20",
                }}>
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#22c55e" }} />
                  <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: "#22c55e" }}>
                    mDNS
                  </Text>
                </View>
              )}
            </View>

            {!effectivePro ? (
              <LockedFeatureCard
                featureName="Local WiFi Thermometers"
                teaser="Connect Fireboard and MEATER Block base stations over your local network for live temps and auto PitMaster check-ins."
                icon="wifi"
                onPress={() => showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" })}
              />
            ) : Platform.OS === "ios" && lanScanEnabled === false ? (
              <View style={[s.lanPermCard, { backgroundColor: colors.card, borderColor: "#0EA5E940", borderRadius: colors.radius }]}>
                <View style={s.lanPermIconRow}>
                  <View style={[s.lanPermIconWrap, { backgroundColor: "#0EA5E920" }]}>
                    <Feather name="wifi" size={22} color="#0EA5E9" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.lanPermTitle, { color: colors.foreground }]}>Local Network Access</Text>
                    <Text style={[s.lanPermSub, { color: colors.mutedForeground }]}>Required for WiFi thermometer discovery</Text>
                  </View>
                </View>
                <Text style={[s.lanPermBody, { color: colors.mutedForeground }]}>
                  iOS will ask for permission to scan your local network. This lets knowyourpit automatically find Fireboard and MEATER Block base stations on your WiFi — no IP address needed.
                </Text>
                <Text style={[s.lanPermBody, { color: colors.mutedForeground, marginTop: 4 }]}>
                  Your network data never leaves your device. Tap{" "}
                  <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Allow</Text>{" "}
                  when iOS prompts you.
                </Text>
                <Pressable
                  onPress={handleAllowLanScan}
                  style={[s.lanPermBtn, { backgroundColor: "#0EA5E9" }]}
                >
                  <Feather name="wifi" size={15} color="#fff" />
                  <Text style={s.lanPermBtnText}>Scan My Network</Text>
                </Pressable>
              </View>
            ) : (
              <>
                {Platform.OS === "ios" && lanScanEnabled === true && mdnsAvailable && mdnsScanEmpty ? (
                  <View style={[s.emptyCard, { backgroundColor: "#EAB30812", borderColor: "#EAB30840", borderRadius: colors.radius }]}>
                    <Feather name="alert-triangle" size={16} color="#EAB308" />
                    <Text style={[s.emptyText, { color: colors.foreground }]}>
                      No WiFi thermometers found
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>
                      Make sure your MEATER Block or Fireboard base station is powered on and connected to the same WiFi network as your phone.
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground, marginTop: 4 }]}>
                      If Local Network permission was denied, you can re-enable it in Settings.
                    </Text>
                    <Pressable
                      onPress={() => Linking.openSettings()}
                      style={s.openSettingsBtn}
                    >
                      <Feather name="settings" size={14} color="#fff" />
                      <Text style={s.openSettingsBtnText}>Open Settings</Text>
                    </Pressable>
                  </View>
                ) : lanDevices.length === 0 ? (
                  <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
                    <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                      No WiFi thermometers found on your local network.
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>
                      {mdnsAvailable
                        ? "Auto-discovery (mDNS) is active — make sure your device is on the same WiFi network. Supported: Fireboard 2/Drive, MEATER Block base station"
                        : "Supported: Fireboard 2/Drive, MEATER Block base station"}
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground, marginTop: 4 }]}>
                      Using MEATER probes with the MEATER app? Link your MEATER account in the{" "}
                      <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>Cloud Integrations</Text>
                      {" "}section below to pull in live probe temperatures.
                    </Text>
                  </View>
                ) : (
                  lanDevices.map((device) => (
                    <LanDeviceCard
                      key={device.host}
                      device={device}
                      colors={colors}
                      onRemove={device.isManual ? () => removeManualHost(device.host) : undefined}
                    />
                  ))
                )}

                {/* ── Add device manually by IP ── */}
                {!showAddManual ? (
                  <Pressable
                    onPress={() => setShowAddManual(true)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, alignSelf: "flex-start" }}
                  >
                    <Feather name="plus-circle" size={13} color={colors.mutedForeground} />
                    <Text style={{ fontSize: 12, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                      Add device manually
                    </Text>
                  </Pressable>
                ) : (
                  <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, gap: 10 }]}>
                    <Text style={[s.emptyText, { color: colors.foreground, textAlign: "left" }]}>
                      Add device manually
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground, textAlign: "left" }]}>
                      Select the device type, then enter its IP address or hostname (e.g. 192.168.1.42 or fireboard.local).
                    </Text>

                    {/* Device type picker */}
                    <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
                      {(["meater_block", "fireboard"] as ManualDeviceType[]).map((type) => {
                        const isSelected = selectedDeviceType === type;
                        return (
                          <Pressable
                            key={type}
                            onPress={() => setSelectedDeviceType(type)}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 5,
                              borderRadius: 99,
                              borderWidth: 1,
                              borderColor: isSelected ? "#0EA5E9" : colors.border,
                              backgroundColor: isSelected ? "#0EA5E920" : "transparent",
                            }}
                          >
                            <Text style={{
                              fontSize: 12,
                              fontFamily: isSelected ? "Inter_600SemiBold" : "Inter_400Regular",
                              color: isSelected ? "#0EA5E9" : colors.mutedForeground,
                            }}>
                              {MANUAL_DEVICE_LABELS[type]}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>

                    <TextInput
                      value={manualInput}
                      onChangeText={setManualInput}
                      placeholder="192.168.1.42 or device.local"
                      placeholderTextColor={colors.mutedForeground}
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardType="url"
                      returnKeyType="done"
                      onSubmitEditing={handleAddManual}
                      style={[s.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.background }]}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Pressable
                        onPress={() => { setShowAddManual(false); setManualInput(""); }}
                        style={[s.cancelBtn, { borderColor: colors.border, flex: 1 }]}
                      >
                        <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={handleAddManual}
                        disabled={addingManual || !manualInput.trim()}
                        style={[s.confirmLinkBtn, { backgroundColor: "#0EA5E9", flex: 1, opacity: (!manualInput.trim() || addingManual) ? 0.5 : 1 }]}
                      >
                        {addingManual ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <Text style={s.linkBtnText}>Add Device</Text>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}

              </>
            )}
          </View>

          {/* ── Section: Bluetooth Devices ── */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="bluetooth" size={13} color={colors.mutedForeground} />
              <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>Bluetooth Devices</Text>
            </View>

            {!effectivePro ? (
              <LockedFeatureCard
                featureName="Bluetooth Thermometers"
                teaser="Pair Inkbird, Govee, Weber iGrill, and MEATER probes via Bluetooth for live temperatures and automatic PitMaster coaching."
                icon="bluetooth"
                onPress={() => showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" })}
              />
            ) : (
              <>
                {blePermDenied && (
                  <View style={[s.emptyCard, { backgroundColor: "#ef444412", borderColor: "#ef444440", borderRadius: colors.radius, alignItems: "flex-start", gap: 10 }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Feather name="alert-circle" size={16} color="#ef4444" />
                      <Text style={[s.emptyText, { color: "#ef4444", textAlign: "left" }]}>
                        Bluetooth permission denied
                      </Text>
                    </View>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground, textAlign: "left" }]}>
                      knowyourpit cannot scan for BLE probes without Bluetooth access. Open Settings and enable Bluetooth for knowyourpit, then tap "Scan for Devices" again.
                    </Text>
                    <Pressable
                      onPress={() => Linking.openSettings()}
                      style={[s.openSettingsBtn, { backgroundColor: "#ef4444" }]}
                    >
                      <Feather name="settings" size={13} color="#fff" />
                      <Text style={s.openSettingsBtnText}>Open Settings</Text>
                    </Pressable>
                  </View>
                )}

                {(() => {
                  const pairedDevices = bleDevices.filter((d) => d.paired);
                  const nearbyUnpaired = bleScanning ? bleDevices.filter((d) => !d.paired) : [];

                  return (
                    <>
                      {!blePermDenied && pairedDevices.length === 0 && !bleScanning && (
                        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                          <Feather name="bluetooth" size={20} color={colors.mutedForeground} />
                          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                            No paired Bluetooth devices.
                          </Text>
                          <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>
                            Tap "Scan for Devices" to discover nearby probes. Supported: MEATER, Govee H5051/H5075, Weber iGrill 2/3/Mini, Inkbird IBT-series
                          </Text>
                        </View>
                      )}

                      {pairedDevices.map((device) => (
                        <BleDeviceCard
                          key={device.id}
                          device={device}
                          colors={colors}
                          onPair={() => pairDevice(device.id)}
                          onUnpair={() => unpairDevice(device.id)}
                        />
                      ))}

                      {bleScanning && nearbyUnpaired.length > 0 && (
                        <>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                            <Feather name="radio" size={11} color={colors.mutedForeground} />
                            <Text style={[s.sectionHeader, { color: colors.mutedForeground, fontSize: 10 }]}>Nearby — tap to pair</Text>
                          </View>
                          {nearbyUnpaired.map((device) => (
                            <BleDeviceCard
                              key={device.id}
                              device={device}
                              colors={colors}
                              onPair={() => pairDevice(device.id)}
                              onUnpair={() => unpairDevice(device.id)}
                            />
                          ))}
                        </>
                      )}

                      {bleScanning && pairedDevices.length === 0 && nearbyUnpaired.length === 0 && (
                        <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                          <ActivityIndicator size="small" color={colors.primary} />
                          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                            Scanning for nearby BLE probes…
                          </Text>
                        </View>
                      )}
                    </>
                  );
                })()}
              </>
            )}
          </View>

          {/* ── Section: Cloud Integrations ── */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="cloud" size={13} color={colors.mutedForeground} />
              <Text style={[s.sectionHeader, { color: colors.mutedForeground }]}>Cloud Integrations</Text>
            </View>

            {/* MEATER Cloud */}
            {!effectivePro && !meaterStatus?.linked && !meaterLoading ? (
              <LockedFeatureCard
                featureName="MEATER Thermometer"
                teaser="Pull live MEATER probe temps into PitMaster, auto-fill targets from your saved cook, and get alerts when your probe hits target."
                icon="thermometer"
                onPress={() =>
                  showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" })
                }
              />
            ) : (
              <View style={[s.deviceCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={s.deviceRow}>
                  <View style={[s.deviceIcon, { backgroundColor: "#FF6B2B22" }]}>
                    <Feather name="thermometer" size={20} color="#FF6B2B" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[s.deviceName, { color: colors.foreground }]}>MEATER Thermometer</Text>
                      {!effectivePro && !meaterStatus?.linked && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.primary + "22" }}>
                          <Feather name="lock" size={9} color={colors.primary} />
                          <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: colors.primary }}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                      {meaterLoading ? "Checking…" : meaterStatus?.linked ? "Connected to MEATER Cloud" : "Not linked"}
                    </Text>
                  </View>
                  {meaterLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : meaterStatus?.linked ? (
                    <View style={s.connectedBadge}>
                      <Feather name="check-circle" size={13} color="#22c55e" />
                      <Text style={s.connectedText}>Active</Text>
                    </View>
                  ) : null}
                </View>

                {!meaterLoading && meaterStatus?.linked && (meaterStatus?.devices?.length ?? 0) > 0 && (
                  <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                    {meaterStatus!.devices.map((d) => (
                      <View key={d.id} style={s.probeRow}>
                        <Feather name="wifi" size={13} color={colors.mutedForeground} />
                        <Text style={[s.probeName, { color: colors.foreground }]}>{d.name}</Text>
                        {(d as any).probeNumber != null && (meaterStatus!.devices.length > 1) && (
                          <Text style={[s.deviceSub, { color: colors.mutedForeground, marginTop: 0 }]}>
                            probe {(d as any).probeNumber}
                          </Text>
                        )}
                        {d.hasCook && (
                          <View style={s.cookBadge}><Text style={s.cookBadgeText}>Cooking</Text></View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {!meaterLoading && meaterStatus?.linked && (meaterStatus?.devices?.length ?? 0) === 0 && (
                  <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                    <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                      No active probes detected. Make sure your MEATER is on and connected.
                    </Text>
                  </View>
                )}

                {!meaterLoading && meaterStatus?.linked && (
                  <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
                    <Pressable onPress={handleUnlinkMeater} disabled={unlinkMeater.isPending} style={[s.unlinkBtn, { borderColor: colors.border }]}>
                      {unlinkMeater.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Text style={s.unlinkText}>Unlink Account</Text>}
                    </Pressable>
                  </View>
                )}

                {!meaterLoading && !meaterStatus?.linked && !showLinkForm && (
                  <Pressable
                    onPress={() => {
                      if (!effectivePro) { showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" }); return; }
                      setShowLinkForm(true);
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                    }}
                    style={[s.linkBtn, { backgroundColor: "#FF6B2B" }]}
                  >
                    <Feather name={effectivePro ? "link" : "lock"} size={15} color="#fff" />
                    <Text style={s.linkBtnText}>{effectivePro ? "Link MEATER Account" : "Unlock with Pro"}</Text>
                  </Pressable>
                )}

                {!meaterLoading && !meaterStatus?.linked && showLinkForm && (
                  <View style={[s.linkForm, { borderTopColor: colors.border }]}>
                    <Text style={[s.linkFormLabel, { color: colors.mutedForeground }]}>Enter your MEATER Cloud credentials</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="MEATER email" placeholderTextColor={colors.mutedForeground}
                      value={meaterEmail} onChangeText={(t) => { setMeaterEmail(t); setMeaterLinkError(null); }} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                    />
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="MEATER password" placeholderTextColor={colors.mutedForeground}
                      value={meaterPassword} onChangeText={(t) => { setMeaterPassword(t); setMeaterLinkError(null); }} secureTextEntry
                    />
                    <Text style={[s.oauthHint, { color: colors.mutedForeground }]}>
                      {"Signed up with Google or Apple? You'll need to "}
                      <Text style={[s.oauthHintLink, { color: colors.primary }]} onPress={() => Linking.openURL("https://app.meaterapp.com")}>set a password on MEATER's website</Text>
                      {" first."}
                    </Text>
                    <View style={s.linkFormActions}>
                      <Pressable onPress={() => { setShowLinkForm(false); setMeaterEmail(""); setMeaterPassword(""); setMeaterLinkError(null); }} style={[s.cancelBtn, { borderColor: colors.border }]}>
                        <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleLinkMeater} disabled={linkMeater.isPending} style={[s.confirmLinkBtn, { backgroundColor: "#FF6B2B" }]}>
                        {linkMeater.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.linkBtnText}>Connect</Text>}
                      </Pressable>
                    </View>
                    {meaterLinkError ? (
                      <Text style={[s.oauthHint, { color: "#ef4444", marginTop: 2 }]}>{meaterLinkError}</Text>
                    ) : null}
                  </View>
                )}
              </View>
            )}

            {/* ThermoWorks Cloud */}
            {!effectivePro && !thermoworksStatus?.linked && !thermoworksLoading ? (
              <LockedFeatureCard
                featureName="ThermoWorks Cloud"
                teaser="Sync ThermoWorks Signals/Smoke/Billows readings into PitMaster for live cook tracking and probe-aware alerts."
                icon="thermometer"
                onPress={() =>
                  showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" })
                }
              />
            ) : (
              <View style={[s.deviceCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                <View style={s.deviceRow}>
                  <View style={[s.deviceIcon, { backgroundColor: THERMOWORKS_COLOR + "22" }]}>
                    <Feather name="thermometer" size={20} color={THERMOWORKS_COLOR} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[s.deviceName, { color: colors.foreground }]}>ThermoWorks Cloud</Text>
                      {!effectivePro && !thermoworksStatus?.linked && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.primary + "22" }}>
                          <Feather name="lock" size={9} color={colors.primary} />
                          <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: colors.primary }}>PRO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                      {thermoworksLoading ? "Checking…" : thermoworksStatus?.linked ? "Connected to ThermoWorks Cloud" : "Not linked"}
                    </Text>
                  </View>
                  {thermoworksLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : thermoworksStatus?.linked ? (
                    <View style={s.connectedBadge}>
                      <Feather name="check-circle" size={13} color="#22c55e" />
                      <Text style={s.connectedText}>Active</Text>
                    </View>
                  ) : null}
                </View>

                {!thermoworksLoading && thermoworksStatus?.linked && (thermoworksStatus?.devices?.length ?? 0) > 0 && (
                  <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                    {thermoworksStatus!.devices.map((d) => (
                      <View key={d.id} style={s.probeRow}>
                        <Feather name="wifi" size={13} color={colors.mutedForeground} />
                        <Text style={[s.probeName, { color: colors.foreground }]}>{d.name}</Text>
                        {d.type && (
                          <View style={[s.cookBadge, { backgroundColor: THERMOWORKS_COLOR + "22" }]}>
                            <Text style={[s.cookBadgeText, { color: THERMOWORKS_COLOR }]}>{d.type}</Text>
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {!thermoworksLoading && thermoworksStatus?.linked && (thermoworksStatus?.devices?.length ?? 0) === 0 && (
                  <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                    <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                      No devices found on your ThermoWorks account. Make sure your probe is paired in the ThermoWorks app.
                    </Text>
                  </View>
                )}

                {!thermoworksLoading && thermoworksStatus?.linked && (
                  <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
                    <Pressable onPress={handleUnlinkThermoworks} disabled={unlinkThermoworks.isPending} style={[s.unlinkBtn, { borderColor: colors.border }]}>
                      {unlinkThermoworks.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Text style={s.unlinkText}>Unlink Account</Text>}
                    </Pressable>
                  </View>
                )}

                {!thermoworksLoading && !thermoworksStatus?.linked && !showThermoworksLinkForm && (
                  <Pressable
                    onPress={() => {
                      if (!effectivePro) { showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" }); return; }
                      setShowThermoworksLinkForm(true);
                      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
                    }}
                    style={[s.linkBtn, { backgroundColor: THERMOWORKS_COLOR }]}
                  >
                    <Feather name={effectivePro ? "link" : "lock"} size={15} color="#fff" />
                    <Text style={s.linkBtnText}>{effectivePro ? "Link ThermoWorks Account" : "Unlock with Pro"}</Text>
                  </Pressable>
                )}

                {!thermoworksLoading && !thermoworksStatus?.linked && showThermoworksLinkForm && (
                  <View style={[s.linkForm, { borderTopColor: colors.border }]}>
                    <Text style={[s.linkFormLabel, { color: colors.mutedForeground }]}>Enter your ThermoWorks Cloud credentials</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="ThermoWorks email" placeholderTextColor={colors.mutedForeground}
                      value={thermoworksEmail} onChangeText={(t) => { setThermoworksEmail(t); setTwResetSent(false); setTwResetError(null); setTwLinkError(null); }} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                    />
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="ThermoWorks password" placeholderTextColor={colors.mutedForeground}
                      value={thermoworksPassword} onChangeText={(t) => { setThermoworksPassword(t); setTwLinkError(null); }} secureTextEntry
                    />
                    <Text style={[s.oauthHint, { color: colors.mutedForeground }]}>
                      {"Signed up with Google or Apple? Enter your Google/Apple email above, then tap 'Email me a reset link'."}
                    </Text>
                    {twLinkError && (
                      <Text style={[s.oauthHint, { color: "#ef4444", marginTop: 4 }]}>{twLinkError}</Text>
                    )}
                    <View style={s.linkFormActions}>
                      <Pressable onPress={() => { setShowThermoworksLinkForm(false); setThermoworksEmail(""); setThermoworksPassword(""); setTwResetSent(false); setTwLinkError(null); }} style={[s.cancelBtn, { borderColor: colors.border }]}>
                        <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleLinkThermoworks} disabled={linkThermoworks.isPending} style={[s.confirmLinkBtn, { backgroundColor: THERMOWORKS_COLOR }]}>
                        {linkThermoworks.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.linkBtnText}>Connect</Text>}
                      </Pressable>
                    </View>
                    {thermoworksEmail.trim().length > 0 && (
                      twResetSent
                        ? <Text style={[s.oauthHint, { color: "#22c55e", marginTop: 6 }]}>{"✓ Check your inbox for a reset link."}</Text>
                        : <>
                            <Pressable
                              disabled={sendThermoworksReset.isPending}
                              onPress={() => sendThermoworksReset.mutate(
                                { data: { email: thermoworksEmail.trim() } },
                                {
                                  onSuccess: () => { setTwResetSent(true); setTwResetError(null); },
                                  onError: (err: any) => {
                                    // customFetch throws ApiError with .status and .data
                                    const status = err?.status;
                                    const code = (err?.data as any)?.code;
                                    if (status === 422 && code === "OAUTH_ACCOUNT") {
                                      setTwResetError(
                                        "This ThermoWorks account uses Google or Apple sign-in. To set a local password, visit app.thermoworks.com and use \u2018Forgot password\u2019.",
                                      );
                                    } else {
                                      setTwResetError("Couldn\u2019t reach ThermoWorks Cloud \u2014 check your connection and try again.");
                                    }
                                  },
                                },
                              )}
                              style={{ marginTop: 6 }}
                            >
                              <Text style={[s.oauthHintLink, { color: colors.primary }]}>
                                {sendThermoworksReset.isPending ? "Sending…" : "Email me a reset link"}
                              </Text>
                            </Pressable>
                            {twResetError && (
                              <Text style={[s.oauthHint, { color: "#ef4444", marginTop: 4 }]}>{twResetError}</Text>
                            )}
                          </>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </AppKeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  scanButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: 12, borderWidth: 1,
  },
  scanButtonText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  scanButtonSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  emptyCard: { borderWidth: 1, padding: 20, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  emptySubText: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", opacity: 0.8 },
  deviceCard: { borderWidth: 1, overflow: "hidden" },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  deviceIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  deviceName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  deviceSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  connectedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#22c55e18", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 4 },
  connectedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#22c55e" },
  deviceList: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 8 },
  probeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  probeName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  cookBadge: { backgroundColor: "#FF6B2B22", borderRadius: 99, paddingHorizontal: 8, paddingVertical: 3 },
  cookBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#FF6B2B" },
  deviceActions: { borderTopWidth: 1, padding: 12 },
  unlinkBtn: { borderWidth: 1, borderRadius: 8, paddingVertical: 8, alignItems: "center" },
  unlinkText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#ef4444" },
  linkBtn: { margin: 14, marginTop: 0, borderRadius: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12 },
  linkBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  linkForm: { borderTopWidth: 1, padding: 14, gap: 10 },
  linkFormLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  linkFormActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  confirmLinkBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
  oauthHint: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  oauthHintLink: { fontSize: 12, fontFamily: "Inter_500Medium" },
  lanPermCard: { borderWidth: 1, padding: 16, gap: 10 },
  lanPermIconRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lanPermIconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  lanPermTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  lanPermSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  lanPermBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  lanPermBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, paddingVertical: 12, marginTop: 2 },
  lanPermBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  openSettingsBtn: { marginTop: 4, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EAB308", paddingHorizontal: 16, paddingVertical: 9, borderRadius: 8 },
  openSettingsBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
