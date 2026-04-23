import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { CACHE_STORAGE_KEY } from "@/constants/cache";

const MENU_SECTIONS = [
  {
    title: "Manage",
    items: [
      { icon: "wind", label: "My Grills", route: "/grills" },
    ],
  },
  {
    title: "Account",
    items: [
      { icon: "user", label: "Profile", route: "/profile" },
      { icon: "bell", label: "Alerts", route: "/alerts" },
    ],
  },
];

export default function MoreScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const qc = useQueryClient();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          qc.clear();
          await AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});
          signOut();
        },
      },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="More" dark />

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: botPad + 100 }}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          onPress={() => router.push("/profile" as any)}
        >
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>
              {(user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "P").toUpperCase()}
            </Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: colors.foreground }]}>
              {user?.fullName || user?.firstName || "Pitmaster"}
            </Text>
            <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
              {user?.emailAddresses?.[0]?.emailAddress || ""}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        {MENU_SECTIONS.map((section) => (
          <View key={section.title} style={s.section}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>{section.title}</Text>
            <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              {section.items.map((item, idx) => (
                <React.Fragment key={item.label}>
                  <Pressable
                    style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.7 }]}
                    onPress={() => router.push(item.route as any)}
                  >
                    <View style={[s.menuIcon, { backgroundColor: colors.primary + "20" }]}>
                      <Feather name={item.icon as any} size={16} color={colors.primary} />
                    </View>
                    <Text style={[s.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                  </Pressable>
                  {idx < section.items.length - 1 && (
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                  )}
                </React.Fragment>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          style={({ pressed }) => [
            s.signOutBtn,
            { borderColor: colors.destructive, borderRadius: colors.radius },
            pressed && { opacity: 0.7 },
          ]}
          onPress={handleSignOut}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text style={[s.signOutText, { color: colors.destructive }]}>Sign Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginBottom: 20, padding: 16, borderWidth: 1,
  },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", paddingHorizontal: 20, paddingBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" },
  sectionCard: { marginHorizontal: 16, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  menuIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  divider: { height: 1, marginLeft: 58 },
  signOutBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, marginBottom: 12, borderWidth: 1.5, padding: 14,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
