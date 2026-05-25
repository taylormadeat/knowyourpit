import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import * as Notifications from "expo-notifications";
import { fmtMinutes } from "@/utils/duration";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import { useBleProbes } from "@/contexts/BleProbeContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { usePaywall } from "@/contexts/PaywallContext";
import { useGetSessionCooks, useListCooks, useUpdateSession, useDeleteSession, useRemoveCookFromSession, useUpdateCook, useListGrills, getGetSessionCooksQueryKey, type Cook, type UpdateCookBody } from "@workspace/api-client-react";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { getEditDates } from "@/components/cook-detail/utils";
import { useQueryClient } from "@tanstack/react-query";
import { LogoBackground } from "@/components/LogoBackground";
import { BoxPresentationChecklist } from "@/components/competition/BoxPresentationChecklist";
import {
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  COMPETITION_BOX_PACK_CATEGORY_TEXT,
  COMPETITION_SCORING,
  COMPETITION_WALK_TIME_DEFAULT_MINUTES,
  placementLabel,
  computePercentile,
  type CompetitionCategory,
} from "@/constants/competitionKnowledge";

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

function CookGanttChart({ cooks, colors }: { cooks: Cook[]; colors: ReturnType<typeof useColors> }) {
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
  return fmtMinutes(Math.floor(ms / 60000));
}

function fmtCookDuration(mins: number | null | undefined): string {
  if (!mins || mins <= 0) return "";
  return fmtMinutes(mins);
}

// Pull this cook's specific plan steps from its sequenceData.
// Each cook in a multi-cook session stores the full multi-cook schedule;
// we match by foodType, breaking ties with the closest meatOnAt timestamp.
interface ItemPlan {
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
  category?: string | null;
  turnInAt?: string | null;
  boxPackAt?: string | null;
  walkMinutes?: number | null;
  foodType?: string;
  warning?: string | null;
}

function getItemPlan(cook: Cook): ItemPlan | null {
  const seqData = (cook as Cook & { sequenceData?: unknown })?.sequenceData as { schedule?: ItemPlan[] } | null | undefined;
  if (!seqData?.schedule?.length) return null;
  const cookFoodType = (cook.foodType ?? "").toLowerCase().trim();
  const cookMeatOnMs = cook.plannedStartAt ? new Date(cook.plannedStartAt).getTime() : null;

  let best: ItemPlan | null = null;
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
      (item) => (item.foodType ?? "").toLowerCase().trim() === cookFoodType,
    ) ?? null;
  }
  return best;
}

export default function SessionDetailScreen() {
  const colors = useColors();
  const { isTablet, detailMaxWidth } = useLayout();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const queryClient = useQueryClient();

  const { data: cooks, isLoading, isError } = useGetSessionCooks(sessionId ?? "");
  const updateSession = useUpdateSession();
  const deleteSession = useDeleteSession();
  const removeCookFromSession = useRemoveCookFromSession(sessionId ?? "");

  const hasActive = (cooks ?? []).some((c) => c.status === "active");
  const allCompleted = (cooks ?? []).every((c) => c.status === "completed");

  const sessionLabel = cooks?.[0]?.sessionLabel ?? null;
  const sessionNotes = cooks?.[0]?.sessionNotes ?? null;

  // ── Competition Mode detection ───────────────────────────────────────
  const isCompetitionSession = (cooks ?? []).some((c) => c.isCompetition);
  const competitionName = (cooks ?? []).find((c) => c.competitionName)?.competitionName ?? null;
  const competitionCooks = (cooks ?? []).filter((c) => c.isCompetition);
  const competitionCategories: CompetitionCategory[] = Array.from(
    new Set(competitionCooks.map((c) => c.competitionCategory).filter(Boolean) as CompetitionCategory[]),
  );
  const turnInDates = competitionCooks
    .map((c) => (c.turnInAt ? new Date(c.turnInAt).getTime() : null))
    .filter((t): t is number => t !== null);
  // Legacy fallback: competition cooks created BEFORE the per-item turnInAt
  // field existed won't have turnInAt set. For those, treat the cook's
  // plannedEndAt (rest-finish time) as the de-facto turn-in moment so the
  // results CTA still surfaces and these cooks aren't stuck in limbo.
  const turnInOrEndDates = competitionCooks
    .map((c) => {
      const t = c.turnInAt ?? c.plannedEndAt ?? c.plannedStartAt;
      return t ? new Date(t).getTime() : null;
    })
    .filter((t): t is number => t !== null);
  const allResultsLogged =
    isCompetitionSession &&
    competitionCooks.length > 0 &&
    competitionCooks.every((c) => typeof c.competitionPlacement === "number");
  // Spec: "Log Your Results" prompt should only surface after all turn-in times
  // have passed. We still allow re-opening the modal once any results are
  // logged so users can correct typos. Falls back to plannedEndAt for legacy
  // competition cooks without turnInAt.
  const allTurnInsPassed =
    isCompetitionSession &&
    turnInOrEndDates.length > 0 &&
    turnInOrEndDates.every((t) => t < Date.now());
  const showResultsCta = isCompetitionSession && (allTurnInsPassed || allResultsLogged);

  const displayLabel = sessionLabel || (isCompetitionSession ? competitionName ?? "Competition" : "Multi-Cook Session");

  const [editVisible, setEditVisible] = useState(false);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [expandedCookIds, setExpandedCookIds] = useState<Set<number>>(new Set());

  // Multi-cook probe routing: map cookId → probeKey (Pro only)
  const [cookProbeAssignments, setCookProbeAssignments] = useState<Map<number, string>>(new Map());
  // Guard: don't write to AsyncStorage until the initial load has completed,
  // otherwise the save effect fires with an empty map before hydration and
  // overwrites the stored data.
  const probeAssignmentsHydrated = React.useRef(false);

  // Persist probe assignments across sessions: load on mount, save on change.
  useEffect(() => {
    if (Platform.OS === "web" || !sessionId) return;
    probeAssignmentsHydrated.current = false;
    AsyncStorage.getItem(`session_probe_assignments_${sessionId}`)
      .then((raw) => {
        if (raw) {
          const entries: [number, string][] = JSON.parse(raw);
          setCookProbeAssignments(new Map(entries));
        }
        probeAssignmentsHydrated.current = true;
      })
      .catch(() => {
        probeAssignmentsHydrated.current = true;
      });
  }, [sessionId]);

  useEffect(() => {
    if (Platform.OS === "web" || !sessionId || !probeAssignmentsHydrated.current) return;
    if (cookProbeAssignments.size === 0) {
      AsyncStorage.removeItem(`session_probe_assignments_${sessionId}`).catch(() => {});
    } else {
      const entries = Array.from(cookProbeAssignments.entries());
      AsyncStorage.setItem(`session_probe_assignments_${sessionId}`, JSON.stringify(entries)).catch(() => {});
    }
  }, [sessionId, cookProbeAssignments]);

  // When every cook in the session has ended, clear the saved probe assignments
  // so stale pairings don't reappear if the session screen is revisited.
  useEffect(() => {
    if (Platform.OS === "web" || !sessionId || !allCompleted) return;
    AsyncStorage.removeItem(`session_probe_assignments_${sessionId}`).catch(() => {});
  }, [sessionId, allCompleted]);

  const { devices: allBleDevices } = useBleProbes();
  const connectedBleDevices = allBleDevices.filter((d) => d.connectionState === "connected");

  // helper: get live temp from probe assignment for display in session card
  function getAssignedProbeTemp(cookId: number): string | null {
    const key = cookProbeAssignments.get(cookId);
    if (!key) return null;
    if (key.startsWith("bleCtx_")) {
      const deviceId = key.slice("bleCtx_".length);
      const dev = connectedBleDevices.find((d) => d.id === deviceId);
      return dev?.probeTempF != null ? `${dev.probeTempF}°F` : null;
    }
    return null;
  }
  const effectivePro = useEffectivePro();
  const { showPaywall } = usePaywall();

  // Competition results entry modal
  const [resultsOpen, setResultsOpen] = useState(false);
  const updateCook = useUpdateCook();
  const [resultsDraft, setResultsDraft] = useState<
    Record<number, { placement: string; teamCount: string; appearance: string; taste: string; texture: string; judgeNotes: string }>
  >({});

  // Box presentation checklist modal
  const [checklistCategory, setChecklistCategory] = useState<CompetitionCategory | null>(null);

  // Historical cooks for "Last Time" reference panel
  const { data: allCooks } = useListCooks();
  const prevCompCooksByCategory = useMemo(() => {
    if (!allCooks) return {} as Record<string, Cook[]>;
    const map: Record<string, Cook[]> = {};
    for (const c of allCooks) {
      if (!c.isCompetition || c.status !== "completed" || !c.competitionCategory) continue;
      if (c.sessionId === sessionId) continue;
      const cat = c.competitionCategory as string;
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    }
    for (const cat of Object.keys(map)) {
      map[cat].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    return map;
  }, [allCooks, sessionId]);

  // ── Per-cook edit modal state ────────────────────────────────────────
  const [cookEditCook, setCookEditCook] = useState<Cook | null>(null);
  const [cookEditVisible, setCookEditVisible] = useState(false);
  const [cookEditGrillPickerVisible, setCookEditGrillPickerVisible] = useState(false);
  const [cookEditFoodType, setCookEditFoodType] = useState("");
  const [cookEditWeight, setCookEditWeight] = useState("");
  const [cookEditCookTemp, setCookEditCookTemp] = useState("");
  const [cookEditTargetTemp, setCookEditTargetTemp] = useState("");
  const [cookEditGrillId, setCookEditGrillId] = useState<number | null>(null);
  const [cookEditActualStartDate, setCookEditActualStartDate] = useState<Date | null>(null);
  const [cookEditActualEndDate, setCookEditActualEndDate] = useState<Date | null>(null);
  const [cookEditStartDateOpen, setCookEditStartDateOpen] = useState(false);
  const [cookEditStartTimeOpen, setCookEditStartTimeOpen] = useState(false);
  const [cookEditEndDateOpen, setCookEditEndDateOpen] = useState(false);
  const [cookEditEndTimeOpen, setCookEditEndTimeOpen] = useState(false);
  const [cookEditNotes, setCookEditNotes] = useState("");
  const [cookEditCookingMethod, setCookEditCookingMethod] = useState<string | null>(null);
  const [cookEditInjection, setCookEditInjection] = useState<string | null>(null);
  const [cookEditSpritzFrequency, setCookEditSpritzFrequency] = useState<string | null>(null);
  const [cookEditSpritzLiquid, setCookEditSpritzLiquid] = useState<string | null>(null);
  const [cookEditWrapFinish, setCookEditWrapFinish] = useState<string | null>(null);
  const [cookEditSaving, setCookEditSaving] = useState(false);

  const cookEditDates = useMemo(() => getEditDates(), []);
  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];
  const cookEditSelectedGrill = useMemo(
    () => grills.find((g: any) => g.id === cookEditGrillId) ?? null,
    [grills, cookEditGrillId],
  );

  const openCookEdit = useCallback((cook: Cook) => {
    const c = cook as any;
    setCookEditCook(cook);
    setCookEditFoodType(c?.foodType ?? "");
    setCookEditWeight(c?.weightLbs != null ? String(c.weightLbs) : "");
    setCookEditCookTemp(c?.cookTempF != null ? String(c.cookTempF) : "");
    setCookEditTargetTemp(c?.targetTempF != null ? String(c.targetTempF) : "");
    setCookEditGrillId(c?.grillId ?? null);
    setCookEditActualStartDate(c?.actualStartAt ? new Date(c.actualStartAt) : null);
    setCookEditActualEndDate(c?.actualEndAt ? new Date(c.actualEndAt) : null);
    setCookEditNotes(c?.notes ?? "");
    setCookEditCookingMethod(c?.cookingMethod ?? null);
    setCookEditInjection(c?.injection ?? null);
    setCookEditSpritzFrequency(c?.spritzFrequency ?? null);
    setCookEditSpritzLiquid(c?.spritzLiquid ?? null);
    setCookEditWrapFinish(c?.wrapFinish ?? null);
    setCookEditVisible(true);
  }, []);

  const saveCookEdit = async () => {
    if (!cookEditCook) return;
    if (!cookEditFoodType.trim()) {
      Alert.alert("Food type required", "Enter what you cooked.");
      return;
    }
    setCookEditSaving(true);
    try {
      const payload: any = { foodType: cookEditFoodType.trim(), notes: cookEditNotes.trim() || null };
      payload.grillId = cookEditGrillId ?? null;
      if (cookEditWeight.trim() && !isNaN(parseFloat(cookEditWeight))) payload.weightLbs = parseFloat(cookEditWeight);
      else payload.weightLbs = null;
      if (cookEditCookTemp.trim() && !isNaN(parseFloat(cookEditCookTemp))) payload.cookTempF = parseFloat(cookEditCookTemp);
      else payload.cookTempF = null;
      if (cookEditTargetTemp.trim() && !isNaN(parseFloat(cookEditTargetTemp))) payload.targetTempF = parseFloat(cookEditTargetTemp);
      else payload.targetTempF = null;
      payload.actualStartAt = cookEditActualStartDate ? cookEditActualStartDate.toISOString() : null;
      payload.actualEndAt = cookEditActualEndDate ? cookEditActualEndDate.toISOString() : null;
      payload.cookingMethod = cookEditCookingMethod;
      payload.injection = cookEditInjection;
      payload.spritzFrequency = cookEditSpritzFrequency;
      payload.spritzLiquid = cookEditSpritzLiquid;
      payload.wrapFinish = cookEditWrapFinish;
      await updateCook.mutateAsync({ id: cookEditCook.id, data: payload });
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: getGetSessionCooksQueryKey(sessionId) });
      }
      setCookEditVisible(false);
      setCookEditCook(null);
    } catch {
      Alert.alert("Save failed", "Could not save changes. Please try again.");
    } finally {
      setCookEditSaving(false);
    }
  };

  const [lastTimeExpanded, setLastTimeExpanded] = useState<Set<string>>(new Set());
  const toggleLastTime = useCallback((cat: string) => {
    setLastTimeExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  useEffect(() => {
    if (resultsOpen) {
      const draft: typeof resultsDraft = {};
      for (const c of competitionCooks) {
        draft[c.id] = {
          placement: c.competitionPlacement != null ? String(c.competitionPlacement) : "",
          teamCount: c.competitionTeamCount != null ? String(c.competitionTeamCount) : "",
          appearance: c.judgeScoreAppearance != null ? String(c.judgeScoreAppearance) : "",
          taste: c.judgeScoreTaste != null ? String(c.judgeScoreTaste) : "",
          texture: c.judgeScoreTexture != null ? String(c.judgeScoreTexture) : "",
          judgeNotes: c.judgeNotes ?? "",
        };
      }
      setResultsDraft(draft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultsOpen]);

  const handleSaveResults = async () => {
    const tasks: Promise<unknown>[] = [];
    for (const c of competitionCooks) {
      const d = resultsDraft[c.id];
      if (!d) continue;
      const placementRaw = d.placement.trim();
      const placement = placementRaw === ""
        ? null
        : Math.max(0, Math.round(Number(placementRaw)));
      const teamCountRaw = d.teamCount.trim();
      const teamCount = teamCountRaw === "" ? null : Math.max(1, Math.round(Number(teamCountRaw)));

      const parseSubScore = (v: string, max: number): number | null => {
        const n = Number(v.trim());
        if (v.trim() === "" || Number.isNaN(n) || n < 0 || n > max) return null;
        return n;
      };
      const appearance = parseSubScore(d.appearance, COMPETITION_SCORING.maxAppearance);
      const taste = parseSubScore(d.taste, COMPETITION_SCORING.maxTaste);
      const texture = parseSubScore(d.texture, COMPETITION_SCORING.maxTexture);
      const hasSubScores = appearance != null || taste != null || texture != null;
      const computedTotal = hasSubScores
        ? (appearance ?? 0) + (taste ?? 0) + (texture ?? 0)
        : null;

      const judgeNotes = d.judgeNotes.trim() === "" ? null : d.judgeNotes.trim();

      // Include sub-score keys when:
      //   1. the user entered at least one value (hasSubScores) — send the values + computed total
      //   2. the cook already has persisted sub-scores but the user cleared them all — send explicit
      //      nulls so the server can clear stale values and recompute the total correctly
      const hadPriorSubScores = c.judgeScoreAppearance != null || c.judgeScoreTaste != null || c.judgeScoreTexture != null;
      const data: UpdateCookBody = {
        competitionPlacement: placement,
        competitionTeamCount: teamCount,
        judgeNotes: judgeNotes,
        ...(hasSubScores
          ? {
              judgeScoreAppearance: appearance,
              judgeScoreTaste: taste,
              judgeScoreTexture: texture,
              judgeScore: computedTotal,
            }
          : hadPriorSubScores
            ? {
                judgeScoreAppearance: null,
                judgeScoreTaste: null,
                judgeScoreTexture: null,
                judgeScore: null,
              }
            : {}),
      };
      tasks.push(updateCook.mutateAsync({ id: c.id, data }));
    }
    try {
      await Promise.all(tasks);
      if (sessionId) {
        await queryClient.invalidateQueries({ queryKey: getGetSessionCooksQueryKey(sessionId) });
      }
      setResultsOpen(false);
    } catch (e: any) {
      Alert.alert("Save Failed", e?.message || "Could not save results. Try again.");
    }
  };

  // Countdown tick for competition turn-ins — must be declared before effects that reference `now`
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!isCompetitionSession) return;
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, [isCompetitionSession]);

  // Stable key capturing the full notification schedule — changes when turnInAt or walkMinutes change
  const walkNotifKey = competitionCooks
    .map((c) => {
      const plan = getItemPlan(c);
      const walk = plan?.walkMinutes ?? COMPETITION_WALK_TIME_DEFAULT_MINUTES;
      return `${c.id}:${c.turnInAt ?? ""}:${walk}`;
    })
    .sort()
    .join("|");

  // Cancel walk notifications when all competition items are completed/cancelled
  const allCompetitionItemsDone = competitionCooks.length > 0 &&
    competitionCooks.every((c) => c.status === "completed" || c.status === "cancelled");

  // Walk-to-turn-in notifications — re-schedule when category turn-in times or walk durations change
  useEffect(() => {
    if (!isCompetitionSession || !competitionCooks.length || allCompetitionItemsDone) return;
    const notifIds: string[] = [];
    const scheduleNotifs = async () => {
      for (const c of competitionCooks) {
        if (!c.turnInAt) continue;
        const turnInMs = new Date(c.turnInAt).getTime();
        const itemPlan = getItemPlan(c);
        const walk = itemPlan?.walkMinutes ?? COMPETITION_WALK_TIME_DEFAULT_MINUTES;
        const walkNotifMs = turnInMs - walk * 60_000;
        if (walkNotifMs <= Date.now()) continue;
        const cat = c.competitionCategory as CompetitionCategory | null;
        const catLabel = cat ? COMPETITION_CATEGORY_LABEL[cat] : "your entry";
        try {
          const id = await Notifications.scheduleNotificationAsync({
            content: {
              title: "Time to walk! 🏆",
              body: `Start walking — ${catLabel} turn-in in ${walk} min.`,
              sound: true,
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(walkNotifMs) },
          });
          notifIds.push(id);
        } catch { /* permissions not granted — fail silently */ }
      }
    };
    scheduleNotifs();
    return () => {
      notifIds.forEach((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {}));
    };
    // walkNotifKey encodes all category turnInAt + walkMinutes values; changes trigger a full reschedule
    // allCompetitionItemsDone guards against scheduling on already-finished sessions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, isCompetitionSession, walkNotifKey, allCompetitionItemsDone]);

  // Auto-open box checklist when a category's box-pack window opens (within 1-minute tick window)
  const [autoChecklistOpened, setAutoChecklistOpened] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!isCompetitionSession) return;
    for (const c of competitionCooks) {
      const cat = c.competitionCategory as CompetitionCategory | null;
      if (!cat || autoChecklistOpened.has(cat)) continue;
      const itemPlan = getItemPlan(c);
      const boxPackMs = itemPlan?.boxPackAt
        ? new Date(itemPlan.boxPackAt).getTime()
        : c.turnInAt
          ? new Date(c.turnInAt).getTime() - 15 * 60_000
          : null;
      if (boxPackMs == null) continue;
      // Open within a 90-second window around box-pack time (one tick before or after)
      if (now >= boxPackMs - 30_000 && now <= boxPackMs + 60_000) {
        setAutoChecklistOpened((prev) => new Set([...prev, cat]));
        setChecklistCategory(cat);
        break;
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, isCompetitionSession]);

  const nextTurnInMs = turnInDates.filter((t) => t > now).sort((a, b) => a - b)[0] ?? null;
  const fmtCountdown = (ms: number): string => {
    const diff = ms - now;
    if (diff <= 0) return "now";
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `in ${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h < 24) return `in ${h}h ${m}m`;
    const d = Math.floor(h / 24);
    return `in ${d}d`;
  };

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
                // Clear saved probe assignments so the storage key doesn't linger.
                AsyncStorage.removeItem(`session_probe_assignments_${sessionId}`).catch(() => {});
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
    ? cooks.reduce((min: Date | null, c) => {
        if (!c.plannedStartAt) return min;
        const d = new Date(c.plannedStartAt);
        return min === null || d < min ? d : min;
      }, null)
    : null;

  // For competition mode the canonical "last meaningful time" is the latest
  // turn-in deadline, NOT plannedEndAt (which is the rest-finish time, i.e.
  // turn-in minus the box-pack window). The session header summary uses this
  // when isCompetitionSession to avoid showing a too-early turn-in time.
  const latestTurnIn = competitionCooks.length > 0
    ? competitionCooks.reduce((max: Date | null, c) => {
        if (!c.turnInAt) return max;
        const d = new Date(c.turnInAt);
        return max === null || d > max ? d : max;
      }, null as Date | null)
    : null;

  const latestEnd = cooks && cooks.length > 0
    ? cooks.reduce((max: Date | null, c) => {
        const t = c.plannedEndAt ?? c.plannedStartAt;
        if (!t) return max;
        const d = new Date(t);
        return max === null || d > max ? d : max;
      }, null)
    : null;

  const handleRemoveCook = (cook: Cook) => {
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
                const remaining = (cooks ?? []).filter((c) => c.id !== cook.id);
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center" }}>
            {isCompetitionSession && (
              <LinearGradient
                colors={["#EAB308", "#F59E0B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.compHeaderBadge}
              >
                <Feather name="award" size={10} color="#fff" />
                <Text style={s.compHeaderBadgeText}>COMP</Text>
              </LinearGradient>
            )}
            <Text style={[s.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
              {displayLabel}
            </Text>
          </View>
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
            <Pressable onPress={() => setEditVisible(true)} hitSlop={8} style={[s.editBtn, { flexDirection: "row", alignItems: "center", gap: 4 }]}>
              <Feather name="file-text" size={16} color={colors.foreground} />
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 13 }}>Session</Text>
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
          <View style={isTablet ? { width: "100%", maxWidth: detailMaxWidth, alignSelf: "center" } : null}>
          {isCompetitionSession && (
            <LinearGradient
              colors={["#EAB308", "#F59E0B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.compDayBanner}
            >
              <Feather name="award" size={16} color="#fff" />
              <Text style={s.compDayBannerText}>COMPETITION DAY</Text>
              {nextTurnInMs && !allResultsLogged && (
                <Text style={s.compDayBannerSub}>
                  · Next turn-in {fmtCountdown(nextTurnInMs)}
                </Text>
              )}
              {allResultsLogged && (
                <Text style={s.compDayBannerSub}>· Results logged</Text>
              )}
            </LinearGradient>
          )}

          <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <LinearGradient
              colors={
                isCompetitionSession ? ["#EAB308", "#F59E0B"]
                : hasActive ? ["#E84820", "#FF6B2B"]
                : allCompleted ? ["#16a34a", "#22c55e"]
                : ["#4f46e5", "#6C3BF5"]
              }
              style={s.summaryIcon}
            >
              <Feather name={isCompetitionSession ? "award" : "layers"} size={22} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.summaryLabel, { color: colors.foreground }]}>
                {displayLabel}
              </Text>
              <Text style={[s.summaryMeta, { color: colors.mutedForeground }]}>
                {(cooks ?? []).length} items
                {earliestStart ? ` · starts ${fmtTime(earliestStart)}` : ""}
                {isCompetitionSession
                  ? latestTurnIn
                    ? ` · last turn-in ${fmtTime(latestTurnIn)}`
                    : ""
                  : latestEnd
                    ? ` · serves ${fmtTime(latestEnd)}`
                    : ""}
              </Text>
              {isCompetitionSession && competitionCategories.length > 0 && (
                <View style={s.catChipsRow}>
                  {competitionCategories.map((c) => (
                    <View
                      key={c}
                      style={[
                        s.catChip,
                        { backgroundColor: COMPETITION_CATEGORY_COLOR[c] + "22", borderColor: COMPETITION_CATEGORY_COLOR[c] },
                      ]}
                    >
                      <Text style={[s.catChipText, { color: COMPETITION_CATEGORY_COLOR[c] }]}>
                        {COMPETITION_CATEGORY_LABEL[c]}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
              {sessionNotes ? (
                <Text style={[s.summaryNotes, { color: colors.mutedForeground }]}>
                  {sessionNotes}
                </Text>
              ) : null}
            </View>
          </View>

          {showResultsCta && (
            <Pressable
              onPress={() => setResultsOpen(true)}
              style={({ pressed }) => [
                s.resultsCta,
                {
                  backgroundColor: allResultsLogged ? "#22c55e" : colors.card,
                  borderColor: allResultsLogged ? "#22c55e" : "#EAB308",
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Feather name={allResultsLogged ? "check-circle" : "edit-3"} size={16} color={allResultsLogged ? "#fff" : "#EAB308"} />
              <Text style={[s.resultsCtaText, { color: allResultsLogged ? "#fff" : "#EAB308" }]}>
                {allResultsLogged ? "Edit Competition Results" : "Log Competition Results"}
              </Text>
            </Pressable>
          )}

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
            {(cooks ?? []).map((cook, idx: number) => {
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
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <Text style={[s.cookName, { color: colors.foreground }]}>
                            {cook.isCompetition && cook.competitionCategory
                              ? `${COMPETITION_CATEGORY_LABEL[cook.competitionCategory as CompetitionCategory].toUpperCase()}${cook.turnInAt ? ` · TURN-IN ${fmtTime(new Date(cook.turnInAt))}` : ""}`
                              : (cook.foodType || "Unnamed Cook")}
                          </Text>
                          {cook.isCompetition && cook.competitionCategory && (
                            <View
                              style={[
                                s.miniCatBadge,
                                {
                                  backgroundColor: COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory] + "22",
                                  borderColor: COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory],
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  s.miniCatBadgeText,
                                  { color: COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory] },
                                ]}
                              >
                                {COMPETITION_CATEGORY_LABEL[cook.competitionCategory as CompetitionCategory]}
                              </Text>
                            </View>
                          )}
                          {typeof cook.competitionPlacement === "number" && (
                            <View
                              style={[
                                s.placementBadge,
                                cook.competitionPlacement === 0 && { backgroundColor: "#6B7280" },
                              ]}
                            >
                              <Feather
                                name={cook.competitionPlacement === 0 ? "minus-circle" : "award"}
                                size={10}
                                color="#fff"
                              />
                              <Text style={s.placementBadgeText}>
                                {placementLabel(cook.competitionPlacement)}
                              </Text>
                            </View>
                          )}
                          {typeof cook.competitionPlacement === "number" && cook.competitionPlacement > 0 &&
                           typeof cook.competitionTeamCount === "number" && (() => {
                            const pct = computePercentile(cook.competitionPlacement, cook.competitionTeamCount!);
                            return pct ? (
                              <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10, backgroundColor: "#EAB30820", borderWidth: 1, borderColor: "#EAB308" }}>
                                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#EAB308" }}>{pct}</Text>
                              </View>
                            ) : null;
                          })()}
                          {isActive && (() => {
                            const probeTemp = getAssignedProbeTemp(cook.id);
                            return (
                              <View style={[s.livePill, probeTemp ? { gap: 4, paddingRight: 6 } : {}]}>
                                <View style={s.liveDot} />
                                <Text style={s.livePillText}>LIVE</Text>
                                {probeTemp && (
                                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#EB6C2B" }}>
                                    {probeTemp}
                                  </Text>
                                )}
                              </View>
                            );
                          })()}
                        </View>
                        {cook.grillName ? (
                          <Text style={[s.cookGrill, { color: colors.mutedForeground }]}>
                            {cook.grillName}
                            {cook.targetTempF ? ` · internal target ${cook.targetTempF}°F` : ""}
                          </Text>
                        ) : null}
                        {(() => {
                          const parts: string[] = [];
                          if ((cook as any).cookingMethod) parts.push((cook as any).cookingMethod);
                          if ((cook as any).weightLbs != null) parts.push(`${(cook as any).weightLbs} lbs`);
                          if ((cook as any).cookTempF != null) parts.push(`${(cook as any).cookTempF}°F pit`);
                          if (parts.length === 0) return null;
                          return (
                            <Text style={[s.cookGrill, { color: colors.mutedForeground, fontSize: 11 }]}>
                              {parts.join(" · ")}
                            </Text>
                          );
                        })()}
                        <View style={s.timesRow}>
                          {meatOnTime && (
                            <View style={s.timeChip}>
                              <Feather name="clock" size={11} color={colors.mutedForeground} />
                              <Text style={[s.timeChipText, { color: colors.mutedForeground }]}>
                                On {fmtTime(meatOnTime)}
                              </Text>
                            </View>
                          )}
                          {cook.isCompetition && cook.turnInAt && (() => {
                            const turnInMs = new Date(cook.turnInAt).getTime();
                            const diffMs = turnInMs - now;
                            const cat = cook.competitionCategory as CompetitionCategory | null;
                            const catColor = cat ? COMPETITION_CATEGORY_COLOR[cat] : "#EAB308";
                            const isUrgent = diffMs > 0 && diffMs <= 30 * 60 * 1000;
                            const isPast = diffMs <= 0;
                            const accent = isUrgent || isPast ? "#ef4444" : catColor;
                            const label = isPast
                              ? `Turn-in ${fmtTime(new Date(cook.turnInAt))}`
                              : `Turn-in ${fmtCountdown(turnInMs)}`;
                            return (
                              <View style={[s.timeChip, { backgroundColor: accent + "22", borderWidth: 1, borderColor: accent + "55" }]}>
                                <Feather name="award" size={11} color={accent} />
                                <Text style={[s.timeChipText, { color: accent, fontFamily: "Inter_600SemiBold" }]}>
                                  {label}
                                </Text>
                              </View>
                            );
                          })()}
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
                        <Pressable
                          onPress={(e) => { e.stopPropagation(); openCookEdit(cook); }}
                          hitSlop={8}
                          style={{ padding: 4 }}
                        >
                          <Feather name="edit-2" size={15} color="#E84820" />
                        </Pressable>
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
                                    {itemPlan.preheatMinutes ? ` · ${fmtMinutes(itemPlan.preheatMinutes)} preheat` : ""}
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
                                    {itemPlan.restMinutes ? ` · ${fmtMinutes(itemPlan.restMinutes)} rest` : ""}
                                  </Text>
                                </View>
                              </View>
                            )}
                            {cook.isCompetition && (itemPlan.boxPackAt || cook.turnInAt) && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#EAB308" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: colors.foreground }]}>
                                    {cook.competitionCategory
                                      ? `Pack the ${COMPETITION_CATEGORY_LABEL[cook.competitionCategory as CompetitionCategory]} box`
                                      : "Pack the turn-in box"}
                                  </Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {(() => {
                                      const boxPackMs = itemPlan.boxPackAt
                                        ? new Date(itemPlan.boxPackAt).getTime()
                                        : new Date(cook.turnInAt!).getTime() - 15 * 60_000;
                                      return `${fmtTime(new Date(boxPackMs))} · 15 min before turn-in`;
                                    })()}
                                  </Text>
                                  {cook.competitionCategory && COMPETITION_BOX_PACK_CATEGORY_TEXT[cook.competitionCategory as CompetitionCategory] ? (
                                    <Text
                                      style={[
                                        s.planTime,
                                        { color: colors.mutedForeground, marginTop: 2, fontStyle: "italic" },
                                      ]}
                                    >
                                      {COMPETITION_BOX_PACK_CATEGORY_TEXT[cook.competitionCategory as CompetitionCategory]}
                                    </Text>
                                  ) : null}
                                </View>
                              </View>
                            )}
                            {cook.isCompetition && cook.turnInAt && (
                              <View style={s.planStep}>
                                <View style={[s.planDot, { backgroundColor: "#EAB308" }]} />
                                <View style={{ flex: 1 }}>
                                  <Text style={[s.planLabel, { color: "#EAB308", fontFamily: "Inter_700Bold" }]}>
                                    TURN-IN
                                  </Text>
                                  <Text style={[s.planTime, { color: colors.mutedForeground }]}>
                                    {fmtTime(new Date(cook.turnInAt))} · {COMPETITION_CATEGORY_LABEL[cook.competitionCategory as CompetitionCategory] ?? "Competition"}
                                    {(() => {
                                      const walk = itemPlan?.walkMinutes ?? COMPETITION_WALK_TIME_DEFAULT_MINUTES;
                                      return ` · Leave ${walk} min early`;
                                    })()}
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

                            {cook.isCompetition && cook.competitionCategory && (
                              <Pressable
                                onPress={() => setChecklistCategory(cook.competitionCategory as CompetitionCategory)}
                                style={({ pressed }) => [
                                  s.checklistBtn,
                                  { borderColor: COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory], opacity: pressed ? 0.75 : 1 },
                                ]}
                              >
                                <Feather name="package" size={13} color={COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory]} />
                                <Text style={[s.checklistBtnText, { color: COMPETITION_CATEGORY_COLOR[cook.competitionCategory as CompetitionCategory] }]}>
                                  Open {COMPETITION_CATEGORY_LABEL[cook.competitionCategory as CompetitionCategory]} Box Checklist
                                </Text>
                              </Pressable>
                            )}

                            {cook.isCompetition && cook.competitionCategory && (() => {
                              const cat = cook.competitionCategory as CompetitionCategory;
                              const prevCooks = prevCompCooksByCategory[cat] ?? [];
                              const lastCook = prevCooks[0];
                              const isExpanded = lastTimeExpanded.has(cat);
                              if (!lastCook) {
                                return (
                                  <View style={[s.lastTimeHeader, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                                    <Text style={[s.lastTimeTitle, { color: colors.mutedForeground }]}>
                                      First time entering {COMPETITION_CATEGORY_LABEL[cat]} — no prior data
                                    </Text>
                                  </View>
                                );
                              }
                              const lastTotal = lastCook.judgeScoreAppearance != null || lastCook.judgeScoreTaste != null || lastCook.judgeScoreTexture != null
                                ? (lastCook.judgeScoreAppearance ?? 0) + (lastCook.judgeScoreTaste ?? 0) + (lastCook.judgeScoreTexture ?? 0)
                                : lastCook.judgeScore ?? null;
                              return (
                                <Pressable
                                  onPress={() => toggleLastTime(cat)}
                                  style={[s.lastTimeHeader, { backgroundColor: colors.background, borderColor: colors.border }]}
                                >
                                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
                                    <Feather name="clock" size={12} color={colors.mutedForeground} />
                                    <Text style={[s.lastTimeTitle, { color: colors.mutedForeground }]}>
                                      Last time: {lastCook.competitionName ?? "Competition"}
                                    </Text>
                                    {lastCook.competitionPlacement != null && (
                                      <Text style={[s.lastTimePill, { color: "#EAB308" }]}>
                                        {placementLabel(lastCook.competitionPlacement)}
                                      </Text>
                                    )}
                                    {lastTotal != null && (
                                      <Text style={[s.lastTimePill, { color: colors.mutedForeground }]}>
                                        {lastTotal.toFixed(0)}/360
                                      </Text>
                                    )}
                                  </View>
                                  <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground} />
                                </Pressable>
                              );
                            })()}

                            {cook.isCompetition && cook.competitionCategory && lastTimeExpanded.has(cook.competitionCategory as CompetitionCategory) && (() => {
                              const cat = cook.competitionCategory as CompetitionCategory;
                              const prevCooks = prevCompCooksByCategory[cat] ?? [];
                              const lastCook = prevCooks[0];
                              if (!lastCook) return null;
                              const hasSubScores = lastCook.judgeScoreAppearance != null || lastCook.judgeScoreTaste != null || lastCook.judgeScoreTexture != null;
                              return (
                                <View style={[s.lastTimeBody, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                  {lastCook.competitionName && (
                                    <Text style={[s.lastTimeField, { color: colors.mutedForeground }]}>
                                      Event: {lastCook.competitionName} · {new Date(lastCook.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </Text>
                                  )}
                                  {hasSubScores && (
                                    <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                                      {lastCook.judgeScoreAppearance != null && (
                                        <View style={s.lastTimeSubScore}>
                                          <Text style={[s.lastTimeSubLabel, { color: colors.mutedForeground }]}>App</Text>
                                          <Text style={[s.lastTimeSubVal, { color: colors.foreground }]}>{lastCook.judgeScoreAppearance}<Text style={{ fontSize: 9, color: colors.mutedForeground }}>/60</Text></Text>
                                        </View>
                                      )}
                                      {lastCook.judgeScoreTaste != null && (
                                        <View style={s.lastTimeSubScore}>
                                          <Text style={[s.lastTimeSubLabel, { color: colors.mutedForeground }]}>Taste</Text>
                                          <Text style={[s.lastTimeSubVal, { color: colors.foreground }]}>{lastCook.judgeScoreTaste}<Text style={{ fontSize: 9, color: colors.mutedForeground }}>/150</Text></Text>
                                        </View>
                                      )}
                                      {lastCook.judgeScoreTexture != null && (
                                        <View style={s.lastTimeSubScore}>
                                          <Text style={[s.lastTimeSubLabel, { color: colors.mutedForeground }]}>Texture</Text>
                                          <Text style={[s.lastTimeSubVal, { color: colors.foreground }]}>{lastCook.judgeScoreTexture}<Text style={{ fontSize: 9, color: colors.mutedForeground }}>/150</Text></Text>
                                        </View>
                                      )}
                                    </View>
                                  )}
                                  {lastCook.judgeNotes && (
                                    <Text style={[s.lastTimeField, { color: colors.mutedForeground, marginTop: 6, fontStyle: "italic" }]}>
                                      "{lastCook.judgeNotes}"
                                    </Text>
                                  )}
                                  {!hasSubScores && !lastCook.judgeNotes && lastCook.competitionPlacement == null && (
                                    <Text style={[s.lastTimeField, { color: colors.mutedForeground }]}>No sub-scores or judge notes recorded — log results after your cook to build the reference.</Text>
                                  )}
                                  {lastCook.notes && (
                                    <Text style={[s.lastTimeField, { color: colors.mutedForeground, marginTop: 6 }]}>
                                      Wood/technique: {lastCook.notes}
                                    </Text>
                                  )}
                                </View>
                              );
                            })()}
                          </>
                        ) : (
                          <Text style={[s.itemPlanEmpty, { color: colors.mutedForeground }]}>
                            No detailed plan saved for this item.
                          </Text>
                        )}

                        <Pressable
                          onPress={() => openCookEdit(cook)}
                          style={({ pressed }) => [
                            s.openDetailBtn,
                            { borderColor: "#E84820", opacity: pressed ? 0.7 : 1, marginBottom: 6 },
                          ]}
                        >
                          <Feather name="edit-2" size={13} color="#E84820" />
                          <Text style={[s.openDetailText, { color: "#E84820" }]}>
                            Edit cook &amp; techniques
                          </Text>
                        </Pressable>

                        {/* Multi-cook probe routing — active cooks only, Pro-gated */}
                        {isActive && (
                          <View style={[s.probePickerSection, { borderColor: colors.border, backgroundColor: colors.background }]}>
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
                              <Feather name="bluetooth" size={12} color={colors.mutedForeground} />
                              <Text style={[s.probePickerTitle, { color: colors.mutedForeground }]}>
                                Probe Assignment
                              </Text>
                              {!effectivePro && (
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.primary + "22" }}>
                                  <Feather name="lock" size={9} color={colors.primary} />
                                  <Text style={{ fontSize: 9.5, fontFamily: "Inter_600SemiBold", color: colors.primary }}>PRO</Text>
                                </View>
                              )}
                            </View>
                            {connectedBleDevices.length === 0 ? (
                              <Text style={[s.probePickerEmpty, { color: colors.mutedForeground }]}>
                                No BLE probes connected. Open Devices to pair a thermometer.
                              </Text>
                            ) : (
                              connectedBleDevices.map((device) => {
                                const key = `bleCtx_${device.id}`;
                                const isAssigned = cookProbeAssignments.get(cook.id) === key;
                                return (
                                  <Pressable
                                    key={device.id}
                                    onPress={() => {
                                      if (!effectivePro) {
                                        showPaywall({ trigger: "pro_required", featureName: "Multi-Cook Probe Routing" });
                                        return;
                                      }
                                      setCookProbeAssignments((prev) => {
                                        const next = new Map(prev);
                                        if (isAssigned) next.delete(cook.id);
                                        else next.set(cook.id, key);
                                        return next;
                                      });
                                    }}
                                    style={[
                                      s.probePickerRow,
                                      {
                                        borderColor: isAssigned ? "#FF6B2B60" : colors.border,
                                        backgroundColor: isAssigned ? "#FF6B2B08" : colors.card,
                                      },
                                    ]}
                                  >
                                    <View style={{ flex: 1 }}>
                                      <Text style={[s.probePickerName, { color: colors.foreground }]}>{device.name}</Text>
                                      {device.probeTempF != null && (
                                        <Text style={[s.probePickerTemp, { color: colors.mutedForeground }]}>
                                          {device.probeTempF}°F internal
                                          {device.ambientTempF != null ? ` · ${device.ambientTempF}°F pit` : ""}
                                          {device.batteryPct != null ? ` · 🔋${device.batteryPct}%` : ""}
                                        </Text>
                                      )}
                                    </View>
                                    {isAssigned ? (
                                      <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: "#FF6B2B20" }}>
                                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: "#FF6B2B" }}>Tracking</Text>
                                      </View>
                                    ) : (
                                      <Feather name="circle" size={14} color={colors.mutedForeground} />
                                    )}
                                  </Pressable>
                                );
                              })
                            )}
                          </View>
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
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Session Details</Text>
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

      {/* ════ COMPETITION RESULTS MODAL ════ */}
      <Modal
        visible={resultsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setResultsOpen(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setResultsOpen(false)} />
          <View style={[s.modalSheet, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={s.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[s.modalTitle, { color: colors.foreground }]}>
                  Log Competition Results
                </Text>
                <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 2 }}>
                  KCBS scoring: Appearance (0–60), Taste (0–150), Texture (0–150)
                </Text>
              </View>
              <Pressable onPress={() => setResultsOpen(false)} hitSlop={8}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 520 }} keyboardShouldPersistTaps="handled">
              {competitionCooks.map((c) => {
                const draft = resultsDraft[c.id] ?? { placement: "", teamCount: "", appearance: "", taste: "", texture: "", judgeNotes: "" };
                const cat = c.competitionCategory as CompetitionCategory | null;
                const color = cat ? COMPETITION_CATEGORY_COLOR[cat] : colors.primary;
                const computedTotal = (() => {
                  const a = Number(draft.appearance); const t = Number(draft.taste); const tx = Number(draft.texture);
                  if (!draft.appearance && !draft.taste && !draft.texture) return null;
                  return (isNaN(a) ? 0 : a) + (isNaN(t) ? 0 : t) + (isNaN(tx) ? 0 : tx);
                })();
                const percentile = (() => {
                  const pl = Number(draft.placement); const tc = Number(draft.teamCount);
                  if (!draft.placement || !draft.teamCount || isNaN(pl) || isNaN(tc)) return null;
                  return computePercentile(pl, tc);
                })();
                return (
                  <View key={c.id} style={[s.resultsModalRow, { borderBottomColor: colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      {cat && (
                        <View style={[s.miniCatBadge, { backgroundColor: color + "22", borderColor: color }]}>
                          <Text style={[s.miniCatBadgeText, { color }]}>{COMPETITION_CATEGORY_LABEL[cat]}</Text>
                        </View>
                      )}
                      <Text style={[s.resultsModalCookName, { color: colors.foreground, marginBottom: 0 }]}>
                        {c.foodType ?? "Cook"}
                      </Text>
                    </View>

                    {/* Placement + Team Count row */}
                    <View style={s.resultsModalFieldRow}>
                      <View style={s.resultsModalField}>
                        <Text style={[s.resultsModalFieldLabel, { color: colors.mutedForeground }]}>Placement</Text>
                        <TextInput
                          style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius - 2, color: colors.foreground }]}
                          placeholder="1, 2, 3…"
                          placeholderTextColor={colors.mutedForeground}
                          value={draft.placement}
                          onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, placement: v.replace(/[^0-9]/g, "") } }))}
                          keyboardType="number-pad"
                        />
                        <View style={{ flexDirection: "row", gap: 6, marginTop: 4 }}>
                          <Pressable
                            onPress={() => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, placement: "0" } }))}
                            style={({ pressed }) => [{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: draft.placement === "0" ? "#6B7280" : colors.border, backgroundColor: draft.placement === "0" ? "#6B728022" : "transparent", opacity: pressed ? 0.7 : 1 }]}
                          >
                            <Text style={{ color: draft.placement === "0" ? "#6B7280" : colors.mutedForeground, fontFamily: "Inter_700Bold", fontSize: 10 }}>DNP</Text>
                          </Pressable>
                        </View>
                        {percentile && (
                          <View style={[s.percentilePill, { backgroundColor: "#EAB30820", borderColor: "#EAB308" }]}>
                            <Feather name="award" size={10} color="#EAB308" />
                            <Text style={[s.percentileText, { color: "#EAB308" }]}>{percentile}</Text>
                          </View>
                        )}
                      </View>
                      <View style={s.resultsModalField}>
                        <Text style={[s.resultsModalFieldLabel, { color: colors.mutedForeground }]}>Teams in Field</Text>
                        <TextInput
                          style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius - 2, color: colors.foreground }]}
                          placeholder="e.g. 42"
                          placeholderTextColor={colors.mutedForeground}
                          value={draft.teamCount}
                          onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, teamCount: v.replace(/[^0-9]/g, "") } }))}
                          keyboardType="number-pad"
                        />
                      </View>
                    </View>

                    {/* KCBS Sub-scores */}
                    <Text style={[s.resultsModalFieldLabel, { color: colors.mutedForeground, marginTop: 10, marginBottom: 6 }]}>JUDGE SCORES (6 judges × each)</Text>
                    {(() => {
                      const appNum = Number(draft.appearance); const tasteNum = Number(draft.taste); const texNum = Number(draft.texture);
                      const appOver = draft.appearance !== "" && !isNaN(appNum) && appNum > COMPETITION_SCORING.maxAppearance;
                      const tasteOver = draft.taste !== "" && !isNaN(tasteNum) && tasteNum > COMPETITION_SCORING.maxTaste;
                      const texOver = draft.texture !== "" && !isNaN(texNum) && texNum > COMPETITION_SCORING.maxTexture;
                      if (!appOver && !tasteOver && !texOver) return null;
                      return (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EF444420", borderRadius: 6, padding: 8, marginBottom: 8, borderWidth: 1, borderColor: "#EF4444" }}>
                          <Feather name="alert-triangle" size={13} color="#EF4444" />
                          <Text style={{ color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 11, flex: 1 }}>
                            {[appOver && "Appearance exceeds 60", tasteOver && "Taste exceeds 150", texOver && "Texture exceeds 150"].filter(Boolean).join(" · ")} — KCBS cap exceeded. Fix or remove the value before saving.
                          </Text>
                        </View>
                      );
                    })()}
                    <View style={s.resultsModalFieldRow}>
                      <View style={s.resultsModalField}>
                        <Text style={[s.resultsModalFieldLabel, { color: color }]}>Appearance <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>0–60</Text></Text>
                        <TextInput
                          style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: Number(draft.appearance) > COMPETITION_SCORING.maxAppearance && draft.appearance !== "" ? "#EF4444" : colors.border, borderRadius: colors.radius - 2, color: colors.foreground }]}
                          placeholder="0–60"
                          placeholderTextColor={colors.mutedForeground}
                          value={draft.appearance}
                          onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, appearance: v.replace(/[^0-9.]/g, "") } }))}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={s.resultsModalField}>
                        <Text style={[s.resultsModalFieldLabel, { color: color }]}>Taste <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>0–150</Text></Text>
                        <TextInput
                          style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius - 2, color: colors.foreground }]}
                          placeholder="0–150"
                          placeholderTextColor={colors.mutedForeground}
                          value={draft.taste}
                          onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, taste: v.replace(/[^0-9.]/g, "") } }))}
                          keyboardType="decimal-pad"
                        />
                      </View>
                      <View style={s.resultsModalField}>
                        <Text style={[s.resultsModalFieldLabel, { color: color }]}>Texture <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular" }}>0–150</Text></Text>
                        <TextInput
                          style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius - 2, color: colors.foreground }]}
                          placeholder="0–150"
                          placeholderTextColor={colors.mutedForeground}
                          value={draft.texture}
                          onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, texture: v.replace(/[^0-9.]/g, "") } }))}
                          keyboardType="decimal-pad"
                        />
                      </View>
                    </View>
                    {computedTotal != null && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
                        <Text style={[s.resultsModalFieldLabel, { color: colors.mutedForeground }]}>Total:</Text>
                        <Text style={{ color: color, fontFamily: "Inter_700Bold", fontSize: 16 }}>{computedTotal.toFixed(1)}</Text>
                        <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_400Regular", fontSize: 12 }}>/360</Text>
                        <View style={[{ height: 6, flex: 1, borderRadius: 3, backgroundColor: colors.border, overflow: "hidden" }]}>
                          <View style={{ height: 6, width: `${(computedTotal / 360) * 100}%` as unknown as number, backgroundColor: color, borderRadius: 3 }} />
                        </View>
                      </View>
                    )}

                    <View style={{ marginTop: 10 }}>
                      <Text style={[s.resultsModalFieldLabel, { color: colors.mutedForeground }]}>Judge Notes</Text>
                      <TextInput
                        style={[s.resultsModalInput, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius - 2, color: colors.foreground, minHeight: 56, textAlignVertical: "top" }]}
                        placeholder="Comments from judges (e.g. bite-through skin, smoke ring)"
                        placeholderTextColor={colors.mutedForeground}
                        value={draft.judgeNotes}
                        onChangeText={(v) => setResultsDraft((p) => ({ ...p, [c.id]: { ...draft, judgeNotes: v } }))}
                        multiline
                      />
                    </View>
                  </View>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={handleSaveResults}
              disabled={updateCook.isPending}
              style={({ pressed }) => [
                s.resultsCta,
                {
                  backgroundColor: "#EAB308",
                  borderColor: "#EAB308",
                  borderRadius: colors.radius,
                  opacity: pressed || updateCook.isPending ? 0.85 : 1,
                  marginTop: 10,
                  marginBottom: 0,
                },
              ]}
            >
              {updateCook.isPending ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Feather name="check" size={16} color="#fff" />
              )}
              <Text style={[s.resultsCtaText, { color: "#fff" }]}>
                {updateCook.isPending ? "Saving…" : "Save Results"}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {checklistCategory && (
        <BoxPresentationChecklist
          visible={checklistCategory !== null}
          onClose={() => setChecklistCategory(null)}
          category={checklistCategory}
          colors={colors}
        />
      )}

      <EditCookModal
        visible={cookEditVisible}
        onClose={() => { setCookEditVisible(false); setCookEditCook(null); }}
        colors={colors}
        insets={insets}
        saveEdit={saveCookEdit}
        editSaving={cookEditSaving}
        editFoodType={cookEditFoodType}
        setEditFoodType={setCookEditFoodType}
        editSelectedGrill={cookEditSelectedGrill}
        grills={grills}
        setEditGrillPickerVisible={setCookEditGrillPickerVisible}
        editGrillPickerVisible={cookEditGrillPickerVisible}
        editGrillId={cookEditGrillId}
        setEditGrillId={setCookEditGrillId}
        editWeight={cookEditWeight}
        setEditWeight={setCookEditWeight}
        editCookTemp={cookEditCookTemp}
        setEditCookTemp={setCookEditCookTemp}
        editTargetTemp={cookEditTargetTemp}
        setEditTargetTemp={setCookEditTargetTemp}
        editActualStartDate={cookEditActualStartDate}
        setEditActualStartDate={setCookEditActualStartDate}
        editActualEndDate={cookEditActualEndDate}
        setEditActualEndDate={setCookEditActualEndDate}
        editStartDateOpen={cookEditStartDateOpen}
        setEditStartDateOpen={setCookEditStartDateOpen}
        editStartTimeOpen={cookEditStartTimeOpen}
        setEditStartTimeOpen={setCookEditStartTimeOpen}
        editEndDateOpen={cookEditEndDateOpen}
        setEditEndDateOpen={setCookEditEndDateOpen}
        editEndTimeOpen={cookEditEndTimeOpen}
        setEditEndTimeOpen={setCookEditEndTimeOpen}
        editDates={cookEditDates}
        editNotes={cookEditNotes}
        setEditNotes={setCookEditNotes}
        editCookingMethod={cookEditCookingMethod}
        setEditCookingMethod={setCookEditCookingMethod}
        editInjection={cookEditInjection}
        setEditInjection={setCookEditInjection}
        editSpritzFrequency={cookEditSpritzFrequency}
        setEditSpritzFrequency={setCookEditSpritzFrequency}
        editSpritzLiquid={cookEditSpritzLiquid}
        setEditSpritzLiquid={setCookEditSpritzLiquid}
        editWrapFinish={cookEditWrapFinish}
        setEditWrapFinish={setCookEditWrapFinish}
      />
    </View>
  );
}

const s = StyleSheet.create({
  compHeaderBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  compHeaderBadgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9, letterSpacing: 0.5 },
  compDayBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  compDayBannerText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13, letterSpacing: 0.6 },
  compDayBannerSub: { color: "rgba(255,255,255,0.92)", fontFamily: "Inter_500Medium", fontSize: 12 },
  catChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  catChip: { paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderRadius: 6 },
  catChipText: { fontFamily: "Inter_600SemiBold", fontSize: 10 },
  resultsCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  resultsCtaText: { fontFamily: "Inter_700Bold", fontSize: 13 },
  miniCatBadge: { paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderRadius: 4 },
  miniCatBadgeText: { fontFamily: "Inter_600SemiBold", fontSize: 9, letterSpacing: 0.3 },
  placementBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "#EAB308",
  },
  placementBadgeText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 10 },
  resultsModalRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultsModalCookName: { fontFamily: "Inter_600SemiBold", fontSize: 14, marginBottom: 6 },
  resultsModalFieldRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  resultsModalField: { flex: 1 },
  resultsModalFieldLabel: { fontFamily: "Inter_500Medium", fontSize: 11, marginBottom: 4 },
  resultsModalInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
  percentilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    marginTop: 6,
    alignSelf: "flex-start",
  },
  percentileText: { fontFamily: "Inter_700Bold", fontSize: 11 },
  checklistBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  checklistBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 12 },
  lastTimeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  lastTimeTitle: { fontFamily: "Inter_500Medium", fontSize: 12, flex: 1 },
  lastTimePill: { fontFamily: "Inter_700Bold", fontSize: 11 },
  lastTimeBody: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderTopWidth: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  lastTimeField: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 16 },
  lastTimeSubScore: { alignItems: "center" },
  lastTimeSubLabel: { fontFamily: "Inter_500Medium", fontSize: 10, marginBottom: 2 },
  lastTimeSubVal: { fontFamily: "Inter_700Bold", fontSize: 14 },
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
  probePickerSection: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 10,
    gap: 6,
  },
  probePickerTitle: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  probePickerEmpty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  probePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    padding: 9,
    gap: 8,
  },
  probePickerName: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  probePickerTemp: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
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
