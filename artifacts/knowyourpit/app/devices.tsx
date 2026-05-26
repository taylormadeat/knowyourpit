import React, { useRef, useState } from "react";
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
} from "react-native";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useQueryClient } from "@tanstack/react-query";
import { usePaywall } from "@/contexts/PaywallContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { LockedFeatureCard } from "@/components/LockedFeatureCard";
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";
import { useBleProbes, type BleDevice } from "@/contexts/BleProbeContext";
import { useLanProbes, type LanDeviceStatus } from "@/hooks/useLanProbes";
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
} from "@workspace/api-client-react";

const THERMOWORKS_COLOR = "#B22222";

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

  return (
    <View style={[s.deviceCard, { backgroundColor: colors.card, borderColor: isConnected ? "#22c55e40" : colors.border, borderRadius: colors.radius }]}>
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

      {isConnected && (device.probeTempF != null || device.ambientTempF != null) && (
        <View style={[s.deviceList, { borderTopColor: colors.border, flexDirection: "row", gap: 12, flexWrap: "wrap" }]}>
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
        </View>
      )}

      <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
        {isPaired ? (
          <Pressable
            onPress={onUnpair}
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
    </View>
  );
}

/** Returns true when the host string is an IPv4 or IPv6 address (mDNS-resolved). */
function isIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function LanDeviceCard({ device, colors }: { device: LanDeviceStatus; colors: any }) {
  const autoDiscovered = isIpAddress(device.host);
  return (
    <View style={[s.deviceCard, { backgroundColor: colors.card, borderColor: device.connected ? "#22c55e40" : colors.border, borderRadius: colors.radius }]}>
      <View style={s.deviceRow}>
        <View style={[s.deviceIcon, { backgroundColor: "#0EA5E920" }]}>
          <Feather name="wifi" size={20} color="#0EA5E9" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[s.deviceName, { color: colors.foreground }]}>{device.deviceName}</Text>
            <ConnectionTypeBadge type="lan" />
            {autoDiscovered && (
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
          </View>
          <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
            {device.host}
            {device.connected && " · Connected"}
            {!device.connected && device.lastSeenMs && ` · Last seen ${fmtLastSeen(device.lastSeenMs)}`}
          </Text>
        </View>
        {device.connected ? (
          <View style={s.connectedBadge}>
            <Feather name="check-circle" size={13} color="#22c55e" />
            <Text style={s.connectedText}>Active</Text>
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
    </View>
  );
}

export default function DevicesScreen() {
  const colors = useColors();
  const qc = useQueryClient();
  const scrollRef = useRef<ScrollView>(null);
  const botPad = useBottomInset();
  const effectivePro = useEffectivePro();
  const { showPaywall, parseAndShowFromError } = usePaywall();

  const { data: meaterStatus, isLoading: meaterLoading } = useGetMeaterStatus();
  const linkMeater = useLinkMeater();
  const unlinkMeater = useUnlinkMeater();

  const [meaterEmail, setMeaterEmail] = useState("");
  const [meaterPassword, setMeaterPassword] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const invalidateMeaterStatus = () =>
    qc.invalidateQueries({ queryKey: getGetMeaterStatusQueryKey() });

  const { data: thermoworksStatus, isLoading: thermoworksLoading } = useGetThermoworksStatus();
  const linkThermoworks = useLinkThermoworks();
  const unlinkThermoworks = useUnlinkThermoworks();
  const [thermoworksEmail, setThermoworksEmail] = useState("");
  const [thermoworksPassword, setThermoworksPassword] = useState("");
  const [showThermoworksLinkForm, setShowThermoworksLinkForm] = useState(false);

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

  const {
    devices: lanDevices,
    scanning: lanScanning,
    mdnsAvailable,
    scan: scanLan,
  } = useLanProbes({ enabled: effectivePro, pollIntervalMs: 30_000 });

  const handleScan = () => {
    if (!effectivePro) {
      showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" });
      return;
    }
    startBleScan();
    scanLan();
  };

  const isScanning = bleScanning || lanScanning;

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
      Alert.alert("Link failed", message);
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
    try {
      await linkMeater.mutateAsync({
        data: { email: meaterEmail.trim(), password: meaterPassword },
      });
      setMeaterEmail("");
      setMeaterPassword("");
      setShowLinkForm(false);
      invalidateMeaterStatus();
    } catch (e: any) {
      if (parseAndShowFromError(e)) return;
      const isNetworkError = !e?.status;
      const isSessionError = e?.status === 401 && e?.data?.error === "Unauthorized";
      const message = isNetworkError
        ? "Could not reach the server. Please check your connection and try again."
        : isSessionError
          ? "Your session has expired — sign out and sign back in, then try again."
          : e?.data?.error ?? e?.message ?? "Could not link MEATER account. Check your credentials.";
      Alert.alert("Link failed", message);
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
      <AppHeader title="Connected Devices" showBack dark />

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
            disabled={isScanning}
            style={[
              s.scanButton,
              { backgroundColor: isScanning ? colors.card : colors.primary, borderColor: colors.border },
            ]}
          >
            {isScanning ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="radio" size={15} color="#fff" />
            )}
            <Text style={[s.scanButtonText, { color: isScanning ? colors.mutedForeground : "#fff" }]}>
              {isScanning ? "Scanning…" : "Scan for Devices"}
            </Text>
            <Text style={[s.scanButtonSub, { color: isScanning ? colors.mutedForeground : "#ffffff99" }]}>
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
                teaser="Connect Fireboard, MEATER Block, and ThermoWorks Signals over your local network for live temps and auto PitMaster check-ins."
                icon="wifi"
                onPress={() => showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" })}
              />
            ) : (
              <>
                {lanDevices.length === 0 ? (
                  <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                    <Feather name="wifi-off" size={20} color={colors.mutedForeground} />
                    <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                      No WiFi thermometers found on your local network.
                    </Text>
                    <Text style={[s.emptySubText, { color: colors.mutedForeground }]}>
                      {mdnsAvailable
                        ? "Auto-discovery (mDNS) is active — make sure your device is on the same WiFi network. Supported: Fireboard 2/Drive, MEATER Block, ThermoWorks Signals"
                        : "Supported: Fireboard 2/Drive, MEATER Block, ThermoWorks Signals"}
                    </Text>
                  </View>
                ) : (
                  lanDevices.map((device) => (
                    <LanDeviceCard key={device.host} device={device} colors={colors} />
                  ))
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
                  <View style={[s.emptyCard, { backgroundColor: "#ef444412", borderColor: "#ef444440", borderRadius: colors.radius }]}>
                    <Feather name="alert-circle" size={16} color="#ef4444" />
                    <Text style={[s.emptyText, { color: "#ef4444" }]}>
                      Bluetooth permission denied. Enable it in Settings to use BLE thermometers.
                    </Text>
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
                      value={meaterEmail} onChangeText={setMeaterEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                    />
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="MEATER password" placeholderTextColor={colors.mutedForeground}
                      value={meaterPassword} onChangeText={setMeaterPassword} secureTextEntry
                    />
                    <Text style={[s.oauthHint, { color: colors.mutedForeground }]}>
                      {"Signed up with Google or Apple? You'll need to "}
                      <Text style={[s.oauthHintLink, { color: colors.primary }]} onPress={() => Linking.openURL("https://www.meater.com")}>set a password on MEATER's website</Text>
                      {" first."}
                    </Text>
                    <View style={s.linkFormActions}>
                      <Pressable onPress={() => { setShowLinkForm(false); setMeaterEmail(""); setMeaterPassword(""); }} style={[s.cancelBtn, { borderColor: colors.border }]}>
                        <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleLinkMeater} disabled={linkMeater.isPending} style={[s.confirmLinkBtn, { backgroundColor: "#FF6B2B" }]}>
                        {linkMeater.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.linkBtnText}>Connect</Text>}
                      </Pressable>
                    </View>
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
                      value={thermoworksEmail} onChangeText={setThermoworksEmail} autoCapitalize="none" keyboardType="email-address" autoCorrect={false}
                    />
                    <TextInput
                      style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                      placeholder="ThermoWorks password" placeholderTextColor={colors.mutedForeground}
                      value={thermoworksPassword} onChangeText={setThermoworksPassword} secureTextEntry
                    />
                    <Text style={[s.oauthHint, { color: colors.mutedForeground }]}>
                      {"Signed up with Google or Apple? You'll need to "}
                      <Text style={[s.oauthHintLink, { color: colors.primary }]} onPress={() => Linking.openURL("https://cloud.thermoworks.com")}>set a password on ThermoWorks Cloud</Text>
                      {" first."}
                    </Text>
                    <View style={s.linkFormActions}>
                      <Pressable onPress={() => { setShowThermoworksLinkForm(false); setThermoworksEmail(""); setThermoworksPassword(""); }} style={[s.cancelBtn, { borderColor: colors.border }]}>
                        <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                      </Pressable>
                      <Pressable onPress={handleLinkThermoworks} disabled={linkThermoworks.isPending} style={[s.confirmLinkBtn, { backgroundColor: THERMOWORKS_COLOR }]}>
                        {linkThermoworks.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.linkBtnText}>Connect</Text>}
                      </Pressable>
                    </View>
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
});
