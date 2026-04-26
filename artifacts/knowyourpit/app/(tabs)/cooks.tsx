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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useListCooks, useUpdateSession } from "@workspace/api-client-react";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const VERDICT_BADGE: Record<string, { label: string; color: string; icon: keyof typeof Feather.glyphMap }> = {
  perfect:     { label: "Perfect",    color: "#22c55e", icon: "award" },
  good:        { label: "Good",       color: "#14b8a6", icon: "thumbs-up" },
  needs_work:  { label: "Needs Work", color: "#eab308", icon: "tool" },
  overcooked:  { label: "Overcooked", color: "#ef4444", icon: "thermometer" },
  undercooked: { label: "Undercooked",color: "#ef4444", icon: "thermometer" },
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

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

interface SessionGroup {
  sessionId: string;
  cooks: any[];
  earliestStart: Date | null;
  sessionLabel: string | null;
  sessionNotes: string | null;
}

export default function CooksScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [ratedOnly, setRatedOnly] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [editingSession, setEditingSession] = useState<SessionGroup | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const { data: cooks, isLoading, refetch } = useListCooks();
  const updateSession = useUpdateSession();

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

  const sessionGroups = useMemo((): SessionGroup[] => {
    const all: any[] = (cooks as any[]) || [];
    const grouped: Record<string, any[]> = {};
    for (const cook of all) {
      if (cook.sessionId) {
        if (!grouped[cook.sessionId]) grouped[cook.sessionId] = [];
        grouped[cook.sessionId].push(cook);
      }
    }
    const groups: SessionGroup[] = Object.entries(grouped).map(([sessionId, sessionCooks]) => {
      const dates = sessionCooks
        .map((c) => c.plannedStartAt ? new Date(c.plannedStartAt) : null)
        .filter(Boolean) as Date[];
      const earliestStart = dates.length > 0
        ? dates.reduce((min, d) => d < min ? d : min, dates[0])
        : null;
      const sorted = [...sessionCooks].sort((a, b) => {
        const aTime = a.plannedStartAt ? new Date(a.plannedStartAt).getTime() : 0;
        const bTime = b.plannedStartAt ? new Date(b.plannedStartAt).getTime() : 0;
        return aTime - bTime;
      });
      const first = sorted[0] || sessionCooks[0];
      const sessionLabel = first?.sessionLabel ?? null;
      const sessionNotes = first?.sessionNotes ?? null;
      return { sessionId, cooks: sorted, earliestStart, sessionLabel, sessionNotes };
    });
    groups.sort((a, b) => {
      if (!a.earliestStart && !b.earliestStart) return 0;
      if (!a.earliestStart) return 1;
      if (!b.earliestStart) return -1;
      if (sortKey === "date-asc") return a.earliestStart.getTime() - b.earliestStart.getTime();
      return b.earliestStart.getTime() - a.earliestStart.getTime();
    });
    return groups;
  }, [cooks, sortKey]);

  type UnifiedItem =
    | { type: "cook"; data: any }
    | { type: "sessionHeader"; group: SessionGroup }
    | { type: "sessionCook"; data: any; sessionId: string };

  const unifiedList = useMemo((): UnifiedItem[] => {
    const sessionIdSet = new Set(sessionGroups.map((g) => g.sessionId));
    const soloCooks = processedCooks.filter((c) => !c.sessionId || !sessionIdSet.has(c.sessionId));

    const STATUS_PRIORITY: Record<string, number> = { active: 0, planned: 1 };

    const getRepDate = (item: UnifiedItem): number => {
      if (item.type === "cook") return new Date(item.data.plannedStartAt || 0).getTime();
      if (item.type === "sessionHeader") return item.group.earliestStart?.getTime() ?? 0;
      return 0;
    };
    const getPriority = (item: UnifiedItem): number => {
      if (item.type === "cook") return STATUS_PRIORITY[item.data.status] ?? 2;
      if (item.type === "sessionHeader") {
        const hasActive = item.group.cooks.some((c) => c.status === "active");
        const hasPlanned = item.group.cooks.some((c) => c.status === "planned");
        return hasActive ? 0 : hasPlanned ? 1 : 2;
      }
      return 2;
    };

    const topItems: UnifiedItem[] = [
      ...soloCooks.map((c) => ({ type: "cook" as const, data: c })),
      ...sessionGroups.map((g) => ({ type: "sessionHeader" as const, group: g })),
    ];

    topItems.sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      const dA = getRepDate(a);
      const dB = getRepDate(b);
      return sortKey === "date-asc" ? dA - dB : dB - dA;
    });

    const result: UnifiedItem[] = [];
    for (const item of topItems) {
      result.push(item);
      if (item.type === "sessionHeader" && expandedSessions.has(item.group.sessionId)) {
        for (const cook of item.group.cooks) {
          result.push({ type: "sessionCook", data: cook, sessionId: item.group.sessionId });
        }
      }
    }
    return result;
  }, [processedCooks, sessionGroups, expandedSessions, sortKey]);

  const toggleSession = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(sessionId)) next.delete(sessionId);
      else next.add(sessionId);
      return next;
    });
  };

  const openEditModal = (group: SessionGroup) => {
    setEditingSession(group);
    setEditLabel(group.sessionLabel ?? "");
    setEditNotes(group.sessionNotes ?? "");
  };

  const handleSaveSession = async () => {
    if (!editingSession) return;
    await updateSession.mutateAsync({
      sessionId: editingSession.sessionId,
      sessionLabel: editLabel.trim() || null,
      sessionNotes: editNotes.trim() || null,
    });
    setEditingSession(null);
  };

  const renderCookItem = ({ item }: { item: any }) => {
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
          {(() => {
            const verdict: string | undefined = item.analysisResult?.assessment?.verdict;
            const cfg = verdict ? VERDICT_BADGE[verdict] : null;
            if (!cfg) return null;
            return (
              <View style={[s.verdictBadge, { backgroundColor: cfg.color + "22" }]}>
                <Feather name={cfg.icon} size={10} color={cfg.color} />
                <Text style={[s.verdictBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
              </View>
            );
          })()}
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </View>
      </Pressable>
    );
  };

  const renderSessionHeader = (group: SessionGroup) => {
    const hasActive = group.cooks.some((c) => c.status === "active");
    const allCompleted = group.cooks.every((c) => c.status === "completed");
    const expanded = expandedSessions.has(group.sessionId);
    const dateLabel = group.earliestStart
      ? `${fmtDate(group.earliestStart)} · serve by ${fmtTime(
          group.cooks.reduce((latest, c) => {
            const t = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : 0;
            return t > latest.getTime() ? new Date(c.plannedStartAt) : latest;
          }, group.earliestStart)
        )}`
      : "Scheduled";
    const displayLabel = group.sessionLabel || "Multi-Cook Session";

    return (
      <Pressable
        style={[
          s.sessionCard,
          {
            backgroundColor: colors.card,
            borderColor: hasActive ? "#E8482045" : colors.border,
            borderRadius: colors.radius,
          },
        ]}
        onPress={() => toggleSession(group.sessionId)}
      >
        <View style={s.sessionHeader}>
          <LinearGradient
            colors={hasActive ? ["#E84820", "#FF6B2B"] : allCompleted ? ["#16a34a", "#22c55e"] : ["#4f46e5", "#6C3BF5"]}
            style={s.sessionIcon}
          >
            <Feather name="layers" size={18} color="#fff" />
          </LinearGradient>
          <View style={s.sessionInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={[s.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                {displayLabel}
              </Text>
              {hasActive && (
                <View style={s.livePill}>
                  <View style={s.liveDot} />
                  <Text style={s.livePillText}>LIVE</Text>
                </View>
              )}
            </View>
            <Text style={[s.sessionMeta, { color: colors.mutedForeground }]}>
              {group.cooks.length} item{group.cooks.length !== 1 ? "s" : ""} · {dateLabel}
            </Text>
            {group.sessionNotes ? (
              <Text style={[s.sessionNoteText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {group.sessionNotes}
              </Text>
            ) : null}
            {!expanded && (
              <View style={s.sessionTagsRow}>
                {group.cooks.map((c) => (
                  <View
                    key={c.id}
                    style={[
                      s.sessionTag,
                      { backgroundColor: (STATUS_COLORS[c.status] || colors.primary) + "20" },
                    ]}
                  >
                    <Text style={[s.sessionTagText, { color: STATUS_COLORS[c.status] || colors.primary }]}>
                      {c.foodType}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={{ alignItems: "center", gap: 8 }}>
            <Pressable
              hitSlop={8}
              onPress={(e) => { e.stopPropagation(); openEditModal(group); }}
              style={[s.editBtn, { backgroundColor: colors.border }]}
            >
              <Feather name="edit-2" size={13} color={colors.mutedForeground} />
            </Pressable>
            <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
          </View>
        </View>
      </Pressable>
    );
  };

  const renderUnifiedItem = ({ item }: { item: UnifiedItem }) => {
    if (item.type === "cook") return renderCookItem({ item: item.data });
    if (item.type === "sessionHeader") return renderSessionHeader(item.group);
    if (item.type === "sessionCook") {
      return (
        <View style={{ paddingLeft: 12 }}>
          {renderCookItem({ item: item.data })}
        </View>
      );
    }
    return null;
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader
        title="Cook Log"
        dark
        right={
          <Pressable
            onPress={() => router.push("/cooks/log" as any)}
            style={s.addBtn}
          >
            <Feather name="plus" size={22} color="#fff" />
          </Pressable>
        }
      />

      <Modal
        visible={editingSession !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingSession(null)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={s.modalOverlay}
        >
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setEditingSession(null)}
          />
          <View style={[s.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Session</Text>

            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>Name</Text>
            <TextInput
              style={[s.modalInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. 4th of July BBQ"
              placeholderTextColor={colors.mutedForeground}
              value={editLabel}
              onChangeText={setEditLabel}
              maxLength={80}
              returnKeyType="next"
            />

            <Text style={[s.modalLabel, { color: colors.mutedForeground }]}>Notes (optional)</Text>
            <TextInput
              style={[s.modalInput, s.modalInputMulti, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground }]}
              placeholder="e.g. Weber 22, used apple wood chunks"
              placeholderTextColor={colors.mutedForeground}
              value={editNotes}
              onChangeText={setEditNotes}
              multiline
              numberOfLines={3}
              maxLength={300}
              returnKeyType="done"
            />

            <View style={s.modalBtns}>
              <Pressable
                style={[s.modalBtn, { borderColor: colors.border, borderWidth: 1 }]}
                onPress={() => setEditingSession(null)}
              >
                <Text style={[s.modalBtnText, { color: colors.mutedForeground }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[s.modalBtn, { backgroundColor: colors.primary }]}
                onPress={handleSaveSession}
                disabled={updateSession.isPending}
              >
                {updateSession.isPending
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={[s.modalBtnText, { color: "#fff" }]}>Save</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                onPress={() => { setSortKey(opt.key); }}
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
          data={unifiedList}
          keyExtractor={(item) => {
            if (item.type === "cook") return `cook-${item.data.id}`;
            if (item.type === "sessionHeader") return `session-${item.group.sessionId}`;
            return `sessioncook-${item.data.id}`;
          }}
          renderItem={renderUnifiedItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: botPad + 16,
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
                  : "Tap + in the top right to log a past cook"}
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
  verdictBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  verdictBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  empty: {
    borderWidth: 1, marginTop: 40, padding: 36,
    alignItems: "center", gap: 8,
  },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },

  sessionCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  sessionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
  },
  sessionIcon: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  sessionMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 4 },
  sessionTagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  sessionTag: {
    paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5,
  },
  sessionTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sessionItems: {
    borderTopWidth: 1,
  },
  sessionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  sessionItemDot: {
    width: 8, height: 8, borderRadius: 4,
  },
  sessionItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  sessionItemMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  sessionItemElapsed: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  sessionNoteText: { fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 4, lineHeight: 15 },
  editBtn: {
    width: 28, height: 28, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#00000066",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 24,
    paddingBottom: 36,
    gap: 10,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  modalLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  modalInputMulti: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: 10,
  },
  modalBtns: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
