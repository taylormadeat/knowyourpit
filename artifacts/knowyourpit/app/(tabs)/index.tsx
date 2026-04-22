import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { LogoBackground } from "@/components/LogoBackground";
import { useGetDashboardSummary, useGetRecentCooks } from "@workspace/api-client-react";
import { useHomeInsights } from "@/hooks/useHomeInsights";

const logoImg = require("@/assets/images/logo.png");

const STATUS_COLOR: Record<string, string> = {
  planned: "#3b82f6",
  active: "#E84820",
  completed: "#22c55e",
  cancelled: "#9ca3af",
};

const URGENCY_COLOR: Record<string, string> = {
  now: "#EF4444",
  soon: "#F59E0B",
  when_ready: "#6C3BF5",
  maintain: "#22c55e",
};

function fmtElapsed(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function fmtCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "now";
  const totalMins = Math.floor(diff / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: recentCooks, isLoading: cooksLoading } = useGetRecentCooks();
  const { data: insights, isLoading: insightsLoading } = useHomeInsights();

  const firstName =
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Pitmaster";

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const allCooks = (recentCooks as any[]) || [];
  const activeCook = allCooks.find((c: any) => c.status === "active") ?? null;
  const upcomingCook = !activeCook
    ? allCooks.find((c: any) => {
        if (c.status !== "planned") return false;
        if (!c.plannedStartAt) return false;
        const diff = new Date(c.plannedStartAt).getTime() - Date.now();
        return diff > 0 && diff < 48 * 60 * 60 * 1000;
      }) ?? null
    : null;

  const topDecision = activeCook?.analysisResult?.decisions?.[0] ?? null;
  const topDecisionColor = topDecision
    ? URGENCY_COLOR[topDecision.urgency] ?? "#6C3BF5"
    : null;

  const heroSub = activeCook
    ? `${activeCook.foodType || "Your cook"} is on the smoker right now`
    : upcomingCook
    ? `${upcomingCook.foodType || "Your cook"} is coming up — time to prep`
    : "Ready to fire it up?";


  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
      >
        {/* ── Hero banner ── */}
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[s.hero, { paddingTop: topPad + 20 }]}
        >
          <Image
            source={logoImg}
            style={s.watermark}
            resizeMode="contain"
          />
          <View style={s.fireBar} />

          <Text style={s.greeting}>Good {getTimeGreeting()}</Text>
          <Text style={s.heroName}>{firstName} 🔥</Text>
          <Text style={s.heroSub}>{heroSub}</Text>

          {summaryLoading ? (
            <ActivityIndicator color="#E84820" style={{ marginTop: 20 }} />
          ) : (
            <View style={s.chipRow}>
              {[
                { n: summary?.totalCooks ?? 0, l: "Cooks", icon: "zap" },
                { n: summary?.totalGrills ?? 0, l: "Grills", icon: "wind" },
                { n: summary?.plannedCooks ?? 0, l: "Planned", icon: "calendar" },
              ].map((chip) => (
                <View key={chip.l} style={s.chip}>
                  <Feather name={chip.icon as any} size={14} color="#E84820" style={{ marginBottom: 4 }} />
                  <Text style={s.chipNum}>{chip.n}</Text>
                  <Text style={s.chipLabel}>{chip.l}</Text>
                </View>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* Fire divider */}
        <View style={[s.dividerStrip, { backgroundColor: colors.background }]}>
          <View style={s.dividerLine} />
        </View>

        {/* ── Active Cook Widget ── */}
        {activeCook && (
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}
            onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
          >
            <LinearGradient
              colors={["#2D1008", "#1E0B04"]}
              style={[s.activeCookWidget, { borderColor: "#E8482055" }]}
            >
              {/* Live indicator row */}
              <View style={s.activeLiveRow}>
                <View style={s.liveDot} />
                <Text style={s.liveLabel}>LIVE ON THE SMOKER</Text>
                {activeCook.actualStartAt && (
                  <Text style={s.elapsedBadge}>
                    {fmtElapsed(Date.now() - new Date(activeCook.actualStartAt).getTime())} in
                  </Text>
                )}
              </View>

              {/* Food type */}
              <Text style={s.activeFoodType}>
                {activeCook.foodType || "Cook in progress"}
              </Text>
              {activeCook.grillName ? (
                <Text style={s.activeGrill}>{activeCook.grillName}</Text>
              ) : null}

              {/* Last decision teaser */}
              {topDecision ? (
                <View style={[s.decisionTeaser, { backgroundColor: topDecisionColor! + "18", borderColor: topDecisionColor! + "40" }]}>
                  <View style={[s.decisionTeaserDot, { backgroundColor: topDecisionColor! }]} />
                  <Text style={[s.decisionTeaserText, { color: topDecisionColor! }]} numberOfLines={2}>
                    {topDecision.instruction}
                  </Text>
                </View>
              ) : (
                <View style={s.decisionTeaser}>
                  <Feather name="zap" size={13} color="#F59E0B" />
                  <Text style={[s.decisionTeaserText, { color: "#F59E0B" }]}>
                    Tap to check in with PitMaster for your next step
                  </Text>
                </View>
              )}

              {/* CTA */}
              <View style={s.checkOnItRow}>
                <Text style={s.checkOnItText}>Check on your cook</Text>
                <Feather name="chevron-right" size={16} color="#E84820" />
              </View>
            </LinearGradient>
          </Pressable>
        )}

        {/* ── Upcoming Cook Countdown ── */}
        {upcomingCook && (
          <Pressable
            style={({ pressed }) => [pressed && { opacity: 0.88 }]}
            onPress={() => router.push(`/cooks/${upcomingCook.id}` as any)}
          >
            <View style={[s.upcomingCard, { backgroundColor: colors.card, borderColor: "#3b82f655" }]}>
              <View style={s.upcomingLeft}>
                <LinearGradient colors={["#3b82f6", "#60a5fa"]} style={s.upcomingIconWrap}>
                  <Feather name="calendar" size={16} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.upcomingTitle, { color: colors.foreground }]}>
                    {upcomingCook.foodType || "Planned Cook"}
                  </Text>
                  <Text style={[s.upcomingMeta, { color: colors.mutedForeground }]}>
                    Starts in{" "}
                    <Text style={{ color: "#3b82f6", fontFamily: "Inter_700Bold" }}>
                      {fmtCountdown(new Date(upcomingCook.plannedStartAt).getTime())}
                    </Text>
                  </Text>
                  {upcomingCook.cookTempF && (
                    <Text style={[s.upcomingMeta, { color: colors.mutedForeground }]}>
                      Pit target: {upcomingCook.cookTempF}°F
                    </Text>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
        )}

        {/* ── PitMaster Score ── */}
        {(insights || insightsLoading) && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionAccent} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>PitMaster Score</Text>
            </View>
            {insightsLoading || !insights ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
            ) : (
              <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {/* Score circle + label */}
                <View style={s.scoreTop}>
                  <View style={[s.scoreCircle, { borderColor: scoreColor(insights.pitMasterScore) }]}>
                    <Text style={[s.scoreNumber, { color: scoreColor(insights.pitMasterScore) }]}>
                      {insights.pitMasterScore}
                    </Text>
                    <Text style={[s.scoreOutOf, { color: colors.mutedForeground }]}>/100</Text>
                  </View>
                  <View style={s.scoreRight}>
                    <Text style={[s.scoreLabel, { color: colors.foreground }]}>{insights.scoreLabel}</Text>
                    {/* Progress bar */}
                    <View style={[s.scoreBarTrack, { backgroundColor: colors.border }]}>
                      <View style={[s.scoreBarFill, { width: `${insights.pitMasterScore}%` as any, backgroundColor: scoreColor(insights.pitMasterScore) }]} />
                    </View>
                    {/* Breakdown chips */}
                    <View style={s.scoreChips}>
                      {insights.scoreBreakdown.avgRating != null && (
                        <View style={[s.scoreChip, { backgroundColor: colors.border }]}>
                          <Feather name="star" size={11} color={colors.mutedForeground} />
                          <Text style={[s.scoreChipText, { color: colors.mutedForeground }]}>
                            {insights.scoreBreakdown.avgRating.toFixed(1)} avg
                          </Text>
                        </View>
                      )}
                      {insights.scoreBreakdown.planAccuracy != null && (
                        <View style={[s.scoreChip, { backgroundColor: colors.border }]}>
                          <Feather name="target" size={11} color={colors.mutedForeground} />
                          <Text style={[s.scoreChipText, { color: colors.mutedForeground }]}>
                            {insights.scoreBreakdown.planAccuracy}% accuracy
                          </Text>
                        </View>
                      )}
                      <View style={[s.scoreChip, { backgroundColor: colors.border }]}>
                        <Feather name="layers" size={11} color={colors.mutedForeground} />
                        <Text style={[s.scoreChipText, { color: colors.mutedForeground }]}>
                          {insights.scoreBreakdown.cookCount} cooks
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            )}
          </>
        )}

        {/* ── AI Tips ── */}
        {(insights?.tips?.length || insightsLoading) && (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionAccent} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>Tips for You</Text>
              <View style={[s.aiBadge, { backgroundColor: "#E8482015", borderColor: "#E8482035" }]}>
                <Feather name="cpu" size={10} color="#E84820" />
                <Text style={s.aiBadgeText}>AI</Text>
              </View>
            </View>
            {insightsLoading || !insights ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
            ) : (
              <View style={[s.tipsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                {insights.tips.map((tip, i) => (
                  <View
                    key={i}
                    style={[s.tipRow, i < insights.tips.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}
                  >
                    <View style={[s.tipIconWrap, { backgroundColor: "#E8482015" }]}>
                      <Feather name="zap" size={13} color="#E84820" />
                    </View>
                    <Text style={[s.tipText, { color: colors.foreground }]}>{tip}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* ── Recent Cooks ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionAccent} />
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Cooks</Text>
          <Pressable onPress={() => router.push("/(tabs)/cooks" as any)} style={s.seeAllBtn}>
            <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>

        {cooksLoading ? (
          <ActivityIndicator color={colors.primary} style={{ padding: 20 }} />
        ) : !allCooks.length ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No cooks yet</Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Fire it up with your first cook!</Text>
          </View>
        ) : (
          allCooks.slice(0, 5).map((cook: any) => (
            <Pressable
              key={cook.id}
              style={({ pressed }) => [
                s.cookCard,
                { backgroundColor: colors.card, borderColor: cook.status === "active" ? "#E8482040" : colors.border, borderRadius: colors.radius },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => router.push(`/cooks/${cook.id}` as any)}
            >
              <LinearGradient
                colors={cook.status === "active" ? ["#E84820", "#FF6B2B"] : ["#3A3A3E", "#52525B"]}
                style={s.cookIconBg}
              >
                <Feather name={cook.status === "active" ? "activity" : "zap"} size={16} color="#fff" />
              </LinearGradient>
              <View style={s.cookInfo}>
                <Text style={[s.cookName, { color: colors.foreground }]} numberOfLines={1}>
                  {cook.foodType || "Cook"}
                </Text>
                <Text style={[s.cookMeta, { color: colors.mutedForeground }]}>
                  {cook.grillName || "No grill selected"}
                </Text>
                {cook.status === "active" && cook.actualStartAt && (
                  <Text style={[s.cookElapsed, { color: "#E84820" }]}>
                    {fmtElapsed(Date.now() - new Date(cook.actualStartAt).getTime())} elapsed
                  </Text>
                )}
              </View>
              <View style={[s.statusPill, { backgroundColor: (STATUS_COLOR[cook.status] || colors.mutedForeground) + "22" }]}>
                <Text style={[s.statusText, { color: STATUS_COLOR[cook.status] || colors.mutedForeground }]}>
                  {cook.status}
                </Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
}

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#F59E0B";
  return "#E84820";
}

const s = StyleSheet.create({
  container: { flex: 1 },

  /* Hero */
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 28,
    overflow: "hidden",
    borderBottomWidth: 2,
    borderBottomColor: "#E84820",
  },
  watermark: {
    position: "absolute",
    width: 220,
    height: 220,
    right: -30,
    top: 10,
    opacity: 0.07,
  },
  fireBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: "#E84820",
    opacity: 0.8,
  },
  greeting: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#96908A",
    marginBottom: 4,
    marginTop: 4,
  },
  heroName: {
    fontSize: 30,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#7A6E62",
    marginBottom: 20,
  },
  chipRow: {
    flexDirection: "row",
    gap: 10,
  },
  chip: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  chipNum: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
    marginBottom: 2,
  },
  chipLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#96908A",
    textAlign: "center",
  },

  /* Divider */
  dividerStrip: {
    height: 16,
    justifyContent: "center",
    paddingHorizontal: 22,
  },
  dividerLine: {
    height: 1,
    backgroundColor: "transparent",
  },

  /* Active Cook Widget */
  activeCookWidget: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  activeLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E84820",
  },
  liveLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#E84820",
    letterSpacing: 0.8,
    flex: 1,
  },
  elapsedBadge: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#96908A",
  },
  activeFoodType: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
  },
  activeGrill: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#7A6E62",
    marginTop: -6,
  },
  decisionTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  decisionTeaserDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    flexShrink: 0,
  },
  decisionTeaserText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 18,
  },
  checkOnItRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
    marginTop: 2,
  },
  checkOnItText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#E84820",
  },

  /* Upcoming Cook */
  upcomingCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upcomingLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  upcomingIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  upcomingTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  upcomingMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },

  /* Sections */
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
    gap: 8,
  },
  sectionAccent: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: "#E84820",
  },
  sectionTitle: {
    flex: 1,
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  seeAllBtn: { paddingVertical: 4 },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },

  /* PitMaster Score Card */
  scoreCard: {
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 16,
  },
  scoreTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  scoreCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreNumber: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
    lineHeight: 30,
  },
  scoreOutOf: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  scoreRight: {
    flex: 1,
    gap: 8,
  },
  scoreLabel: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  scoreBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  scoreBarFill: {
    height: 6,
    borderRadius: 3,
  },
  scoreChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  scoreChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  scoreChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },

  /* AI Badge */
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  aiBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#E84820",
    letterSpacing: 0.5,
  },

  /* Tips Card */
  tipsCard: {
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  tipRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
  },
  tipIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  tipText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
    flex: 1,
  },

  /* Empty */
  emptyCard: {
    borderWidth: 1,
    margin: 20,
    padding: 32,
    alignItems: "center",
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  /* Cook cards */
  cookCard: {
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  cookIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cookInfo: { flex: 1 },
  cookName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cookMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cookElapsed: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "capitalize",
  },
});
