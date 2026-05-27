import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { fetch as expoFetch } from "expo/fetch";
import { type Href, useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { useUser, useClerk, useAuth } from "@clerk/expo";
import { useQueryClient } from "@tanstack/react-query";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { SupportModal } from "@/components/SupportModal";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

// Typed route constant — string form with query param because the Expo Router-
// generated Href union only covers leaf segment names; grouped segments like
// "(onboarding)" must be cast to Href (same pattern as ONBOARDING_HREF in _layout.tsx).
const ONBOARDING_REPLAY_HREF = "/(onboarding)?replay=1" as Href;

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
      { icon: "activity", label: "BLE Diagnostics", route: "/ble-diagnostics" },
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
  const { isPro, isIdentityLinked, expirationDate, restorePurchases, isLoading: subLoading } = useSubscription();
  const effectivePro = useEffectivePro();
  const { getToken } = useAuth();
  const [deleting, setDeleting] = React.useState(false);
  const [supportModalVisible, setSupportModalVisible] = React.useState(false);

  const botPad = useBottomTabBarHeight();
  const { isTablet, contentMaxWidth } = useLayout();

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
          // Race signOut() with a 5s timeout. If Clerk's SDK is hung
          // (eg the iOS-26 boot stall) signOut() can hang forever — the
          // user would press "Yes" and see nothing happen. The timeout
          // ensures we always make progress: if Clerk doesn't respond,
          // we still clear the locally-persisted "guest mode" flag and
          // navigate to the sign-in screen ourselves.
          try {
            await Promise.race([
              signOut(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("signOut timeout")), 5000),
              ),
            ]);
          } catch {
            // Best-effort cleanup if signOut hung or threw.
          }
          try {
            const AsyncStorage = (
              await import("@react-native-async-storage/async-storage")
            ).default;
            // Clear the "guest mode" flag set by the boot escape hatch so we
            // don't immediately re-enter guest mode on the next render. Also
            // SET an "explicitSignOut" flag so the next cold launch's escape
            // hatch knows to leave the user on the sign-in screen instead of
            // re-creating a guest session — otherwise sign-out feels broken
            // because the next launch silently puts them back into the app.
            // Cleared again on successful sign-in (see _layout.tsx).
            await AsyncStorage.multiSet([
              ["knowyourpit:explicitSignOut", "1"],
            ]);
            await AsyncStorage.removeItem("knowyourpit:guestMode");
          } catch {
            // Ignore — navigation below still happens.
          }
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  const performAccountDeletion = async () => {
    if (!API_BASE_URL) {
      Alert.alert(
        "Cannot delete account",
        "The app is not configured to reach the server. Please contact support@knowyourpit.com.",
      );
      return;
    }
    setDeleting(true);
    let signOutAndClear: (() => Promise<void>) | null = null;
    try {
      const token = await getToken();
      const res = await expoFetch(`${API_BASE_URL}/api/profile/me`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      let body: { error?: string; message?: string; accountDeleted?: boolean } = {};
      try {
        body = (await res.json()) as typeof body;
      } catch {}

      if (!res.ok) {
        Alert.alert(
          "Delete failed",
          body?.error ?? "We couldn't delete your account. Please try again or contact support@knowyourpit.com.",
        );
        return;
      }

      // Server-side deletion succeeded (fully or partially — data is gone either way).
      // Sign the user out and clear cache regardless of Clerk-account-delete status,
      // because their data no longer exists and they should not stay signed in.
      signOutAndClear = async () => {
        qc.clear();
        try {
          await signOut();
        } catch {
          // Best effort. The session is invalid server-side; ScopedQueryProvider will remount.
        }
      };

      if (body?.accountDeleted === false) {
        Alert.alert(
          "Almost done",
          body?.message ??
            "Your data was deleted, but your sign-in account could not be removed automatically. Please email support@knowyourpit.com to finish closing it.",
          [{ text: "OK", onPress: () => void signOutAndClear?.() }],
        );
        // Keep deleting=true; component unmounts when auth state flips.
        return;
      }

      // Full success — sign out immediately. Component will unmount on auth flip.
      await signOutAndClear();
    } catch (err) {
      Alert.alert(
        "Delete failed",
        "We couldn't reach the server. Please check your connection and try again.",
      );
    } finally {
      // Only re-enable the button if we did NOT trigger a sign-out (which unmounts us).
      if (!signOutAndClear) setDeleting(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete account?",
      "This will permanently delete your account and all your data — cooks, sessions, AI chats, alerts, grills, and connected devices. This cannot be undone.\n\nIf you have an active subscription, cancel it first in your App Store or Play Store account — deleting your account here does not cancel billing.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Continue",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "Type-tap to confirm: your account and all data will be erased and you will be signed out.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete Forever",
                  style: "destructive",
                  onPress: performAccountDeletion,
                },
              ],
            );
          },
        },
      ],
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="More" dark />

      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={isTablet ? { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" } : null}>
        {/*
          ── Subscription card ──
          Always visible at the top of "More" so users can find their plan
          status (or upgrade) at a glance. While the identity-linked RC check
          is pending, show a neutral skeleton to avoid flashing "Upgrade to Pro"
          at Pro users. Once confirmed: Pro = status card, Free = upgrade CTA.
        */}
        {!isIdentityLinked ? (
          <View
            style={[
              s.subscriptionCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <View style={[s.subscriptionIcon, { backgroundColor: colors.border, opacity: 0.4 }]} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={{ height: 14, width: 110, backgroundColor: colors.border, borderRadius: 4, opacity: 0.5 }} />
              <View style={{ height: 11, width: 70, backgroundColor: colors.border, borderRadius: 4, opacity: 0.3 }} />
            </View>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              if (effectivePro) {
                Alert.alert(
                  "knowyourpit Pro",
                  isPro && expirationDate
                    ? `Your subscription renews on ${expirationDate.toLocaleDateString()}. Manage in your App Store / Play Store account.`
                    : "Your Pro access is active. Manage your subscription in your App Store / Play Store account.",
                );
              } else {
                router.push("/pro-features" as any);
              }
            }}
            style={({ pressed }) => [
              s.subscriptionCard,
              {
                backgroundColor: effectivePro ? colors.card : "#E84520",
                borderColor: effectivePro ? colors.border : "#E84520",
                borderRadius: colors.radius,
              },
              pressed && { opacity: 0.85 },
            ]}
          >
            <View style={[s.subscriptionIcon, { backgroundColor: effectivePro ? "#E8452020" : "rgba(255,255,255,0.2)" }]}>
              <Feather name={effectivePro ? "award" : "zap"} size={20} color={effectivePro ? "#E84520" : "#fff"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.subscriptionTitle, { color: effectivePro ? colors.foreground : "#fff" }]}>
                {effectivePro ? "knowyourpit Pro" : "Upgrade to Pro"}
              </Text>
              <Text style={[s.subscriptionSub, { color: effectivePro ? colors.mutedForeground : "rgba(255,255,255,0.85)" }]}>
                {effectivePro
                  ? isPro && expirationDate
                    ? `Renews ${expirationDate.toLocaleDateString()}`
                    : "Active subscription"
                  : "Unlimited cooks, AI, multi-cook, devices"}
              </Text>
            </View>
            <Feather name="chevron-right" size={18} color={effectivePro ? colors.mutedForeground : "rgba(255,255,255,0.85)"} />
          </Pressable>
        )}

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

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>Help</Text>
          <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.7 }]}
              onPress={() => router.push(ONBOARDING_REPLAY_HREF)}
            >
              <View style={[s.menuIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="play-circle" size={16} color={colors.primary} />
              </View>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>Replay onboarding</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.7 }]}
              onPress={() => setSupportModalVisible(true)}
            >
              <View style={[s.menuIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="mail" size={16} color={colors.primary} />
              </View>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>Contact support</Text>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

        <View style={s.section}>
          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>Legal</Text>
          <View style={[s.sectionCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.7 }]}
              onPress={() => Linking.openURL("https://knowyourpit.com/privacy")}
            >
              <View style={[s.menuIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="shield" size={16} color={colors.primary} />
              </View>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>Privacy Policy</Text>
              <Feather name="external-link" size={16} color={colors.mutedForeground} />
            </Pressable>
            <View style={[s.divider, { backgroundColor: colors.border }]} />
            <Pressable
              style={({ pressed }) => [s.menuItem, pressed && { opacity: 0.7 }]}
              onPress={() => Linking.openURL("https://knowyourpit.com/terms")}
            >
              <View style={[s.menuIcon, { backgroundColor: colors.primary + "20" }]}>
                <Feather name="file-text" size={16} color={colors.primary} />
              </View>
              <Text style={[s.menuLabel, { color: colors.foreground }]}>Terms of Service</Text>
              <Feather name="external-link" size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </View>

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

        <Pressable
          style={({ pressed }) => [
            s.deleteAccountBtn,
            { borderRadius: colors.radius },
            (pressed || deleting) && { opacity: 0.6 },
          ]}
          onPress={handleDeleteAccount}
          disabled={deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color={colors.destructive} />
          ) : (
            <Text style={[s.deleteAccountText, { color: colors.destructive }]}>
              Delete Account
            </Text>
          )}
        </Pressable>
        </View>
      </ScrollView>

      <SupportModal
        visible={supportModalVisible}
        onClose={() => setSupportModalVisible(false)}
        prefillName={
          (user?.unsafeMetadata?.displayName as string | undefined) ||
          user?.fullName ||
          user?.firstName ||
          ""
        }
        prefillEmail={user?.emailAddresses?.[0]?.emailAddress || ""}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
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
  deleteAccountBtn: {
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginTop: 4, marginBottom: 24, paddingVertical: 12,
    minHeight: 40,
  },
  deleteAccountText: {
    fontSize: 13, fontFamily: "Inter_500Medium", textDecorationLine: "underline",
  },
  restoreBtn: {
    alignItems: "center", justifyContent: "center",
    marginHorizontal: 16, marginBottom: 16, paddingVertical: 10,
    minHeight: 36,
  },
  restoreBtnText: { fontSize: 13, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
