import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
  Platform,
  BackHandler,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { type Href, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { signalOnboardingDone } from "@/app/_layout";

export const ONBOARDING_SEEN_KEY = "knowyourpit:hasSeenOnboarding";

const MORE_HREF = "/(tabs)/more" as Href;
const BRAND_ORANGE = "#E84820";
const SUPPORT_EMAIL = "support@knowyourpit.com";
const APP_STORE_URL = "itms-apps://itunes.apple.com/app/id6738518044";

const logoImg = require("@/assets/images/logo-light.png");

const FEATURES: { icon?: string; emoji?: string; label: string; color: string }[] = [
  { icon: "zap",            label: "AI Cook Plans",    color: "#FCD34D" },
  { icon: "message-circle", label: "PitMaster Coach",  color: "#F97316" },
  { icon: "thermometer",    label: "Live Temperature", color: "#60A5FA" },
  { icon: "book-open",      label: "Cook Logger",      color: "#34D399" },
  { icon: "wind",           label: "Frozen Planning",  color: "#A5F3FC" },
  { emoji: "🍢",            label: "Multi-Cook",       color: "#F472B6" },
];

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === "1";

  const [page, setPage] = useState<0 | 1>(0);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || isReplay) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [isReplay])
  );

  async function finish() {
    if (saving) return;
    signalOnboardingDone();
    if (isReplay) {
      router.replace(MORE_HREF);
      return;
    }
    setSaving(true);
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1").catch(() => {});
    if (user) {
      try {
        await user.update({
          unsafeMetadata: {
            ...(user.unsafeMetadata ?? {}),
            hasSeenOnboarding: true,
          },
        });
      } catch {
        // local AsyncStorage flag still prevents redirect loops
      }
    }
    setSaving(false);
    router.replace("/(tabs)");
  }

  function handleEmail() {
    const url = `mailto:${SUPPORT_EMAIL}?subject=knowyourpit%20feedback`;
    Linking.canOpenURL(url)
      .then((ok) => {
        if (ok) return Linking.openURL(url);
        Alert.alert("No mail app found", `Email us at ${SUPPORT_EMAIL}`);
      })
      .catch(() => Alert.alert("No mail app found", `Email us at ${SUPPORT_EMAIL}`));
  }

  function handleRateApp() {
    Linking.openURL(APP_STORE_URL).catch(() => {});
  }

  const isLast = page === 1;

  return (
    <LinearGradient
      colors={["#E84820", "#B83018", "#7A1E08", "#1A0A04", "#0D0D10"]}
      locations={[0, 0.18, 0.38, 0.62, 1.0]}
      style={s.root}
    >
      {/* Top-left: close in replay, logo in first-run */}
      {isReplay ? (
        <Pressable
          style={[s.closeBtn, { top: insets.top + 12 }]}
          onPress={() => router.replace(MORE_HREF)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Feather name="x" size={22} color="rgba(255,255,255,0.6)" />
        </Pressable>
      ) : (
        <Image
          source={logoImg}
          style={[s.watermark, { top: insets.top + 14 }]}
          resizeMode="contain"
          accessible={false}
        />
      )}

      {/* Skip / close top-right */}
      <Pressable
        style={[s.skipBtn, { top: insets.top + 16 }]}
        onPress={isLast ? finish : () => setPage(1)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isLast ? "Dismiss" : "Skip to next"}
      >
        <Text style={s.skipText}>{isLast ? "Done" : "Skip"}</Text>
      </Pressable>

      {/* Card */}
      <View style={s.cardWrap}>
        <View style={s.card}>
          {page === 0 ? (
            /* ── Page 1: Welcome + feature grid ──────── */
            <>
              <Text style={s.headline}>Welcome, Pitmaster.</Text>
              <View style={s.featureGrid}>
                {FEATURES.map((f) => (
                  <View key={f.label} style={s.featureTile}>
                    {f.emoji ? (
                      <Text style={s.featureEmoji}>{f.emoji}</Text>
                    ) : (
                      <Feather name={f.icon as any} size={18} color={f.color} />
                    )}
                    <Text style={s.featureLabel}>{f.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={s.body}>Everything you need. Nothing you don't.</Text>
            </>
          ) : (
            /* ── Page 2: Feedback ────────────────────── */
            <>
              <LinearGradient
                colors={["#2A1E08", "#1A1205"]}
                style={s.iconBox}
              >
                <Feather name="star" size={48} color="#F59E0B" />
              </LinearGradient>
              <Text style={s.headline}>You're one of our first 🔥</Text>
              <Text style={s.body}>
                Your feedback shapes everything we build next. Spotted something off? Have an idea? We're listening.
              </Text>
              <Pressable
                onPress={handleEmail}
                style={({ pressed }) => [s.emailBtn, pressed && { opacity: 0.88 }]}
                accessibilityRole="link"
                accessibilityLabel={`Send feedback to ${SUPPORT_EMAIL}`}
              >
                <Feather name="mail" size={16} color={BRAND_ORANGE} />
                <Text style={s.emailText}>{SUPPORT_EMAIL}</Text>
              </Pressable>
              {Platform.OS === "ios" && (
                <Pressable
                  onPress={handleRateApp}
                  style={({ pressed }) => [s.rateLink, pressed && { opacity: 0.7 }]}
                  accessibilityRole="link"
                  accessibilityLabel="Rate the app on the App Store"
                >
                  <Text style={s.rateLinkText}>Rate the app ★</Text>
                </Pressable>
              )}
              <Text style={s.hint}>We read everything.</Text>
            </>
          )}
        </View>
      </View>

      {/* Bottom: dots + CTA */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.dots}>
          {([0, 1] as const).map((i) => (
            <View
              key={i}
              style={[s.dot, i === page ? s.dotActive : s.dotInactive]}
            />
          ))}
        </View>

        <View style={s.ctaRow}>
          {isReplay && page === 1 ? (
            <Pressable
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
              onPress={() => setPage(0)}
              accessibilityRole="button"
              accessibilityLabel="Previous"
            >
              <Feather name="chevron-left" size={20} color="#FFFFFF" />
              <Text style={s.backText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              s.ctaBtn,
              isReplay && page === 1 ? s.ctaBtnFlex : s.ctaBtnFull,
              pressed && { opacity: 0.88 },
            ]}
            onPress={isLast ? finish : () => setPage(1)}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Let's go" : "Next"}
          >
            <View style={s.ctaInner}>
              <Text style={s.ctaText}>{isLast ? "Let's go! 🔥" : "Next →"}</Text>
            </View>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  watermark: {
    position: "absolute",
    left: 24,
    width: 80,
    height: 80,
    opacity: 0.85,
  },
  skipBtn: {
    position: "absolute",
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  closeBtn: {
    position: "absolute",
    left: 20,
    zIndex: 10,
    padding: 6,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.6)",
  },
  cardWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 36,
    borderRadius: 28,
    backgroundColor: "rgba(26,10,4,0.82)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 48,
    shadowOpacity: 1,
    elevation: 16,
  },
  headline: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 24,
    marginBottom: 20,
    width: "100%",
  },
  featureTile: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "47%",
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  featureLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.88)",
    flexShrink: 1,
  },
  featureEmoji: {
    fontSize: 18,
    lineHeight: 22,
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 24,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignSelf: "stretch",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  emailText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: BRAND_ORANGE,
  },
  rateLink: {
    marginTop: 14,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  rateLinkText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.55)",
    textDecorationLine: "underline",
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.4)",
  },
  bottom: {
    paddingHorizontal: 28,
    paddingTop: 20,
    gap: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  dot: {
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    width: 22,
    backgroundColor: "#FFFFFF",
  },
  dotInactive: {
    width: 7,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 54,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  backText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
  ctaBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  ctaBtnFull: {
    flex: 1,
  },
  ctaBtnFlex: {
    flex: 1,
  },
  ctaInner: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: BRAND_ORANGE,
    letterSpacing: 0.2,
  },
});
