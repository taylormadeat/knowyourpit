import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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

export default function CooksScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const { data: cooks, isLoading, refetch } = useListCooks();

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: any }) => (
    <Pressable
      style={({ pressed }) => [
        s.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
        pressed && { opacity: 0.75 },
      ]}
      onPress={() => router.push(`/cooks/${item.id}` as any)}
    >
      <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.iconWrap}>
        <Feather name="zap" size={20} color="#fff" />
      </LinearGradient>
      <View style={s.info}>
        <Text style={[s.name, { color: colors.foreground }]} numberOfLines={1}>
          {item.foodType || "Unnamed Cook"}
        </Text>
        <Text style={[s.meta, { color: colors.mutedForeground }]}>
          {item.grillName || "No grill"}{item.targetTempF ? ` · ${item.targetTempF}°F target` : ""}
        </Text>
        {item.plannedStartAt && (
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
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );

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

      {isLoading && !cooks ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={(cooks as any[]) || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: botPad + 100,
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
              <Text style={[s.emptyTitle, { color: colors.foreground }]}>No cooks logged yet</Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                Tap "Log Cook" to scan thermometer photos with PitMaster, or use the + button to plan your next session
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
  starsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 },
  starChip: { flexDirection: "row", alignItems: "center", gap: 2 },
  starChipLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#9ca3af" },
  starChipStars: { fontSize: 9, color: "#eab308", letterSpacing: 0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    borderWidth: 1, marginTop: 40, padding: 36,
    alignItems: "center", gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
});
