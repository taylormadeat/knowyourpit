import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Image,
  TextInput,
  LayoutChangeEvent,
  Modal,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Animated,
  LogBox,
} from "react-native";
import { fmtMinutes, fmtDurationMs, fmtRelMinutes } from "@/utils/duration";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";

import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useScheduleStepNotifications } from "@/hooks/useScheduleStepNotifications";
import { setCookDetailVisible } from "@/hooks/cookDetailVisibility";
import { LogoBackground } from "@/components/LogoBackground";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { useAmbientWeather, weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";

import {
  useGetCook,
  useDeleteCook,
  useUpdateCook,
  useAnalyzeCook,
  useListGrills,
  useGetMeaterReadings,
  useGetThermoworksReadings,
  useListAlerts,
  useCreateAlert,
  usePatchAlert,
  getListCooksQueryKey,
  getGetCookQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  getListAlertsQueryKey,
  getGetMeaterReadingsQueryKey,
  getGetThermoworksReadingsQueryKey,
} from "@workspace/api-client-react";
import * as Notifications from "expo-notifications";

// Silence a dev-only LogBox warning that can fire from RN's measureLayout when
// the underlying native node briefly detaches between layout passes. Our
// auto-scroll uses cached onLayout offsets and never calls measureLayout, but
// other libraries occasionally trigger the same warning.
LogBox.ignoreLogs(["ref.measureLayout must be called with a ref"]);

/** Replace any ISO-8601 timestamps in a string with human-readable local time */
function fmtISOInText(text: string): string {
  return text.replace(
    /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g,
    (match) => {
      const d = new Date(match);
      if (isNaN(d.getTime())) return match;
      return d.toLocaleString(undefined, {
        month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", hour12: true,
      });
    }
  );
}

function fmtElapsed(ms: number): string {
  if (ms <= 0) return "0s";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

function formatDT(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const m = dt.getMonth() + 1;
  const day = dt.getDate();
  const h = dt.getHours() % 12 || 12;
  const min = String(dt.getMinutes()).padStart(2, "0");
  const ampm = dt.getHours() < 12 ? "AM" : "PM";
  return `${m}/${day}/${dt.getFullYear()} ${h}:${min} ${ampm}`;
}

function relCountdown(targetMs: number, nowMs: number): string {
  return fmtRelMinutes(targetMs, nowMs);
}

function getEditDates(): Date[] {
  const dates: Date[] = [];
  const now = new Date();
  for (let i = 30; i >= -7; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    dates.push(d);
  }
  return dates;
}

function formatEditDate(d: Date): string {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const day = new Date(d); day.setHours(0, 0, 0, 0);
  if (day.getTime() === today.getTime()) return "Today";
  if (day.getTime() === yesterday.getTime()) return "Yesterday";
  if (day.getTime() === tomorrow.getTime()) return "Tomorrow";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatEditTime(h: number, m: number): string {
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${ampm}`;
}

const EDIT_TIME_SLOTS: Array<{ h: number; m: number }> = (() => {
  const slots: Array<{ h: number; m: number }> = [];
  for (let h = 0; h <= 23; h++) {
    slots.push({ h, m: 0 });
    slots.push({ h, m: 30 });
  }
  return slots;
})();

const logoImg = require("@/assets/images/logo.png");

function fmtDuration(ms: number): string {
  return fmtDurationMs(ms);
}

type PlanGrade = { grade: string; color: string; accuracy: number; deviation: string; note: string };

function computePlanGrade(c: {
  plannedStartAt?: string | null;
  plannedEndAt?: string | null;
  actualStartAt?: string | null;
  actualEndAt?: string | null;
}): PlanGrade | null {
  const pStart = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
  const pEnd = c.plannedEndAt ? new Date(c.plannedEndAt).getTime() : null;
  const aStart = c.actualStartAt ? new Date(c.actualStartAt).getTime() : null;
  const aEnd = c.actualEndAt ? new Date(c.actualEndAt).getTime() : null;
  if (!pStart || !pEnd || !aStart || !aEnd) return null;
  const plannedMs = pEnd - pStart;
  if (plannedMs <= 0) return null;
  const actualMs = aEnd - aStart;
  const diff = actualMs - plannedMs;
  const deviationRatio = Math.abs(diff) / plannedMs;
  const accuracy = Math.max(0, Math.round((1 - deviationRatio) * 100));
  const overUnder = diff > 0 ? `ran ${fmtDuration(diff)} over` : diff < 0 ? `wrapped up ${fmtDuration(-diff)} early` : "right on schedule";
  let grade: string, color: string, note: string;
  if (accuracy >= 88)       { grade = "A"; color = "#22c55e"; note = "Nailed the timeline"; }
  else if (accuracy >= 74)  { grade = "B"; color = "#84cc16"; note = "Close to the plan"; }
  else if (accuracy >= 57)  { grade = "C"; color = "#eab308"; note = "Some variation from plan"; }
  else if (accuracy >= 38)  { grade = "D"; color = "#f97316"; note = "Notable deviation"; }
  else                      { grade = "F"; color = "#ef4444"; note = "Far off the plan"; }
  return { grade, color, accuracy, deviation: overUnder, note };
}

const STATUS_COLORS: Record<string, string> = {
  planned: "#3b82f6",
  active: "#EB6C2B",
  completed: "#22c55e",
  cancelled: "#ef4444",
};

const VERDICT_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  perfect:    { label: "Perfect Cook", color: "#22c55e", icon: "award" },
  good:       { label: "Good Cook",    color: "#84cc16", icon: "thumbs-up" },
  overcooked: { label: "Overcooked",   color: "#f97316", icon: "thermometer" },
  undercooked:{ label: "Undercooked",  color: "#3b82f6", icon: "thermometer" },
  needs_work: { label: "Needs Work",   color: "#eab308", icon: "tool" },
};

const EVENT_ICONS: Record<string, string> = {
  wrap: "package",
  stall: "pause-circle",
  spike: "zap",
  done: "check-circle",
  note: "message-circle",
};

type PickedImage = { uri: string; base64: string; mimeType: string };

type Assessment = {
  verdict: string;
  summary: string;
  whatWentWell: string[];
  suggestions: string[];
};

type PhasePrediction = {
  phase: "heat_up" | "stall" | "finishing" | "done";
  phaseLabel: string;
  timeToStallMinutes: number | null;
  stallDurationMinutes: number | null;
  timeToFinishMinutes: number | null;
  narrative: string;
};

type Decision = {
  action: "wrap" | "spritz" | "increase_pit" | "decrease_pit" | "pull" | "recover_schedule" | "maintain";
  urgency: "now" | "soon" | "when_ready";
  instruction: string;
  rationale: string;
  targetValue: number | null;
};

type AnalysisResult = {
  probes: Array<{ probeName: string; finishingTempF: number; minTempF: number | null; maxTempF: number | null }>;
  events: Array<{ type: string; timeMinutes: number; description: string }>;
  cookDurationMinutes: number | null;
  detectedFoodType: string | null;
  noDataFound: boolean;
  rawExtraction: string | null;
  assessment: Assessment | null;
  phasePrediction: PhasePrediction | null;
  decisions: Decision[];
};

function getOutdoorTempEffect(tempF: number | null): string | null {
  if (tempF == null) return null;
  if (tempF < 20) return "Extreme cold — expect 30%+ longer cook times. Pit will struggle to hold temp.";
  if (tempF < 40) return "Cold conditions — allow 20-25% extra cook time. Use windbreaks and monitor closely.";
  if (tempF < 55) return "Cool weather — preheat thoroughly and budget 10-15% extra time.";
  if (tempF < 80) return "Good conditions. No major weather adjustments needed.";
  if (tempF < 95) return "Warm day — pit temps may run hot. Check vents frequently.";
  return "Very hot — your pit needs less fuel. Watch for temperature spikes.";
}

interface ScheduleItem {
  foodType?: string;
  grillLightAt?: string | null;
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
  estimatedDurationMinutes?: number;
  restMinutes?: number;
  preheatMinutes?: number;
  grillId?: number | null;
}

interface SequenceData {
  schedule: ScheduleItem[];
  serveAt?: string;
  summary?: string | null;
}

type NextStepKey = "grillLight" | "meatOn" | "pullOff" | "serve";

interface NextStep {
  itemIdx: number;
  step: NextStepKey;
}

function computeNextStep(
  seqData: SequenceData | null | undefined,
  cookStatus: string | undefined,
  nowMs: number,
): NextStep | null {
  if (cookStatus !== "active" || !seqData?.schedule?.length) return null;
  let bestDiff = Infinity;
  let result: NextStep | null = null;
  seqData.schedule.forEach((item, idx) => {
    const candidates: Array<{ step: NextStepKey; ms: number | null }> = [
      { step: "grillLight", ms: item.grillLightAt ? new Date(item.grillLightAt).getTime() : null },
      { step: "meatOn", ms: item.meatOnAt ? new Date(item.meatOnAt).getTime() : null },
      { step: "pullOff", ms: item.estimatedFinishAt ? new Date(item.estimatedFinishAt).getTime() : null },
    ];
    if ((item.restMinutes ?? 0) > 0 && item.estimatedFinishAt) {
      candidates.push({
        step: "serve",
        ms: new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60000,
      });
    }
    candidates.forEach(({ step, ms }) => {
      if (ms === null) return;
      const diff = ms - nowMs;
      if (diff > 0 && diff < bestDiff) {
        bestDiff = diff;
        result = { itemIdx: idx, step };
      }
    });
  });
  return result;
}

export default function CookDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: cook, isLoading } = useGetCook(Number(id));
  const deleteCook = useDeleteCook();
  const updateCook = useUpdateCook();
  const analyzeMutation = useAnalyzeCook();
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [cookNotes, setCookNotes] = useState("");

  const [userTempInput, setUserTempInput] = useState("");
  const [userTempEdited, setUserTempEdited] = useState(false);
  const [pitTempInput, setPitTempInput] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cardWidth, setCardWidth] = useState(300);

  // Ratings state
  const [rateTenderness, setRateTenderness] = useState<number>(0);
  const [rateFlavor, setRateFlavor] = useState<number>(0);
  const [rateBark, setRateBark] = useState<number>(0);
  const [rateSaving, setRateSaving] = useState(false);

  const createAlert = useCreateAlert();
  const patchAlert = usePatchAlert();

  const cookStatus = (cook as any)?.status;

  // Ambient outdoor weather — used for live cook display and PitMaster context
  const weather = useAmbientWeather();

  // Alerts for this cook (active ones, used for MEATER threshold checking)
  const { data: cookAlerts } = useListAlerts({
    query: { queryKey: getListAlertsQueryKey(), enabled: cookStatus === "active" },
  });
  const activeCookAlerts = ((cookAlerts as any[]) ?? []).filter(
    (a: any) => a.cookId === Number(id) && a.isActive,
  );

  // Alert sheet state
  const [alertSheetVisible, setAlertSheetVisible] = useState(false);
  const [alertMode, setAlertMode] = useState<"temp" | "timer">("temp");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertLabel, setAlertLabel] = useState("");
  const [alertMinutesBefore, setAlertMinutesBefore] = useState("30");
  const [alertSaving, setAlertSaving] = useState(false);
  const [showCookDetails, setShowCookDetails] = useState(false);
  const [seqScheduleExpanded, setSeqScheduleExpanded] = useState(false);
  const [expandedStoredSections, setExpandedStoredSections] = useState<Set<string>>(new Set());
  const [expandedResultSections, setExpandedResultSections] = useState<Set<string>>(new Set());

  const toggleStoredSection = (key: string) => {
    setExpandedStoredSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const toggleResultSection = (key: string) => {
    setExpandedResultSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const firedAlertIds = useRef<Set<number>>(new Set());

  const [confirmedSteps, setConfirmedSteps] = useState<Record<string, string>>({});
  useEffect(() => {
    const stored = cook?.confirmedSteps;
    setConfirmedSteps(stored && typeof stored === "object" ? stored : {});
  }, [id, cook?.confirmedSteps]);

  const toggleConfirmedStep = async (key: string) => {
    const prev = confirmedSteps;
    const next = { ...prev };
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = new Date().toISOString();
    }
    setConfirmedSteps(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await updateCook.mutateAsync({
        id: Number(id),
        data: { confirmedSteps: next },
      });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    } catch {
      setConfirmedSteps(prev);
    }
  };

  const { data: meaterData, isLoading: meaterLoading } = useGetMeaterReadings({
    query: {
      queryKey: getGetMeaterReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? 15000 : false,
    },
  });
  // null = still loading (don't show placeholder yet), true/false = resolved
  const meaterLinked = meaterLoading ? null : (meaterData?.linked ?? false);
  const meaterProbes = meaterData?.probes ?? [];

  const { data: thermoworksData, isLoading: thermoworksLoading } = useGetThermoworksReadings({
    query: {
      queryKey: getGetThermoworksReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? 15000 : false,
    },
  });
  const thermoworksLinked = thermoworksLoading ? null : (thermoworksData?.linked ?? false);
  const thermoworksProbes = thermoworksData?.probes ?? [];

  const [nowMs, setNowMs] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveReadings, setLiveReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);

  const scheduleScrollViewRef = useRef<ScrollView>(null);
  // Cached y-offsets used to scroll the highlighted "next step" row into view
  // without invoking measureLayout (which can warn when the row's underlying
  // native node is detached/remounted between layout passes).
  const scheduleListYRef = useRef<number>(0);
  const itemYRef = useRef<Record<number, number>>({});
  const timelineYRef = useRef<Record<number, number>>({});
  const rowYRef = useRef<Record<string, number>>({});

  useEffect(() => {
    setLiveReadings([]);
    setNowMs(Date.now());
    setResult(null);
    setImages([]);
    setCookNotes("");
    setUserTempInput("");
    setUserTempEdited(false);
    setPitTempInput("");
  }, [id]);

  // Initialize ratings from saved cook data; also re-syncs when server refetches after a save
  const cookRatingT = (cook as any)?.ratingTenderness ?? 0;
  const cookRatingF = (cook as any)?.ratingFlavor ?? 0;
  const cookRatingB = (cook as any)?.ratingBark ?? 0;
  useEffect(() => {
    setRateTenderness(cookRatingT);
    setRateFlavor(cookRatingF);
    setRateBark(cookRatingB);
  }, [(cook as any)?.id, cookRatingT, cookRatingF, cookRatingB]);

  useEffect(() => {
    if (cookStatus !== "active") {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [cookStatus]);

  // Access sequenceData typed — the API-generated Cook type doesn't include this
  // JSON field, so we narrow the cast to only what we actually use here.
  const cookSeqData = (cook as { sequenceData?: SequenceData | null } | null | undefined)?.sequenceData ?? null;

  // Schedule local notifications for each upcoming schedule step so the
  // pitmaster is alerted even when the app is backgrounded or the phone is
  // locked.  The in-app haptic/banner still fires when foregrounded (see
  // the step-change toast effect below); the notification handler in
  // _layout.tsx suppresses the system banner while the app is active to
  // avoid duplication.
  useScheduleStepNotifications(Number(id), cookStatus, cookSeqData);

  // Compute the current "next step" using the shared helper. Runs before early
  // returns so it respects React's rules of hooks.
  const nextStep = useMemo(
    () => computeNextStep(cookSeqData, cookStatus, nowMs),
    [cookSeqData, cookStatus, nowMs],
  );
  // Stable string key — React compares primitives so the effect below only fires
  // when the step actually transitions (not every second when nowMs ticks).
  const nextStepKey = nextStep ? `${nextStep.itemIdx}:${nextStep.step}` : null;
  // Primitive mirror of nextStep.itemIdx so the auto-scroll effect can depend on
  // it without taking a fresh `nextStep` object reference every nowMs tick.
  const nextStepItemIdx = nextStep ? nextStep.itemIdx : null;

  // ── Step-change toast state ───────────────────────────────────────────────
  const [stepToast, setStepToast] = useState<string | null>(null);
  const stepToastAnim = useRef(new Animated.Value(0)).current;
  const stepToastAnimRef = useRef<Animated.CompositeAnimation | null>(null);
  const stepToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevNextStepKeyRef = useRef<string | null | undefined>(undefined);

  // Track when this screen is mounted so the global notification handler can
  // suppress schedule-step system banners in favour of the in-app toast.
  useEffect(() => {
    setCookDetailVisible(true);
    return () => setCookDetailVisible(false);
  }, []);

  // Clean up timer on unmount to avoid post-unmount state updates.
  useEffect(() => {
    return () => {
      if (stepToastTimerRef.current) clearTimeout(stepToastTimerRef.current);
      stepToastAnimRef.current?.stop();
    };
  }, []);

  // Auto-expand the schedule and smooth-scroll the highlighted row into view
  // whenever the next step changes. We use cached onLayout offsets instead of
  // measureLayout so we never call into a possibly-detached native node.
  //
  // IMPORTANT: depend ONLY on primitives (`nextStepKey`, `nextStepItemIdx`).
  // The `nextStep` object is recreated by useMemo every nowMs tick (1s) for
  // active cooks, so taking it as a dep would re-fire the effect every second
  // and yank the user back to the highlighted row mid-scroll.
  useEffect(() => {
    if (!nextStepKey || nextStepItemIdx === null) return;
    setSeqScheduleExpanded(true);
    const timer = setTimeout(() => {
      const rowY = rowYRef.current[nextStepKey];
      if (rowY === undefined) return;
      const idx = nextStepItemIdx;
      const targetY =
        scheduleListYRef.current +
        (itemYRef.current[idx] ?? 0) +
        (timelineYRef.current[idx] ?? 0) +
        rowY -
        80;
      scheduleScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [nextStepKey, nextStepItemIdx]);

  // Haptic + toast on next-step transition (active cooks only).
  // prevNextStepKeyRef starts as undefined so the initial mount is skipped.
  useEffect(() => {
    if (prevNextStepKeyRef.current === undefined) {
      prevNextStepKeyRef.current = nextStepKey;
      return;
    }
    const prev = prevNextStepKeyRef.current;
    prevNextStepKeyRef.current = nextStepKey;
    if (nextStepKey === prev || !nextStepKey || cookStatus !== "active") return;

    const STEP_LABELS: Record<NextStepKey, string> = {
      grillLight: "Light the Grill",
      meatOn: "Meat On",
      pullOff: "Pull Off",
      serve: "Serve",
    };

    const stepLabel = STEP_LABELS[nextStep!.step] ?? nextStep!.step;
    const item = cookSeqData?.schedule?.[nextStep!.itemIdx];
    let timeStr = "";
    if (item) {
      const fmt = (iso: string) =>
        new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (nextStep!.step === "grillLight" && item.grillLightAt) timeStr = fmt(item.grillLightAt);
      else if (nextStep!.step === "meatOn" && item.meatOnAt) timeStr = fmt(item.meatOnAt);
      else if (nextStep!.step === "pullOff" && item.estimatedFinishAt) timeStr = fmt(item.estimatedFinishAt);
      else if (nextStep!.step === "serve" && item.estimatedFinishAt) {
        const serveMs = new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60000;
        timeStr = new Date(serveMs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      }
    }
    const message = timeStr ? `${stepLabel} · ${timeStr}` : stepLabel;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }

    if (stepToastTimerRef.current) clearTimeout(stepToastTimerRef.current);
    stepToastAnimRef.current?.stop();
    stepToastAnim.setValue(0);
    setStepToast(message);
    const anim = Animated.sequence([
      Animated.timing(stepToastAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.delay(3600),
      Animated.timing(stepToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]);
    stepToastAnimRef.current = anim;
    anim.start();
    stepToastTimerRef.current = setTimeout(() => setStepToast(null), 4200);
  }, [nextStepKey]);

  const dismissStepToast = React.useCallback(() => {
    if (stepToastTimerRef.current) {
      clearTimeout(stepToastTimerRef.current);
      stepToastTimerRef.current = null;
    }
    stepToastAnimRef.current?.stop();
    const fadeOut = Animated.timing(stepToastAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    });
    stepToastAnimRef.current = fadeOut;
    fadeOut.start(() => setStepToast(null));
  }, [stepToastAnim]);

  // Edit modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editGrillPickerVisible, setEditGrillPickerVisible] = useState(false);
  const [editFoodType, setEditFoodType] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editCookTemp, setEditCookTemp] = useState("");
  const [editTargetTemp, setEditTargetTemp] = useState("");
  const [editGrillId, setEditGrillId] = useState<number | null>(null);
  const [editActualStartDate, setEditActualStartDate] = useState<Date | null>(null);
  const [editActualEndDate, setEditActualEndDate] = useState<Date | null>(null);
  const [editStartDateOpen, setEditStartDateOpen] = useState(false);
  const [editStartTimeOpen, setEditStartTimeOpen] = useState(false);
  const [editEndDateOpen, setEditEndDateOpen] = useState(false);
  const [editEndTimeOpen, setEditEndTimeOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  const editDates = useMemo(() => getEditDates(), []);

  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];
  const editSelectedGrill = useMemo(() => grills.find((g: any) => g.id === editGrillId) ?? null, [grills, editGrillId]);

  const onCardLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width - 32;
    if (w > 100) setCardWidth(w);
  };

  useEffect(() => {
    if (!userTempEdited && meaterProbes.length > 0 && meaterProbes[0].internalTempF != null) {
      setUserTempInput(String(meaterProbes[0].internalTempF));
    }
    if (meaterProbes.length > 0 && meaterProbes[0].internalTempF != null) {
      const currentTemp = meaterProbes[0].internalTempF;
      const startAt = cook?.actualStartAt;
      const elapsedMins = startAt
        ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
        : 0;
      setLiveReadings((prev) => [
        ...prev,
        { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
      ]);

      // Check active temperature threshold alerts for this cook
      for (const alert of activeCookAlerts) {
        if (alert.alertType === "target_reached" && !firedAlertIds.current.has(alert.id)) {
          if (currentTemp >= alert.thresholdTempF) {
            firedAlertIds.current.add(alert.id);
            const foodType = (cook as any)?.foodType ?? "meat";
            if (Platform.OS !== "web") {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: "🔥 Temperature Alert!",
                  body: alert.message || `${foodType} hit ${alert.thresholdTempF}°F`,
                  sound: true,
                },
                trigger: null,
              }).catch(() => {});
            }
            patchAlert.mutate({ id: alert.id, data: { triggered: true } }, {
              onSuccess: () => qc.invalidateQueries({ queryKey: getListAlertsQueryKey() }),
            });
          }
        }
      }
    }
  }, [meaterProbes]);

  // Reconciliation: on screen mount (and when alerts load), mark overdue timer alerts as triggered
  // Handles the case where the app was backgrounded or killed when a scheduled notification fired
  useEffect(() => {
    if (!activeCookAlerts.length || !cook) return;
    const c = cook as any;
    for (const alert of activeCookAlerts) {
      if (alert.alertType === "time_before_serve" && c.plannedEndAt) {
        const fireAt = new Date(c.plannedEndAt).getTime() - alert.thresholdTempF * 60 * 1000;
        if (fireAt <= Date.now() && !firedAlertIds.current.has(alert.id)) {
          firedAlertIds.current.add(alert.id);
          patchAlert.mutate(
            { id: alert.id, data: { triggered: true } },
            { onSuccess: () => qc.invalidateQueries({ queryKey: getListAlertsQueryKey() }) },
          );
        }
      }
    }
  }, [activeCookAlerts.length, cook]);

  const topPad = useTopInset();
  const botPad = useBottomInset();

  const saveAlert = async () => {
    setAlertSaving(true);
    try {
      const c = cook as any;
      if (alertMode === "temp") {
        const threshold = parseFloat(alertThreshold);
        if (isNaN(threshold) || threshold <= 0) {
          Alert.alert("Invalid temperature", "Enter a valid temperature threshold.");
          return;
        }
        const foodType = c?.foodType ?? "meat";
        const label = alertLabel.trim() || `${foodType} hits ${threshold}°F`;
        await createAlert.mutateAsync({
          data: {
            cookId: Number(id),
            alertType: "target_reached",
            thresholdTempF: threshold,
            message: `🔥 ${label} — time to pull!`,
          },
        });
      } else {
        const minutesBefore = parseInt(alertMinutesBefore, 10);
        if (!c?.plannedEndAt) {
          Alert.alert("No serve time set", "Set a planned serve time in Edit Cook to use a timer alert.");
          return;
        }
        const serveTime = new Date(c.plannedEndAt).getTime();
        const fireAt = serveTime - minutesBefore * 60 * 1000;
        if (fireAt <= Date.now()) {
          Alert.alert("Too late to schedule", "That serve time has already passed or the alert would fire immediately.");
          return;
        }
        const foodType = c?.foodType ?? "cook";
        const label = alertLabel.trim() || `${fmtMinutes(minutesBefore)} before ${foodType} serve time`;

        // Create DB record first to get the alert ID, then schedule with it embedded in data
        const savedAlert = await createAlert.mutateAsync({
          data: {
            cookId: Number(id),
            alertType: "time_before_serve",
            thresholdTempF: minutesBefore,
            message: label,
          },
        });

        if (Platform.OS !== "web" && savedAlert?.id) {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "⏱ Serve Time Approaching",
              body: label,
              sound: true,
              data: { alertId: savedAlert.id, cookId: Number(id) },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
          });
          // Store the notification identifier so it can be cancelled on delete
          await patchAlert.mutateAsync({ id: savedAlert.id, data: { scheduledNotificationId: notificationId } });
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListAlertsQueryKey() });
      setAlertSheetVisible(false);
      setAlertThreshold("");
      setAlertLabel("");
      setAlertMinutesBefore("30");
      setAlertMode("temp");
    } catch {
      Alert.alert("Failed to save alert", "Please try again.");
    } finally {
      setAlertSaving(false);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/cooks" as any);
  };
  const goHome = () => router.replace("/(tabs)" as any);

  const handleDelete = () => {
    Alert.alert("Delete Cook", "Remove this cook session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteCook.mutateAsync({ id: Number(id) });
            qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
            qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
            qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
            goBack();
          } catch (e: any) {
            Alert.alert("Delete Failed", e?.message ?? "Could not delete this cook. Please try again.");
          }
        },
      },
    ]);
  };

  const handleStatusUpdate = async (status: string) => {
    // Free-tier pre-check: only one active cook allowed.
    if (status === "active" && paywallUsage && !paywallUsage.unlimited) {
      if (paywallUsage.usage.activeCooks >= 1) {
        showPaywall({ trigger: "active_cook_limit_reached" });
        return;
      }
    }
    const updatePayload: any = { status };
    if (status === "active" && !(cook as any)?.actualStartAt) {
      updatePayload.actualStartAt = new Date();
    }
    if (status === "completed" && !(cook as any)?.actualEndAt) {
      updatePayload.actualEndAt = new Date();
    }
    await updateCook.mutateAsync({ id: Number(id), data: updatePayload });
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  };

  const saveRatings = async (tenderness: number, flavor: number, bark: number) => {
    if (rateSaving) return;
    setRateSaving(true);
    try {
      const nonZero = [tenderness, flavor, bark].filter(v => v > 0);
      const avg = nonZero.length > 0
        ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length)
        : null;
      await updateCook.mutateAsync({
        id: Number(id),
        data: {
          ratingTenderness: tenderness || null,
          ratingFlavor: flavor || null,
          ratingBark: bark || null,
          rating: avg,
        },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    } catch {
      Alert.alert("Save failed", "Could not save ratings. Please try again.");
    } finally {
      setRateSaving(false);
    }
  };

  const openEdit = () => {
    const c = cook as any;
    setEditFoodType(c?.foodType ?? "");
    setEditWeight(c?.weightLbs != null ? String(c.weightLbs) : "");
    setEditCookTemp(c?.cookTempF != null ? String(c.cookTempF) : "");
    setEditTargetTemp(c?.targetTempF != null ? String(c.targetTempF) : "");
    setEditGrillId(c?.grillId ?? null);
    setEditActualStartDate(c?.actualStartAt ? new Date(c.actualStartAt) : null);
    setEditActualEndDate(c?.actualEndAt ? new Date(c.actualEndAt) : null);
    setEditNotes(c?.notes ?? "");
    setEditVisible(true);
  };

  const saveEdit = async () => {
    if (!editFoodType.trim()) {
      Alert.alert("Food type required", "Enter what you cooked.");
      return;
    }
    setEditSaving(true);
    try {
      const payload: any = { foodType: editFoodType.trim(), notes: editNotes.trim() || null };
      payload.grillId = editGrillId ?? null;
      if (editWeight.trim() && !isNaN(parseFloat(editWeight))) payload.weightLbs = parseFloat(editWeight);
      else payload.weightLbs = null;
      if (editCookTemp.trim() && !isNaN(parseFloat(editCookTemp))) payload.cookTempF = parseFloat(editCookTemp);
      else payload.cookTempF = null;
      if (editTargetTemp.trim() && !isNaN(parseFloat(editTargetTemp))) payload.targetTempF = parseFloat(editTargetTemp);
      else payload.targetTempF = null;
      payload.actualStartAt = editActualStartDate ? editActualStartDate.toISOString() : null;
      payload.actualEndAt = editActualEndDate ? editActualEndDate.toISOString() : null;
      await updateCook.mutateAsync({ id: Number(id), data: payload });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setEditVisible(false);
    } catch {
      Alert.alert("Save failed", "Could not save changes. Please try again.");
    } finally {
      setEditSaving(false);
    }
  };

  const pickImages = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled) {
      const picked = res.assets
        .filter((a) => a.base64)
        .map((a) => ({ uri: a.uri, base64: a.base64!, mimeType: (a.mimeType as string) || "image/jpeg" }))
        .slice(0, 5);
      setImages((prev) => [...prev, ...picked].slice(0, 5));
      setResult(null);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access to take photos"); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0].base64) {
      setImages((prev) => [...prev, {
        uri: res.assets[0].uri,
        base64: res.assets[0].base64!,
        mimeType: (res.assets[0].mimeType as string) || "image/jpeg",
      }].slice(0, 5));
      setResult(null);
    }
  };

  const removeImage = (idx: number) => { setImages((p) => p.filter((_, i) => i !== idx)); setResult(null); };

  const analyze = async () => {
    const hasTemp = userTempInput.trim().length > 0 && !isNaN(parseFloat(userTempInput));
    if (images.length === 0 && !cookNotes.trim() && !hasTemp) {
      if (cookStatus === "active") {
        Alert.alert("Nothing to check in with", "Enter your current probe temperature or add a note about what's happening on the cook.");
      } else {
        Alert.alert("Add something", "Upload a thermometer image, enter your temperature reading, or add cook notes before analyzing.");
      }
      return;
    }
    // Free-tier pre-check: only one graded cook allowed.
    // Skip only if this exact cook already has a stored verdict — re-grading the
    // same cook is allowed (mirrors the server's excludeCookId exclusion logic).
    const currentCookHasVerdict = !!(cook as any)?.analysisResult?.assessment?.verdict;
    if (!currentCookHasVerdict && paywallUsage && !paywallUsage.unlimited) {
      if (paywallUsage.usage.gradedCooks >= 1) {
        showPaywall({ trigger: "graded_cook_limit_reached" });
        return;
      }
    }
    setAnalyzing(true);
    setResult(null);
    try {
      const c = cook as any;
      const data: any = await analyzeMutation.mutateAsync({
        data: {
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          cookNotes: cookNotes.trim() || null,
          cookContext: {
            foodType: c?.foodType,
            targetTempF: c?.targetTempF,
            cookTempF: c?.cookTempF,
            weightLbs: c?.weightLbs,
            wrapMethod: c?.wrapMethod ?? null,
            wrapAtMinutes: c?.wrapAtMinutes ?? null,
            wrapTempF: c?.wrapTempF ?? null,
            wrapReason: c?.wrapReason ?? null,
            restMinutes: c?.restMinutes ?? null,
            preheatMinutes: c?.preheatMinutes ?? null,
            actualStartAt: c?.actualStartAt ? new Date(c.actualStartAt).toISOString() : null,
            plannedStartAt: c?.plannedStartAt ? new Date(c.plannedStartAt).toISOString() : null,
            plannedEndAt: c?.plannedEndAt ? new Date(c.plannedEndAt).toISOString() : null,
            userEnteredTempF: userTempInput.trim() && !isNaN(parseFloat(userTempInput)) ? parseFloat(userTempInput) : null,
            // Live probe data for phase detection (active cooks only)
            liveReadings: liveReadings.length >= 2 ? liveReadings : null,
            elapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            currentPitTempF: (pitTempInput.trim() && !isNaN(parseFloat(pitTempInput))) ? parseFloat(pitTempInput) : (meaterProbes[0]?.ambientTempF ?? null),
            outdoorTempF: weather.tempF ?? null,
            cookStatus: c?.status ?? null,
          },
        } as any,
      });
      setResult(data);
      // Save full analysis result to the cook record (backend also appends to analysisHistory)
      await updateCook.mutateAsync({
        id: Number(id),
        data: {
          analysisResult: {
            probes: data.probes,
            events: data.events,
            cookDurationMinutes: data.cookDurationMinutes,
            detectedFoodType: data.detectedFoodType,
            noDataFound: data.noDataFound,
            rawExtraction: data.rawExtraction,
            assessment: data.assessment,
            phasePrediction: data.phasePrediction ?? null,
            decisions: data.decisions ?? [],
            // Snapshot context so history is self-contained
            snapshotTempF: userTempInput.trim() && !isNaN(parseFloat(userTempInput)) ? parseFloat(userTempInput) : null,
            snapshotNotes: cookNotes.trim() || null,
            snapshotElapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            analyzedAt: new Date().toISOString(),
          },
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      // Free user hit the daily AI scan cap → upgrade modal.
      if (parseAndShowFromError(e)) return;
      Alert.alert("Analysis failed", "Could not analyze the cook. Please check your connection and try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <LogoBackground opacity={0.04} />
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!cook) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <LogoBackground opacity={0.04} />
        <Text style={{ color: colors.mutedForeground }}>Cook not found</Text>
        <Pressable onPress={goBack} style={s.goBackBtn}>
          <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const c = cook as any;
  const statusColor = STATUS_COLORS[c.status] || colors.primary;
  const nextStatus = c.status === "planned" ? "active" : c.status === "active" ? "completed" : null;
  const assessment = result?.assessment as Assessment | null | undefined;
  const verdictCfg = assessment ? (VERDICT_CONFIG[assessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;

  // Live timer computed values
  const elapsedMs = c.actualStartAt ? nowMs - new Date(c.actualStartAt).getTime() : 0;
  const remainingMs = c.plannedEndAt ? new Date(c.plannedEndAt).getTime() - nowMs : null;

  // Live graph from accumulated MEATER readings
  const liveGraphProbes = liveReadings.length >= 2
    ? [{ probeName: meaterProbes[0]?.deviceName ?? "Probe 1", timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1].tempF }]
    : [];

  // Stored analysis from DB
  const storedAnalysis = c.analysisResult as AnalysisResult | null | undefined;
  const storedAssessment = storedAnalysis?.assessment ?? null;
  const storedVerdictCfg = storedAssessment ? (VERDICT_CONFIG[storedAssessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;
  const storedGraphProbes = (storedAnalysis?.probes ?? []).filter((p: any) => p.timeSeries && p.timeSeries.length >= 2);

  // ── Decision engine renderer ──────────────────────────────────────────────
  const ACTION_CONFIG: Record<string, { icon: string; label: string }> = {
    wrap:              { icon: "package",       label: "Wrap Now"         },
    spritz:            { icon: "cloud-drizzle", label: "Spritz"           },
    increase_pit:      { icon: "trending-up",   label: "Raise Pit Temp"   },
    decrease_pit:      { icon: "trending-down", label: "Lower Pit Temp"   },
    pull:              { icon: "scissors",      label: "Pull Time"        },
    recover_schedule:  { icon: "alert-triangle",label: "Recover Schedule" },
    maintain:          { icon: "check-circle",  label: "Hold Steady"      },
  };
  const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
    now:        { label: "NOW",        color: "#EF4444" },
    soon:       { label: "SOON",       color: "#F59E0B" },
    when_ready: { label: "WHEN READY", color: "#6C3BF5" },
  };

  const renderDecisions = (decisions: Decision[]) => {
    if (!decisions || decisions.length === 0) return null;
    return (
      <View style={[s.decisionsSection, { borderColor: colors.border }]}>
        <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Decisions</Text>
        {decisions.map((d, i) => {
          const actionCfg = ACTION_CONFIG[d.action] ?? { icon: "zap", label: d.action };
          const urgencyCfg = URGENCY_CONFIG[d.urgency] ?? { label: d.urgency.toUpperCase(), color: "#6B7280" };
          const isMaintain = d.action === "maintain";
          const cardColor = isMaintain ? "#22c55e" : urgencyCfg.color;
          return (
            <View
              key={i}
              style={[
                s.decisionCard,
                { backgroundColor: cardColor + "12", borderColor: cardColor + "35", borderRadius: colors.radius },
              ]}
            >
              <View style={s.decisionHeader}>
                <View style={[s.decisionActionChip, { backgroundColor: cardColor + "22", borderColor: cardColor + "45" }]}>
                  <Feather name={actionCfg.icon as any} size={12} color={cardColor} />
                  <Text style={[s.decisionActionText, { color: cardColor }]}>{actionCfg.label}</Text>
                </View>
                {!isMaintain && (
                  <View style={[s.decisionUrgencyBadge, { backgroundColor: urgencyCfg.color }]}>
                    <Text style={s.decisionUrgencyText}>{urgencyCfg.label}</Text>
                  </View>
                )}
              </View>
              <Text style={[s.decisionInstruction, { color: colors.foreground }]}>{d.instruction}</Text>
              {d.rationale ? (
                <Text style={[s.decisionRationale, { color: colors.mutedForeground }]}>{d.rationale}</Text>
              ) : null}
            </View>
          );
        })}
      </View>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <LinearGradient
        colors={["#1C1C1F", "#2D1A0E"]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={[s.header, { paddingTop: topPad + 14 }]}
      >
        <LogoBackground opacity={0.06} />
        <Pressable onPress={goBack} style={s.backBtn}>
          <Feather name="chevron-left" size={24} color="#F3EDE1" />
        </Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{c.foodType || "Cook"}</Text>
        <View style={s.headerRight}>
          <Pressable onPress={openEdit} style={s.editBtn} hitSlop={8}>
            <Feather name="edit-2" size={17} color="#F3EDE1" />
          </Pressable>
          <Pressable onPress={handleDelete} style={s.delBtn}>
            <Feather name="trash-2" size={18} color="#ef4444" />
          </Pressable>
          <Pressable onPress={goHome} hitSlop={8}>
            <Image source={logoImg} style={s.headerLogo} resizeMode="contain" />
          </Pressable>
        </View>
      </LinearGradient>
      <View style={s.fireBar} />

      {/* ── Step-change toast banner ─────────────────────────────────────── */}
      {stepToast !== null && (
        <Pressable onPress={dismissStepToast} style={s.stepToastHitArea}>
          <Animated.View
            style={[
              s.stepToast,
              {
                backgroundColor: colors.primary,
                opacity: stepToastAnim,
                transform: [
                  {
                    translateY: stepToastAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-12, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Feather name="clock" size={14} color="#fff" />
            <Text style={s.stepToastLabel}>Next Up</Text>
            <Text style={s.stepToastText} numberOfLines={1}>{stepToast}</Text>
          </Animated.View>
        </Pressable>
      )}

      <ScrollView
        ref={scheduleScrollViewRef}
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Status */}
        <View style={[s.statusBar, { backgroundColor: statusColor + "18", borderRadius: colors.radius }]}>
          <View style={[s.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[s.statusText, { color: statusColor }]}>{c.status?.toUpperCase()}</Text>
          {(c.ratingTenderness || c.ratingBark || c.ratingFlavor) ? (
            <View style={s.ratingsSummary}>
              {[
                { label: "T", val: c.ratingTenderness },
                { label: "F", val: c.ratingFlavor },
                { label: "B", val: c.ratingBark },
              ].filter(r => r.val).map((r, i) => (
                <View key={i} style={s.ratingsSummaryChip}>
                  <Text style={[s.ratingsSummaryLabel, { color: colors.mutedForeground }]}>{r.label}</Text>
                  <Text style={[s.ratingsSummaryStars, { color: "#eab308" }]}>{"★".repeat(r.val!)}{"☆".repeat(5 - r.val!)}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>

        {/* ── Live Cook section (active cooks only) ──────────── */}
        {c.status === "active" && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: "#FF6B2B40", borderRadius: colors.radius }]}>
            {/* Header */}
            <View style={[s.logHeader, { padding: 14 }]}>
              <View style={[s.logIconWrap, { backgroundColor: "#FF6B2B" }]}>
                <Feather name="activity" size={15} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.logTitle, { color: colors.foreground }]}>Live Cook</Text>
                <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                  {meaterLinked === true && meaterProbes.length > 0
                    ? "Live probe · auto-updating every 15s"
                    : meaterLinked === true
                    ? "MEATER linked · no active probe detected"
                    : "Timer running · link MEATER for live temps"}
                </Text>
              </View>
              <View style={[s.connectedBadgeSmall, { backgroundColor: "#FF6B2B18" }]}>
                <View style={[s.liveIndicator, { backgroundColor: "#FF6B2B" }]} />
                <Text style={[s.liveText, { color: "#FF6B2B" }]}>LIVE</Text>
              </View>
            </View>

            {/* Timer chips */}
            <View style={[s.timerRow, { borderTopColor: colors.border }]}>
              <View style={[s.timerChip, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
                <Feather name="clock" size={13} color={colors.primary} />
                <View>
                  <Text style={[s.timerValue, { color: colors.primary }]}>
                    {c.actualStartAt ? fmtElapsed(elapsedMs) : "—"}
                  </Text>
                  <Text style={[s.timerLabel, { color: colors.mutedForeground }]}>Elapsed</Text>
                </View>
              </View>
              {c.plannedEndAt && (
                <View style={[
                  s.timerChip,
                  remainingMs !== null && remainingMs < 0
                    ? { backgroundColor: "#ef444418", borderColor: "#ef444430" }
                    : { backgroundColor: "#22c55e18", borderColor: "#22c55e30" },
                ]}>
                  <Feather
                    name="flag"
                    size={13}
                    color={remainingMs !== null && remainingMs < 0 ? "#ef4444" : "#22c55e"}
                  />
                  <View>
                    <Text style={[
                      s.timerValue,
                      { color: remainingMs !== null && remainingMs < 0 ? "#ef4444" : "#22c55e" },
                    ]}>
                      {remainingMs !== null
                        ? remainingMs < 0
                          ? `+${fmtElapsed(-remainingMs)} over`
                          : fmtElapsed(remainingMs)
                        : "—"}
                    </Text>
                    <Text style={[s.timerLabel, { color: colors.mutedForeground }]}>Until serve</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Outdoor temperature strip */}
            {!weather.locationDenied && (
              <View style={[s.weatherStrip, { borderTopColor: colors.border, borderBottomColor: colors.border, flexDirection: "column", alignItems: "flex-start", gap: 4 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                  <Feather
                    name={weatherIcon(weather.conditionCode) as any}
                    size={14}
                    color={colors.mutedForeground}
                  />
                  {weather.loading ? (
                    <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
                      Fetching outdoor temp…
                    </Text>
                  ) : weather.error ? (
                    <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
                      Outdoor temp unavailable
                    </Text>
                  ) : weather.tempF != null ? (
                    <>
                      <Text style={[s.weatherTemp, { color: colors.foreground }]}>
                        {weather.tempF}°F outdoors
                      </Text>
                      {weatherDescription(weather.conditionCode) && (
                        <Text style={[s.weatherCondition, { color: colors.mutedForeground }]}>
                          · {weatherDescription(weather.conditionCode)}
                        </Text>
                      )}
                    </>
                  ) : null}
                </View>
                {getOutdoorTempEffect(weather.tempF) && (
                  <Text style={[s.weatherText, { color: colors.mutedForeground, fontStyle: "italic" }]}>
                    {getOutdoorTempEffect(weather.tempF)}
                  </Text>
                )}
              </View>
            )}

            {/* Live graph (when we have ≥ 2 readings) */}
            {liveGraphProbes.length > 0 && (
              <View style={[s.liveGraphWrap, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Live Temperature</Text>
                <TempGraph
                  probes={liveGraphProbes}
                  events={[]}
                  targetTempF={c.targetTempF ?? null}
                  width={cardWidth}
                  height={160}
                />
              </View>
            )}

            {/* Collecting readings placeholder (MEATER linked but < 2 readings yet) */}
            {meaterLinked === true && meaterProbes.length > 0 && liveReadings.length < 2 && (
              <View style={[s.liveGraphWrap, { borderTopColor: colors.border }]}>
                <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground, textAlign: "left" }]}>
                  📡 Collecting readings — chart will appear shortly
                </Text>
              </View>
            )}

            {/* MEATER probe readings (when linked and active) */}
            {meaterLinked === true && meaterProbes.map((probe, i) => (
              <View key={probe.deviceId + i} style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12 }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                  {probe.deviceName}{probe.cookName ? ` · ${probe.cookName}` : ""}
                </Text>
                <View style={s.meaterTempsRow}>
                  <View style={s.meaterTempChip}>
                    <Feather name="thermometer" size={14} color="#FF6B2B" />
                    <View>
                      <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                        {probe.internalTempF != null ? `${probe.internalTempF}°F` : "—"}
                      </Text>
                      <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Internal</Text>
                    </View>
                  </View>
                  <View style={s.meaterTempChip}>
                    <Feather name="wind" size={14} color="#3b82f6" />
                    <View>
                      <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                        {probe.ambientTempF != null ? `${probe.ambientTempF}°F` : "—"}
                      </Text>
                      <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Ambient</Text>
                    </View>
                  </View>
                  {(probe.targetMinTempF != null || probe.targetMaxTempF != null) && (
                    <View style={s.meaterTempChip}>
                      <Feather name="target" size={14} color="#22c55e" />
                      <View>
                        <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                          {probe.targetMinTempF}–{probe.targetMaxTempF}°F
                        </Text>
                        <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Target</Text>
                      </View>
                    </View>
                  )}
                </View>
                {!userTempEdited && probe.internalTempF != null && (
                  <View style={[s.meaterAutoFillBadge, { backgroundColor: "#FF6B2B15", marginTop: 8 }]}>
                    <Feather name="zap" size={11} color="#FF6B2B" />
                    <Text style={[s.meaterAutoFillText, { color: "#FF6B2B" }]}>
                      Auto-filling temperature input with {probe.internalTempF}°F
                    </Text>
                  </View>
                )}
              </View>
            ))}

            {/* ThermoWorks probe readings (when linked and active) */}
            {thermoworksLinked === true && thermoworksProbes.map((probe, i) => (
              <View
                key={`tw-${probe.deviceId}-${probe.channelNumber}-${i}`}
                style={[s.subSection, { borderTopColor: colors.border, paddingHorizontal: 14, paddingBottom: 12 }]}
              >
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>
                  {probe.deviceName}
                  {probe.channelLabel ? ` · ${probe.channelLabel}` : ` · Ch ${probe.channelNumber}`}
                  {"  ·  ThermoWorks"}
                </Text>
                <View style={s.meaterTempsRow}>
                  <View style={s.meaterTempChip}>
                    <Feather name="thermometer" size={14} color="#B22222" />
                    <View>
                      <Text style={[s.meaterTempValue, { color: colors.foreground }]}>
                        {probe.tempF != null ? `${probe.tempF}°F` : "—"}
                      </Text>
                      <Text style={[s.meaterTempLabel, { color: colors.mutedForeground }]}>Temperature</Text>
                    </View>
                  </View>
                </View>
              </View>
            ))}

            {/* No-thermometer placeholder (only when neither MEATER nor ThermoWorks is linked) */}
            {meaterLinked !== true && thermoworksLinked !== true && (
              <View style={[s.meaterPlaceholder, { borderTopColor: colors.border }]}>
                <Feather name="thermometer" size={20} color={colors.mutedForeground} />
                <Text style={[s.meaterPlaceholderText, { color: colors.mutedForeground }]}>
                  Link MEATER or ThermoWorks in Profile to see live probe data here.
                </Text>
              </View>
            )}

            {/* Set Alert button */}
            <View style={[s.alertBtnRow, { borderTopColor: colors.border }]}>
              <Pressable
                style={[s.setAlertBtn, { backgroundColor: "#EF444412", borderColor: "#EF444430", borderRadius: colors.radius }]}
                onPress={() => { setAlertSheetVisible(true); setAlertMode("temp"); }}
              >
                <Feather name="bell"  size={14} color="#EF4444" />
                <Text style={[s.setAlertBtnText, { color: "#EF4444" }]}>Set Alert</Text>
                {activeCookAlerts.length > 0 && (
                  <View style={[s.alertCountBadge, { backgroundColor: "#EF4444" }]}>
                    <Text style={s.alertCountText}>{activeCookAlerts.length}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ── Last Decision Banner (active cooks only) ─────── */}
        {c.status === "active" && (() => {
          const stored = c.analysisResult as any;
          const decisions: any[] = stored?.decisions ?? [];
          if (decisions.length === 0) return null;
          const top = decisions[0];
          const URGENCY_COLORS: Record<string, string> = {
            now: "#EF4444",
            soon: "#F59E0B",
            when_ready: "#6C3BF5",
          };
          const color = top.action === "maintain" ? "#22c55e" : (URGENCY_COLORS[top.urgency] ?? "#6C3BF5");
          const urgencyLabel = top.action === "maintain"
            ? "HOLD STEADY"
            : (top.urgency === "now" ? "ACTION NEEDED" : top.urgency === "soon" ? "DO THIS SOON" : "WHEN READY");
          return (
            <View style={[s.persistentDecisionBanner, { backgroundColor: color + "12", borderColor: color + "45" }]}>
              <View style={s.persistentDecisionHeader}>
                <View style={[s.persistentUrgencyBadge, { backgroundColor: color }]}>
                  <Text style={s.persistentUrgencyText}>{urgencyLabel}</Text>
                </View>
                <Text style={[s.persistentDecisionLabel, { color: colors.mutedForeground }]}>
                  Last PitMaster guidance
                </Text>
              </View>
              <Text style={[s.persistentDecisionInstruction, { color: colors.foreground }]}>
                {top.instruction}
              </Text>
              {top.rationale ? (
                <Text style={[s.persistentDecisionRationale, { color: colors.mutedForeground }]}>
                  {top.rationale}
                </Text>
              ) : null}
            </View>
          );
        })()}

        {/* ── COOK SUMMARY CARD (plan + actual + grade) ─────────── */}
        {(() => {
          const wrapStr = (() => {
            const parts: string[] = [];
            if (c.wrapMethod === "foil") parts.push("Foil (Texas Crutch)");
            else if (c.wrapMethod === "butcher_paper") parts.push("Butcher Paper");
            else if (c.wrapMethod === "none") parts.push("No wrap");
            if (c.wrapAtMinutes) parts.push(`at ${Math.floor(c.wrapAtMinutes / 60)}h ${c.wrapAtMinutes % 60}m`);
            if (c.wrapTempF) parts.push(`${c.wrapTempF}°F internal`);
            return parts.length ? parts.join(" · ") : null;
          })();
          const plannedDurMs = c.plannedStartAt && c.plannedEndAt
            ? new Date(c.plannedEndAt).getTime() - new Date(c.plannedStartAt).getTime()
            : null;
          const actualDurMs = c.actualStartAt && c.actualEndAt
            ? new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()
            : c.actualStartAt && cookStatus === "active" ? nowMs - new Date(c.actualStartAt).getTime() : null;
          const planGrade = cookStatus === "completed" ? computePlanGrade(c) : null;

          // Compact stat tiles — max 4 key facts
          const statTiles: { icon: string; label: string; value: string; sub?: string }[] = [];
          if (c.targetTempF) statTiles.push({ icon: "thermometer", label: "Target", value: `${c.targetTempF}°F` });
          if (c.cookTempF) statTiles.push({ icon: "wind", label: "Pit Temp", value: `${c.cookTempF}°F` });
          if (plannedDurMs) statTiles.push({ icon: "clock", label: "Planned", value: fmtDuration(plannedDurMs) });
          if (actualDurMs) statTiles.push({
            icon: cookStatus === "active" ? "loader" : "check-circle",
            label: cookStatus === "active" ? "Elapsed" : "Actual",
            value: fmtDuration(actualDurMs),
          });
          if (!statTiles.length && c.weightLbs) statTiles.push({ icon: "package", label: "Weight", value: `${c.weightLbs} lbs` });

          // Full detail rows — plan section
          const planDetailRows = [
            { label: "Food", value: c.foodType },
            { label: "Grill", value: (c as any).grillName },
            { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
            { label: "Target Temp", value: c.targetTempF ? `${c.targetTempF}°F` : null },
            { label: "Pit Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
            { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
            { label: "Planned Duration", value: plannedDurMs ? fmtDuration(plannedDurMs) : null },
            { label: "Preheat", value: c.preheatMinutes ? fmtMinutes(c.preheatMinutes) : null },
            { label: "Wrap", value: wrapStr },
            { label: "Wrap Notes", value: c.wrapReason ?? null },
            { label: "Rest", value: c.restMinutes ? fmtMinutes(c.restMinutes) : null },
          ].filter((r) => r.value);

          // Full detail rows — actual section
          const actualDetailRows = (cookStatus === "active" || cookStatus === "completed") ? [
            { label: "Started", value: c.actualStartAt ? formatDT(c.actualStartAt) : null },
            { label: "Finished", value: c.actualEndAt ? formatDT(c.actualEndAt) : null },
            { label: "Actual Duration", value: actualDurMs ? fmtDuration(actualDurMs) : null },
          ].filter((r) => r.value) : [];

          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>

              {/* ── Compact summary: stat tiles ── */}
              {statTiles.length > 0 && (
                <View style={[s.statTileRow, { borderBottomColor: colors.border }]}>
                  {statTiles.map((tile, i) => (
                    <View
                      key={tile.label}
                      style={[
                        s.statTile,
                        i < statTiles.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border },
                      ]}
                    >
                      <Feather name={tile.icon as any} size={14} color={colors.mutedForeground} style={{ marginBottom: 4 }} />
                      <Text style={[s.statTileValue, { color: colors.foreground }]}>{tile.value}</Text>
                      <Text style={[s.statTileLabel, { color: colors.mutedForeground }]}>{tile.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* ── Plan accuracy grade inline ── */}
              {planGrade && (
                <View style={[s.inlineGradeRow, { borderBottomColor: colors.border }]}>
                  <View style={[s.inlineGradeBadge, { backgroundColor: planGrade.color + "18", borderColor: planGrade.color + "40" }]}>
                    <Text style={[s.inlineGradeLetter, { color: planGrade.color }]}>{planGrade.grade}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.inlineGradeTitle, { color: colors.foreground }]}>Plan Accuracy · {planGrade.accuracy}%</Text>
                    <Text style={[s.inlineGradeSub, { color: colors.mutedForeground }]}>{planGrade.deviation}</Text>
                  </View>
                  <View style={[s.gradeBarTrackSmall, { backgroundColor: colors.border, width: 52 }]}>
                    <View style={[s.gradeBarFill, { width: `${planGrade.accuracy}%` as any, backgroundColor: planGrade.color }]} />
                  </View>
                </View>
              )}

              {/* ── Full details (collapsible) ── */}
              {showCookDetails && (
                <>
                  {planDetailRows.length > 0 && (
                    <>
                      <View style={[s.sectionHeaderRow, { borderBottomColor: colors.border, borderTopWidth: planGrade || statTiles.length ? 0 : 0 }]}>
                        <View style={[s.sectionIconWrap, { backgroundColor: "#3b82f618" }]}>
                          <Feather name="clipboard" size={13} color="#3b82f6" />
                        </View>
                        <Text style={[s.sectionHeaderLabel, { color: "#3b82f6" }]}>The Plan</Text>
                      </View>
                      {planDetailRows.map((row, i) => (
                        <View key={row.label} style={[s.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                          <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
                        </View>
                      ))}
                      {c.notes && (
                        <View style={[s.row, { flexDirection: "column", alignItems: "flex-start", gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>Notes</Text>
                          <Text style={[s.notesText, { color: colors.foreground }]}>{c.notes}</Text>
                        </View>
                      )}
                    </>
                  )}
                  {actualDetailRows.length > 0 && (
                    <>
                      <View style={[s.sectionHeaderRow, { borderBottomColor: colors.border }]}>
                        <View style={[s.sectionIconWrap, { backgroundColor: "#22c55e18" }]}>
                          <Feather name="bar-chart-2" size={13} color="#22c55e" />
                        </View>
                        <Text style={[s.sectionHeaderLabel, { color: "#22c55e" }]}>How It Went</Text>
                      </View>
                      {actualDetailRows.map((row, i) => (
                        <View key={row.label} style={[s.row, i < actualDetailRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                          <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                          <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
                        </View>
                      ))}
                    </>
                  )}
                </>
              )}

              {/* ── Toggle button ── */}
              <Pressable
                onPress={() => setShowCookDetails((v) => !v)}
                style={[s.detailsToggle, { borderTopColor: colors.border }]}
              >
                <Text style={[s.detailsToggleText, { color: colors.primary }]}>
                  {showCookDetails ? "Hide details" : "View full details"}
                </Text>
                <Feather name={showCookDetails ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
              </Pressable>
            </View>
          );
        })()}

        {/* ── Session Schedule ──────────────────────────────── */}
        {(() => {
          const seqData = (c.sequenceData as { schedule: any[]; serveAt: string; summary?: string | null } | null | undefined);
          if (!seqData?.schedule?.length) return null;
          const cookFoodType = (c.foodType ?? "").toLowerCase().trim();
          const cookMeatOnMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
          let currentIdx = -1;
          if (cookMeatOnMs !== null) {
            let bestDelta = Infinity;
            seqData.schedule.forEach((item: any, idx: number) => {
              if ((item.foodType ?? "").toLowerCase().trim() !== cookFoodType) return;
              const itemMs = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
              if (itemMs === null) return;
              const delta = Math.abs(itemMs - cookMeatOnMs);
              if (delta < bestDelta) { bestDelta = delta; currentIdx = idx; }
            });
          }
          if (currentIdx === -1) {
            currentIdx = seqData.schedule.findIndex(
              (item: any) => (item.foodType ?? "").toLowerCase().trim() === cookFoodType
            );
          }

          // nextStep is computed once at the component level (see useMemo above)

          return (
            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
              <Pressable
                onPress={() => setSeqScheduleExpanded((v) => !v)}
                style={[s.seqScheduleHeader, { borderBottomWidth: seqScheduleExpanded ? 1 : 0, borderBottomColor: colors.border }]}
              >
                <LinearGradient colors={["#4f46e5", "#6C3BF5"]} style={s.seqScheduleIcon}>
                  <Feather name="list" size={14} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.seqScheduleTitle, { color: colors.foreground }]}>Session Schedule</Text>
                  {seqData.serveAt ? (
                    <Text style={[s.seqScheduleSub, { color: colors.mutedForeground }]}>
                      Serve by {new Date(seqData.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      {" · "}{seqData.schedule.length} item{seqData.schedule.length !== 1 ? "s" : ""}
                    </Text>
                  ) : null}
                </View>
                <Feather name={seqScheduleExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </Pressable>

              {seqScheduleExpanded && (
                <View
                  style={{ padding: 12, gap: 10 }}
                  onLayout={(e) => { scheduleListYRef.current = e.nativeEvent.layout.y; }}
                >
                  {seqData.schedule.map((item: any, idx: number) => {
                    const isCurrent = idx === currentIdx;
                    return (
                      <View
                        key={idx}
                        onLayout={(e) => { itemYRef.current[idx] = e.nativeEvent.layout.y; }}
                        style={[
                          s.seqScheduleItem,
                          {
                            borderColor: isCurrent ? "#6C3BF555" : colors.border,
                            backgroundColor: isCurrent ? "#6C3BF508" : colors.background,
                          },
                        ]}
                      >
                        <View style={s.seqScheduleItemHeader}>
                          <LinearGradient
                            colors={isCurrent ? ["#4f46e5", "#6C3BF5"] : ["#3A3A3E", "#52525B"]}
                            style={s.seqScheduleItemIcon}
                          >
                            <Feather name="layers" size={12} color="#fff" />
                          </LinearGradient>
                          <Text style={[s.seqScheduleItemTitle, { color: colors.foreground }]}>{item.foodType}</Text>
                          {isCurrent && (
                            <View style={s.seqScheduleCurrentBadge}>
                              <Text style={s.seqScheduleCurrentText}>YOU ARE HERE</Text>
                            </View>
                          )}
                        </View>
                        <View
                          style={{ paddingLeft: 4 }}
                          onLayout={(e) => { timelineYRef.current[idx] = e.nativeEvent.layout.y; }}
                        >
                          {(() => {
                            const isNextGrillLight = nextStep?.itemIdx === idx && nextStep?.step === "grillLight";
                            const isNextMeatOn = nextStep?.itemIdx === idx && nextStep?.step === "meatOn";
                            const isNextPullOff = nextStep?.itemIdx === idx && nextStep?.step === "pullOff";
                            const isNextServe = nextStep?.itemIdx === idx && nextStep?.step === "serve";
                            const isDoneGrillLight = cookStatus === "active" && new Date(item.grillLightAt).getTime() < nowMs;
                            const isDoneMeatOn = cookStatus === "active" && new Date(item.meatOnAt).getTime() < nowMs;
                            const isDonePullOff = cookStatus === "active" && new Date(item.estimatedFinishAt).getTime() < nowMs;
                            const serveMs = new Date(item.estimatedFinishAt).getTime() + item.restMinutes * 60000;
                            const isDoneServe = cookStatus === "active" && serveMs < nowMs;
                            return (
                              <>
                                <View onLayout={(e) => { rowYRef.current[`${idx}:grillLight`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextGrillLight && s.seqTlNextRow, isDoneGrillLight && !confirmedSteps[`${idx}_grillLight`] && s.seqTlDoneRow]}>
                                  {isDoneGrillLight ? (
                                    <Pressable onPress={() => toggleConfirmedStep(`${idx}_grillLight`)} hitSlop={8} style={s.seqTlDotBtn}>
                                      {confirmedSteps[`${idx}_grillLight`]
                                        ? <Feather name="check-circle" size={14} color="#f59e0b" />
                                        : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                    </Pressable>
                                  ) : (
                                    <View style={[s.seqTlDot, { backgroundColor: "#f59e0b" }]} />
                                  )}
                                  <View style={s.seqTlConnector} />
                                  <View style={{ flex: 1 }}>
                                    <View style={s.seqTlLabelRow}>
                                      <Text style={[s.seqTlLabel, { color: isNextGrillLight ? "#f59e0b" : colors.mutedForeground }, isDoneGrillLight && s.seqTlDoneLabel]}>Light grill</Text>
                                      {isNextGrillLight && (
                                        <View style={[s.seqTlNextBadge, { backgroundColor: "#f59e0b25" }]}>
                                          <Text style={[s.seqTlNextText, { color: "#f59e0b" }]}>NEXT</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={[s.seqTlTime, { color: isDoneGrillLight ? colors.mutedForeground : colors.foreground, opacity: isDoneGrillLight ? 0.55 : 1 }]}>
                                      {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      {cookStatus === "active" && !isDoneGrillLight && (
                                        <Text style={[s.seqTlMeta, { color: "#f59e0b" }]}>
                                          {" "}· {relCountdown(new Date(item.grillLightAt).getTime(), nowMs)}
                                        </Text>
                                      )}
                                      <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                        {" "}· {fmtMinutes(item.preheatMinutes)} preheat
                                      </Text>
                                    </Text>
                                  </View>
                                </View>
                                <View onLayout={(e) => { rowYRef.current[`${idx}:meatOn`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextMeatOn && s.seqTlNextRow, isDoneMeatOn && !confirmedSteps[`${idx}_meatOn`] && s.seqTlDoneRow]}>
                                  {isDoneMeatOn ? (
                                    <Pressable onPress={() => toggleConfirmedStep(`${idx}_meatOn`)} hitSlop={8} style={s.seqTlDotBtn}>
                                      {confirmedSteps[`${idx}_meatOn`]
                                        ? <Feather name="check-circle" size={14} color="#EB6C2B" />
                                        : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                    </Pressable>
                                  ) : (
                                    <View style={[s.seqTlDot, { backgroundColor: "#EB6C2B" }]} />
                                  )}
                                  <View style={s.seqTlConnector} />
                                  <View style={{ flex: 1 }}>
                                    <View style={s.seqTlLabelRow}>
                                      <Text style={[s.seqTlLabel, { color: isNextMeatOn ? "#EB6C2B" : colors.mutedForeground }, isDoneMeatOn && s.seqTlDoneLabel]}>Meat on</Text>
                                      {isNextMeatOn && (
                                        <View style={[s.seqTlNextBadge, { backgroundColor: "#EB6C2B25" }]}>
                                          <Text style={[s.seqTlNextText, { color: "#EB6C2B" }]}>NEXT</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={[s.seqTlTime, { color: isDoneMeatOn ? colors.mutedForeground : colors.foreground, opacity: isDoneMeatOn ? 0.55 : 1 }]}>
                                      {new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      {cookStatus === "active" && !isDoneMeatOn && (
                                        <Text style={[s.seqTlMeta, { color: "#EB6C2B" }]}>
                                          {" "}· {relCountdown(new Date(item.meatOnAt).getTime(), nowMs)}
                                        </Text>
                                      )}
                                      <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                        {" "}·{" "}
                                        {fmtMinutes(item.estimatedDurationMinutes)}{" "}cook
                                      </Text>
                                    </Text>
                                  </View>
                                </View>
                                {/* Wrap step — always kept in tree (display:none when n/a) to avoid stale refs.
                                    Renders whenever a wrap method is set; if the AI omitted the exact
                                    wrapAtMinutes, we infer it at ~55% of the active cook (mid-stall). */}
                                {item.wrapMethod && item.wrapMethod !== "none" ? (() => {
                                  const explicitWrapMin = (item.wrapAtMinutes ?? 0) > 0
                                    ? Math.round(item.wrapAtMinutes)
                                    : null;
                                  const cookMin = typeof item.estimatedDurationMinutes === "number" && item.estimatedDurationMinutes > 0
                                    ? item.estimatedDurationMinutes
                                    : null;
                                  const inferredWrapMin = cookMin != null
                                    ? Math.max(30, Math.round(cookMin * 0.55))
                                    : null;
                                  const wrapAtMin = explicitWrapMin ?? inferredWrapMin;
                                  if (wrapAtMin == null) return null;
                                  const wrapInferred = explicitWrapMin === null;
                                  const wrapMs = new Date(item.meatOnAt).getTime() + wrapAtMin * 60000;
                                  const isDoneWrap = cookStatus === "active" && wrapMs < nowMs;
                                  const isNextWrap = nextStep?.itemIdx === idx && nextStep?.step === ("wrap" as any);
                                  const wrapLabel = item.wrapMethod === "foil" ? "Wrap in foil" : "Wrap in butcher paper";
                                  const wrapColor = "#A855F7";
                                  return (
                                    <View onLayout={(e) => { rowYRef.current[`${idx}:wrap`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextWrap && s.seqTlNextRow, isDoneWrap && !confirmedSteps[`${idx}_wrap`] && s.seqTlDoneRow]}>
                                      {isDoneWrap ? (
                                        <Pressable onPress={() => toggleConfirmedStep(`${idx}_wrap`)} hitSlop={8} style={s.seqTlDotBtn}>
                                          {confirmedSteps[`${idx}_wrap`]
                                            ? <Feather name="check-circle" size={14} color={wrapColor} />
                                            : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                        </Pressable>
                                      ) : (
                                        <View style={[s.seqTlDot, { backgroundColor: wrapColor }]} />
                                      )}
                                      <View style={s.seqTlConnector} />
                                      <View style={{ flex: 1 }}>
                                        <View style={s.seqTlLabelRow}>
                                          <Text style={[s.seqTlLabel, { color: isNextWrap ? wrapColor : colors.mutedForeground }, isDoneWrap && s.seqTlDoneLabel]}>{wrapLabel}</Text>
                                          {isNextWrap && (
                                            <View style={[s.seqTlNextBadge, { backgroundColor: wrapColor + "25" }]}>
                                              <Text style={[s.seqTlNextText, { color: wrapColor }]}>NEXT</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={[s.seqTlTime, { color: isDoneWrap ? colors.mutedForeground : colors.foreground, opacity: isDoneWrap ? 0.55 : 1 }]}>
                                          {wrapInferred ? "≈ " : ""}{new Date(wrapMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                          {cookStatus === "active" && !isDoneWrap && (
                                            <Text style={[s.seqTlMeta, { color: wrapColor }]}>
                                              {" "}· {relCountdown(wrapMs, nowMs)}
                                            </Text>
                                          )}
                                          {item.wrapTempF ? (
                                            <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                              {" "}· at {item.wrapTempF}°F internal
                                            </Text>
                                          ) : wrapInferred ? (
                                            <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                              {" "}· around the stall
                                            </Text>
                                          ) : null}
                                        </Text>
                                        {item.wrapReason ? (
                                          <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16 }]}>{item.wrapReason}</Text>
                                        ) : null}
                                      </View>
                                    </View>
                                  );
                                })() : null}
                                <View onLayout={(e) => { rowYRef.current[`${idx}:pullOff`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, { marginBottom: item.restMinutes > 0 ? 8 : 0 }, isNextPullOff && s.seqTlNextRow, isDonePullOff && !confirmedSteps[`${idx}_pullOff`] && s.seqTlDoneRow]}>
                                  {isDonePullOff ? (
                                    <Pressable onPress={() => toggleConfirmedStep(`${idx}_pullOff`)} hitSlop={8} style={s.seqTlDotBtn}>
                                      {confirmedSteps[`${idx}_pullOff`]
                                        ? <Feather name="check-circle" size={14} color="#22c55e" />
                                        : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                    </Pressable>
                                  ) : (
                                    <View style={[s.seqTlDot, { backgroundColor: "#22c55e" }]} />
                                  )}
                                  {item.restMinutes > 0
                                    ? <View style={s.seqTlConnector} />
                                    : <View style={[s.seqTlConnector, { borderColor: "transparent" }]} />}
                                  <View style={{ flex: 1 }}>
                                    <View style={s.seqTlLabelRow}>
                                      <Text style={[s.seqTlLabel, { color: isNextPullOff ? "#22c55e" : colors.mutedForeground }, isDonePullOff && s.seqTlDoneLabel]}>Pull off</Text>
                                      {isNextPullOff && (
                                        <View style={[s.seqTlNextBadge, { backgroundColor: "#22c55e25" }]}>
                                          <Text style={[s.seqTlNextText, { color: "#22c55e" }]}>NEXT</Text>
                                        </View>
                                      )}
                                    </View>
                                    <Text style={[s.seqTlTime, { color: isDonePullOff ? colors.mutedForeground : colors.foreground, opacity: isDonePullOff ? 0.55 : 1 }]}>
                                      {new Date(item.estimatedFinishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      {cookStatus === "active" && !isDonePullOff && (
                                        <Text style={[s.seqTlMeta, { color: "#22c55e" }]}>
                                          {" "}· {relCountdown(new Date(item.estimatedFinishAt).getTime(), nowMs)}
                                        </Text>
                                      )}
                                      {item.restMinutes > 0 && (
                                        <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                          {" "}· {fmtMinutes(item.restMinutes)} rest
                                        </Text>
                                      )}
                                    </Text>
                                  </View>
                                </View>
                                {item.restMinutes > 0 && (
                                  <View onLayout={(e) => { rowYRef.current[`${idx}:serve`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, { marginBottom: 0 }, isNextServe && s.seqTlNextRow, isDoneServe && !confirmedSteps[`${idx}_serve`] && s.seqTlDoneRow]}>
                                    {isDoneServe ? (
                                      <Pressable onPress={() => toggleConfirmedStep(`${idx}_serve`)} hitSlop={8} style={s.seqTlDotBtn}>
                                        {confirmedSteps[`${idx}_serve`]
                                          ? <Feather name="check-circle" size={14} color="#6366f1" />
                                          : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                      </Pressable>
                                    ) : (
                                      <View style={[s.seqTlDot, { backgroundColor: "#6366f1" }]} />
                                    )}
                                    <View style={[s.seqTlConnector, { borderColor: "transparent" }]} />
                                    <View style={{ flex: 1 }}>
                                      <View style={s.seqTlLabelRow}>
                                        <Text style={[s.seqTlLabel, { color: isNextServe ? "#6366f1" : colors.mutedForeground }, isDoneServe && s.seqTlDoneLabel]}>Ready to serve</Text>
                                        {isNextServe && (
                                          <View style={[s.seqTlNextBadge, { backgroundColor: "#6366f125" }]}>
                                            <Text style={[s.seqTlNextText, { color: "#6366f1" }]}>NEXT</Text>
                                          </View>
                                        )}
                                      </View>
                                      <Text style={[s.seqTlTime, { color: isDoneServe ? colors.mutedForeground : colors.foreground, opacity: isDoneServe ? 0.55 : 1 }]}>
                                        {new Date(serveMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                        {cookStatus === "active" && !isDoneServe && (
                                          <Text style={[s.seqTlMeta, { color: "#6366f1" }]}>
                                            {" "}· {relCountdown(serveMs, nowMs)}
                                          </Text>
                                        )}
                                      </Text>
                                    </View>
                                  </View>
                                )}
                              </>
                            );
                          })()}
                        </View>
                        {item.notes ? (
                          <View style={[s.seqTlNoteBox, { backgroundColor: colors.border + "44" }]}>
                            <Feather name="info" size={12} color={colors.mutedForeground} />
                            <Text style={[s.seqTlNoteText, { color: colors.mutedForeground }]}>{item.notes}</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Stored AI analysis ──────────────────────────────── */}
        {storedAnalysis && (
          <View
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}
            onLayout={onCardLayout}
          >
            <View style={s.logHeader}>
              <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
                <Feather name="activity" size={15} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.logTitle, { color: colors.foreground }]}>
                  {c.status === "active" ? "PitMaster Live Check-in" : "PitMaster Cook Analysis"}
                </Text>
                <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                  {c.status === "active"
                    ? (() => {
                        const m = (storedAnalysis as any)?.snapshotElapsedMinutes;
                        let intoCook = "";
                        if (typeof m === "number" && m >= 0) {
                          const h = Math.floor(m / 60);
                          const mm = m % 60;
                          intoCook = `Last check-in at ${h > 0 ? `${h}h ${mm}m` : `${mm}m`} into cook`;
                        } else {
                          intoCook = "Latest check-in";
                        }
                        // Resolve analyzedAt from current analysisResult, falling back to
                        // the most recent analysisHistory entry's savedAt for older cooks.
                        const analyzedAtRaw =
                          (storedAnalysis as any)?.analyzedAt ??
                          (() => {
                            const hist: any[] = Array.isArray((c as any).analysisHistory) ? (c as any).analysisHistory : [];
                            return hist.length > 0 ? hist[hist.length - 1]?.savedAt : null;
                          })();
                        const analyzedAtMs = analyzedAtRaw ? new Date(analyzedAtRaw).getTime() : NaN;
                        if (!Number.isFinite(analyzedAtMs)) return intoCook;
                        const ageSec = Math.max(0, Math.round((nowMs - analyzedAtMs) / 1000));
                        let ago: string;
                        if (ageSec < 60) ago = "just now";
                        else if (ageSec < 3600) ago = `${Math.floor(ageSec / 60)} min ago`;
                        else {
                          const ah = Math.floor(ageSec / 3600);
                          const am = Math.floor((ageSec % 3600) / 60);
                          ago = am > 0 ? `${ah}h ${am}m ago` : `${ah}h ago`;
                        }
                        return `${intoCook} · ${ago}`;
                      })()
                    : "Saved from image scan"}
                </Text>
              </View>
              {storedVerdictCfg && (
                <View style={[s.verdictPill, { backgroundColor: storedVerdictCfg.color + "22" }]}>
                  <Feather name={storedVerdictCfg.icon as any} size={12} color={storedVerdictCfg.color} />
                  <Text style={[s.verdictPillText, { color: storedVerdictCfg.color }]}>{storedVerdictCfg.label}</Text>
                </View>
              )}
            </View>

            {/* Key Takeaway — top suggestion surfaced immediately */}
            {(storedAssessment?.suggestions?.length ?? 0) > 0 && (
              <View style={[s.keyTakeawayCard, { backgroundColor: "#A855F715", borderColor: "#A855F740" }]}>
                <View style={s.keyTakeawayHeader}>
                  <Feather name="star" size={13} color="#A855F7" />
                  <Text style={[s.keyTakeawayLabel, { color: "#A855F7" }]}>
                    {c.status === "active" ? "Do this now" : `For your next ${c.foodType || "cook"}`}
                  </Text>
                </View>
                <Text style={[s.keyTakeawayText, { color: colors.foreground }]}>
                  {storedAssessment!.suggestions![0]}
                </Text>
              </View>
            )}

            {storedAssessment?.summary ? (
              <Text style={[s.storedSummary, { color: colors.foreground }]}>{storedAssessment.summary}</Text>
            ) : null}

            {storedGraphProbes.length > 0 && (
              <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Graph</Text>
                <TempGraph
                  probes={storedGraphProbes as unknown as ProbeTimeSeries[]}
                  events={storedAnalysis?.events ?? []}
                  targetTempF={c.targetTempF ?? null}
                  width={cardWidth}
                  height={190}
                />
              </View>
            )}

            {(storedAnalysis?.probes?.length ?? 0) > 0 && (
              <View style={[s.subSection, { borderTopColor: colors.border }]}>
                <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Probe Readings</Text>
                {storedAnalysis!.probes.map((p: any, i: number) => (
                  <View key={i} style={[s.probeRow, { borderTopColor: colors.border }]}>
                    <View>
                      <Text style={[s.probeName, { color: colors.foreground }]}>{p.probeName}</Text>
                      {(p.minTempF != null || p.maxTempF != null) && (
                        <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                          {p.minTempF ?? "?"}°F → {p.maxTempF ?? "?"}°F
                        </Text>
                      )}
                    </View>
                    <Text style={[s.probeFinish, { color: "#A855F7" }]}>{p.finishingTempF}°F</Text>
                  </View>
                ))}
              </View>
            )}

            {(storedAnalysis?.events?.length ?? 0) > 0 && (() => {
              const isOpen = expandedStoredSections.has("timeline");
              const events = storedAnalysis!.events;
              return (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("timeline")}>
                    <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>Cook Timeline</Text>
                    <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                      <Text style={[s.countPillText, { color: colors.mutedForeground }]}>{events.length}</Text>
                    </View>
                    <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                  </Pressable>
                  {!isOpen && (
                    <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {fmtISOInText(events[0].description)}
                    </Text>
                  )}
                  {isOpen && events.map((ev: any, i: number) => {
                    const hrs = Math.floor(ev.timeMinutes / 60);
                    const mins = ev.timeMinutes % 60;
                    return (
                      <View key={i} style={[s.eventRow, { borderTopColor: colors.border }]}>
                        <View style={[s.eventIconWrap, { backgroundColor: "#A855F7" + "18" }]}>
                          <Feather name={(EVENT_ICONS[ev.type] ?? "circle") as any} size={13} color="#A855F7" />
                        </View>
                        <Text style={[s.eventDesc, { color: colors.foreground, flex: 1 }]}>{fmtISOInText(ev.description)}</Text>
                        <Text style={[s.eventTime, { color: colors.mutedForeground }]}>
                          {hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              );
            })()}

            {(storedAssessment?.whatWentWell?.length ?? 0) > 0 && (() => {
              const isOpen = expandedStoredSections.has("wentWell");
              const items: string[] = storedAssessment!.whatWentWell;
              return (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("wentWell")}>
                    <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>
                      {c.status === "active" ? "What's Working" : "What Went Well"}
                    </Text>
                    <View style={[s.countPill, { backgroundColor: "#22c55e18" }]}>
                      <Text style={[s.countPillText, { color: "#22c55e" }]}>{items.length}</Text>
                    </View>
                    <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                  </Pressable>
                  {!isOpen && (
                    <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {items[0]}
                    </Text>
                  )}
                  {isOpen && items.map((item, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {(storedAssessment?.suggestions?.length ?? 0) > 0 && (() => {
              const isOpen = expandedStoredSections.has("nextTime");
              const tips: string[] = storedAssessment!.suggestions;
              return (
                <View style={[s.subSection, { borderTopColor: colors.border }]}>
                  <Pressable style={s.collapsibleRow} onPress={() => toggleStoredSection("nextTime")}>
                    <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>
                      {c.status === "active" ? "What to Adjust" : "Next Time, Try This"}
                    </Text>
                    <View style={[s.countPill, { backgroundColor: "#A855F718" }]}>
                      <Text style={[s.countPillText, { color: "#A855F7" }]}>{tips.length}</Text>
                    </View>
                    <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                  </Pressable>
                  {!isOpen && (
                    <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {tips[0]}
                    </Text>
                  )}
                  {isOpen && tips.map((tip, i) => (
                    <View key={i} style={s.bulletRow}>
                      <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                      <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}
          </View>
        )}

        {/* ── Ask PitMaster (active cooks only) ───────────────── */}
        {c.status === "active" && (
          <View
            style={[s.logSection, { backgroundColor: colors.card, borderColor: "#6C3BF540", borderRadius: colors.radius }]}
            onLayout={onCardLayout}
          >
            <View style={s.logHeader}>
              <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.logIconWrap}>
                <Feather name="zap" size={15} color="#fff" />
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={[s.logTitle, { color: colors.foreground }]}>What Should I Do Next?</Text>
                <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                  {meaterLinked === true && meaterProbes.length > 0
                    ? "Temperature auto-filled from your probe · add pit temp or notes and get your next step"
                    : "Enter your probe and pit temperatures to get your next action"}
                </Text>
              </View>
            </View>

            {/* MEATER source indicator */}
            {!userTempEdited && meaterProbes.length > 0 && meaterProbes[0].internalTempF != null && (
              <View style={[s.meaterAutoFillBadge, { backgroundColor: "#FF6B2B15", marginBottom: 4 }]}>
                <Feather name="radio" size={11} color="#FF6B2B" />
                <Text style={[s.meaterAutoFillText, { color: "#FF6B2B" }]}>
                  Live from {meaterProbes[0].deviceName} · {meaterProbes[0].internalTempF}°F internal
                </Text>
              </View>
            )}

            {/* Temperature inputs */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
                  Probe temp <Text style={{ fontWeight: "400" }}>(°F)</Text>
                </Text>
                <TextInput
                  style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 38, minHeight: 38, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 10, fontSize: 13 }]}
                  placeholder="e.g. 165"
                  placeholderTextColor={colors.mutedForeground}
                  value={userTempInput}
                  onChangeText={(v) => { setUserTempInput(v); setUserTempEdited(v.trim().length > 0); }}
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
                  Pit temp <Text style={{ fontWeight: "400" }}>(°F)</Text>
                </Text>
                <TextInput
                  style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 38, minHeight: 38, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 10, fontSize: 13 }]}
                  placeholder="e.g. 225"
                  placeholderTextColor={colors.mutedForeground}
                  value={pitTempInput}
                  onChangeText={setPitTempInput}
                  keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Notes */}
            <View>
              <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
                What's happening? <Text style={{ fontWeight: "400" }}>(optional)</Text>
              </Text>
              <TextInput
                style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, minHeight: 56, padding: 10, fontSize: 13 }]}
                placeholder="e.g. Going into the stall around 160°F, just wrapped it in butcher paper..."
                placeholderTextColor={colors.mutedForeground}
                value={cookNotes}
                onChangeText={setCookNotes}
                multiline
                numberOfLines={2}
                textAlignVertical="top"
              />
            </View>

            {/* Free-tier remaining-analyzes counter. Hidden for Pro. */}
            {paywallUsage && !paywallUsage.unlimited && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color:
                    paywallUsage.remaining.aiAnalyzesToday <= 1
                      ? colors.primary
                      : colors.mutedForeground,
                  textAlign: "center",
                  marginTop: 6,
                  marginBottom: -2,
                }}
              >
                {paywallUsage.remaining.aiAnalyzesToday} of {paywallUsage.limits.aiAnalyzePerDay} free
                analyses left today
              </Text>
            )}
            {/* Free-tier graded-cook slot badge. Hidden for Pro. */}
            {paywallUsage && !paywallUsage.unlimited && paywallUsage.usage.gradedCooks === 0 && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_500Medium",
                  color: colors.primary,
                  textAlign: "center",
                  marginTop: 4,
                  marginBottom: -2,
                }}
              >
                1 AI grade remaining
              </Text>
            )}
            {/* Analyze button */}
            <Pressable
              style={({ pressed }) => [s.analyzeBtn, { borderRadius: colors.radius }, (analyzing || pressed) && { opacity: 0.75 }]}
              onPress={analyze}
              disabled={analyzing}
            >
              <LinearGradient colors={["#6C3BF5", "#A855F7"]} style={s.analyzeBtnGradient}>
                {analyzing ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={s.analyzeBtnText}>PitMaster is checking in…</Text>
                  </>
                ) : (
                  <>
                    <Feather name="zap" size={16} color="#fff" />
                    <Text style={s.analyzeBtnText}>Ask PitMaster</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>

            {/* Results */}
            {result && (
              <View style={[s.results, { borderTopColor: colors.border }]}>

                {/* ── Decision engine ──────────────────────────────── */}
                {renderDecisions(result.decisions ?? [])}

                {/* ── Phase prediction banner ─────────────────────── */}
                {result.phasePrediction && (() => {
                  const pp = result.phasePrediction!;
                  const PHASE_COLORS: Record<string, string> = {
                    heat_up: "#3B82F6",
                    stall: "#F59E0B",
                    finishing: "#22c55e",
                    done: "#6B7280",
                  };
                  const PHASE_ICONS: Record<string, string> = {
                    heat_up: "thermometer",
                    stall: "clock",
                    finishing: "trending-up",
                    done: "check-circle",
                  };
                  const phaseColor = PHASE_COLORS[pp.phase] ?? "#6B7280";
                  const phaseIcon = PHASE_ICONS[pp.phase] ?? "activity";

                  const fmtTime = (mins: number) => {
                    if (mins < 60) return `~${mins}m`;
                    const h = Math.floor(mins / 60);
                    const m = mins % 60;
                    return m > 0 ? `~${h}h ${m}m` : `~${h}h`;
                  };

                  return (
                    <View style={[s.phaseCard, { backgroundColor: phaseColor + "15", borderColor: phaseColor + "40", borderRadius: colors.radius }]}>
                      {/* Phase label row */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: pp.narrative ? 8 : 0 }}>
                        <View style={[s.phaseChip, { backgroundColor: phaseColor + "25", borderColor: phaseColor + "50" }]}>
                          <Feather name={phaseIcon as any} size={12} color={phaseColor} />
                          <Text style={[s.phaseChipText, { color: phaseColor }]}>{pp.phaseLabel}</Text>
                        </View>
                      </View>

                      {/* Narrative */}
                      {pp.narrative ? (
                        <Text style={[s.phaseNarrative, { color: colors.foreground }]}>{pp.narrative}</Text>
                      ) : null}

                      {/* Time prediction chips */}
                      {(pp.timeToStallMinutes != null || pp.stallDurationMinutes != null || pp.timeToFinishMinutes != null) && (
                        <View style={s.phaseChips}>
                          {pp.timeToStallMinutes != null && pp.phase === "heat_up" && (
                            <View style={[s.timeChip, { backgroundColor: phaseColor + "20", borderColor: phaseColor + "40" }]}>
                              <Feather name="clock" size={11} color={phaseColor} />
                              <Text style={[s.timeChipText, { color: phaseColor }]}>Stall in {fmtTime(pp.timeToStallMinutes)}</Text>
                            </View>
                          )}
                          {pp.stallDurationMinutes != null && pp.phase === "stall" && (
                            <View style={[s.timeChip, { backgroundColor: "#F59E0B20", borderColor: "#F59E0B40" }]}>
                              <Feather name="pause-circle" size={11} color="#F59E0B" />
                              <Text style={[s.timeChipText, { color: "#F59E0B" }]}>Stall ends in {fmtTime(pp.stallDurationMinutes)}</Text>
                            </View>
                          )}
                          {pp.timeToFinishMinutes != null && (
                            <View style={[s.timeChip, { backgroundColor: "#22c55e20", borderColor: "#22c55e40" }]}>
                              <Feather name="flag" size={11} color="#22c55e" />
                              <Text style={[s.timeChipText, { color: "#22c55e" }]}>Done in {fmtTime(pp.timeToFinishMinutes)}</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })()}

                {verdictCfg && assessment && (
                  <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                    <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                    <View style={{ flex: 1 }}>
                      <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                      {assessment.summary ? <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text> : null}
                    </View>
                  </View>
                )}
                {(assessment?.whatWentWell?.length ?? 0) > 0 && (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Looking Good</Text>
                    {assessment!.whatWentWell!.map((item, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {(assessment?.suggestions?.length ?? 0) > 0 && (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Watch Out For</Text>
                    {assessment!.suggestions!.map((tip, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={[s.bulletNum, { color: "#A855F7" }]}>{i + 1}</Text>
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {result.noDataFound && result.probes.length === 0 && (
                  <View style={s.noDataRow}>
                    <Feather name="info" size={15} color={colors.mutedForeground} />
                    <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                      Enter a temperature reading or add cook notes for a better check-in.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Rate This Cook (completed cooks only) ──────────── */}
        {c.status === "completed" && (
          <View style={[s.card, { backgroundColor: colors.card, borderColor: "#eab30840", borderRadius: colors.radius }]}>
            <View style={[s.logHeader, { padding: 14 }]}>
              <View style={[s.logIconWrap, { backgroundColor: "#eab308" }]}>
                <Feather name="star" size={15} color="#fff" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[s.logTitle, { color: colors.foreground }]}>Rate This Cook</Text>
                <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                  {rateSaving ? "Saving…" : "Tap a star to rate · saves instantly"}
                </Text>
              </View>
            </View>

            {[
              { label: "Tenderness", icon: "droplet" as const, value: rateTenderness, setter: setRateTenderness, field: "tenderness" },
              { label: "Flavor",     icon: "heart"   as const, value: rateFlavor,    setter: setRateFlavor,    field: "flavor"    },
              { label: "Bark/Color", icon: "layers"  as const, value: rateBark,      setter: setRateBark,      field: "bark"      },
            ].map((row) => (
              <View key={row.label} style={[s.rateRow, { borderTopColor: colors.border }]}>
                <View style={s.rateRowLeft}>
                  <Feather name={row.icon} size={14} color={colors.mutedForeground} />
                  <Text style={[s.rateRowLabel, { color: colors.foreground }]}>{row.label}</Text>
                </View>
                <View style={s.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Pressable
                      key={star}
                      onPress={() => {
                        const newVal = star === row.value ? 0 : star;
                        row.setter(newVal);
                        const t = row.field === "tenderness" ? newVal : rateTenderness;
                        const f = row.field === "flavor"     ? newVal : rateFlavor;
                        const b = row.field === "bark"       ? newVal : rateBark;
                        saveRatings(t, f, b);
                      }}
                      hitSlop={6}
                      disabled={rateSaving}
                    >
                      <Text style={[s.star, { color: star <= row.value ? "#eab308" : colors.border, opacity: rateSaving ? 0.5 : 1 }]}>
                        {star <= row.value ? "★" : "☆"}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ── PitMaster Cook Review (completed cooks only) ── */}
        {c.status === "completed" && <View
          style={[s.logSection, { backgroundColor: colors.card, borderColor: "#D97706" + "40", borderRadius: colors.radius }]}
          onLayout={onCardLayout}
        >
          {/* Header */}
          <View style={s.logHeader}>
            <LinearGradient colors={["#D97706", "#F59E0B"]} style={s.logIconWrap}>
              <Feather name="award" size={15} color="#fff" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={[s.logTitle, { color: colors.foreground }]}>PitMaster Cook Review</Text>
              <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos from your finished cook · PitMaster grades the result and gives personalised tips
              </Text>
            </View>
          </View>

          {/* Photo buttons */}
          <View style={s.photoBtns}>
            <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={pickImages}>
              <Feather name="image" size={15} color={colors.primary} />
              <Text style={[s.photoBtnText, { color: colors.foreground }]}>Gallery</Text>
            </Pressable>
            {Platform.OS !== "web" && (
              <Pressable style={[s.photoBtn, { borderColor: colors.border, borderRadius: colors.radius }]} onPress={takePhoto}>
                <Feather name="camera" size={15} color={colors.primary} />
                <Text style={[s.photoBtnText, { color: colors.foreground }]}>Camera</Text>
              </Pressable>
            )}
          </View>

          {/* Thumbnails */}
          {images.length > 0 && (
            <View style={s.thumbRow}>
              {images.map((img, i) => (
                <View key={i} style={s.thumb}>
                  <Image source={{ uri: img.uri }} style={s.thumbImg} />
                  <Pressable style={[s.thumbDel, { backgroundColor: colors.destructive }]} onPress={() => removeImage(i)}>
                    <Feather name="x" size={11} color="#fff" />
                  </Pressable>
                </View>
              ))}
              <Pressable style={[s.addMoreThumb, { borderColor: colors.border, borderRadius: 8 }]} onPress={pickImages}>
                <Feather name="plus" size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {/* Timing context strip — shows the start/serve times the AI will use */}
          {(() => {
            const c2 = cook as any;
            const startTime = c2?.actualStartAt
              ? { label: "Your start", value: formatDT(c2.actualStartAt), highlight: true }
              : c2?.plannedStartAt
              ? { label: "Planned start", value: formatDT(c2.plannedStartAt), highlight: false }
              : null;
            const serveTime = c2?.plannedEndAt
              ? { label: "Serve by", value: formatDT(c2.plannedEndAt) }
              : null;
            if (!startTime && !serveTime) return null;
            return (
              <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                {startTime && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: startTime.highlight ? colors.primary + "15" : colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flex: 1, minWidth: 120 }}>
                    <Feather name="clock" size={12} color={startTime.highlight ? colors.primary : colors.mutedForeground} />
                    <View>
                      <Text style={{ fontSize: 10, color: startTime.highlight ? colors.primary : colors.mutedForeground, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }}>{startTime.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{startTime.value}</Text>
                    </View>
                  </View>
                )}
                {serveTime && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.muted, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, flex: 1, minWidth: 120 }}>
                    <Feather name="flag" size={12} color={colors.mutedForeground} />
                    <View>
                      <Text style={{ fontSize: 10, color: colors.mutedForeground, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 }}>{serveTime.label}</Text>
                      <Text style={{ fontSize: 12, color: colors.foreground, fontWeight: "500" }}>{serveTime.value}</Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })()}

          {/* Temperature reading input */}
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
                Final temperature reached <Text style={{ fontWeight: "400" }}>(°F)</Text>
              </Text>
              <TextInput
                style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, height: 44, paddingTop: 0, paddingBottom: 0 }]}
                placeholder="e.g. 195"
                placeholderTextColor={colors.mutedForeground}
                value={userTempInput}
                onChangeText={(v) => {
                  setUserTempInput(v);
                  setUserTempEdited(v.trim().length > 0);
                }}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          {/* Notes input */}
          <View>
            <Text style={[s.notesInputLabel, { color: colors.mutedForeground }]}>
              How did it go? <Text style={{ fontWeight: "400" }}>(optional — any details help PitMaster grade accurately)</Text>
            </Text>
            <TextInput
              style={[s.notesInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
              placeholder="e.g. Wrapped at 4hrs, had a big stall around 160°F, grill ran hot in the last hour..."
              placeholderTextColor={colors.mutedForeground}
              value={cookNotes}
              onChangeText={setCookNotes}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Free-tier remaining-analyzes counter. Hidden for Pro. */}
          {paywallUsage && !paywallUsage.unlimited && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color:
                  paywallUsage.remaining.aiAnalyzesToday <= 1
                    ? colors.primary
                    : colors.mutedForeground,
                textAlign: "center",
                marginTop: 6,
                marginBottom: -2,
              }}
            >
              {paywallUsage.remaining.aiAnalyzesToday} of {paywallUsage.limits.aiAnalyzePerDay} free
              analyses left today
            </Text>
          )}
          {/* Free-tier graded-cook slot badge. Hidden for Pro. */}
          {paywallUsage && !paywallUsage.unlimited && paywallUsage.usage.gradedCooks === 0 && (
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_500Medium",
                color: colors.primary,
                textAlign: "center",
                marginTop: 4,
                marginBottom: -2,
              }}
            >
              1 AI grade remaining
            </Text>
          )}
          {/* Grade button */}
          <Pressable
            style={({ pressed }) => [
              s.analyzeBtn,
              { borderRadius: colors.radius },
              (analyzing || pressed) && { opacity: 0.75 },
            ]}
            onPress={analyze}
            disabled={analyzing}
          >
            <LinearGradient colors={["#D97706", "#F59E0B"]} style={s.analyzeBtnGradient}>
              {analyzing ? (
                <>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={s.analyzeBtnText}>PitMaster is reviewing your cook…</Text>
                </>
              ) : (
                <>
                  <Feather name="award" size={16} color="#fff" />
                  <Text style={s.analyzeBtnText}>
                    {images.length > 0
                      ? `Grade ${images.length} image${images.length > 1 ? "s" : ""} with PitMaster`
                      : "Grade This Cook with PitMaster"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </Pressable>

          {/* ── Results ───────────────────────────────────────── */}
          {result && (
            <View style={[s.results, { borderTopColor: colors.border }]}>

              {/* ── Decision engine ──────────────────────────────── */}
              {renderDecisions(result.decisions ?? [])}

              {/* Verdict banner */}
              {verdictCfg && assessment && (
                <View style={[s.verdictBanner, { backgroundColor: verdictCfg.color + "18", borderColor: verdictCfg.color + "40", borderRadius: colors.radius }]}>
                  <Feather name={verdictCfg.icon as any} size={20} color={verdictCfg.color} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.verdictLabel, { color: verdictCfg.color }]}>{verdictCfg.label}</Text>
                    {assessment.summary ? (
                      <Text style={[s.verdictSummary, { color: colors.foreground }]}>{assessment.summary}</Text>
                    ) : null}
                  </View>
                </View>
              )}

              {/* Temperature graph */}
              {(result.probes as any[]).filter((p) => p.timeSeries?.length >= 2).length > 0 && (
                <View style={[s.graphWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground, marginBottom: 8 }]}>Temperature Graph</Text>
                  <TempGraph
                    probes={(result.probes as any[]).filter((p) => p.timeSeries?.length >= 2)}
                    events={result.events}
                    targetTempF={c?.targetTempF ?? null}
                    width={cardWidth}
                    height={180}
                  />
                </View>
              )}

              {/* Probe readings */}
              {result.probes.length > 0 && (
                <View style={[s.subSection, { borderColor: colors.border }]}>
                  <Text style={[s.subLabel, { color: colors.mutedForeground }]}>Temperature Readings</Text>
                  {result.probes.map((p, i) => (
                    <View key={i} style={[s.probeRow, { borderTopColor: colors.border }]}>
                      <View>
                        <Text style={[s.probeName, { color: colors.foreground }]}>{p.probeName}</Text>
                        {(p.minTempF != null || p.maxTempF != null) && (
                          <Text style={[s.probeRange, { color: colors.mutedForeground }]}>
                            {p.minTempF != null ? `${p.minTempF}°F` : "?"} → {p.maxTempF != null ? `${p.maxTempF}°F` : "?"}
                          </Text>
                        )}
                      </View>
                      <Text style={[s.probeFinish, { color: colors.primary }]}>{p.finishingTempF}°F</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Events timeline */}
              {result.events.length > 0 && (() => {
                const isOpen = expandedResultSections.has("timeline");
                return (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Pressable style={s.collapsibleRow} onPress={() => toggleResultSection("timeline")}>
                      <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>Cook Timeline</Text>
                      <View style={[s.countPill, { backgroundColor: colors.muted }]}>
                        <Text style={[s.countPillText, { color: colors.mutedForeground }]}>{result.events.length}</Text>
                      </View>
                      <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    </Pressable>
                    {!isOpen && (
                      <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {fmtISOInText(result.events[0].description)}
                      </Text>
                    )}
                    {isOpen && result.events.map((ev, i) => {
                      const hrs = Math.floor(ev.timeMinutes / 60);
                      const mins = ev.timeMinutes % 60;
                      const timeStr = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
                      return (
                        <View key={i} style={[s.eventRow, { borderTopColor: colors.border }]}>
                          <View style={[s.eventIconWrap, { backgroundColor: colors.primary + "18" }]}>
                            <Feather name={(EVENT_ICONS[ev.type] ?? "circle") as any} size={13} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.eventDesc, { color: colors.foreground }]}>{fmtISOInText(ev.description)}</Text>
                          </View>
                          <Text style={[s.eventTime, { color: colors.mutedForeground }]}>{timeStr}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}

              {/* What went well */}
              {(assessment?.whatWentWell?.length ?? 0) > 0 && (() => {
                const isOpen = expandedResultSections.has("wentWell");
                return (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Pressable style={s.collapsibleRow} onPress={() => toggleResultSection("wentWell")}>
                      <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>What Went Well</Text>
                      <View style={[s.countPill, { backgroundColor: "#22c55e18" }]}>
                        <Text style={[s.countPillText, { color: "#22c55e" }]}>{assessment!.whatWentWell!.length}</Text>
                      </View>
                      <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    </Pressable>
                    {!isOpen && (
                      <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {assessment!.whatWentWell![0]}
                      </Text>
                    )}
                    {isOpen && assessment!.whatWentWell!.map((item, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Feather name="check" size={14} color="#22c55e" style={{ marginTop: 2 }} />
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{item}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* Suggestions */}
              {(assessment?.suggestions?.length ?? 0) > 0 && (() => {
                const isOpen = expandedResultSections.has("nextTime");
                return (
                  <View style={[s.subSection, { borderColor: colors.border }]}>
                    <Pressable style={s.collapsibleRow} onPress={() => toggleResultSection("nextTime")}>
                      <Text style={[s.subLabel, { color: colors.mutedForeground, flex: 1, marginBottom: 0 }]}>Next Time, Try This</Text>
                      <View style={[s.countPill, { backgroundColor: "#A855F718" }]}>
                        <Text style={[s.countPillText, { color: "#A855F7" }]}>{assessment!.suggestions!.length}</Text>
                      </View>
                      <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    </Pressable>
                    {!isOpen && (
                      <Text style={[s.sectionPreview, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {assessment!.suggestions![0]}
                      </Text>
                    )}
                    {isOpen && assessment!.suggestions!.map((tip, i) => (
                      <View key={i} style={s.bulletRow}>
                        <Text style={[s.bulletNum, { color: colors.primary }]}>{i + 1}</Text>
                        <Text style={[s.bulletText, { color: colors.foreground }]}>{tip}</Text>
                      </View>
                    ))}
                  </View>
                );
              })()}

              {/* No data fallback */}
              {result.noDataFound && result.probes.length === 0 && (
                <View style={s.noDataRow}>
                  <Feather name="info" size={15} color={colors.mutedForeground} />
                  <Text style={[s.noDataText, { color: colors.mutedForeground }]}>
                    No temperature data found in images — assessment based on your cook notes only.
                    {result.rawExtraction ? `\n${result.rawExtraction}` : ""}
                  </Text>
                </View>
              )}

              {/* Detected meta */}
              {(result.detectedFoodType || result.cookDurationMinutes != null) && (
                <View style={[s.metaRow, { borderTopColor: colors.border }]}>
                  {result.detectedFoodType && (
                    <View style={s.metaPill}>
                      <Feather name="tag" size={12} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>{result.detectedFoodType}</Text>
                    </View>
                  )}
                  {result.cookDurationMinutes != null && (
                    <View style={s.metaPill}>
                      <Feather name="clock" size={12} color={colors.mutedForeground} />
                      <Text style={[s.metaText, { color: colors.mutedForeground }]}>
                        {Math.floor(result.cookDurationMinutes / 60)}h {result.cookDurationMinutes % 60}m
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>
          )}
        </View>}

        {/* ── Check-in History ─────────────────────────────── */}
        {(() => {
          const history: any[] = Array.isArray((c as any).analysisHistory) ? (c as any).analysisHistory : [];
          if (history.length === 0) return null;
          const URGENCY_COLORS: Record<string, string> = {
            now: "#EF4444",
            soon: "#F59E0B",
            when_ready: "#6C3BF5",
            maintain: "#22c55e",
          };
          const VERDICT_COLORS: Record<string, string> = {
            perfect: "#22c55e", good: "#84cc16", needs_work: "#F59E0B",
            overcooked: "#EF4444", undercooked: "#3B82F6",
          };
          const fmtSavedAt = (iso: string) => {
            try {
              const d = new Date(iso);
              return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
            } catch { return iso; }
          };
          const fmtMins = (mins: number) => {
            const h = Math.floor(mins / 60);
            const m = mins % 60;
            return h > 0 ? `${h}h ${m}m` : `${m}m`;
          };
          return (
            <View style={[s.historySection, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <View style={s.logHeader}>
                <LinearGradient colors={["#374151", "#52525B"]} style={s.logIconWrap}>
                  <Feather name="clock" size={15} color="#fff" />
                </LinearGradient>
                <View style={{ flex: 1 }}>
                  <Text style={[s.logTitle, { color: colors.foreground }]}>
                    {c.status === "active" ? "Check-in History" : "Analysis History"}
                  </Text>
                  <Text style={[s.logSub, { color: colors.mutedForeground }]}>
                    {history.length} {history.length === 1 ? "entry" : "entries"} · all feedback retained
                  </Text>
                </View>
              </View>
              {[...history].reverse().map((entry, i) => {
                const topDecision = (entry.decisions ?? [])[0];
                const urgencyColor = topDecision
                  ? (topDecision.action === "maintain" ? "#22c55e" : (URGENCY_COLORS[topDecision.urgency] ?? "#6C3BF5"))
                  : null;
                const verdict = entry.assessment?.verdict;
                const verdictColor = verdict ? (VERDICT_COLORS[verdict] ?? colors.mutedForeground) : null;
                return (
                  <View
                    key={i}
                    style={[
                      s.historyEntry,
                      { borderTopColor: colors.border },
                      i > 0 && { borderTopWidth: 1 },
                    ]}
                  >
                    {/* Entry header */}
                    <View style={s.historyEntryHeader}>
                      <View style={[s.historyIndex, { backgroundColor: colors.muted }]}>
                        <Text style={[s.historyIndexText, { color: colors.mutedForeground }]}>
                          {history.length - i}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.historyTimestamp, { color: colors.foreground }]}>
                          {entry.savedAt ? fmtSavedAt(entry.savedAt) : "Unknown time"}
                        </Text>
                        <View style={s.historyMeta}>
                          {entry.snapshotElapsedMinutes != null && (
                            <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                              {fmtMins(entry.snapshotElapsedMinutes)} in
                            </Text>
                          )}
                          {entry.snapshotTempF != null && (
                            <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                              {entry.snapshotTempF}°F
                            </Text>
                          )}
                          {entry.detectedFoodType && entry.detectedFoodType !== c.foodType && (
                            <Text style={[s.historyMetaChip, { color: colors.mutedForeground }]}>
                              {entry.detectedFoodType}
                            </Text>
                          )}
                        </View>
                      </View>
                      {verdictColor && (
                        <View style={[s.historyVerdictBadge, { backgroundColor: verdictColor + "22" }]}>
                          <Text style={[s.historyVerdictText, { color: verdictColor }]}>
                            {verdict?.replace(/_/g, " ")}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Top decision */}
                    {topDecision && (
                      <View style={[s.historyDecision, { backgroundColor: urgencyColor! + "10", borderColor: urgencyColor! + "30" }]}>
                        <View style={[s.historyDecisionDot, { backgroundColor: urgencyColor! }]} />
                        <Text style={[s.historyDecisionText, { color: colors.foreground }]} numberOfLines={2}>
                          {topDecision.instruction}
                        </Text>
                      </View>
                    )}

                    {/* Phase + summary */}
                    {entry.phasePrediction?.phaseLabel && (
                      <Text style={[s.historyPhase, { color: colors.mutedForeground }]}>
                        Phase: {entry.phasePrediction.phaseLabel}
                      </Text>
                    )}
                    {entry.assessment?.summary && (
                      <Text style={[s.historySummary, { color: colors.mutedForeground }]} numberOfLines={2}>
                        {entry.assessment.summary}
                      </Text>
                    )}
                    {entry.snapshotNotes && (
                      <Text style={[s.historyNotes, { color: colors.mutedForeground }]} numberOfLines={1}>
                        Notes: {entry.snapshotNotes}
                      </Text>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })()}

        {/* Status action button */}
        {nextStatus && (
          <Pressable
            style={({ pressed }) => [s.actionBtn, { backgroundColor: statusColor, borderRadius: colors.radius }, (updateCook.isPending || pressed) && { opacity: 0.7 }]}
            onPress={() => handleStatusUpdate(nextStatus)}
            disabled={updateCook.isPending}
          >
            {updateCook.isPending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name={nextStatus === "active" ? "play" : "check-circle"} size={18} color="#fff" />
                <Text style={s.actionText}>{nextStatus === "active" ? "Start Cook" : "Mark Complete"}</Text>
              </>
            )}
          </Pressable>
        )}

        {/* Grade prompt — completed cook with no stored analysis */}
        {c.status === "completed" && !storedAnalysis && !result && (
          <View style={[s.gradePrompt, { backgroundColor: "#E84820" + "12", borderColor: "#E84820" + "35", borderRadius: colors.radius }]}>
            <Feather name="award" size={18} color="#E84820" />
            <View style={{ flex: 1 }}>
              <Text style={[s.gradePromptTitle, { color: colors.foreground }]}>Get your cook graded</Text>
              <Text style={[s.gradePromptSub, { color: colors.mutedForeground }]}>
                Upload thermometer photos or add notes below — PitMaster will grade this cook{c.wrapMethod ? " against your original plan" : ""}.
              </Text>
            </View>
          </View>
        )}

        <Pressable onPress={goHome} style={s.homeLink}>
          <Feather name="home" size={14} color={colors.mutedForeground} />
          <Text style={[s.homeLinkText, { color: colors.mutedForeground }]}>Back to Home</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit Cook Modal ──────────────────────────────────── */}
      <Modal visible={editVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditVisible(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <LinearGradient colors={["#1C1C1F", "#2D1A0E"]} style={[s.editHeader, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={() => setEditVisible(false)} style={s.editCancelBtn}>
              <Text style={s.editCancelText}>Cancel</Text>
            </Pressable>
            <Text style={s.editHeaderTitle}>Edit Cook</Text>
            <Pressable onPress={saveEdit} disabled={editSaving} style={s.editSaveBtn}>
              {editSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.editSaveText}>Save</Text>}
            </Pressable>
          </LinearGradient>
          <View style={[s.editFireBar, { backgroundColor: "#E84820" }]} />

          <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40, gap: 14 }} keyboardShouldPersistTaps="handled">

            {/* Food type */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>What did you cook?</Text>
              <TextInput
                style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="e.g. Brisket, Pork Butt, Ribs"
                placeholderTextColor={colors.mutedForeground}
                value={editFoodType}
                onChangeText={setEditFoodType}
              />
            </View>

            {/* Grill picker */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Grill / Smoker</Text>
              <Pressable
                onPress={() => setEditGrillPickerVisible(true)}
                style={[s.editInput, s.editPickerRow, { backgroundColor: colors.card, borderColor: editSelectedGrill ? "#6C3BF5" : colors.border, borderRadius: colors.radius }]}
              >
                {editSelectedGrill ? (
                  <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Feather name="check-circle" size={13} color="#6C3BF5" />
                    <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 }} numberOfLines={1}>
                      {editSelectedGrill.name ?? `${editSelectedGrill.brand} ${editSelectedGrill.model ?? ""}`.trim()}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ color: colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {grills.length === 0 ? "No grills in inventory" : "Select your grill…"}
                  </Text>
                )}
                <Feather name="chevron-down" size={14} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Weight / temps row */}
            <View style={s.editRow2}>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Weight (lbs)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="14" placeholderTextColor={colors.mutedForeground}
                  value={editWeight} onChangeText={setEditWeight} keyboardType="decimal-pad"
                />
              </View>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Cook Temp (°F)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="225" placeholderTextColor={colors.mutedForeground}
                  value={editCookTemp} onChangeText={setEditCookTemp} keyboardType="decimal-pad"
                />
              </View>
            </View>

            <View style={s.editRow2}>
              <View style={[s.editFieldWrap, { flex: 1 }]}>
                <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Target Temp (°F)</Text>
                <TextInput
                  style={[s.editInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                  placeholder="203" placeholderTextColor={colors.mutedForeground}
                  value={editTargetTemp} onChangeText={setEditTargetTemp} keyboardType="decimal-pad"
                />
              </View>
            </View>

            {/* Start time */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Start Time</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setEditStartDateOpen(true)}
                  style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="calendar" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualStartDate ? formatEditDate(editActualStartDate) : "Pick a date"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!editActualStartDate) setEditActualStartDate(new Date());
                    setEditStartTimeOpen(true);
                  }}
                  style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualStartDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="clock" size={13} color={editActualStartDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualStartDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualStartDate ? formatEditTime(editActualStartDate.getHours(), editActualStartDate.getMinutes()) : "Time"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* End time */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>End Time</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Pressable
                  onPress={() => setEditEndDateOpen(true)}
                  style={[s.editInput, s.editPickerBtn, { flex: 1, backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="calendar" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualEndDate ? formatEditDate(editActualEndDate) : "Pick a date"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    if (!editActualEndDate) setEditActualEndDate(new Date());
                    setEditEndTimeOpen(true);
                  }}
                  style={[s.editInput, s.editPickerBtn, { backgroundColor: colors.card, borderColor: editActualEndDate ? colors.primary : colors.border, borderRadius: colors.radius }]}
                >
                  <Feather name="clock" size={13} color={editActualEndDate ? colors.primary : colors.mutedForeground} />
                  <Text style={{ color: editActualEndDate ? colors.foreground : colors.mutedForeground, fontSize: 14, fontFamily: "Inter_400Regular" }}>
                    {editActualEndDate ? formatEditTime(editActualEndDate.getHours(), editActualEndDate.getMinutes()) : "Time"}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Notes */}
            <View style={s.editFieldWrap}>
              <Text style={[s.editLabel, { color: colors.mutedForeground }]}>Cook Notes</Text>
              <TextInput
                style={[s.editTextArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                placeholder="Anything worth remembering — wood type, rubs, what you'd do differently…"
                placeholderTextColor={colors.mutedForeground}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

          </ScrollView>
        </KeyboardAvoidingView>

        {/* ════ START DATE PICKER ════ */}
        <Modal visible={editStartDateOpen} animationType="slide" transparent onRequestClose={() => setEditStartDateOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>Start Date</Text>
                <Pressable onPress={() => setEditStartDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {editDates.map((d) => {
                  const sel = editActualStartDate && d.getDate() === editActualStartDate.getDate() && d.getMonth() === editActualStartDate.getMonth() && d.getFullYear() === editActualStartDate.getFullYear();
                  return (
                    <Pressable key={d.toISOString()} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualStartDate(n); setEditStartDateOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                      <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ START TIME PICKER ════ */}
        <Modal visible={editStartTimeOpen} animationType="slide" transparent onRequestClose={() => setEditStartTimeOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>Start Time</Text>
                <Pressable onPress={() => setEditStartTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {EDIT_TIME_SLOTS.map(({ h, m }) => {
                  const sel = editActualStartDate && editActualStartDate.getHours() === h && editActualStartDate.getMinutes() === m;
                  return (
                    <Pressable key={`s${h}:${m}`} onPress={() => { const n = editActualStartDate ? new Date(editActualStartDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualStartDate(n); setEditStartTimeOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ END DATE PICKER ════ */}
        <Modal visible={editEndDateOpen} animationType="slide" transparent onRequestClose={() => setEditEndDateOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>End Date</Text>
                <Pressable onPress={() => setEditEndDateOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {editDates.map((d) => {
                  const sel = editActualEndDate && d.getDate() === editActualEndDate.getDate() && d.getMonth() === editActualEndDate.getMonth() && d.getFullYear() === editActualEndDate.getFullYear();
                  return (
                    <Pressable key={d.toISOString()} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setFullYear(d.getFullYear(), d.getMonth(), d.getDate()); setEditActualEndDate(n); setEditEndDateOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditDate(d)}</Text>
                      <Text style={[edt.rowSub, { color: colors.mutedForeground }]}>{d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* ════ END TIME PICKER ════ */}
        <Modal visible={editEndTimeOpen} animationType="slide" transparent onRequestClose={() => setEditEndTimeOpen(false)}>
          <View style={edt.overlay}>
            <View style={[edt.sheet, { backgroundColor: colors.card }]}>
              <View style={[edt.handle, { backgroundColor: colors.border }]} />
              <View style={[edt.header, { borderBottomColor: colors.border }]}>
                <Text style={[edt.title, { color: colors.foreground }]}>End Time</Text>
                <Pressable onPress={() => setEditEndTimeOpen(false)} hitSlop={10}><Feather name="x" size={22} color={colors.mutedForeground} /></Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
                {EDIT_TIME_SLOTS.map(({ h, m }) => {
                  const sel = editActualEndDate && editActualEndDate.getHours() === h && editActualEndDate.getMinutes() === m;
                  return (
                    <Pressable key={`e${h}:${m}`} onPress={() => { const n = editActualEndDate ? new Date(editActualEndDate) : new Date(); n.setHours(h, m, 0, 0); setEditActualEndDate(n); setEditEndTimeOpen(false); }}
                      style={[edt.row, sel && { backgroundColor: colors.primary + "18" }, { borderRadius: colors.radius }]}>
                      <Text style={[edt.rowMain, { color: sel ? colors.primary : colors.foreground }]}>{formatEditTime(h, m)}</Text>
                      {sel && <Feather name="check" size={16} color={colors.primary} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Grill picker sub-modal */}
        <Modal visible={editGrillPickerVisible} transparent animationType="slide" onRequestClose={() => setEditGrillPickerVisible(false)}>
          <Pressable style={s.grillOverlay} onPress={() => setEditGrillPickerVisible(false)} />
          <View style={[s.grillSheet, { backgroundColor: colors.card }]}>
            <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />
            <Text style={[s.grillSheetTitle, { color: colors.foreground }]}>Select Grill</Text>
            {editGrillId != null && (
              <TouchableOpacity onPress={() => { setEditGrillId(null); setEditGrillPickerVisible(false); }} style={[s.grillItem, { borderBottomColor: colors.border }]}>
                <Text style={[s.grillItemText, { color: colors.destructive }]}>Clear selection</Text>
              </TouchableOpacity>
            )}
            {grills.length === 0 ? (
              <Text style={[s.grillEmpty, { color: colors.mutedForeground }]}>No grills in your inventory yet.</Text>
            ) : (
              <FlatList
                data={grills}
                keyExtractor={(g: any) => String(g.id)}
                renderItem={({ item: g }: { item: any }) => (
                  <TouchableOpacity
                    onPress={() => { setEditGrillId(g.id); setEditGrillPickerVisible(false); }}
                    style={[s.grillItem, { borderBottomColor: colors.border }, editGrillId === g.id && { backgroundColor: "#6C3BF5" + "12" }]}
                  >
                    <Text style={[s.grillItemText, { color: colors.foreground }]}>
                      {g.name ?? `${g.brand ?? ""} ${g.model ?? ""}`.trim()}
                    </Text>
                    {g.brand && <Text style={[s.grillItemSub, { color: colors.mutedForeground }]}>{g.brand}</Text>}
                    {editGrillId === g.id && <Feather name="check" size={16} color="#6C3BF5" style={{ marginLeft: "auto" }} />}
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </Modal>
      </Modal>

      {/* ── Set Alert Sheet ─────────────────────────────────── */}
      <Modal
        visible={alertSheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setAlertSheetVisible(false)}
      >
        <Pressable
          style={s.grillOverlay}
          onPress={() => setAlertSheetVisible(false)}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ justifyContent: "flex-end" }}
        >
          <View style={[s.alertSheet, { backgroundColor: colors.card }]}>
            <View style={[s.grillSheetHandle, { backgroundColor: colors.border }]} />
            <View style={[s.alertSheetHeader, { borderBottomColor: colors.border }]}>
              <Feather name="bell"  size={18} color="#EF4444" />
              <Text style={[s.grillSheetTitle, { color: colors.foreground, marginBottom: 0 }]}>
                Set Alert
              </Text>
              <Pressable onPress={() => setAlertSheetVisible(false)} style={{ marginLeft: "auto" }} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Mode toggle */}
            <View style={[s.alertModeRow, { backgroundColor: colors.background, borderRadius: colors.radius }]}>
              <Pressable
                style={[s.alertModeBtn, alertMode === "temp" && { backgroundColor: "#EF444418" }, { borderRadius: colors.radius - 2 }]}
                onPress={() => setAlertMode("temp")}
              >
                <Feather name="thermometer" size={14} color={alertMode === "temp" ? "#EF4444" : colors.mutedForeground} />
                <Text style={[s.alertModeBtnText, { color: alertMode === "temp" ? "#EF4444" : colors.mutedForeground }]}>
                  Temperature
                </Text>
              </Pressable>
              <Pressable
                style={[s.alertModeBtn, alertMode === "timer" && { backgroundColor: "#3B82F618" }, { borderRadius: colors.radius - 2 }]}
                onPress={() => setAlertMode("timer")}
              >
                <Feather name="clock" size={14} color={alertMode === "timer" ? "#3B82F6" : colors.mutedForeground} />
                <Text style={[s.alertModeBtnText, { color: alertMode === "timer" ? "#3B82F6" : colors.mutedForeground }]}>
                  Timer
                </Text>
              </Pressable>
            </View>

            {alertMode === "temp" ? (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                    Notify me when probe reaches (°F)
                  </Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                    placeholder={`e.g. ${(cook as any)?.targetTempF ?? 203}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={alertThreshold}
                    onChangeText={setAlertThreshold}
                    keyboardType="decimal-pad"
                    autoFocus
                  />
                </View>
                <View>
                  <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                    Custom label <Text style={{ fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                    placeholder={`e.g. Time to pull the ${(cook as any)?.foodType ?? "meat"}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={alertLabel}
                    onChangeText={setAlertLabel}
                  />
                </View>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                <View>
                  <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                    Alert me this many minutes before serve time
                  </Text>
                  <View style={s.alertTimerOptions}>
                    {["15", "30", "60", "90"].map((mins) => (
                      <Pressable
                        key={mins}
                        onPress={() => setAlertMinutesBefore(mins)}
                        style={[
                          s.alertTimerChip,
                          { borderColor: alertMinutesBefore === mins ? "#3B82F6" : colors.border },
                          alertMinutesBefore === mins && { backgroundColor: "#3B82F618" },
                          { borderRadius: colors.radius },
                        ]}
                      >
                        <Text style={[s.alertTimerChipText, { color: alertMinutesBefore === mins ? "#3B82F6" : colors.foreground }]}>
                          {mins} min
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius, marginTop: 8 }]}
                    placeholder="Or enter minutes"
                    placeholderTextColor={colors.mutedForeground}
                    value={alertMinutesBefore}
                    onChangeText={setAlertMinutesBefore}
                    keyboardType="number-pad"
                  />
                </View>
                {!(cook as any)?.plannedEndAt && (
                  <View style={[s.alertWarning, { backgroundColor: "#F59E0B12", borderColor: "#F59E0B30", borderRadius: colors.radius }]}>
                    <Feather name="alert-triangle" size={14} color="#F59E0B" />
                    <Text style={[s.alertWarningText, { color: "#F59E0B" }]}>
                      No serve time set. Edit this cook to add a planned serve time.
                    </Text>
                  </View>
                )}
                <View>
                  <Text style={[s.editLabel, { color: colors.mutedForeground }]}>
                    Custom label <Text style={{ fontWeight: "400" }}>(optional)</Text>
                  </Text>
                  <TextInput
                    style={[s.editInput, { backgroundColor: colors.background, borderColor: colors.border, color: colors.foreground, borderRadius: colors.radius }]}
                    placeholder={`e.g. Start resting the ${(cook as any)?.foodType ?? "meat"}`}
                    placeholderTextColor={colors.mutedForeground}
                    value={alertLabel}
                    onChangeText={setAlertLabel}
                  />
                </View>
              </View>
            )}

            <Pressable
              style={[
                s.analyzeBtn,
                { borderRadius: colors.radius, overflow: "hidden", backgroundColor: "#EF4444", opacity: alertSaving ? 0.7 : 1 },
              ]}
              onPress={saveAlert}
              disabled={alertSaving}
            >
              <View style={[s.analyzeBtnGradient, { backgroundColor: "transparent" }]}>
                {alertSaving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Feather name="bell"  size={16} color="#fff" />
                    <Text style={s.analyzeBtnText}>Save Alert</Text>
                  </>
                )}
              </View>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  goBackBtn: { marginTop: 16, padding: 12 },

  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 18, paddingBottom: 16, overflow: "hidden" },
  backBtn: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#F3EDE1", letterSpacing: -0.3 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerLogo: { width: 28, height: 28, opacity: 0.9 },
  delBtn: { padding: 4 },
  fireBar: { height: 2, backgroundColor: "#E84820" },

  statusBar: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontFamily: "Inter_700Bold", letterSpacing: 1 },

  card: { borderWidth: 1 },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 14 },
  rowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  rowValue: { fontSize: 14, fontFamily: "Inter_400Regular", maxWidth: "55%", textAlign: "right" },
  notesLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  notesText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, borderBottomWidth: 1 },
  sectionIconWrap: { width: 24, height: 24, borderRadius: 6, alignItems: "center", justifyContent: "center" },
  sectionHeaderLabel: { fontSize: 12, fontFamily: "Inter_700Bold", textTransform: "uppercase", letterSpacing: 0.8 },

  statTileRow: { flexDirection: "row", borderBottomWidth: 1 },
  statTile: { flex: 1, alignItems: "center", paddingVertical: 16, paddingHorizontal: 8 },
  statTileValue: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statTileLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },

  inlineGradeRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1 },
  inlineGradeBadge: { width: 40, height: 40, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  inlineGradeLetter: { fontSize: 20, fontFamily: "Inter_700Bold" },
  inlineGradeTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  inlineGradeSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  gradeBarTrackSmall: { height: 5, borderRadius: 3, overflow: "hidden" },

  detailsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderTopWidth: 1, paddingVertical: 12 },
  detailsToggleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  gradeCard: { borderWidth: 2, flexDirection: "row", alignItems: "center", padding: 16, gap: 16 },
  gradeLeft: { alignItems: "center", minWidth: 52 },
  gradeLetter: { fontSize: 44, fontFamily: "Inter_700Bold", lineHeight: 50 },
  gradeNote: { fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center", marginTop: 2 },
  gradeRight: { flex: 1, gap: 6 },
  gradeTitle: { fontSize: 13, fontFamily: "Inter_700Bold" },
  gradeBarTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  gradeBarFill: { height: 6, borderRadius: 3 },
  gradeDeviation: { fontSize: 12, fontFamily: "Inter_400Regular" },

  logSection: { borderWidth: 1, padding: 16, gap: 14 },
  logHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  logIconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 2 },
  logTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  logSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17, marginTop: 3 },

  photoBtns: { flexDirection: "row", gap: 10 },
  photoBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, paddingVertical: 10 },
  photoBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  thumbRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { position: "relative" },
  thumbImg: { width: 72, height: 72, borderRadius: 8 },
  thumbDel: { position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  addMoreThumb: { width: 72, height: 72, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed" },

  notesInputLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 6 },
  notesInput: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 80 },

  analyzeBtn: { overflow: "hidden" },
  analyzeBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, height: 50 },
  analyzeBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  results: { borderTopWidth: 1, paddingTop: 16, gap: 14 },

  verdictBanner: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  verdictLabel: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  verdictSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  verdictPill: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  verdictPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  storedSummary: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  graphWrap: { borderWidth: 1, padding: 12, overflow: "hidden" },

  subSection: { borderTopWidth: 1, paddingTop: 12, gap: 0 },
  subLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  collapsibleRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  countPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  countPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  sectionPreview: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 4, opacity: 0.8 },

  probeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, paddingVertical: 10 },
  probeName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  probeRange: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  probeFinish: { fontSize: 22, fontFamily: "Inter_700Bold" },

  eventRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderTopWidth: 1, paddingVertical: 10 },
  eventIconWrap: { width: 26, height: 26, borderRadius: 6, alignItems: "center", justifyContent: "center", marginTop: 1 },
  eventDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  eventTime: { fontSize: 12, fontFamily: "Inter_500Medium", paddingTop: 4 },

  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, paddingBottom: 6 },
  bulletNum: { fontSize: 13, fontFamily: "Inter_700Bold", minWidth: 16 },
  bulletText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  noDataRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  noDataText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  phaseCard: { borderWidth: 1, padding: 14, gap: 10 },
  phaseChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  phaseChipText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  phaseNarrative: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  phaseChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  timeChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  timeChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },

  decisionsSection: { gap: 10 },
  decisionCard: { borderWidth: 1, padding: 14, gap: 8 },
  decisionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  decisionActionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  decisionActionText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  decisionUrgencyBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  decisionUrgencyText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  decisionInstruction: { fontSize: 15, fontFamily: "Inter_600SemiBold", lineHeight: 22 },
  decisionRationale: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },

  alertBtnRow: { borderTopWidth: 1, padding: 12, flexDirection: "row" },
  setAlertBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  setAlertBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertCountBadge: { minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  alertCountText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff" },
  alertSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, gap: 16, maxHeight: "85%" },
  alertSheetHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, paddingBottom: 14 },
  alertModeRow: { flexDirection: "row", padding: 3, gap: 2 },
  alertModeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  alertModeBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertTimerOptions: { flexDirection: "row", gap: 8, marginBottom: 0 },
  alertTimerChip: { flex: 1, alignItems: "center", paddingVertical: 10, borderWidth: 1 },
  alertTimerChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  alertWarning: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderWidth: 1 },
  alertWarningText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },

  persistentDecisionBanner: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 8,
  },
  persistentDecisionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  persistentUrgencyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  persistentUrgencyText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    letterSpacing: 0.6,
  },
  persistentDecisionLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  persistentDecisionInstruction: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    lineHeight: 23,
  },
  persistentDecisionRationale: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    lineHeight: 19,
  },

  keyTakeawayCard: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 6,
  },
  keyTakeawayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  keyTakeawayLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  keyTakeawayText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    lineHeight: 21,
  },

  historySection: { borderWidth: 1, padding: 16, gap: 0 },
  historyEntry: { paddingTop: 12, gap: 8 },
  historyEntryHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  historyIndex: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  historyIndexText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  historyTimestamp: { fontSize: 13, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  historyMeta: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  historyMetaChip: { fontSize: 11, fontFamily: "Inter_400Regular" },
  historyVerdictBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  historyVerdictText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  historyDecision: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  historyDecisionDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  historyDecisionText: { fontSize: 13, fontFamily: "Inter_500Medium", flex: 1, lineHeight: 19 },
  historyPhase: { fontSize: 12, fontFamily: "Inter_400Regular" },
  historySummary: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  historyNotes: { fontSize: 11, fontFamily: "Inter_400Regular", fontStyle: "italic" },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, borderTopWidth: 1, paddingTop: 10 },
  metaPill: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  actionBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, height: 52 },
  actionText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff" },
  homeLink: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8 },
  homeLinkText: { fontSize: 13, fontFamily: "Inter_400Regular" },

  editBtn: { padding: 4 },
  gradePrompt: { flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, padding: 14 },
  gradePromptTitle: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  gradePromptSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },

  editHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingBottom: 16, gap: 10 },
  editFireBar: { height: 2 },
  editCancelBtn: { minWidth: 60 },
  editCancelText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#F3EDE1", opacity: 0.8 },
  editHeaderTitle: { flex: 1, textAlign: "center", fontSize: 17, fontFamily: "Inter_700Bold", color: "#F3EDE1" },
  editSaveBtn: { minWidth: 60, alignItems: "flex-end" },
  editSaveText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#FF6B2B" },
  editFieldWrap: { gap: 6 },
  editLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
  editInput: { borderWidth: 1, height: 44, paddingHorizontal: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  editPickerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  editRow2: { flexDirection: "row", gap: 12 },
  editTextArea: { borderWidth: 1, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", minHeight: 100, lineHeight: 20 },
  nowBtn: { borderWidth: 1, height: 44, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  nowBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  editPickerBtn: { flexDirection: "row", alignItems: "center", gap: 7 },

  timerRow: { flexDirection: "row", gap: 10, padding: 14, borderTopWidth: 1 },
  timerChip: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  timerValue: { fontSize: 17, fontFamily: "Inter_700Bold" },
  timerLabel: { fontSize: 10, fontFamily: "Inter_500Medium", marginTop: 1 },
  liveGraphWrap: { borderTopWidth: 1, padding: 14 },
  weatherStrip: { flexDirection: "row", alignItems: "center", gap: 7, borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  weatherTemp: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  weatherCondition: { fontSize: 12, fontFamily: "Inter_400Regular" },
  weatherText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  meaterPlaceholder: { borderTopWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  meaterPlaceholderText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  grillOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  grillSheet: { maxHeight: "65%", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  grillSheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  grillSheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  grillItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1 },
  grillItemText: { fontSize: 15, fontFamily: "Inter_500Medium", flex: 1 },
  grillItemSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginRight: 8 },
  grillEmpty: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingVertical: 20 },

  connectedBadgeSmall: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 5 },
  liveIndicator: { width: 7, height: 7, borderRadius: 99 },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  meaterTempsRow: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  meaterTempChip: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 90 },
  meaterTempValue: { fontSize: 18, fontFamily: "Inter_700Bold" },
  meaterTempLabel: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  meaterAutoFillBadge: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 8 },
  meaterAutoFillText: { fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 },

  ratingsSummary: { flexDirection: "row", alignItems: "center", gap: 10, marginLeft: "auto" },
  ratingsSummaryChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratingsSummaryLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  ratingsSummaryStars: { fontSize: 11, letterSpacing: -1 },

  rateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 13, borderTopWidth: 1 },
  rateRowLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  rateRowLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  starsRow: { flexDirection: "row", gap: 6 },
  star: { fontSize: 28, lineHeight: 32 },

  seqScheduleHeader: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 13,
  },
  seqScheduleIcon: {
    width: 30, height: 30, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  seqScheduleTitle: { fontSize: 14, fontFamily: "Inter_700Bold" },
  seqScheduleSub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  seqScheduleItem: {
    borderWidth: 1, borderRadius: 10, padding: 10,
  },
  seqScheduleItemHeader: {
    flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10,
  },
  seqScheduleItemIcon: {
    width: 24, height: 24, borderRadius: 6,
    alignItems: "center", justifyContent: "center",
  },
  seqScheduleItemTitle: { fontSize: 13, fontFamily: "Inter_700Bold", flex: 1 },
  seqScheduleCurrentBadge: {
    backgroundColor: "#6C3BF520", borderRadius: 5,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  seqScheduleCurrentText: {
    fontSize: 9, fontFamily: "Inter_700Bold", color: "#6C3BF5", letterSpacing: 0.5,
  },
  seqTlRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8,
  },
  seqTlNextRow: {
    backgroundColor: "transparent",
    borderRadius: 8,
    paddingHorizontal: 6, paddingVertical: 4,
    marginHorizontal: -6,
  },
  seqTlLabelRow: {
    flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 1,
  },
  seqTlNextBadge: {
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1,
  },
  seqTlNextText: {
    fontSize: 8, fontFamily: "Inter_700Bold", letterSpacing: 0.5,
  },
  seqTlDot: {
    width: 10, height: 10, borderRadius: 5, marginTop: 4, flexShrink: 0,
  },
  seqTlDotBtn: {
    width: 14, height: 14, marginTop: 2, flexShrink: 0, alignItems: "center", justifyContent: "center",
  },
  seqTlConnector: {
    width: 1, backgroundColor: "transparent",
    borderLeftWidth: 1, borderColor: "#3f3f46", borderStyle: "dashed",
    position: "absolute", left: 8, top: 14, bottom: -8,
  },
  seqTlLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  seqTlDoneRow: {
    opacity: 0.6,
  },
  seqTlDoneLabel: {
    textDecorationLine: "line-through",
  },
  seqTlTime: { fontSize: 14, fontFamily: "Inter_700Bold" },
  seqTlMeta: { fontSize: 11, fontFamily: "Inter_400Regular" },
  seqTlNoteBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    borderRadius: 7, padding: 8, marginTop: 8,
  },
  seqTlNoteText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },

  stepToastHitArea: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    zIndex: 99,
  },
  stepToast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
  stepToastLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  stepToastText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },

});

const edt = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 10, maxHeight: "70%" },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1 },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 14, gap: 10 },
  rowMain: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
});
