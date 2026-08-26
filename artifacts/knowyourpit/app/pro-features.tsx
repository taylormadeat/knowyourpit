import React, { useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePaywall } from "@/contexts/PaywallContext";
import { AppHeader } from "@/components/AppHeader";

function inferPlanType(expirationDate: Date | null): "Annual" | "Monthly" | null {
  if (!expirationDate) return null;
  const daysUntilExpiry = (expirationDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysUntilExpiry > 60 ? "Annual" : "Monthly";
}

// ── Feature preview components ──────────────────────────────────────────────

function MultiCookPreview({ colors }: { colors: any }) {
  const grills = [
    {
      name: "Weber 22\"",
      items: [
        { label: "Brisket", color: "#E84520", pct: 0.65 },
        { label: "Ribs", color: "#F59E0B", pct: 0.35 },
      ],
    },
    {
      name: "Pit Boss 820",
      items: [
        { label: "Pork Butt", color: "#8B5CF6", pct: 0.5 },
        { label: "Chicken", color: "#22C55E", pct: 0.5 },
      ],
    },
  ];
  return (
    <View style={pv.multiCookWrap}>
      {grills.map((g) => (
        <View key={g.name} style={pv.grillRow}>
          <View style={pv.grillHeader}>
            <Feather name="wind" size={12} color="rgba(255,255,255,0.5)" />
            <Text style={pv.grillName}>{g.name}</Text>
          </View>
          <View style={pv.timelineBar}>
            {g.items.map((it) => (
              <View
                key={it.label}
                style={[pv.timelineSegment, { flex: it.pct, backgroundColor: it.color }]}
              >
                <Text style={pv.segmentLabel} numberOfLines={1}>{it.label}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function AIPitmasterPreview({ colors }: { colors: any }) {
  return (
    <View style={pv.chatWrap}>
      <View style={[pv.bubbleUser, { backgroundColor: "#E84520" }]}>
        <Text style={pv.bubbleUserText}>Pork shoulder is at 195°F and hasn't moved in 20 minutes. Is it done?</Text>
      </View>
      <View style={pv.bubbleAI}>
        <View style={pv.aiHeader}>
          <View style={pv.aiAvatar}><Feather name="cpu" size={10} color="#fff" /></View>
          <Text style={pv.aiName}>PitMaster</Text>
        </View>
        <Text style={pv.bubbleAIText}>Not yet — probe test it. Slide a temp probe into the thickest part: if it meets any resistance, give it another 30 minutes. You're looking for zero resistance, like pushing through warm butter. Temperature is a guide; probe feel is the call.</Text>
      </View>
    </View>
  );
}


function WeatherPreview({ colors }: { colors: any }) {
  return (
    <View style={pv.weatherWrap}>
      <View style={pv.weatherTop}>
        <Feather name="cloud" size={24} color="#60A5FA" />
        <View style={pv.weatherInfo}>
          <Text style={pv.weatherTemp}>47°F · Partly Cloudy</Text>
          <Text style={pv.weatherSub}>Wind 12 mph NW · Humidity 68%</Text>
        </View>
      </View>
      <View style={pv.weatherTip}>
        <Feather name="alert-circle" size={14} color="#F59E0B" />
        <Text style={pv.weatherTipText}>Add 30–40 min for cold wind today</Text>
      </View>
      <View style={pv.weatherHours}>
        {["6am","9am","12pm","3pm","6pm"].map((h, i) => (
          <View key={h} style={pv.weatherHour}>
            <Text style={pv.weatherHourTime}>{h}</Text>
            <Feather name={i === 2 ? "sun" : "cloud"} size={14} color={i === 2 ? "#FACC15" : "#94A3B8"} />
            <Text style={pv.weatherHourTemp}>{44 + i * 2}°</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function ProbeAutoGradePreview({ colors }: { colors: any }) {
  const devices = [
    { label: "Inkbird IBT-4XS", type: "BLE", typeColor: "#3B82F6", temp: "168°F", dot: "#E84520" },
    { label: "Fireboard 2 · Ch1", type: "WiFi", typeColor: "#0EA5E9", temp: "241°F", dot: "#F59E0B" },
  ];
  return (
    <View style={pv.probeWrap}>
      {devices.map((d) => (
        <View key={d.label} style={pv.probeCard}>
          <View style={pv.probeRow}>
            <View style={[pv.probeDot, { backgroundColor: d.dot }]} />
            <Text style={pv.probeName}>{d.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99, backgroundColor: d.typeColor + "20" }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: d.typeColor }}>{d.type}</Text>
            </View>
            <Text style={[pv.probeTemp, { color: d.dot }]}>{d.temp}</Text>
          </View>
        </View>
      ))}
      <View style={pv.probeCheckin}>
        <Feather name="cpu" size={14} color="#22C55E" />
        <Text style={pv.probeCheckinText}>PitMaster auto-graded at 30 min · "Brisket on track — grill temp running 10° high"</Text>
      </View>
    </View>
  );
}

function UnlimitedCooksPreview({ colors }: { colors: any }) {
  const cooks = [
    { food: "Brisket", date: "May 8", rating: 5 },
    { food: "Pork Butt", date: "Apr 30", rating: 4 },
    { food: "Baby Back Ribs", date: "Apr 19", rating: 5 },
  ];
  return (
    <View style={pv.cookListWrap}>
      {cooks.map((c, i) => (
        <View key={i} style={[pv.cookRow, { borderBottomColor: "rgba(255,255,255,0.08)", borderBottomWidth: i < cooks.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
          <View style={pv.cookIcon}>
            <Feather name="award" size={16} color="#E84520" />
          </View>
          <View style={pv.cookInfo}>
            <Text style={pv.cookFood}>{c.food}</Text>
            <Text style={pv.cookDate}>{c.date}</Text>
          </View>
          <View style={pv.cookStars}>
            {[1,2,3,4,5].map((n) => (
              <Feather key={n} name="star" size={10} color={n <= c.rating ? "#FACC15" : "rgba(255,255,255,0.2)"} />
            ))}
          </View>
        </View>
      ))}
      <Text style={pv.cookUnlimited}>+ unlimited more</Text>
    </View>
  );
}

function FrozenPlannerPreview({ colors }: { colors: any }) {
  const steps = [
    { label: "Thaw in fridge", time: "36 hrs", color: "#60A5FA", done: true },
    { label: "Temper at room temp", time: "2 hrs", color: "#F59E0B", done: true },
    { label: "Fire up your pit", time: "6:00 AM", color: "#E84520", done: false },
    { label: "Serve", time: "6:00 PM", color: "#22C55E", done: false },
  ];
  return (
    <View style={pv.frozenWrap}>
      <View style={pv.frozenBadge}>
        <Feather name="thermometer" size={12} color="#60A5FA" />
        <Text style={pv.frozenBadgeText}>Frozen brisket · Cook from frozen</Text>
      </View>
      {steps.map((step, i) => (
        <View key={i} style={pv.frozenStep}>
          <View style={[pv.frozenStepLine, { backgroundColor: i < steps.length - 1 ? "rgba(255,255,255,0.15)" : "transparent" }]} />
          <View style={[pv.frozenStepDot, { backgroundColor: step.done ? step.color : "transparent", borderColor: step.done ? step.color : "rgba(255,255,255,0.2)" }]}>
            {step.done && <Feather name="check" size={10} color="#fff" />}
          </View>
          <View style={pv.frozenStepText}>
            <Text style={[pv.frozenLabel, { color: step.done ? "#FFFFFF" : "rgba(255,255,255,0.5)" }]}>{step.label}</Text>
            <Text style={[pv.frozenTime, { color: step.done ? step.color : "rgba(255,255,255,0.3)" }]}>{step.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "multicook",
    headline: "Multi-Cook Sequencer",
    benefit: "Plan brisket, ribs, pork, and sides across multiple grills on one unified timeline.",
    Preview: MultiCookPreview,
  },
  {
    id: "ai",
    headline: "AI PitMaster — 20 Chats/Day + Unlimited Photo Scans",
    benefit: "Get up to 20 real-time chat messages each day, plus unlimited photo-based cook analysis and guidance from PitMaster.",
    Preview: AIPitmasterPreview,
  },
  {
    id: "weather",
    headline: "Cook-Day Weather Forecast",
    benefit: "See wind, cold, and humidity before you fire up so you can adjust your cook time accordingly.",
    Preview: WeatherPreview,
  },
  {
    id: "probe",
    headline: "Live Thermometer Connection",
    benefit: "Connect any thermometer — Inkbird, Govee, Fireboard, and more — via Bluetooth or WiFi. PitMaster auto-grades every 30 minutes using live temperatures.",
    Preview: ProbeAutoGradePreview,
  },
  {
    id: "unlimited",
    headline: "Unlimited Cooks, Photo Scans & History",
    benefit: "Log every cook, analyze every photo, and build a full cook history with no caps.",
    Preview: UnlimitedCooksPreview,
  },
  {
    id: "frozen",
    headline: "Frozen-to-Table Planner",
    benefit: "Full timeline from freezer to table — every thaw, temper, and smoke step timed perfectly.",
    Preview: FrozenPlannerPreview,
  },
];

// ── Showcase screen ───────────────────────────────────────────────────────────

export default function ProFeaturesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showPaywall, resumePaywall, isPaywallPaused } = usePaywall();
  const effectivePro = useEffectivePro();
  const { isPro, isInTrial, expirationDate } = useSubscription();

  const planType = useMemo(() => inferPlanType(expirationDate), [expirationDate]);

  const isPaywallPausedRef = useRef(isPaywallPaused);
  isPaywallPausedRef.current = isPaywallPaused;

  useFocusEffect(
    useCallback(() => {
      return () => {
        if (isPaywallPausedRef.current) {
          resumePaywall();
        }
      };
    }, [resumePaywall]),
  );

  const handleUnlockPro = useCallback(() => {
    if (isPaywallPausedRef.current) {
      router.back();
    } else {
      router.back();
      setTimeout(() => showPaywall(), 80);
    }
  }, [router, showPaywall]);

  const FOOTER_HEIGHT = effectivePro ? 100 : 88;

  return (
    <View style={s.container}>
      <AppHeader title="knowyourpit Pro" showBack dark />

      <ScrollView
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={["#3A1F12", "#18181A", "#0D0D10"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroBadge}>
            <Feather name="award" size={14} color="#E84520" />
            <Text style={s.heroBadgeText}>knowyourpit PRO</Text>
          </View>
          <Text style={s.heroTitle}>Everything you need to cook like a pro.</Text>
          <Text style={s.heroSub}>One subscription unlocks all of these features — including unlimited cooks, photo scans, and cook history.</Text>
        </LinearGradient>

        {/* Feature cards */}
        {FEATURES.map(({ id, headline, benefit, Preview }) => (
          <View key={id} style={s.card}>
            <View style={s.previewArea}>
              <Preview colors={colors} />
            </View>
            <View style={s.cardBody}>
              <Text style={s.cardHeadline}>{headline}</Text>
              <Text style={s.cardBenefit}>{benefit}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sticky pricing footer */}
      <View style={[s.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {effectivePro ? (
          // ── Pro member state ──────────────────────────────────────────
          <View style={s.proConfirm}>
            <View style={s.proConfirmIcon}>
              <Feather name="check-circle" size={20} color="#22C55E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.proConfirmTitle}>
                You're already Pro
                {planType ? ` · ${planType}` : ""}
              </Text>
              {isInTrial && expirationDate ? (
                <Text style={s.proConfirmSub}>
                  Trial ends {expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Cancel anytime
                </Text>
              ) : isPro && expirationDate ? (
                <Text style={s.proConfirmSub}>
                  Renews {expirationDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Manage in{" "}
                  <Text
                    style={s.proConfirmLink}
                    onPress={() =>
                      Linking.openURL(
                        Platform.OS === "ios"
                          ? "itms-apps://apps.apple.com/account/subscriptions"
                          : "https://play.google.com/store/account/subscriptions",
                      )
                    }
                  >
                    {Platform.OS === "ios" ? "App Store" : "Play Store"}
                  </Text>
                </Text>
              ) : (
                <Text style={s.proConfirmSub}>Active subscription</Text>
              )}
            </View>
          </View>
        ) : (
          // ── Single CTA for free users — pricing details are in the PaywallModal ──
          <Pressable
            style={({ pressed }) => [s.unlockBtn, pressed && { opacity: 0.85 }]}
            onPress={handleUnlockPro}
          >
            <Feather name="zap" size={16} color="#fff" />
            <Text style={s.unlockBtnText}>Unlock Pro →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Preview sub-styles ────────────────────────────────────────────────────────

const pv = StyleSheet.create({
  // Multi-cook
  multiCookWrap: { gap: 12, padding: 16 },
  grillRow: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8, borderColor: "rgba(255,255,255,0.08)", backgroundColor: "rgba(255,255,255,0.02)" },
  grillHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  grillName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  timelineBar: { flexDirection: "row", height: 24, borderRadius: 6, overflow: "hidden" },
  timelineSegment: { alignItems: "center", justifyContent: "center" },
  segmentLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // AI PitMaster
  chatWrap: { gap: 12, padding: 16 },
  bubbleUser: { alignSelf: "flex-end", maxWidth: "80%", borderRadius: 16, borderBottomRightRadius: 4, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleUserText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#fff", lineHeight: 18 },
  bubbleAI: { alignSelf: "flex-start", maxWidth: "90%", borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, gap: 6, backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  aiAvatar: { width: 18, height: 18, borderRadius: 9, backgroundColor: "#E84520", alignItems: "center", justifyContent: "center" },
  aiName: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.7)" },
  bubbleAIText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, color: "#FFFFFF" },

  // Weather
  weatherWrap: { margin: 16, borderRadius: 14, borderWidth: 1, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" },
  weatherTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  weatherInfo: { flex: 1 },
  weatherTemp: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  weatherSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  weatherTip: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 14, marginBottom: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(245,158,11,0.1)", borderColor: "rgba(245,158,11,0.2)" },
  weatherTipText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, color: "#F59E0B" },
  weatherHours: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 10, paddingBottom: 14 },
  weatherHour: { alignItems: "center", gap: 4 },
  weatherHourTime: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  weatherHourTemp: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },

  // Live probe
  probeWrap: { padding: 16, gap: 12 },
  probeCard: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 8, backgroundColor: "rgba(255,255,255,0.02)", borderColor: "rgba(255,255,255,0.08)" },
  probeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  probeDot: { width: 10, height: 10, borderRadius: 5 },
  probeName: { flex: 1, fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  probeTemp: { fontSize: 18, fontFamily: "Inter_700Bold" },
  probeCheckin: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: "rgba(34,197,94,0.1)", borderColor: "rgba(34,197,94,0.2)" },
  probeCheckinText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 18, color: "#22C55E" },

  // Unlimited cooks
  cookListWrap: { paddingHorizontal: 16, paddingVertical: 12 },
  cookRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  cookIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(232,69,32,0.1)" },
  cookInfo: { flex: 1 },
  cookFood: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  cookDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  cookStars: { flexDirection: "row", gap: 3 },
  cookUnlimited: { fontSize: 12, fontFamily: "Inter_500Medium", textAlign: "center", paddingTop: 8, color: "rgba(255,255,255,0.5)" },

  // Frozen planner
  frozenWrap: { padding: 16, gap: 16 },
  frozenBadge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: "rgba(96,165,250,0.1)", borderColor: "rgba(96,165,250,0.2)" },
  frozenBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#60A5FA" },
  frozenStep: { flexDirection: "row", alignItems: "flex-start", gap: 12, position: "relative" },
  frozenStepLine: { position: "absolute", left: 11, top: 22, width: 1, height: 28, backgroundColor: "rgba(255,255,255,0.1)" },
  frozenStepDot: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 0 },
  frozenStepText: { flex: 1, gap: 2 },
  frozenLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#FFFFFF" },
  frozenTime: { fontSize: 12, fontFamily: "Inter_700Bold" },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0D10" },
  hero: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 32 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,69,32,0.15)", paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 12, alignSelf: "flex-start", marginBottom: 16,
    borderWidth: 1, borderColor: "rgba(232,69,32,0.3)"
  },
  heroBadgeText: { color: "#E84520", fontSize: 12, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  heroTitle: { color: "#FFFFFF", fontSize: 26, fontFamily: "Inter_700Bold", marginBottom: 10, lineHeight: 32, letterSpacing: -0.5 },
  heroSub: { color: "rgba(255,255,255,0.7)", fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },

  card: { marginHorizontal: 20, marginTop: 24, borderWidth: 1, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)", borderRadius: 24 },
  previewArea: { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.05)" },
  cardBody: { padding: 20, gap: 6 },
  cardHeadline: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: "#FFFFFF", letterSpacing: -0.3 },
  cardBenefit: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22, color: "rgba(255,255,255,0.6)" },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, paddingTop: 16, paddingHorizontal: 20,
    backgroundColor: "rgba(13,13,16,0.9)",
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  unlockBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#E84520", paddingVertical: 16, borderRadius: 16,
    shadowColor: "#E84520", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },
  unlockBtnText: { color: "#FFFFFF", fontSize: 17, fontFamily: "Inter_700Bold" },

  proConfirm: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderWidth: 1, padding: 16, borderRadius: 16,
    backgroundColor: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.2)"
  },
  proConfirmIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,197,94,0.15)" },
  proConfirmTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#FFFFFF" },
  proConfirmSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 4, lineHeight: 18, color: "rgba(255,255,255,0.6)" },
  proConfirmLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)", textDecorationLine: "underline" },
});
