import React, { useRef, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  LayoutAnimation,
} from "react-native";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useLayout } from "@/hooks/useLayout";
import { LogoBackground } from "@/components/LogoBackground";
import { useGetDashboardSummary, useGetRecentCooks, getGetRecentCooksQueryKey } from "@workspace/api-client-react";
import { useHomeInsights } from "@/hooks/useHomeInsights";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { usePaywall } from "@/contexts/PaywallContext";
import { getCookCardBar } from "@/utils/cookCardBar";
import { letterGrade, scoreColor } from "@/utils/gradeUtils";
import { AnimatedBarFill } from "@/components/cook-detail/CookProgressBar";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";
import { PitMasterChatModal } from "@/components/PitMasterChatModal";
import { ActiveCookCard } from "@/components/home/ActiveCookCard";

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

const PITMASTER_TITLES: { minScore: number; titles: string[] }[] = [
  {
    minScore: 95,
    titles: [
      "The BBQ Deity",
      "Sovereign of Smoke",
      "High Priest of the Pit",
      "The Eternal Flame",
    ],
  },
  {
    minScore: 85,
    titles: [
      "Grand Poobah of the Pit",
      "Supreme Smoke Commander",
      "The Brisket Baron",
      "Duke of Delicious",
    ],
  },
  {
    minScore: 70,
    titles: [
      "The Smoke Whisperer",
      "Lord of Low & Slow",
      "Knight of the Ring of Fire",
      "The Bark Artisan",
    ],
  },
  {
    minScore: 55,
    titles: [
      "Lord of the Questionable Bark",
      "Baron of Almost Done",
      "The Optimistic Pitmaster",
      "Duke of the Stall Zone",
    ],
  },
  {
    minScore: 40,
    titles: [
      "Chief Charcoal Excuse Officer",
      "The Perpetual Pre-heater",
      "Knight of the Inconsistent Temp",
      "Minister of Maybes",
    ],
  },
  {
    minScore: 25,
    titles: [
      "Warden of the Wayward Flame",
      "Guardian of the Unruly Grill",
      "Custodian of Chaos",
      "The Grill's Unfortunate Keeper",
    ],
  },
  {
    minScore: 0,
    titles: [
      "The Anointed Fire Hazard",
      "Grand Consul of Burnt Offerings",
      "Ordained Smoke Alarm Conductor",
      "The Scorched Earth Pitmaster",
    ],
  },
];

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
  const router = useRouter();
  const { user } = useUser();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();

  // Track tab focus so we can poll while the user is watching the dashboard.
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  // Detect an active cook from the previous fetch result so we only enable the
  // 30-second polling interval when there is actually something live to update.
  const [hasActiveCook, setHasActiveCook] = useState(false);

  const { data: recentCooks, isLoading: cooksLoading } = useGetRecentCooks({
    query: {
      queryKey: getGetRecentCooksQueryKey(),
      refetchInterval: isFocused && hasActiveCook ? 30_000 : false,
    },
  });
  const { data: insights, isLoading: insightsLoading } = useHomeInsights();
  const { isPro, isIdentityLinked, isInTrial, expirationDate } = useSubscription();

  // ── Pro trial banner state ───────────────────────────────────────────
  // Surfaced when the active Pro entitlement is in its free-trial phase.
  // Persisted dismissal so once the user X's it, we don't show it again on
  // this device until the trial actually ends (true → false transition of
  // isInTrial), at which point we clear it so a future trial cycle re-shows
  // the banner.
  const TRIAL_BANNER_DISMISS_KEY = "knowyourpit:trialBannerDismissed";
  const [trialBannerDismissed, setTrialBannerDismissed] = React.useState(false);
  // Hydration gate: avoid rendering the banner until we've read the persisted
  // dismissal flag, otherwise it can flash in and then disappear once the
  // AsyncStorage read resolves.
  const [trialBannerHydrated, setTrialBannerHydrated] = React.useState(false);
  React.useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(TRIAL_BANNER_DISMISS_KEY)
      .then((v) => {
        if (cancelled) return;
        setTrialBannerDismissed(v === "1");
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setTrialBannerHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  // Track the previous `isInTrial` value so we only clear the dismissal flag
  // on a real true → false transition (trial ended). Resetting on every
  // render where isInTrial is false would clobber the dismissal during the
  // brief window before RevenueCat hydrates, then the banner would re-appear
  // every app launch even after the user dismissed it.
  const prevIsInTrialRef = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    const prev = prevIsInTrialRef.current;
    if (prev === true && isInTrial === false) {
      AsyncStorage.removeItem(TRIAL_BANNER_DISMISS_KEY).catch(() => {});
      setTrialBannerDismissed(false);
    }
    prevIsInTrialRef.current = isInTrial;
  }, [isInTrial]);
  const trialDaysRemaining = React.useMemo(() => {
    if (!isInTrial || !expirationDate) return 0;
    const diffMs = expirationDate.getTime() - Date.now();
    if (diffMs <= 0) return 0;
    return Math.max(1, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
  }, [isInTrial, expirationDate]);
  const showTrialBanner =
    trialBannerHydrated &&
    isPro &&
    isInTrial &&
    trialDaysRemaining > 0 &&
    !trialBannerDismissed;
  const effectivePro = useEffectivePro();
  const { showPaywall } = usePaywall();

  const isGuest = !user;
  const firstName =
    (user?.unsafeMetadata?.displayName as string | undefined) ||
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    (isGuest ? "Guest" : "Pitmaster");

  const topPad = useTopInset();
  const botPad = useBottomTabBarHeight();
  const { isTablet, contentMaxWidth } = useLayout();

  const allCooks = (recentCooks as any[]) || [];
  const activeCooks = allCooks.filter((c: any) => c.status === "active");
  const primaryActiveCook = activeCooks[0] ?? null;

  // Keep hasActiveCook in sync so the refetchInterval gate stays accurate.
  React.useEffect(() => {
    setHasActiveCook(activeCooks.length > 0);
  }, [activeCooks.length > 0]);
  const upcomingCook = activeCooks.length === 0
    ? allCooks.find((c: any) => {
        if (c.status !== "planned") return false;
        if (!c.plannedStartAt) return false;
        const diff = new Date(c.plannedStartAt).getTime() - Date.now();
        return diff > 0 && diff < 48 * 60 * 60 * 1000;
      }) ?? null
    : null;

  // Ticking clock — updates every minute while the tab is focused so elapsed
  // timers on the active cook widget stay live without extra API calls.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useFocusEffect(
    useCallback(() => {
      setNowMs(Date.now());
      const id = setInterval(() => setNowMs(Date.now()), 1_000);
      return () => clearInterval(id);
    }, [])
  );

  // For the hero subtitle, compute isMeatOn from the first active cook only.
  // Per-cook values are computed inside the .map() below.
  const primarySeqMeatOnAt = (primaryActiveCook as any)?.sequenceData?.schedule?.[0]?.meatOnAt ?? null;
  const primarySeqMeatOnMs: number | null = primarySeqMeatOnAt ? new Date(primarySeqMeatOnAt as string).getTime() : null;
  const primaryIsMeatOn = primarySeqMeatOnMs == null || primarySeqMeatOnMs <= nowMs;

  const heroSub = activeCooks.length > 1
    ? `${activeCooks.length} cooks on the smoker right now`
    : primaryActiveCook
    ? primaryIsMeatOn
      ? `${(primaryActiveCook as any).foodType || "Your cook"} is on the smoker right now`
      : `${(primaryActiveCook as any).foodType || "Your cook"} is thawing right now`
    : upcomingCook
    ? `${(upcomingCook as any).foodType || "Your cook"} is coming up — time to prep`
    : "Ready to fire it up?";

  // New title every time the home screen is focused (login, tab switch, app foreground)
  const [titleSeed, setTitleSeed] = useState(() => Math.random());
  useFocusEffect(
    useCallback(() => {
      setTitleSeed(Math.random());
    }, [])
  );
  const randomTitle = useMemo(() => {
    if (!insights) return null;
    if ((insights.scoreBreakdown?.cookCount ?? 0) === 0) return null;
    const tier = PITMASTER_TITLES.find((t) => insights.pitMasterScore >= t.minScore) ?? PITMASTER_TITLES[PITMASTER_TITLES.length - 1];
    return tier.titles[Math.floor(titleSeed * tier.titles.length)];
  }, [insights?.pitMasterScore, insights?.scoreBreakdown?.cookCount, titleSeed]);

  const scrollRef = useRef<ScrollView>(null);
  const [tipsExpanded, setTipsExpanded] = useState(false);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [pitMasterChatOpen, setPitMasterChatOpen] = useState(false);

  const toggleTips = (expand?: boolean) => {
    setTipsExpanded((prev) => (expand !== undefined ? expand : !prev));
  };

  const toggleScore = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setScoreExpanded((prev) => !prev);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad }}
      >
        <View style={isTablet ? { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" } : null}>
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

          {!summaryLoading && (
            <View style={s.statStrip}>
              {[
                { n: summary?.totalCooks ?? 0, l: "Cooks", icon: "zap" },
                { n: summary?.totalGrills ?? 0, l: "Grills", icon: "wind" },
                { n: summary?.activeCooks ?? 0, l: "Active", icon: "activity" },
              ].map((stat, i) => (
                <React.Fragment key={stat.l}>
                  {i > 0 && <View style={s.statDivider} />}
                  <View style={s.statItem}>
                    <Feather name={stat.icon as any} size={11} color="#E84820" />
                    <Text style={s.statNum}>{stat.n}</Text>
                    <Text style={s.statLabel}>{stat.l}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>
          )}
        </LinearGradient>

        {/* Fire divider */}
        <View style={[s.dividerStrip, { backgroundColor: colors.background }]}>
          <View style={s.dividerLine} />
        </View>

        {/* ── Pro trial active banner ──
            Amber, dismissible. Only shown while the user's Pro entitlement
            is in its TRIAL/INTRO period. Days are computed from the RC
            entitlement's expirationDate so the countdown stays accurate
            even across app restarts. */}
        {showTrialBanner && (
          <View
            style={s.trialBanner}
            accessibilityRole="summary"
            accessibilityLabel={`Pro trial active, ${trialDaysRemaining} ${trialDaysRemaining === 1 ? "day" : "days"} remaining. Cancel anytime in Settings.`}
          >
            <View style={s.trialBannerIcon}>
              <Feather name="gift" size={16} color="#1C1C1F" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.trialBannerTitle}>Pro trial active</Text>
              <Text style={s.trialBannerSub}>
                {trialDaysRemaining === 1
                  ? "1 day remaining · Cancel anytime in Settings"
                  : `${trialDaysRemaining} days remaining · Cancel anytime in Settings`}
              </Text>
            </View>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="Dismiss Pro trial banner"
              accessibilityHint="Hides the Pro trial banner until your trial ends"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                AsyncStorage.setItem(TRIAL_BANNER_DISMISS_KEY, "1").catch(() => {});
                setTrialBannerDismissed(true);
              }}
              style={({ pressed }) => [s.trialBannerClose, pressed && { opacity: 0.6 }]}
            >
              <Feather name="x" size={14} color="#1C1C1F" />
            </Pressable>
          </View>
        )}

        {/* ── Active Cook Widget(s) — one card per active cook ── */}
        {activeCooks.map((activeCook) => (
          <ActiveCookCard
            key={activeCook.id}
            activeCook={activeCook}
            nowMs={nowMs}
            insights={insights}
          />
        ))}

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
                  {(upcomingCook.targetTempF != null || upcomingCook.cookTempF != null) && (
                    <View style={{ flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                      {upcomingCook.targetTempF != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
                          <Feather name="thermometer" size={10} color="#22c55e" />
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#22c55e" }}>{upcomingCook.targetTempF}°F</Text>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#22c55e99" }}>target</Text>
                        </View>
                      )}
                      {upcomingCook.cookTempF != null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
                          <Feather name="wind" size={10} color="#3b82f6" />
                          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#3b82f6" }}>{upcomingCook.cookTempF}°F</Text>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: "#3b82f699" }}>pit</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              </View>
              <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
            </View>
          </Pressable>
        )}

        {/* ── PitMaster Score — hidden when a cook is active ── */}
        {activeCooks.length === 0 && (!isIdentityLinked ? (
          <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
            <View style={s.sectionHeader}>
              <View style={s.sectionAccent} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>PitMaster Score</Text>
            </View>
            <View style={[{ height: 112, borderRadius: colors.radius, backgroundColor: colors.card, opacity: 0.45 }]} />
          </View>
        ) : (insights || insightsLoading) ? (
          <>
            <View style={s.sectionHeader}>
              <View style={s.sectionAccent} />
              <Text style={[s.sectionTitle, { color: colors.foreground }]}>PitMaster Score</Text>
            </View>
            {insightsLoading || !insights ? (
              <ActivityIndicator color={colors.primary} style={{ padding: 16 }} />
            ) : (() => {
              const grade = letterGrade(insights.pitMasterScore);
              const color = scoreColor(insights.pitMasterScore);
              const hasCooks = (insights.scoreBreakdown?.cookCount ?? 0) > 0;
              return (
                <>
                  <Pressable
                    onPress={effectivePro ? () => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleTips();
                    } : undefined}
                    style={({ pressed }) => [{ opacity: pressed && effectivePro ? 0.88 : 1 }]}
                  >
                    {/* LinearGradient IS the card — it's a View with a gradient background.
                        flexDirection:"column" (from gradeCard) stacks the score row then tips. */}
                    <LinearGradient
                      colors={["#1C1C1F", "#2A1A10"]}
                      style={[s.gradeCard, { borderColor: color + "55", borderRadius: colors.radius }]}
                    >
                      <View style={s.gradeCardRow}>
                        {/* Grade circle — only shown once the user has completed at least one cook */}
                        {hasCooks && (
                          <View style={s.gradeLeft}>
                            <View style={[s.gradeBubble, { borderColor: color, backgroundColor: color + "18" }]}>
                              <Text style={[s.gradeLetter, { color }]}>{grade}</Text>
                            </View>
                          </View>
                        )}

                        {/* Right column */}
                        <View style={s.gradeRight}>
                          {randomTitle ? (
                            <Text style={s.gradeLabel}>{randomTitle}</Text>
                          ) : (
                            <Text style={[s.gradeLabel, { color: "#96908A", fontStyle: "italic" }]}>Log a cook to earn your title</Text>
                          )}
                          <Text style={[s.gradeScore, { color }]}>{insights.pitMasterScore} / 100</Text>

                          {/* Progress bar */}
                          <View style={[s.gradeBarTrack, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
                            <View style={[s.gradeBarFill, { width: `${insights.pitMasterScore}%` as any, backgroundColor: color }]} />
                          </View>

                          {/* Breakdown chips */}
                          <View style={s.gradeChips}>
                            {insights.scoreBreakdown.avgRating != null && (
                              <View style={[s.gradeChip, { backgroundColor: color + "18", borderColor: color + "35" }]}>
                                <Feather name="star" size={10} color={color} />
                                <Text style={[s.gradeChipText, { color }]}>
                                  {insights.scoreBreakdown.avgRating.toFixed(1)} rating
                                </Text>
                              </View>
                            )}
                            {insights.scoreBreakdown.planAccuracy != null && (
                              <View style={[s.gradeChip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }]}>
                                <Feather name="target" size={10} color="#96908A" />
                                <Text style={[s.gradeChipText, { color: "#96908A" }]}>
                                  {insights.scoreBreakdown.planAccuracy}% accuracy
                                </Text>
                              </View>
                            )}
                            {insights.scoreBreakdown.aiAssessmentScore != null ? (
                              <View style={[s.gradeChip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }]}>
                                <Feather name="cpu" size={10} color="#96908A" />
                                <Text style={[s.gradeChipText, { color: "#96908A" }]}>
                                  {insights.scoreBreakdown.aiAssessmentScore}% AI score
                                </Text>
                              </View>
                            ) : (
                              <View style={[s.gradeChip, { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.1)" }]}>
                                <Feather name="layers" size={10} color="#96908A" />
                                <Text style={[s.gradeChipText, { color: "#96908A" }]}>
                                  {insights.scoreBreakdown.cookCount} cooks
                                </Text>
                              </View>
                            )}
                          </View>

                          {/* Tap hint — Pro: expand tips; Free: upgrade nudge */}
                          {effectivePro ? (
                            <View style={s.gradeHint}>
                              <Feather name={tipsExpanded ? "chevron-up" : "chevron-down"} size={10} color={color + "99"} />
                              <Text style={[s.gradeHintText, { color: color + "99" }]}>Tips from PitMaster</Text>
                            </View>
                          ) : (
                            <Pressable
                              onPress={() => showPaywall({ trigger: "pro_required", featureName: "PitMaster Score" })}
                              style={s.gradeHint}
                            >
                              <Feather name="lock" size={10} color="#F59E0B99" />
                              <Text style={[s.gradeHintText, { color: "#F59E0B99" }]}>Unlock AI tips — Pro</Text>
                              <Feather name="chevron-right" size={10} color="#F59E0B99" />
                            </Pressable>
                          )}
                        </View>
                      </View>

                      {/* Tips — render inside the gradient card */}
                      {tipsExpanded && insights.tips?.length > 0 && (
                        <View style={[s.tipsInCard, { borderTopColor: color + "30" }]}>
                          {insights.tips.map((tip, i) => (
                            <View
                              key={i}
                              style={[s.tipRow, i < insights.tips.length - 1 && { borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.07)" }]}
                            >
                              <View style={[s.tipIconWrap, { backgroundColor: "#E8482015" }]}>
                                <Feather name="zap" size={13} color="#E84820" />
                              </View>
                              <Text style={[s.tipText, { color: "#F3EDE1" }]}>{tip}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </LinearGradient>
                  </Pressable>

                  {/* How is this scored? toggle */}
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      toggleScore();
                    }}
                    style={({ pressed }) => [
                      s.scoreToggleRow,
                      { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Feather name="info" size={11} color={color + "AA"} />
                    <Text style={[s.scoreToggleText, { color: color + "AA" }]}>How is this scored?</Text>
                    <Feather name={scoreExpanded ? "chevron-up" : "chevron-down"} size={11} color={color + "AA"} />
                  </Pressable>

                  {/* Score breakdown panel */}
                  {scoreExpanded && (() => {
                    const sb = insights.scoreBreakdown;
                    const ratingPts = sb.avgRating != null ? Math.round((sb.avgRating / 5) * 100 * 0.35) : null;
                    const planPts = sb.planAccuracy != null ? Math.round(sb.planAccuracy * 0.2) : null;
                    const aiPts = sb.aiAssessmentScore != null ? Math.round(sb.aiAssessmentScore * 0.45) : null;
                    return (
                      <View style={[s.scoreCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
                        {/* Row: AI Assessment */}
                        <View style={[s.scoreRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <View style={s.scoreRowLeft}>
                            <View style={[s.scoreIconWrap, { backgroundColor: color + "18" }]}>
                              <Feather name="cpu" size={13} color={color} />
                            </View>
                            <View style={s.scoreRowInfo}>
                              <Text style={[s.scoreRowTitle, { color: colors.foreground }]}>AI Assessment</Text>
                              <Text style={[s.scoreRowSub, { color: colors.mutedForeground }]}>
                                {sb.aiAssessmentScore != null
                                  ? `${sb.aiAssessmentScore} / 100 avg verdict · ${sb.cookCount} cook${sb.cookCount !== 1 ? "s" : ""}`
                                  : `No analyzed cooks yet · ${sb.cookCount} cook${sb.cookCount !== 1 ? "s" : ""} logged`}
                              </Text>
                            </View>
                          </View>
                          <View style={s.scoreRowRight}>
                            <View style={[s.weightBadge, { backgroundColor: color + "22", borderColor: color + "44" }]}>
                              <Text style={[s.weightText, { color }]}>45%</Text>
                            </View>
                            <Text style={[s.scorePts, { color: aiPts != null ? colors.foreground : colors.mutedForeground }]}>
                              {aiPts != null ? `${aiPts} / 45 pts` : "—"}
                            </Text>
                          </View>
                        </View>

                        {/* Row: Ratings */}
                        <View style={[s.scoreRow, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <View style={s.scoreRowLeft}>
                            <View style={[s.scoreIconWrap, { backgroundColor: "rgba(255,255,255,0.07)" }]}>
                              <Feather name="star" size={13} color="#96908A" />
                            </View>
                            <View style={s.scoreRowInfo}>
                              <Text style={[s.scoreRowTitle, { color: colors.foreground }]}>Your Ratings</Text>
                              <Text style={[s.scoreRowSub, { color: colors.mutedForeground }]}>
                                {sb.avgRating != null ? `${sb.avgRating.toFixed(1)} / 5 stars` : "No ratings yet"}
                              </Text>
                            </View>
                          </View>
                          <View style={s.scoreRowRight}>
                            <View style={[s.weightBadge, { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" }]}>
                              <Text style={[s.weightText, { color: "#96908A" }]}>35%</Text>
                            </View>
                            <Text style={[s.scorePts, { color: ratingPts != null ? colors.foreground : colors.mutedForeground }]}>
                              {ratingPts != null ? `${ratingPts} / 35 pts` : "—"}
                            </Text>
                          </View>
                        </View>

                        {/* Row: Plan Accuracy */}
                        <View style={s.scoreRow}>
                          <View style={s.scoreRowLeft}>
                            <View style={[s.scoreIconWrap, { backgroundColor: "rgba(255,255,255,0.07)" }]}>
                              <Feather name="target" size={13} color="#96908A" />
                            </View>
                            <View style={s.scoreRowInfo}>
                              <Text style={[s.scoreRowTitle, { color: colors.foreground }]}>Plan Accuracy</Text>
                              <Text style={[s.scoreRowSub, { color: colors.mutedForeground }]}>
                                {sb.planAccuracy != null ? `${sb.planAccuracy}% on target` : "No timing data yet"}
                              </Text>
                            </View>
                          </View>
                          <View style={s.scoreRowRight}>
                            <View style={[s.weightBadge, { backgroundColor: "rgba(255,255,255,0.07)", borderColor: "rgba(255,255,255,0.12)" }]}>
                              <Text style={[s.weightText, { color: "#96908A" }]}>20%</Text>
                            </View>
                            <Text style={[s.scorePts, { color: planPts != null ? colors.foreground : colors.mutedForeground }]}>
                              {planPts != null ? `${planPts} / 20 pts` : "—"}
                            </Text>
                          </View>
                        </View>

                        {/* Plain-English note */}
                        <View style={[s.scoreNote, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                          <Feather name="info" size={12} color={colors.mutedForeground} style={{ marginTop: 1 }} />
                          <Text style={[s.scoreNoteText, { color: colors.mutedForeground }]}>
                            PitMaster's AI verdict counts for 45% of your score. Your ratings add 35%, and how closely you follow planned timelines adds 20% — so logging cooks with photos and ratings will move your grade the most.
                          </Text>
                        </View>
                      </View>
                    );
                  })()}

                </>
              );
            })()}
          </>
        ) : null)}

        {/* ── Chat with PitMaster entry point ── */}
        <Pressable
          onPress={() => setPitMasterChatOpen(true)}
          style={({ pressed }) => [
            s.pitMasterChatRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
            pressed && { opacity: 0.8 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Chat with PitMaster"
        >
          <View style={[s.pitMasterChatIcon, { backgroundColor: "#E84820" + "18" }]}>
            <Feather name="zap" size={18} color="#E84820" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.pitMasterChatLabel, { color: colors.foreground }]}>Chat with PitMaster</Text>
            <Text style={[s.pitMasterChatSub, { color: colors.mutedForeground }]}>
              Ask anything about your cook · history included
            </Text>
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>

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
          allCooks.slice(0, 3).map((cook: any) => (
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
                {cook.status === "active" && cook.actualStartAt && (() => {
                  const cookMeatOnMs = (cook as any).sequenceData?.schedule?.[0]?.meatOnAt
                    ? new Date((cook as any).sequenceData.schedule[0].meatOnAt).getTime()
                    : null;
                  if (cookMeatOnMs != null && cookMeatOnMs > nowMs) return null;
                  const anchorMs = (cookMeatOnMs != null && cookMeatOnMs <= nowMs)
                    ? cookMeatOnMs
                    : new Date(cook.actualStartAt).getTime();
                  return (
                    <Text style={[s.cookElapsed, { color: "#E84820" }]}>
                      {fmtElapsed(nowMs - anchorMs)} elapsed
                    </Text>
                  );
                })()}
              </View>
              <View style={[s.statusPill, { backgroundColor: (STATUS_COLOR[cook.status] || colors.mutedForeground) + "22" }]}>
                <Text style={[s.statusText, { color: STATUS_COLOR[cook.status] || colors.mutedForeground }]}>
                  {cook.status}
                </Text>
              </View>
            </Pressable>
          ))
        )}
        </View>
      </ScrollView>

      <PitMasterChatModal
        visible={pitMasterChatOpen}
        onClose={() => setPitMasterChatOpen(false)}
      />
    </View>
  );
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 18) return "afternoon";
  return "evening";
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
  statStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 0,
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  statNum: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#7A6E62",
  },
  statDivider: {
    width: 1,
    height: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    marginHorizontal: 10,
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

  /* Pro trial banner */
  trialBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#FACC15",
    borderWidth: 1,
    borderColor: "#EAB308",
  },
  trialBannerIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(28,28,31,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  trialBannerTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1C1C1F",
    letterSpacing: 0.2,
  },
  trialBannerSub: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#3F2D08",
    marginTop: 1,
  },
  trialBannerClose: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(28,28,31,0.10)",
  },

  /* Active Cook Widget */
  activeCookWidget: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 10,
    overflow: "hidden",
  },
  activeCookBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginTop: 6,
    marginHorizontal: -16,
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

  /* PitMaster Grade Card */
  gradeCard: {
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 20,
    borderWidth: 1.5,
    flexDirection: "column",
    gap: 0,
  },
  gradeCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  gradeLeft: {
    alignItems: "center",
    justifyContent: "center",
  },
  gradeBubble: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  gradeLetter: {
    fontSize: 46,
    fontFamily: "Inter_700Bold",
    lineHeight: 54,
  },
  gradeRight: {
    flex: 1,
    gap: 6,
  },
  gradeLabel: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
  },
  gradeScore: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  gradeBarTrack: {
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  gradeBarFill: {
    height: 5,
    borderRadius: 3,
  },
  gradeChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  gradeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  gradeChipText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  gradeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 10,
  },
  gradeHintText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },

  /* Blur tease card (free users) */
  blurScoreWrap: {
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: "hidden",
  },

  /* Tips inside the grade card */
  tipsInCard: {
    marginTop: 16,
    borderTopWidth: 1,
    paddingTop: 4,
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

  /* Score breakdown toggle row */
  scoreToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginHorizontal: 20,
    marginTop: 6,
    marginBottom: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  scoreToggleText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },

  /* Score breakdown card */
  scoreCard: {
    borderWidth: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    gap: 10,
  },
  scoreRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  scoreIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  scoreRowInfo: { flex: 1 },
  scoreRowTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  scoreRowSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  scoreRowRight: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  weightBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  weightText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  scorePts: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  scoreNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 14,
    paddingTop: 12,
  },
  scoreNoteText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 18,
    flex: 1,
  },

  /* PitMaster chat row */
  pitMasterChatRow: {
    marginHorizontal: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  pitMasterChatIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  pitMasterChatLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  pitMasterChatSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
});
