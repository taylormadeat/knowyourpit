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
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
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

function CompetitionPreview({ colors }: { colors: any }) {
  const cats = [
    { label: "Chicken", time: "12:30", color: "#F59E0B" },
    { label: "Ribs", time: "1:02:15", color: "#E84520" },
    { label: "Pork", time: "2:15:00", color: "#22C55E" },
    { label: "Brisket", time: "3:48:30", color: "#8B5CF6" },
  ];
  return (
    <View style={pv.competitionWrap}>
      <View style={pv.competitionBadge}>
        <Feather name="award" size={11} color="#E84520" />
        <Text style={pv.competitionBadgeText}>COMPETITION MODE</Text>
      </View>
      <View style={pv.chipRow}>
        {cats.map((c) => (
          <View key={c.label} style={[pv.chip, { borderColor: c.color + "55", backgroundColor: c.color + "15" }]}>
            <View style={[pv.chipDot, { backgroundColor: c.color }]} />
            <View>
              <Text style={[pv.chipLabel, { color: colors.mutedForeground }]}>{c.label}</Text>
              <Text style={[pv.chipTime, { color: colors.foreground }]}>{c.time}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={[pv.turnInRow, { borderTopColor: colors.border }]}>
        <Feather name="clock" size={11} color={colors.mutedForeground} />
        <Text style={[pv.turnInText, { color: colors.mutedForeground }]}>Next turn-in: Chicken at 12:30 · Leave 6 min early</Text>
      </View>
    </View>
  );
}

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
        <View key={g.name} style={[pv.grillRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={pv.grillHeader}>
            <Feather name="wind" size={11} color={colors.mutedForeground} />
            <Text style={[pv.grillName, { color: colors.foreground }]}>{g.name}</Text>
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
        <Text style={pv.bubbleUserText}>My brisket stalled at 165°F for 2 hours. Should I wrap?</Text>
      </View>
      <View style={[pv.bubbleAI, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={pv.aiHeader}>
          <View style={pv.aiAvatar}><Feather name="cpu" size={10} color="#fff" /></View>
          <Text style={[pv.aiName, { color: colors.mutedForeground }]}>PitMaster</Text>
        </View>
        <Text style={[pv.bubbleAIText, { color: colors.foreground }]}>Yes — wrap now with butcher paper. The stall is just collagen converting. At 165°F you're right in the window. Expect to finish around 203°F in 2–3 more hours.</Text>
      </View>
    </View>
  );
}


function WeatherPreview({ colors }: { colors: any }) {
  return (
    <View style={[pv.weatherWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={pv.weatherTop}>
        <Feather name="cloud" size={22} color="#60A5FA" />
        <View style={pv.weatherInfo}>
          <Text style={[pv.weatherTemp, { color: colors.foreground }]}>47°F · Partly Cloudy</Text>
          <Text style={[pv.weatherSub, { color: colors.mutedForeground }]}>Wind 12 mph NW · Humidity 68%</Text>
        </View>
      </View>
      <View style={[pv.weatherTip, { backgroundColor: "#F59E0B18", borderColor: "#F59E0B44" }]}>
        <Feather name="alert-circle" size={12} color="#F59E0B" />
        <Text style={[pv.weatherTipText, { color: "#F59E0B" }]}>Add 30–40 min for cold wind today</Text>
      </View>
      <View style={pv.weatherHours}>
        {["6am","9am","12pm","3pm","6pm"].map((h, i) => (
          <View key={h} style={pv.weatherHour}>
            <Text style={[pv.weatherHourTime, { color: colors.mutedForeground }]}>{h}</Text>
            <Feather name={i === 2 ? "sun" : "cloud"} size={12} color={i === 2 ? "#FACC15" : "#94A3B8"} />
            <Text style={[pv.weatherHourTemp, { color: colors.foreground }]}>{44 + i * 2}°</Text>
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
        <View key={d.label} style={[pv.probeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={pv.probeRow}>
            <View style={[pv.probeDot, { backgroundColor: d.dot }]} />
            <Text style={[pv.probeName, { color: colors.foreground }]}>{d.label}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, backgroundColor: d.typeColor + "20" }}>
              <Text style={{ fontSize: 9, fontFamily: "Inter_600SemiBold", color: d.typeColor }}>{d.type}</Text>
            </View>
            <Text style={[pv.probeTemp, { color: d.dot, fontSize: 14 }]}>{d.temp}</Text>
          </View>
        </View>
      ))}
      <View style={[pv.probeCheckin, { backgroundColor: "#22C55E18", borderColor: "#22C55E44" }]}>
        <Feather name="cpu" size={12} color="#22C55E" />
        <Text style={[pv.probeCheckinText, { color: "#22C55E" }]}>PitMaster auto-graded at 30 min · "Brisket on track — grill temp running 10° high"</Text>
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
        <View key={i} style={[pv.cookRow, { borderBottomColor: colors.border, borderBottomWidth: i < cooks.length - 1 ? StyleSheet.hairlineWidth : 0 }]}>
          <View style={[pv.cookIcon, { backgroundColor: "#E8452018" }]}>
            <Feather name="award" size={14} color="#E84520" />
          </View>
          <View style={pv.cookInfo}>
            <Text style={[pv.cookFood, { color: colors.foreground }]}>{c.food}</Text>
            <Text style={[pv.cookDate, { color: colors.mutedForeground }]}>{c.date}</Text>
          </View>
          <View style={pv.cookStars}>
            {[1,2,3,4,5].map((n) => (
              <Feather key={n} name="star" size={9} color={n <= c.rating ? "#FACC15" : colors.border} />
            ))}
          </View>
        </View>
      ))}
      <Text style={[pv.cookUnlimited, { color: colors.mutedForeground }]}>+ unlimited more</Text>
    </View>
  );
}

function FrozenPlannerPreview({ colors }: { colors: any }) {
  const steps = [
    { label: "Thaw in fridge", time: "36 hrs", color: "#60A5FA", done: true },
    { label: "Temper at room temp", time: "2 hrs", color: "#F59E0B", done: true },
    { label: "Fire up smoker", time: "6:00 AM", color: "#E84520", done: false },
    { label: "Serve", time: "6:00 PM", color: "#22C55E", done: false },
  ];
  return (
    <View style={pv.frozenWrap}>
      <View style={[pv.frozenBadge, { backgroundColor: "#60A5FA18", borderColor: "#60A5FA44" }]}>
        <Feather name="thermometer" size={11} color="#60A5FA" />
        <Text style={[pv.frozenBadgeText, { color: "#60A5FA" }]}>Frozen brisket · Cook from frozen</Text>
      </View>
      {steps.map((step, i) => (
        <View key={i} style={pv.frozenStep}>
          <View style={[pv.frozenStepLine, { backgroundColor: i < steps.length - 1 ? colors.border : "transparent" }]} />
          <View style={[pv.frozenStepDot, { backgroundColor: step.done ? step.color : colors.border, borderColor: step.color }]}>
            {step.done && <Feather name="check" size={8} color="#fff" />}
          </View>
          <View style={pv.frozenStepText}>
            <Text style={[pv.frozenLabel, { color: step.done ? colors.foreground : colors.mutedForeground }]}>{step.label}</Text>
            <Text style={[pv.frozenTime, { color: step.color }]}>{step.time}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Feature data ─────────────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "competition",
    headline: "Competition Mode",
    benefit: "Backwards-planned schedules for all 4 KCBS categories with per-turn-in countdowns.",
    Preview: CompetitionPreview,
  },
  {
    id: "multicook",
    headline: "Multi-Cook Sequencer",
    benefit: "Plan brisket, ribs, pork, and sides across multiple grills on one unified timeline.",
    Preview: MultiCookPreview,
  },
  {
    id: "ai",
    headline: "Unlimited AI PitMaster",
    benefit: "Ask anything, anytime — no daily chat or scan limits. Get pro coaching for every cook.",
    Preview: AIPitmasterPreview,
  },
  {
    id: "weather",
    headline: "Cook-Day Weather Forecast",
    benefit: "See wind, cold, and humidity before you fire up so you can adjust smoke time accordingly.",
    Preview: WeatherPreview,
  },
  {
    id: "probe",
    headline: "Live Thermometer Connection",
    benefit: "Connect Inkbird, Govee, Weber iGrill, Fireboard, MEATER, and ThermoWorks probes via Bluetooth or WiFi. PitMaster auto-grades every 30 minutes using live temps.",
    Preview: ProbeAutoGradePreview,
  },
  {
    id: "unlimited",
    headline: "Unlimited Cooks & Analyses",
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

  // When this screen loses focus (back gesture or any navigation away),
  // restore the paywall if it was paused to show us — so the user returns
  // directly to the purchase flow without needing to re-open it manually.
  // We use a ref to avoid stale-closure issues in the cleanup callback:
  // the ref is updated on every render, so cleanup always reads the latest value.
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

  const FOOTER_HEIGHT = effectivePro ? 88 : 72;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <AppHeader title="knowyourpit Pro" showBack dark />

      <ScrollView
        contentContainerStyle={{ paddingBottom: FOOTER_HEIGHT + insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <LinearGradient
          colors={["#2D1A0E", "#1C1C1F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroBadge}>
            <Feather name="award" size={13} color="#E84520" />
            <Text style={s.heroBadgeText}>knowyourpit PRO</Text>
          </View>
          <Text style={s.heroTitle}>Everything you need to cook like a pro.</Text>
          <Text style={s.heroSub}>One subscription unlocks all of these features — no caps, no limits.</Text>
        </LinearGradient>

        {/* Feature cards */}
        {FEATURES.map(({ id, headline, benefit, Preview }) => (
          <View
            key={id}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <View style={[s.previewArea, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
              <Preview colors={colors} />
            </View>
            <View style={s.cardBody}>
              <Text style={[s.cardHeadline, { color: colors.foreground }]}>{headline}</Text>
              <Text style={[s.cardBenefit, { color: colors.mutedForeground }]}>{benefit}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Sticky pricing footer */}
      <View
        style={[
          s.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        {effectivePro ? (
          // ── Pro member state ──────────────────────────────────────────
          <View style={[s.proConfirm, { backgroundColor: "#22C55E12", borderColor: "#22C55E33", borderRadius: colors.radius }]}>
            <View style={[s.proConfirmIcon, { backgroundColor: "#22C55E20" }]}>
              <Feather name="check-circle" size={18} color="#22C55E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.proConfirmTitle, { color: colors.foreground }]}>
                You're already Pro
                {planType ? ` · ${planType}` : ""}
              </Text>
              {isInTrial && expirationDate ? (
                <Text style={[s.proConfirmSub, { color: colors.mutedForeground }]}>
                  Trial ends {expirationDate.toLocaleDateString()} · Cancel anytime
                </Text>
              ) : isPro && expirationDate ? (
                <Text style={[s.proConfirmSub, { color: colors.mutedForeground }]}>
                  Renews {expirationDate.toLocaleDateString()} · Manage in{" "}
                  <Text
                    style={[s.proConfirmLink, { color: colors.mutedForeground }]}
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
                <Text style={[s.proConfirmSub, { color: colors.mutedForeground }]}>Active subscription</Text>
              )}
            </View>
          </View>
        ) : (
          // ── Single CTA for free users — pricing details are in the PaywallModal ──
          <Pressable
            style={({ pressed }) => [s.unlockBtn, { borderRadius: colors.radius }, pressed && { opacity: 0.85 }]}
            onPress={handleUnlockPro}
          >
            <Feather name="zap" size={15} color="#fff" />
            <Text style={s.unlockBtnText}>Unlock Pro →</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

// ── Preview sub-styles ────────────────────────────────────────────────────────

const pv = StyleSheet.create({
  // Competition
  competitionWrap: { gap: 10, padding: 12 },
  competitionBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", backgroundColor: "#E8452018", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  competitionBadgeText: { color: "#E84520", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
  chipTime: { fontSize: 13, fontFamily: "Inter_700Bold" },
  turnInRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  turnInText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },

  // Multi-cook
  multiCookWrap: { gap: 8, padding: 12 },
  grillRow: { borderWidth: 1, borderRadius: 8, padding: 8, gap: 6 },
  grillHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  grillName: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  timelineBar: { flexDirection: "row", height: 22, borderRadius: 4, overflow: "hidden" },
  timelineSegment: { alignItems: "center", justifyContent: "center" },
  segmentLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // AI PitMaster
  chatWrap: { gap: 8, padding: 12 },
  bubbleUser: { alignSelf: "flex-end", maxWidth: "78%", borderRadius: 14, borderBottomRightRadius: 4, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleUserText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#fff", lineHeight: 17 },
  bubbleAI: { alignSelf: "flex-start", maxWidth: "90%", borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, gap: 4 },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: 5 },
  aiAvatar: { width: 16, height: 16, borderRadius: 8, backgroundColor: "#E84520", alignItems: "center", justifyContent: "center" },
  aiName: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  bubbleAIText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },

  // Weather
  weatherWrap: { margin: 12, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  weatherTop: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  weatherInfo: { flex: 1 },
  weatherTemp: { fontSize: 13, fontFamily: "Inter_700Bold" },
  weatherSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  weatherTip: { flexDirection: "row", alignItems: "center", gap: 6, marginHorizontal: 10, marginBottom: 8, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 5 },
  weatherTipText: { fontSize: 11, fontFamily: "Inter_600SemiBold", flex: 1 },
  weatherHours: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 8, paddingBottom: 8 },
  weatherHour: { alignItems: "center", gap: 2 },
  weatherHourTime: { fontSize: 9, fontFamily: "Inter_400Regular" },
  weatherHourTemp: { fontSize: 11, fontFamily: "Inter_600SemiBold" },

  // Live probe
  probeWrap: { padding: 12, gap: 8 },
  probeCard: { borderRadius: 8, borderWidth: 1, padding: 10, gap: 6 },
  probeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  probeDot: { width: 8, height: 8, borderRadius: 4 },
  probeName: { flex: 1, fontSize: 12, fontFamily: "Inter_600SemiBold" },
  probeTemp: { fontSize: 17, fontFamily: "Inter_700Bold" },
  probeBarTrack: { height: 6, borderRadius: 3, backgroundColor: "#2A2A2A", overflow: "hidden" },
  probeBarFill: { height: 6, borderRadius: 3 },
  probeTarget: { fontSize: 10, fontFamily: "Inter_400Regular" },
  probeCheckin: { flexDirection: "row", alignItems: "flex-start", gap: 6, borderRadius: 7, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 6 },
  probeCheckinText: { fontSize: 11, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 16 },

  // Unlimited cooks
  cookListWrap: { paddingHorizontal: 12, paddingVertical: 8 },
  cookRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  cookIcon: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  cookInfo: { flex: 1 },
  cookFood: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  cookDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cookStars: { flexDirection: "row", gap: 2 },
  cookUnlimited: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingTop: 4 },

  // Frozen planner
  frozenWrap: { padding: 12, gap: 10 },
  frozenBadge: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-start", borderRadius: 8, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4 },
  frozenBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  frozenStep: { flexDirection: "row", alignItems: "flex-start", gap: 10, position: "relative" },
  frozenStepLine: { position: "absolute", left: 10, top: 18, width: 1, height: 24 },
  frozenStepDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1 },
  frozenStepText: { flex: 1, gap: 1 },
  frozenLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  frozenTime: { fontSize: 11, fontFamily: "Inter_700Bold" },
});

// ── Screen styles ─────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1 },
  hero: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24 },
  heroBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,69,32,0.18)", paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, alignSelf: "flex-start", marginBottom: 14,
  },
  heroBadgeText: { color: "#E84520", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  heroTitle: { color: "#F0E8D5", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 28 },
  heroSub: { color: "rgba(240,232,213,0.7)", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },

  card: { marginHorizontal: 16, marginTop: 16, borderWidth: 1, overflow: "hidden" },
  previewArea: { borderBottomWidth: StyleSheet.hairlineWidth },
  cardBody: { padding: 14, gap: 4 },
  cardHeadline: { fontSize: 16, fontFamily: "Inter_700Bold" },
  cardBenefit: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  footer: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16,
  },
  unlockBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    backgroundColor: "#E84520", paddingVertical: 13,
  },
  unlockBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },

  proConfirm: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, padding: 14,
  },
  proConfirmIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  proConfirmTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  proConfirmSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2, lineHeight: 17 },
  proConfirmLink: { fontSize: 12, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
});
