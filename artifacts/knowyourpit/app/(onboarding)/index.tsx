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
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { type Href, useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const ONBOARDING_SEEN_KEY = "knowyourpit:hasSeenOnboarding";

const MORE_HREF = "/(tabs)/more" as Href;

const { width: SCREEN_W } = Dimensions.get("window");
const BRAND_ORANGE = "#E84820";
const SUPPORT_EMAIL = "support@knowyourpit.com";
const APP_STORE_URL = "itms-apps://itunes.apple.com/app/id6738518044";

const logoImg = require("@/assets/images/logo.png");

type FeatherIconName = React.ComponentProps<typeof Feather>["name"];

interface FeatureGridItem {
  icon: FeatherIconName;
  label: string;
}

interface Slide {
  id: string;
  icon: FeatherIconName;
  iconColor: string;
  iconBg: readonly [string, string];
  iconGlow: string;
  headline: string;
  body: string;
  emailLink?: boolean;
  featureGrid?: FeatureGridItem[];
}

// Icon box backgrounds — dark so they pop against the warm orange gradient bg.
const ORANGE_BG: readonly [string, string] = ["#2A1810", "#1A1008"];
const ORANGE_GLOW = "rgba(232,72,32,0.35)";
const AMBER_BG: readonly [string, string] = ["#2A1E08", "#1A1205"];
const AMBER_GLOW = "rgba(245,158,11,0.3)";

const SLIDES: Slide[] = [
  {
    id: "welcome",
    icon: "thermometer",
    iconColor: "#FCD34D",
    iconBg: ["#2A1C04", "#1A1002"],
    iconGlow: "rgba(252,211,77,0.35)",
    headline: "Welcome, Pitmaster.",
    body: "You've got the pit. We've got the plan. Every cook, better than the last.",
  },
  {
    id: "plan",
    icon: "calendar",
    iconColor: "#F97316",
    iconBg: ["#2A1808", "#1A1005"],
    iconGlow: "rgba(249,115,22,0.35)",
    headline: "Plan. Log. Repeat.",
    body: "An AI cook timeline, a running log of every session, and a live picture of your pit — all in one place.",
    featureGrid: [
      { icon: "calendar", label: "Cook plan" },
      { icon: "clipboard", label: "Cook log" },
      { icon: "cpu", label: "Your grill" },
    ],
  },
  {
    id: "ai",
    icon: "zap",
    iconColor: "#F59E0B",
    iconBg: AMBER_BG,
    iconGlow: AMBER_GLOW,
    headline: "PitMaster's got your back",
    body: "Ask anything mid-cook — wood pairings, stall strategies, or just 'is this brisket done?' PitMaster knows your pit.",
  },
  {
    id: "feedback",
    icon: "star",
    iconColor: "#F59E0B",
    iconBg: AMBER_BG,
    iconGlow: AMBER_GLOW,
    headline: "You're one of our first 🔥",
    body: "Your feedback shapes everything we build next. Spotted something off? Have an idea? We're listening.",
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

function FeatureGrid({ items }: { items: FeatureGridItem[] }) {
  return (
    <View style={s.featureGrid}>
      {items.map((item) => (
        <LinearGradient
          key={item.icon}
          colors={["#2A1808", "#1A1005"]}
          style={s.featureChip}
        >
          <Feather name={item.icon} size={28} color="#F97316" />
          <Text style={s.featureChipLabel}>{item.label}</Text>
        </LinearGradient>
      ))}
    </View>
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

  function handleRateApp() {
    Linking.openURL(APP_STORE_URL).catch(() => {});
  }

  return (
    <View style={s.slide}>
      {slide.featureGrid ? (
        <FeatureGrid items={slide.featureGrid} />
      ) : (
        <IconBox slide={slide} />
      )}

      <Text style={s.headline}>{slide.headline}</Text>
      <Text style={s.body}>{slide.body}</Text>

      {slide.emailLink && (
        <>
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
        </>
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
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const isReplay = replay === "1";
  const flatRef = useRef<FlatList<Slide>>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const isLast = currentIndex === SLIDES.length - 1;

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || isReplay) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => true);
      return () => sub.remove();
    }, [isReplay])
  );

  async function finish() {
    if (saving) return;
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

  function skipToEnd() {
    const lastIdx = SLIDES.length - 1;
    flatRef.current?.scrollToIndex({ index: lastIdx, animated: true });
    setCurrentIndex(lastIdx);
  }

  function goPrev() {
    if (currentIndex === 0) return;
    const prev = currentIndex - 1;
    flatRef.current?.scrollToIndex({ index: prev, animated: true });
    setCurrentIndex(prev);
  }

  function goNext() {
    if (isLast) {
      finish();
      return;
    }
    const next = currentIndex + 1;
    flatRef.current?.scrollToIndex({ index: next, animated: true });
    setCurrentIndex(next);
  }

  function onMomentumScrollEnd(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const offset = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offset / SCREEN_W);
    setCurrentIndex(idx);
  }

  return (
    <LinearGradient
      colors={["#E84820", "#B83018", "#7A1E08", "#1A0A04", "#0D0D10"]}
      locations={[0, 0.18, 0.38, 0.62, 1.0]}
      style={s.root}
    >
      {/* Skip — top-right */}
      <Pressable
        style={[s.skipBtn, { top: insets.top + 16 }]}
        onPress={isLast ? finish : skipToEnd}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isLast ? "Dismiss onboarding" : "Skip to last slide"}
      >
        <Text style={s.skipText}>Skip</Text>
      </Pressable>

      {/* Top-left: close in replay, logo in first-run */}
      {isReplay ? (
        <Pressable
          style={[s.closeBtn, { top: insets.top + 12 }]}
          onPress={() => router.replace(MORE_HREF)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close walkthrough"
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

        {/* CTA row */}
        <View style={s.ctaRow}>
          {isReplay && currentIndex > 0 ? (
            <Pressable
              style={({ pressed }) => [s.backBtn, pressed && { opacity: 0.7 }]}
              onPress={goPrev}
              accessibilityRole="button"
              accessibilityLabel="Previous slide"
            >
              <Feather name="chevron-left" size={20} color="#FFFFFF" />
              <Text style={s.backText}>Back</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={({ pressed }) => [
              s.ctaBtn,
              isReplay && currentIndex > 0 ? s.ctaBtnFlex : s.ctaBtnFull,
              pressed && { opacity: 0.88 },
            ]}
            onPress={goNext}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel={isLast ? "Let's go" : "Next slide"}
          >
            <View style={s.ctaInner}>
              <Text style={s.ctaText}>
                {isLast ? "Let's go! 🔥" : "Next →"}
              </Text>
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
    height: 28,
    opacity: 0.85,
    tintColor: "#FFFFFF",
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
    borderColor: "rgba(255,255,255,0.10)",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 48,
    shadowOpacity: 1,
    elevation: 16,
  },
  featureGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 36,
  },
  featureChip: {
    width: 72,
    height: 72,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    shadowColor: "rgba(249,115,22,0.35)",
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 24,
    shadowOpacity: 1,
    elevation: 10,
  },
  featureChipLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
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
  emailHint: {
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
