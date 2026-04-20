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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListGrills,
  useGetMeaterStatus,
  getGetMeaterStatusQueryKey,
  useLinkMeater,
  useUnlinkMeater,
} from "@workspace/api-client-react";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const qc = useQueryClient();
  const { data: grills } = useListGrills();
  const scrollRef = useRef<ScrollView>(null);

  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const initials = (
    user?.firstName?.[0] ||
    user?.emailAddresses?.[0]?.emailAddress?.[0] ||
    "P"
  ).toUpperCase();

  const { data: meaterStatus, isLoading: meaterLoading } = useGetMeaterStatus();
  const linkMeater = useLinkMeater();
  const unlinkMeater = useUnlinkMeater();

  const [meaterEmail, setMeaterEmail] = useState("");
  const [meaterPassword, setMeaterPassword] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const invalidateMeaterStatus = () =>
    qc.invalidateQueries({ queryKey: getGetMeaterStatusQueryKey() });

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

      <AppHeader title="Profile" showBack dark />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ paddingBottom: botPad + 40 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Avatar + name */}
        <View style={[s.profileSection, { borderBottomColor: colors.border }]}>
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
          <Text style={[s.profileName, { color: colors.foreground }]}>
            {user?.fullName || user?.firstName || "Pitmaster"}
          </Text>
          <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
            {user?.emailAddresses?.[0]?.emailAddress || ""}
          </Text>
          <Text style={[s.memberSince, { color: colors.mutedForeground }]}>
            Member since{" "}
            {user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"}
          </Text>
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: "Grills", value: (grills as any[])?.length ?? 0 },
            { label: "Recipes Saved", value: "—" },
            { label: "Cooks Done", value: "—" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[
                s.statCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text style={[s.statValue, { color: colors.primary }]}>
                {stat.value}
              </Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Account info */}
        <View
          style={[
            s.infoSection,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          {[
            { label: "Name", value: user?.fullName || "—" },
            {
              label: "Email",
              value: user?.emailAddresses?.[0]?.emailAddress || "—",
            },
            { label: "User ID", value: (user?.id?.slice(0, 12) ?? "") + "..." },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                i < arr.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>
                {row.label}
              </Text>
              <Text
                style={[s.infoValue, { color: colors.foreground }]}
                numberOfLines={1}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Connected Devices ──────────────────────────────── */}
        <View style={s.sectionHeader}>
          <Feather name="bluetooth" size={16} color={colors.primary} />
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>
            Connected Devices
          </Text>
        </View>

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
          {/* MEATER row */}
          <View style={s.deviceRow}>
            <View style={[s.deviceIcon, { backgroundColor: "#FF6B2B22" }]}>
              <Feather name="thermometer" size={20} color="#FF6B2B" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.deviceName, { color: colors.foreground }]}>
                MEATER Thermometer
              </Text>
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

          {/* Device list when linked */}
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

          {/* No devices message when linked but empty */}
          {!meaterLoading &&
            meaterStatus?.linked &&
            (meaterStatus?.devices?.length ?? 0) === 0 && (
              <View style={[s.deviceList, { borderTopColor: colors.border }]}>
                <Text style={[s.deviceSub, { color: colors.mutedForeground }]}>
                  No active probes detected. Make sure your MEATER is on and
                  connected.
                </Text>
              </View>
            )}

          {/* Unlink button when linked */}
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

          {/* Link button when not linked */}
          {!meaterLoading && !meaterStatus?.linked && !showLinkForm && (
            <Pressable
              onPress={() => {
                setShowLinkForm(true);
                setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
              }}
              style={[s.linkBtn, { backgroundColor: "#FF6B2B" }]}
            >
              <Feather name="link" size={15} color="#fff" />
              <Text style={s.linkBtnText}>Link MEATER Account</Text>
            </Pressable>
          )}

          {/* Link form */}
          {!meaterLoading && !meaterStatus?.linked && showLinkForm && (
            <View style={[s.linkForm, { borderTopColor: colors.border }]}>
              <Text style={[s.linkFormLabel, { color: colors.mutedForeground }]}>
                Enter your MEATER Cloud credentials
              </Text>
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="MEATER email"
                placeholderTextColor={colors.mutedForeground}
                value={meaterEmail}
                onChangeText={setMeaterEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
              <TextInput
                style={[
                  s.input,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
                placeholder="MEATER password"
                placeholderTextColor={colors.mutedForeground}
                value={meaterPassword}
                onChangeText={setMeaterPassword}
                secureTextEntry
              />
              <View style={s.linkFormActions}>
                <Pressable
                  onPress={() => {
                    setShowLinkForm(false);
                    setMeaterEmail("");
                    setMeaterPassword("");
                  }}
                  style={[s.cancelBtn, { borderColor: colors.border }]}
                >
                  <Text
                    style={[
                      s.cancelBtnText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    Cancel
                  </Text>
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
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  profileSection: {
    alignItems: "center",
    padding: 28,
    borderBottomWidth: 1,
    gap: 6,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  memberSince: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10, padding: 16 },
  statCard: { flex: 1, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  infoSection: { margin: 16, marginBottom: 0, borderWidth: 1, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  infoValue: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxWidth: "60%",
    textAlign: "right",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  deviceCard: { marginHorizontal: 16, borderWidth: 1, overflow: "hidden" },
  deviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  deviceIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  deviceName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  deviceSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#22c55e18",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  connectedText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#22c55e",
  },
  deviceList: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 8,
  },
  probeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  probeName: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  cookBadge: {
    backgroundColor: "#FF6B2B22",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  cookBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#FF6B2B",
  },
  deviceActions: { borderTopWidth: 1, padding: 12 },
  unlinkBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  unlinkText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#ef4444",
  },
  linkBtn: {
    margin: 14,
    marginTop: 0,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  linkBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  linkForm: { borderTopWidth: 1, padding: 14, gap: 10 },
  linkFormLabel: { fontSize: 12, fontFamily: "Inter_400Regular" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  linkFormActions: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 11,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  confirmLinkBtn: { flex: 1, borderRadius: 8, paddingVertical: 11, alignItems: "center" },
});
