import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onPause?: () => void;
  trigger?: PaywallTrigger | null;
  subtitle?: string | null;
  featureName?: string | null;
  foodType?: string | null;
  featureContext?: string | null;
}

const FEATURES: ReadonlyArray<{ icon: FeatherIconName; label: string }> = [
  { icon: "zap",          label: "Unlimited cooks & cook history" },
  { icon: "message-circle", label: "Unlimited PitMaster AI chat & scans" },
  { icon: "activity",    label: "Live probe auto-grading (MEATER & ThermoWorks)" },
  { icon: "layers",      label: "Multi-Cook Sequencer & Competition Mode" },
  { icon: "bar-chart-2", label: "Cook Quality Analytics & Grill Fingerprint" },
];

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
      return food ? `Want to log this ${food} cook?` : "You've hit your free cook limit";
    case "active_cook_limit_reached":
      return "You already have an active cook";
    case "planned_cook_limit_reached":
      return "You already have a planned cook";
    case "ai_message_limit_reached":
      return food
        ? `Out of free chats — and your ${food} is on the smoker`
        : "You've used your free AI chats today";
    case "ai_analyze_limit_reached":
      return food ? `Want PitMaster's tips on your ${food}?` : "You've used your free AI scans today";
    case "frozen_timeline_limit_reached":
      return food ? `Plan another frozen ${food} cook?` : "You've used your free Frozen-to-Table plan";
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
        ? `Add this ${food} and keep building your cook history with Pro.`
        : "Keep building your cook history with Pro.";
    case "active_cook_limit_reached":
      return food
        ? `Free plan allows one active cook — upgrade to run this ${food} alongside your current cook.`
        : "Free plan allows one active cook at a time.";
    case "planned_cook_limit_reached":
      return food
        ? `Upgrade to plan this ${food} alongside your existing cook.`
        : "Free plan allows one planned cook at a time.";
    case "ai_message_limit_reached":
      return food
        ? `You've used your free messages today — your ${food} deserves more coaching.`
        : "You've used your 3 free messages today.";
    case "ai_analyze_limit_reached":
      return food
        ? `Upgrade for unlimited scans on every ${food} cook.`
        : "You've used your 1 free analysis today.";
    case "frozen_timeline_limit_reached":
      return food
        ? `Upgrade for unlimited frozen ${food} plans.`
        : "You've used your 1 free Frozen-to-Table timeline.";
    case "pro_required":
      return "Upgrade to unlock this and every other Pro feature.";
    default:
      return "Every feature, no limits.";
  }
}

function valueComparisonLine(hasTrial: boolean, preferAnnual: boolean): string {
  if (hasTrial) return "Start free — less than a bag of charcoal to keep going after that.";
  if (preferAnnual) return "Less than a bag of charcoal a month — and it makes every bag go further.";
  return "About the price of a bag of pellets — for unlimited cooks all month.";
}

function periodLabel(p?: string | null): string {
  if (!p) return "";
  if (p === "P1Y") return "/ year";
  if (p === "P1M") return "/ month";
  if (p === "P1W") return "/ week";
  return `/ ${p.replace(/^P/, "").toLowerCase()}`;
}

export function PaywallModal({ visible, onClose, trigger, subtitle, featureName, foodType }: PaywallModalProps) {
  const colors = useColors();
  const {
    isReady,
    isLoading,
    currentOffering,
    isAnnualTrialEligible,
    isAnnualTrialCheckComplete,
    isRevenueCatAvailable,
    offeringsLoadFailed,
    offeringsFailureReason,
    purchasePackage,
    restorePurchases,
    lastError,
    retryOfferings,
  } = useSubscription();
  const effectivePro = useEffectivePro();

  const annual = currentOffering?.annual ?? null;
  const monthly = currentOffering?.monthly ?? null;

  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const retryingRef = useRef(false);

  const showingError =
    visible && isReady && isRevenueCatAvailable && offeringsLoadFailed && !annual && !monthly;

  const handleRetry = useCallback(async () => {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setIsRetrying(true);
    setRetryCountdown(null);
    try {
      await retryOfferings();
    } finally {
      retryingRef.current = false;
      setIsRetrying(false);
      setRetryKey((k) => k + 1);
    }
  }, [retryOfferings]);

  useEffect(() => {
    if (!showingError) {
      setRetryCountdown(null);
      return;
    }
    const COUNTDOWN = 15;
    setRetryCountdown(COUNTDOWN);
    const interval = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev === null || retryingRef.current) return prev;
        if (prev <= 1) {
          clearInterval(interval);
          handleRetry();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showingError, retryKey]);

  const annualTrial = useMemo(() => {
    if (Platform.OS === "ios") {
      if (!isAnnualTrialCheckComplete) return null;
      if (isAnnualTrialEligible === false) return null;
    }
    return getTrialInfo(annual);
  }, [annual, isAnnualTrialEligible, isAnnualTrialCheckComplete]);

  const monthlyTrial = useMemo(() => getTrialInfo(monthly), [monthly]);
  const isTrial = !!annualTrial || !!monthlyTrial;

  const formatMoney = useCallback((amount: number, currencyCode: string | undefined): string => {
    if (!Number.isFinite(amount)) return "";
    if (currencyCode) {
      try {
        return new Intl.NumberFormat(undefined, { style: "currency", currency: currencyCode }).format(amount);
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
    return { pct, formatted: formatMoney(Math.round(dollars), currencyCode) };
  }, [annual, monthly, formatMoney]);

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

  const headline = isTrial && !effectivePro
    ? "Try Pro free for 7 days"
    : triggerHeadline(trigger, featureName, foodType);
  const sub = isTrial && !effectivePro
    ? "Full access to everything. Cancel anytime."
    : subtitle ?? defaultSubtitle(trigger, foodType);
  const valueLine = valueComparisonLine(isTrial && !effectivePro, !!annual);

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
            <Text style={styles.headline}>{headline}</Text>
            <Text style={styles.subhead}>{sub}</Text>
            {!effectivePro && (
              <View style={styles.valueRow}>
                <Feather name="tag" size={12} color="#F59E0B" style={{ marginTop: 1 }} />
                <Text style={styles.valueLine}>{valueLine}</Text>
              </View>
            )}
          </LinearGradient>

          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 28 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── Feature checklist ── */}
            <View style={[styles.featureList, { borderBottomColor: colors.border }]}>
              {FEATURES.map((f) => (
                <View key={f.label} style={styles.featureRow}>
                  <View style={[styles.featureIcon, { backgroundColor: "#E8452018" }]}>
                    <Feather name={f.icon} size={15} color="#E84520" />
                  </View>
                  <Text style={[styles.featureLabel, { color: colors.foreground }]}>{f.label}</Text>
                  <Feather name="check" size={14} color="#22C55E" />
                </View>
              ))}
            </View>

            {/* ── Plans / status ── */}
            {!isReady ? (
              <View style={styles.statusBlock}>
                <ActivityIndicator color="#E84520" />
                <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
                  Loading subscription options…
                </Text>
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
                      Pro purchases will be enabled in the next app update.
                    </Text>
                  </>
                )}
              </View>
            ) : !annual && !monthly ? (
              <View style={styles.statusBlock}>
                <Feather name="wifi-off" size={28} color="#F59E0B" />
                <Text style={[styles.statusText, { color: colors.foreground }]}>
                  Couldn't load subscription options
                </Text>
                <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                  {offeringsFailureReason === "timeout"
                    ? "Store timed out. Check your connection and tap retry."
                    : offeringsFailureReason === "error"
                      ? "Store returned an error. Check your connection and tap retry."
                      : offeringsFailureReason === "no_products"
                        ? "Products not found in the App Store. Tap retry or check back later."
                        : "Subscription options unavailable. Tap retry."}
                </Text>
                {lastError ? (
                  <Text style={[styles.statusSub, { color: "#F59E0B", fontSize: 11, marginTop: 4 }]}>
                    {`Error: ${lastError}`}
                  </Text>
                ) : null}
                <Text style={[styles.statusSub, { color: colors.mutedForeground, fontSize: 10, marginTop: 2, opacity: 0.6 }]}>
                  {`offering=${currentOffering ? currentOffering.identifier : "none"} reason=${offeringsFailureReason ?? "?"} failed=${offeringsLoadFailed}`}
                </Text>
                {retryCountdown !== null && !isRetrying && (
                  <Text style={[styles.statusSub, { color: colors.mutedForeground, fontSize: 11, marginTop: 6 }]}>
                    {`Auto-retrying in ${retryCountdown}s…`}
                  </Text>
                )}
                <Pressable
                  onPress={handleRetry}
                  disabled={isRetrying}
                  style={({ pressed }) => [styles.retryBtn, (pressed || isRetrying) && { opacity: 0.6 }]}
                >
                  <Feather name={isRetrying ? "loader" : "refresh-cw"} size={14} color="#fff" />
                  <Text style={styles.retryBtnText}>{isRetrying ? "Retrying…" : "Retry now"}</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.plansContainer}>
                {/* Annual — featured */}
                {annual && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.planCard,
                      styles.planCardFeatured,
                      { borderRadius: colors.radius },
                      pressed && { opacity: 0.88 },
                      isLoading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePurchase(annual)}
                    disabled={isLoading}
                  >
                    <View style={styles.planCardTop}>
                      <View>
                        <Text style={styles.planTitle}>Annual · Best Value</Text>
                        {annualTrial ? (
                          <>
                            <Text style={styles.planPrice}>Free</Text>
                            <Text style={styles.planNote}>
                              {`${annualTrial.label} free, then ${annual.product.priceString}${periodLabel(annual.product.subscriptionPeriod)}`}
                            </Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.planPrice}>
                              {annual.product.priceString}
                              <Text style={styles.planPeriod}>{periodLabel(annual.product.subscriptionPeriod)}</Text>
                            </Text>
                            {annualPerMonthFormatted && (
                              <Text style={styles.planNote}>
                                Just {annualPerMonthFormatted}/mo billed annually
                              </Text>
                            )}
                          </>
                        )}
                      </View>
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>
                          {annualTrial
                            ? `${annualTrial.label.toUpperCase()} FREE`
                            : savings ? `SAVE ${savings.pct}%` : "BEST VALUE"}
                        </Text>
                      </View>
                    </View>
                    {savings && !annualTrial && (
                      <Text style={styles.planSavings}>Save {savings.formatted}/year</Text>
                    )}
                    <View style={styles.planCta}>
                      <Text style={styles.planCtaText}>
                        {annualTrial ? "Start free trial →" : "Get Annual →"}
                      </Text>
                    </View>
                  </Pressable>
                )}

                {/* Monthly — secondary */}
                {monthly && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.planCardMonthly,
                      {
                        borderRadius: colors.radius,
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                      },
                      pressed && { opacity: 0.85 },
                      isLoading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePurchase(monthly)}
                    disabled={isLoading}
                  >
                    <View style={styles.planCardTop}>
                      <View>
                        <Text style={[styles.planTitleMonthly, { color: colors.mutedForeground }]}>
                          Monthly · pay as you go
                        </Text>
                        {monthlyTrial ? (
                          <>
                            <Text style={[styles.planPriceMonthly, { color: colors.foreground }]}>Free</Text>
                            <Text style={[styles.planNote, { color: colors.mutedForeground }]}>
                              {`${monthlyTrial.label} free, then ${monthly.product.priceString}${periodLabel(monthly.product.subscriptionPeriod)}`}
                            </Text>
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
                          </>
                        )}
                      </View>
                    </View>
                  </Pressable>
                )}

                {isLoading && (
                  <View style={{ alignItems: "center", marginTop: 6 }}>
                    <ActivityIndicator color="#E84520" />
                  </View>
                )}

                <Text style={[styles.noCommitText, { color: colors.mutedForeground }]}>
                  {isTrial
                    ? "No charge for 7 days · Cancel anytime in Settings"
                    : "Cancel anytime · Restore purchases below"}
                </Text>
              </View>
            )}

            {/* ── Footer ── */}
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
                  Manage in {Platform.OS === "ios" ? "App Store" : "Play Store"}
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
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "flex-end" },
  sheet: { height: "82%", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },

  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  closeBtn: { position: "absolute", top: 14, right: 14, padding: 6, zIndex: 2 },
  proBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(232,69,32,0.18)",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, alignSelf: "flex-start", marginBottom: 12,
  },
  proBadgeText: { color: "#E84520", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.6 },
  headline: { color: "#F0E8D5", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 6, marginRight: 30, lineHeight: 28 },
  subhead: { color: "rgba(240,232,213,0.75)", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  valueRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, marginTop: 10 },
  valueLine: { color: "#F59E0B", fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18, flex: 1 },

  featureList: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  featureIcon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  featureLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 20 },

  plansContainer: { paddingHorizontal: 16, paddingTop: 16, gap: 10 },

  planCard: {
    backgroundColor: "#E84520", padding: 16, gap: 8,
    borderWidth: 0,
  },
  planCardFeatured: {},
  planCardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planTitle: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, marginBottom: 2 },
  planPrice: { color: "#fff", fontSize: 26, fontFamily: "Inter_700Bold" },
  planPeriod: { fontSize: 14, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.75)" },
  planNote: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  planSavings: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
  planCta: {
    backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8,
    paddingVertical: 8, alignItems: "center", marginTop: 4,
  },
  planCtaText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  bestBadge: {
    backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8,
  },
  bestBadgeText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },

  planCardMonthly: { padding: 14, borderWidth: 1 },
  planTitleMonthly: { fontSize: 12, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, marginBottom: 2 },
  planPriceMonthly: { fontSize: 22, fontFamily: "Inter_700Bold" },

  noCommitText: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 4 },

  statusBlock: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 8, gap: 10 },
  statusText: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 19 },

  retryBtn: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "#E84520", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, marginTop: 6,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },

  footer: { paddingHorizontal: 20, paddingTop: 16, gap: 8, alignItems: "center" },
  linkText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  policyRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  policyLink: { fontSize: 12, fontFamily: "Inter_400Regular" },
  policySep: { fontSize: 12 },
  legal: { fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 15, paddingHorizontal: 8 },
  legalLink: { textDecorationLine: "underline" },
});
