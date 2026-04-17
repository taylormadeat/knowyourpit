import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useGetDashboardSummary, useGetRecentCooks } from "@workspace/api-client-react";

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
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: botPad + 100 }}
      >
        <View style={[s.header, { paddingTop: topPad + 20 }]}>
          <Text style={[s.greeting, { color: colors.mutedForeground }]}>
            Good {getTimeGreeting()}
          </Text>
          <Text style={[s.name, { color: colors.foreground }]}>
            {firstName} 🔥
          </Text>
        </View>

        {summaryLoading ? (
          <View style={{ padding: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <View style={s.statsRow}>
            {[
              { n: summary?.totalCooks ?? 0, l: "Total Cooks" },
              { n: summary?.totalGrills ?? 0, l: "Grills" },
              { n: summary?.plannedCooks ?? 0, l: "Planned" },
            ].map((s2) => (
              <View
                key={s2.l}
                style={[
                  s.statCard,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                ]}
              >
                <Text style={[s.statNum, { color: colors.primary }]}>{s2.n}</Text>
                <Text style={[s.statLabel, { color: colors.mutedForeground }]}>{s2.l}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Quick Actions</Text>
        </View>
        <View style={s.quickGrid}>
          {quickActions.map((a) => (
            <Pressable
              key={a.label}
              style={({ pressed }) => [
                s.quickCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                pressed && { opacity: 0.7 },
              ]}
              onPress={() => router.push(a.route as any)}
            >
              <View style={[s.quickIcon, { backgroundColor: colors.primary + "22" }]}>
                <Feather name={a.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={[s.quickLabel, { color: colors.foreground }]}>{a.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={s.sectionHeader}>
          <Text style={[s.sectionTitle, { color: colors.foreground }]}>Recent Cooks</Text>
          <Pressable onPress={() => router.push("/(tabs)/cooks" as any)}>
            <Text style={[s.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        </View>

        {cooksLoading ? (
          <View style={{ padding: 20 }}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : !recentCooks?.length ? (
          <View
            style={[
              s.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
            ]}
          >
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
              No cooks yet — fire it up!
            </Text>
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
              <View style={[s.cookIcon, { backgroundColor: colors.primary + "22" }]}>
                <Feather name="flame" size={18} color={colors.primary} />
              </View>
              <View style={s.cookInfo}>
                <Text style={[s.cookName, { color: colors.foreground }]} numberOfLines={1}>
                  {cook.name || cook.meatType || "Cook"}
                </Text>
                <Text style={[s.cookMeta, { color: colors.mutedForeground }]}>
                  {cook.grill?.name || "No grill selected"}
                </Text>
              </View>
              <Text
                style={[
                  s.cookStatus,
                  {
                    backgroundColor: cook.status === "completed" ? colors.primary + "22" : colors.muted,
                    color: cook.status === "completed" ? colors.primary : colors.mutedForeground,
                  },
                ]}
              >
                {cook.status}
              </Text>
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
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  greeting: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 4 },
  name: { fontSize: 26, fontFamily: "Inter_700Bold" },
  statsRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
  statCard: { flex: 1, borderWidth: 1, padding: 14, alignItems: "center" },
  statNum: { fontSize: 24, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_500Medium" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 20, marginBottom: 28 },
  quickCard: { width: "47%", borderWidth: 1, padding: 16, gap: 10 },
  quickIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  quickLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  emptyCard: { borderWidth: 1, margin: 20, padding: 28, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  cookCard: {
    borderWidth: 1, marginHorizontal: 20, marginBottom: 10, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  cookIcon: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cookInfo: { flex: 1 },
  cookName: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  cookMeta: { fontSize: 12, fontFamily: "Inter_400Regular" },
  cookStatus: {
    fontSize: 11, fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
});
