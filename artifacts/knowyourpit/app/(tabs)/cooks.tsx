import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useListCooks } from "@workspace/api-client-react";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

type SortKey = "date-desc" | "date-asc" | "rating-desc" | "rating-asc";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "date-desc", label: "Newest" },
  { key: "date-asc", label: "Oldest" },
  { key: "rating-desc", label: "Rating ↓" },
  { key: "rating-asc", label: "Rating ↑" },
];

function avgRating(item: any): number {
  const vals = [item.ratingTenderness, item.ratingFlavor, item.ratingBark].filter(
    (v) => typeof v === "number" && v > 0
  );
  if (vals.length > 0) {
    return vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
  }
  if (typeof item.rating === "number" && item.rating > 0) return item.rating;
  return 0;
}

function fmtElapsed(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function fmtCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "starting now";
  const totalMins = Math.floor(diff / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `in ${hrs}h ${mins}m`;
  return `in ${mins}m`;
}

export default function CooksScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [ratedOnly, setRatedOnly] = useState(false);
  const { data: cooks, isLoading, refetch } = useListCooks();

  const botPad = useBottomTabBarHeight();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const processedCooks = useMemo(() => {
    let list: any[] = (cooks as any[]) || [];
    if (ratedOnly) {
      list = list.filter((item) => avgRating(item) > 0);
    }

    const STATUS_PRIORITY: Record<string, number> = { active: 0, planned: 1 };
    const getStatusPriority = (item: any) => STATUS_PRIORITY[item.status] ?? 2;

    const sortWithinGroup = (a: any, b: any) => {
      if (sortKey === "date-desc") {
        return new Date(b.plannedStartAt || 0).getTime() - new Date(a.plannedStartAt || 0).getTime();
      }
      if (sortKey === "date-asc") {
        return new Date(a.plannedStartAt || 0).getTime() - new Date(b.plannedStartAt || 0).getTime();
      }
      if (sortKey === "rating-desc") return avgRating(b) - avgRating(a);
      if (sortKey === "rating-asc") return avgRating(a) - avgRating(b);
      return 0;
    };

    list = [...list].sort((a, b) => {
      const pA = getStatusPriority(a);
      const pB = getStatusPriority(b);
      if (pA !== pB) return pA - pB;
      return sortWithinGroup(a, b);
    });

    return list;
  }, [cooks, sortKey, ratedOnly]);

  const renderItem = ({ item }: { item: any }) => {
    const isActive = item.status === "active";
    const isPlanned = item.status === "planned";
    const elapsedMs = isActive && item.actualStartAt
      ? Date.now() - new Date(item.actualStartAt).getTime()
      : null;
    const plannedStartMs = isPlanned && item.plannedStartAt
      ? new Date(item.plannedStartAt).getTime()
      : null;
    const isSoon = plannedStartMs !== null && plannedStartMs - Date.now() < 48 * 60 * 60 * 1000;

    return (
      <Pressable
        style={({ pressed }) => [
          s.card,
          {
            backgroundColor: colors.card,
            borderColor: isActive ? "#E8482045" : colors.border,
            borderRadius: colors.radius,
          },
          pressed && { opacity: 0.75 },
        ]}
        onPress={() => router.push(`/cooks/${item.id}` as any)}
      >
        <LinearGradient
          colors={isActive ? ["#E84820", "#FF6B2B"] : ["#3A3A3E", "#52525B"]}
          style={s.iconWrap}
        >
          <Feather name={isActive ? "activity" : "zap"} size={20} color="#fff" />
        </LinearGradient>
        <View style={s.info}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
              {item.foodType || "Unnamed Cook"}
            </Text>
            {isActive && (
              <View style={s.livePill}>
                <View style={s.liveDot} />
                <Text style={s.livePillText}>LIVE</Text>
              </View>
            )}
          </View>
          <Text style={[s.meta, { color: colors.mutedForeground }]}>
            {item.grillName || "No grill"}{item.targetTempF ? ` · ${item.targetTempF}°F target` : ""}
          </Text>
          {isActive && elapsedMs !== null && (
            <Text style={[s.liveElapsed, { color: "#E84820" }]}>
              {fmtElapsed(elapsedMs)} on the smoker
            </Text>
          )}
          {isPlanned && plannedStartMs !== null && (
            <Text style={[s.date, { color: isSoon ? "#3b82f6" : colors.mutedForeground }]}>
              {isSoon
                ? fmtCountdown(plannedStartMs)
                : new Date(item.plannedStartAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </Text>
          )}
          {!isActive && !isPlanned && item.plannedStartAt && (
            <Text style={[s.date, { color: colors.mutedForeground }]}>
              {new Date(item.plannedStartAt).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
            </Text>
          )}
          {item.status === "completed" && (item.ratingTenderness || item.ratingFlavor || item.ratingBark) ? (
            <View style={s.starsRow}>
              {[
                { label: "T", val: item.ratingTenderness },
                { label: "F", val: item.ratingFlavor },
                { label: "B", val: item.ratingBark },
              ].filter(r => r.val).map((r) => (
                <View key={r.label} style={s.starChip}>
                  <Text style={s.starChipLabel}>{r.label}</Text>
                  <Text style={s.starChipStars}>
                    {"★".repeat(r.val!)}{"☆".repeat(5 - r.val!)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <View
            style={[
              s.badge,
              { backgroundColor: (STATUS_COLORS[item.status] || colors.primary) + "22" },
            ]}
          >
            <Text
              style={[s.badgeText, { color: STATUS_COLORS[item.status] || colors.primary }]}
            >
              {item.status}
            </Text>
          </View>
          {(() => {
            if (item.status !== "completed") return null;
            const avg = avgRating(item);
            if (avg === 0) return null;
            return (
              <View style={s.avgBadge}>
                <Text style={s.avgBadgeText}>★ {avg.toFixed(1)}</Text>
              </View>
            );
          })()}
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
    );
  };

  const addBtn = (
    <View style={s.headerBtns}>
      <Pressable
        style={[s.scanBtn, { backgroundColor: "#6C3BF5", borderRadius: 8 }]}
        onPress={() => router.push("/cooks/log" as any)}
      >
        <Feather name="camera" size={16} color="#fff" />
        <Text style={s.scanBtnText}>Log Cook</Text>
      </Pressable>
      <Pressable
        style={[s.addBtn, { backgroundColor: colors.primary, borderRadius: 8 }]}
        onPress={() => router.push("/(tabs)/plan" as any)}
      >
        <Feather name="plus" size={18} color="#fff" />
      </Pressable>
    </View>
  );

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Cook Log" right={addBtn} dark />

      <View style={[s.controls, { borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.pillRow}
        >
          {SORT_OPTIONS.map((opt) => {
            const active = sortKey === opt.key;
            return (
              <Pressable
                key={opt.key}
                onPress={() => setSortKey(opt.key)}
                style={[
                  s.pill,
                  active
                    ? { backgroundColor: colors.primary }
                    : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                ]}
              >
                <Text
                  style={[
                    s.pillText,
                    { color: active ? "#fff" : colors.mutedForeground },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => setRatedOnly((v) => !v)}
            style={[
              s.pill,
              ratedOnly
                ? { backgroundColor: "#eab308" }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
            ]}
          >
            <Text style={[s.pillText, { color: ratedOnly ? "#fff" : colors.mutedForeground }]}>
              ★ Rated only
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      {isLoading && !cooks ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={processedCooks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: botPad,
            gap: 10,
          }}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={[s.empty, { borderColor: colors.border, borderRadius: colors.radius }]}>
              <Feather name="thermometer" size={36} color={colors.mutedForeground} />
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>
                {ratedOnly ? "No rated cooks found" : "No cooks logged yet"}
              </Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {ratedOnly
                  ? "Try removing the \"Rated only\" filter to see all cooks"
                  : "Tap \"Log Cook\" to scan thermometer photos with PitMaster, or use the + button to plan your next session"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, fontFamily: "Inter_700Bold" },
  headerBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  scanBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 11, height: 36,
  },
  scanBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  controls: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  pillRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  pillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  card: {
    borderWidth: 1, padding: 14,
    flexDirection: "row", alignItems: "center", gap: 12,
  },
  iconWrap: {
    width: 42, height: 42, borderRadius: 11,
    alignItems: "center", justifyContent: "center",
  },
  info: { flex: 1 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  meta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 2 },
  date: { fontSize: 11, fontFamily: "Inter_400Regular" },
  liveElapsed: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 2 },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8482022",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E84820",
  },
  livePillText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#E84820",
    letterSpacing: 0.6,
  },
  starsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  starChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  starChipLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#9ca3af" },
  starChipStars: { fontSize: 9, color: "#eab308", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  avgBadge: { backgroundColor: "#eab30822", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  avgBadgeText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#eab308" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    borderWidth: 1, marginTop: 40, padding: 36,
    alignItems: "center", gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
