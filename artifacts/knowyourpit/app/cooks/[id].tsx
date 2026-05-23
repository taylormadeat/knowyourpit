import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { PROBE_POLL_INTERVAL_MS } from "@/constants/polling";
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
import { useLayout } from "@/hooks/useLayout";
import { useAuth } from "@clerk/expo";
import { useScheduleStepNotifications } from "@/hooks/useScheduleStepNotifications";
import {
  useFrozenStageNotifications,
  cancelStoredFrozenNotifications,
  scheduleFrozenStageNotifications,
  type FrozenStageData,
} from "@/hooks/useFrozenStageNotifications";
import { useSpritzNotifications, computeNextSpritzMs } from "@/hooks/useSpritzNotifications";
import { setCookDetailVisible, setCurrentCookId } from "@/hooks/cookDetailVisibility";
import { consumePendingCheckin } from "@/lib/pendingCheckinNotif";
import { useCookLiveActivity } from "@/hooks/useCookLiveActivity";
import { LogoBackground } from "@/components/LogoBackground";
import { TempGraph, ProbeTimeSeries } from "@/components/TempGraph";
import { useAmbientWeather, weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import { usePaywall, type ShowOptions } from "@/contexts/PaywallContext";
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
  type Cook,
  type Grill,
  type UpdateCookBody,
  useGetMeaterReadings,
  useGetThermoworksReadings,
  useListAlerts,
  useCreateAlert,
  usePatchAlert,
  useListCooks,
  useListCookCheckins,
  useCreateCookCheckin,
  useListCookPhotos,
  getListCooksQueryKey,
  getGetCookQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  getListAlertsQueryKey,
  getGetMeaterReadingsQueryKey,
  getGetThermoworksReadingsQueryKey,
  getListCookCheckinsQueryKey,
} from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import {
  COMPETITION_CATEGORY_LABEL,
  COMPETITION_CATEGORY_COLOR,
  COMPETITION_SCORING,
  computePercentile,
  placementLabel,
  type CompetitionCategory,
} from "@/constants/competitionKnowledge";

import { s } from "@/components/cook-detail/styles";
import {
  STATUS_COLORS,
  VERDICT_CONFIG,
} from "@/components/cook-detail/constants";
import {
  getEditDates,
  computeNextStep,
  rippleScheduleTimestamps,
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

import {
  useCheckinNotifications,
  useCheckinDeepLink,
  rescheduleCheckinNotifications,
  cancelStoredCheckinNotifications,
  cancelCheckinNotificationForPhase,
  scheduleCheckinNotifications,
  loadRemovedCheckinPhaseKeys,
} from "@/hooks/useCheckinNotifications";
import { useAutoCheckin, type AutoCheckinProbeReading } from "@/hooks/useAutoCheckin";
import {
  scheduleStepNotifications,
  cancelStoredStepNotifications,
} from "@/hooks/useScheduleStepNotifications";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import { getCheckinSchedule, generateCheckinSchedule } from "@/constants/checkinKnowledge";
import type { CookCheckin } from "@workspace/api-client-react";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_SPRITZ_LIQUIDS,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";
import { WrapTempSheet } from "@/components/cook-detail/WrapTempSheet";
import { ActualVsPlannedRecap } from "@/components/cook-detail/ActualVsPlannedRecap";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { EditCookTimesSheet } from "@/components/cook-detail/EditCookTimesSheet";
import { AddToPlannedCookModal } from "@/components/cook-detail/AddToPlannedCookModal";
import { AlertSheet } from "@/components/cook-detail/AlertSheet";
import { CheckInHistory } from "@/components/cook-detail/CheckInHistory";
import { CheckinModal } from "@/components/cook-detail/CheckinModal";
import { CookCheckinTimeline, CookJourneyReplay } from "@/components/cook-detail/CookCheckinTimeline";
import { LiveCookSection } from "@/components/cook-detail/LiveCookSection";
import { CookSummaryCard } from "@/components/cook-detail/CookSummaryCard";
import { SequenceSchedule } from "@/components/cook-detail/SequenceSchedule";
import { FrozenTimeline } from "@/components/cook-detail/FrozenTimeline";
import { PlannedCookTimeline } from "@/components/cook-detail/PlannedCookTimeline";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";
import { StoredAiAnalysis } from "@/components/cook-detail/StoredAiAnalysis";
import { AskPitMaster } from "@/components/cook-detail/AskPitMaster";
import { RateThisCook } from "@/components/cook-detail/RateThisCook";
import { ShareCookButton } from "@/components/cook-detail/ShareCookButton";
import { NextUpBanner } from "@/components/NextUpBanner";
import { QuickLogSheet } from "@/components/cook-detail/QuickLogSheet";
import { CookHealthScoreCard } from "@/components/cook-detail/CookHealthScoreCard";
import { PitJournalFeed } from "@/components/cook-detail/PitJournalFeed";
import { CookPhotosSection } from "@/components/cook-detail/CookPhotosSection";
import { useProactiveAlerts } from "@/hooks/useProactiveAlerts";
import { getListCookEventsQueryKey } from "@workspace/api-client-react";

// Silence a dev-only LogBox warning that can fire from RN's measureLayout when
// the underlying native node briefly detaches between layout passes. Our
// auto-scroll uses cached onLayout offsets and never calls measureLayout, but
// other libraries occasionally trigger the same warning.
LogBox.ignoreLogs(["ref.measureLayout must be called with a ref"]);

const logoImg = require("@/assets/images/logo.png");

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export default function CookDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { getToken } = useAuth();
  const { data: cook, isLoading, dataUpdatedAt: cookDataUpdatedAt } = useGetCook(Number(id));
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

  const { data: cookPhotos = [] } = useListCookPhotos(Number(id));
  const cookPhotoCount = Array.isArray(cookPhotos) ? cookPhotos.length : 0;

  const [images, setImages] = useState<PickedImage[]>([]);
  const [cookNotes, setCookNotes] = useState("");

  // Quick-pick chip state for the scanner "describe the cook" section
  const [qpMethod, setQpMethod] = useState<string | null>(null);
  const [qpStartTemp, setQpStartTemp] = useState<string | null>(null);
  const [qpInjection, setQpInjection] = useState<string | null>(null);
  const [qpSpritz, setQpSpritz] = useState<string | null>(null);
  const [qpSpritzLiquid, setQpSpritzLiquid] = useState<string | null>(null);
  const [qpWrap, setQpWrap] = useState<string | null>(null);
  const [activeCookNoteTags, setActiveCookNoteTags] = useState<string[]>([]);

  // Seed quick-pick chips from the cook record on first non-null load so the
  // "Describe the cook" section reflects the user's saved technique choices.
  const qpSeededRef = useRef(false);
  useEffect(() => {
    if (qpSeededRef.current) return;
    const c = cook as any;
    if (!c) return;
    qpSeededRef.current = true;
    if (c.cookingMethod) setQpMethod(c.cookingMethod);
    if (c.injection) setQpInjection(c.injection);
    if (c.spritzFrequency) setQpSpritz(c.spritzFrequency);
    if (c.spritzLiquid) setQpSpritzLiquid(c.spritzLiquid);
    if (c.wrapFinish) setQpWrap(c.wrapFinish);
  }, [cook]);

  // Serialise chip selections into a natural-language string sent to the AI
  const scanNotes = useMemo(() => {
    const parts: string[] = [];
    if (qpMethod) parts.push(`Method: ${qpMethod}`);
    if (qpStartTemp) parts.push(`Starting temp: ${qpStartTemp}`);
    if (qpInjection) parts.push(`Injection: ${qpInjection}`);
    if (qpSpritz) parts.push(`Spritz: ${qpSpritz}${qpSpritzLiquid ? ` (${qpSpritzLiquid})` : ""}`);
    else if (qpSpritzLiquid) parts.push(`Spritz liquid: ${qpSpritzLiquid}`);
    if (qpWrap) parts.push(`Wrap/Finish: ${qpWrap}`);
    if (cookNotes.trim()) parts.push(cookNotes.trim());
    return parts.join(" · ");
  }, [qpMethod, qpStartTemp, qpInjection, qpSpritz, qpSpritzLiquid, qpWrap, cookNotes]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cardWidth, setCardWidth] = useState(300);
  const [expandedRationale, setExpandedRationale] = useState<number | null>(null);

  // Per-cook probe selection — no probe is selected by default.
  // Persisted in AsyncStorage so the selection survives navigation.
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web" || !id) return;
    setSelectedProbeId(null);
    setLiveReadings([]);
    AsyncStorage.getItem(`probe_selection_${id}`)
      .then((val) => setSelectedProbeId(val ?? null))
      .catch(() => setSelectedProbeId(null));
  }, [id]);

  // Reset accumulated probe readings whenever the selection changes so stale
  // data from a previous probe never leaks into the graph or AI payload.
  useEffect(() => {
    setLiveReadings([]);
  }, [selectedProbeId]);

  const handleSelectProbe = useCallback((probeId: string | null) => {
    setSelectedProbeId(probeId);
    if (Platform.OS === "web" || !id) return;
    if (probeId == null) {
      AsyncStorage.removeItem(`probe_selection_${id}`).catch(() => {});
    } else {
      AsyncStorage.setItem(`probe_selection_${id}`, probeId).catch(() => {});
    }
  }, [id]);

  // Ratings state
  const [rateTenderness, setRateTenderness] = useState<number>(0);
  const [rateFlavor, setRateFlavor] = useState<number>(0);
  const [rateBark, setRateBark] = useState<number>(0);
  const [rateSaving, setRateSaving] = useState(false);

  const createAlert = useCreateAlert();
  const patchAlert = usePatchAlert();

  const cookStatus = (cook as any)?.status;

  // Ambient outdoor weather — Pro-only; free users get null values so no
  // location request is ever triggered for non-subscribers.
  const weather = useAmbientWeather(undefined, { enabled: effectivePro });

  // Alerts for this cook (active ones, used for MEATER threshold checking)
  const { data: cookAlerts } = useListAlerts({
    query: { queryKey: getListAlertsQueryKey(), enabled: cookStatus === "active" },
  });
  const activeCookAlerts = ((cookAlerts as any[]) ?? []).filter(
    (a: any) => a.cookId === Number(id) && a.isActive,
  );

  // Check-in modal state
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [activeCheckin, setActiveCheckin] = useState<ScheduledCheckin | null>(null);
  const createCheckin = useCreateCookCheckin();
  // Auto-check-in toast: shown briefly after a probe-triggered auto-log fires.
  const [autoCheckinToast, setAutoCheckinToast] = useState<string | null>(null);
  const autoCheckinToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Pending check-in driven by a notification tap — shows the "Check In Now"
  // banner but does NOT auto-open the modal. Cleared when the user taps the
  // banner or dismisses it.
  const [pendingCheckinSc, setPendingCheckinSc] = useState<ScheduledCheckin | null>(null);
  // Nudge banner: shown on active cooks with zero saved check-ins; user can dismiss
  const [firstCheckinNudgeDismissed, setFirstCheckinNudgeDismissed] = useState(false);

  const openCheckin = useCallback((sc: ScheduledCheckin) => {
    setActiveCheckin(sc);
    setCheckinModalVisible(true);
  }, []);

  // Alert sheet state
  const [alertSheetVisible, setAlertSheetVisible] = useState(false);
  const [alertMode, setAlertMode] = useState<"temp" | "timer">("temp");
  const [alertThreshold, setAlertThreshold] = useState("");
  const [alertLabel, setAlertLabel] = useState("");
  const [alertMinutesBefore, setAlertMinutesBefore] = useState("30");
  const [alertSaving, setAlertSaving] = useState(false);
  const [quickLogVisible, setQuickLogVisible] = useState(false);

  // Technique picker sheet state (inline edit on cook detail)
  const [techMethodSheetOpen, setTechMethodSheetOpen] = useState(false);
  const [techInjectionSheetOpen, setTechInjectionSheetOpen] = useState(false);
  const [techSpritzSheetOpen, setTechSpritzSheetOpen] = useState(false);
  const [techSpritzLiquidSheetOpen, setTechSpritzLiquidSheetOpen] = useState(false);
  const [techWrapFinishSheetOpen, setTechWrapFinishSheetOpen] = useState(false);
  const [seqScheduleExpanded, setSeqScheduleExpanded] = useState(false);
  // Auto-expand the sequence schedule for planned cooks so pitmasters see
  // the timeline immediately without an extra tap.
  useEffect(() => {
    const seqData = (cook as any)?.sequenceData;
    if (cookStatus === "planned" && seqData?.schedule?.length > 0) {
      setSeqScheduleExpanded(true);
    }
  }, [cookStatus, (cook as any)?.id]);
  const [techsExpanded, setTechsExpanded] = useState(false);
  const [planSheetVisible, setPlanSheetVisible] = useState(false);
  const [addToSessionOpen, setAddToSessionOpen] = useState(false);
  const [removedPlannedKeys, setRemovedPlannedKeys] = useState<Set<string>>(new Set());
  const [markingThaw, setMarkingThaw] = useState(false);
  // Planned checkins generated by the no-AI-plan fallback path in handleStatusUpdate.
  // When no cookSeqData exists, this supplements storedScheduledCheckins so the
  // Check-ins card shows the upcoming reminders that were just scheduled.
  const [noPlanScheduledCheckins, setNoPlanScheduledCheckins] = useState<ScheduledCheckin[]>([]);

  // Reset noPlanScheduledCheckins whenever the cook identity or active status
  // changes so stale fallback entries from a previously viewed cook can never
  // appear on a different cook's Check-ins card.
  useEffect(() => {
    setNoPlanScheduledCheckins([]);
  }, [id, cookStatus]);

  // Hydrate removed phase keys from AsyncStorage so removals persist across
  // navigation. Always reset to the persisted value (including empty set) when
  // the cook ID changes, so prior-cook removed keys never leak into a different
  // cook's planned-checkin list.
  useEffect(() => {
    if (Platform.OS === "web" || !id) return;
    loadRemovedCheckinPhaseKeys(Number(id))
      .then((keys) => { setRemovedPlannedKeys(keys); })
      .catch(() => { setRemovedPlannedKeys(new Set()); });
  }, [id]);

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
  const proactiveAlerts = useProactiveAlerts();
  // Reset per-cook fired state whenever the viewed cook changes so alerts
  // are not silenced when navigating between cooks in the same session.
  useEffect(() => {
    proactiveAlerts.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  const [proactiveCoachingNote, setProactiveCoachingNote] = useState<string | null>(null);
  // When the user taps a proactive-alert notification while on this cook screen,
  // surface the alert message as an in-screen dismissible coaching card.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (data.proactiveAlert === true && String(data.cookId) === String(id)) {
        const msg =
          typeof data.alertMessage === "string"
            ? data.alertMessage
            : "PitMaster detected a deviation in your cook. Open the check-in to log observations.";
        setProactiveCoachingNote(msg);
      }
    });
    return () => sub.remove();
  }, [id]);

  const [confirmedSteps, setConfirmedSteps] = useState<Record<string, string>>({});
  useEffect(() => {
    const stored = cook?.confirmedSteps;
    setConfirmedSteps(stored && typeof stored === "object" ? stored : {});
  }, [id, cook?.confirmedSteps]);

  // Immediately-updated finish time after a wrap-temp confirmation — allows the
  // progress bar to reflect the temperature-scaled estimate without waiting for
  // the next AI check-in to update finishTimeRangeLower/Upper.
  const [wrapAdjustedFinishMs, setWrapAdjustedFinishMs] = useState<number | null>(null);

  // Extract server-response fields that exist on the GET /cooks/:id payload but
  // are not reflected in the compiled generated Cook type (e.g. when dist/ is
  // stale relative to the OpenAPI source). Using a narrow local shape keeps the
  // cast auditable without reaching for a broad `as any`.
  type CookWithServerExtras = {
    finishTimeRangeLower?: string | null;
    finishTimeRangeUpper?: string | null;
    /** Latest internal probe temperature injected server-side (see routes/cooks.ts). */
    currentTempF?: number | null;
  };
  const cookWithFinishWindow = cook as CookWithServerExtras | undefined;
  const cookFinishLower: string | null = cookWithFinishWindow?.finishTimeRangeLower ?? null;
  const cookFinishUpper: string | null = cookWithFinishWindow?.finishTimeRangeUpper ?? null;
  const cookCurrentTempF: number | null = cookWithFinishWindow?.currentTempF ?? null;

  // Reset the local override whenever the cook changes identity (navigation to a
  // different cook screen) so stale state can't leak across cooks.
  useEffect(() => {
    setWrapAdjustedFinishMs(null);
  }, [id]);

  // Discard the local wrap-adjusted override as soon as a fresh AI check-in
  // updates either bound of the finish window (meaning the server now has a more
  // authoritative post-wrap estimate). We track both lower and upper so that a
  // server response that only updates the upper bound still clears the override.
  // We skip the initial mount so the effect only fires on genuine post-wrap changes.
  const prevFinishWindowRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const current = `${cookFinishLower}|${cookFinishUpper}`;
    const prev = prevFinishWindowRef.current;
    prevFinishWindowRef.current = current;
    if (prev !== undefined && prev !== current) {
      setWrapAdjustedFinishMs(null);
    }
  }, [cookFinishLower, cookFinishUpper]);

  // Belt-and-suspenders for the identical-bounds edge case: when a check-in
  // or AI analyze completes, we set pendingWrapClearRef and invalidate the
  // cook query. The above bounds-change effect handles the common case, but
  // if the server returns the same finishTimeRangeLower/Upper (effect won't
  // fire), this effect fires on cookDataUpdatedAt — guaranteed to change on
  // every successful cook query refetch — and clears the override atomically.
  const pendingWrapClearRef = useRef(false);
  useEffect(() => {
    if (!pendingWrapClearRef.current) return;
    pendingWrapClearRef.current = false;
    setWrapAdjustedFinishMs(null);
  }, [cookDataUpdatedAt]);

  // Pending wrap confirmation — set when user taps the wrap dot so we can
  // show the WrapTempSheet before committing the confirmed timestamp.
  const [wrapTempPending, setWrapTempPending] = useState<{
    key: string;
    itemIdx: number;
  } | null>(null);

  const toggleConfirmedStep = async (key: string) => {
    const sep = key.indexOf("_");
    const itemIdx = sep >= 0 ? parseInt(key.slice(0, sep), 10) : -1;
    const step = sep >= 0 ? key.slice(sep + 1) : key;

    const prev = confirmedSteps;
    const isConfirming = !prev[key];

    // Wrap step: intercept and show the temp input sheet first
    if (isConfirming && step === "wrap" && cookSeqData?.schedule?.[itemIdx]) {
      setWrapTempPending({ key, itemIdx });
      return;
    }

    // Wrap step unconfirm: discard the local temp-adjusted finish so the bar
    // reverts to the schedule / AI-window estimate. Save the prior value so we
    // can roll back if the mutation fails.
    const prevWrapAdjustedFinishMs = wrapAdjustedFinishMs;
    if (!isConfirming && step === "wrap") {
      setWrapAdjustedFinishMs(null);
    }

    const next = { ...prev };
    const actualTime = new Date();
    if (next[key]) {
      delete next[key];
    } else {
      next[key] = actualTime.toISOString();
    }
    setConfirmedSteps(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // Ripple downstream timestamps when confirming a schedule anchor step
    let updatedSeqData: SequenceData | null = null;
    const ripplableSteps = ["grillLight", "meatOn", "pullOff"] as const;
    if (isConfirming && itemIdx >= 0 && cookSeqData?.schedule) {
      const rippleStep = step as (typeof ripplableSteps)[number];
      if ((ripplableSteps as readonly string[]).includes(rippleStep)) {
        const updatedSchedule = rippleScheduleTimestamps(
          cookSeqData.schedule,
          itemIdx,
          rippleStep,
          actualTime.getTime(),
        );
        const maxServeMs = Math.max(
          0,
          ...updatedSchedule.map((item: ScheduleItem) =>
            item.estimatedFinishAt
              ? new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000
              : 0,
          ),
        );
        updatedSeqData = {
          ...cookSeqData,
          schedule: updatedSchedule,
          ...(maxServeMs > 0 ? { serveAt: new Date(maxServeMs).toISOString() } : {}),
        };
      }
    }

    try {
      await updateCook.mutateAsync({
        id: Number(id),
        data: {
          confirmedSteps: next,
          ...(updatedSeqData ? { sequenceData: updatedSeqData } : {}),
        } as any,
      });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });

      // Post or retract a cook event for high-signal milestones so they appear in the Pit Journal
      if (step === "stall" || step === "probeTender") {
        const noteText = step === "stall" ? "Stall detected" : "Probe tender achieved";
        try {
          const token = await getToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (isConfirming) {
            await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events`, {
              method: "POST",
              headers,
              body: JSON.stringify({
                eventType: "user_note",
                note: noteText,
                metadata: { milestoneStep: step },
              }),
            });
          } else {
            // Un-confirming: retract the most recent auto-generated milestone journal entry.
            // Match by metadata.milestoneStep so we don't accidentally delete a user-written
            // note that happens to have the same text.
            const eventsRes = await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (eventsRes.ok) {
              const events: {
                id: number;
                eventType: string;
                note: string | null;
                metadata: Record<string, unknown> | null;
              }[] = await eventsRes.json();
              const match = [...events]
                .reverse()
                .find(
                  (e) =>
                    e.eventType === "user_note" &&
                    e.metadata?.milestoneStep === step,
                );
              if (match) {
                await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events/${match.id}`, {
                  method: "DELETE",
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
              }
            }
          }
          qc.invalidateQueries({ queryKey: getListCookEventsQueryKey(Number(id)) });
        } catch {
          // Journal events are best-effort — don't block or alert the user
        }
      }
    } catch {
      setConfirmedSteps(prev);
      if (!isConfirming && step === "wrap") {
        setWrapAdjustedFinishMs(prevWrapAdjustedFinishMs);
      }
    }
  };

  // Called by WrapTempSheet after the user provides (or skips) the internal temp.
  const confirmWrap = async (key: string, itemIdx: number, tempF: number | null) => {
    setWrapTempPending(null);
    const prev = confirmedSteps;
    const actualTime = new Date();
    const next = { ...prev, [key]: actualTime.toISOString() };
    setConfirmedSteps(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let updatedSeqData: SequenceData | null = null;
    if (cookSeqData?.schedule) {
      const updatedSchedule = rippleScheduleTimestamps(
        cookSeqData.schedule,
        itemIdx,
        "wrap",
        actualTime.getTime(),
        tempF,
      );
      const maxServeMs = Math.max(
        0,
        ...updatedSchedule.map((item: ScheduleItem) =>
          item.estimatedFinishAt
            ? new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000
            : 0,
        ),
      );
      updatedSeqData = {
        ...cookSeqData,
        schedule: updatedSchedule,
        ...(maxServeMs > 0 ? { serveAt: new Date(maxServeMs).toISOString() } : {}),
      };
    }

    // Capture the wrap-temp-adjusted finish time immediately so the progress bar
    // reflects it without waiting for the AI check-in window to update.
    // We use schedule[0] to match the same anchor as the estimatedFinishMs
    // priority-chain fallback, ensuring consistent bar movement across all cooks.
    if (tempF !== null && updatedSeqData?.schedule?.[0]?.estimatedFinishAt) {
      setWrapAdjustedFinishMs(
        new Date(updatedSeqData.schedule[0].estimatedFinishAt).getTime(),
      );
    }

    try {
      await updateCook.mutateAsync({
        id: Number(id),
        data: {
          confirmedSteps: next,
          ...(updatedSeqData ? { sequenceData: updatedSeqData } : {}),
        } as any,
      });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    } catch {
      setConfirmedSteps(prev);
      setWrapAdjustedFinishMs(null);
    }
  };

  // Fuel quick-log: post a charcoal_add or wood_add cook event.
  const handleLogFuelEvent = useCallback(
    async (action: "charcoal" | "wood") => {
      if (!cook?.id) return;
      const eventType = action === "charcoal" ? "charcoal_add" : "wood_add";
      try {
        const token = await getToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${API_BASE_URL}/api/cooks/${cook.id}/events`, {
          method: "POST",
          headers,
          body: JSON.stringify({ eventType }),
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListCookEventsQueryKey(cook.id) });
      } catch {
        // Fuel logs are optional — silently swallow errors
      }
    },
    [cook?.id, getToken, qc],
  );

  const handleMarkThawStarted = useCallback(async () => {
    if (!cook?.id) return;
    setMarkingThaw(true);
    try {
      const actualNow = new Date().toISOString();
      await updateCook.mutateAsync({
        id: cook.id,
        data: { actualThawStartAt: actualNow as any },
      });

      // If the actual thaw start differs from the planned start by more than 5
      // minutes, shift thawEndAt in sequenceData by the same delta so that
      // downstream countdowns (ThawStatusBanner, FrozenTimeline) stay accurate.
      const currentSeqData = (cook as any)?.sequenceData as SequenceData | null | undefined;
      const frozen = currentSeqData?.frozen;
      if (frozen?.thawStartAt && frozen.thawEndAt) {
        const plannedStartMs = new Date(frozen.thawStartAt as string).getTime();
        const actualStartMs = new Date(actualNow).getTime();
        const diffMs = actualStartMs - plannedStartMs;
        if (Math.abs(diffMs) > 5 * 60_000) {
          const originalDurationMs =
            new Date(frozen.thawEndAt as string).getTime() - plannedStartMs;
          const adjustedThawEndAt = new Date(
            actualStartMs + originalDurationMs,
          ).toISOString();

          // Helper to shift an ISO timestamp by diffMs.
          const shiftIso = (iso: string | null | undefined): string | null | undefined => {
            if (!iso) return iso;
            return new Date(new Date(iso).getTime() + diffMs).toISOString();
          };

          // Shift grillLightAt and meatOnAt on schedule[0] so the SeqSchedule
          // timeline (which reads these values directly) reflects the new times.
          const currentSchedule = currentSeqData?.schedule ?? [];
          const updatedSchedule = currentSchedule.map((item, idx) => {
            if (idx !== 0) return item;
            return {
              ...item,
              grillLightAt: shiftIso(item.grillLightAt),
              meatOnAt: shiftIso(item.meatOnAt),
            };
          });

          // Also update frozen.thawStartAt to actualNow so that the render-time
          // effectiveMeatOnMs delta (actualThawStartAt - frozen.thawStartAt)
          // becomes zero — preventing double-application of diffMs now that the
          // schedule timestamps already carry the shift.
          const updatedSeqData: SequenceData = {
            ...currentSeqData,
            schedule: updatedSchedule,
            frozen: {
              ...frozen,
              thawStartAt: actualNow,
              thawEndAt: adjustedThawEndAt,
            },
          };

          // Shift plannedStartAt by the same delta so that the preheat
          // notification fires at the new (correct) grill-light time rather
          // than the original planned time.  plannedStartAt === grillLightAt
          // by construction (set when the cook was planned), so applying
          // diffMs keeps everything in sync.
          const existingPlannedStart = (cook as any)?.plannedStartAt as string | null | undefined;
          const shiftedPlannedStartAt: string | null = existingPlannedStart
            ? new Date(new Date(existingPlannedStart).getTime() + diffMs).toISOString()
            : null;

          await updateCook.mutateAsync({
            id: cook.id,
            data: {
              sequenceData: updatedSeqData,
              ...(shiftedPlannedStartAt ? { plannedStartAt: shiftedPlannedStartAt as any } : {}),
            } as any,
          });

          // Re-fire frozen-stage notifications using the adjusted thawEndAt
          // and the shifted preheat start so ALL pending alerts move to the
          // new correct times immediately (don't wait for the query refetch).
          scheduleFrozenStageNotifications({
            cookId: cook.id,
            frozen: updatedSeqData.frozen,
            preheatStartAt: shiftedPlannedStartAt,
            foodType: (frozen as any)?.foodType ?? null,
            includePreheat: cookStatus === "planned",
            actualThawStartAt: actualNow,
          }).catch(() => {});
        } else {
          // Small diff (≤ 5 min) — timestamps stay the same, but now that
          // actualThawStartAt is set the 30-minute "almost thawed" warning
          // needs to be scheduled immediately rather than waiting for the
          // async query refetch to trigger the hook's reactive depKey.
          scheduleFrozenStageNotifications({
            cookId: cook.id,
            frozen: frozen as FrozenStageData,
            preheatStartAt: (cook as any)?.plannedStartAt ?? null,
            foodType: (frozen as any)?.foodType ?? null,
            includePreheat: cookStatus === "planned",
            actualThawStartAt: actualNow,
          }).catch(() => {});
        }
      }

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(cook.id) });
    } catch {
      Alert.alert("Error", "Could not record thaw start time. Please try again.");
    } finally {
      setMarkingThaw(false);
    }
  }, [cook, updateCook, qc]);

  // Check-in history for this cook (active, completed, and planned cooks)
  const { data: cookCheckins = [], isLoading: checkinsLoading } = useListCookCheckins(
    Number(id),
    {
      query: {
        queryKey: getListCookCheckinsQueryKey(Number(id)),
        enabled: cookStatus === "active" || cookStatus === "completed" || cookStatus === "planned",
        refetchOnWindowFocus: cookStatus === "active",
      },
    },
  );

  // Most recent saved check-in that recorded at least one temperature value.
  // Used by AskPitMaster to display read-only temps and by analyze() as fallback
  // when no live MEATER probe is connected.
  const lastCheckin = React.useMemo(() => {
    if (!Array.isArray(cookCheckins) || cookCheckins.length === 0) return null;
    const withTemps = (cookCheckins as any[]).filter(
      (ci: any) => ci.internalTempF != null || ci.pitTempF != null,
    );
    if (withTemps.length === 0) return null;
    return withTemps.reduce((best: any, ci: any) =>
      new Date(ci.createdAt) > new Date(best.createdAt) ? ci : best,
    );
  }, [cookCheckins]);

  const { data: meaterData, isLoading: meaterLoading, dataUpdatedAt: meaterDataUpdatedAt } = useGetMeaterReadings({
    query: {
      queryKey: getGetMeaterReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? PROBE_POLL_INTERVAL_MS : false,
    },
  });
  // null = still loading (don't show placeholder yet), true/false = resolved
  const meaterLinked = meaterLoading ? null : (meaterData?.linked ?? false);
  const meaterProbes = meaterData?.probes ?? [];

  const { data: thermoworksData, isLoading: thermoworksLoading, dataUpdatedAt: thermoworksDataUpdatedAt } = useGetThermoworksReadings({
    query: {
      queryKey: getGetThermoworksReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? PROBE_POLL_INTERVAL_MS : false,
    },
  });
  const thermoworksLinked = thermoworksLoading ? null : (thermoworksData?.linked ?? false);
  const thermoworksProbes = thermoworksData?.probes ?? [];

  // Only the probe the user explicitly assigned to this cook. Both are null
  // until the user taps a probe row in LiveCookSection.
  const selectedMeaterProbe =
    selectedProbeId != null
      ? (meaterProbes.find((p) => p.deviceId === selectedProbeId) ?? null)
      : null;
  const selectedThermoworksProbe =
    selectedProbeId != null
      ? (thermoworksProbes.find(
          (p: any) => `tw_${p.deviceId}_${p.channelNumber}` === selectedProbeId,
        ) ?? null)
      : null;

  const [nowMs, setNowMs] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveReadings, setLiveReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);

  // iOS Live Activity (lock screen + Dynamic Island). No-op on Android,
  // Expo Go, and unsupported devices.
  useCookLiveActivity({
    cookId: cook?.id ?? null,
    status: cook?.status ?? null,
    meatLabel: cook?.foodType ?? "Cook",
    startedAtIso: cook?.actualStartAt ?? null,
    currentTempF: selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? null,
    targetTempF: cook?.targetTempF ?? null,
    cookTempF:
      selectedMeaterProbe?.ambientTempF ??
      cook?.cookTempF ??
      null,
  });

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
    setQpMethod(null);
    setQpStartTemp(null);
    setQpInjection(null);
    setQpSpritz(null);
    setQpWrap(null);
    setActiveCookNoteTags([]);
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

  // For frozen cooks the cook enters "active" during the thaw window.
  // Gate live-only widgets (health score, AI check-ins) on whether
  // meatOnAt has actually passed.
  const cookSeqMeatOnMs: number | null = cookSeqData?.schedule?.[0]?.meatOnAt
    ? new Date(cookSeqData.schedule[0].meatOnAt as string).getTime()
    : null;

  // When the pitmaster has confirmed the actual thaw-start time, shift the
  // planned meat-on time by the same delta so countdowns stay accurate.
  // e.g. if the actual thaw started 30 min late, meat-on shifts 30 min later.
  const effectiveMeatOnMs: number | null = (() => {
    if (cookSeqMeatOnMs == null) return null;
    const actualThawMs = (cook as any)?.actualThawStartAt
      ? new Date((cook as any).actualThawStartAt).getTime()
      : null;
    const plannedThawMs = cookSeqData?.frozen?.thawStartAt
      ? new Date(cookSeqData.frozen.thawStartAt as string).getTime()
      : null;
    if (actualThawMs != null && plannedThawMs != null) {
      return cookSeqMeatOnMs + (actualThawMs - plannedThawMs);
    }
    return cookSeqMeatOnMs;
  })();

  const isMeatOn = effectiveMeatOnMs == null || effectiveMeatOnMs <= nowMs;

  // Schedule local notifications for each upcoming schedule step so the
  // pitmaster is alerted even when the app is backgrounded or the phone is
  // locked.  The in-app haptic/banner still fires when foregrounded (see
  // the step-change toast effect below); the notification handler in
  // _layout.tsx suppresses the system banner while the app is active to
  // avoid duplication.
  useScheduleStepNotifications(Number(id), cookStatus, cookSeqData);
  // Frozen-to-Table thaw/temper alerts. These fire while the cook is still
  // `planned` (days before grill-light) so the user gets a heads-up to move
  // the meat from the freezer/fridge/counter at each stage.
  useFrozenStageNotifications(
    Number(id),
    cookStatus,
    cookSeqData,
    (cook as any)?.plannedStartAt ?? null,
    (cook as any)?.actualThawStartAt ? new Date((cook as any).actualThawStartAt).toISOString() : null,
    cook?.actualStartAt ? new Date(cook.actualStartAt).toISOString() : null,
  );
  // Spritz reminders — fire at the user's chosen spritz interval throughout the
  // active cook so they're nudged to spritz even when the app is backgrounded.
  useSpritzNotifications(
    Number(id),
    cookStatus,
    (cook as any)?.spritzFrequency ?? null,
    (cook as any)?.foodType ?? null,
    cookSeqData,
  );
  // Smart check-in notifications — fire at BBQ milestone points while cook is active.
  const storedScheduledCheckins = useCheckinNotifications(Number(id) || null, cookStatus, cookSeqData);

  // Build a probe reading object for the auto-checkin hook. We use the
  // react-query dataUpdatedAt timestamp so the hook knows how fresh the
  // reading is (must be < 60 s old to qualify as "live").
  const autoCheckinProbeReading = useMemo((): AutoCheckinProbeReading | null => {
    if (selectedMeaterProbe?.internalTempF != null) {
      return {
        internalTempF: selectedMeaterProbe.internalTempF,
        pitTempF: selectedMeaterProbe.ambientTempF ?? null,
        probeSource: "meater",
        fetchedAtMs: meaterDataUpdatedAt,
      };
    }
    if (selectedThermoworksProbe != null && (selectedThermoworksProbe as any).tempF != null) {
      return {
        internalTempF: (selectedThermoworksProbe as any).tempF,
        pitTempF: null,
        probeSource: "thermoworks",
        fetchedAtMs: thermoworksDataUpdatedAt,
      };
    }
    return null;
  }, [selectedMeaterProbe, selectedThermoworksProbe, meaterDataUpdatedAt, thermoworksDataUpdatedAt]);

  // Auto check-in: when a scheduled milestone time is reached and a live probe
  // reading is available, record the check-in automatically.
  useAutoCheckin({
    cookId: Number(id) || null,
    cookStatus,
    scheduledCheckins: storedScheduledCheckins,
    existingCheckins: cookCheckins as CookCheckin[],
    probeReading: autoCheckinProbeReading,
    onAutoCheckinFired: ({ phaseLabel, internalTempF }) => {
      const temp = Math.round(internalTempF);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const msg = `Check-in recorded automatically — ${temp}°F at ${timeStr}`;
      setAutoCheckinToast(msg);
      if (autoCheckinToastTimerRef.current) clearTimeout(autoCheckinToastTimerRef.current);
      autoCheckinToastTimerRef.current = setTimeout(() => setAutoCheckinToast(null), 5000);
      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
      qc.invalidateQueries({ queryKey: getListCookCheckinsQueryKey(Number(id)) });
      const first = cookSeqData?.schedule?.[0];
      if (first?.meatOnAt && first?.estimatedFinishAt) {
        const completedKeys = new Set(
          (cookCheckins as CookCheckin[])
            .map((ci) => ci.phaseKey)
            .filter((k): k is string => k != null),
        );
        rescheduleCheckinNotifications({
          cookId: Number(id),
          foodType: first.foodType ?? null,
          weightLbs: cook?.weightLbs ?? null,
          meatOnAt: first.meatOnAt,
          estimatedFinishAt: first.estimatedFinishAt,
          wrapAtMinutes: first.wrapAtMinutes ?? null,
          completedPhaseKeys: completedKeys,
          actualInternalTempF: internalTempF,
        }).catch(() => {});
      }
    },
  });
  // Background / cross-screen deep link: consume pending check-in notification
  // placed by the _layout.tsx router handler when the user was NOT on this cook
  // screen at the time of the notification tap. Shows the "Check In Now" banner
  // instead of auto-opening the modal — the user decides when to log.
  useFocusEffect(
    useCallback(() => {
      const pending = consumePendingCheckin();
      if (!pending || pending.cookId !== Number(id)) return;

      const phase =
        getCheckinSchedule(cook?.foodType).phases.find(
          (p) => p.key === pending.phaseKey,
        ) ?? getCheckinSchedule(null).phases[0];

      const sc: ScheduledCheckin = {
        id: `${pending.phaseKey}_deeplink`,
        phaseKey: pending.phaseKey,
        phaseLabel: pending.phaseLabel,
        scheduledAt: pending.scheduledAt,
        phase,
      };

      setPendingCheckinSc(sc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, cook?.foodType]),
  );

  // Foreground deep-link handler: fires when the user taps a check-in notification
  // while already on THIS cook's screen (cookId validated inside the hook).
  // The background case is handled by _layout.tsx + the useFocusEffect above.
  // Shows the "Check In Now" banner instead of auto-opening the modal.
  useCheckinDeepLink(
    Number(id) || null,
    useCallback(
      (data) => {
        const phase =
          getCheckinSchedule(cook?.foodType).phases.find(
            (p) => p.key === data.phaseKey,
          ) ?? getCheckinSchedule(null).phases[0];

        const sc: ScheduledCheckin = {
          id: `${data.phaseKey}_deeplink`,
          phaseKey: data.phaseKey,
          phaseLabel: data.phaseLabel,
          scheduledAt: data.scheduledAt,
          phase,
        };

        setPendingCheckinSc(sc);
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [
        cook?.foodType,
        id,
      ],
    ),
  );

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

  // Track when this screen is mounted and which cook is displayed so the
  // global notification handler can route check-in taps to the correct screen.
  useEffect(() => {
    const numId = Number(id);
    setCookDetailVisible(true);
    setCurrentCookId(isNaN(numId) ? null : numId);
    return () => {
      setCookDetailVisible(false);
      setCurrentCookId(null);
    };
  }, [id]);

  // Auto-expand the schedule for planned and active cooks so users immediately
  // see their full timeline (light grill, meat on, pull off, etc.) without tapping.
  useEffect(() => {
    if (cookStatus === "planned" || cookStatus === "active") setSeqScheduleExpanded(true);
  }, [cookStatus]);

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

  // Edit Times sheet state (active cook timestamp correction)
  const [editTimesVisible, setEditTimesVisible] = useState(false);
  const [editTimesSaving, setEditTimesSaving] = useState(false);

  const handleSaveCookTimes = async (meatOnAt: Date, thawStartAt: Date | null) => {
    setEditTimesSaving(true);
    try {
      const payload: Record<string, unknown> = {
        actualStartAt: meatOnAt.toISOString(),
      };
      if (thawStartAt !== null) {
        payload.actualThawStartAt = thawStartAt.toISOString();
      }
      const updated = await updateCook.mutateAsync({ id: Number(id), data: payload as any });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setEditTimesVisible(false);
      // Reschedule step notifications using the freshly returned schedule
      // from the server response — never the stale pre-edit local state.
      const freshSchedule =
        ((updated as any)?.sequenceData as SequenceData | undefined)?.schedule ??
        cookSeqData?.schedule;
      if (freshSchedule?.length) {
        cancelStoredStepNotifications(Number(id)).catch(() => {});
        scheduleStepNotifications(Number(id), freshSchedule, () => true).catch(() => {});
      }
    } catch {
      Alert.alert("Save failed", "Could not update cook times. Please try again.");
    } finally {
      setEditTimesSaving(false);
    }
  };

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
  const [editCookingMethod, setEditCookingMethod] = useState<string | null>(null);
  const [editInjection, setEditInjection] = useState<string | null>(null);
  const [editSpritzFrequency, setEditSpritzFrequency] = useState<string | null>(null);
  const [editSpritzLiquid, setEditSpritzLiquid] = useState<string | null>(null);
  const [editWrapFinish, setEditWrapFinish] = useState<string | null>(null);
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
    if (selectedMeaterProbe != null && selectedMeaterProbe.internalTempF != null) {
      const currentTemp = selectedMeaterProbe.internalTempF;
      const startAt = cook?.actualStartAt;
      const elapsedMins = startAt
        ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
        : 0;
      setLiveReadings((prev) => [
        ...prev,
        { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
      ]);

      // Proactive deviation alerts (spike, stall, pit-drop).
      // expectedInternalTempF is the midpoint of the current checkin phase's
      // expected range — walk the schedule to find the first phase whose upper
      // bound is above the current probe temp (that is the phase we're in now).
      const checkinSched = getCheckinSchedule((cook as any)?.foodType ?? null);
      let phaseExpectedInternalMid: number | null = null;
      for (const p of checkinSched.phases) {
        const rng = p.expectedInternalTempRange;
        if (rng && rng[1] > currentTemp) {
          phaseExpectedInternalMid = (rng[0] + rng[1]) / 2;
          break;
        }
      }
      proactiveAlerts.check({
        cookId: Number(id),
        cookStatus,
        probeInternalTempF: currentTemp,
        pitTempF: selectedMeaterProbe?.ambientTempF ?? null,
        targetCookTempF: (cook as any)?.cookTempF ?? null,
        expectedInternalTempF: phaseExpectedInternalMid,
        foodType: (cook as any)?.foodType ?? null,
      });

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
  }, [selectedMeaterProbe]);

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

  // When a wrap-temp adjustment shifts the estimated finish time, reschedule any
  // pending "time before serve" push notifications so they fire at the correct time.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!wrapAdjustedFinishMs) return;
    const tbsAlerts = activeCookAlerts.filter(
      (a: any) => a.alertType === "time_before_serve" && a.isActive && !a.triggered,
    );
    if (!tbsAlerts.length) return;

    (async () => {
      for (const alert of tbsAlerts) {
        if (alert.scheduledNotificationId) {
          await Notifications.cancelScheduledNotificationAsync(alert.scheduledNotificationId).catch(() => {});
        }
        const minutesBefore = alert.thresholdTempF as number;
        const fireAt = wrapAdjustedFinishMs - minutesBefore * 60 * 1000;
        if (fireAt <= Date.now()) continue;
        const label = (alert.message as string | null) ?? `${fmtMinutes(minutesBefore)} before serve time`;
        try {
          const notificationId = await Notifications.scheduleNotificationAsync({
            content: {
              title: "⏱ Serve Time Approaching",
              body: label,
              sound: true,
              data: { alertId: alert.id, cookId: Number(id) },
            },
            trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(fireAt) },
          });
          await patchAlert.mutateAsync({ id: alert.id, data: { scheduledNotificationId: notificationId } });
        } catch {
          // Best-effort — don't block the wrap confirmation flow
        }
      }
    })();
  }, [wrapAdjustedFinishMs, activeCookAlerts, id]);

  const topPad = useTopInset();
  const botPad = useBottomInset();
  const { isTablet, detailMaxWidth } = useLayout();

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
            // Cancel all local notifications tied to this cook so none fire
            // after deletion (frozen thaw/temper alerts + smart check-ins).
            await cancelStoredFrozenNotifications(Number(id)).catch(() => {});
            await cancelStoredCheckinNotifications(Number(id)).catch(() => {});
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

    // When starting a cook that has no AI plan yet, schedule generic check-in
    // notifications anchored to now + an estimated finish time. The
    // useCheckinNotifications hook handles the case where cookSeqData exists,
    // but falls back to nothing when there's no plan — this fallback fills that gap.
    if (status === "active" && Platform.OS !== "web") {
      const hasPlan = !!cookSeqData?.schedule?.length;
      if (!hasPlan) {
        type CookForCheckinSchedule = {
          foodType?: string | null;
          weightLbs?: number | null;
          plannedEndAt?: string | null;
        };
        const cookFields = cook as CookForCheckinSchedule | undefined;
        const meatOnAtMs = Date.now();
        const foodType: string | null = cookFields?.foodType ?? null;
        const weightLbs: number | null = cookFields?.weightLbs ?? null;
        // Estimate finish time: use plannedEndAt if available, otherwise
        // fall back to a default 6-hour cook window from now.
        const estimatedFinishAtMs = cookFields?.plannedEndAt
          ? new Date(cookFields.plannedEndAt).getTime()
          : meatOnAtMs + 6 * 60 * 60 * 1000;
        if (estimatedFinishAtMs > meatOnAtMs) {
          const checkins = generateCheckinSchedule(foodType, meatOnAtMs, estimatedFinishAtMs, null, weightLbs);
          const cookIdNum = Number(id);
          let gen = 0;
          const isCurrent = () => gen === 0;
          scheduleCheckinNotifications(cookIdNum, checkins, foodType, isCurrent).catch(() => {});
          // Populate UI immediately so Check-ins card shows the reminders even
          // before the useCheckinNotifications hook re-runs (it early-returns
          // when cookSeqData is empty).
          setNoPlanScheduledCheckins(checkins);
        }
      }
    }
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
    setEditCookingMethod(c?.cookingMethod ?? null);
    setEditInjection(c?.injection ?? null);
    setEditSpritzFrequency(c?.spritzFrequency ?? null);
    setEditSpritzLiquid(c?.spritzLiquid ?? null);
    setEditWrapFinish(c?.wrapFinish ?? null);
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
      payload.cookingMethod = editCookingMethod;
      payload.injection = editInjection;
      payload.spritzFrequency = editSpritzFrequency;
      payload.spritzLiquid = editSpritzLiquid;
      payload.wrapFinish = editWrapFinish;
      await updateCook.mutateAsync({ id: Number(id), data: payload });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
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
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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

  const analyze = async (opts: { auto?: boolean; extraNotes?: string } = {}) => {
    const auto = opts.auto === true;
    // extraNotes lets callers (e.g. quick-log note) inject text directly into
    // the analysis context without racing a React state update cycle.
    const notesForAnalysis = opts.extraNotes != null
      ? [opts.extraNotes.trim(), scanNotes.trim()].filter(Boolean).join(" · ")
      : scanNotes.trim();
    // Selected probe takes precedence; fall back to last saved check-in temp.
    const liveMeaterInternalTempF =
      selectedMeaterProbe?.internalTempF != null
        ? (selectedMeaterProbe.internalTempF as number)
        : null;
    const hasMeaterTemp = liveMeaterInternalTempF != null;
    const hasCheckinTemp = lastCheckin?.internalTempF != null || lastCheckin?.pitTempF != null;
    const hasAnyInput = images.length > 0 || notesForAnalysis.length > 0 || hasCheckinTemp;
    if (!hasAnyInput && !hasMeaterTemp) {
      if (auto) return; // silent skip — nothing useful to grade right now
      if (cookStatus === "active") {
        Alert.alert("Nothing to check in with", "Log a check-in with your probe and pit temperatures, or add a note about what's happening.");
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
          cookNotes: notesForAnalysis || null,
          cookId: Number(id),
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
            // Live MEATER probe takes precedence over last check-in temp
            userEnteredTempF: liveMeaterInternalTempF ?? lastCheckin?.internalTempF ?? null,
            // Live probe data for phase detection (active cooks only)
            liveReadings: liveReadings.length >= 2 ? liveReadings : null,
            elapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            currentPitTempF: lastCheckin?.pitTempF ?? selectedMeaterProbe?.ambientTempF ?? null,
            outdoorTempF: weather.tempF ?? null,
            cookStatus: c?.status ?? null,
            // Technique quick-picks persisted on the cook record
            cookingMethod: c?.cookingMethod ?? null,
            injection: c?.injection ?? null,
            spritzFrequency: c?.spritzFrequency ?? null,
            spritzLiquid: c?.spritzLiquid ?? null,
            wrapFinish: c?.wrapFinish ?? null,
          },
        } as any,
      });
      setResult(data);
      setExpandedRationale(null);
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
            snapshotTempF: liveMeaterInternalTempF ?? lastCheckin?.internalTempF ?? null,
            snapshotNotes: notesForAnalysis || null,
            snapshotElapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            analyzedAt: new Date().toISOString(),
          },
        } as any,
      });
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
      qc.invalidateQueries({ queryKey: getListCookEventsQueryKey(Number(id)) });
      // Fresh AI analysis carries an updated finishTimeRangeLower/Upper on
      // the cook record. Set the pending-clear flag and invalidate the cook
      // query — the dataUpdatedAt-watching effect clears wrapAdjustedFinishMs
      // atomically when fresh data lands (covers bounds-change and
      // identical-bounds edge cases; no backward jump to stale values).
      pendingWrapClearRef.current = true;
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
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
      const serverMsg = (e as any)?.response?.data?.error ?? (e as any)?.data?.error ?? null;
      Alert.alert(
        "Analysis failed",
        typeof serverMsg === "string" ? serverMsg : "Could not analyze the cook. Please check your connection and try again.",
      );
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
    const cookAny = cook as any;
    const stored = cookAny?.analysisResult?.analyzedAt as string | null | undefined;
    const hist = Array.isArray(cookAny?.analysisHistory) ? cookAny.analysisHistory : [];
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

  // Refresh the cook record (including currentTempF) every time the screen
  // regains focus. Unlike refetchOnWindowFocus (which fires on app foregrounding),
  // this fires on every Expo Router navigation back to this screen — covering the
  // case where the user navigates away then returns while the app stays active.
  const cookIdForFocus = Number(id);
  useFocusEffect(
    useCallback(() => {
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(cookIdForFocus) });
    }, [cookIdForFocus, qc]),
  );

  // Stable ref to analyze + the data the auto tick reads, so the timer
  // effect can have a small, stable dependency list.
  const autoTickRef = useRef<{
    analyze: typeof analyze;
    scanNotes: string;
    lastCheckinInternalTempF: number | null;
    selectedMeaterProbe: any | null;
    analyzing: boolean;
  }>({ analyze, scanNotes, lastCheckinInternalTempF: lastCheckin?.internalTempF ?? null, selectedMeaterProbe, analyzing });
  useEffect(() => {
    autoTickRef.current = { analyze, scanNotes, lastCheckinInternalTempF: lastCheckin?.internalTempF ?? null, selectedMeaterProbe, analyzing };
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
      const hasCheckinTemp = cur.lastCheckinInternalTempF != null;
      const hasMeaterTemp = cur.selectedMeaterProbe?.internalTempF != null;
      const hasNotes = cur.scanNotes.trim().length > 0;
      if (!hasCheckinTemp && !hasMeaterTemp && !hasNotes) {
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
      foodType: cook?.foodType ?? null,
    });
  }, [showPaywall, cook]);

  // estimatedFinishMs must live BEFORE the early returns so the hook count
  // never changes between renders (Rules of Hooks). It null-guards cook
  // internally so it is safe to call while cook is still undefined.
  const estimatedFinishMs = useMemo(() => {
    if (!cook) return null;
    const _c = cook as any;
    if (wrapAdjustedFinishMs != null) return wrapAdjustedFinishMs;
    const lower = _c.finishTimeRangeLower;
    const upper = _c.finishTimeRangeUpper;
    if (lower && upper) {
      const upperMs = new Date(upper).getTime();
      if (upperMs > nowMs) {
        return (new Date(lower).getTime() + upperMs) / 2;
      }
    }
    const seqFinish = cookSeqData?.schedule?.[0]?.estimatedFinishAt;
    if (seqFinish) return new Date(seqFinish).getTime();
    if (_c.plannedEndAt) return new Date(_c.plannedEndAt).getTime();
    return null;
  }, [cook, wrapAdjustedFinishMs, cookSeqData, nowMs]);

  // Next scheduled spritz time — only defined for active cooks with a timed
  // spritz frequency ("Every 30 min", "Every Hour", "Every 2 Hours").
  // Must live BEFORE the early returns alongside the haptic hook (Rules of Hooks).
  const nextSpritzMs = cookStatus === "active"
    ? computeNextSpritzMs((cook as any)?.spritzFrequency ?? null, cookSeqData, nowMs)
    : null;

  // Haptic nudge when a spritz slot is reached — fires once per interval.
  // Must live BEFORE the early returns so hook count is stable (Rules of Hooks).
  //
  // computeNextSpritzMs always returns a FUTURE absolute timestamp (skips past
  // slots). The crossing moment is detected by watching for a slot change:
  // when nextSpritzMs transitions to a new value (next slot or null), it means
  // nowMs just overtook the previous slot → nudge the pitmaster.
  const prevNextSpritzMsRef = useRef<number | null>(null);
  useEffect(() => {
    const prev = prevNextSpritzMsRef.current;
    prevNextSpritzMsRef.current = nextSpritzMs;

    // Same slot — still counting down, nothing to do.
    if (nextSpritzMs === prev) return;

    // A previous slot existed and we've now moved past it (to the next slot or
    // to null when the cook window ends). The spritz moment just passed.
    if (prev != null) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    }
  }, [nextSpritzMs]);

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
  // Anchor elapsed to meatOnAt (same as cook-list cards) so frozen-cook detail
  // screens don't inflate "time on the smoker" with thaw/preheat time.
  // effectiveMeatOnMs is already computed above (thaw-shift adjusted).
  const elapsedAnchorMs: number | null = (() => {
    if (c.status !== "active") return c.actualStartAt ? new Date(c.actualStartAt).getTime() : null;
    if (!isMeatOn) return null; // meat not on the grill yet — hide elapsed
    if (effectiveMeatOnMs != null) return effectiveMeatOnMs; // past meatOnAt — use it
    if (c.actualStartAt) return new Date(c.actualStartAt).getTime(); // no meatOnAt — fallback
    return null;
  })();
  const elapsedMs = elapsedAnchorMs !== null ? nowMs - elapsedAnchorMs : 0;

  // Remaining time for the live banner — derived from estimatedFinishMs so it
  // stays in sync with the progress bar (including wrap-temp adjustments).
  const remainingMs = estimatedFinishMs != null ? estimatedFinishMs - nowMs : null;

  // ── Start Cook CTA — phase-aware label + caption ──────────────────────────
  // For frozen cooks, the "Start Cook" button reflects which part of the
  // frozen → table journey the user is about to kick off.
  // Frozen timestamps are persisted inside sequenceData.frozen (not as top-level
  // cook columns), so we read from cookSeqData?.frozen which is the same object.
  const startCookPhase: "thawing" | "tempering" | "ready" | null = (() => {
    const frozenInfo = cookSeqData?.frozen;
    if (!c.fromFrozen || !frozenInfo?.thawStartAt) return null;
    const thawEndMs = frozenInfo.thawEndAt ? new Date(frozenInfo.thawEndAt).getTime() : null;
    const preheatStartMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
    if (thawEndMs != null && nowMs < thawEndMs) return "thawing";
    if (preheatStartMs != null && nowMs < preheatStartMs) return "tempering";
    return "ready";
  })();

  const startCookLabel =
    startCookPhase === "thawing" ? "Begin Thawing" :
    startCookPhase === "tempering" ? "Meat is Thawed — Start Preheat" :
    "Start Cook";

  const startCookIcon =
    startCookPhase === "thawing" ? "thermometer" :
    startCookPhase === "tempering" ? "wind" :
    "play";

  const startCookCaption = (() => {
    if (startCookPhase === "thawing") {
      const grillTimeStr = c.plannedStartAt
        ? new Date(c.plannedStartAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
        : null;
      return grillTimeStr
        ? `Marks the start of your thaw timer. The grill goes on at ${grillTimeStr}.`
        : "Marks the start of your thaw timer.";
    }
    if (startCookPhase === "tempering") {
      return "Meat is thawed — let it temper before lighting the grill.";
    }
    if (startCookPhase === "ready") {
      return null;
    }
    // Fresh / non-frozen cook
    const meatOnAt = cookSeqData?.schedule?.[0]?.meatOnAt;
    if (meatOnAt) {
      const meatOnTime = new Date(meatOnAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      return `Starts your preheat timer. Meat on at ${meatOnTime}.`;
    }
    return "Marks this cook as active and starts your session timer.";
  })();

  // Live graph from accumulated readings — only when a probe is actively selected
  const liveGraphProbes = selectedMeaterProbe != null && liveReadings.length >= 2
    ? [{ probeName: selectedMeaterProbe.deviceName ?? "Probe 1", timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1].tempF }]
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
    const top = decisions[0];
    const rest = decisions.slice(1);
    const topActionCfg = ACTION_CONFIG[top.action] ?? { icon: "zap", label: top.action };
    const topUrgencyCfg = URGENCY_CONFIG[top.urgency] ?? { label: top.urgency.toUpperCase(), color: "#6B7280" };
    const topIsMaintain = top.action === "maintain";
    const topColor = topIsMaintain ? "#22c55e" : topUrgencyCfg.color;
    const topRationaleOpen = expandedRationale === 0;

    return (
      <View style={[s.decisionsSection, { borderColor: colors.border }]}>
        {/* Hero decision card — the #1 action to take right now */}
        <View style={[s.decisionCard, { backgroundColor: topColor + "12", borderColor: topColor + "40", borderRadius: colors.radius, padding: 14, gap: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[s.decisionActionChip, { backgroundColor: topColor + "25", borderColor: topColor + "50" }]}>
              <Feather name={topActionCfg.icon as any} size={13} color={topColor} />
              <Text style={[s.decisionActionText, { color: topColor, fontSize: 13 }]}>{topActionCfg.label}</Text>
            </View>
            {!topIsMaintain && (
              <View style={[s.decisionUrgencyBadge, { backgroundColor: topColor }]}>
                <Text style={s.decisionUrgencyText}>{topUrgencyCfg.label}</Text>
              </View>
            )}
          </View>
          <Text style={[s.decisionInstruction, { color: colors.foreground, fontSize: 16 }]}>{top.instruction}</Text>
          {top.rationale ? (
            <>
              <Pressable
                onPress={() => setExpandedRationale(topRationaleOpen ? null : 0)}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
                hitSlop={8}
              >
                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: topColor }}>
                  {topRationaleOpen ? "Hide reasoning" : "Why?"}
                </Text>
                <Feather name={topRationaleOpen ? "chevron-up" : "chevron-down"} size={12} color={topColor} />
              </Pressable>
              {topRationaleOpen && (
                <Text style={[s.decisionRationale, { color: colors.mutedForeground }]}>{top.rationale}</Text>
              )}
            </>
          ) : null}
        </View>

        {/* Compact secondary decisions */}
        {rest.map((d, i) => {
          const idx = i + 1;
          const actionCfg = ACTION_CONFIG[d.action] ?? { icon: "zap", label: d.action };
          const urgencyCfg = URGENCY_CONFIG[d.urgency] ?? { label: d.urgency.toUpperCase(), color: "#6B7280" };
          const isMaintain = d.action === "maintain";
          const cardColor = isMaintain ? "#22c55e" : urgencyCfg.color;
          const rationaleOpen = expandedRationale === idx;
          return (
            <View key={idx}>
              <Pressable
                onPress={() => d.rationale ? setExpandedRationale(rationaleOpen ? null : idx) : undefined}
                style={[
                  {
                    flexDirection: "row", alignItems: "center", gap: 10,
                    paddingHorizontal: 12, paddingVertical: 10,
                    borderWidth: 1, borderRadius: colors.radius,
                    backgroundColor: cardColor + "08", borderColor: cardColor + "28",
                  },
                ]}
              >
                <View style={[s.decisionActionChip, { backgroundColor: cardColor + "20", borderColor: cardColor + "40", flexShrink: 0 }]}>
                  <Feather name={actionCfg.icon as any} size={11} color={cardColor} />
                  <Text style={[s.decisionActionText, { color: cardColor, fontSize: 11 }]}>{actionCfg.label}</Text>
                </View>
                <Text style={{ flex: 1, fontFamily: "Inter_500Medium", fontSize: 13, color: colors.foreground }} numberOfLines={rationaleOpen ? undefined : 1}>
                  {d.instruction}
                </Text>
                {d.rationale ? (
                  <Feather name={rationaleOpen ? "chevron-up" : "help-circle"} size={14} color={colors.mutedForeground} />
                ) : null}
              </Pressable>
              {rationaleOpen && d.rationale && (
                <Text style={[s.decisionRationale, { color: colors.mutedForeground, paddingHorizontal: 12, paddingTop: 6, paddingBottom: 4 }]}>
                  {d.rationale}
                </Text>
              )}
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
          {cookStatus === "active" && (
            <Pressable
              onPress={() => setEditTimesVisible(true)}
              style={[s.editBtn, { marginRight: 2 }]}
              hitSlop={8}
            >
              <Feather name="clock" size={17} color="#F3EDE1" />
            </Pressable>
          )}
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

      {/* ── "Cook may already be done" warning ───────────────────────────
           Shown persistently when the estimated finish time has passed
           or is within 10 minutes, reminding the pitmaster to check the
           grill. Computed from the current (post-save) schedule data.   */}
      {cookStatus === "active" && (() => {
        const finishAt = cookSeqData?.schedule?.[0]?.estimatedFinishAt as string | null | undefined;
        if (!finishAt) return null;
        const finishMs = new Date(finishAt).getTime();
        if (finishMs > nowMs + 10 * 60_000) return null;
        return (
          <View
            style={{
              marginHorizontal: 16,
              marginTop: 6,
              marginBottom: 2,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              backgroundColor: "#F9731618",
              borderWidth: 1,
              borderColor: "#F9731660",
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 9,
            }}
          >
            <Feather name="alert-triangle" size={14} color="#F97316" />
            <Text
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: "Inter_500Medium",
                color: "#F97316",
              }}
            >
              Cook may already be done — check your grill.
            </Text>
          </View>
        );
      })()}

      {/* ── Check-In prompt banner (active cooks) ────────────────────────
           Shows a highlighted nudge when a notification was tapped
           (pendingCheckinSc) or whenever the cook is active so the
           pitmaster always has a one-tap path to log temps manually.      */}
      {cookStatus === "active" && (() => {
        const hasPlan = (cookSeqData?.schedule?.length ?? 0) > 0;
        const upcomingCheckins = (
          hasPlan && storedScheduledCheckins.length > 0
            ? storedScheduledCheckins
            : noPlanScheduledCheckins
        ).filter((sc) => sc.scheduledAt > nowMs);

        const targetSc: ScheduledCheckin | null =
          pendingCheckinSc ??
          upcomingCheckins[0] ??
          null;

        const isPending = pendingCheckinSc != null;

        const handleCheckinPress = () => {
          if (targetSc) {
            openCheckin(targetSc);
          } else {
            const schedule = getCheckinSchedule((cook as any)?.foodType ?? null);
            const phase = schedule.phases[0];
            openCheckin({
              id: `manual_${Date.now()}`,
              phaseKey: phase.key,
              phaseLabel: phase.label,
              scheduledAt: Date.now(),
              phase,
            });
          }
          setPendingCheckinSc(null);
        };

        return (
          <Pressable
            onPress={handleCheckinPress}
            style={({ pressed }) => ({
              marginHorizontal: 16,
              marginTop: 8,
              borderRadius: 10,
              overflow: "hidden",
              opacity: pressed ? 0.85 : 1,
              borderWidth: isPending ? 1.5 : 1,
              borderColor: isPending ? "#F59E0B" : colors.border,
              backgroundColor: isPending ? "#F59E0B18" : colors.card,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 14,
              paddingVertical: 11,
              gap: 10,
            })}
          >
            <View style={{
              width: 30, height: 30, borderRadius: 8,
              backgroundColor: isPending ? "#F59E0B" : colors.primary,
              alignItems: "center", justifyContent: "center",
            }}>
              <Feather name="thermometer" size={15} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{
                fontFamily: "Inter_700Bold", fontSize: 13,
                color: isPending ? "#F59E0B" : colors.foreground,
              }}>
                {isPending ? `Check In: ${pendingCheckinSc?.phaseLabel ?? "Now"}` : "Check In Now"}
              </Text>
              <Text style={{
                fontFamily: "Inter_400Regular", fontSize: 12,
                color: colors.mutedForeground, marginTop: 1,
              }}>
                {isPending
                  ? "Notification received — tap to log temps and get coaching"
                  : targetSc
                  ? `Next: ${targetSc.phaseLabel}`
                  : "Log current temps and get PitMaster coaching"}
              </Text>
            </View>
            <Feather name="chevron-right" size={16} color={isPending ? "#F59E0B" : colors.mutedForeground} />
          </Pressable>
        );
      })()}

      <ScrollView
        ref={scheduleScrollViewRef}
        contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isTablet ? { width: "100%", maxWidth: detailMaxWidth, alignSelf: "center", gap: 16 } : null}>
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

        {/* ── No-check-in-yet nudge (active cooks, zero saved check-ins) ── */}
        {cookStatus === "active" &&
          !checkinsLoading &&
          (cookCheckins as any[]).length === 0 &&
          !firstCheckinNudgeDismissed && (() => {
            const handlePress = () => {
              const schedule = getCheckinSchedule((cook as any)?.foodType ?? null);
              const phase = schedule.phases[0];
              openCheckin({
                id: `manual_${Date.now()}`,
                phaseKey: phase.key,
                phaseLabel: phase.label,
                scheduledAt: Date.now(),
                phase,
              });
            };
            return (
              <Pressable
                onPress={handlePress}
                style={({ pressed }) => ({
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  borderRadius: colors.radius,
                  borderWidth: 1,
                  borderColor: "#F59E0B60",
                  backgroundColor: "#F59E0B12",
                  paddingHorizontal: 14,
                  paddingVertical: 12,
                  opacity: pressed ? 0.82 : 1,
                })}
              >
                <View style={{
                  width: 32, height: 32, borderRadius: 8,
                  backgroundColor: "#F59E0B",
                  alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Feather name="thermometer" size={16} color="#fff" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{
                    fontFamily: "Inter_700Bold",
                    fontSize: 13,
                    color: "#F59E0B",
                    marginBottom: 2,
                  }}>
                    No temperatures logged yet
                  </Text>
                  <Text style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 12,
                    color: colors.mutedForeground,
                  }}>
                    Tap to log your first check-in and get PitMaster coaching
                  </Text>
                </View>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    setFirstCheckinNudgeDismissed(true);
                  }}
                  hitSlop={8}
                  style={{ padding: 4 }}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground as string} />
                </Pressable>
              </Pressable>
            );
          })()}

        {/* ── Thaw status banner (active frozen cooks before meat is on) ── */}
        <ThawStatusBanner
          cookStatus={cookStatus}
          isMeatOn={isMeatOn}
          actualStartAt={(c as any).actualStartAt ? new Date((c as any).actualStartAt).toISOString() : null}
          cookSeqData={cookSeqData}
          meatOnMs={effectiveMeatOnMs}
          nowMs={nowMs}
          thawMethod={(c as any).thawMethod ?? null}
          actualThawStartAt={(c as any).actualThawStartAt ? new Date((c as any).actualThawStartAt).toISOString() : null}
          onPress={() => setPlanSheetVisible(true)}
          onMarkThawStarted={handleMarkThawStarted}
          markingThaw={markingThaw}
          colors={colors}
        />

        {/* ── Adjust Timing button (planned frozen cook, thaw underway) ── */}
        {cookStatus === "planned" &&
          !!(c as any).fromFrozen &&
          !!(c as any).actualThawStartAt && (
            <Pressable
              onPress={() =>
                router.push(
                  `/(tabs)/plan?replanCookId=${id}` as any,
                )
              }
              style={({ pressed }) => ({
                flexDirection: "row" as const,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                gap: 6,
                borderWidth: 1,
                borderColor: "#38bdf8",
                borderRadius: colors.radius,
                paddingVertical: 10,
                marginTop: 4,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Feather name="sliders" size={14} color="#38bdf8" />
              <Text
                style={{
                  fontFamily: "Inter_600SemiBold",
                  fontSize: 13,
                  color: "#38bdf8",
                }}
              >
                Adjust Timing
              </Text>
            </Pressable>
          )}

        {/* ── Live probe temperature chips (active cooks) ──────────────── */}
        {cookStatus === "active" && (() => {
          const liveProbeTemp = selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? cookCurrentTempF;
          if (c.targetTempF == null && c.cookTempF == null && liveProbeTemp == null) return null;
          return (
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap" }}>
              {c.targetTempF != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#22c55e12", borderWidth: 1, borderColor: "#22c55e30" }}>
                  <Feather name="thermometer" size={11} color="#22c55e" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#22c55e" }}>{c.targetTempF}°F</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#22c55e99" }}>target</Text>
                </View>
              )}
              {c.cookTempF != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#3b82f612", borderWidth: 1, borderColor: "#3b82f630" }}>
                  <Feather name="wind" size={11} color="#3b82f6" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#3b82f6" }}>{c.cookTempF}°F</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#3b82f699" }}>pit</Text>
                </View>
              )}
              {liveProbeTemp != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: "#F59E0B12", borderWidth: 1, borderColor: "#F59E0B30" }}>
                  <Feather name="activity" size={11} color="#F59E0B" />
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: "#F59E0B" }}>{Math.round(liveProbeTemp)}°F</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#F59E0B99" }}>probe</Text>
                </View>
              )}
            </View>
          );
        })()}

        {/* ── Finish confidence window (active cooks with computed range) ─── */}
        {cookStatus === "active" && (() => {
          const lower = c.finishTimeRangeLower;
          const upper = c.finishTimeRangeUpper;
          if (!lower || !upper) return null;
          const fmtT = (iso: string) =>
            new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
          const lowerMs = new Date(lower).getTime();
          const upperMs = new Date(upper).getTime();
          const nowMs2 = Date.now();
          if (upperMs < nowMs2) return null;
          const midMs = (lowerMs + upperMs) / 2;
          const confidenceMinutes = (upperMs - lowerMs) / 60000;
          const confidenceLabel = confidenceMinutes <= 30 ? "High" : confidenceMinutes <= 60 ? "Medium" : "Low";
          const confidenceColor = confidenceMinutes <= 30 ? "#22c55e" : confidenceMinutes <= 60 ? "#F59E0B" : "#6B7280";
          const inMin = Math.max(0, Math.round((midMs - nowMs2) / 60000));
          return (
            <View
              style={{
                backgroundColor: colors.card as string,
                borderRadius: colors.radius as number,
                borderWidth: 1,
                borderColor: `${confidenceColor}40`,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
              }}
            >
              <View
                style={{
                  width: 34, height: 34, borderRadius: 17,
                  backgroundColor: `${confidenceColor}18`,
                  borderWidth: 1.5, borderColor: `${confidenceColor}50`,
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Feather name="clock" size={16} color={confidenceColor} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground as string }}>
                  Ready between {fmtT(lower)} – {fmtT(upper)}
                </Text>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground as string, marginTop: 2 }}>
                  ~{inMin} min away · {confidenceLabel} confidence
                </Text>
              </View>
              <View
                style={{
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10,
                  backgroundColor: `${confidenceColor}18`, borderWidth: 1, borderColor: `${confidenceColor}40`,
                }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: confidenceColor }}>{confidenceLabel}</Text>
              </View>
            </View>
          );
        })()}

        {/* ── Proactive Alert Coaching Card (shown on notification tap) ── */}
        {proactiveCoachingNote && (
          <View
            style={{
              backgroundColor: "#EAB30815",
              borderRadius: colors.radius as number,
              borderWidth: 1,
              borderColor: "#EAB30850",
              padding: 14,
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Feather name="alert-circle" size={16} color="#EAB308" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: "#EAB308",
                  marginBottom: 4,
                }}
              >
                PitMaster Alert
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.foreground as string,
                  lineHeight: 18,
                }}
              >
                {proactiveCoachingNote}
              </Text>
            </View>
            <Pressable onPress={() => setProactiveCoachingNote(null)} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground as string} />
            </Pressable>
          </View>
        )}

        {/* ── Cook Health Score (active / completed, and only once meat is on) ── */}
        {(cookStatus === "active" || cookStatus === "completed") && (cookStatus !== "active" || isMeatOn) && (
          <CookHealthScoreCard
            cookId={Number(id)}
            colors={colors}
            cookStatus={cookStatus}
            checkinCount={(cookCheckins as CookCheckin[]).length}
            lastDecision={cookStatus === "active" ? (c.analysisResult?.decisions?.[0] ?? null) : null}
          />
        )}

        {/* ── Competition Results (competition cooks with judge data) ── */}
        {(c as any).isCompetition && ((c as any).judgeScore != null || (c as any).competitionPlacement != null) && (() => {
          const cat = (c as any).competitionCategory as CompetitionCategory | undefined;
          const catColor = cat ? COMPETITION_CATEGORY_COLOR[cat] : "#EAB308";
          const appearance: number | null = (c as any).judgeScoreAppearance ?? null;
          const taste: number | null = (c as any).judgeScoreTaste ?? null;
          const texture: number | null = (c as any).judgeScoreTexture ?? null;
          const total: number | null = (c as any).judgeScore ?? null;
          const placement: number | null = (c as any).competitionPlacement ?? null;
          const teamCount: number | null = (c as any).competitionTeamCount ?? null;
          const hasSubScores = appearance != null || taste != null || texture != null;
          const pct = placement != null && teamCount != null ? computePercentile(placement, teamCount) : null;
          return (
            <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: catColor + "44", padding: 14, marginBottom: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: catColor }} />
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: catColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {cat ? COMPETITION_CATEGORY_LABEL[cat] : "Competition"} Results
                </Text>
              </View>
              {placement != null && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <Feather name="award" size={14} color="#EAB308" />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 22, color: colors.foreground }}>{placementLabel(placement)}</Text>
                  {teamCount != null && <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>of {teamCount} teams</Text>}
                  {pct != null && (
                    <View style={{ marginLeft: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: "#EAB30820", borderWidth: 1, borderColor: "#EAB308" }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: "#EAB308" }}>{pct}</Text>
                    </View>
                  )}
                </View>
              )}
              {hasSubScores ? (
                <View style={{ flexDirection: "row", gap: 10 }}>
                  {[
                    { label: "App", val: appearance, max: COMPETITION_SCORING.maxAppearance },
                    { label: "Taste", val: taste, max: COMPETITION_SCORING.maxTaste },
                    { label: "Texture", val: texture, max: COMPETITION_SCORING.maxTexture },
                  ].map(({ label, val, max }) => val != null ? (
                    <View key={label} style={{ flex: 1, backgroundColor: colors.background, borderRadius: 8, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground }}>{val}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground, marginTop: 1 }}>{label} /{max}</Text>
                      <View style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 4 }}>
                        <View style={{ width: `${(val / max) * 100}%` as any, height: 3, borderRadius: 2, backgroundColor: catColor }} />
                      </View>
                    </View>
                  ) : null)}
                  {total != null && (
                    <View style={{ flex: 1, backgroundColor: colors.background, borderRadius: 8, padding: 8, alignItems: "center" }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: catColor }}>{total.toFixed(1)}</Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 9, color: colors.mutedForeground, marginTop: 1 }}>Total /360</Text>
                      <View style={{ width: "100%", height: 3, borderRadius: 2, backgroundColor: colors.border, marginTop: 4 }}>
                        <View style={{ width: `${(total / COMPETITION_SCORING.maxScore) * 100}%` as any, height: 3, borderRadius: 2, backgroundColor: catColor }} />
                      </View>
                    </View>
                  )}
                </View>
              ) : total != null ? (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Feather name="star" size={13} color={catColor} />
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>{total.toFixed(1)}</Text>
                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>/ {COMPETITION_SCORING.maxScore}</Text>
                </View>
              ) : null}
            </View>
          );
        })()}

        {/* ── Live Cook section (active cooks only) ──────────── */}
        <LiveCookSection
          c={c}
          colors={colors}
          weather={weather}
          meaterLinked={meaterLinked}
          meaterProbes={meaterProbes}
          thermoworksLinked={thermoworksLinked}
          thermoworksProbes={thermoworksProbes}
          selectedProbeId={selectedProbeId}
          onSelectProbe={handleSelectProbe}
          liveGraphProbes={liveGraphProbes}
          liveReadings={liveReadings}
          cardWidth={cardWidth}
          elapsedMs={elapsedMs}
          remainingMs={remainingMs}
          estimatedFinishMs={estimatedFinishMs}
          setAlertSheetVisible={setAlertSheetVisible}
          setAlertMode={setAlertMode}
          activeCookAlerts={activeCookAlerts}
          nowMs={nowMs}
          targetTempF={c.targetTempF ?? null}
          cookTempF={c.cookTempF ?? null}
          nextSpritzMs={nextSpritzMs}
          onViewDetails={cookStatus === "active" ? () => setPlanSheetVisible(true) : undefined}
        />
        <CookSummaryCard
          c={c}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          planSheetVisible={planSheetVisible}
          setPlanSheetVisible={setPlanSheetVisible}
        />

        {/* ── Cook Timeline (planned cooks only) ── */}
        {cookStatus === "planned" && (
          <>
            <FrozenTimeline c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs} />
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
              onQuickLog={undefined}
            />
            <PlannedCookTimeline c={c} colors={colors} />
          </>
        )}

        {/* ── Start Cook CTA (planned cooks only) ── */}
        {cookStatus === "planned" && (
          <>
            <Pressable
              style={({ pressed }) => [
                s.actionBtn,
                {
                  backgroundColor: STATUS_COLORS["active"] || colors.primary,
                  borderRadius: colors.radius,
                  marginTop: 4,
                },
                (updateCook.isPending || pressed) && { opacity: 0.7 },
              ]}
              onPress={() => handleStatusUpdate("active")}
              disabled={updateCook.isPending}
            >
              {updateCook.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name={startCookIcon as any} size={18} color="#fff" />
                  <Text style={s.actionText}>{startCookLabel}</Text>
                </>
              )}
            </Pressable>
            {startCookCaption && (
              <Text
                style={{
                  fontSize: 12,
                  fontFamily: "Inter_400Regular",
                  color: colors.mutedForeground,
                  textAlign: "center",
                  marginTop: 6,
                  paddingHorizontal: 8,
                  lineHeight: 17,
                }}
              >
                {startCookCaption}
              </Text>
            )}
          </>
        )}

        {/* ── Add to Planned Cook (multi-cook session from a solo planned cook) ── */}
        {cookStatus === "planned" && !(cook as any)?.sessionId && (
          <Pressable
            onPress={() => setAddToSessionOpen(true)}
            style={({ pressed }) => [
              {
                flexDirection: "row" as const,
                alignItems: "center" as const,
                gap: 10,
                backgroundColor: colors.card,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: colors.radius,
                paddingHorizontal: 16,
                paddingVertical: 13,
                marginTop: 8,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text
              style={{
                fontFamily: "Inter_600SemiBold",
                fontSize: 14,
                color: colors.foreground,
                flex: 1,
              }}
            >
              Add to planned cook
            </Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* ── Techniques Used (collapsible) ── */}
        {(() => {
          const saveTechnique = async (data: UpdateCookBody) => {
            await updateCook.mutateAsync({ id: Number(id), data });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          };
          const hasTechValues = !!(c.cookingMethod || c.injection || c.spritzFrequency || c.spritzLiquid || c.wrapFinish);
          return (
            <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border }}>
              <Pressable
                onPress={() => setTechsExpanded((v) => !v)}
                style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 8 }}
              >
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 12, color: colors.mutedForeground, textTransform: "uppercase", letterSpacing: 0.8, flex: 1 }}>
                  Techniques Used
                </Text>
                {hasTechValues && !techsExpanded && (
                  <View style={{ flexDirection: "row", gap: 5 }}>
                    {[c.cookingMethod, c.injection, c.spritzFrequency, c.spritzLiquid, c.wrapFinish].filter(Boolean).map((v: string, i: number) => (
                      <View key={i} style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.muted }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: colors.mutedForeground }}>{v}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <Feather name={techsExpanded ? "chevron-down" : "chevron-right"} size={14} color={colors.mutedForeground} />
              </Pressable>
              {techsExpanded && (
                <View style={{ paddingHorizontal: 14, paddingBottom: 4 }}>
                  <SettingsRow
                    label="Cooking Method"
                    value={c.cookingMethod ?? null}
                    placeholder="Not set"
                    icon="thermometer"
                    iconColor="#E84820"
                    onPress={() => setTechMethodSheetOpen(true)}
                    onClear={() => saveTechnique({ cookingMethod: null })}
                    colors={colors}
                  />
                  <SettingsRow
                    label="Injection"
                    value={c.injection ?? null}
                    placeholder="Not set"
                    icon="droplet"
                    iconColor="#6C3BF5"
                    onPress={() => setTechInjectionSheetOpen(true)}
                    onClear={() => saveTechnique({ injection: null })}
                    colors={colors}
                  />
                  <SettingsRow
                    label="Spritz Frequency"
                    value={c.spritzFrequency ?? null}
                    placeholder="Not set"
                    icon="wind"
                    iconColor="#0EA5E9"
                    onPress={() => setTechSpritzSheetOpen(true)}
                    onClear={() => saveTechnique({ spritzFrequency: null })}
                    colors={colors}
                  />
                  <SettingsRow
                    label="Spritz Liquid"
                    value={c.spritzLiquid ?? null}
                    placeholder="Not set"
                    icon="droplet"
                    iconColor="#22C55E"
                    onPress={() => setTechSpritzLiquidSheetOpen(true)}
                    onClear={() => saveTechnique({ spritzLiquid: null })}
                    colors={colors}
                  />
                  <SettingsRow
                    label="Wrap / Finish"
                    value={c.wrapFinish ?? null}
                    placeholder="Not set"
                    icon="package"
                    iconColor="#F59E0B"
                    onPress={() => setTechWrapFinishSheetOpen(true)}
                    onClear={() => saveTechnique({ wrapFinish: null })}
                    colors={colors}
                    isLast
                  />
                </View>
              )}
            </View>
          );
        })()}

        <OptionBottomSheet
          visible={techMethodSheetOpen}
          title="Cooking Method"
          options={QP_COOK_METHODS}
          selected={c.cookingMethod ?? null}
          onChange={async (v) => {
            await updateCook.mutateAsync({ id: Number(id), data: { cookingMethod: v } });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          }}
          onClose={() => setTechMethodSheetOpen(false)}
          colors={colors}
        />
        <OptionBottomSheet
          visible={techInjectionSheetOpen}
          title="Injection"
          options={QP_INJECTION_OPTIONS}
          selected={c.injection ?? null}
          onChange={async (v) => {
            await updateCook.mutateAsync({ id: Number(id), data: { injection: v } });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          }}
          onClose={() => setTechInjectionSheetOpen(false)}
          colors={colors}
        />
        <OptionBottomSheet
          visible={techSpritzSheetOpen}
          title="Spritz Frequency"
          options={QP_SPRITZ_FREQUENCIES}
          selected={c.spritzFrequency ?? null}
          onChange={async (v) => {
            await updateCook.mutateAsync({ id: Number(id), data: { spritzFrequency: v } });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          }}
          onClose={() => setTechSpritzSheetOpen(false)}
          colors={colors}
        />
        <OptionBottomSheet
          visible={techSpritzLiquidSheetOpen}
          title="Spritz Liquid"
          options={QP_SPRITZ_LIQUIDS}
          selected={c.spritzLiquid ?? null}
          onChange={async (v) => {
            await updateCook.mutateAsync({ id: Number(id), data: { spritzLiquid: v } });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          }}
          onClose={() => setTechSpritzLiquidSheetOpen(false)}
          colors={colors}
        />
        <OptionBottomSheet
          visible={techWrapFinishSheetOpen}
          title="Wrap / Finish"
          options={QP_WRAP_FINISH_OPTIONS}
          selected={c.wrapFinish ?? null}
          onChange={async (v) => {
            await updateCook.mutateAsync({ id: Number(id), data: { wrapFinish: v } });
            await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
          }}
          onClose={() => setTechWrapFinishSheetOpen(false)}
          colors={colors}
        />

        {cookStatus !== "planned" && (
          <>
            <FrozenTimeline c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs} />
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
              onQuickLog={cookStatus === "active" ? handleLogFuelEvent : undefined}
            />
          </>
        )}

        {/* ── Timeline accuracy recap ───────────────────────────── */}
        {Object.keys(confirmedSteps).length > 0 && cookSeqData && (
          <ActualVsPlannedRecap
            sequenceData={cookSeqData}
            confirmedSteps={confirmedSteps}
            currentItemIdx={(() => {
              const cookFT = (c.foodType ?? "").toLowerCase().trim();
              const meatOnMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
              let best = -1;
              if (meatOnMs !== null) {
                let bestDelta = Infinity;
                cookSeqData.schedule.forEach((item: any, idx: number) => {
                  if ((item.foodType ?? "").toLowerCase().trim() !== cookFT) return;
                  const t = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
                  if (t === null) return;
                  const d = Math.abs(t - meatOnMs);
                  if (d < bestDelta) { bestDelta = d; best = idx; }
                });
              }
              if (best === -1) best = cookSeqData.schedule.findIndex((item: any) => (item.foodType ?? "").toLowerCase().trim() === cookFT);
              return Math.max(0, best);
            })()}
            colors={colors}
          />
        )}

        {/* ── Stored AI analysis (hidden for active cooks until meat is on) ── */}
        {(cookStatus !== "active" || isMeatOn) && <StoredAiAnalysis
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
        />}

        {/* ── Ask PitMaster (active cooks only, once meat is on) ── */}
        {(cookStatus !== "active" || isMeatOn) && <AskPitMaster
          c={c}
          colors={colors}
          meaterLinked={meaterLinked}
          meaterProbes={selectedMeaterProbe ? [selectedMeaterProbe] : []}
          lastCheckinInternalTempF={lastCheckin?.internalTempF ?? null}
          lastCheckinPitTempF={lastCheckin?.pitTempF ?? null}
          lastCheckinAt={lastCheckin?.createdAt ?? null}
          cookNotes={cookNotes}
          setCookNotes={setCookNotes}
          qpMethod={qpMethod}
          qpStartTemp={qpStartTemp}
          qpInjection={qpInjection}
          qpSpritz={qpSpritz}
          qpWrap={qpWrap}
          activeCookNoteTags={activeCookNoteTags}
          setActiveCookNoteTags={setActiveCookNoteTags}
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
          cookPhotoCount={cookPhotoCount}
        />}

        {/* ── Soft "you're 1 cook from the wall" nudge ──────────
            Free users who just completed their second cook see a
            one-time, dismissible banner reminding them they're one
            cook away from the free-tier cap. Pro users and anyone
            who has dismissed the nudge never see it. */}
        <Cook2NudgeBanner
          cookStatus={cookStatus}
          colors={colors}
          effectivePro={effectivePro}
          showPaywall={showPaywall}
          foodType={cook?.foodType ?? null}
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

        {/* ── Cook Photos ──────────────────────────────────────── */}
        <CookPhotosSection cookId={Number(id)} colors={colors} />

        {/* ── Share Cook (completed cooks only) ───────────────── */}
        <ShareCookButton cook={c} colors={colors} />


        {/* ── Smart Check-In Timeline ──────────────────────── */}
        <CookCheckinTimeline
          c={c as Record<string, unknown>}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          cookSeqData={cookSeqData as SequenceData | null}
          checkins={cookCheckins as CookCheckin[]}
          checkinsLoading={checkinsLoading}
          onOpenCheckin={openCheckin}
        />

        {/* ── Cook Journey Replay (completed cooks) ─────────── */}
        <CookJourneyReplay
          c={c as Record<string, unknown>}
          colors={colors}
          checkins={cookCheckins as CookCheckin[]}
          cookSeqData={cookSeqData as SequenceData | null}
        />

        {/* ── Pit Journal Feed ──────────────────────────────── */}
        <PitJournalFeed
          cookId={Number(id)}
          colors={colors}
          cookStatus={cookStatus}
          checkins={cookCheckins as CookCheckin[]}
          triggeredAlerts={activeCookAlerts
            .filter((a) => a.triggeredAt != null)
            .map((a) => ({ id: a.id, message: a.message ?? "Temperature alert triggered", triggeredAt: a.triggeredAt as string }))}
          stepConfirmations={(() => {
            interface StepItem {
              phaseKey?: string | null;
              phaseLabel?: string | null;
              confirmedAt?: string | null;
            }
            const schedule = (cookSeqData?.schedule ?? []) as StepItem[];
            return schedule
              .filter((item) => item.confirmedAt != null)
              .map((item, i) => ({
                id: `step-${item.phaseKey ?? i}`,
                label: item.phaseLabel ?? "Step complete",
                confirmedAt: item.confirmedAt as string,
              }));
          })()}
          liveReadingMilestones={liveReadings.filter((r, i, arr) => {
            if (i === 0) return false;
            const prev = arr[i - 1];
            return Math.floor(r.tempF / 25) > Math.floor(prev.tempF / 25);
          }).map((r, i) => ({ id: `probe-${i}`, tempF: r.tempF, timeMinutes: r.timeMinutes }))}
        />

        {/* ── Check-in History (AI analysis history + upcoming planned) ────────── */}
        <CheckInHistory
          c={c}
          colors={colors}
          effectivePro={effectivePro}
          isIdentityLinked={isIdentityLinked}
          showPaywall={showPaywall}
          plannedCheckins={(() => {
            if (cookStatus !== "active") return [];
            // When a cook has an AI plan the hook populates storedScheduledCheckins.
            // When there's no plan, prefer noPlanScheduledCheckins (set immediately
            // by handleStatusUpdate) so the card shows reminders right away without
            // waiting for the hook. Use storedScheduledCheckins only when an AI plan
            // is present (cookSeqData has schedule items) to avoid stale values
            // from a prior cook bleeding in.
            const hasPlan = !!cookSeqData?.schedule?.length;
            const base = hasPlan && storedScheduledCheckins.length > 0
              ? storedScheduledCheckins
              : noPlanScheduledCheckins;
            // Sort ascending by scheduledAt so current (first) is always the soonest.
            return base
              .filter((sc) => !removedPlannedKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs)
              .sort((a, b) => a.scheduledAt - b.scheduledAt);
          })()}
          onRemovePlanned={(phaseKey) => {
            setRemovedPlannedKeys((prev) => new Set([...prev, phaseKey]));
            cancelCheckinNotificationForPhase(Number(id), phaseKey).catch(() => {});
          }}
        />

        {/* Status action button — hidden for planned (the prominent Start Cook CTA above handles that) */}
        {nextStatus && cookStatus !== "planned" && (
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
        </View>
      </ScrollView>

      {/* ── Wrap Temp Sheet ──────────────────────────────────── */}
      {wrapTempPending && (() => {
        const item = cookSeqData?.schedule?.[wrapTempPending.itemIdx] as any;
        const wrapLabel =
          item?.wrapMethod === "foil"
            ? "Wrap in foil"
            : item?.wrapMethod === "butcher_paper"
              ? "Wrap in butcher paper"
              : "Confirm Wrap";
        return (
          <WrapTempSheet
            visible
            wrapTempF={item?.wrapTempF ?? null}
            wrapLabel={wrapLabel}
            onSkip={() => confirmWrap(wrapTempPending.key, wrapTempPending.itemIdx, null)}
            onConfirm={(tempF) => confirmWrap(wrapTempPending.key, wrapTempPending.itemIdx, tempF)}
            colors={colors}
          />
        );
      })()}

      {/* ── Add to Planned Cook Modal ────────────────────────── */}
      <AddToPlannedCookModal
        visible={addToSessionOpen}
        onClose={() => setAddToSessionOpen(false)}
        colors={colors}
        insets={insets}
        cookId={Number(id)}
        cookFoodType={(cook as any)?.foodType ?? null}
        cookWeightLbs={(cook as any)?.weightLbs ?? null}
        cookGrillId={(cook as any)?.grillId ?? null}
        grills={grills}
        onSuccess={() => {}}
      />

      {/* ── Edit Cook Modal ──────────────────────────────────── */}
      {/* (Cook2NudgeBanner rendered above; see component below.) */}
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
        editCookingMethod={editCookingMethod}
        setEditCookingMethod={setEditCookingMethod}
        editInjection={editInjection}
        setEditInjection={setEditInjection}
        editSpritzFrequency={editSpritzFrequency}
        setEditSpritzFrequency={setEditSpritzFrequency}
        editSpritzLiquid={editSpritzLiquid}
        setEditSpritzLiquid={setEditSpritzLiquid}
        editWrapFinish={editWrapFinish}
        setEditWrapFinish={setEditWrapFinish}
      />

      {/* ── Edit Cook Times Sheet (active cook timestamp correction) ── */}
      {cookStatus === "active" && (
        <EditCookTimesSheet
          visible={editTimesVisible}
          fromFrozen={!!(cook as any)?.fromFrozen}
          initialMeatOnAt={
            (cook as any)?.actualStartAt
              ? new Date((cook as any).actualStartAt)
              : cookSeqData?.schedule?.[0]?.meatOnAt
                ? new Date(cookSeqData.schedule[0].meatOnAt as string)
                : null
          }
          initialThawStartAt={
            (cook as any)?.actualThawStartAt
              ? new Date((cook as any).actualThawStartAt)
              : (cookSeqData?.frozen as any)?.thawStartAt
                ? new Date((cookSeqData!.frozen as any).thawStartAt)
                : null
          }
          estimatedFinishAt={cookSeqData?.schedule?.[0]?.estimatedFinishAt ?? null}
          saving={editTimesSaving}
          onClose={() => setEditTimesVisible(false)}
          onSave={handleSaveCookTimes}
          colors={colors}
        />
      )}

      {/* ── Set Alert Sheet ─────────────────────────────────── */}
      {/* (banner component is defined below the screen export) */}
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

      {/* ── Quick Log FAB (active cooks only) ────────────────── */}
      {cookStatus === "active" && (
        <Pressable
          onPress={() => setQuickLogVisible(true)}
          style={({ pressed }) => ({
            position: "absolute",
            bottom: botPad + 24,
            right: 24,
            paddingHorizontal: 16,
            paddingVertical: 10,
            borderRadius: 24,
            backgroundColor: "#E84820",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.4,
            shadowRadius: 5,
            elevation: 8,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Feather name="plus-circle" size={18} color="#fff" />
            <Text style={{ color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold", marginLeft: 7 }}>Log</Text>
          </View>
        </Pressable>
      )}

      {/* ── Quick Log Sheet ───────────────────────────────────── */}
      <QuickLogSheet
        visible={quickLogVisible}
        onClose={() => setQuickLogVisible(false)}
        cookId={Number(id)}
        colors={colors}
        onEventLogged={() => {
          qc.invalidateQueries({ queryKey: getListCookEventsQueryKey(Number(id)) });
        }}
        onNoteLogged={(noteText) => {
          // Persist note into cookNotes so subsequent manual analyses include it.
          setCookNotes((prev) => (prev.trim() ? `${prev.trim()}\n${noteText}` : noteText));
          // Inject directly into analysis call so PitMaster sees it
          // immediately without waiting for a React state update cycle.
          analyze({ extraNotes: noteText });
        }}
      />

      {/* ── Auto Check-In Toast ──────────────────────────────── */}
      {autoCheckinToast != null && (
        <View
          style={{
            position: "absolute",
            bottom: 90 + insets.bottom,
            left: 16,
            right: 16,
            backgroundColor: "#1C1C1F",
            borderColor: "#22c55e",
            borderWidth: 1,
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
            zIndex: 9999,
          }}
        >
          <Feather name="check-circle" size={16} color="#22c55e" />
          <Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {autoCheckinToast}
          </Text>
          <Pressable onPress={() => setAutoCheckinToast(null)} hitSlop={10}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      {/* ── Smart Check-In Modal ─────────────────────────────── */}
      {activeCheckin && (
        <CheckinModal
          visible={checkinModalVisible}
          onClose={() => setCheckinModalVisible(false)}
          cookId={Number(id)}
          colors={colors}
          phase={activeCheckin.phase}
          scheduledAt={activeCheckin.scheduledAt}
          foodType={cook?.foodType}
          weightLbs={cook?.weightLbs ?? null}
          currentInternalTempF={selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? null}
          currentPitTempF={selectedMeaterProbe?.ambientTempF ?? null}
          probeSource={
            selectedMeaterProbe?.internalTempF != null
              ? "meater"
              : selectedThermoworksProbe?.tempF != null
              ? "thermoworks"
              : null
          }
          lastCheckinInternalTempF={
            cookCheckins.length > 0
              ? (cookCheckins[cookCheckins.length - 1] as CookCheckin).internalTempF ?? null
              : null
          }
          targetCookTempF={cook?.cookTempF ?? null}
          weatherTempF={weather?.tempF ?? null}
          weatherWindSpeedMph={weather?.windSpeedMph ?? null}
          onCheckinSaved={(savedInternalTempF) => {
            // A manual check-in may carry a fresher AI finish window from the
            // server. Set the pending-clear flag and invalidate the cook query
            // — the dataUpdatedAt-watching effect clears wrapAdjustedFinishMs
            // atomically when fresh data lands (covers both bounds-change and
            // identical-bounds edge cases; no stale-value backward jump).
            pendingWrapClearRef.current = true;
            qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
            qc.invalidateQueries({ queryKey: getListCookCheckinsQueryKey(Number(id)) });
            // Adaptive rescheduling: recompute remaining notifications based on
            // the actual internal temp just recorded vs what was expected.
            // Use the submitted modal temp (savedInternalTempF) — not the probe
            // reading — so manual-entry cooks reschedule correctly too.
            const first = cookSeqData?.schedule?.[0];
            if (first?.meatOnAt && first?.estimatedFinishAt) {
              const completedKeys = new Set(
                (cookCheckins as CookCheckin[])
                  .map((ci) => ci.phaseKey)
                  .filter((k): k is string => k != null),
              );
              if (activeCheckin?.phaseKey) completedKeys.add(activeCheckin.phaseKey);
              // Prefer the saved check-in temp; fall back to live probe only when
              // no manual temp was entered (pure visual-milestone check-in).
              const adaptiveTemp =
                savedInternalTempF ??
                selectedMeaterProbe?.internalTempF ??
                selectedThermoworksProbe?.tempF ??
                null;
              rescheduleCheckinNotifications({
                cookId: Number(id),
                foodType: first.foodType ?? null,
                weightLbs: cook?.weightLbs ?? null,
                meatOnAt: first.meatOnAt,
                estimatedFinishAt: first.estimatedFinishAt,
                wrapAtMinutes: first.wrapAtMinutes ?? null,
                completedPhaseKeys: completedKeys,
                actualInternalTempF: adaptiveTemp,
              }).catch(() => {});
            }
          }}
        />
      )}
    </View>
  );
}

/**
 * Cook2NudgeBanner — soft, dismissible upgrade prompt shown on the cook
 * detail screen when a free user has just hit their 2nd completed cook.
 *
 * Rules:
 *  - Pro users never see it.
 *  - Only renders when this cook is completed AND the total completed-cook
 *    count is exactly 2 (i.e. one more cook will hit the wall).
 *  - Dismissal is persisted in AsyncStorage so we never nag the user twice.
 */
function Cook2NudgeBanner({
  cookStatus,
  colors,
  effectivePro,
  showPaywall,
  foodType,
}: {
  cookStatus: string | null | undefined;
  colors: any;
  effectivePro: boolean;
  showPaywall: (opts: ShowOptions) => void;
  foodType: string | null;
}) {
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const { data: allCooks } = useListCooks(undefined, {
    query: {
      queryKey: getListCooksQueryKey(),
      enabled: !effectivePro && cookStatus === "completed",
    },
  });

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("cook2_nudge_dismissed")
      .then((v) => {
        if (!cancelled) setDismissed(v === "1");
      })
      .catch(() => {
        if (!cancelled) setDismissed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const completedCount = (allCooks ?? []).filter(
    (c) => c?.status === "completed",
  ).length;
  const eligible =
    !effectivePro &&
    cookStatus === "completed" &&
    dismissed === false &&
    completedCount === 2;

  // Persist the "shown" flag the moment the banner becomes eligible to
  // render. This guarantees one-time exposure per the spec — even if the
  // user simply ignores the banner and navigates away, it will not
  // reappear on the next visit.
  useEffect(() => {
    if (!eligible) return;
    AsyncStorage.setItem("cook2_nudge_dismissed", "1").catch(() => {});
  }, [eligible]);

  if (!eligible) return null;

  const handleDismiss = () => {
    setDismissed(true);
    AsyncStorage.setItem("cook2_nudge_dismissed", "1").catch(() => {});
  };
  // Mark as "shown" the first time the banner actually paints. Persisting on
  // first display (rather than only on dismissal/CTA) guarantees one-time
  // exposure per the spec: even if the user backgrounds the app or scrolls
  // past the banner, it will not reappear on a future visit.
  const handleSeePro = () => {
    AsyncStorage.setItem("cook2_nudge_dismissed", "1").catch(() => {});
    setDismissed(true);
    showPaywall({ trigger: "pro_required", foodType });
  };

  return (
    <View
      style={{
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 4,
        padding: 14,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: "#E84520",
        backgroundColor: "rgba(232,69,32,0.08)",
        flexDirection: "row",
        gap: 12,
        alignItems: "flex-start",
      }}
    >
      <Feather name="zap" size={18} color="#E84520" style={{ marginTop: 1 }} />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            fontSize: 14,
            marginBottom: 4,
          }}
        >
          One more cook and you'll hit your free limit
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 12.5,
            lineHeight: 18,
          }}
        >
          {`Nice work on this ${foodType ?? "cook"}! You've used 2 of 3 free cooks. Pro keeps your full history and unlocks unlimited logging.`}
        </Text>
        <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}>
          <Pressable onPress={handleSeePro} accessibilityRole="button">
            <Text
              style={{
                color: "#E84520",
                fontFamily: "Inter_700Bold",
                fontSize: 13,
              }}
            >
              See Pro →
            </Text>
          </Pressable>
          <Pressable onPress={handleDismiss} accessibilityRole="button">
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
                fontSize: 13,
              }}
            >
              Dismiss
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
