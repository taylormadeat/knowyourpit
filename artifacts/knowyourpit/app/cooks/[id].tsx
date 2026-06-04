import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getProbePollingIntervalMs } from "@/constants/polling";
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
  Animated,
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
  useDismissCookOutlier,
  useListGrills,
  type Cook,
  type Grill,
  type UpdateCookBody,
  useGetMeaterReadings,
  useGetThermoworksReadings,
  useListCooks,
  useListCookCheckins,
  useCreateCookCheckin,
  useUploadTemperatureData,
  useListTemperatureReadings,
  getListTemperatureReadingsQueryKey,
  type TemperatureReading,
  getListCooksQueryKey,
  getGetCookQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  getGetMeaterReadingsQueryKey,
  getGetThermoworksReadingsQueryKey,
  getListCookCheckinsQueryKey,
  getGetCookHealthQueryKey,
} from "@workspace/api-client-react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  loadProbeState,
  saveMeatProbeId,
  savePitProbeId,
  saveProbeLabels,
  buildUpdatedProbeLabels,
  clearLastInkbird,
} from "@/utils/probePersistence";
import * as Notifications from "expo-notifications";
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
import { letterGrade, VERDICT_SCORE } from "@/utils/gradeUtils";
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
import type { ScheduledCheckin, CheckinSequenceAnchor } from "@/constants/checkinKnowledge";
import { getCheckinSchedule, generateCheckinSchedule } from "@/constants/checkinKnowledge";
import type { CookCheckin } from "@workspace/api-client-react";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
} from "@/constants/cookQuickPicks";
import { WrapTempSheet } from "@/components/cook-detail/WrapTempSheet";
import { ActualVsPlannedRecap } from "@/components/cook-detail/ActualVsPlannedRecap";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { EditCookTimesSheet } from "@/components/cook-detail/EditCookTimesSheet";
import { AddToPlannedCookModal } from "@/components/cook-detail/AddToPlannedCookModal";
import { UnifiedCheckinSheet } from "@/components/cook-detail/UnifiedCheckinSheet";
import { CheckinPreviewSheet } from "@/components/cook-detail/CheckinPreviewSheet";
import { PitMasterChatModal } from "@/components/PitMasterChatModal";
import { CookActivityTimeline } from "@/components/cook-detail/CookActivityTimeline";
import { LiveCookSection } from "@/components/cook-detail/LiveCookSection";
import { type QualFactor } from "@/components/CookFactorsSheet";
import { useInkbirdBLE } from "@/hooks/useInkbirdBLE";
import { useBleProbes } from "@/contexts/BleProbeContext";
import { useLanProbes, type LanProbeReading } from "@/hooks/useLanProbes";
import { CookSummaryCard } from "@/components/cook-detail/CookSummaryCard";
import { SequenceSchedule } from "@/components/cook-detail/SequenceSchedule";
import { FrozenTimeline } from "@/components/cook-detail/FrozenTimeline";
import { PlannedCookTimeline } from "@/components/cook-detail/PlannedCookTimeline";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";
import { StoredAiAnalysis } from "@/components/cook-detail/StoredAiAnalysis";
import { RateThisCook } from "@/components/cook-detail/RateThisCook";
import { RateCookSheet } from "@/components/cook-detail/RateCookSheet";
import { ShareCookButton } from "@/components/cook-detail/ShareCookButton";
import { NextUpBanner } from "@/components/NextUpBanner";
import { CookHealthScoreCard } from "@/components/cook-detail/CookHealthScoreCard";
import { useProactiveAlerts } from "@/hooks/useProactiveAlerts";
import { getListCookEventsQueryKey } from "@workspace/api-client-react";

// Silence a dev-only LogBox warning that can fire from RN's measureLayout when
// the underlying native node briefly detaches between layout passes. Our
// auto-scroll uses cached onLayout offsets and never calls measureLayout, but
// other libraries occasionally trigger the same warning.
LogBox.ignoreLogs(["ref.measureLayout must be called with a ref"]);

const logoImg = require("@/assets/images/icon-transparent-light.png");

// Per-session temp-mode choices (probe / manual) keyed by cookId string.
// Module-scope so explicit user choices (probe → manual or vice-versa) survive
// Expo Router re-mounts within one app session without an AsyncStorage write.
const sessionTempModes = new Map<string, "probe" | "manual">();

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
  const dismissCookOutlier = useDismissCookOutlier();
  const analyzeMutation = useAnalyzeCook();
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();
  const effectivePro = useEffectivePro();
  // Ref so async effects can read the latest effectivePro value without
  // adding it to their dependency arrays (which would cause unwanted re-runs).
  const effectiveProRef = useRef(effectivePro);
  effectiveProRef.current = effectivePro;
  // Used to suppress the Cook Coach blur during the brief Phase-1→Phase-2 RC
  // window on first install (no SecureStore cache yet). Without this, a Pro
  // user reopening the app for the first time after install would see the
  // paywall blur flash for ~1s before isPro flips to true.
  const { isIdentityLinked } = useSubscription();

  const [images, setImages] = useState<PickedImage[]>([]);
  const [cookNotes, setCookNotes] = useState("");
  const [fGradeQuip, setFGradeQuip] = useState<string | null>(null);

  // Quick-pick chip state for the scanner "describe the cook" section
  const [qpMethod, setQpMethod] = useState<string | null>(null);
  const [qpStartTemp, setQpStartTemp] = useState<string | null>(null);
  const [qpInjection, setQpInjection] = useState<string | null>(null);
  const [qpSpritz, setQpSpritz] = useState<string | null>(null);
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
    if (c.wrapFinish) setQpWrap(c.wrapFinish);
  }, [cook]);

  // Serialise chip selections into a natural-language string sent to the AI
  const scanNotes = useMemo(() => {
    const parts: string[] = [];
    if (qpMethod) parts.push(`Method: ${qpMethod}`);
    if (qpStartTemp) parts.push(`Starting temp: ${qpStartTemp}`);
    if (qpInjection) parts.push(`Injection: ${qpInjection}`);
    if (qpSpritz) parts.push(`Spritz/Mop: ${qpSpritz}`);
    if (qpWrap) parts.push(`Wrap/Finish: ${qpWrap}`);
    if (cookNotes.trim()) parts.push(cookNotes.trim());
    return parts.join(" · ");
  }, [qpMethod, qpStartTemp, qpInjection, qpSpritz, qpWrap, cookNotes]);

  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [cardWidth, setCardWidth] = useState(300);
  const [expandedRationale, setExpandedRationale] = useState<number | null>(null);
  const [showSecondaryDecisions, setShowSecondaryDecisions] = useState(false);

  // Reset decision UI state whenever a new analysis arrives so stale
  // expanded rationale / secondary decisions don't persist across check-ins.
  useEffect(() => {
    setExpandedRationale(null);
    setShowSecondaryDecisions(false);
  }, [result]);

  // Also collapse rationale when the screen loses focus so returning always
  // shows the clean default state.
  useFocusEffect(
    useCallback(() => {
      return () => {
        setExpandedRationale(null);
        setShowSecondaryDecisions(false);
      };
    }, [])
  );

  // Per-cook probe selections: meat (internal temp) + pit (ambient/grill temp).
  // Both persisted in AsyncStorage; legacy key probe_selection_${id} is migrated
  // to probe_meat_${id} on first load for backward compatibility.
  const [selectedMeatProbeId, setSelectedMeatProbeId] = useState<string | null>(null);
  const [selectedPitProbeId, setSelectedPitProbeId] = useState<string | null>(null);

  // Custom labels keyed by probeKey, persisted as JSON in AsyncStorage.
  const [probeLabels, setProbeLabelsState] = useState<Record<string, string>>({});

  // Map of probeKey → foodType for OTHER active cooks so the probe selector
  // can show "Used by Brisket" when a channel is claimed by a sibling cook.
  const [otherCookAssignments, setOtherCookAssignments] = useState<Record<string, string>>({});

  // "probe" = live BLE/cloud probe drives check-in auto-fill.
  // "manual" = user types temps during check-in.
  // Session map is checked first so an explicit user choice survives re-mounts.
  const [tempMode, setTempModeState] = useState<"probe" | "manual">(
    () => (id ? (sessionTempModes.get(String(id)) ?? "manual") : "manual"),
  );

  const setTempMode = useCallback(
    (mode: "probe" | "manual") => {
      if (mode === "probe" && !effectivePro) {
        showPaywall({ trigger: "pro_required", featureName: "Live Thermometer Connection" });
        return;
      }
      setTempModeState(mode);
      if (id) sessionTempModes.set(String(id), mode);
    },
    [id, effectivePro, showPaywall],
  );

  useEffect(() => {
    // Reset accumulated state whenever the cook id changes.
    setSelectedMeatProbeId(null);
    setSelectedPitProbeId(null);
    setProbeLabelsState({});
    setLiveReadings([]);
    setLivePitReadings([]);
  }, [id]);

  useEffect(() => {
    // Only rehydrate a saved probe selection for active cooks.
    // Completed / cancelled cooks should not show a stale pairing.
    const currentStatus = (cook as any)?.status;
    if (Platform.OS === "web" || !id || currentStatus !== "active") return;
    const sessionMode = sessionTempModes.get(String(id));

    (async () => {
      try {
        let meatProbeId: string | null;
        let pitProbeId: string | null;
        let resolvedLabels: Record<string, string>;

        // Server-first: prefer probeAssignments stored on the cook record so
        // two devices sharing the same cook always see the same labels.
        //
        // Authoritative signal: probeAssignments is a non-null object on the
        // server response (even with all-null/empty fields). A null value means
        // the cook has never had probe assignments synced to the server
        // (pre-migration or never-set) — in that case fall back to AsyncStorage.
        // This distinction lets an explicit "clear all" on device A propagate
        // correctly to device B without being overridden by stale local data.
        const serverAssignments = (cook as any)?.probeAssignments as {
          meatProbeId?: string | null;
          pitProbeId?: string | null;
          labels?: Record<string, string>;
        } | null | undefined;

        if (serverAssignments !== null && serverAssignments !== undefined) {
          // Server has authoritative state — use it verbatim (including clears).
          meatProbeId = serverAssignments.meatProbeId ?? null;
          pitProbeId = serverAssignments.pitProbeId ?? null;
          resolvedLabels = serverAssignments.labels ?? {};
          // Write back to AsyncStorage so offline fallback stays warm and stale
          // data from a previous session is overwritten.
          // (Platform.OS !== "web" is guaranteed by the outer guard above.)
          await Promise.all([
            saveMeatProbeId(id, meatProbeId, AsyncStorage),
            savePitProbeId(id, pitProbeId, AsyncStorage),
            saveProbeLabels(id, resolvedLabels, AsyncStorage),
          ]).catch(() => {});
        } else {
          // Server value is null → cook has never been synced (pre-migration or
          // offline stale response). Fall back to locally-cached state.
          const local = await loadProbeState(id, AsyncStorage);
          meatProbeId = local.meatProbeId;
          pitProbeId = local.pitProbeId;
          resolvedLabels = local.probeLabels;
        }

        setSelectedMeatProbeId(meatProbeId);
        setSelectedPitProbeId(pitProbeId);
        // Always apply resolved labels so an explicit "clear all" on another
        // device propagates correctly (empty object must overwrite stale state).
        setProbeLabelsState(resolvedLabels);
        // Only auto-switch to probe mode when the user has NOT explicitly chosen
        // a mode this session — respects a deliberate "Manual Entry" switch.
        // Also requires Pro: probe connections are a Pro feature, so silently
        // stay in manual mode if the user has downgraded since last launch.
        if (meatProbeId != null && sessionMode == null) {
          if (effectiveProRef.current) {
            setTempModeState("probe");
            sessionTempModes.set(String(id), "probe");
          }
        } else if (sessionMode != null) {
          setTempModeState(sessionMode);
        }
      } catch {
        setSelectedMeatProbeId(null);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, (cook as any)?.status, (cook as any)?.probeAssignments]);

  // Count of globally-active cooks — used to gate auto-probe-assignment so
  // we never silently assign a probe when multiple cooks are running in parallel
  // (the user must pick explicitly in that multi-cook situation).
  const { data: allCooksForCount } = useListCooks(undefined, {
    query: {
      queryKey: [...getListCooksQueryKey(), "active_count"],
      enabled: (cook as any)?.status === "active",
      staleTime: 30_000,
    },
  });

  // Build a map of probeKey → foodType for other active cooks so the probe
  // selector can mark channels that are already claimed elsewhere.
  useEffect(() => {
    if (Platform.OS === "web" || !id || !allCooksForCount) return;
    const others = (allCooksForCount as any[]).filter(
      (c: any) => c?.status === "active" && String(c.id) !== String(id),
    );
    if (others.length === 0) { setOtherCookAssignments({}); return; }
    Promise.all(
      others.map(async (c: any) => ({
        meatKey: await AsyncStorage.getItem(`probe_meat_${c.id}`).catch(() => null),
        pitKey: await AsyncStorage.getItem(`probe_pit_${c.id}`).catch(() => null),
        foodType: (c.foodType ?? "Another cook") as string,
      }))
    ).then((results) => {
      const map: Record<string, string> = {};
      for (const { meatKey, pitKey, foodType } of results) {
        if (meatKey) map[meatKey] = foodType;
        if (pitKey) map[pitKey] = foodType;
      }
      setOtherCookAssignments(map);
    }).catch(() => {});
  }, [id, allCooksForCount]);

  // Reset accumulated probe readings whenever the meat probe selection changes so
  // stale data from a previous probe never leaks into the graph or AI payload.
  // Also reset the seeded flag so historical data is re-fetched for the new probe.
  useEffect(() => {
    setLiveReadings([]);
    setLivePitReadings([]);
    liveReadingsSeededRef.current = false;
  }, [selectedMeatProbeId]);

  const handleSelectMeatProbe = useCallback((probeId: string | null) => {
    setSelectedMeatProbeId(probeId);
    if (probeId != null) setTempMode("probe");
    if (Platform.OS !== "web" && id) {
      saveMeatProbeId(id, probeId, AsyncStorage);
      // Clear the cross-session last-inkbird record when the user explicitly
      // removes a BLE probe assignment.
      if (probeId === null && selectedMeatProbeId?.startsWith("ble_")) {
        clearLastInkbird(AsyncStorage);
      }
      // Sync to server (fire-and-forget) so a pit partner on another device
      // picks up the updated assignment without re-entering it.
      updateCook.mutate({
        id: Number(id),
        data: {
          probeAssignments: {
            meatProbeId: probeId,
            pitProbeId: selectedPitProbeId,
            labels: probeLabels,
          },
        },
      });
    }
  }, [id, setTempMode, selectedPitProbeId, probeLabels, updateCook]);

  const handleSelectPitProbe = useCallback((probeId: string | null) => {
    setSelectedPitProbeId(probeId);
    if (Platform.OS !== "web" && id) {
      savePitProbeId(id, probeId, AsyncStorage);
      // Clear the cross-session last-inkbird record when the user explicitly
      // removes a BLE probe assignment.
      if (probeId === null && selectedPitProbeId?.startsWith("ble_")) {
        clearLastInkbird(AsyncStorage);
      }
      // Sync to server (fire-and-forget).
      updateCook.mutate({
        id: Number(id),
        data: {
          probeAssignments: {
            meatProbeId: selectedMeatProbeId,
            pitProbeId: probeId,
            labels: probeLabels,
          },
        },
      });
    }
  }, [id, selectedMeatProbeId, probeLabels, updateCook]);

  const handleSetProbeLabel = useCallback((probeKey: string, label: string) => {
    setProbeLabelsState((prev) => {
      const next = buildUpdatedProbeLabels(prev, probeKey, label);
      if (Platform.OS !== "web" && id) {
        saveProbeLabels(id, next, AsyncStorage);
        // Sync to server (fire-and-forget).
        updateCook.mutate({
          id: Number(id),
          data: {
            probeAssignments: {
              meatProbeId: selectedMeatProbeId,
              pitProbeId: selectedPitProbeId,
              labels: next,
            },
          },
        });
      }
      return next;
    });
  }, [id, selectedMeatProbeId, selectedPitProbeId, updateCook]);

  // Ratings state
  const [rateTenderness, setRateTenderness] = useState<number>(0);
  const [rateFlavor, setRateFlavor] = useState<number>(0);
  const [rateBark, setRateBark] = useState<number>(0);
  const [rateSaving, setRateSaving] = useState(false);
  // Rating prompt shown once immediately after a cook is marked complete
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const uploadTemperatureData = useUploadTemperatureData();

  const cookStatus = (cook as any)?.status;

  const activeCookCount = (allCooksForCount ?? []).filter(
    (c: any) => c?.status === "active",
  ).length;

  // Build the set of known BLE probe keys (ble_ / bleCtx_) from this cook's
  // own server-side probeAssignments plus the most recent previous cook on the
  // same grill. Used by LiveCookSection to show a "Previously used" section
  // at the top of the probe scan list so the user can reconnect in one tap.
  const knownProbeIds = useMemo(() => {
    // Value: custom label string if one was saved, null if the probe is known
    // but had no custom label.  Callers check `key in knownProbeIds` to detect
    // "known", and read the value (when non-null) as the saved display label.
    const result: Record<string, string | null> = {};
    const cookData = cook as any;
    const grillId = cookData?.grillId;

    function addKnown(
      probeKey: string | null | undefined,
      labels: Record<string, string>,
      skipIfPresent = false,
    ) {
      if (!probeKey) return;
      // Only track BLE probes that require active scan discovery.
      if (!probeKey.startsWith("ble_") && !probeKey.startsWith("bleCtx_")) return;
      // Current cook data is authoritative — never let a previous cook override it.
      if (skipIfPresent && probeKey in result) return;
      result[probeKey] = labels[probeKey] ?? null;
    }

    // 1. Current cook's server-side probe assignments (authoritative).
    const pa = cookData?.probeAssignments as {
      meatProbeId?: string | null;
      pitProbeId?: string | null;
      labels?: Record<string, string>;
    } | null | undefined;
    if (pa) {
      const labels = pa.labels ?? {};
      addKnown(pa.meatProbeId, labels);
      addKnown(pa.pitProbeId, labels);
    }

    // 2. Most recent previous cook on the same grill that stored probe assignments.
    // Uses skipIfPresent=true so the current cook's data always wins.
    if (grillId && allCooksForCount) {
      const prevCooks = (allCooksForCount as any[])
        .filter((c: any) =>
          String(c.id) !== String(id) &&
          c.grillId === grillId &&
          c.probeAssignments,
        )
        .sort((a: any, b: any) => {
          const ta = new Date((a.updatedAt ?? a.createdAt) || 0).getTime();
          const tb = new Date((b.updatedAt ?? b.createdAt) || 0).getTime();
          return tb - ta;
        });

      const prev = prevCooks[0];
      if (prev?.probeAssignments) {
        const prevPa = prev.probeAssignments as {
          meatProbeId?: string | null;
          pitProbeId?: string | null;
          labels?: Record<string, string>;
        };
        const prevLabels = prevPa.labels ?? {};
        addKnown(prevPa.meatProbeId, prevLabels, true);
        addKnown(prevPa.pitProbeId, prevLabels, true);
      }
    }

    return result;
  }, [cook, id, allCooksForCount]);

  // Ambient outdoor weather — Pro-only; free users get null values so no
  // location request is ever triggered for non-subscribers.
  const weather = useAmbientWeather(undefined, { enabled: effectivePro });

  // Check-in modal state
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [chatModalVisible, setChatModalVisible] = useState(false);
  const [activeCheckin, setActiveCheckin] = useState<ScheduledCheckin | null>(null);
  const createCheckin = useCreateCookCheckin();
  // Manual check-in saved toast: shown for ~2 s after the user submits a check-in.
  const [checkinSavedToast, setCheckinSavedToast] = useState<string | null>(null);
  const checkinSavedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Auto-check-in toast: shown briefly after a probe-triggered auto-log fires.
  const [autoCheckinToast, setAutoCheckinToast] = useState<string | null>(null);
  const autoCheckinToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Inkbird reconnect toast: shown briefly when a dropped probe reappears.
  const [inkbirdReconnectToast, setInkbirdReconnectToast] = useState(false);
  const inkbirdReconnectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevInkbirdReconnectingRef = useRef(false);
  const [inkbirdToastMounted, setInkbirdToastMounted] = useState(false);
  const inkbirdToastAnim = useRef(new Animated.Value(0)).current;
  // BLE context reconnect toast (MEATER / Govee): same pattern, driven by reconnectBanner.
  const [bleReconnectToast, setBleReconnectToast] = useState<string | null>(null);
  const bleReconnectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReconnectBannerRef = useRef<string | null>(null);
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

  // Technique picker sheet state (inline edit on cook detail)
  const [techMethodSheetOpen, setTechMethodSheetOpen] = useState(false);
  const [techInjectionSheetOpen, setTechInjectionSheetOpen] = useState(false);
  const [techSpritzSheetOpen, setTechSpritzSheetOpen] = useState(false);
  const [techWrapFinishSheetOpen, setTechWrapFinishSheetOpen] = useState(false);
  const [seqScheduleExpanded, setSeqScheduleExpanded] = useState(false);
  // Auto-expand the sequence schedule for planned and active cooks so pitmasters
  // see the full timeline immediately without an extra tap.
  useEffect(() => {
    const seqData = (cook as any)?.sequenceData;
    if ((cookStatus === "planned" || cookStatus === "active") && seqData?.schedule?.length > 0) {
      setSeqScheduleExpanded(true);
    }
  }, [cookStatus, (cook as any)?.id]);
  const [techsExpanded, setTechsExpanded] = useState(false);
  const [addToSessionOpen, setAddToSessionOpen] = useState(false);
  const [removedPlannedKeys, setRemovedPlannedKeys] = useState<Set<string>>(new Set());
  const [markingThaw, setMarkingThaw] = useState(false);
  // Planned checkins generated by the no-AI-plan fallback path in handleStatusUpdate.
  // When no cookSeqData exists, this supplements storedScheduledCheckins so the
  // Check-ins card shows the upcoming reminders that were just scheduled.
  const [noPlanScheduledCheckins, setNoPlanScheduledCheckins] = useState<ScheduledCheckin[]>([]);
  const [plannedCheckinPreviewSc, setPlannedCheckinPreviewSc] = useState<ScheduledCheckin | null>(null);

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
  const proactiveAlerts = useProactiveAlerts();
  // Reset proactive alert state whenever the viewed cook changes so stale
  // alerts from a previous cook are not surfaced in the new one.
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

  // ── Tiered probe polling interval — locked once, never changes mid-cook ──
  // Computed from the cook's saved data when it first loads, then frozen.
  // A ref is used so mid-cook probe reassignments in React state don't alter
  // the interval (the tier should be stable for the life of the screen).
  const probeIntervalRef = useRef<number>(getProbePollingIntervalMs(null, false));
  const probeIntervalSet = useRef(false);
  if (!probeIntervalSet.current && cook != null) {
    probeIntervalSet.current = true;
    const durMins =
      cook.plannedStartAt && cook.plannedEndAt
        ? Math.round(
            (new Date(cook.plannedEndAt).getTime() -
              new Date(cook.plannedStartAt).getTime()) /
              60000,
          )
        : null;
    // Read probe assignments from the saved cook record (not React state) so
    // the tier is correct immediately on first render after data loads.
    const pa = (cook as any)?.probeAssignments as
      | { meatProbeId?: string | null; pitProbeId?: string | null }
      | null;
    probeIntervalRef.current = getProbePollingIntervalMs(
      durMins,
      pa?.meatProbeId != null || pa?.pitProbeId != null,
    );
  }
  const probeIntervalMs = probeIntervalRef.current;

  const { data: meaterData, isLoading: meaterLoading, dataUpdatedAt: meaterDataUpdatedAt } = useGetMeaterReadings({
    query: {
      queryKey: getGetMeaterReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? probeIntervalMs : false,
    },
  });
  // null = still loading (don't show placeholder yet), true/false = resolved
  const meaterLinked = meaterLoading ? null : (meaterData?.linked ?? false);
  const meaterProbes = meaterData?.probes ?? [];

  const { data: thermoworksData, isLoading: thermoworksLoading, dataUpdatedAt: thermoworksDataUpdatedAt } = useGetThermoworksReadings({
    query: {
      queryKey: getGetThermoworksReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? probeIntervalMs : false,
    },
  });
  const thermoworksLinked = thermoworksLoading ? null : (thermoworksData?.linked ?? false);
  const thermoworksProbes = thermoworksData?.probes ?? [];

  // Probe assignments for this cook — meat (internal) and pit (ambient) roles.
  // Null until the user assigns a probe row in LiveCookSection.
  const selectedMeaterProbe =
    selectedMeatProbeId != null
      ? (meaterProbes.find((p) => p.deviceId === selectedMeatProbeId) ?? null)
      : null;
  const selectedMeaterPitProbe =
    selectedPitProbeId != null
      ? (meaterProbes.find((p) => p.deviceId === selectedPitProbeId) ?? null)
      : null;
  const selectedThermoworksMeatProbe =
    selectedMeatProbeId != null
      ? (thermoworksProbes.find(
          (p: any) => `tw_${p.deviceId}_${p.channelNumber}` === selectedMeatProbeId,
        ) ?? null)
      : null;
  const selectedThermoworksPitProbe =
    selectedPitProbeId != null
      ? (thermoworksProbes.find(
          (p: any) => `tw_${p.deviceId}_${p.channelNumber}` === selectedPitProbeId,
        ) ?? null)
      : null;
  // Alias used by existing code below that references selectedThermoworksProbe.
  const selectedThermoworksProbe = selectedThermoworksMeatProbe;

  // Inkbird BLE scanning — only when the cook is active and probe mode is on.
  // scanning + reconnecting are exposed so LiveCookSection can show the
  // appropriate "Searching…" / "Reconnecting…" indicator.
  const bleAssignedProbeKeys = [selectedMeatProbeId, selectedPitProbeId].filter(
    (k): k is string => k != null && k.startsWith("ble_"),
  );
  const {
    probes: inkbirdProbes,
    scanning: inkbirdScanning,
    reconnecting: inkbirdReconnecting,
    lastKnownDeviceId: lastKnownInkbirdDeviceId,
  } = useInkbirdBLE({
    enabled: cookStatus === "active" && tempMode === "probe",
    assignedProbeKeys: bleAssignedProbeKeys,
  });

  // Fire a "Inkbird reconnected ✓" toast when the probe reappears after a drop.
  useEffect(() => {
    const wasReconnecting = prevInkbirdReconnectingRef.current;
    prevInkbirdReconnectingRef.current = inkbirdReconnecting;
    if (wasReconnecting && !inkbirdReconnecting) {
      setInkbirdReconnectToast(true);
      if (inkbirdReconnectToastTimerRef.current) clearTimeout(inkbirdReconnectToastTimerRef.current);
      inkbirdReconnectToastTimerRef.current = setTimeout(() => setInkbirdReconnectToast(false), 3000);
    }
  }, [inkbirdReconnecting]);

  // Animate the Inkbird reconnect toast in (slide-up + fade-in) and out (fade-out).
  useEffect(() => {
    if (inkbirdReconnectToast) {
      setInkbirdToastMounted(true);
      inkbirdToastAnim.setValue(0);
      Animated.timing(inkbirdToastAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(inkbirdToastAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setInkbirdToastMounted(false);
      });
    }
  }, [inkbirdReconnectToast, inkbirdToastAnim]);

  const selectedInkbirdProbe =
    selectedMeatProbeId?.startsWith("ble_")
      ? (inkbirdProbes.find(
          (p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedMeatProbeId,
        ) ?? null)
      : null;

  const selectedInkbirdPitProbe =
    selectedPitProbeId?.startsWith("ble_")
      ? (inkbirdProbes.find(
          (p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedPitProbeId,
        ) ?? null)
      : null;

  // BLE context: connected BLE devices (MEATER via GATT, Govee, Weber iGrill)
  const {
    devices: allBleDevices,
    reconnectBanner,
    dismissReconnectBanner,
    setHasActiveCook,
    reconnecting: bleCtxReconnecting,
    startScan: bleScan,
    stopScan: bleStop,
  } = useBleProbes();

  // Combined reconnecting: true when Inkbird OR any BLE-context device (MEATER,
  // Govee) is in a recovery cycle. LiveCookSection displays the same
  // "probe signal lost — reconnecting…" banner for all probe types.
  const combinedReconnecting = inkbirdReconnecting || bleCtxReconnecting;

  // Restart BLE scan: stop the current window then immediately begin a new one.
  // Called by the BLE wizard "Try scanning again" button; the sheet stays open.
  const handleRestartScan = useCallback(() => {
    bleStop();
    bleScan();
  }, [bleStop, bleScan]);

  // Tell BleProbeContext whether a live cook is active so it knows whether
  // to fire a haptic when a connected probe drops.
  useEffect(() => {
    setHasActiveCook(cookStatus === "active");
    return () => setHasActiveCook(false);
  }, [cookStatus, setHasActiveCook]);

  // Fire a "<DeviceName> reconnected ✓" toast when a MEATER or Govee probe
  // reappears after a drop (driven by BleProbeContext's reconnectBanner).
  useEffect(() => {
    const prevName = prevReconnectBannerRef.current;
    const currName = reconnectBanner?.deviceName ?? null;
    prevReconnectBannerRef.current = currName;
    if (currName != null && prevName == null) {
      setBleReconnectToast(currName);
      dismissReconnectBanner();
      if (bleReconnectToastTimerRef.current) clearTimeout(bleReconnectToastTimerRef.current);
      bleReconnectToastTimerRef.current = setTimeout(() => setBleReconnectToast(null), 3000);
    }
  }, [reconnectBanner, dismissReconnectBanner]);

  const bleContextDevices = allBleDevices.filter(
    (d) => d.connectionState === "connected" && d.paired,
  );

  // LAN probes: Fireboard, MEATER Block, ThermoWorks Signals on local network
  const { probes: lanProbes } = useLanProbes({
    enabled: cookStatus === "active" && tempMode === "probe",
    pollIntervalMs: 15_000,
  });

  const selectedLanProbe: LanProbeReading | null =
    selectedMeatProbeId?.startsWith("lan_")
      ? (lanProbes.find((p) => `lan_${p.deviceId}` === selectedMeatProbeId) ?? null)
      : null;
  const selectedLanPitProbe: LanProbeReading | null =
    selectedPitProbeId?.startsWith("lan_")
      ? (lanProbes.find((p) => `lan_${p.deviceId}` === selectedPitProbeId) ?? null)
      : null;

  const selectedBleContextDevice =
    selectedMeatProbeId?.startsWith("bleCtx_")
      ? (bleContextDevices.find((d) => `bleCtx_${d.id}` === selectedMeatProbeId) ?? null)
      : null;
  const selectedBleContextPitDevice =
    selectedPitProbeId?.startsWith("bleCtx_")
      ? (bleContextDevices.find((d) => `bleCtx_${d.id}` === selectedPitProbeId) ?? null)
      : null;

  // Auto-assign: when exactly one probe is available AND this is the only
  // active cook (so we're sure the probe belongs to this cook), auto-select it.
  const [autoAssignBanner, setAutoAssignBanner] = useState<string | null>(null);
  const autoAssignFiredRef = useRef(false);
  useEffect(() => {
    // Don't auto-assign in multi-cook scenarios — user must pick explicitly.
    if (activeCookCount > 1) return;
    if (tempMode !== "probe" || selectedMeatProbeId != null || autoAssignFiredRef.current) return;
    const allAvailable: string[] = [
      ...inkbirdProbes.map((p) => `ble_${p.deviceId}_${p.probeIndex}`),
      ...bleContextDevices.map((d) => `bleCtx_${d.id}`),
      ...lanProbes.map((p) => `lan_${p.deviceId}`),
    ];
    if (allAvailable.length === 1) {
      autoAssignFiredRef.current = true;
      const probeKey = allAvailable[0]!;
      handleSelectMeatProbe(probeKey);
      const label = bleContextDevices.find((d) => `bleCtx_${d.id}` === probeKey)?.name
        ?? inkbirdProbes.find((p) => `ble_${p.deviceId}_${p.probeIndex}` === probeKey)?.deviceName
        ?? lanProbes.find((p) => `lan_${p.deviceId}` === probeKey)?.deviceName
        ?? "Probe";
      setAutoAssignBanner(`Auto-connected to ${label}`);
      const t = setTimeout(() => setAutoAssignBanner(null), 5_000);
      return () => clearTimeout(t);
    }
  }, [
    activeCookCount, tempMode, selectedMeatProbeId,
    inkbirdProbes, bleContextDevices, lanProbes, handleSelectMeatProbe,
  ]);

  const [nowMs, setNowMs] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveReadings, setLiveReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);
  const [livePitReadings, setLivePitReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);

  // Fetch historical temperature readings so the live graph is pre-populated
  // when the user reopens the app mid-cook, and to surface a post-cook
  // temperature profile for completed cooks that may not have AI analysis.
  const { data: historicalReadings } = useListTemperatureReadings(
    { cookId: Number(id) },
    {
      query: {
        queryKey: getListTemperatureReadingsQueryKey({ cookId: Number(id) }),
        enabled: (cookStatus === "active" || cookStatus === "completed") && !!cook?.actualStartAt,
      },
    },
  );
  // Track whether we've already seeded liveReadings for this cook so we don't
  // overwrite live probe readings that arrive after the initial seed.
  const liveReadingsSeededRef = useRef(false);

  // iOS Live Activity (lock screen + Dynamic Island). No-op on Android,
  // Expo Go, and unsupported devices.
  useCookLiveActivity({
    cookId: cook?.id ?? null,
    status: cook?.status ?? null,
    meatLabel: cook?.foodType ?? "Cook",
    startedAtIso: cook?.actualStartAt ?? null,
    currentTempF: selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? selectedInkbirdProbe?.tempF ?? null,
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
    setLivePitReadings([]);
    liveReadingsSeededRef.current = false;
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

  // Seed liveReadings from historical temperature_readings on mount so the
  // graph is not blank when the user reopens the app mid-cook.  New probe
  // readings are appended on top by the probe-polling effects below, giving a
  // continuous chart without gaps.
  //
  // `selectedProbeId` is included in deps because it changes asynchronously
  // during app reopen (null → savedProbeId via AsyncStorage rehydration). That
  // transition clears liveReadings and resets the seeded ref, but
  // `historicalReadings` is already cached at that point so won't change —
  // without `selectedProbeId` here the effect would never re-run and the graph
  // would stay blank.  Including it causes a re-run exactly when needed while
  // the seeded ref gate prevents subsequent live probe ticks from re-seeding.
  useEffect(() => {
    if (liveReadingsSeededRef.current) return;
    if (!historicalReadings || historicalReadings.length === 0) return;
    if (!cook?.actualStartAt) return;

    const startMs = new Date(cook.actualStartAt).getTime();

    const toEntry = (r: TemperatureReading) => ({
      timeMinutes:
        Math.round(
          Math.max(0, (new Date(r.recordedAt).getTime() - startMs) / 60000) * 10,
        ) / 10,
      tempF: r.tempF,
    });

    // probeNumber 0 = internal meat probe, probeNumber 1 = ambient / pit
    const internalEntries = historicalReadings
      .filter((r: TemperatureReading) => r.probeNumber === 0)
      .map(toEntry)
      .sort((a, b) => a.timeMinutes - b.timeMinutes);

    const pitEntries = historicalReadings
      .filter((r: TemperatureReading) => r.probeNumber === 1)
      .map(toEntry)
      .sort((a, b) => a.timeMinutes - b.timeMinutes);

    if (internalEntries.length > 0 || pitEntries.length > 0) {
      if (internalEntries.length > 0) setLiveReadings(internalEntries);
      if (pitEntries.length > 0) setLivePitReadings(pitEntries);
      liveReadingsSeededRef.current = true;
    }
  }, [historicalReadings, cook?.actualStartAt, selectedMeatProbeId]);

  // Seed liveReadings from historical check-in temperatures for manual-mode cooks.
  // Only fires when the probe seeding above found nothing (liveReadingsSeededRef still false),
  // which is the normal case for a cook that has never had a hardware probe attached.
  // Uses cook_checkins.internalTempF sorted by createdAt so the graph history
  // is restored when the user reopens the app mid-cook in manual mode.
  useEffect(() => {
    if (liveReadingsSeededRef.current) return;
    if (tempMode !== "manual") return;
    if (!cook?.actualStartAt) return;
    if (!Array.isArray(cookCheckins) || cookCheckins.length === 0) return;

    const startMs = new Date(cook.actualStartAt).getTime();
    const entries = (cookCheckins as any[])
      .filter((ci: any) => ci.internalTempF != null)
      .map((ci: any) => ({
        timeMinutes:
          Math.round(Math.max(0, (new Date(ci.createdAt).getTime() - startMs) / 60000) * 10) / 10,
        tempF: ci.internalTempF as number,
      }))
      .sort((a, b) => a.timeMinutes - b.timeMinutes);

    if (entries.length > 0) {
      setLiveReadings(entries);
      liveReadingsSeededRef.current = true;
    }
  }, [cookCheckins, cook?.actualStartAt, tempMode]);

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

  // Opens the check-in sheet with the most contextually relevant phase:
  // pending notification → next upcoming scheduled → manual phase-0 fallback.
  // Mirrors the same targeting logic as the persistent check-in CTA banner.
  const handlePitMasterCheckIn = useCallback(() => {
    const hasPlan = (cookSeqData?.schedule?.length ?? 0) > 0;
    const upcoming = (
      hasPlan && storedScheduledCheckins.length > 0
        ? storedScheduledCheckins
        : noPlanScheduledCheckins
    ).filter((sc) => sc.scheduledAt > nowMs);

    const targetSc: ScheduledCheckin | null =
      pendingCheckinSc ?? upcoming[0] ?? null;

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
  }, [cook, cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, nowMs, pendingCheckinSc, openCheckin]);

  // Next upcoming scheduled check-in — shown in the PitMaster hub card as a
  // forward-looking hint: "Next: Stall · in 45 min".
  const { nextCheckinMs, nextCheckinLabel, nextCheckinSc, upcomingCheckinsForCard } = useMemo(() => {
    const hasPlan = (cookSeqData?.schedule?.length ?? 0) > 0;
    const now = nowMs ?? Date.now();
    const upcoming = (
      hasPlan && storedScheduledCheckins.length > 0
        ? storedScheduledCheckins
        : noPlanScheduledCheckins
    ).filter((sc) => sc.scheduledAt > now);
    const next = upcoming[0] ?? null;
    return {
      nextCheckinMs: next?.scheduledAt ?? null,
      nextCheckinLabel: next?.phaseLabel ?? null,
      nextCheckinSc: next,
      upcomingCheckinsForCard: upcoming.slice(1, 5),
    };
  }, [cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, nowMs]);

  // For planned cooks with a sequence, compute upcoming check-ins client-side
  // so SequenceSchedule can show them in the timeline before the cook starts.
  const plannedSequenceCheckins = useMemo<ScheduledCheckin[]>(() => {
    if (cookStatus !== "planned") return [];
    const first = cookSeqData?.schedule?.[0];
    if (!first?.meatOnAt || !first?.estimatedFinishAt) return [];
    const meatOnAtMs = new Date(first.meatOnAt).getTime();
    const estimatedFinishAtMs = new Date(first.estimatedFinishAt).getTime();
    if (estimatedFinishAtMs <= meatOnAtMs) return [];
    const anchor: CheckinSequenceAnchor = {
      meatOnAt: first.meatOnAt,
      estimatedFinishAt: first.estimatedFinishAt,
      wrapAtMinutes: first.wrapAtMinutes ?? null,
    };
    return generateCheckinSchedule(
      first.foodType ?? null,
      meatOnAtMs,
      estimatedFinishAtMs,
      anchor,
      typeof first.weightLbs === "number" ? first.weightLbs : null,
    );
  }, [cookStatus, cookSeqData]);

  const handleCheckInNext = useCallback(() => {
    if (nextCheckinSc) {
      openCheckin(nextCheckinSc);
    } else {
      handlePitMasterCheckIn();
    }
  }, [nextCheckinSc, openCheckin, handlePitMasterCheckIn]);

  // Build a probe reading object for the auto-checkin hook. We use the
  // react-query dataUpdatedAt timestamp so the hook knows how fresh the
  // reading is (must be < 60 s old to qualify as "live").
  const autoCheckinProbeReading = useMemo((): AutoCheckinProbeReading | null => {
    if (tempMode !== "probe") return null;
    if (selectedMeaterProbe?.internalTempF != null) {
      // Pit temp: use designated pit MEATER probe's internalTempF if a separate
      // one was assigned; otherwise fall back to the meat probe's bundled ambient.
      const pitTempF =
        selectedMeaterPitProbe != null && selectedMeaterPitProbe.deviceId !== selectedMeaterProbe.deviceId
          ? (selectedMeaterPitProbe.internalTempF ?? null)
          : (selectedMeaterProbe.ambientTempF ?? null);
      return {
        internalTempF: selectedMeaterProbe.internalTempF,
        pitTempF,
        probeSource: "meater",
        fetchedAtMs: meaterDataUpdatedAt,
      };
    }
    if (selectedThermoworksProbe != null && (selectedThermoworksProbe as any).tempF != null) {
      return {
        internalTempF: (selectedThermoworksProbe as any).tempF,
        pitTempF: selectedThermoworksPitProbe != null
          ? ((selectedThermoworksPitProbe as any).tempF ?? null)
          : null,
        probeSource: "thermoworks",
        fetchedAtMs: thermoworksDataUpdatedAt,
      };
    }
    if (selectedInkbirdProbe?.tempF != null) {
      return {
        internalTempF: selectedInkbirdProbe.tempF,
        pitTempF: selectedInkbirdPitProbe?.tempF ?? null,
        probeSource: "inkbird",
        fetchedAtMs: selectedInkbirdProbe.lastSeenMs,
      };
    }
    if (selectedBleContextDevice?.probeTempF != null) {
      // Pit temp: use designated pit BLE-context device's probeTempF if a separate
      // one was assigned; otherwise fall back to the meat device's bundled ambient.
      const pitTempF =
        selectedBleContextPitDevice != null && selectedBleContextPitDevice.id !== selectedBleContextDevice.id
          ? (selectedBleContextPitDevice.probeTempF ?? null)
          : (selectedBleContextDevice.ambientTempF ?? null);
      return {
        internalTempF: selectedBleContextDevice.probeTempF,
        pitTempF,
        probeSource: "ble",
        fetchedAtMs: selectedBleContextDevice.lastSeenMs,
      };
    }
    if (selectedLanProbe?.probeTempF != null) {
      // Pit temp: use designated pit LAN probe's probeTempF if a separate
      // one was assigned; otherwise fall back to the meat probe's bundled ambient.
      const pitTempF =
        selectedLanPitProbe != null && selectedLanPitProbe.deviceId !== selectedLanProbe.deviceId
          ? (selectedLanPitProbe.probeTempF ?? null)
          : (selectedLanProbe.ambientTempF ?? null);
      return {
        internalTempF: selectedLanProbe.probeTempF,
        pitTempF,
        probeSource: "lan",
        fetchedAtMs: selectedLanProbe.lastSeenMs,
      };
    }
    return null;
  }, [
    tempMode,
    selectedMeaterProbe, selectedMeaterPitProbe,
    selectedThermoworksProbe, selectedThermoworksPitProbe,
    selectedInkbirdProbe, selectedInkbirdPitProbe,
    selectedBleContextDevice, selectedBleContextPitDevice,
    selectedLanProbe, selectedLanPitProbe,
    meaterDataUpdatedAt, thermoworksDataUpdatedAt,
  ]);

  // Persist all live probe readings to the backend temperature_readings table
  // so the graph survives app restarts. Covers MEATER, ThermoWorks, Inkbird,
  // BLE (GATT context) and LAN probes — every source that appends to liveReadings.
  const lastUploadedProbeTs = useRef<number>(0);
  useEffect(() => {
    if (!autoCheckinProbeReading) return;
    const { internalTempF, probeSource, fetchedAtMs } = autoCheckinProbeReading;
    if (internalTempF == null) return;
    // Debounce: only upload once per polling cycle — if the reading timestamp
    // hasn't advanced since our last upload, skip.
    if (fetchedAtMs <= lastUploadedProbeTs.current) return;
    const cookId = Number(id);
    if (!cookId || cookStatus !== "active") return;
    lastUploadedProbeTs.current = fetchedAtMs;

    const meatKey = selectedMeatProbeId ?? undefined;
    const pitKey = selectedPitProbeId ?? undefined;

    const probeName =
      (meatKey && probeLabels[meatKey]) ? probeLabels[meatKey] :
      probeSource === "meater" ? (selectedMeaterProbe?.deviceName ?? "MEATER Probe") :
      probeSource === "thermoworks" ? ((selectedThermoworksProbe as any)?.deviceName ?? "ThermoWorks Probe") :
      probeSource === "inkbird" ? (selectedInkbirdProbe?.deviceName ?? "Inkbird Probe") :
      probeSource === "ble" ? (selectedBleContextDevice?.name ?? "BLE Probe") :
      probeSource === "lan" ? (selectedLanProbe?.deviceName ?? "LAN Probe") :
      null;

    const pitProbeName =
      (pitKey && probeLabels[pitKey]) ? probeLabels[pitKey] :
      probeSource === "thermoworks" ? ((selectedThermoworksPitProbe as any)?.deviceName ?? "ThermoWorks Pit") :
      probeSource === "inkbird" ? (selectedInkbirdPitProbe?.deviceName ?? "Inkbird Pit") :
      "Ambient / Pit";

    uploadTemperatureData.mutate({
      data: {
        cookId,
        source: probeSource,
        readings: [
          {
            probeNumber: 0,
            probeName,
            tempF: internalTempF,
            recordedAt: new Date(fetchedAtMs).toISOString(),
          },
          ...(autoCheckinProbeReading.pitTempF != null
            ? [{
                probeNumber: 1,
                probeName: pitProbeName,
                tempF: autoCheckinProbeReading.pitTempF,
                recordedAt: new Date(fetchedAtMs).toISOString(),
              }]
            : []),
        ],
      },
    });
  }, [autoCheckinProbeReading, id, cookStatus, probeLabels, selectedMeatProbeId, selectedPitProbeId]);

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
      qc.invalidateQueries({ queryKey: getGetCookHealthQueryKey(Number(id)) });
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
  // Exception: when autoOpen is true (e.g. tapping the hint row on the Home
  // card) the check-in sheet opens immediately without the intermediate banner.
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

      if (pending.autoOpen) {
        openCheckin(sc);
      } else {
        setPendingCheckinSc(sc);
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, cook?.foodType, openCheckin]),
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
      const elapsedRounded = Math.round(elapsedMins * 10) / 10;
      setLiveReadings((prev) => [
        ...prev,
        { timeMinutes: elapsedRounded, tempF: currentTemp },
      ]);
      // Pit: use ambient when no dedicated pit MEATER is assigned; dedicated pit handled below.
      if (selectedMeaterProbe.ambientTempF != null && selectedMeaterPitProbe == null) {
        setLivePitReadings((prev) => [
          ...prev,
          { timeMinutes: elapsedRounded, tempF: selectedMeaterProbe.ambientTempF! },
        ]);
      }

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

    }
  }, [selectedMeaterProbe]);

  // Accumulate live pit readings for a dedicated MEATER pit probe (separate device assigned as pit).
  useEffect(() => {
    if (selectedMeaterPitProbe == null || selectedMeaterPitProbe.internalTempF == null) return;
    if (selectedMeaterPitProbe.deviceId === selectedMeaterProbe?.deviceId) return; // same device — ambient handled above
    const currentTemp = selectedMeaterPitProbe.internalTempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLivePitReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedMeaterPitProbe]);

  // Accumulate live readings for BLE context probes (MEATER via GATT, Govee, Weber iGrill).
  // Fires every GATT poll cycle (~15 s) so the live graph has real-time BLE data.
  useEffect(() => {
    if (selectedBleContextDevice == null || selectedBleContextDevice.probeTempF == null) return;
    const currentTemp = selectedBleContextDevice.probeTempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    const elapsedRounded = Math.round(elapsedMins * 10) / 10;
    setLiveReadings((prev) => [
      ...prev,
      { timeMinutes: elapsedRounded, tempF: currentTemp },
    ]);
    // Pit: use ambient when no dedicated pit device is assigned; dedicated pit handled below.
    if (selectedBleContextDevice.ambientTempF != null && selectedBleContextPitDevice == null) {
      setLivePitReadings((prev) => [
        ...prev,
        { timeMinutes: elapsedRounded, tempF: selectedBleContextDevice.ambientTempF! },
      ]);
    }
  }, [selectedBleContextDevice]);

  // Accumulate live pit readings for a dedicated BLE-context pit device.
  useEffect(() => {
    if (selectedBleContextPitDevice == null || selectedBleContextPitDevice.probeTempF == null) return;
    const currentTemp = selectedBleContextPitDevice.probeTempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLivePitReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedBleContextPitDevice]);

  // Accumulate live readings for LAN probes (Fireboard, MEATER Block, ThermoWorks Signals).
  // Fires every LAN poll cycle (~15 s) so the live graph has real-time WiFi data.
  useEffect(() => {
    if (selectedLanProbe == null || selectedLanProbe.probeTempF == null) return;
    const currentTemp = selectedLanProbe.probeTempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    const elapsedRounded = Math.round(elapsedMins * 10) / 10;
    setLiveReadings((prev) => [
      ...prev,
      { timeMinutes: elapsedRounded, tempF: currentTemp },
    ]);
    // Pit: use ambient when no dedicated pit probe is assigned; dedicated pit handled below.
    if (selectedLanProbe.ambientTempF != null && selectedLanPitProbe == null) {
      setLivePitReadings((prev) => [
        ...prev,
        { timeMinutes: elapsedRounded, tempF: selectedLanProbe.ambientTempF! },
      ]);
    }
  }, [selectedLanProbe]);

  // Accumulate live pit readings for a dedicated LAN pit probe.
  useEffect(() => {
    if (selectedLanPitProbe == null || selectedLanPitProbe.probeTempF == null) return;
    const currentTemp = selectedLanPitProbe.probeTempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLivePitReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedLanPitProbe]);

  // Accumulate live readings for ThermoWorks BLE probes.
  // Fires each time the ThermoWorks probe polling cycle delivers a new reading.
  useEffect(() => {
    if (selectedThermoworksProbe == null || (selectedThermoworksProbe as any).tempF == null) return;
    const currentTemp = (selectedThermoworksProbe as any).tempF as number;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLiveReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedThermoworksProbe]);

  // Accumulate live pit readings for ThermoWorks pit probe (dedicated pit channel).
  useEffect(() => {
    if (selectedThermoworksPitProbe == null || (selectedThermoworksPitProbe as any).tempF == null) return;
    const currentTemp = (selectedThermoworksPitProbe as any).tempF as number;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLivePitReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedThermoworksPitProbe]);

  // Accumulate live readings for Inkbird BLE probes.
  // Fires each time the BLE advertisement scanner delivers a new reading.
  useEffect(() => {
    if (selectedInkbirdProbe?.tempF == null) return;
    const currentTemp = selectedInkbirdProbe.tempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLiveReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedInkbirdProbe]);

  // Accumulate live pit readings for Inkbird pit probe (dedicated pit channel).
  useEffect(() => {
    if (selectedInkbirdPitProbe?.tempF == null) return;
    const currentTemp = selectedInkbirdPitProbe.tempF;
    const startAt = cook?.actualStartAt;
    const elapsedMins = startAt
      ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000)
      : 0;
    setLivePitReadings((prev) => [
      ...prev,
      { timeMinutes: Math.round(elapsedMins * 10) / 10, tempF: currentTemp },
    ]);
  }, [selectedInkbirdPitProbe]);

  const topPad = useTopInset();
  const botPad = useBottomInset();
  const { isTablet, detailMaxWidth } = useLayout();

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
            qc.invalidateQueries({ queryKey: ["home", "insights"] });
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
    qc.invalidateQueries({ queryKey: ["home", "insights"] });

    // Show the rating prompt when a cook is marked complete and has no rating yet.
    // Gate on !(cook as any)?.rating so re-opening an already-rated completed cook
    // never re-triggers the sheet.
    if (status === "completed" && !(cook as any)?.rating) {
      setShowRatingPrompt(true);
    }

    // Clear the saved probe assignments so a stale pairing never reappears if
    // the user revisits this cook after it has ended.
    if ((status === "completed" || status === "cancelled") && id && Platform.OS !== "web") {
      setSelectedMeatProbeId(null);
      setSelectedPitProbeId(null);
      AsyncStorage.removeItem(`probe_meat_${id}`).catch(() => {});
      AsyncStorage.removeItem(`probe_pit_${id}`).catch(() => {});
    }

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

  const analyze = async (opts: {
    auto?: boolean;
    extraNotes?: string;
    /** Bypass stale lastCheckin cache — pass temps submitted in the unified sheet directly */
    checkinOverride?: { internalTempF: number | null; pitTempF: number | null };
  } = {}) => {
    const auto = opts.auto === true;
    // extraNotes lets callers inject text directly into the analysis context
    // without racing a React state update cycle (e.g. unified check-in sheet).
    const notesForAnalysis = opts.extraNotes != null
      ? [opts.extraNotes.trim(), scanNotes.trim()].filter(Boolean).join(" · ")
      : scanNotes.trim();
    // Selected probe takes precedence; fall back to last saved check-in temp.
    const liveMeaterInternalTempF =
      selectedMeaterProbe?.internalTempF != null
        ? (selectedMeaterProbe.internalTempF as number)
        : null;
    const hasMeaterTemp = liveMeaterInternalTempF != null;
    // BLE context device (MEATER via GATT, Govee, Weber iGrill) live readings.
    const liveBleInternalTempF = selectedBleContextDevice?.probeTempF ?? null;
    const liveBleAmbientTempF = selectedBleContextDevice?.ambientTempF ?? null;
    // LAN probe (Fireboard, MEATER Block, ThermoWorks Signals) live readings.
    const liveLanInternalTempF = selectedLanProbe?.probeTempF ?? null;
    const liveLanAmbientTempF = selectedLanProbe?.ambientTempF ?? null;
    const hasLiveProbeTemp = liveBleInternalTempF != null || liveLanInternalTempF != null;
    // checkinOverride lets the unified check-in sheet bypass async query-cache
    // lag — the just-submitted temps arrive immediately without waiting for
    // getListCookCheckinsQueryKey to refetch and update lastCheckin.
    // Priority for meat temp: MEATER cloud > BLE GATT/adv > LAN probe > manual check-in override > last check-in.
    const resolvedInternalTempF =
      liveMeaterInternalTempF ??
      liveBleInternalTempF ??
      liveLanInternalTempF ??
      opts.checkinOverride?.internalTempF ??
      lastCheckin?.internalTempF ??
      null;
    // Determine which source resolved the internal temp so the result card
    // can show "Source: MEATER Probe · 185°F" for user transparency.
    let snapshotTempSourceLabel: string | null = null;
    if (liveMeaterInternalTempF != null) {
      snapshotTempSourceLabel = selectedMeaterProbe?.deviceName ?? "MEATER Probe";
    } else if (liveBleInternalTempF != null) {
      snapshotTempSourceLabel = selectedBleContextDevice?.name ?? "BLE Probe";
    } else if (liveLanInternalTempF != null) {
      snapshotTempSourceLabel = selectedLanProbe?.deviceName ?? "LAN Probe";
    } else if (opts.checkinOverride?.internalTempF != null) {
      snapshotTempSourceLabel = "Manual Entry";
    } else if (lastCheckin?.internalTempF != null) {
      snapshotTempSourceLabel = "Last Check-In";
    }
    // Priority for pit/ambient temp: manual override > live probe ambient (BLE > LAN > MEATER cloud) > last check-in (stale fallback).
    // Live probe ambient takes precedence over stale check-in history so PitMaster sees real current pit temp.
    const resolvedPitTempF =
      opts.checkinOverride?.pitTempF ??
      liveBleAmbientTempF ??
      liveLanAmbientTempF ??
      selectedMeaterProbe?.ambientTempF ??
      lastCheckin?.pitTempF ??
      null;
    const hasCheckinTemp = resolvedInternalTempF != null || resolvedPitTempF != null;
    const hasAnyInput = images.length > 0 || notesForAnalysis.length > 0 || hasCheckinTemp;
    if (!hasAnyInput && !hasMeaterTemp && !hasLiveProbeTemp) {
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
            // resolvedInternalTempF / resolvedPitTempF bypass stale lastCheckin
            // cache when called immediately after a unified-sheet submission.
            userEnteredTempF: resolvedInternalTempF,
            // Live probe data for phase detection (active cooks only)
            liveReadings: liveReadings.length >= 2 ? liveReadings : null,
            elapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            currentPitTempF: resolvedPitTempF,
            outdoorTempF: weather.tempF ?? null,
            cookStatus: c?.status ?? null,
            // Technique quick-picks persisted on the cook record
            cookingMethod: c?.cookingMethod ?? null,
            injection: c?.injection ?? null,
            spritzFrequency: c?.spritzFrequency ?? null,
            wrapFinish: c?.wrapFinish ?? null,
            // Frozen-meat fields — let PitMaster factor thaw time into future plans
            // actualStartAt = meat-on time; actualThawStartAt = when thaw started.
            // thaw duration = actualStartAt - actualThawStartAt
            // active cook duration = actualEndAt - actualStartAt
            fromFrozen: c?.fromFrozen ?? false,
            thawMethod: c?.thawMethod ?? null,
            actualThawStartAt: c?.actualThawStartAt ? new Date(c.actualThawStartAt).toISOString() : null,
            actualEndAt: c?.actualEndAt ? new Date(c.actualEndAt).toISOString() : null,
            // All active probe channels from every connected device — lets
            // PitMaster reason about every zone simultaneously (e.g. brisket
            // flat vs point, pit vs meat).
            // • LAN devices (Fireboard, ThermoWorks Signals, MEATER Block):
            //   each channel has its own label from the device firmware.
            // • BLE devices (MEATER GATT, Govee, Weber iGrill): each *device*
            //   is one channel; we use the device name as the label.
            // Omitted entirely when no connected probes are reporting temps.
            probeChannels: (() => {
              const channels: Array<{ channelLabel: string; probeTempF: number }> = [];
              for (const p of lanProbes) {
                channels.push({ channelLabel: p.channelLabel, probeTempF: p.probeTempF });
              }
              for (const d of bleContextDevices) {
                if (d.probeTempF != null) {
                  channels.push({ channelLabel: d.name, probeTempF: d.probeTempF });
                }
              }
              return channels.length > 0 ? channels : null;
            })(),
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
            snapshotTempF: resolvedInternalTempF,
            snapshotTempSourceLabel,
            snapshotNotes: notesForAnalysis || null,
            snapshotElapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            source: images.length > 0 ? "image_scan" : "active_cook",
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

  // Build ProbeTimeSeries from raw DB temperature_readings for completed cooks.
  // Grouped by probeNumber so each physical probe gets its own line on the graph.
  // Used as a fallback when the cook has no stored AI analysis, and as a
  // supplement when it does (storedGraphProbes takes priority).
  // IMPORTANT: must live BEFORE the early returns so hook count is stable.
  const completedCookReadingsProbes = useMemo<ProbeTimeSeries[]>(() => {
    if (!cook) return [];
    if (cookStatus !== "completed") return [];
    if (!historicalReadings || historicalReadings.length === 0) return [];
    const actualStartAt = (cook as any)?.actualStartAt;
    if (!actualStartAt) return [];

    const startMs = new Date(actualStartAt).getTime();
    const probeNumbers = [
      ...new Set(historicalReadings.map((r: TemperatureReading) => r.probeNumber)),
    ].sort((a: number, b: number) => a - b);

    return probeNumbers
      .map((probeNum: number) => {
        const timeSeries = historicalReadings
          .filter((r: TemperatureReading) => r.probeNumber === probeNum)
          .map((r: TemperatureReading) => ({
            timeMinutes:
              Math.round(
                Math.max(0, (new Date(r.recordedAt).getTime() - startMs) / 60000) * 10,
              ) / 10,
            tempF: r.tempF,
          }))
          .sort((a: { timeMinutes: number }, b: { timeMinutes: number }) => a.timeMinutes - b.timeMinutes);
        const lastTemp = timeSeries[timeSeries.length - 1]?.tempF ?? 0;
        const probeName =
          probeNum === 1
            ? "Internal"
            : probeNum === 2
              ? "Ambient"
              : `Probe ${probeNum}`;
        return {
          probeName,
          timeSeries,
          finishingTempF: lastTemp,
        };
      })
      .filter((p) => p.timeSeries.length >= 2);
  }, [cook, cookStatus, historicalReadings]);

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

  // Live graph from accumulated readings — works for any selected probe type
  // (MEATER, ThermoWorks, Inkbird BLE, BLE context device, or LAN probe).
  const activeProbeName =
    (selectedMeatProbeId && probeLabels[selectedMeatProbeId])
      ? probeLabels[selectedMeatProbeId]
      : (selectedMeaterProbe?.deviceName ??
        selectedBleContextDevice?.name ??
        selectedLanProbe?.deviceName ??
        selectedInkbirdProbe?.deviceName ??
        "Probe");
  const activePitProbeName =
    (selectedPitProbeId && probeLabels[selectedPitProbeId])
      ? probeLabels[selectedPitProbeId]
      : "Pit / Ambient";
  const liveGraphProbes = (() => {
    if (tempMode === "probe" && selectedMeatProbeId != null && liveReadings.length >= 2) {
      return [
        { probeName: activeProbeName, timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1]!.tempF },
        ...(livePitReadings.length >= 2
          ? [{ probeName: activePitProbeName, timeSeries: livePitReadings, finishingTempF: livePitReadings[livePitReadings.length - 1]!.tempF }]
          : []),
      ];
    }
    if (tempMode === "manual" && liveReadings.length >= 2) {
      return [
        { probeName: "Manual entries", timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1]!.tempF },
      ];
    }
    return [];
  })();

  // Stored analysis from DB
  const storedAnalysis = c.analysisResult as AnalysisResult | null | undefined;
  const storedAssessment = storedAnalysis?.assessment ?? null;
  const storedVerdictCfg = storedAssessment ? (VERDICT_CONFIG[storedAssessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;
  const storedGraphProbes = (storedAnalysis?.probes ?? []).filter((p: any) => p.timeSeries && p.timeSeries.length >= 2);

  // Effective probes for the stored-analysis graph: prefer AI-derived probes
  // (richer metadata) but fall back to raw readings probes when absent.
  const effectiveStoredGraphProbes =
    storedGraphProbes.length > 0 ? storedGraphProbes : completedCookReadingsProbes;

  // ── Decision engine renderer ──────────────────────────────────────────────
  const ACTION_CONFIG: Record<string, { icon: string; label: string }> = {
    wrap:              { icon: "package",       label: "Wrap Now"         },
    spritz:            { icon: "cloud-drizzle", label: "Spritz"           },
    mop:               { icon: "droplet",       label: "Mop"              },
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
      <View style={[s.decisionsSection, { borderColor: colors.border, gap: 6 }]}>
        {/* Compact hero decision — colored left border, action label, instruction capped at 2 lines */}
        <View style={{ borderRadius: colors.radius, overflow: "hidden", borderWidth: 1, borderColor: topColor + "30", backgroundColor: topColor + "0A" }}>
          <View style={{ flexDirection: "row" }}>
            <View style={{ width: 4, backgroundColor: topColor }} />
            <View style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 4 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                <Feather name={topActionCfg.icon as any} size={12} color={topColor} />
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 11, color: topColor, textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {topActionCfg.label}
                </Text>
              </View>
              <Text style={[s.decisionInstruction, { color: colors.foreground, fontSize: 14 }]} numberOfLines={2}>
                {top.instruction}
              </Text>
              {top.rationale ? (
                <>
                  <Pressable
                    onPress={() => setExpandedRationale(topRationaleOpen ? null : 0)}
                    style={{ flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start" }}
                    hitSlop={8}
                  >
                    <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: topColor }}>
                      {topRationaleOpen ? "Hide reasoning" : "Why?"}
                    </Text>
                    <Feather name={topRationaleOpen ? "chevron-up" : "chevron-down"} size={11} color={topColor} />
                  </Pressable>
                  {topRationaleOpen && (
                    <Text style={[s.decisionRationale, { color: colors.mutedForeground }]}>{top.rationale}</Text>
                  )}
                </>
              ) : null}
            </View>
          </View>
        </View>

        {/* Secondary decisions — collapsed behind a single toggle */}
        {rest.length > 0 && (
          <>
            <Pressable
              onPress={() => setShowSecondaryDecisions(v => !v)}
              style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }}
              hitSlop={8}
            >
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground }}>
                {showSecondaryDecisions ? "Hide suggestions" : `${rest.length} more suggestion${rest.length > 1 ? "s" : ""}`}
              </Text>
              <Feather name={showSecondaryDecisions ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground} />
            </Pressable>
            {showSecondaryDecisions && (
              <View style={{ gap: 3 }}>
                {rest.map((d, i) => {
                  const actionCfg = ACTION_CONFIG[d.action] ?? { icon: "zap", label: d.action };
                  const urgencyCfg = URGENCY_CONFIG[d.urgency] ?? { label: d.urgency.toUpperCase(), color: "#6B7280" };
                  const isMaintain = d.action === "maintain";
                  const cardColor = isMaintain ? "#22c55e" : urgencyCfg.color;
                  return (
                    <View
                      key={i}
                      style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10, paddingVertical: 7, borderRadius: colors.radius, backgroundColor: cardColor + "08", borderWidth: 1, borderColor: cardColor + "22" }}
                    >
                      <Feather name={actionCfg.icon as any} size={11} color={cardColor} />
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: cardColor, width: 72 }} numberOfLines={1}>
                        {actionCfg.label}
                      </Text>
                      <Text style={{ flex: 1, fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }} numberOfLines={1}>
                        {d.instruction}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
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
          {(() => {
            const sizeText: string | null =
              (c.sizingLabel as string | null | undefined) ??
              (typeof c.weightLbs === "number" ? `${c.weightLbs} lbs` : null);
            if (!sizeText) return null;
            return (
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 4,
                backgroundColor: colors.card, borderRadius: 6,
                paddingHorizontal: 7, paddingVertical: 3,
                borderWidth: 1, borderColor: colors.border,
                marginLeft: 4,
              }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: colors.foreground }}>{sizeText}</Text>
              </View>
            );
          })()}
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

        {/* ── Outlier cook callout ──────────────────────────────────────────
             Shown on completed cooks flagged as outliers (missing check-ins
             or unusual duration). User can dismiss it to restore this cook
             to grill fingerprint calculations.                              */}
        {c.status === "completed" && c.isOutlier && !c.outlierDismissed && (() => {
          const handleDismiss = async () => {
            try {
              await dismissCookOutlier.mutateAsync({ id: c.id });
              qc.invalidateQueries({ queryKey: getGetCookQueryKey(c.id) });
              qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
            } catch {
              Alert.alert("Error", "Could not update this cook. Please try again.");
            }
          };
          return (
            <View
              style={{
                borderRadius: colors.radius,
                backgroundColor: "#f59e0b12",
                borderWidth: 1,
                borderColor: "#f59e0b40",
                paddingHorizontal: 14,
                paddingVertical: 11,
                gap: 8,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <Feather name="alert-triangle" size={14} color="#f59e0b" />
                <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#f59e0b" }}>
                  Cook flagged for review
                </Text>
              </View>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
                This cook had few or no check-ins and its duration differed significantly from the AI prediction. It's been excluded from your grill fingerprint to keep your future predictions accurate.
              </Text>
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
                If the data looks right — you just forgot to log check-ins — tap below to restore it.
              </Text>
              <Pressable
                onPress={handleDismiss}
                style={({ pressed }) => ({
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 5,
                  backgroundColor: "#f59e0b18",
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: "#f59e0b55",
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Feather name="check" size={13} color="#f59e0b" />
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: "#f59e0b" }}>
                  Mark as accurate
                </Text>
              </Pressable>
            </View>
          );
        })()}

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
          // Determine which probe is providing the live reading so the chip
          // can label the source (e.g. "MEATER Block" or "BLE Probe").
          let liveProbeSrcLabel: string | null = null;
          if (selectedMeaterProbe?.internalTempF != null) {
            liveProbeSrcLabel = (selectedMeaterProbe as any).deviceName ?? "MEATER Probe";
          } else if (selectedThermoworksProbe?.tempF != null) {
            liveProbeSrcLabel = (selectedThermoworksProbe as any).deviceName ?? "ThermoWorks";
          } else if (selectedBleContextDevice?.probeTempF != null) {
            liveProbeSrcLabel = selectedBleContextDevice.name ?? "BLE Probe";
          } else if (selectedLanProbe?.probeTempF != null) {
            liveProbeSrcLabel = selectedLanProbe.deviceName ?? "LAN Probe";
          } else if (selectedInkbirdProbe?.tempF != null) {
            liveProbeSrcLabel = (selectedInkbirdProbe as any).deviceName ?? "Inkbird";
          } else if (cookCurrentTempF != null && activeProbeName !== "Probe") {
            liveProbeSrcLabel = activeProbeName;
          }
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
                  {liveProbeSrcLabel != null && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: "#F59E0B99" }}>
                      {liveProbeSrcLabel}
                    </Text>
                  )}
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

        {/* ── F-Grade PitMaster Roast Banner ──────────────────── */}
        {fGradeQuip && cookStatus === "active" && (
          <View
            style={{
              backgroundColor: "#EF444415",
              borderRadius: colors.radius as number,
              borderWidth: 1,
              borderColor: "#EF444450",
              padding: 14,
              flexDirection: "row",
              gap: 10,
              alignItems: "flex-start",
            }}
          >
            <Feather name="alert-octagon" size={16} color="#EF4444" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                  color: "#EF4444",
                  marginBottom: 4,
                }}
              >
                PitMaster Says: Cut Your Losses
              </Text>
              <Text
                style={{
                  fontFamily: "Inter_400Regular",
                  fontSize: 13,
                  color: colors.foreground as string,
                  lineHeight: 18,
                }}
              >
                {fGradeQuip}
              </Text>
            </View>
          </View>
        )}

        {/* ── Cook Health Score (active / completed, and only once meat is on) ──
             For outlier cooks the API returns grade: null so the card renders
             a neutral "review pending" indicator instead of a misleading grade. */}
        {(cookStatus === "active" || cookStatus === "completed") && (cookStatus !== "active" || isMeatOn) && (
          <CookHealthScoreCard
            cookId={Number(id)}
            colors={colors}
            cookStatus={cookStatus}
            checkinCount={(cookCheckins as CookCheckin[]).length}
            lastDecision={cookStatus === "active" ? (c.analysisResult?.decisions?.[0] ?? null) : null}
            onGradeChange={(grade, quip) => {
              if (cookStatus === "active") {
                setFGradeQuip(grade === "F" ? quip : null);
              }
            }}
          />
        )}

        {/* ── Live Cook section (active cooks only) ──────────── */}
        <LiveCookSection
          c={c}
          colors={colors}
          weather={weather}
          meaterLinked={meaterLinked}
          meaterProbes={meaterProbes}
          thermoworksLinked={thermoworksLinked}
          thermoworksProbes={thermoworksProbes}
          inkbirdProbes={inkbirdProbes}
          bleContextDevices={bleContextDevices}
          lanProbes={lanProbes}
          autoAssignBanner={autoAssignBanner}
          onDismissAutoAssignBanner={() => setAutoAssignBanner(null)}
          reconnectBanner={reconnectBanner}
          onDismissReconnectBanner={dismissReconnectBanner}
          tempMode={tempMode}
          onSetTempMode={setTempMode}
          selectedMeatProbeId={selectedMeatProbeId}
          selectedPitProbeId={selectedPitProbeId}
          onSelectMeatProbe={handleSelectMeatProbe}
          onSelectPitProbe={handleSelectPitProbe}
          probeLabels={probeLabels}
          onSetProbeLabel={handleSetProbeLabel}
          otherCookAssignments={otherCookAssignments}
          inkbirdScanning={inkbirdScanning}
          inkbirdReconnecting={combinedReconnecting}
          liveGraphProbes={liveGraphProbes}
          liveReadings={liveReadings}
          cardWidth={cardWidth}
          elapsedMs={elapsedMs}
          remainingMs={remainingMs}
          estimatedFinishMs={estimatedFinishMs}
          nowMs={nowMs}
          targetTempF={c.targetTempF ?? null}
          cookTempF={c.cookTempF ?? null}
          nextSpritzMs={nextSpritzMs}
          isMeatOn={isMeatOn}
          pitMasterResult={result}
          pitMasterAnalyzing={analyzing}
          renderDecisions={renderDecisions}
          onCheckIn={handlePitMasterCheckIn}
          onCheckInNext={handleCheckInNext}
          onOpenChat={() => setChatModalVisible(true)}
          lastAnalyzedAtMs={lastAnalyzedAtMs}
          lastCheckinInternalTempF={lastCheckin?.internalTempF ?? null}
          onRefresh={() => analyze()}
          activeProbeName={activeProbeName !== "Probe" ? activeProbeName : null}
          activePitProbeName={activePitProbeName !== "Pit / Ambient" ? activePitProbeName : undefined}
          currentInternalTempF={autoCheckinProbeReading?.internalTempF ?? null}
          currentPitTempF={autoCheckinProbeReading?.pitTempF ?? null}
          nextCheckinMs={nextCheckinMs}
          nextCheckinLabel={nextCheckinLabel}
          upcomingCheckins={upcomingCheckinsForCard}
          onCheckInPhase={openCheckin}
          knownProbeIds={knownProbeIds}
          lastKnownInkbirdDeviceId={lastKnownInkbirdDeviceId}
          onRestartScan={handleRestartScan}
          factorBreakdown={cookSeqData?.factorBreakdown ?? null}
          qualFactors={(() => {
            const items: QualFactor[] = [];
            const breakdown = cookSeqData?.factorBreakdown ?? [];
            const hasSlower = breakdown.some(f => f.label === "Learned Pace (Slower)");
            const fpSrc = cookSeqData?.fingerprintSource;
            if (fpSrc === "grill" || fpSrc === "user") {
              if (!hasSlower) items.push({ label: "Faster Pace", colorHex: "#22C55E", icon: "trending-down" });
              items.push({ label: "Grill Tuned", colorHex: "#22C55E", icon: "activity" });
            }
            if (breakdown.some(f => f.label === "Cold Weather")) items.push({ label: "Cold Weather", colorHex: "#38BDF8", icon: "thermometer" });
            if (breakdown.some(f => f.label === "Grill Load")) items.push({ label: "Grill Load", colorHex: "#F97316", icon: "layers" });
            if ((c as any).fromFrozen) items.push({ label: "Frozen", colorHex: "#3B82F6", icon: "box" });
            if ((c as any).injection) items.push({ label: "Injection", colorHex: "#8B5CF6", icon: "droplet" });
            if ((c as any).wrapMethod) items.push({ label: "Wrap", colorHex: "#F97316", icon: "package" });
            return items;
          })()}
        />
        <CookSummaryCard
          c={c}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          healthGrade={(() => {
            const stored: string | null | undefined = (c as any).healthScore;
            if (stored) return stored;
            const verdict: string | undefined = (c as any).analysisResult?.assessment?.verdict;
            return verdict !== undefined ? letterGrade(VERDICT_SCORE[verdict] ?? 50) : null;
          })()}
          rating={(() => {
            const liveVals = [rateTenderness, rateFlavor, rateBark].filter((v) => v > 0);
            if (liveVals.length > 0) return liveVals.reduce((a, b) => a + b, 0) / liveVals.length;
            const r = (c as any).rating;
            return typeof r === "number" && r > 0 ? r : null;
          })()}
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
              scheduledCheckins={plannedSequenceCheckins}
              onCheckinPress={setPlannedCheckinPreviewSc}
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
          const hasTechValues = !!(c.cookingMethod || c.injection || c.spritzFrequency || c.wrapFinish);
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
                    {[c.cookingMethod, c.injection, c.spritzFrequency, c.wrapFinish].filter(Boolean).map((v: string, i: number) => (
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
                    label="Spritz/Mop Frequency"
                    value={c.spritzFrequency ?? null}
                    placeholder="Not set"
                    icon="wind"
                    iconColor="#0EA5E9"
                    onPress={() => setTechSpritzSheetOpen(true)}
                    onClear={() => saveTechnique({ spritzFrequency: null })}
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
            {cookStatus !== "completed" && <SequenceSchedule
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
              scheduledCheckins={cookStatus === "active" ? (() => {
                const hasPlan = !!(cookSeqData?.schedule?.length);
                const base = hasPlan && storedScheduledCheckins.length > 0
                  ? storedScheduledCheckins
                  : noPlanScheduledCheckins;
                return base.filter((sc) => !removedPlannedKeys.has(sc.phaseKey));
              })() : undefined}
              cookCheckins={cookCheckins as CookCheckin[]}
              onCheckinPress={cookStatus === "active" ? openCheckin : undefined}
              nextCheckinSc={cookStatus === "active" ? nextCheckinSc : null}
            />}
            {/* For active cooks with no AI sequence plan (Cook Now path), SequenceSchedule
                returns null. Show PlannedCookTimeline instead so check-in checkpoints
                and the cook timeline are still visible. It self-guards and returns null
                when sequenceData is present, so it never duplicates the SequenceSchedule. */}
            {cookStatus !== "completed" && <PlannedCookTimeline c={c} colors={colors} cookStatus={cookStatus} estimatedFinishMs={estimatedFinishMs} />}
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

        {/* ── Stored AI analysis (completed and planned cooks only) ── */}
        {cookStatus !== "active" && <StoredAiAnalysis
          c={c}
          colors={colors}
          storedAnalysis={storedAnalysis}
          storedAssessment={storedAssessment}
          storedVerdictCfg={storedVerdictCfg}
          storedGraphProbes={effectiveStoredGraphProbes}
          cardWidth={cardWidth}
          isIdentityLinked={isIdentityLinked}
          effectivePro={effectivePro}
          expandedStoredSections={expandedStoredSections}
          toggleStoredSection={toggleStoredSection}
          showPaywall={showPaywall}
          onCardLayout={onCardLayout}
        />}

        {/* ── Completed cook: Cook Timeline + Activity (after PitMaster analysis, consecutive) ── */}
        {cookStatus === "completed" && (
          <>
            {/* SequenceSchedule renders when seqData present; PlannedCookTimeline is the fallback for Cook Now cooks (self-guards when seqData present) */}
            <SequenceSchedule
              c={c}
              colors={colors}
              cookStatus={cookStatus}
              nowMs={nowMs}
              nextStep={null}
              seqScheduleExpanded={seqScheduleExpanded}
              setSeqScheduleExpanded={setSeqScheduleExpanded}
              confirmedSteps={confirmedSteps}
              toggleConfirmedStep={toggleConfirmedStep}
              scheduleListYRef={scheduleListYRef}
              itemYRef={itemYRef}
              timelineYRef={timelineYRef}
              rowYRef={rowYRef}
              cookCheckins={cookCheckins as CookCheckin[]}
            />
            <PlannedCookTimeline c={c} colors={colors} cookStatus={cookStatus} estimatedFinishMs={estimatedFinishMs} />
            <CookActivityTimeline
              c={c}
              colors={colors}
              cookStatus={cookStatus}
              nowMs={nowMs}
              cookId={Number(id)}
              cookSeqData={cookSeqData as SequenceData | null}
              checkins={cookCheckins as CookCheckin[]}
              checkinsLoading={checkinsLoading}
              onOpenCheckin={openCheckin}
              triggeredAlerts={[]}
              stepConfirmations={(() => {
                const schedule = (cookSeqData?.schedule ?? []) as Array<{ phaseKey?: string | null; phaseLabel?: string | null; confirmedAt?: string | null }>;
                return schedule
                  .filter((item) => item.confirmedAt != null)
                  .map((item, i) => ({
                    id: `step-${item.phaseKey ?? i}`,
                    label: item.phaseLabel ?? "Step complete",
                    confirmedAt: item.confirmedAt as string,
                  }));
              })()}
              liveReadingMilestones={[]}
              effectivePro={effectivePro}
              isIdentityLinked={isIdentityLinked}
              showPaywall={showPaywall}
              plannedCheckins={[]}
              refetchIntervalMs={probeIntervalMs}
            />
          </>
        )}

        {/* ── Standalone Temperature History (completed cooks with probe data but no AI analysis) ── */}
        {cookStatus === "completed" && !storedAnalysis && completedCookReadingsProbes.length > 0 && (
          <View
            style={[
              { backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 4 },
            ]}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Feather name="activity" size={15} color={colors.mutedForeground as string} />
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, letterSpacing: 0.3 }}>
                Temperature History
              </Text>
            </View>
            <TempGraph
              probes={completedCookReadingsProbes}
              targetTempF={c.targetTempF ?? null}
              width={cardWidth}
              height={190}
            />
          </View>
        )}


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

        {/* ── Share Cook (completed cooks only) ───────────────── */}
        <ShareCookButton cook={c} colors={colors} />


        {/* ── Activity Timeline (active/planned cooks — completed cooks show this above, right after the cook timeline) */}
        {cookStatus !== "completed" && <CookActivityTimeline
          c={c}
          colors={colors}
          cookStatus={cookStatus}
          nowMs={nowMs}
          cookId={Number(id)}
          cookSeqData={cookSeqData as SequenceData | null}
          checkins={cookCheckins as CookCheckin[]}
          checkinsLoading={checkinsLoading}
          onOpenCheckin={openCheckin}
          triggeredAlerts={[]}
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
          effectivePro={effectivePro}
          isIdentityLinked={isIdentityLinked}
          showPaywall={showPaywall}
          refetchIntervalMs={probeIntervalMs}
          plannedCheckins={(() => {
            if (cookStatus !== "active") return [];
            const hasPlan = !!cookSeqData?.schedule?.length;
            const base = hasPlan && storedScheduledCheckins.length > 0
              ? storedScheduledCheckins
              : noPlanScheduledCheckins;
            return base
              .filter((sc) => !removedPlannedKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs)
              .sort((a, b) => a.scheduledAt - b.scheduledAt);
          })()}
          onRemovePlanned={(phaseKey) => {
            setRemovedPlannedKeys((prev) => new Set([...prev, phaseKey]));
            cancelCheckinNotificationForPhase(Number(id), phaseKey).catch(() => {});
          }}
        />}

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

      {/* ── Manual Check-In Saved Toast ──────────────────────── */}
      {checkinSavedToast != null && (
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
            {checkinSavedToast}
          </Text>
          <Pressable onPress={() => setCheckinSavedToast(null)} hitSlop={10}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      {/* ── Auto Check-In Toast ──────────────────────────────── */}
      {autoCheckinToast != null && (
        <View
          style={{
            position: "absolute",
            bottom: checkinSavedToast != null ? 150 + insets.bottom : 90 + insets.bottom,
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

      {/* ── Inkbird Reconnect Toast ──────────────────────────── */}
      {inkbirdToastMounted && (
        <Animated.View
          style={{
            position: "absolute",
            bottom:
              (checkinSavedToast != null ? 60 : 0) +
              (autoCheckinToast != null ? 60 : 0) +
              90 + insets.bottom,
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
            opacity: inkbirdToastAnim,
            transform: [
              {
                translateY: inkbirdToastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          }}
        >
          <Feather name="wifi" size={16} color="#22c55e" />
          <Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>
            Inkbird reconnected ✓
          </Text>
          <Pressable onPress={() => setInkbirdReconnectToast(false)} hitSlop={10}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        </Animated.View>
      )}

      {/* ── BLE Context Reconnect Toast (MEATER / Govee) ─────── */}
      {bleReconnectToast != null && (
        <View
          style={{
            position: "absolute",
            bottom:
              (checkinSavedToast != null ? 60 : 0) +
              (autoCheckinToast != null ? 60 : 0) +
              (inkbirdToastMounted ? 60 : 0) +
              90 + insets.bottom,
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
          <Feather name="wifi" size={16} color="#22c55e" />
          <Text style={{ flex: 1, color: "#F3EDE1", fontFamily: "Inter_400Regular", fontSize: 13 }}>
            {bleReconnectToast} reconnected ✓
          </Text>
          <Pressable onPress={() => setBleReconnectToast(null)} hitSlop={10}>
            <Feather name="x" size={14} color="#9CA3AF" />
          </Pressable>
        </View>
      )}

      {/* ── Unified Check-In with PitMaster Sheet ────────────── */}
      {activeCheckin && (
        <UnifiedCheckinSheet
          visible={checkinModalVisible}
          onClose={() => setCheckinModalVisible(false)}
          cookId={Number(id)}
          colors={colors}
          phase={activeCheckin.phase}
          scheduledAt={activeCheckin.scheduledAt}
          foodType={cook?.foodType}
          weightLbs={cook?.weightLbs ?? null}
          sizingLabel={cook?.sizingLabel ?? null}
          currentInternalTempF={
            tempMode === "probe"
              ? (selectedMeaterProbe?.internalTempF
                  ?? selectedThermoworksProbe?.tempF
                  ?? selectedInkbirdProbe?.tempF
                  ?? selectedBleContextDevice?.probeTempF
                  ?? selectedLanProbe?.probeTempF
                  ?? null)
              : null
          }
          currentPitTempF={tempMode === "probe"
            ? (
                // Dedicated MEATER pit probe (separate device in grill)
                (selectedMeaterPitProbe != null && selectedMeaterPitProbe.deviceId !== selectedMeaterProbe?.deviceId
                  ? selectedMeaterPitProbe.internalTempF ?? null
                  : selectedMeaterProbe?.ambientTempF ?? null)
                // Dedicated ThermoWorks pit channel
                ?? (selectedThermoworksPitProbe != null ? (selectedThermoworksPitProbe as any).tempF ?? null : null)
                // Dedicated Inkbird pit channel
                ?? selectedInkbirdPitProbe?.tempF
                // Dedicated BLE-context pit device, or meat device's ambient
                ?? (selectedBleContextPitDevice != null && selectedBleContextPitDevice.id !== selectedBleContextDevice?.id
                    ? selectedBleContextPitDevice.probeTempF ?? null
                    : selectedBleContextDevice?.ambientTempF ?? null)
                // Dedicated LAN pit probe, or meat probe's ambient
                ?? (selectedLanPitProbe != null && selectedLanPitProbe.deviceId !== selectedLanProbe?.deviceId
                    ? selectedLanPitProbe.probeTempF ?? null
                    : selectedLanProbe?.ambientTempF ?? null)
              )
            : null}
          probeSource={
            tempMode !== "probe"
              ? null
              : selectedMeaterProbe?.internalTempF != null
              ? "meater"
              : selectedThermoworksProbe?.tempF != null
              ? "thermoworks"
              : selectedInkbirdProbe?.tempF != null
              ? "inkbird"
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
          cookSpritzFrequency={(cook as any)?.spritzFrequency ?? null}
          cookWrapFinish={(cook as any)?.wrapFinish ?? null}
          onRequestAnalyze={async (opts) => {
            await analyze({
              extraNotes: opts?.notes || undefined,
              checkinOverride: { internalTempF: opts?.internalTempF ?? null, pitTempF: opts?.pitTempF ?? null },
            });
          }}
          result={result}
          onCheckinSaved={(savedInternalTempF) => {
            // Optimistically append the manual temp to liveReadings so the graph
            // updates immediately without waiting for the checkins refetch to settle.
            if (savedInternalTempF != null && tempMode === "manual" && cook?.actualStartAt) {
              const startMs = new Date(cook.actualStartAt).getTime();
              const elapsedMins =
                Math.round(Math.max(0, (Date.now() - startMs) / 60000) * 10) / 10;
              setLiveReadings((prev) => [...prev, { timeMinutes: elapsedMins, tempF: savedInternalTempF }]);
              liveReadingsSeededRef.current = true;
            }
            if (checkinSavedToastTimerRef.current) clearTimeout(checkinSavedToastTimerRef.current);
            setCheckinSavedToast("Check-in saved ✓");
            checkinSavedToastTimerRef.current = setTimeout(() => setCheckinSavedToast(null), 2000);
            pendingWrapClearRef.current = true;
            qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
            qc.invalidateQueries({ queryKey: getListCookCheckinsQueryKey(Number(id)) });
            qc.invalidateQueries({ queryKey: getListCookEventsQueryKey(Number(id)) });
            const first = cookSeqData?.schedule?.[0];
            if (first?.meatOnAt && first?.estimatedFinishAt) {
              const completedKeys = new Set(
                (cookCheckins as CookCheckin[])
                  .map((ci) => ci.phaseKey)
                  .filter((k): k is string => k != null),
              );
              if (activeCheckin?.phaseKey) completedKeys.add(activeCheckin.phaseKey);
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

      {/* ── Planned sequence check-in preview sheet ──────────── */}
      <CheckinPreviewSheet
        visible={plannedCheckinPreviewSc != null}
        onClose={() => setPlannedCheckinPreviewSc(null)}
        colors={colors}
        sc={plannedCheckinPreviewSc}
        meatOnMs={
          cookSeqData?.schedule?.[0]?.meatOnAt
            ? new Date(cookSeqData.schedule[0].meatOnAt).getTime()
            : null
        }
      />

      {/* ── PitMaster Chat Modal ──────────────────────────────── */}
      <PitMasterChatModal
        visible={chatModalVisible}
        onClose={() => setChatModalVisible(false)}
      />

      <RateCookSheet
        visible={showRatingPrompt}
        colors={colors}
        saving={rateSaving}
        onSave={async (t, f, b) => {
          await saveRatings(t, f, b);
          setShowRatingPrompt(false);
        }}
        onSkip={() => setShowRatingPrompt(false)}
      />
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
