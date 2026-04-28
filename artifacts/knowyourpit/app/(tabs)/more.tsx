import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useUser, useClerk } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePaywall } from "@/contexts/PaywallContext";

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
      { icon: "bluetooth", label: "Connected Devices", route: "/devices" },
      { icon: "bell", label: "Alerts", route: "/alerts" },
    ],
  },
];

export default function MoreScreen() {
  const colors = useColors();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const qc = useQueryClient();
  const { isPro, expirationDate, restorePurchases, isLoading: subLoading } = useSubscription();
  const { showPaywall } = usePaywall();

  const botPad = useBottomTabBarHeight();

  const handleRestorePurchases = async () => {
    const { success, error } = await restorePurchases();
    if (success) {
      Alert.alert("Purchases restored", "Your Pro subscription is now active.");
    } else if (error) {
      Alert.alert("Restore failed", error);
    } else {
      Alert.alert(
        "Nothing to restore",
        "We couldn't find an active subscription linked to this account. If you believe this is an error, try signing in with the same Apple ID or Google account you used to subscribe.",
      );
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          // Cache isolation is handled at the provider level: signing out flips
          // the userId, which remounts ScopedQueryProvider in app/_layout.tsx
          // with a fresh QueryClient and a fresh "anon" persister. We keep
          // qc.clear() here as a belt-and-suspenders defense for the brief
          // moment before the remount fires.
          qc.clear();
          await signOut();
        },
      },
    ]);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="More" dark />

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        {/*
          ── Subscription card ──
          Always visible at the top of "More" so users can find their plan
          status (or upgrade) at a glance. Pro users see expiration; free
          users get a primary-color CTA that opens the paywall sheet.
        */}
        <Pressable
          onPress={() => {
            if (isPro) {
              Alert.alert(
                "knowyourpit Pro",
                expirationDate
                  ? `Your subscription renews on ${expirationDate.toLocaleDateString()}. Manage in your App Store / Play Store account.`
                  : "Manage your subscription in your App Store / Play Store account.",
              );
            } else {
              showPaywall();
            }
          }}
          style={({ pressed }) => [
            s.subscriptionCard,
            {
              backgroundColor: isPro ? colors.card : "#E84520",
              borderColor: isPro ? colors.border : "#E84520",
              borderRadius: colors.radius,
            },
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[s.subscriptionIcon, { backgroundColor: isPro ? "#E8452020" : "rgba(255,255,255,0.2)" }]}>
            <Feather name={isPro ? "award" : "zap"} size={20} color={isPro ? "#E84520" : "#fff"} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.subscriptionTitle, { color: isPro ? colors.foreground : "#fff" }]}>
              {isPro ? "knowyourpit Pro" : "Upgrade to Pro"}
            </Text>
            <Text style={[s.subscriptionSub, { color: isPro ? colors.mutedForeground : "rgba(255,255,255,0.85)" }]}>
              {isPro
                ? expirationDate
                  ? `Renews ${expirationDate.toLocaleDateString()}`
                  : "Active subscription"
                : "Unlimited cooks, AI, multi-cook, devices"}
            </Text>
          </View>
          <Feather name="chevron-right" size={18} color={isPro ? colors.mutedForeground : "rgba(255,255,255,0.85)"} />
        </Pressable>

        <Pressable
          onPress={handleRestorePurchases}
          disabled={subLoading}
          style={({ pressed }) => [
            s.restoreBtn,
            pressed && { opacity: 0.7 },
          ]}
        >
          {subLoading ? (
            <ActivityIndicator size="small" color={colors.mutedForeground} />
          ) : (
            <Text style={[s.restoreBtnText, { color: colors.mutedForeground }]}>
              Restore purchases
            </Text>
          )}
        </Pressable>

        <Pressable
          style={[s.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          onPress={() => router.push("/profile" as any)}
        >
          <View style={[s.avatar, { backgroundColor: colors.primary }]}>
            <Text style={s.avatarText}>
              {((user?.unsafeMetadata?.displayName as string | undefined)?.[0] || user?.firstName?.[0] || user?.emailAddresses?.[0]?.emailAddress?.[0] || "P").toUpperCase()}
            </Text>
          </View>
          <View style={s.profileInfo}>
            <Text style={[s.profileName, { color: colors.foreground }]}>
              {(user?.unsafeMetadata?.displayName as string | undefined) || user?.fullName || user?.firstName || "Pitmaster"}
            </Text>
            {user?.username ? (
              <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
                @{user.username}
              </Text>
            ) : (
              <Text style={[s.profileEmail, { color: colors.mutedForeground }]}>
                {user?.emailAddresses?.[0]?.emailAddress || ""}
              </Text>
            )}
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
  subscriptionCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    marginHorizontal: 16, marginBottom: 12, padding: 16, borderWidth: 1.5,
  },
  subscriptionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  subscriptionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 2 },
  subscriptionSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
  restoreBtn: {
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginBottom: 16, paddingVertical: 10,
    minHeight: 36,
  },
  restoreBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
