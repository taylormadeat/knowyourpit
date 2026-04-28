import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutChangeEvent,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useGetSessionCooks, useUpdateSession, useDeleteSession, useRemoveCookFromSession, getGetSessionCooksQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { LogoBackground } from "@/components/LogoBackground";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

function CookGanttChart({ cooks, colors }: { cooks: any[]; colors: any }) {
  const [containerWidth, setContainerWidth] = useState(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  }, []);

  if (!cooks || cooks.length === 0) return null;

  const starts = cooks
    .map((c) => (c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null))
    .filter((v): v is number => v !== null);
  const ends = cooks
    .map((c) => {
      const t = c.plannedEndAt ?? c.plannedStartAt;
      return t ? new Date(t).getTime() : null;
    })
    .filter((v): v is number => v !== null);

  if (!starts.length || !ends.length) return null;

  const minTime = Math.min(...starts);
  const maxTime = Math.max(...ends);
  const totalDuration = maxTime - minTime;

  if (totalDuration <= 0) return null;

  const ROW_H = 26;
  const LABEL_PAD = 6;
  const MIN_BAR_W = 28;

  return (
    <View
      style={[
        gantt.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={gantt.barsContainer} onLayout={onLayout}>
        {containerWidth > 0 &&
          cooks.map((cook) => {
            const start = cook.plannedStartAt
              ? new Date(cook.plannedStartAt).getTime()
              : null;
            const end = (() => {
              const t = cook.plannedEndAt ?? cook.plannedStartAt;
              return t ? new Date(t).getTime() : null;
            })();
            if (start === null || end === null) return null;

            const left = ((start - minTime) / totalDuration) * containerWidth;
            const rawWidth = ((end - start) / totalDuration) * containerWidth;
            const barWidth = Math.max(rawWidth, MIN_BAR_W);
            const clampedLeft = Math.min(left, containerWidth - barWidth);
            const color = STATUS_COLORS[cook.status] ?? colors.primary;
            const label = cook.foodType || "Cook";

            return (
              <View key={cook.id} style={{ height: ROW_H + 4, position: "relative" }}>
                <View
                  style={[
                    gantt.bar,
                    {
                      left: clampedLeft,
                      width: barWidth,
                      height: ROW_H,
                      backgroundColor: color + "28",
                      borderLeftColor: color,
                    },
                  ]}
                >
                  <Text
                    numberOfLines={1}
                    style={[gantt.barLabel, { color, maxWidth: barWidth - LABEL_PAD * 2 }]}
                  >
                    {label}
                  </Text>
                </View>
              </View>
            );
          })}
      </View>

      <View style={gantt.axis}>
        <Text style={[gantt.axisLabel, { color: colors.mutedForeground }]}>
          {new Date(minTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
        <Text style={[gantt.axisLabel, { color: colors.mutedForeground }]}>
          {new Date(maxTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
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
  return d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function fmtElapsed(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function fmtCookDuration(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

// Pull this cook's specific plan steps from its sequenceData.
// Each cook in a multi-cook session stores the full multi-cook schedule;
// we match by foodType, breaking ties with the closest meatOnAt timestamp.
function getItemPlan(cook: any): {
  grillLightAt?: string;
  meatOnAt?: string;
  estimatedFinishAt?: string;
  estimatedDurationMinutes?: number;
  preheatMinutes?: number;
  restMinutes?: number;
  wrapMethod?: string | null;
  wrapAtMinutes?: number | null;
  wrapTempF?: number | null;
  wrapReason?: string | null;
} | null {
  const seqData = cook?.sequenceData as { schedule?: any[] } | null | undefined;
  if (!seqData?.schedule?.length) return null;
  const cookFoodType = (cook.foodType ?? "").toLowerCase().trim();
  const cookMeatOnMs = cook.plannedStartAt ? new Date(cook.plannedStartAt).getTime() : null;

  let best: any = null;
  let bestDelta = Infinity;
  for (const item of seqData.schedule) {
    if ((item.foodType ?? "").toLowerCase().trim() !== cookFoodType) continue;
    if (cookMeatOnMs === null) { best = item; break; }
    const itemMs = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
    if (itemMs === null) continue;
    const delta = Math.abs(itemMs - cookMeatOnMs);
    if (delta < bestDelta) { bestDelta = delta; best = item; }
  }
  if (!best) {
    best = seqData.schedule.find(
      (item: any) => (item.foodType ?? "").toLowerCase().trim() === cookFoodType,
    ) ?? null;
  }
  return best;
}

export default function SessionDetailScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const queryClient = useQueryClient();

  const { data: cooks, isLoading, isError } = useGetSessionCooks(sessionId ?? "");
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const removeCookFromSession = useRemoveCookFromSession(sessionId ?? "");

  const hasActive = (cooks ?? []).some((c: any) => c.status === "active");
  const allCompleted = (cooks ?? []).every((c: any) => c.status === "completed");

  const sessionLabel = cooks?.[0]?.sessionLabel ?? null;
  const sessionNotes = cooks?.[0]?.sessionNotes ?? null;
  const displayLabel = sessionLabel || "Multi-Cook Session";

  const [editVisible, setEditVisible] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [expandedCookIds, setExpandedCookIds] = useState<Set<number>>(new Set());

  const toggleExpanded = useCallback((cookId: number) => {
    setExpandedCookIds((prev) => {
      const next = new Set(prev);
      if (next.has(cookId)) next.delete(cookId);
      else next.add(cookId);
      return next;
    });
  }, []);

  useEffect(() => {
    if (editVisible) {
      setDraftLabel(sessionLabel ?? "");
      setDraftNotes(sessionNotes ?? "");
    }
  }, [editVisible, sessionLabel, sessionNotes]);

  const handleSave = () => {
    if (!sessionId) return;
    updateSession.mutate(
      {
        sessionId,
        sessionLabel: draftLabel.trim() || null,
        sessionNotes: draftNotes.trim() || null,
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSessionCooksQueryKey(sessionId) });
          setEditVisible(false);
        },
      }
    );
  };

  const handleDelete = () => {
    if (!sessionId) return;
    Alert.alert(
      "Delete Session",
      "This will permanently delete this session and all its cooks. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setEditVisible(false);
            deleteSession.mutate(sessionId, {
              onSuccess: () => {
                router.replace("/(tabs)/cooks" as any);
              },
              onError: () => {
                Alert.alert("Delete Failed", "Something went wrong. Please try again.");
              },
            });
          },
        },
      ]
    );
  };

  const earliestStart = cooks && cooks.length > 0
    ? cooks.reduce((min: Date | null, c: any) => {
        if (!c.plannedStartAt) return min;
        const d = new Date(c.plannedStartAt);
        return min === null || d < min ? d : min;
      }, null)
    : null;

  const latestEnd = cooks && cooks.length > 0
    ? cooks.reduce((max: Date | null, c: any) => {
        const t = c.plannedEndAt ?? c.plannedStartAt;
        if (!t) return max;
        const d = new Date(t);
        return max === null || d > max ? d : max;
      }, null)
    : null;

  const handleRemoveCook = (cook: any) => {
    Alert.alert(
      "Remove from Session",
      `Remove "${cook.foodType || "this cook"}" from the session? The cook itself won't be deleted.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            removeCookFromSession.mutate(cook.id, {
              onSuccess: () => {
                const remaining = (cooks ?? []).filter((c: any) => c.id !== cook.id);
                if (remaining.length === 0) {
                  router.replace("/(tabs)/cooks" as any);
                }
              },
              onError: () => {
                Alert.alert("Error", "Could not remove the cook. Please try again.");
              },
            });
          },
        },
      ]
    );
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/cooks" as any);
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <View
        style={[
          s.header,
          { paddingTop: insets.top + 12, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={goBack} style={s.backBtn} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
            {displayLabel}
          </Text>
          {earliestStart && (
            <Text style={[s.headerSub, { color: colors.mutedForeground }]}>
              {fmtDate(earliestStart)}
            </Text>
          )}
        </View>
        <View style={s.headerRight}>
          {hasActive && (
            <View style={[s.livePill, { marginRight: 4 }]}>
              <View style={s.liveDot} />
              <Text style={s.livePillText}>LIVE</Text>
            </View>
          )}
          {!isLoading && !isError && (
            <Pressable onPress={() => setEditVisible(true)} hitSlop={8} style={s.editBtn}>
              <Feather name="edit-2" size={18} color={colors.foreground} />
            </Pressable>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={36} color={colors.mutedForeground} />
          <Text style={[s.emptyTitle, { color: colors.foreground }]}>
            Session not found
          </Text>
          <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
            This session may have been deleted.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <LinearGradient
              colors={hasActive ? ["#E84820", "#FF6B2B"] : allCompleted ? ["#16a34a", "#22c55e"] : ["#4f46e5", "#6C3BF5"]}
              style={s.summaryIcon}
            >
              <Feather name="layers" size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryLabel, { color: colors.foreground }]}>
                {displayLabel}
              </Text>
              <Text style={[s.summaryMeta, { color: colors.mutedForeground }]}>
                {(cooks ?? []).length} items
                {earliestStart ? ` · starts ${fmtTime(earliestStart)}` : ""}
                {latestEnd ? ` · serves ${fmtTime(latestEnd)}` : ""}
              </Text>
              {sessionNotes ? (
                <Text style={[s.summaryNotes, { color: colors.mutedForeground }]}>
                  {sessionNotes}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={[s.sectionTitle, { color: colors.mutedForeground }]}>
            SCHEDULE OVERVIEW
          </Text>

          <CookGanttChart cooks={cooks ?? []} colors={colors} />

          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, marginBottom: 0 }}>
            <Text style={[s.sectionTitle, { color: colors.mutedForeground, marginTop: 0 }]}>
              TIMELINE · TAP AN ITEM FOR ITS PLAN
            </Text>
            <Text style={{ fontSize: 11, color: colors.mutedForeground, fontFamily: "Inter_400Regular", marginBottom: 2 }}>
              Long-press to remove
            </Text>
          </View>

          <View style={[s.timelineCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {(cooks ?? []).map((cook: any, idx: number) => {
              const isActive = cook.status === "active";
              const meatOnTime = cook.plannedStartAt ? new Date(cook.plannedStartAt) : null;
              const finishTime = cook.plannedEndAt ? new Date(cook.plannedEndAt) : null;
              const elapsedMs = isActive && cook.actualStartAt
                ? Date.now() - new Date(cook.actualStartAt).getTime()
                : null;
              const isLast = idx === (cooks ?? []).length - 1;
              const isExpanded = expandedCookIds.has(cook.id);
              const itemPlan = getItemPlan(cook);

              return (
                <Pressable
                  key={cook.id}
                  style={({ pressed }) => [
                    s.timelineRow,
                    !isLast && { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
                    pressed && { opacity: 0.75 },
                  ]}
                  onPress={() => toggleExpanded(cook.id)}
                  onLongPress={() => handleRemoveCook(cook)}
                  delayLongPress={400}
                >
                  <View style={s.timelineLeft}>
                    <View style={[s.timelineDot, { backgroundColor: STATUS_COLORS[cook.status] || colors.primary }]} />
                    {!isLast && (
                      <View style={[s.timelineLine, { backgroundColor: colors.border }]} />
                    )}
                  </View>

                  <View style={s.timelineContent}>
                    <View style={s.timelineRow2}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text style={[s.cookName, { color: colors.foreground }]}>
                            {cook.foodType || "Unnamed Cook"}
                          </Text>
                          {isActive && (
                            <View style={s.livePill}>
                              <View style={s.liveDot} />
                              <Text style={s.livePillText}>LIVE</Text>
                            </View>
                          )}
                        </View>
                        {cook.grillName ? (
                          <Text style={[s.cookGrill, { color: colors.mutedForeground }]}>
                            {cook.grillName}
                            {cook.targetTempF ? ` · ${cook.targetTempF}°F target` : ""}
                          </Text>
                        ) : null}
                        <View style={s.timesRow}>
                          {meatOnTime && (
                            <View style={s.timeChip}>
                              <Feather name="clock" size={11} color={colors.mutedForeground} />
                              <Text style={[s.timeChipText, { color: colors.mutedForeground }]}>
                                On {fmtTime(meatOnTime)}
                              </Text>
                            </View>
                          )}
                          {(() => {
                            if (!finishTime) return null;
                            const restMs = cook.restMinutes ? cook.restMinutes * 60 * 1000 : 0;
                            if (restMs > 0) {
                              const pullTime = new Date(finishTime.getTime() - restMs);
                              return (
                                <>
                                  <View style={s.timeChip}>
                                    <Feather name="thermometer" size={11} color={colors.mutedForeground} />
                                    <Text style={[s.timeChipText, { color: colors.mutedForeground }]}>
                                      Pull {fmtTime(pullTime)}
                                    </Text>
                                  </View>
                                  <View style={s.timeChip}>
                                    <Feather name="flag" size={11} color={colors.mutedForeground} />
                                    <Text style={[s.timeChipText, { color: colors.mutedForeground }]}>
                                      Serve {fmtTime(finishTime)}
                                    </Text>
                                  </View>
                                </>
                              );
                            }
                            return (
                              <View style={s.timeChip}>
                                <Feather name="flag" size={11} color={colors.mutedForeground} />
                                <Text style={[s.timeChipText, { color: colors.mutedForeground }]}>
                                  Serve {fmtTime(finishTime)}
                                </Text>
                              </View>
                            );
                          })()}
                        </View>
                        {isActive && elapsedMs !== null && (
                          <Text style={[s.elapsed, { color: "#E84820" }]}>
                            {fmtElapsed(elapsedMs)} on the smoker
                          </Text>
                        )}
                        {cook.status === "completed" && (cook.ratingTenderness || cook.ratingFlavor || cook.ratingBark) && (
                          <View style={s.ratingsRow}>
                            {[
                              { label: "T", val: cook.ratingTenderness },
                              { label: "F", val: cook.ratingFlavor },
                              { label: "B", val: cook.ratingBark },
                            ].filter(r => r.val).map((r) => (
                              <View key={r.label} style={s.ratingChip}>
                                <Text style={s.ratingLabel}>{r.label}</Text>
                                <Text style={s.ratingStars}>
                                  {"★".repeat(r.val!)}{"☆".repeat(5 - r.val!)}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={s.timelineRight}>
                        <View style={[s.badge, { backgroundColor: (STATUS_COLORS[cook.status] || colors.primary) + "22" }]}>
                          <Text style={[s.badgeText, { color: STATUS_COLORS[cook.status] || colors.primary }]}>
                            {cook.status}
                          </Text>
                        </View>
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.mutedForeground}
                        />
                      </View>
                    </View>

                    {isExpanded && (
                      <View style={[s.itemPlan, { borderTopColor: colors.border }]}>
                        {itemPlan ? (
                          <>
                            <Text style={[s.itemPlanTitle, { color: colors.mutedForeground }]}>
                              PLAN FOR THIS ITEM
                            </Text>
                            {itemPlan.grillLightAt && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#f59e0b" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>Light grill</Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(itemPlan.grillLightAt))}
                                    {itemPlan.preheatMinutes ? ` · ${itemPlan.preheatMinutes}min preheat` : ""}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {itemPlan.meatOnAt && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#EB6C2B" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>Meat on</Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(itemPlan.meatOnAt))}
                                    {itemPlan.estimatedDurationMinutes ? ` · ${fmtCookDuration(itemPlan.estimatedDurationMinutes)} cook` : ""}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {itemPlan.wrapMethod && itemPlan.wrapMethod !== "none" && itemPlan.wrapAtMinutes && itemPlan.wrapAtMinutes > 0 && itemPlan.meatOnAt && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#A855F7" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>
                                    {itemPlan.wrapMethod === "foil" ? "Wrap in foil" : "Wrap in butcher paper"}
                                  </Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(new Date(itemPlan.meatOnAt).getTime() + itemPlan.wrapAtMinutes * 60000))}
                                    {itemPlan.wrapTempF ? ` · at ${itemPlan.wrapTempF}°F internal` : ""}
                                  </Text>
                                  {itemPlan.wrapReason ? (
                                    <Text style={[s.planTime, { color: colors.mutedForeground, marginTop: 1 }]}>{itemPlan.wrapReason}</Text>
                                  ) : null}
                                </View>
                              </View>
                            )}
                            {itemPlan.estimatedFinishAt && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#22c55e" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>Pull off</Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(itemPlan.estimatedFinishAt))}
                                    {itemPlan.restMinutes ? ` · ${itemPlan.restMinutes}min rest` : ""}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {itemPlan.estimatedFinishAt && itemPlan.restMinutes && itemPlan.restMinutes > 0 && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#6366f1" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>Ready to serve</Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(new Date(itemPlan.estimatedFinishAt).getTime() + itemPlan.restMinutes * 60000))}
                                  </Text>
                                </View>
                              </View>
                            )}
                          </>
                        ) : (
                          <Text style={[s.itemPlanEmpty, { color: colors.mutedForeground }]}>
                            No detailed plan saved for this item.
                          </Text>
                        )}

                        <Pressable
                          onPress={() => router.push(`/cooks/${cook.id}` as any)}
                          style={({ pressed }) => [
                            s.openDetailBtn,
                            { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                          ]}
                        >
                          <Feather name="external-link" size={13} color={colors.foreground} />
                          <Text style={[s.openDetailText, { color: colors.foreground }]}>
                            Open full cook details
                          </Text>
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={s.modalBackdrop} onPress={() => setEditVisible(false)} />
          <View style={[s.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={s.modalHandle} />

            <View style={s.modalHeader}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Edit Session</Text>
              <Pressable onPress={() => setEditVisible(false)} hitSlop={8}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Session Name</Text>
            <TextInput
              style={[
                s.input,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={draftLabel}
              onChangeText={setDraftLabel}
              placeholder="e.g. July 4th BBQ"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="next"
              maxLength={80}
            />

            <Text style={[s.fieldLabel, { color: colors.mutedForeground }]}>Notes</Text>
            <TextInput
              style={[
                s.input,
                s.inputMultiline,
                {
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  borderColor: colors.border,
                },
              ]}
              value={draftNotes}
              onChangeText={setDraftNotes}
              placeholder="Any notes about this session…"
              placeholderTextColor={colors.mutedForeground}
              multiline
              numberOfLines={4}
              maxLength={500}
              textAlignVertical="top"
            />

            <Pressable
              style={({ pressed }) => [
                s.saveBtn,
                { backgroundColor: colors.primary, opacity: pressed || updateSession.isPending ? 0.7 : 1 },
              ]}
              onPress={handleSave}
              disabled={updateSession.isPending}
            >
              {updateSession.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={s.saveBtnText}>Save Changes</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                s.deleteBtn,
                { opacity: pressed || deleteSession.isPending ? 0.7 : 1 },
              ]}
              onPress={handleDelete}
              disabled={deleteSession.isPending || updateSession.isPending}
            >
              {deleteSession.isPending ? (
                <ActivityIndicator color="#ef4444" size="small" />
              ) : (
                <>
                  <Feather name="trash-2" size={15} color="#ef4444" />
                  <Text style={s.deleteBtnText}>Delete Session</Text>
                </>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  headerRight: {
    width: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
  },
  editBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  scroll: {
    padding: 16,
    gap: 12,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryLabel: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  summaryMeta: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  summaryNotes: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 4,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 4,
    marginTop: 4,
  },
  timelineCard: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  timelineRow: {
    flexDirection: "row",
    paddingVertical: 14,
    paddingRight: 14,
  },
  timelineLeft: {
    width: 36,
    alignItems: "center",
    paddingTop: 4,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    marginTop: 4,
    borderRadius: 1,
    minHeight: 20,
  },
  timelineContent: {
    flex: 1,
  },
  timelineRow2: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  timelineRight: {
    alignItems: "flex-end",
    gap: 6,
    marginLeft: 8,
  },
  cookName: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  cookGrill: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  timesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  timeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  timeChipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  elapsed: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    marginTop: 4,
  },
  ratingsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
    marginTop: 6,
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#eab30822",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  ratingLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#eab308",
  },
  ratingStars: {
    fontSize: 10,
    color: "#eab308",
  },
  itemPlan: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  itemPlanTitle: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  itemPlanEmpty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  planStep: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 2,
  },
  planDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  planLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  planTime: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  openDetailBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingVertical: 9,
    marginTop: 6,
  },
  openDetailText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },
  livePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E8482022",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E84820",
  },
  livePillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#E84820",
    letterSpacing: 0.5,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    marginTop: 8,
  },
  emptyText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 36,
    gap: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#88888844",
    alignSelf: "center",
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.4,
    marginBottom: -4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  inputMultiline: {
    minHeight: 90,
    paddingTop: 11,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  saveBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    marginTop: 4,
  },
  deleteBtnText: {
    color: "#ef4444",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});

const gantt = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    overflow: "hidden",
  },
  barsContainer: {
    width: "100%",
  },
  bar: {
    position: "absolute",
    borderLeftWidth: 3,
    borderRadius: 5,
    justifyContent: "center",
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  barLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  axis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#88888830",
  },
  axisLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
