import React, { useState, useMemo, useRef, useEffect } from "react";
import { useNow } from "@/hooks/useNow";
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
  Animated,
  type StyleProp,
  type TextStyle,
} from "react-native";
import { fmtMinutes } from "@/utils/duration";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useListCooks, useUpdateSession } from "@workspace/api-client-react";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import {
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  placementLabel,
  computePercentile,
  type CompetitionCategory,
} from "@/constants/competitionKnowledge";
import { getCookCardBar, type CookCardBar } from "@/utils/cookCardBar";
import { fmtRemaining, barColor, clamp, AnimatedBarFill } from "@/components/cook-detail/CookProgressBar";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

function ProgressDot({ color, active }: { color: string; active: boolean }) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [active, pulse]);
  return (
    <Animated.View
      style={{
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: color,
        opacity: active ? pulse : 1,
      }}
    />
  );
}

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
  return fmtMinutes(Math.floor(ms / 60000));
}

function fmtCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "starting now";
  return `in ${fmtMinutes(Math.floor(diff / 60000))}`;
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtFinishTime(finishMs: number): string {
  const d = new Date(finishMs);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  const m = minutes.toString().padStart(2, "0");
  return `Done ~${h}:${m} ${ampm}`;
}

interface RemainingTimeToggleProps {
  finishMs: number;
  isOver: boolean;
  remainingMs: number;
  overMs: number;
  textStyle: StyleProp<TextStyle>;
  overColor: string;
  mutedColor: string;
}

function RemainingTimeToggle({ finishMs, isOver, remainingMs, overMs, textStyle, overColor, mutedColor }: RemainingTimeToggleProps) {
  const [showFinishTime, setShowFinishTime] = useState(false);
  const label = isOver
    ? fmtRemaining(remainingMs, true, overMs)
    : showFinishTime
    ? fmtFinishTime(finishMs)
    : fmtRemaining(remainingMs, false, overMs);
  return (
    <Pressable
      onPress={() => { if (!isOver) setShowFinishTime((prev) => !prev); }}
      hitSlop={8}
    >
      <Text style={[textStyle, { color: isOver ? overColor : mutedColor, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function shiftSequenceData(data: SequenceData, offsetMs: number): SequenceData {
  return {
    ...data,
    serveAt: new Date(new Date(data.serveAt).getTime() + offsetMs).toISOString(),
    schedule: data.schedule.map((item) => ({
      ...item,
      grillLightAt: new Date(new Date(item.grillLightAt).getTime() + offsetMs).toISOString(),
      meatOnAt: new Date(new Date(item.meatOnAt).getTime() + offsetMs).toISOString(),
      estimatedFinishAt: new Date(new Date(item.estimatedFinishAt).getTime() + offsetMs).toISOString(),
    })),
  };
}

function applyItemOffsets(
  data: SequenceData,
  globalOffsetMs: number,
  itemOffsets: Record<number, number>
): SequenceData {
  const schedule = data.schedule.map((item, idx) => {
    const totalOffsetMs = globalOffsetMs + (itemOffsets[idx] || 0) * 60000;
    return {
      ...item,
      grillLightAt: new Date(new Date(item.grillLightAt).getTime() + totalOffsetMs).toISOString(),
      meatOnAt: new Date(new Date(item.meatOnAt).getTime() + totalOffsetMs).toISOString(),
      estimatedFinishAt: new Date(new Date(item.estimatedFinishAt).getTime() + totalOffsetMs).toISOString(),
    };
  });
  const latestReadyMs = schedule.reduce((max, item) => {
    const ready = new Date(item.estimatedFinishAt).getTime() + item.restMinutes * 60000;
    return Math.max(max, ready);
  }, 0);
  return {
    ...data,
    schedule,
    serveAt: latestReadyMs > 0 ? new Date(latestReadyMs).toISOString() : data.serveAt,
  };
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

interface SequenceItem {
  foodType: string;
  estimatedDurationMinutes: number;
  preheatMinutes: number;
  restMinutes: number;
  grillLightAt: string;
  meatOnAt: string;
  estimatedFinishAt: string;
  notes?: string | null;
}

interface SequenceData {
  schedule: SequenceItem[];
  serveAt: string;
  summary?: string | null;
}

interface SessionGroup {
  sessionId: string;
  cooks: any[];
  earliestStart: Date | null;
  sessionLabel: string | null;
  sessionNotes: string | null;
  sequenceData: SequenceData | null;
}

export default function CooksScreen() {
  const colors = useColors();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date-desc");
  const [ratedOnly, setRatedOnly] = useState(false);
  const [competitionsOnly, setCompetitionsOnly] = useState(false);
  const [techniqueFilter, setTechniqueFilter] = useState<string | null>(null);
  const [showTechniquePicker, setShowTechniquePicker] = useState(false);
  const [meatTypeFilter, setMeatTypeFilter] = useState<string | null>(null);
  const [showMeatTypePicker, setShowMeatTypePicker] = useState(false);
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [editingSession, setEditingSession] = useState<SessionGroup | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [viewingSequence, setViewingSequence] = useState<{ group: SessionGroup; data: SequenceData } | null>(null);
  const [seqEditMode, setSeqEditMode] = useState(false);
  const [seqOffsetMinutes, setSeqOffsetMinutes] = useState(0);
  const [seqItemOffsets, setSeqItemOffsets] = useState<Record<number, number>>({});
  const [seqSaveError, setSeqSaveError] = useState<string | null>(null);
  const { data: cooks, isLoading, refetch } = useListCooks();
  const updateSession = useUpdateSession();

  const hasActiveCooks = useMemo(
    () => ((cooks as any[]) || []).some((c) => c.status === "active"),
    [cooks],
  );
  const nowMs = useNow(1000, hasActiveCooks);

  const botPad = useBottomTabBarHeight();
  const { isTablet, contentMaxWidth } = useLayout();

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const availableTechniques = useMemo(() => {
    const all: any[] = (cooks as any[]) || [];
    const seen = new Set<string>();
    for (const c of all) {
      if (c.cookingMethod && typeof c.cookingMethod === "string") {
        seen.add(c.cookingMethod);
      }
    }
    return Array.from(seen).sort();
  }, [cooks]);

  const availableMeatTypes = useMemo(() => {
    const all: any[] = (cooks as any[]) || [];
    const seen = new Set<string>();
    for (const c of all) {
      if (c.foodType && typeof c.foodType === "string") {
        seen.add(c.foodType);
      }
    }
    return Array.from(seen).sort();
  }, [cooks]);

  const processedCooks = useMemo(() => {
    let list: any[] = (cooks as any[]) || [];
    if (ratedOnly) {
      list = list.filter((item) => avgRating(item) > 0);
    }
    if (competitionsOnly) {
      list = list.filter((item) => item.isCompetition === true);
    }
    if (techniqueFilter) {
      list = list.filter((item) => item.cookingMethod === techniqueFilter);
    }
    if (meatTypeFilter) {
      list = list.filter((item) => item.foodType === meatTypeFilter);
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
  }, [cooks, sortKey, ratedOnly, competitionsOnly, techniqueFilter, meatTypeFilter]);

  const sessionGroups = useMemo((): SessionGroup[] => {
    const all: any[] = (cooks as any[]) || [];
    const grouped: Record<string, any[]> = {};
    for (const cook of all) {
      if (cook.sessionId) {
        if (!grouped[cook.sessionId]) grouped[cook.sessionId] = [];
        grouped[cook.sessionId].push(cook);
      }
    }
    if (competitionsOnly) {
      for (const sid of Object.keys(grouped)) {
        const compCooks = grouped[sid].filter((c: any) => c.isCompetition);
        if (compCooks.length === 0) {
          delete grouped[sid];
        } else {
          // Drop any non-competition cooks from a mixed session so the
          // expanded session view also strictly respects the filter.
          grouped[sid] = compCooks;
        }
      }
    }
    if (techniqueFilter) {
      for (const sid of Object.keys(grouped)) {
        const techniqueCooks = grouped[sid].filter((c: any) => c.cookingMethod === techniqueFilter);
        if (techniqueCooks.length === 0) {
          delete grouped[sid];
        } else {
          grouped[sid] = techniqueCooks;
        }
      }
    }
    if (meatTypeFilter) {
      for (const sid of Object.keys(grouped)) {
        const meatCooks = grouped[sid].filter((c: any) => c.foodType === meatTypeFilter);
        if (meatCooks.length === 0) {
          delete grouped[sid];
        } else {
          grouped[sid] = meatCooks;
        }
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
      const sequenceData: SequenceData | null =
        sessionCooks.find((c) => c.sequenceData != null)?.sequenceData ?? null;
      return { sessionId, cooks: sorted, earliestStart, sessionLabel, sessionNotes, sequenceData };
    });
    groups.sort((a, b) => {
      if (!a.earliestStart && !b.earliestStart) return 0;
      if (!a.earliestStart) return 1;
      if (!b.earliestStart) return -1;
      if (sortKey === "date-asc") return a.earliestStart.getTime() - b.earliestStart.getTime();
      return b.earliestStart.getTime() - a.earliestStart.getTime();
    });
    return groups;
  }, [cooks, sortKey, competitionsOnly, techniqueFilter, meatTypeFilter]);

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

  const renderCookItem = ({ item, inSession }: { item: any; inSession?: boolean }) => {
    const isActive = item.status === "active";
    const isPlanned = item.status === "planned";
    const elapsedMs = isActive && item.actualStartAt
      ? nowMs - new Date(item.actualStartAt).getTime()
      : null;
    const plannedStartMs = isPlanned && item.plannedStartAt
      ? new Date(item.plannedStartAt).getTime()
      : null;
    const isSoon = plannedStartMs !== null && plannedStartMs - nowMs < 48 * 60 * 60 * 1000;
    const bar = getCookCardBar(item, nowMs);

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
        <View style={s.cardRow}>
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
            {item.grillName || "No grill"}{item.targetTempF ? ` · internal target ${item.targetTempF}°F` : ""}
          </Text>
          {item.cookingMethod ? (
            <View style={{ flexDirection: "row", marginTop: 3 }}>
              <View
                style={{
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 4,
                  backgroundColor: "#6366f122",
                  borderWidth: 1,
                  borderColor: "#6366f155",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                <Feather name="wind" size={9} color="#818cf8" />
                <Text style={{ color: "#818cf8", fontFamily: "Inter_600SemiBold", fontSize: 10, letterSpacing: 0.2 }}>
                  {item.cookingMethod}
                </Text>
              </View>
            </View>
          ) : null}
          {(inSession || isActive) && bar !== null && (
            <View
              style={{
                marginTop: 7,
                height: 3,
                borderRadius: 2,
                backgroundColor: colors.border,
                overflow: "hidden",
              }}
            >
              <AnimatedBarFill progress={bar.progress} color={bar.color} borderRadius={2} />
            </View>
          )}
          {isActive && elapsedMs !== null && (
            <Text style={[s.liveElapsed, { color: "#E84820" }]}>
              {fmtElapsed(elapsedMs)} on the smoker
            </Text>
          )}
          {isActive && (() => {
            const seqFinish = item.sequenceData?.schedule?.[0]?.estimatedFinishAt;
            const rawFinish = seqFinish ?? item.plannedEndAt ?? null;
            if (!rawFinish) return null;
            const finishMs = new Date(rawFinish).getTime();
            const isOver = nowMs > finishMs;
            const remainingMs = isOver ? 0 : finishMs - nowMs;
            const overMs = isOver ? nowMs - finishMs : 0;
            return (
              <RemainingTimeToggle
                finishMs={finishMs}
                isOver={isOver}
                remainingMs={remainingMs}
                overMs={overMs}
                textStyle={s.liveElapsed}
                overColor="#ef4444"
                mutedColor={colors.mutedForeground}
              />
            );
          })()}
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
          {item.isCompetition && (() => {
            const cat = item.competitionCategory as CompetitionCategory | null;
            const catColor = cat ? COMPETITION_CATEGORY_COLOR[cat] : "#EAB308";
            const hasResults =
              typeof item.competitionPlacement === "number" || item.judgeScore != null;
            return (
              <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 4 }}>
                {cat ? (
                  <View
                    style={{
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: catColor + "22",
                      borderWidth: 1,
                      borderColor: catColor,
                    }}
                  >
                    <Text style={{ color: catColor, fontFamily: "Inter_700Bold", fontSize: 10, letterSpacing: 0.3 }}>
                      {COMPETITION_CATEGORY_LABEL[cat]}
                    </Text>
                  </View>
                ) : null}
                {item.turnInAt && !hasResults ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                    Turn-in {fmtTime(new Date(item.turnInAt))}
                  </Text>
                ) : null}
                {typeof item.competitionPlacement === "number" ? (
                  <Text style={{ color: catColor, fontFamily: "Inter_700Bold", fontSize: 12 }}>
                    {placementLabel(item.competitionPlacement)}
                  </Text>
                ) : null}
                {typeof item.competitionPlacement === "number" && item.competitionTeamCount != null && item.competitionTeamCount > 0 ? (
                  <Text style={{ color: colors.mutedForeground, fontSize: 10, fontFamily: "Inter_500Medium" }}>
                    {computePercentile(item.competitionPlacement, item.competitionTeamCount)}
                  </Text>
                ) : null}
                {(() => {
                  const hasSubScores = item.judgeScoreAppearance != null || item.judgeScoreTaste != null || item.judgeScoreTexture != null;
                  if (hasSubScores) {
                    const app = item.judgeScoreAppearance ?? 0;
                    const taste = item.judgeScoreTaste ?? 0;
                    const texture = item.judgeScoreTexture ?? 0;
                    const total = app + taste + texture;
                    return (
                      <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                        · {total.toFixed(1)}<Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 10 }}>/360</Text>
                      </Text>
                    );
                  }
                  if (item.judgeScore != null) {
                    return (
                      <Text style={{ color: colors.foreground, fontSize: 11, fontFamily: "Inter_700Bold" }}>
                        · {Number(item.judgeScore).toFixed(item.judgeScore % 1 === 0 ? 0 : 1)} pts
                      </Text>
                    );
                  }
                  return null;
                })()}
              </View>
            );
          })()}
          {item.isCompetition && item.judgeNotes ? (
            <Text
              style={{ color: colors.mutedForeground, fontSize: 11, fontStyle: "italic", marginTop: 2 }}
              numberOfLines={2}
            >
              "{item.judgeNotes}"
            </Text>
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
          {inSession && bar !== null && isActive && (() => {
            const isIndeterminate = bar.color === "#FF6B2B60";
            if (isIndeterminate) {
              return (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 10,
                    backgroundColor: "#FF6B2B22",
                    borderWidth: 1,
                    borderColor: "#FF6B2B55",
                  }}
                >
                  <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: "#FF6B2B" }} />
                  <Text style={{ color: "#FF6B2B", fontSize: 10, fontFamily: "Inter_700Bold" }}>—%</Text>
                </View>
              );
            }
            const pct = Math.round(bar.progress * 100);
            return (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 3,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                  borderRadius: 10,
                  backgroundColor: bar.color + "22",
                  borderWidth: 1,
                  borderColor: bar.color + "66",
                }}
              >
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: bar.color }} />
                <Text style={{ color: bar.color, fontSize: 10, fontFamily: "Inter_700Bold" }}>{pct}%</Text>
              </View>
            );
          })()}
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
        </View>
        {!inSession && bar !== null && (
          <View style={{ height: 4, backgroundColor: colors.border, overflow: "hidden" }}>
            <View
              style={{
                width: `${bar.progress * 100}%`,
                height: "100%",
                backgroundColor: bar.color,
              }}
            />
          </View>
        )}
      </Pressable>
    );
  };

  const renderSessionHeader = (group: SessionGroup) => {
    const hasActive = group.cooks.some((c) => c.status === "active");
    const allCompleted = group.cooks.every((c) => c.status === "completed");
    const expanded = expandedSessions.has(group.sessionId);
    const isComp = group.cooks.some((c: any) => c.isCompetition);
    const compName = isComp
      ? (group.cooks.find((c: any) => c.competitionName) as any)?.competitionName ?? group.sessionLabel ?? "Competition"
      : null;
    const compCategories: CompetitionCategory[] = isComp
      ? Array.from(
          new Set(
            group.cooks
              .map((c: any) => c.competitionCategory)
              .filter(Boolean) as CompetitionCategory[],
          ),
        )
      : [];
    const compPlacements = isComp
      ? group.cooks
          .filter((c: any) => c.isCompetition && typeof c.competitionPlacement === "number")
          .map((c: any) => ({
            cat: c.competitionCategory as CompetitionCategory | null,
            placement: c.competitionPlacement as number,
          }))
      : [];
    const dateLabel = group.earliestStart
      ? isComp
        ? fmtDate(group.earliestStart)
        : `${fmtDate(group.earliestStart)} · serve by ${fmtTime(
            group.cooks.reduce((latest, c) => {
              const t = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : 0;
              return t > latest.getTime() ? new Date(c.plannedStartAt) : latest;
            }, group.earliestStart)
          )}`
      : "Scheduled";
    const displayLabel = isComp ? compName! : (group.sessionLabel || "Multi-Cook Session");

    return (
      <Pressable
        style={[
          s.sessionCard,
          {
            backgroundColor: colors.card,
            borderColor: hasActive
              ? "#E8482045"
              : isComp
                ? "#EAB30855"
                : colors.border,
            borderRadius: colors.radius,
          },
        ]}
        onPress={() => toggleSession(group.sessionId)}
      >
        <View style={s.sessionHeader}>
          <LinearGradient
            colors={
              isComp
                ? ["#EAB308", "#F59E0B"]
                : hasActive
                  ? ["#E84820", "#FF6B2B"]
                  : allCompleted
                    ? ["#16a34a", "#22c55e"]
                    : ["#4f46e5", "#6C3BF5"]
            }
            style={s.sessionIcon}
          >
            <Feather name={isComp ? "award" : "layers"} size={18} color="#fff" />
          </LinearGradient>
          <View style={s.sessionInfo}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <Text style={[s.sessionTitle, { color: colors.foreground }]} numberOfLines={1}>
                {displayLabel}
              </Text>
              {isComp && (
                <View style={{ paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: "#EAB308" }}>
                  <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.5 }}>
                    COMP
                  </Text>
                </View>
              )}
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
            {hasActive && (() => {
              const activeCooks = group.cooks.filter((c: any) => c.status === "active");
              const finishTimes = activeCooks
                .map((c: any) => {
                  const seqFinish = c.sequenceData?.schedule?.[0]?.estimatedFinishAt ?? null;
                  const raw = seqFinish ?? c.plannedEndAt ?? null;
                  if (!raw) return null;
                  return (typeof raw === "string" ? new Date(raw) : raw).getTime();
                })
                .filter((t): t is number => t !== null);
              if (finishTimes.length === 0) return null;
              const latestFinishMs = Math.max(...finishTimes);
              const isOver = nowMs > latestFinishMs;
              const remainingMs = isOver ? 0 : latestFinishMs - nowMs;
              const overMs = isOver ? nowMs - latestFinishMs : 0;

              const startTimes = activeCooks
                .map((c: any) => {
                  const raw = c.startedAt ?? c.plannedStartAt ?? null;
                  if (!raw) return null;
                  return (typeof raw === "string" ? new Date(raw) : raw).getTime();
                })
                .filter((t): t is number => t !== null);
              const earliestStartMs = startTimes.length > 0 ? Math.min(...startTimes) : null;
              const totalMs = earliestStartMs !== null ? latestFinishMs - earliestStartMs : 0;
              const elapsedMs = earliestStartMs !== null ? nowMs - earliestStartMs : 0;
              const rawProgress = totalMs > 0 ? elapsedMs / totalMs : 0;
              const progress = clamp(rawProgress, 0, 1);
              const accent = barColor(progress, isOver);

              return (
                <View style={{ marginTop: 4 }}>
                  <Text
                    style={[
                      s.liveElapsed,
                      { color: isOver ? "#ef4444" : colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 5 },
                    ]}
                  >
                    {fmtRemaining(remainingMs, isOver, overMs)}
                  </Text>
                  <View
                    style={{
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: colors.border,
                      overflow: "hidden",
                    }}
                  >
                    <AnimatedBarFill progress={progress} color={accent} borderRadius={3} />
                  </View>
                </View>
              );
            })()}
            {isComp && compCategories.length > 0 && (
              <View style={[s.sessionTagsRow, { marginTop: 4 }]}>
                {compCategories.map((cat) => {
                  const color = COMPETITION_CATEGORY_COLOR[cat];
                  const placed = compPlacements.find((p) => p.cat === cat);
                  return (
                    <View
                      key={cat}
                      style={[
                        s.sessionTag,
                        {
                          backgroundColor: color + "22",
                          borderWidth: 1,
                          borderColor: color,
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                        },
                      ]}
                    >
                      <Text style={[s.sessionTagText, { color }]}>
                        {COMPETITION_CATEGORY_LABEL[cat]}
                      </Text>
                      {placed ? (
                        <Text style={[s.sessionTagText, { color, fontFamily: "Inter_700Bold" }]}>
                          · {placementLabel(placed.placement)}
                        </Text>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            )}
            {!isComp && !expanded && (
              <View style={s.sessionTagsRow}>
                {group.cooks.map((c) => {
                  const bar = getCookCardBar(c, nowMs);
                  const dotColor = bar
                    ? bar.color
                    : c.status === "planned"
                    ? "#6b7280"
                    : STATUS_COLORS[c.status] || colors.primary;
                  const isActive = c.status === "active";
                  const tagColor = STATUS_COLORS[c.status] || colors.primary;
                  const progressLabel =
                    c.status === "completed"
                      ? "✓"
                      : c.status === "active"
                      ? `${bar ? Math.round(bar.progress * 100) : 0}%`
                      : null;
                  const fillProgress =
                    c.status === "completed"
                      ? 1
                      : c.status === "active" && bar
                      ? Math.max(0, Math.min(1, bar.progress))
                      : 0;
                  const fillColor =
                    c.status === "completed"
                      ? "#22c55e30"
                      : tagColor + "30";
                  return (
                    <View
                      key={c.id}
                      style={[
                        s.sessionTag,
                        {
                          backgroundColor: tagColor + "20",
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          overflow: "hidden",
                        },
                      ]}
                    >
                      {fillProgress > 0 && (
                        <View
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${Math.round(fillProgress * 100)}%`,
                            backgroundColor: fillColor,
                            borderRadius: 999,
                          }}
                        />
                      )}
                      <ProgressDot color={dotColor} active={isActive} />
                      <Text style={[s.sessionTagText, { color: tagColor }]}>
                        {c.foodType}
                      </Text>
                      {progressLabel !== null && (
                        <Text
                          style={[
                            s.sessionTagText,
                            {
                              color: dotColor,
                              fontFamily: "Inter_700Bold",
                              fontSize: 10,
                            },
                          ]}
                        >
                          {progressLabel}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
            {group.sequenceData && (
              <Pressable
                onPress={(e) => { e.stopPropagation(); setSeqEditMode(false); setSeqOffsetMinutes(0); setViewingSequence({ group, data: group.sequenceData! }); }}
                style={[s.seqPlanBtn, { backgroundColor: "#4f46e515", borderColor: "#6C3BF540" }]}
              >
                <Feather name="list" size={12} color="#6C3BF5" />
                <Text style={[s.seqPlanBtnText, { color: "#6C3BF5" }]}>View Sequence Plan</Text>
              </Pressable>
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

  type DisplayItem = UnifiedItem | { type: "cookPair"; left: any; right: any | null };

  const displayList = useMemo((): DisplayItem[] => {
    if (!isTablet) return unifiedList;
    const out: DisplayItem[] = [];
    let i = 0;
    while (i < unifiedList.length) {
      const item = unifiedList[i];
      if (item.type === "cook") {
        const next = unifiedList[i + 1];
        if (next && next.type === "cook") {
          out.push({ type: "cookPair", left: item.data, right: next.data });
          i += 2;
          continue;
        }
        out.push({ type: "cookPair", left: item.data, right: null });
        i += 1;
        continue;
      }
      out.push(item);
      i += 1;
    }
    return out;
  }, [unifiedList, isTablet]);

  const renderUnifiedItem = ({ item }: { item: DisplayItem }) => {
    if (item.type === "cook") return renderCookItem({ item: item.data });
    if (item.type === "sessionHeader") return renderSessionHeader(item.group);
    if (item.type === "sessionCook") {
      return (
        <View style={{ paddingLeft: 12 }}>
          {renderCookItem({ item: item.data, inSession: true })}
        </View>
      );
    }
    if (item.type === "cookPair") {
      return (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>{renderCookItem({ item: item.left })}</View>
          <View style={{ flex: 1 }}>
            {item.right ? renderCookItem({ item: item.right }) : null}
          </View>
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

      <Modal
        visible={viewingSequence !== null}
        transparent
        animationType="slide"
        onRequestClose={() => { setViewingSequence(null); setSeqEditMode(false); setSeqOffsetMinutes(0); setSeqItemOffsets({}); setSeqSaveError(null); }}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => { setViewingSequence(null); setSeqEditMode(false); setSeqOffsetMinutes(0); setSeqItemOffsets({}); setSeqSaveError(null); }}
          />
          <View style={[s.seqSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.seqSheetHandle} />
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>
                {viewingSequence?.group.sessionLabel || "Sequence Plan"}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Pressable
                  hitSlop={8}
                  onPress={() => { setSeqEditMode((v) => !v); setSeqOffsetMinutes(0); setSeqItemOffsets({}); setSeqSaveError(null); }}
                  style={[
                    s.seqEditTimesBtn,
                    { backgroundColor: seqEditMode ? "#6C3BF520" : colors.border },
                  ]}
                >
                  <Feather name="clock" size={13} color={seqEditMode ? "#6C3BF5" : colors.mutedForeground} />
                  <Text style={[s.seqEditTimesBtnText, { color: seqEditMode ? "#6C3BF5" : colors.mutedForeground }]}>
                    {seqEditMode ? "Cancel" : "Edit times"}
                  </Text>
                </Pressable>
                <Pressable hitSlop={8} onPress={() => { setViewingSequence(null); setSeqEditMode(false); setSeqOffsetMinutes(0); setSeqItemOffsets({}); setSeqSaveError(null); }}>
                  <Feather name="x" size={20} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {seqEditMode && (
              <View style={[s.seqOffsetRow, { backgroundColor: "#6C3BF510", borderColor: "#6C3BF530" }]}>
                <Text style={[s.seqOffsetLabel, { color: colors.mutedForeground }]}>Shift all times</Text>
                <View style={s.seqOffsetControls}>
                  {([-60, -15, 15, 60] as const).map((delta) => (
                    <Pressable
                      key={delta}
                      style={[s.seqOffsetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                      onPress={() => setSeqOffsetMinutes((v) => v + delta)}
                    >
                      <Text style={[s.seqOffsetBtnText, { color: colors.foreground }]}>
                        {delta > 0 ? `+${delta}m` : `${delta}m`}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={[s.seqOffsetValue, { color: seqOffsetMinutes === 0 ? colors.mutedForeground : "#6C3BF5" }]}>
                    {seqOffsetMinutes === 0
                      ? "No change"
                      : seqOffsetMinutes > 0
                        ? `+${seqOffsetMinutes} min later`
                        : `${seqOffsetMinutes} min earlier`}
                  </Text>
                  {seqOffsetMinutes !== 0 && (
                    <Pressable
                      onPress={() => setSeqOffsetMinutes(0)}
                      hitSlop={8}
                    >
                      <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Reset</Text>
                    </Pressable>
                  )}
                </View>
                {seqSaveError ? (
                  <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#ef4444", textAlign: "center" }}>
                    {seqSaveError}
                  </Text>
                ) : null}
                {(() => {
                  const hasChanges = seqOffsetMinutes !== 0 || Object.values(seqItemOffsets).some((v) => v !== 0);
                  return (
                    <Pressable
                      style={[
                        s.seqSaveBtn,
                        { backgroundColor: hasChanges ? "#6C3BF5" : colors.border, opacity: updateSession.isPending ? 0.6 : 1 },
                      ]}
                      disabled={!hasChanges || updateSession.isPending}
                      onPress={async () => {
                        if (!viewingSequence || !hasChanges) return;
                        setSeqSaveError(null);
                        try {
                          const patched = applyItemOffsets(viewingSequence.data, seqOffsetMinutes * 60000, seqItemOffsets);
                          await updateSession.mutateAsync({
                            sessionId: viewingSequence.group.sessionId,
                            sequenceData: patched,
                          });
                          setViewingSequence({ ...viewingSequence, data: patched });
                          setSeqEditMode(false);
                          setSeqOffsetMinutes(0);
                          setSeqItemOffsets({});
                        } catch {
                          setSeqSaveError("Failed to save. Please try again.");
                        }
                      }}
                    >
                      {updateSession.isPending
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <Text style={[s.seqSaveBtnText, { color: hasChanges ? "#fff" : colors.mutedForeground }]}>Save updated times</Text>
                      }
                    </Pressable>
                  );
                })()}
              </View>
            )}

            {(() => {
              const hasAnyOffset = seqOffsetMinutes !== 0 || Object.values(seqItemOffsets).some((v) => v !== 0);
              const displayData = viewingSequence
                ? (hasAnyOffset ? applyItemOffsets(viewingSequence.data, seqOffsetMinutes * 60000, seqItemOffsets) : viewingSequence.data)
                : null;
              return (
                <>
                  {displayData?.serveAt ? (
                    <Text style={[s.seqServeAt, { color: colors.primary }]}>
                      Serve at {fmtTime(new Date(displayData.serveAt))} · {fmtDate(new Date(displayData.serveAt))}
                    </Text>
                  ) : null}
                  {displayData?.summary ? (
                    <Text style={[s.seqSummary, { color: colors.mutedForeground }]}>
                      {displayData.summary}
                    </Text>
                  ) : null}
                  <ScrollView style={{ marginTop: 12 }} showsVerticalScrollIndicator={false}>
                    {displayData?.schedule.map((item, idx) => (
                      <View
                        key={idx}
                        style={[s.seqItem, { borderColor: colors.border, backgroundColor: colors.background }]}
                      >
                        <View style={s.seqItemHeader}>
                          <LinearGradient colors={["#4f46e5", "#6C3BF5"]} style={s.seqItemIcon}>
                            <Feather name="layers" size={14} color="#fff" />
                          </LinearGradient>
                          <Text style={[s.seqItemTitle, { color: colors.foreground }]}>{item.foodType}</Text>
                        </View>
                        <View style={s.seqTimeline}>
                          <View style={s.seqTimelineRow}>
                            <View style={[s.seqDot, { backgroundColor: "#f59e0b" }]} />
                            <View style={s.seqConnector} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.seqEventLabel, { color: colors.mutedForeground }]}>Light grill</Text>
                              <Text style={[s.seqEventTime, { color: colors.foreground }]}>
                                {fmtTime(new Date(item.grillLightAt))}
                                <Text style={[s.seqEventMeta, { color: colors.mutedForeground }]}>
                                  {" "}· {fmtMinutes(item.preheatMinutes)} preheat
                                </Text>
                              </Text>
                            </View>
                          </View>
                          <View style={s.seqTimelineRow}>
                            <View style={[s.seqDot, { backgroundColor: "#EB6C2B" }]} />
                            <View style={s.seqConnector} />
                            <View style={{ flex: 1 }}>
                              <Text style={[s.seqEventLabel, { color: colors.mutedForeground }]}>Meat on</Text>
                              <Text style={[s.seqEventTime, { color: colors.foreground }]}>
                                {fmtTime(new Date(item.meatOnAt))}
                                <Text style={[s.seqEventMeta, { color: colors.mutedForeground }]}>
                                  {" "}· {fmtMinutes(item.estimatedDurationMinutes)} cook
                                </Text>
                              </Text>
                            </View>
                          </View>
                          <View style={s.seqTimelineRow}>
                            <View style={[s.seqDot, { backgroundColor: "#22c55e" }]} />
                            {item.restMinutes > 0 ? <View style={s.seqConnector} /> : <View style={[s.seqConnector, { borderColor: "transparent" }]} />}
                            <View style={{ flex: 1 }}>
                              <Text style={[s.seqEventLabel, { color: colors.mutedForeground }]}>Pull off</Text>
                              <Text style={[s.seqEventTime, { color: colors.foreground }]}>
                                {fmtTime(new Date(item.estimatedFinishAt))}
                                {item.restMinutes > 0 && (
                                  <Text style={[s.seqEventMeta, { color: colors.mutedForeground }]}>
                                    {" "}· {fmtMinutes(item.restMinutes)} rest
                                  </Text>
                                )}
                              </Text>
                            </View>
                          </View>
                          {item.restMinutes > 0 && (
                            <View style={[s.seqTimelineRow, { marginBottom: 0 }]}>
                              <View style={[s.seqDot, { backgroundColor: "#6366f1" }]} />
                              <View style={[s.seqConnector, { borderColor: "transparent" }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={[s.seqEventLabel, { color: colors.mutedForeground }]}>Ready to serve</Text>
                                <Text style={[s.seqEventTime, { color: colors.foreground }]}>
                                  {fmtTime(new Date(new Date(item.estimatedFinishAt).getTime() + item.restMinutes * 60000))}
                                </Text>
                              </View>
                            </View>
                          )}
                        </View>
                        {item.notes ? (
                          <View style={[s.seqNoteBox, { backgroundColor: colors.border + "44" }]}>
                            <Feather name="info" size={12} color={colors.mutedForeground} />
                            <Text style={[s.seqNoteText, { color: colors.mutedForeground }]}>{item.notes}</Text>
                          </View>
                        ) : null}
                        {seqEditMode && (
                          <View style={[s.seqItemOffsetRow, { borderTopColor: colors.border }]}>
                            <Text style={[s.seqItemOffsetLabel, { color: colors.mutedForeground }]}>Shift this item</Text>
                            <View style={s.seqItemOffsetControls}>
                              {([-15, -5, 5, 15] as const).map((delta) => (
                                <Pressable
                                  key={delta}
                                  style={[s.seqItemOffsetBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                                  onPress={() =>
                                    setSeqItemOffsets((prev) => ({
                                      ...prev,
                                      [idx]: (prev[idx] || 0) + delta,
                                    }))
                                  }
                                >
                                  <Text style={[s.seqItemOffsetBtnText, { color: colors.foreground }]}>
                                    {delta > 0 ? `+${delta}m` : `${delta}m`}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                              <Text style={[s.seqItemOffsetValue, { color: (seqItemOffsets[idx] || 0) === 0 ? colors.mutedForeground : "#6C3BF5" }]}>
                                {(seqItemOffsets[idx] || 0) === 0
                                  ? "No change"
                                  : (seqItemOffsets[idx] || 0) > 0
                                    ? `+${seqItemOffsets[idx]}m later`
                                    : `${seqItemOffsets[idx]}m earlier`}
                              </Text>
                              {(seqItemOffsets[idx] || 0) !== 0 && (
                                <Pressable
                                  hitSlop={8}
                                  onPress={() =>
                                    setSeqItemOffsets((prev) => {
                                      const next = { ...prev };
                                      delete next[idx];
                                      return next;
                                    })
                                  }
                                >
                                  <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.mutedForeground }}>Reset</Text>
                                </Pressable>
                              )}
                            </View>
                          </View>
                        )}
                      </View>
                    ))}
                    <View style={{ height: 24 }} />
                  </ScrollView>
                </>
              );
            })()}
          </View>
        </View>
      </Modal>

      <Modal
        visible={showTechniquePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTechniquePicker(false)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowTechniquePicker(false)}
          />
          <View style={[s.techniqueSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.seqSheetHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, marginBottom: 12 }]}>Filter by technique</Text>
            <Pressable
              onPress={() => { setTechniqueFilter(null); setShowTechniquePicker(false); }}
              style={[
                s.techniqueOption,
                { borderColor: colors.border },
                techniqueFilter === null && { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Text style={[s.techniqueOptionText, { color: techniqueFilter === null ? colors.primary : colors.foreground }]}>
                All techniques
              </Text>
              {techniqueFilter === null && <Feather name="check" size={14} color={colors.primary} />}
            </Pressable>
            {availableTechniques.map((technique) => (
              <Pressable
                key={technique}
                onPress={() => { setTechniqueFilter(technique); setShowTechniquePicker(false); }}
                style={[
                  s.techniqueOption,
                  { borderColor: colors.border },
                  techniqueFilter === technique && { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Text style={[s.techniqueOptionText, { color: techniqueFilter === technique ? colors.primary : colors.foreground }]}>
                  {technique}
                </Text>
                {techniqueFilter === technique && <Feather name="check" size={14} color={colors.primary} />}
              </Pressable>
            ))}
            <View style={{ height: 8 }} />
          </View>
        </View>
      </Modal>

      <Modal
        visible={showMeatTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMeatTypePicker(false)}
      >
        <View style={s.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowMeatTypePicker(false)}
          />
          <View style={[s.techniqueSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.seqSheetHandle} />
            <Text style={[s.modalTitle, { color: colors.foreground, marginBottom: 12 }]}>Filter by meat type</Text>
            <Pressable
              onPress={() => { setMeatTypeFilter(null); setShowMeatTypePicker(false); }}
              style={[
                s.techniqueOption,
                { borderColor: colors.border },
                meatTypeFilter === null && { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Text style={[s.techniqueOptionText, { color: meatTypeFilter === null ? colors.primary : colors.foreground }]}>
                All types
              </Text>
              {meatTypeFilter === null && <Feather name="check" size={14} color={colors.primary} />}
            </Pressable>
            {availableMeatTypes.map((meatType) => (
              <Pressable
                key={meatType}
                onPress={() => { setMeatTypeFilter(meatType); setShowMeatTypePicker(false); }}
                style={[
                  s.techniqueOption,
                  { borderColor: colors.border },
                  meatTypeFilter === meatType && { backgroundColor: colors.primary + "18" },
                ]}
              >
                <Text style={[s.techniqueOptionText, { color: meatTypeFilter === meatType ? colors.primary : colors.foreground }]}>
                  {meatType}
                </Text>
                {meatTypeFilter === meatType && <Feather name="check" size={14} color={colors.primary} />}
              </Pressable>
            ))}
            <View style={{ height: 8 }} />
          </View>
        </View>
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

          <Pressable
            onPress={() => setCompetitionsOnly((v) => !v)}
            style={[
              s.pill,
              competitionsOnly
                ? { backgroundColor: "#EAB308" }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              { flexDirection: "row", alignItems: "center", gap: 4 },
            ]}
          >
            <Feather name="award" size={11} color={competitionsOnly ? "#fff" : colors.mutedForeground} />
            <Text style={[s.pillText, { color: competitionsOnly ? "#fff" : colors.mutedForeground }]}>
              Competitions
            </Text>
          </Pressable>
          {competitionsOnly && (
            <Pressable
              onPress={() => router.push("/competition-career" as any)}
              style={[s.pill, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 }]}
            >
              <Feather name="bar-chart-2" size={11} color={colors.mutedForeground} />
              <Text style={[s.pillText, { color: colors.mutedForeground }]}>Career Stats</Text>
            </Pressable>
          )}

          {(availableTechniques.length > 0 || techniqueFilter !== null) && (
            <View
              style={[
                s.pill,
                techniqueFilter
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                { flexDirection: "row", alignItems: "center", gap: 4, overflow: "hidden" },
              ]}
            >
              <Pressable
                onPress={() => setShowTechniquePicker(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Feather name="sliders" size={11} color={techniqueFilter ? "#fff" : colors.mutedForeground} />
                <Text style={[s.pillText, { color: techniqueFilter ? "#fff" : colors.mutedForeground }]}>
                  {techniqueFilter ?? "Technique"}
                </Text>
              </Pressable>
              {techniqueFilter && (
                <Pressable
                  hitSlop={8}
                  onPress={() => setTechniqueFilter(null)}
                >
                  <Feather name="x" size={11} color="#fff" />
                </Pressable>
              )}
            </View>
          )}

          {(availableMeatTypes.length > 0 || meatTypeFilter !== null) && (
            <View
              style={[
                s.pill,
                meatTypeFilter
                  ? { backgroundColor: colors.primary }
                  : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                { flexDirection: "row", alignItems: "center", gap: 4, overflow: "hidden" },
              ]}
            >
              <Pressable
                onPress={() => setShowMeatTypePicker(true)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
              >
                <Feather name="tag" size={11} color={meatTypeFilter ? "#fff" : colors.mutedForeground} />
                <Text style={[s.pillText, { color: meatTypeFilter ? "#fff" : colors.mutedForeground }]}>
                  {meatTypeFilter ?? "Meat type"}
                </Text>
              </Pressable>
              {meatTypeFilter && (
                <Pressable
                  hitSlop={8}
                  onPress={() => setMeatTypeFilter(null)}
                >
                  <Feather name="x" size={11} color="#fff" />
                </Pressable>
              )}
            </View>
          )}
        </ScrollView>
      </View>

      {isLoading && !cooks ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayList}
          keyExtractor={(item) => {
            if (item.type === "cook") return `cook-${item.data.id}`;
            if (item.type === "sessionHeader") return `session-${item.group.sessionId}`;
            if (item.type === "cookPair") return `pair-${item.left.id}-${item.right?.id ?? "x"}`;
            return `sessioncook-${item.data.id}`;
          }}
          renderItem={renderUnifiedItem}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: botPad + 16,
            gap: 10,
            ...(isTablet ? { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" } : null),
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
                {competitionsOnly
                  ? "No competition cooks yet"
                  : ratedOnly
                    ? "No rated cooks found"
                    : meatTypeFilter
                      ? `No "${meatTypeFilter}" cooks found`
                      : techniqueFilter
                        ? `No "${techniqueFilter}" cooks found`
                        : "No cooks logged yet"}
              </Text>
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {competitionsOnly
                  ? "Plan a competition from the Plan tab to see it here"
                  : ratedOnly
                    ? "Try removing the \"Rated only\" filter to see all cooks"
                    : meatTypeFilter
                      ? "Try a different meat type or tap the pill to clear"
                      : techniqueFilter
                        ? "Try a different technique or tap the pill to clear"
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
    borderWidth: 1,
    flexDirection: "column",
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14,
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

  seqPlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 7,
    paddingHorizontal: 9,
    paddingVertical: 4,
    marginTop: 6,
  },
  seqPlanBtnText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },

  seqSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: "88%",
  },
  seqSheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#52525B",
    alignSelf: "center",
    marginBottom: 16,
  },
  techniqueSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: "60%",
  },
  techniqueOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  techniqueOptionText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },

  seqServeAt: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  seqSummary: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginBottom: 4,
  },
  seqItem: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  seqItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  seqItemIcon: {
    width: 28, height: 28, borderRadius: 7,
    alignItems: "center", justifyContent: "center",
  },
  seqItemTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  seqTimeline: {
    paddingLeft: 4,
    gap: 0,
  },
  seqTimelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  seqDot: {
    width: 10, height: 10, borderRadius: 5,
    marginTop: 4,
    flexShrink: 0,
  },
  seqConnector: {
    width: 1,
    backgroundColor: "transparent",
    borderLeftWidth: 1,
    borderColor: "#3f3f46",
    borderStyle: "dashed",
    position: "absolute",
    left: 8,
    top: 14,
    bottom: -8,
  },
  seqEventLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  seqEventTime: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  seqEventMeta: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  seqNoteBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
  },
  seqNoteText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    flex: 1,
    lineHeight: 17,
  },

  seqEditTimesBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  seqEditTimesBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  seqOffsetRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginBottom: 8,
  },
  seqOffsetLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seqOffsetControls: {
    flexDirection: "row",
    gap: 8,
  },
  seqOffsetBtn: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seqOffsetBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  seqOffsetValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  seqSaveBtn: {
    height: 42,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  seqSaveBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  seqItemOffsetRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  seqItemOffsetLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  seqItemOffsetControls: {
    flexDirection: "row",
    gap: 6,
  },
  seqItemOffsetBtn: {
    flex: 1,
    height: 32,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  seqItemOffsetBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  seqItemOffsetValue: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
