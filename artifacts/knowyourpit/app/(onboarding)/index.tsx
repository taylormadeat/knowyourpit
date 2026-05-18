import React, { useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Alert,
  Linking,
  Platform,
  BackHandler,
  Dimensions,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Shared AsyncStorage key — also checked by the nav guard in _layout.tsx so a
// failed Clerk write doesn't bounce the user back into onboarding on next launch.
export const ONBOARDING_SEEN_KEY = "knowyourpit:hasSeenOnboarding";

const { width: SCREEN_W } = Dimensions.get("window");
const BRAND_ORANGE = "#E84820";
const SUPPORT_EMAIL = "support@knowyourpit.com";

const logoImg = require("@/assets/images/logo.png");

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface Slide {
  id: string;
  icon: FeatherIconName;
  iconColor: string;
  iconBg: readonly [string, string];
  iconGlow: string;
  headline: string;
  body: string;
  emailLink?: boolean;
}

const SLIDES: Slide[] = [
  {
    id: "welcome",
    icon: "activity",
    iconColor: BRAND_ORANGE,
    iconBg: ["#2A1810", "#1A1008"],
    iconGlow: "rgba(232,72,32,0.22)",
    headline: "Your AI BBQ companion",
    body: "knowyourpit is built for pitmasters like you — and we're just getting started. Your cooks, your feedback, and your ideas are what make it better.",
  },
  {
    id: "plan",
    icon: "calendar",
    iconColor: "#3B82F6",
    iconBg: ["#0D1F3C", "#071428"],
    iconGlow: "rgba(59,130,246,0.2)",
    headline: "Plan every cook",
    body: "Log your meat, grill, and target temp and get an AI-powered cook timeline. Adjust on the fly as your pit does its thing.",
  },
  {
    id: "log",
    icon: "clipboard",
    iconColor: "#22C55E",
    iconBg: ["#0D2A1A", "#071810"],
    iconGlow: "rgba(34,197,94,0.18)",
    headline: "Track your progress",
    body: "Log your cooks and watch your technique improve. Every session builds a picture of what works on your pit.",
  },
  {
    id: "grills",
    icon: "wind",
    iconColor: "#A855F7",
    iconBg: ["#1C0F2E", "#130A20"],
    iconGlow: "rgba(168,85,247,0.18)",
    headline: "Know your grill",
    body: "Add each of your grills and knowyourpit learns how they run — hot spots, pace, and bias — so every plan fits your actual pit.",
  },
  {
    id: "ai",
    icon: "zap",
    iconColor: "#F59E0B",
    iconBg: ["#2A1E08", "#1A1205"],
    iconGlow: "rgba(245,158,11,0.2)",
    headline: "PitMaster AI at your side",
    body: "Ask anything — wood pairings, stall strategies, temp troubleshooting. PitMaster knows BBQ and knows your pit.",
  },
  {
    id: "feedback",
    icon: "mail",
    iconColor: BRAND_ORANGE,
    iconBg: ["#2A1810", "#1A1008"],
    iconGlow: "rgba(232,72,32,0.22)",
    headline: "You're one of our first",
    body: "That means your feedback matters most. Spotted something off? Have an idea? Send us a note — screenshots welcome.",
    emailLink: true,
  },
];

function IconBox({ slide }: { slide: Slide }) {
  return (
    <LinearGradient
      colors={slide.iconBg as [string, string]}
      style={[s.iconBox, { shadowColor: slide.iconGlow }]}
    >
      <Feather name={slide.icon} size={48} color={slide.iconColor} />
    </LinearGradient>
  );
}

function SlideView({ slide, isLast }: { slide: Slide; isLast: boolean }) {
  function handleEmail() {
    const url = `mailto:${SUPPORT_EMAIL}?subject=knowyourpit%20feedback`;
    Linking.canOpenURL(url)
      .then((ok) => {
        if (ok) return Linking.openURL(url);
        Alert.alert("No mail app found", `Email us at ${SUPPORT_EMAIL}`);
      })
      .catch(() => Alert.alert("No mail app found", `Email us at ${SUPPORT_EMAIL}`));
  }

  return (
    <View style={s.slide}>
      <IconBox slide={slide} />

      <Text style={s.headline}>{slide.headline}</Text>
      <Text style={s.body}>{slide.body}</Text>

      {slide.emailLink && (
        <Pressable
          onPress={handleEmail}
          style={s.emailBtn}
          accessibilityRole="link"
          accessibilityLabel={`Send feedback to ${SUPPORT_EMAIL}`}
        >
          <Feather name="mail" size={14} color={BRAND_ORANGE} />
          <Text style={s.emailText}>{SUPPORT_EMAIL}</Text>
        </Pressable>
      )}

      {isLast && (
        <Text style={s.emailHint}>We read everything.</Text>
      )}
    </View>
  );
}

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const flatRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const isLast = currentIndex === SLIDES.length - 1;

  // Block Android hardware back button — users must complete or skip
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [])
  );

  async function markSeen() {
    if (saving) return;
    setSaving(true);
    // Write AsyncStorage immediately as a local fallback — guards against
    // redirect loops if the app is killed or restarted before Clerk syncs.
    AsyncStorage.setItem(ONBOARDING_SEEN_KEY, "1").catch(() => {});
    // Await the Clerk metadata write so the flag persists across devices/installs.
    // Proceed regardless of outcome — AsyncStorage prevents loops on this device.
    if (user) {
      try {
        await user.update({
          unsafeMetadata: {
            ...(user.unsafeMetadata ?? {}),
            hasSeenOnboarding: true,
          },
        });
      } catch {
        // Network or Clerk error — local AsyncStorage flag still prevents the guard
        // from re-routing on this device. The flag will sync on the next successful
        // Clerk call (e.g., sign-in on a fresh install).
      }
    }
    setSaving(false);
    router.replace("/(tabs)");
  }

  function skipToEnd() {
    const lastIdx = SLIDES.length - 1;
    flatRef.current?.scrollToIndex({ index: lastIdx, animated: true });
    setCurrentIndex(lastIdx);
  }

  function goNext() {
    if (isLast) {
      markSeen();
      return;
    }
    const next = currentIndex + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  }

  function onMomentumScrollEnd(e: any) {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SCREEN_W);
    setCurrentIndex(idx);
  }

  return (
    <View style={[s.root, { backgroundColor: "#0D0D10" }]}>
      {/* Skip — top-right (jumps to the last/feedback slide, not exits) */}
      <Pressable
        style={[s.skipBtn, { top: insets.top + 16 }]}
        onPress={isLast ? markSeen : skipToEnd}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isLast ? "Dismiss onboarding" : "Skip to last slide"}
      >
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      {/* Logo watermark top-left */}
      <Image
        source={logoImg}
        style={[s.watermark, { top: insets.top + 14 }]}
        resizeMode="contain"
        accessible={false}
      />

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(s) => s.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={onMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <SlideView slide={item} isLast={index === SLIDES.length - 1} />
        )}
        style={s.pager}
      />

      {/* Bottom: dots + button */}
      <View style={[s.bottom, { paddingBottom: insets.bottom + 24 }]}>
        {/* Progress dots */}
        <View style={s.dots}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[
                s.dot,
                i === currentIndex ? s.dotActive : s.dotInactive,
              ]}
            />
          ))}
        </View>

        {/* CTA button */}
        <Pressable
          style={({ pressed }) => [s.ctaBtn, pressed && { opacity: 0.85 }]}
          onPress={goNext}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={isLast ? "Let's go" : "Next slide"}
        >
          <LinearGradient
            colors={["#E84820", "#C43018"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.ctaGradient}
          >
            <Text style={s.ctaText}>
              {isLast ? "Let's go! 🔥" : "Next →"}
            </Text>
          </LinearGradient>
        </Pressable>
      </View>
    </View>
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
    height: 28,
    opacity: 0.55,
    tintColor: "#F5EDE3",
  },
  skipBtn: {
    position: "absolute",
    right: 24,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#6B6560",
  },
  pager: {
    flex: 1,
  },
  slide: {
    width: SCREEN_W,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingTop: 80,
  },
  iconBox: {
    width: 112,
    height: 112,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 36,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 40,
    shadowOpacity: 1,
    elevation: 12,
  },
  headline: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#F5EDE3",
    textAlign: "center",
    lineHeight: 36,
    letterSpacing: -0.4,
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: "#7A6E68",
    textAlign: "center",
    lineHeight: 24,
    maxWidth: 300,
  },
  emailBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 18,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BRAND_ORANGE + "60",
    backgroundColor: BRAND_ORANGE + "10",
  },
  emailText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: BRAND_ORANGE,
  },
  emailHint: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#4A4038",
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
    backgroundColor: BRAND_ORANGE,
  },
  dotInactive: {
    width: 7,
    backgroundColor: "#2A2420",
  },
  ctaBtn: {
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: BRAND_ORANGE,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaGradient: {
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
  },
  ctaText: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.2,
  },
});
