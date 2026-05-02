import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
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
  LogBox,
  AppState,
  type AppStateStatus,
} from "react-native";
import { fmtMinutes } from "@/utils/duration";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
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
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { BlurredProSection } from "@/components/BlurredProSection";

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

import { s } from "@/components/cook-detail/styles";
import {
  STATUS_COLORS,
  VERDICT_CONFIG,
} from "@/components/cook-detail/constants";
import {
  getEditDates,
  computeNextStep,
} from "@/components/cook-detail/utils";
import type {
  PickedImage,
  Assessment,
  PhasePrediction,
  Decision,
  AnalysisResult,
  ScheduleItem,
  SequenceData,
  NextStep,
} from "@/components/cook-detail/types";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { AlertSheet } from "@/components/cook-detail/AlertSheet";
import { CheckInHistory } from "@/components/cook-detail/CheckInHistory";
import { LastDecisionBanner } from "@/components/cook-detail/LastDecisionBanner";
import { LiveCookSection } from "@/components/cook-detail/LiveCookSection";
import { CookSummaryCard } from "@/components/cook-detail/CookSummaryCard";
import { SequenceSchedule } from "@/components/cook-detail/SequenceSchedule";
import { StoredAiAnalysis } from "@/components/cook-detail/StoredAiAnalysis";
import { AskPitMaster } from "@/components/cook-detail/AskPitMaster";
import { RateThisCook } from "@/components/cook-detail/RateThisCook";
import { NextUpBanner } from "@/components/NextUpBanner";

// Silence a dev-only LogBox warning that can fire from RN's measureLayout when
// the underlying native node briefly detaches between layout passes. Our
// auto-scroll uses cached onLayout offsets and never calls measureLayout, but
// other libraries occasionally trigger the same warning.
LogBox.ignoreLogs(["ref.measureLayout must be called with a ref"]);

const logoImg = require("@/assets/images/logo.png");

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
  const effectivePro = useEffectivePro();
  // Used to suppress the Cook Coach blur during the brief Phase-1→Phase-2 RC
  // window on first install (no SecureStore cache yet). Without this, a Pro
  // user reopening the app for the first time after install would see the
  // paywall blur flash for ~1s before isPro flips to true.
  const { isIdentityLinked } = useSubscription();

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

  // ── Step-change tracking ──────────────────────────────────────────────────
  // The persistent NextUpBanner replaces the old transient step-change toast.
  // We still fire a haptic when the next step transitions; this ref lets that
  // effect tell whether the step actually changed (vs. nowMs ticking).
  const prevNextStepKeyRef = useRef<string | null | undefined>(undefined);

  // Track when this screen is mounted so the global notification handler can
  // suppress schedule-step system banners in favour of the in-app banner.
  useEffect(() => {
    setCookDetailVisible(true);
    return () => setCookDetailVisible(false);
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

  // Haptic-only on next-step transition (active cooks only). The visual cue is
  // now the persistent NextUpBanner mounted below the screen header.
  // prevNextStepKeyRef starts as undefined so the initial mount is skipped.
  useEffect(() => {
    if (prevNextStepKeyRef.current === undefined) {
      prevNextStepKeyRef.current = nextStepKey;
      return;
    }
    const prev = prevNextStepKeyRef.current;
    prevNextStepKeyRef.current = nextStepKey;
    if (nextStepKey === prev || !nextStepKey || cookStatus !== "active") return;

    if (Platform.OS !== "web") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  }, [nextStepKey, cookStatus]);

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

  // Auto-grade pause flag. Starts as true (closed) so the timer cannot
  // fire before paywallUsage resolves. The paywallUsage sync effect below
  // opens it only for Pro users (unlimited === true). Free users stay
  // paused indefinitely; Pro users are unpaused as soon as usage loads.
  const [autoGradePaused, setAutoGradePaused] = useState(true);

  // Local "last analyzed at" timestamp used to schedule the next auto-grade.
  // Seeded from cook.analysisResult.analyzedAt / analysisHistory and bumped
  // whenever an analyze (manual OR auto) finishes successfully.
  const [lastAnalyzedAtMs, setLastAnalyzedAtMs] = useState<number | null>(null);

  const analyze = async (opts: { auto?: boolean } = {}) => {
    const auto = opts.auto === true;
    const hasTemp = userTempInput.trim().length > 0 && !isNaN(parseFloat(userTempInput));
    // For auto-grade ticks, a live MEATER probe temperature counts as
    // gradeable input on its own (the analyze API also forwards live
    // probe data via cookContext), even if the user has cleared the
    // userTempInput field.
    const hasMeaterTemp =
      meaterProbes.length > 0 && meaterProbes[0]?.internalTempF != null;
    const hasAnyInput = images.length > 0 || cookNotes.trim().length > 0 || hasTemp;
    if (!hasAnyInput && !(auto && hasMeaterTemp)) {
      if (auto) return; // silent skip — nothing useful to grade right now
      if (cookStatus === "active") {
        Alert.alert("Nothing to check in with", "Enter your current probe temperature or add a note about what's happening on the cook.");
      } else {
        Alert.alert("Add something", "Upload a thermometer image, enter your temperature reading, or add cook notes before analyzing.");
      }
      return;
    }
    // No client-side lifetime gradedCooks gate. Manual analyze is bounded only
    // by the server-enforced daily AI scan cap (3/day for free users). On 402
    // responses, the existing parseAndShowFromError path surfaces the
    // ai_analyze_limit_reached paywall modal.
    // Auto-grade ticks are gated upstream: the 30-min timer cannot fire for
    // free users because autoGradePaused starts true and the paywallUsage
    // sync effect only opens it for Pro accounts.
    if (!auto) {
      setAnalyzing(true);
      setResult(null);
    }
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
      // Bump local clock — this both surfaces "Updated X min ago" UI and
      // resets the 30-min auto-grade timer regardless of which path ran.
      setLastAnalyzedAtMs(Date.now());
      // Successful grade → only lift the auto-grade pause for Pro users.
      // Free users must stay paused; a successful manual grade must not
      // re-enable the 30-min timer for non-Pro accounts.
      if (paywallUsage?.unlimited) setAutoGradePaused(false);
      if (!auto) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (auto) {
        // Silent path: detect 402 paywall to pause auto-grading; swallow
        // every other error (network, AI failure, etc.) so the user is
        // never alerted by a background grade attempt.
        const status =
          (e as any)?.status ?? (e as any)?.statusCode ?? (e as any)?.response?.status ?? null;
        if (status === 402) setAutoGradePaused(true);
        return;
      }
      // Free user hit the daily AI scan cap → upgrade modal.
      // Pass foodType so the modal headline can personalize ("Want PitMaster's tips on your brisket?")
      // while still preserving the server-derived trigger and subtitle from the 402 payload.
      if (parseAndShowFromError(e, { foodType: c?.foodType ?? null })) return;
      Alert.alert("Analysis failed", "Could not analyze the cook. Please check your connection and try again.");
    } finally {
      if (!auto) setAnalyzing(false);
    }
  };

  // ── Auto-grade scheduling ────────────────────────────────────────────
  // Live cooks (status === "active") get a fresh PitMaster grade every
  // 30 minutes while the screen is mounted and the app is foregrounded.
  // Pause conditions: cook isn't active, autoGradePaused (paywall hit),
  // or app is backgrounded. Manual analyze still works at any time and
  // resets the timer when it succeeds.
  const AUTO_GRADE_INTERVAL_MS = 30 * 60 * 1000;

  // Seed lastAnalyzedAtMs from whatever the server has stored. Keep the
  // larger of (server timestamp, current local timestamp) so that a fresh
  // local analyze isn't clobbered by a delayed refetch.
  useEffect(() => {
    const c2 = cook as any;
    const stored = c2?.analysisResult?.analyzedAt as string | null | undefined;
    const hist = Array.isArray(c2?.analysisHistory) ? c2.analysisHistory : [];
    const histLast = hist.length > 0
      ? (hist[hist.length - 1]?.savedAt ?? hist[hist.length - 1]?.analyzedAt ?? null)
      : null;
    const raw = stored ?? histLast ?? null;
    if (!raw) return;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) return;
    setLastAnalyzedAtMs((prev) => (prev != null && prev > ms ? prev : ms));
  }, [
    (cook as any)?.id,
    (cook as any)?.analysisResult?.analyzedAt,
    (cook as any)?.analysisHistory?.length,
  ]);

  // Sync auto-grade pause with subscription state:
  // - Pro (unlimited) → lift any existing pause.
  // - Free → proactively pause so the 30-min timer never fires for non-Pro users.
  useEffect(() => {
    if (paywallUsage?.unlimited) {
      setAutoGradePaused(false);
    } else if (paywallUsage && !paywallUsage.unlimited) {
      setAutoGradePaused(true);
    }
  }, [paywallUsage?.unlimited]);

  // Foreground/background tracking for the timer.
  const [appActive, setAppActive] = useState<boolean>(
    AppState.currentState === "active",
  );
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  // Screen focus tracking — auto-grading must pause when the user
  // navigates away from the cook detail screen, even if the screen
  // is still mounted (Expo Router can keep route components mounted
  // while another screen is on top).
  const [isFocused, setIsFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  // Stable ref to analyze + the data the auto tick reads, so the timer
  // effect can have a small, stable dependency list.
  const autoTickRef = useRef<{
    analyze: typeof analyze;
    cookNotes: string;
    userTempInput: string;
    meaterProbes: typeof meaterProbes;
    analyzing: boolean;
  }>({ analyze, cookNotes, userTempInput, meaterProbes, analyzing });
  useEffect(() => {
    autoTickRef.current = { analyze, cookNotes, userTempInput, meaterProbes, analyzing };
  });

  useEffect(() => {
    if (cookStatus !== "active") return;
    if (autoGradePaused) return;
    if (!appActive) return;
    if (!isFocused) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tick = async () => {
      if (cancelled) return;
      const cur = autoTickRef.current;
      // If a manual analyze is in flight, defer one full interval so we
      // don't double-fire — the manual call will bump lastAnalyzedAtMs
      // and re-schedule us via the deps below anyway.
      if (cur.analyzing) {
        timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS);
        return;
      }
      // Skip silently when nothing is gradeable. Do not consume an analyze
      // call against the user's free-tier cap on empty data.
      const hasUserTemp =
        cur.userTempInput.trim().length > 0 && !isNaN(parseFloat(cur.userTempInput));
      const hasMeaterTemp =
        cur.meaterProbes.length > 0 && cur.meaterProbes[0]?.internalTempF != null;
      const hasNotes = cur.cookNotes.trim().length > 0;
      if (!hasUserTemp && !hasMeaterTemp && !hasNotes) {
        timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS);
        return;
      }
      try {
        await cur.analyze({ auto: true });
      } catch {
        // analyze handles its own auto-mode errors; never bubble.
      }
      if (cancelled) return;
      timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS);
    };

    const elapsed =
      lastAnalyzedAtMs != null ? Date.now() - lastAnalyzedAtMs : Infinity;
    const wait =
      elapsed >= AUTO_GRADE_INTERVAL_MS ? 0 : AUTO_GRADE_INTERVAL_MS - elapsed;
    timer = setTimeout(tick, wait);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [cookStatus, autoGradePaused, appActive, isFocused, lastAnalyzedAtMs, AUTO_GRADE_INTERVAL_MS]);

  // Open paywall from the auto-grade banner upgrade tap. Use the
  // pro_required trigger with a feature name so the modal headline reads
  // "Live auto-grading is a Pro feature" — accurate framing, since this
  // banner is about the every-30-minute live grade being Pro-only, not
  // about hitting a lifetime cap.
  const onUpgradeAutoGradePress = useCallback(() => {
    showPaywall({
      trigger: "pro_required",
      featureName: "Live auto-grading",
      foodType: (cook as any)?.foodType ?? null,
    });
  }, [showPaywall, cook]);

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

      {/* ── Persistent "Next Up" banner (active cooks with a schedule) ─── */}
      <NextUpBanner
        nextStep={nextStep}
        cookSeqData={cookSeqData}
        nowMs={nowMs}
      />

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
        <LiveCookSection
          c={c}
          colors={colors}
          weather={weather}
          meaterLinked={meaterLinked}
          meaterProbes={meaterProbes}
          thermoworksLinked={thermoworksLinked}
          thermoworksProbes={thermoworksProbes}
          liveGraphProbes={liveGraphProbes}
          liveReadings={liveReadings}
          cardWidth={cardWidth}
          elapsedMs={elapsedMs}
          remainingMs={remainingMs}
          userTempEdited={userTempEdited}
          setAlertSheetVisible={setAlertSheetVisible}
          setAlertMode={setAlertMode}
          activeCookAlerts={activeCookAlerts}
        />
        <LastDecisionBanner c={c} colors={colors} />
        <CookSummaryCard
          c={c}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          showCookDetails={showCookDetails}
          setShowCookDetails={setShowCookDetails}
        />
        <SequenceSchedule
          c={c}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          nextStep={nextStep}
          seqScheduleExpanded={seqScheduleExpanded}
          setSeqScheduleExpanded={setSeqScheduleExpanded}
          confirmedSteps={confirmedSteps}
          toggleConfirmedStep={toggleConfirmedStep}
          scheduleListYRef={scheduleListYRef}
          itemYRef={itemYRef}
          timelineYRef={timelineYRef}
          rowYRef={rowYRef}
        />

        {/* ── Stored AI analysis ──────────────────────────────── */}
        <StoredAiAnalysis
          c={c}
          colors={colors}
          storedAnalysis={storedAnalysis}
          storedAssessment={storedAssessment}
          storedVerdictCfg={storedVerdictCfg}
          storedGraphProbes={storedGraphProbes}
          cardWidth={cardWidth}
          nowMs={nowMs}
          isIdentityLinked={isIdentityLinked}
          effectivePro={effectivePro}
          expandedStoredSections={expandedStoredSections}
          toggleStoredSection={toggleStoredSection}
          showPaywall={showPaywall}
          onCardLayout={onCardLayout}
        />

        {/* ── Ask PitMaster (active cooks only) ───────────────── */}
        <AskPitMaster
          c={c}
          colors={colors}
          meaterLinked={meaterLinked}
          meaterProbes={meaterProbes}
          userTempInput={userTempInput}
          setUserTempInput={setUserTempInput}
          userTempEdited={userTempEdited}
          setUserTempEdited={setUserTempEdited}
          pitTempInput={pitTempInput}
          setPitTempInput={setPitTempInput}
          cookNotes={cookNotes}
          setCookNotes={setCookNotes}
          paywallUsage={paywallUsage}
          autoGradePaused={autoGradePaused}
          onUpgradeAutoGradePress={onUpgradeAutoGradePress}
          analyzing={analyzing}
          analyze={analyze}
          lastAnalyzedAtMs={lastAnalyzedAtMs}
          nowMs={nowMs}
          result={result}
          renderDecisions={renderDecisions}
          verdictCfg={verdictCfg}
          assessment={assessment}
          onCardLayout={onCardLayout}
        />

        {/* ── Rate This Cook (completed cooks only) ──────────── */}
        <RateThisCook
          c={c}
          colors={colors}
          rateTenderness={rateTenderness}
          setRateTenderness={setRateTenderness}
          rateFlavor={rateFlavor}
          setRateFlavor={setRateFlavor}
          rateBark={rateBark}
          setRateBark={setRateBark}
          rateSaving={rateSaving}
          saveRatings={saveRatings}
        />


        {/* ── Check-in History ─────────────────────────────── */}
        <CheckInHistory c={c} colors={colors} />

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

        <Pressable onPress={goHome} style={s.homeLink}>
          <Feather name="home" size={14} color={colors.mutedForeground} />
          <Text style={[s.homeLinkText, { color: colors.mutedForeground }]}>Back to Home</Text>
        </Pressable>
      </ScrollView>

      {/* ── Edit Cook Modal ──────────────────────────────────── */}
      <EditCookModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        colors={colors}
        insets={insets}
        saveEdit={saveEdit}
        editSaving={editSaving}
        editFoodType={editFoodType}
        setEditFoodType={setEditFoodType}
        editSelectedGrill={editSelectedGrill}
        grills={grills}
        setEditGrillPickerVisible={setEditGrillPickerVisible}
        editGrillPickerVisible={editGrillPickerVisible}
        editGrillId={editGrillId}
        setEditGrillId={setEditGrillId}
        editWeight={editWeight}
        setEditWeight={setEditWeight}
        editCookTemp={editCookTemp}
        setEditCookTemp={setEditCookTemp}
        editTargetTemp={editTargetTemp}
        setEditTargetTemp={setEditTargetTemp}
        editActualStartDate={editActualStartDate}
        setEditActualStartDate={setEditActualStartDate}
        editActualEndDate={editActualEndDate}
        setEditActualEndDate={setEditActualEndDate}
        editStartDateOpen={editStartDateOpen}
        setEditStartDateOpen={setEditStartDateOpen}
        editStartTimeOpen={editStartTimeOpen}
        setEditStartTimeOpen={setEditStartTimeOpen}
        editEndDateOpen={editEndDateOpen}
        setEditEndDateOpen={setEditEndDateOpen}
        editEndTimeOpen={editEndTimeOpen}
        setEditEndTimeOpen={setEditEndTimeOpen}
        editDates={editDates}
        editNotes={editNotes}
        setEditNotes={setEditNotes}
      />

      {/* ── Set Alert Sheet ─────────────────────────────────── */}
      <AlertSheet
        visible={alertSheetVisible}
        onClose={() => setAlertSheetVisible(false)}
        colors={colors}
        cook={cook}
        alertMode={alertMode}
        setAlertMode={setAlertMode}
        alertThreshold={alertThreshold}
        setAlertThreshold={setAlertThreshold}
        alertLabel={alertLabel}
        setAlertLabel={setAlertLabel}
        alertMinutesBefore={alertMinutesBefore}
        setAlertMinutesBefore={setAlertMinutesBefore}
        alertSaving={alertSaving}
        saveAlert={saveAlert}
      />
    </View>
  );
}

