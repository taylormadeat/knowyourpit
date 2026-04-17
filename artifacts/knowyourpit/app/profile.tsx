import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useGetGrillStats } from "@workspace/api-client-react";
import { useListGrills } from "@workspace/api-client-react";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: grills } = useListGrills();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const initials = (user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "P").toUpperCase();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <AppHeader title="Profile" showBack />

      <ScrollView
        contentContainerStyle={{ paddingBottom: botPad + 40 }}
        showsVerticalScrollIndicator={false}
      >
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
            Member since {user?.createdAt ? new Date(user.createdAt).getFullYear() : "—"}
          </Text>
        </View>

        <View style={s.statsRow}>
          {[
            { label: "Grills", value: (grills as any[])?.length ?? 0 },
            { label: "Recipes Saved", value: "—" },
            { label: "Cooks Done", value: "—" },
          ].map((stat) => (
            <View
              key={stat.label}
              style={[s.statCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            >
              <Text style={[s.statValue, { color: colors.primary }]}>{stat.value}</Text>
              <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={[s.infoSection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          {[
            { label: "Name", value: user?.fullName || "—" },
            { label: "Email", value: user?.emailAddresses?.[0]?.emailAddress || "—" },
            { label: "User ID", value: user?.id?.slice(0, 12) + "..." || "—" },
          ].map((row, i, arr) => (
            <View
              key={row.label}
              style={[
                s.infoRow,
                i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
              ]}
            >
              <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
              <Text style={[s.infoValue, { color: colors.foreground }]} numberOfLines={1}>{row.value}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  profileSection: { alignItems: "center", padding: 28, borderBottomWidth: 1, gap: 6 },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold" },
  profileEmail: { fontSize: 14, fontFamily: "Inter_400Regular" },
  memberSince: { fontSize: 12, fontFamily: "Inter_400Regular" },
  statsRow: { flexDirection: "row", gap: 10, padding: 16 },
  statCard: { flex: 1, borderWidth: 1, padding: 12, alignItems: "center", gap: 4 },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  infoSection: { margin: 16, borderWidth: 1, overflow: "hidden" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  infoLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: "60%", textAlign: "right" },
});
