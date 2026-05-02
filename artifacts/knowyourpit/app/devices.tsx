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
  KeyboardAvoidingView,
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
      // 402 → paywall (Pro-only feature). Otherwise fall back to the credential
      // / connectivity error handling we had before.
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40, gap: 12 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* MEATER — for free users without an active link we render the
              shared LockedFeatureCard (Pattern B) so locked-state styling is
              consistent across the app. Pro users (and anyone with an
              already-linked account, e.g. legacy/grandfathered) see the
              full bespoke card below. */}
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
          <View
            style={[
              s.deviceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={s.deviceRow}>
              <View style={[s.deviceIcon, { backgroundColor: "#FF6B2B22" }]}>
                <Feather name="thermometer" size={20} color="#FF6B2B" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.deviceName, { color: colors.foreground }]}>
                    MEATER Thermometer
                  </Text>
                  {/* PRO badge in card header — Pattern B locked-state marker
                      so free users see this is a Pro feature without needing
                      to tap. Hidden once linked (Pro user with active link). */}
                  {!effectivePro && !meaterStatus?.linked && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: colors.primary + "22",
                      }}
                    >
                      <Feather name="lock" size={9} color={colors.primary} />
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontFamily: "Inter_600SemiBold",
                          color: colors.primary,
                        }}
                      >
                        PRO
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                  {meaterLoading
                    ? "Checking…"
                    : meaterStatus?.linked
                      ? "Connected to MEATER Cloud"
                      : "Not linked"}
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

            {!meaterLoading &&
              meaterStatus?.linked &&
              (meaterStatus?.devices?.length ?? 0) > 0 && (
                <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                  {meaterStatus!.devices.map((d) => (
                    <View key={d.id} style={s.probeRow}>
                      <Feather name="wifi" size={13} color={colors.mutedForeground} />
                      <Text style={[s.probeName, { color: colors.foreground }]}>
                        {d.name}
                      </Text>
                      {d.hasCook && (
                        <View style={s.cookBadge}>
                          <Text style={s.cookBadgeText}>Cooking</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

            {!meaterLoading &&
              meaterStatus?.linked &&
              (meaterStatus?.devices?.length ?? 0) === 0 && (
                <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                  <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                    No active probes detected. Make sure your MEATER is on and connected.
                  </Text>
                </View>
              )}

            {!meaterLoading && meaterStatus?.linked && (
              <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={handleUnlinkMeater}
                  disabled={unlinkMeater.isPending}
                  style={[s.unlinkBtn, { borderColor: colors.border }]}
                >
                  {unlinkMeater.isPending ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={s.unlinkText}>Unlink Account</Text>
                  )}
                </Pressable>
              </View>
            )}

            {!meaterLoading && !meaterStatus?.linked && !showLinkForm && (
              <Pressable
                onPress={() => {
                  if (!effectivePro) {
                    showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" });
                    return;
                  }
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
                <Text style={[s.linkFormLabel, { color: colors.mutedForeground }]}>
                  Enter your MEATER Cloud credentials
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="MEATER email"
                  placeholderTextColor={colors.mutedForeground}
                  value={meaterEmail}
                  onChangeText={setMeaterEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="MEATER password"
                  placeholderTextColor={colors.mutedForeground}
                  value={meaterPassword}
                  onChangeText={setMeaterPassword}
                  secureTextEntry
                />
                <View style={s.linkFormActions}>
                  <Pressable
                    onPress={() => { setShowLinkForm(false); setMeaterEmail(""); setMeaterPassword(""); }}
                    style={[s.cancelBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleLinkMeater}
                    disabled={linkMeater.isPending}
                    style={[s.confirmLinkBtn, { backgroundColor: "#FF6B2B" }]}
                  >
                    {linkMeater.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.linkBtnText}>Connect</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
          )}

          {/* ThermoWorks — same Pattern B treatment as MEATER above. */}
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
          <View
            style={[
              s.deviceCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={s.deviceRow}>
              <View style={[s.deviceIcon, { backgroundColor: THERMOWORKS_COLOR + "22" }]}>
                <Feather name="thermometer" size={20} color={THERMOWORKS_COLOR} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[s.deviceName, { color: colors.foreground }]}>
                    ThermoWorks Cloud
                  </Text>
                  {/* PRO badge in card header — same Pattern B locked marker
                      as the MEATER card above. */}
                  {!effectivePro && !thermoworksStatus?.linked && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 3,
                        paddingHorizontal: 6,
                        paddingVertical: 2,
                        borderRadius: 999,
                        backgroundColor: colors.primary + "22",
                      }}
                    >
                      <Feather name="lock" size={9} color={colors.primary} />
                      <Text
                        style={{
                          fontSize: 9.5,
                          fontFamily: "Inter_600SemiBold",
                          color: colors.primary,
                        }}
                      >
                        PRO
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                  {thermoworksLoading
                    ? "Checking…"
                    : thermoworksStatus?.linked
                      ? "Connected to ThermoWorks Cloud"
                      : "Not linked"}
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

            {!thermoworksLoading &&
              thermoworksStatus?.linked &&
              (thermoworksStatus?.devices?.length ?? 0) > 0 && (
                <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                  {thermoworksStatus!.devices.map((d) => (
                    <View key={d.id} style={s.probeRow}>
                      <Feather name="wifi" size={13} color={colors.mutedForeground} />
                      <Text style={[s.probeName, { color: colors.foreground }]}>
                        {d.name}
                      </Text>
                      {d.type && (
                        <View style={[s.cookBadge, { backgroundColor: THERMOWORKS_COLOR + "22" }]}>
                          <Text style={[s.cookBadgeText, { color: THERMOWORKS_COLOR }]}>{d.type}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}

            {!thermoworksLoading &&
              thermoworksStatus?.linked &&
              (thermoworksStatus?.devices?.length ?? 0) === 0 && (
                <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                  <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                    No devices found on your ThermoWorks account. Make sure your probe is paired in the ThermoWorks app.
                  </Text>
                </View>
              )}

            {!thermoworksLoading && thermoworksStatus?.linked && (
              <View style={[s.deviceActions, { borderTopColor: colors.border }]}>
                <Pressable
                  onPress={handleUnlinkThermoworks}
                  disabled={unlinkThermoworks.isPending}
                  style={[s.unlinkBtn, { borderColor: colors.border }]}
                >
                  {unlinkThermoworks.isPending ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Text style={s.unlinkText}>Unlink Account</Text>
                  )}
                </Pressable>
              </View>
            )}

            {!thermoworksLoading && !thermoworksStatus?.linked && !showThermoworksLinkForm && (
              <Pressable
                onPress={() => {
                  if (!effectivePro) {
                    showPaywall({ trigger: "pro_required", featureName: "Smart Probe Integration" });
                    return;
                  }
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
                <Text style={[s.linkFormLabel, { color: colors.mutedForeground }]}>
                  Enter your ThermoWorks Cloud credentials
                </Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="ThermoWorks email"
                  placeholderTextColor={colors.mutedForeground}
                  value={thermoworksEmail}
                  onChangeText={setThermoworksEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoCorrect={false}
                />
                <TextInput
                  style={[s.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
                  placeholder="ThermoWorks password"
                  placeholderTextColor={colors.mutedForeground}
                  value={thermoworksPassword}
                  onChangeText={setThermoworksPassword}
                  secureTextEntry
                />
                <View style={s.linkFormActions}>
                  <Pressable
                    onPress={() => { setShowThermoworksLinkForm(false); setThermoworksEmail(""); setThermoworksPassword(""); }}
                    style={[s.cancelBtn, { borderColor: colors.border }]}
                  >
                    <Text style={[s.cancelBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleLinkThermoworks}
                    disabled={linkThermoworks.isPending}
                    style={[s.confirmLinkBtn, { backgroundColor: THERMOWORKS_COLOR }]}
                  >
                    {linkThermoworks.isPending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={s.linkBtnText}>Connect</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
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
});
