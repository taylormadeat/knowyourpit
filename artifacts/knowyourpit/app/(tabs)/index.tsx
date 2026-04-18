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

const logoImg = require("@/assets/images/logo.png");

const STATUS_COLOR: Record<string, string> = {
  planned: "#3b82f6",
  active: "#E84820",
  completed: "#22c55e",
  cancelled: "#9ca3af",
};

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useUser();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const { data: recentCooks, isLoading: cooksLoading } = useGetRecentCooks();

  const firstName =
    user?.firstName ||
    user?.emailAddresses?.[0]?.emailAddress?.split("@")[0] ||
    "Pitmaster";

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const quickActions = [
    { icon: "plus-circle", label: "Plan a Cook", route: "/(tabs)/plan" },
    { icon: "cpu", label: "AI Assistant", route: "/(tabs)/ai" },
    { icon: "thermometer", label: "Temp Scan", route: "/temperature" },
    { icon: "book-open", label: "Recipes", route: "/recipes" },
  ];

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
          {/* Watermark logo */}
          <Image
            source={logoImg}
            style={s.watermark}
            resizeMode="contain"
          />

          {/* Fire accent bar */}
          <View style={s.fireBar} />

          <Text style={s.greeting}>Good {getTimeGreeting()}</Text>
          <Text style={s.heroName}>{firstName} 🔥</Text>
          <Text style={s.heroSub}>Ready to fire it up?</Text>

          {/* Stat chips */}
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

        {/* ── Quick Actions ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionAccent} />
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        </View>
        <View style={s.quickGrid}>
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [
                s.quickCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
                pressed && { opacity: 0.75, transform: [{ scale: 0.97 }] },
              ]}
              onPress={() => router.push(a.route as any)}
            >
              <LinearGradient
                colors={["#E84820", "#FF6B2B"]}
                style={s.quickIconBg}
              >
                <Feather name={a.icon as any} size={18} color="#fff" />
              </LinearGradient>
              <Text style={[s.quickLabel, { color: colors.foreground }]}>{a.label}</Text>
              <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ alignSelf: "flex-end" }} />
            </Pressable>
          ))}
        </View>

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
        ) : !recentCooks?.length ? (
          <View style={[s.emptyCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="inbox" size={36} color={colors.mutedForeground} />
            <Text style={[s.emptyTitle, { color: colors.foreground }]}>No cooks yet</Text>
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>Fire it up with your first cook!</Text>
          </View>
        ) : (
          (recentCooks as any[]).slice(0, 5).map((cook: any) => (
            <Pressable
              key={cook.id}
              style={({ pressed }) => [
                s.cookCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => router.push(`/cooks/${cook.id}` as any)}
            >
              <LinearGradient
                colors={["#E84820", "#FF6B2B"]}
                style={s.cookIconBg}
              >
                <Feather name="zap" size={16} color="#fff" />
              </LinearGradient>
              <View style={s.cookInfo}>
                <Text style={[s.cookName, { color: colors.foreground }]} numberOfLines={1}>
                  {cook.name || cook.meatType || "Cook"}
                </Text>
                <Text style={[s.cookMeta, { color: colors.mutedForeground }]}>
                  {cook.grill?.name || "No grill selected"}
                </Text>
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

  /* Quick grid */
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  quickCard: {
    width: "47%",
    borderWidth: 1,
    padding: 16,
    gap: 10,
    shadowColor: "#E84820",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconBg: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  quickLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
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
