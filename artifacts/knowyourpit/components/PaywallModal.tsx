import React, { useMemo } from "react";
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
  | "pro_required";

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  trigger?: PaywallTrigger | null;
  /** Optional human-friendly subtitle override (e.g. server-supplied 402 message). */
  subtitle?: string | null;
  /** Optional feature label for "pro_required" triggers (e.g. "Multi-Cook Sequencer"). */
  featureName?: string | null;
}

const FEATURES = [
  { icon: "zap", title: "Unlimited cooks", desc: "Log every brisket, butt, and rib without hitting a cap." },
  { icon: "message-circle", title: "Unlimited PitMaster chat", desc: "Chat with PitMaster as much as you want — no daily message limits." },
  { icon: "image", title: "Unlimited cook scans", desc: "Analyze every thermometer photo with no daily quota." },
  { icon: "activity", title: "Live auto-grading with MEATER & ThermoWorks", desc: "PitMaster checks in every 30 minutes using live probe temps from your wireless thermometer." },
  { icon: "layers", title: "Multi-Cook Sequencer", desc: "Plan brisket + ribs + sides on one timeline." },
  { icon: "calendar", title: "Multiple active & planned cooks", desc: "Run more than one cook at a time and queue up future cooks." },
  { icon: "bar-chart-2", title: "Cook Quality Analytics", desc: "See your tenderness, bark, and flavor trends over time." },
];

function triggerHeadline(trigger: PaywallTrigger | null | undefined, featureName?: string | null): string {
  switch (trigger) {
    case "cook_limit_reached":
      return "You've hit your free cook limit";
    case "active_cook_limit_reached":
      return "You already have an active cook";
    case "planned_cook_limit_reached":
      return "You already have a planned cook";
    case "ai_message_limit_reached":
      return "You've used your free AI chats today";
    case "ai_analyze_limit_reached":
      return "You've used your free AI scans today";
    case "pro_required":
      return featureName ? `${featureName} is a Pro feature` : "Unlock Pro";
    default:
      return "Unlock knowyourpit Pro";
  }
}

function defaultSubtitle(trigger: PaywallTrigger | null | undefined): string {
  switch (trigger) {
    case "cook_limit_reached":
      return "Free plan is capped at 3 cooks. Upgrade for unlimited logging.";
    case "active_cook_limit_reached":
      return "Free plan only allows one active cook at a time.";
    case "planned_cook_limit_reached":
      return "Free plan only allows one planned cook at a time.";
    case "ai_message_limit_reached":
      return "Free plan includes 5 AI chats per day. Upgrade for unlimited.";
    case "ai_analyze_limit_reached":
      return "Free plan includes 3 AI cook scans per day. Upgrade for unlimited.";
    case "pro_required":
      return "Upgrade to Pro to unlock this and every other premium feature.";
    default:
      return "Get every feature, with no caps.";
  }
}

function periodLabel(p?: string | null): string {
  if (!p) return "";
  if (p === "P1Y") return "/ year";
  if (p === "P1M") return "/ month";
  if (p === "P1W") return "/ week";
  return `/ ${p.replace(/^P/, "").toLowerCase()}`;
}

export function PaywallModal({ visible, onClose, trigger, subtitle, featureName }: PaywallModalProps) {
  const colors = useColors();
  const {
    isReady,
    isLoading,
    isPro,
    currentOffering,
    isAnnualTrialEligible,
    isAnnualTrialCheckComplete,
    isRevenueCatAvailable,
    purchasePackage,
    restorePurchases,
    lastError,
  } = useSubscription();

  const annual = currentOffering?.annual ?? null;
  const monthly = currentOffering?.monthly ?? null;

  const annualTrial = useMemo(() => {
    if (Platform.OS === "ios") {
      if (!isAnnualTrialCheckComplete) return null;
      if (isAnnualTrialEligible === false) return null;
    }
    return getTrialInfo(annual);
  }, [annual, isAnnualTrialEligible, isAnnualTrialCheckComplete]);

  const savings = useMemo(() => {
    if (!annual || !monthly) return null;
    const yearOfMonthly = monthly.product.price * 12;
    if (yearOfMonthly <= 0 || annual.product.price <= 0) return null;
    const pct = Math.round(((yearOfMonthly - annual.product.price) / yearOfMonthly) * 100);
    return pct > 0 ? pct : null;
  }, [annual, monthly]);

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
            <Text style={styles.headline}>{triggerHeadline(trigger, featureName)}</Text>
            <Text style={styles.subhead}>{subtitle ?? defaultSubtitle(trigger)}</Text>
          </LinearGradient>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* ── Feature list ── */}
            <View style={styles.featureList}>
              {FEATURES.map((f) => (
                <View key={f.title} style={[styles.featureRow, { borderBottomColor: colors.border }]}>
                  <View style={[styles.featureIcon, { backgroundColor: "#E8452020" }]}>
                    <Feather name={f.icon as any} size={16} color="#E84520" />
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
            ) : isPro ? (
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
                    {savings != null && !annualTrial && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>BEST VALUE — SAVE {savings}%</Text>
                      </View>
                    )}
                    {annualTrial && (
                      <View style={styles.bestBadge}>
                        <Text style={styles.bestBadgeText}>
                          {savings != null ? `${annualTrial.label.toUpperCase()} FREE · SAVE ${savings}%` : `${annualTrial.label.toUpperCase()} FREE TRIAL`}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.planTitle}>Annual</Text>
                    {annualTrial ? (
                      <>
                        <Text style={styles.planPrice}>Free</Text>
                        <Text style={styles.planNote}>
                          {`${annualTrial.label} free, then ${annual.product.priceString}${periodLabel(annual.product.subscriptionPeriod)}`}
                        </Text>
                        <View style={styles.trialCta}>
                          <Text style={styles.trialCtaText}>Start free trial →</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <Text style={styles.planPrice}>
                          {annual.product.priceString}
                          <Text style={styles.planPeriod}>{periodLabel(annual.product.subscriptionPeriod)}</Text>
                        </Text>
                        <Text style={styles.planNote}>
                          {monthly
                            ? `Just ${(annual.product.price / 12).toFixed(2)} ${annual.product.currencyCode ?? ""}/mo, billed yearly`
                            : "Billed yearly"}
                        </Text>
                      </>
                    )}
                  </Pressable>
                )}

                {monthly && (
                  <Pressable
                    style={({ pressed }) => [
                      styles.planCard,
                      { borderRadius: colors.radius, borderColor: colors.border, backgroundColor: colors.card },
                      pressed && { opacity: 0.85 },
                      isLoading && { opacity: 0.6 },
                    ]}
                    onPress={() => handlePurchase(monthly)}
                    disabled={isLoading}
                  >
                    <Text style={[styles.planTitle, { color: colors.foreground }]}>Monthly</Text>
                    <Text style={[styles.planPrice, { color: colors.foreground }]}>
                      {monthly.product.priceString}
                      <Text style={[styles.planPeriod, { color: colors.mutedForeground }]}>
                        {periodLabel(monthly.product.subscriptionPeriod)}
                      </Text>
                    </Text>
                    <Text style={[styles.planNote, { color: colors.mutedForeground }]}>
                      Billed monthly · Cancel anytime
                    </Text>
                  </Pressable>
                )}

                {isLoading && (
                  <View style={{ alignItems: "center", marginTop: 8 }}>
                    <ActivityIndicator color="#E84520" />
                  </View>
                )}
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
                Manage in your {Platform.OS === "ios" ? "App Store" : "Play Store"} account.
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
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1.5,
  },
  planCardFeatured: {
    backgroundColor: "#E84520",
    borderColor: "#E84520",
  },
  bestBadge: {
    position: "absolute",
    top: -10,
    right: 14,
    backgroundColor: "#FACC15",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bestBadgeText: { color: "#1C1C1F", fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.4 },
  trialCta: {
    marginTop: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  trialCtaText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 0.2 },
  planTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 4, letterSpacing: 0.3, textTransform: "uppercase" },
  planPrice: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  planPeriod: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.8)" },
  planNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", marginTop: 4 },
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
  policySep: { fontSize: 11, fontFamily: "Inter_400Regular" },
  legal: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
});

export default PaywallModal;
