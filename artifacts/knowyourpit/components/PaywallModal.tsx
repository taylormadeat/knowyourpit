import React, { useCallback, useMemo } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useSubscription, type PurchasePackageLike } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { useGetRecentCooks, getGetRecentCooksQueryKey, type Cook } from "@workspace/api-client-react";
import type { Feather as FeatherType } from "@expo/vector-icons";

type FeatherIconName = React.ComponentProps<typeof FeatherType>["name"];

interface TrialInfo {
  label: string;
}

function formatPeriodLabel(unit: string, value: number): string {
  const u = unit.toUpperCase();
  if (u === "DAY") return value === 1 ? "1-day" : `${value}-day`;
  if (u === "WEEK") return value === 1 ? "1-week" : `${value}-week`;
  if (u === "MONTH") return value === 1 ? "1-month" : `${value}-month`;
  if (u === "YEAR") return value === 1 ? "1-year" : `${value}-year`;
  return "free trial";
}

function parseLabelFromISO(iso: string): string | null {
  const match = iso.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/i);
  if (!match) return null;
  const [, years, months, weeks, days] = match.map((v) => (v ? parseInt(v, 10) : 0));
  if (years) return years === 1 ? "1-year" : `${years}-year`;
  if (months) return months === 1 ? "1-month" : `${months}-month`;
  if (weeks) return weeks === 1 ? "1-week" : `${weeks}-week`;
  if (days) return days === 1 ? "1-day" : `${days}-day`;
  return null;
}

function getTrialInfo(pkg: PurchasePackageLike | null): TrialInfo | null {
  if (!pkg) return null;

  if (Platform.OS === "ios") {
    const discount = pkg.product.introductoryDiscount;
    if (!discount) return null;
    const mode = (discount.paymentMode ?? discount.type ?? "").toLowerCase();
    if (!mode.includes("free")) return null;
    const unit = discount.periodUnit ?? "";
    const units = discount.periodNumberOfUnits ?? 1;
    if (unit) return { label: formatPeriodLabel(unit, units) };
    const fromISO = parseLabelFromISO(discount.period ?? "");
    return { label: fromISO ?? "free trial" };
  }

  if (Platform.OS === "android") {
    const options = pkg.product.subscriptionOptions ?? [];
    for (const option of options) {
      const phases = option.offerPhases ?? [];
      for (const phase of phases) {
        if (phase.offerPaymentMode === "FREE_TRIAL") {
          const bp = phase.billingPeriod;
          if (bp?.unit && bp.value != null) {
            return { label: formatPeriodLabel(bp.unit, bp.value) };
          }
          if (bp?.iso8601) {
            const fromISO = parseLabelFromISO(bp.iso8601);
            return { label: fromISO ?? "free trial" };
          }
          return { label: "free trial" };
        }
      }
    }
  }

  return null;
}

export type PaywallTrigger =
  | "cook_limit_reached"
  | "active_cook_limit_reached"
  | "planned_cook_limit_reached"
  | "ai_message_limit_reached"
  | "ai_analyze_limit_reached"
  | "frozen_timeline_limit_reached"
  | "pro_required";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: PaywallTrigger | null;
  /** Optional human-friendly subtitle override (e.g. server-supplied 402 message). */
  subtitle?: string | null;
  /** Optional feature label for "pro_required" triggers (e.g. "Multi-Cook Sequencer"). */
  featureName?: string | null;
  /** Optional food type (e.g. "brisket", "ribs") used to personalize the headline / sub-copy. */
  foodType?: string | null;
  /** Optional contextual hint (e.g. "after first scan", "cook #4") shown as a secondary nudge under the subtitle. */
  featureContext?: string | null;
}

const FEATURES: ReadonlyArray<{ icon: FeatherIconName; title: string; desc: string }> = [
  { icon: "zap", title: "Unlimited cooks", desc: "Log every brisket, butt, and rib without hitting a cap." },
  { icon: "message-circle", title: "Unlimited PitMaster chat", desc: "Chat with PitMaster as much as you want — no daily message limits." },
  { icon: "image", title: "Unlimited cook scans", desc: "Analyze every thermometer photo with no daily quota." },
  { icon: "activity", title: "Live auto-grading with MEATER & ThermoWorks", desc: "PitMaster checks in every 30 minutes using live probe temps from your wireless thermometer." },
  { icon: "layers", title: "Multi-Cook Sequencer", desc: "Plan brisket + ribs + sides on one timeline." },
  { icon: "calendar", title: "Multiple active & planned cooks", desc: "Run more than one cook at a time and queue up future cooks." },
  { icon: "bar-chart-2", title: "Cook Quality Analytics", desc: "See your tenderness, bark, and flavor trends over time." },
  { icon: "cpu", title: "Grill Fingerprint", desc: "AI learns your grill's unique heat quirks across every cook and calibrates your plans to match." },
  { icon: "wind", title: "Frozen-to-Table Planner", desc: "Full timeline from freezer to table — every thaw, rest, and smoke step timed perfectly." },
  { icon: "award", title: "Competition Mode", desc: "Competition-ready plans with staggered turn-in times for Chicken, Ribs, Pork, and Brisket." },
  { icon: "cloud", title: "Cook-Day Weather Forecast", desc: "See the forecast before you fire up so you can adjust smoke time for wind and cold." },
];

/** Lower-case the food noun for inline use ("brisket cook", not "Brisket cook"). */
function normalizeFoodType(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase();
}

function triggerHeadline(
  trigger: PaywallTrigger | null | undefined,
  featureName?: string | null,
  foodType?: string | null,
): string {
  const food = normalizeFoodType(foodType);
  switch (trigger) {
    case "cook_limit_reached":
      return food
        ? `Want to log this ${food} cook?`
        : "You've hit your free cook limit";
    case "active_cook_limit_reached":
      return "You already have an active cook";
    case "planned_cook_limit_reached":
      return "You already have a planned cook";
    case "ai_message_limit_reached":
      return food
        ? `Out of free chats — and your ${food} is on the smoker`
        : "You've used your free AI chats today";
    case "ai_analyze_limit_reached":
      return food
        ? `Want PitMaster's tips on your ${food}?`
        : "You've used your free AI scans today";
    case "frozen_timeline_limit_reached":
      return food
        ? `Plan another frozen ${food} cook?`
        : "You've used your free Frozen-to-Table plan";
    case "pro_required":
      if (featureName && food) return `${featureName} for your ${food} cook`;
      if (featureName) return `${featureName} is a Pro feature`;
      return "Unlock Pro";
    default:
      return "Unlock knowyourpit Pro";
  }
}

function defaultSubtitle(
  trigger: PaywallTrigger | null | undefined,
  foodType?: string | null,
): string {
  const food = normalizeFoodType(foodType);
  switch (trigger) {
    case "cook_limit_reached":
      return food
        ? `Your 3-cook journey is just beginning. Add this ${food} and keep building your history with Pro.`
        : "Your 3-cook journey is just beginning. Keep building your history with Pro.";
    case "active_cook_limit_reached":
      return food
        ? `Free plan only allows one active cook at a time — finish your current cook before starting this ${food}, or upgrade for unlimited parallel cooks.`
        : "Free plan only allows one active cook at a time.";
    case "planned_cook_limit_reached":
      return food
        ? `Free plan only allows one planned cook at a time. Upgrade to plan this ${food} alongside your existing cook.`
        : "Free plan only allows one planned cook at a time.";
    case "ai_message_limit_reached":
      return food
        ? `You've used your 3 free messages today — and your ${food} deserves more coaching. Upgrade for unlimited AI chat.`
        : "You've used your 3 free messages today. Upgrade to Pro for unlimited AI chat.";
    case "ai_analyze_limit_reached":
      return food
        ? `You've used your 1 free analysis today. Upgrade to Pro for unlimited scans on every ${food} cook.`
        : "You've used your 1 free analysis today. Upgrade to Pro for unlimited scans.";
    case "frozen_timeline_limit_reached":
      return food
        ? `You've used your 1 free Frozen-to-Table timeline. Upgrade for unlimited frozen ${food} plans.`
        : "You've used your 1 free Frozen-to-Table timeline. Upgrade to Pro for unlimited frozen cook plans.";
    case "pro_required":
      return "Upgrade to Pro to unlock this and every other premium feature.";
    default:
      return "Get every feature, with no caps.";
  }
}

/** Map a food type string to a small Feather icon for the journey cards. */
function foodTypeIcon(foodType?: string | null): FeatherIconName {
  const f = (foodType ?? "").toLowerCase();
  if (f.includes("brisket") || f.includes("beef") || f.includes("steak")) return "award";
  if (f.includes("rib")) return "git-branch";
  if (f.includes("pork") || f.includes("butt") || f.includes("shoulder")) return "circle";
  if (f.includes("chicken") || f.includes("turkey") || f.includes("poultry")) return "feather";
  if (f.includes("fish") || f.includes("salmon")) return "anchor";
  if (f.includes("sausage")) return "minus";
  return "thermometer";
}

function formatJourneyDate(iso?: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

function periodLabel(p?: string | null): string {
  if (!p) return "";
  if (p === "P1Y") return "/ year";
  if (p === "P1M") return "/ month";
  if (p === "P1W") return "/ week";
  return `/ ${p.replace(/^P/, "").toLowerCase()}`;
}

export function PaywallModal({ visible, onClose, trigger, subtitle, featureName, foodType, featureContext }: PaywallModalProps) {
  const colors = useColors();
  const {
    isReady,
    isLoading,
    currentOffering,
    isAnnualTrialEligible,
    isAnnualTrialCheckComplete,
    isRevenueCatAvailable,
    purchasePackage,
    restorePurchases,
    lastError,
  } = useSubscription();
  const effectivePro = useEffectivePro();

  // Cook #4 enhanced wall — fetch the user's recent cooks so we can render a
  // "Your Journey" panel above the feature list. Only enabled for the
  // cook_limit_reached trigger when the modal is visible to avoid wasted
  // requests on every paywall open.
  const isCookLimitWall = trigger === "cook_limit_reached";
  const { data: recentCooksData } = useGetRecentCooks({
    query: {
      queryKey: getGetRecentCooksQueryKey(),
      enabled: visible && isCookLimitWall && !effectivePro,
    },
  });
  const journeyCooks = useMemo<Cook[]>(() => {
    if (!isCookLimitWall) return [];
    const list: Cook[] = recentCooksData ?? [];
    // Spec: "Your 3-cook journey so far" surfaces ONLY completed cooks so
    // ratings render correctly and the panel reflects finished work. If the
    // user has fewer than 3 completed cooks the panel simply renders fewer
    // cards (or hides if zero).
    return list.filter((c) => c.status === "completed").slice(0, 3);
  }, [isCookLimitWall, recentCooksData]);

  const annual = currentOffering?.annual ?? null;
  const monthly = currentOffering?.monthly ?? null;

  const annualTrial = useMemo(() => {
    if (Platform.OS === "ios") {
      if (!isAnnualTrialCheckComplete) return null;
      if (isAnnualTrialEligible === false) return null;
    }
    return getTrialInfo(annual);
  }, [annual, isAnnualTrialEligible, isAnnualTrialCheckComplete]);

  /**
   * Trial info for the monthly product, when RevenueCat exposes one. The
   * iOS eligibility helper today only checks the annual product (since
   * that's where we currently configure trials), so for monthly we lean on
   * RC's product metadata directly. Android already strips ineligible
   * offer phases so the metadata is reliable there too.
   */
  const monthlyTrial = useMemo(() => getTrialInfo(monthly), [monthly]);

  /**
   * True when the user is eligible for *any* free trial on the current
   * offering — drives the trial-aware headline / CTA copy across the modal.
   * Either annual or monthly may carry the trial; whichever has it lights
   * up the trial UI and headline.
   */
  const isTrial = !!annualTrial || !!monthlyTrial;

  /**
   * Format a numeric amount as locale currency. Falls back to a plain
   * `${code} ${amount}` string if Intl.NumberFormat throws (older RN
   * runtimes / unrecognized currency codes).
   */
  const formatMoney = useCallback((amount: number, currencyCode: string | undefined): string => {
    if (!Number.isFinite(amount)) return "";
    if (currencyCode) {
      try {
        return new Intl.NumberFormat(undefined, {
          style: "currency",
          currency: currencyCode,
        }).format(amount);
      } catch {
        // fall through
      }
    }
    return `${currencyCode ? currencyCode + " " : ""}${amount.toFixed(2)}`;
  }, []);

  const savings = useMemo(() => {
    if (!annual || !monthly) return null;
    const yearOfMonthly = monthly.product.price * 12;
    if (yearOfMonthly <= 0 || annual.product.price <= 0) return null;
    const dollars = yearOfMonthly - annual.product.price;
    const pct = Math.round((dollars / yearOfMonthly) * 100);
    if (pct <= 0) return null;
    const currencyCode = annual.product.currencyCode ?? monthly.product.currencyCode ?? undefined;
    return {
      pct,
      // Whole-amount savings feel more tangible than a percentage. We
      // pre-format using the offering's currency so non-USD locales see
      // their own symbol (e.g. "€29", "£25", "A$45").
      formatted: formatMoney(Math.round(dollars), currencyCode),
    };
  }, [annual, monthly, formatMoney]);

  /** Per-month breakdown shown below the annual price (locale-formatted). */
  const annualPerMonthFormatted = useMemo(() => {
    if (!annual) return null;
    const perMo = annual.product.price / 12;
    if (!Number.isFinite(perMo) || perMo <= 0) return null;
    return formatMoney(perMo, annual.product.currencyCode);
  }, [annual, formatMoney]);

  const handlePurchase = async (pkg: PurchasePackageLike) => {
    const result = await purchasePackage(pkg);
    if (result.success) {
      onClose();
    } else if (!result.cancelled && lastError) {
      Alert.alert("Purchase failed", lastError);
    }
  };

  const handleRestore = async () => {
    const result = await restorePurchases();
    if (result.success) {
      Alert.alert("Welcome back", "Your Pro subscription has been restored.");
      onClose();
    } else {
      Alert.alert("No purchases found", "We couldn't find an active subscription on this account.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          {/* ── Header ── */}
          <LinearGradient
            colors={["#2D1A0E", "#1C1C1F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Pressable onPress={onClose} style={styles.closeBtn} hitSlop={12}>
              <Feather name="x" size={22} color="#F0E8D5" />
            </Pressable>
            <View style={styles.proBadge}>
              <Feather name="award" size={12} color="#E84520" />
              <Text style={styles.proBadgeText}>knowyourpit PRO</Text>
            </View>
            <Text style={styles.headline}>
              {isTrial && !effectivePro
                ? "Try Pro free for 7 days"
                : triggerHeadline(trigger, featureName, foodType)}
            </Text>
            <Text style={styles.subhead}>
              {isTrial && !effectivePro
                ? "Full access to everything. Cancel anytime."
                : subtitle ?? defaultSubtitle(trigger, foodType)}
            </Text>
            {/* Trial-aware nudge — appended under the regular subtitle so the
                paywall feels like an invitation rather than a wall when the
                user is still trial-eligible. */}
            {isTrial && !effectivePro && subtitle && (
              <Text style={[styles.subhead, { marginTop: 6, opacity: 0.85 }]}>
                Start a 7-day free trial to unlock unlimited access right now.
              </Text>
            )}
            {featureContext ? (
              <View style={styles.contextChip}>
                <Feather name="info" size={11} color="#F59E0B" />
                <Text style={styles.contextChipText}>{featureContext}</Text>
              </View>
            ) : null}
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* ── Cook #4 "Your Journey" enhanced wall ──
                Only shown for the cook-limit trigger. Frames the upgrade as
                a continuation of the user's existing 3-cook history rather
                than a transactional upsell. */}
            {isCookLimitWall && !effectivePro && (
              <View style={[styles.journeyBlock, { borderBottomColor: colors.border }]}>
                <Text style={[styles.journeyHeader, { color: colors.foreground }]}>
                  Your 3-cook journey so far
                </Text>
                {journeyCooks.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                  >
                    {journeyCooks.map((cook: Cook, idx: number) => {
                      const cookFood = cook?.foodType ?? "Cook";
                      const dateStr = formatJourneyDate(
                        cook?.actualEndAt ?? cook?.actualStartAt ?? cook?.createdAt,
                      );
                      const rating = typeof cook?.rating === "number" ? cook.rating : 0;
                      return (
                        <View
                          key={cook?.id ?? idx}
                          style={[
                            styles.journeyCard,
                            {
                              backgroundColor: colors.card,
                              borderColor: colors.border,
                              borderRadius: colors.radius,
                            },
                          ]}
                        >
                          <View
                            style={[styles.journeyIcon, { backgroundColor: "#E8452020" }]}
                          >
                            <Feather
                              name={foodTypeIcon(cookFood)}
                              size={16}
                              color="#E84520"
                            />
                          </View>
                          <Text
                            numberOfLines={1}
                            style={[styles.journeyTitle, { color: colors.foreground }]}
                          >
                            {cookFood}
                          </Text>
                          {dateStr ? (
                            <Text style={[styles.journeyDate, { color: colors.mutedForeground }]}>
                              {dateStr}
                            </Text>
                          ) : null}
                          {rating > 0 ? (
                            <View style={styles.journeyStars}>
                              {[1, 2, 3, 4, 5].map((n) => (
                                <Feather
                                  key={n}
                                  name="star"
                                  size={9}
                                  color={n <= rating ? "#FACC15" : colors.border}
                                />
                              ))}
                            </View>
                          ) : null}
                        </View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Text style={[styles.journeyEmpty, { color: colors.mutedForeground }]}>
                    Your past cooks will appear here as you log them.
                  </Text>
                )}
                <Text style={[styles.journeyCopy, { color: colors.mutedForeground }]}>
                  Keep going — your history, your scores, and your grill's fingerprint grow with every cook.
                </Text>
                <View style={styles.journeyReassureRow}>
                  <Feather name="shield" size={12} color="#22C55E" />
                  <Text style={[styles.journeyReassure, { color: colors.mutedForeground }]}>
                    Your cooks are never deleted. Everything you've built stays with you.
                  </Text>
                </View>
              </View>
            )}

            {/* ── Feature list ── */}
            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.title} style={[styles.featureRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.featureIcon, { backgroundColor: "#E8452020" }]}>
                    <Feather name={f.icon} size={16} color="#E84520" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.featureTitle, { color: colors.foreground }]}>{f.title}</Text>
                    <Text style={[styles.featureDesc, { color: colors.mutedForeground }]}>{f.desc}</Text>
                  </View>
                </View>
              ))}
            </View>

            {/* ── Plans ── */}
            {!isReady ? (
              <View style={styles.statusBlock}>
                <ActivityIndicator color="#E84520" />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>Loading subscription options…</Text>
              </View>
            ) : effectivePro ? (
              <View style={styles.statusBlock}>
                <Feather name="check-circle" size={28} color="#22C55E" />
                <Text style={[styles.statusText, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                  You're already Pro
                </Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  Thanks for supporting knowyourpit.
                </Text>
              </View>
            ) : !isRevenueCatAvailable ? (
              <View style={styles.statusBlock}>
                <Feather name="alert-circle" size={28} color="#F59E0B" />
                {__DEV__ ? (
                  <>
                    <Text style={[styles.statusText, { color: colors.foreground }]}>
                      Dev build: RevenueCat not configured
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                      {`EXPO_PUBLIC_REVENUECAT_${Platform.OS === "ios" ? "IOS" : "ANDROID"}_KEY is empty in this bundle, or react-native-purchases isn't loaded (Expo Go can't load native modules). Test purchases on a custom dev client (eas build --profile development) with the key set in the matching EAS environment.`}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.statusText, { color: colors.foreground }]}>
                      Subscriptions aren't available yet
                    </Text>
                    <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                      Pro purchases will be enabled in the next app update. Pull to refresh after updating.
                    </Text>
                  </>
                )}
              </View>
            ) : !annual && !monthly ? (
              <View style={styles.statusBlock}>
                <ActivityIndicator color="#E84520" />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Loading plans from {Platform.OS === "ios" ? "App Store" : "Play Store"}…
                </Text>
              </View>
            ) : (
              <View style={styles.plansContainer}>
                {/* Annual is rendered FIRST, regardless of RC ordering, and
                    styled as the visually dominant choice. Monthly sits
                    below as the smaller "pay as you go" option. */}
                {annual && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.planCard,
                      styles.planCardFeatured,
                      { borderRadius: colors.radius },
                      pressed && { opacity: 0.85 },
                      isLoading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePurchase(annual)}
                    disabled={isLoading}
                  >
                    {/* "BEST VALUE" badge — always shown on annual when an
                        offering with both plans is present, even when no
                        savings can be computed (e.g. region without monthly). */}
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>
                        {annualTrial
                          ? `${annualTrial.label.toUpperCase()} FREE, THEN ${annual.product.priceString}${periodLabel(annual.product.subscriptionPeriod).toUpperCase()}`
                          : "BEST VALUE"}
                      </Text>
                    </View>
                    <Text style={styles.planTitle}>Annual · Best Value</Text>
                    {annualTrial ? (
                      <>
                        <Text style={styles.planPrice}>Free</Text>
                        <Text style={styles.planNote}>
                          {`${annualTrial.label} free, then ${annual.product.priceString}${periodLabel(annual.product.subscriptionPeriod)}`}
                        </Text>
                        {annualPerMonthFormatted && (
                          <Text style={styles.planSubNote}>
                            Just {annualPerMonthFormatted}/mo billed annually
                          </Text>
                        )}
                        {savings != null && (
                          <Text style={styles.planSavings}>
                            Save {savings.formatted}/year ({savings.pct}% off)
                          </Text>
                        )}
                        <View style={styles.trialCta}>
                          {/* Cook-limit trigger frames the CTA as continuation
                              ("Keep cooking →") instead of a generic upsell. */}
                          <Text style={styles.trialCtaText}>
                            {isCookLimitWall ? "Keep cooking →" : "Start free trial →"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.planPrice}>
                          {annual.product.priceString}
                          <Text style={styles.planPeriod}>{periodLabel(annual.product.subscriptionPeriod)}</Text>
                        </Text>
                        {annualPerMonthFormatted && (
                          <Text style={styles.planSubNote}>
                            Just {annualPerMonthFormatted}/mo billed annually
                          </Text>
                        )}
                        {savings != null && (
                          <Text style={styles.planSavings}>
                            Save {savings.formatted}/year ({savings.pct}% off)
                          </Text>
                        )}
                        {isCookLimitWall && (
                          <View style={styles.trialCta}>
                            <Text style={styles.trialCtaText}>Keep cooking →</Text>
                          </View>
                        )}
                      </>
                    )}
                  </Pressable>
                )}

                {monthly && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.planCardMonthly,
                      { borderRadius: colors.radius, borderColor: colors.border, backgroundColor: colors.card },
                      pressed && { opacity: 0.85 },
                      isLoading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePurchase(monthly)}
                    disabled={isLoading}
                  >
                    {/* Monthly trial badge — only renders when RC actually
                        exposes a trial on the monthly product. Today this is
                        rare (we configure trials on annual), but the UI must
                        respect whichever package carries the trial. */}
                    {monthlyTrial && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>
                          {`${monthlyTrial.label.toUpperCase()} FREE, THEN ${monthly.product.priceString}${periodLabel(monthly.product.subscriptionPeriod).toUpperCase()}`}
                        </Text>
                      </View>
                    )}
                    <Text style={[styles.planTitleMonthly, { color: colors.mutedForeground }]}>
                      Monthly · pay as you go
                    </Text>
                    {monthlyTrial ? (
                      <>
                        <Text style={[styles.planPriceMonthly, { color: colors.foreground }]}>Free</Text>
                        <Text style={[styles.planNote, { color: colors.mutedForeground }]}>
                          {`${monthlyTrial.label} free, then ${monthly.product.priceString}${periodLabel(monthly.product.subscriptionPeriod)}`}
                        </Text>
                        <View style={[styles.trialCta, styles.trialCtaMonthly]}>
                          <Text style={[styles.trialCtaText, { color: colors.foreground }]}>
                            {isCookLimitWall ? "Keep cooking →" : "Start free trial →"}
                          </Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={[styles.planPriceMonthly, { color: colors.foreground }]}>
                          {monthly.product.priceString}
                          <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>
                            {periodLabel(monthly.product.subscriptionPeriod)}
                          </Text>
                        </Text>
                        <Text style={[styles.planNote, { color: colors.mutedForeground }]}>
                          Cancel anytime
                        </Text>
                        {isCookLimitWall && (
                          <View style={[styles.trialCta, styles.trialCtaMonthly]}>
                            <Text style={[styles.trialCtaText, { color: colors.foreground }]}>
                              Keep cooking →
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                  </Pressable>
                )}

                {isLoading && (
                  <View style={{ alignItems: "center", marginTop: 8 }}>
                    <ActivityIndicator color="#E84520" />
                  </View>
                )}

                {/* Social proof — single muted line under the plan cards.
                    Standard conversion trust signal; copy stays vague
                    until real subscriber data is wired in. */}
                <View style={styles.socialProofRow}>
                  <Feather name="users" size={12} color={colors.mutedForeground} />
                  <Text style={[styles.socialProofText, { color: colors.mutedForeground }]}>
                    Join thousands of pitmasters already on Pro
                  </Text>
                </View>

                {/* "No commitment" reassurance line — sits below the plan
                    cards so it reads as a guarantee on whichever plan the
                    user picks. Copy shifts based on trial eligibility. */}
                <Text style={[styles.noCommitText, { color: colors.mutedForeground }]}>
                  {isTrial
                    ? "No charge for 7 days · Cancel anytime in Settings"
                    : "Cancel anytime · Restore purchases below"}
                </Text>
              </View>
            )}

            {/* ── Footer actions ── */}
            <View style={styles.footer}>
              <Pressable onPress={handleRestore} disabled={isLoading} hitSlop={8}>
                <Text style={[styles.linkText, { color: colors.mutedForeground }]}>Restore purchases</Text>
              </Pressable>
              <View style={styles.policyRow}>
                <Pressable onPress={() => Linking.openURL("https://knowyourpit.com/privacy")} hitSlop={8}>
                  <Text style={[styles.policyLink, { color: colors.mutedForeground }]}>Privacy Policy</Text>
                </Pressable>
                <Text style={[styles.policySep, { color: colors.mutedForeground }]}>·</Text>
                <Pressable onPress={() => Linking.openURL("https://knowyourpit.com/terms")} hitSlop={8}>
                  <Text style={[styles.policyLink, { color: colors.mutedForeground }]}>Terms of Service</Text>
                </Pressable>
              </View>
              <Text style={[styles.legal, { color: colors.mutedForeground }]}>
                {annualTrial
                  ? `After the ${annualTrial.label} free trial, your subscription auto-renews until canceled. `
                  : "Subscriptions auto-renew until canceled. "}
                <Text
                  style={[styles.legalLink, { color: colors.mutedForeground }]}
                  onPress={() =>
                    Linking.openURL(
                      Platform.OS === "ios"
                        ? "itms-apps://apps.apple.com/account/subscriptions"
                        : "https://play.google.com/store/account/subscriptions",
                    )
                  }
                >
                  Manage subscription in {Platform.OS === "ios" ? "App Store" : "Play Store"}
                </Text>
                .
              </Text>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  sheet: { height: "92%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
  closeBtn: { position: "absolute", top: 14, right: 14, padding: 6, zIndex: 2 },
  proBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(232,69,32,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginBottom: 14,
  },
  proBadgeText: { color: "#E84520", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  headline: { color: "#F0E8D5", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 6, marginRight: 30 },
  subhead: { color: "rgba(240,232,213,0.7)", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  contextChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(245,158,11,0.15)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  contextChipText: {
    color: "#F59E0B",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  featureList: { paddingHorizontal: 20, paddingTop: 18 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  featureIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  featureDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  plansContainer: { paddingHorizontal: 20, paddingTop: 22, gap: 12 },
  planCard: {
    paddingVertical: 20,
    paddingHorizontal: 18,
    borderWidth: 2,
  },
  planCardFeatured: {
    backgroundColor: "#E84520",
    borderColor: "#E84520",
  },
  // Smaller, muted card for the "pay as you go" monthly option.
  planCardMonthly: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1,
  },
  bestBadge: {
    position: "absolute",
    top: -10,
    right: 14,
    backgroundColor: "#FACC15",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  bestBadgeText: { color: "#1C1C1F", fontSize: 10.5, fontFamily: "Inter_700Bold", letterSpacing: 0.6, textTransform: "uppercase" },
  trialCta: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  trialCtaMonthly: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  trialCtaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  socialProofRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
  },
  socialProofText: {
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
  },
  noCommitText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginTop: 8,
  },
  planTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 6, letterSpacing: 0.4, textTransform: "uppercase" },
  planTitleMonthly: { fontSize: 12, fontFamily: "Inter_500Medium", marginBottom: 4, letterSpacing: 0.3 },
  planPrice: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  planPriceMonthly: { fontSize: 22, fontFamily: "Inter_600SemiBold" },
  planPeriod: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  planNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
  planSubNote: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
    marginTop: 2,
  },
  planSavings: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#FACC15",
    marginTop: 6,
    letterSpacing: 0.2,
  },
  statusBlock: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: "center",
    gap: 8,
  },
  statusText: { fontSize: 15, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  footer: { paddingHorizontal: 20, paddingTop: 18, alignItems: "center", gap: 10 },
  linkText: { fontSize: 13, fontFamily: "Inter_500Medium", textDecorationLine: "underline" },
  policyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  policyLink: { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
  legalLink: { fontSize: 11, fontFamily: "Inter_400Regular", textDecorationLine: "underline" },
  policySep: { fontSize: 11, fontFamily: "Inter_400Regular" },
  legal: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
  journeyBlock: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  journeyHeader: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  journeyCard: {
    width: 120,
    padding: 10,
    borderWidth: 1,
    gap: 4,
  },
  journeyIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  journeyTitle: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  journeyDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
  journeyStars: { flexDirection: "row", gap: 1, marginTop: 2 },
  journeyEmpty: { fontSize: 12.5, fontFamily: "Inter_400Regular", paddingVertical: 8 },
  journeyCopy: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: 4 },
  journeyReassureRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  journeyReassure: { fontSize: 11.5, fontFamily: "Inter_500Medium", flex: 1 },
});

export default PaywallModal;
