import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { isBgRefining, subscribeBgRefining, onBgAiRefined } from "@/lib/bgAiRefining";
import {
  View, Text, ScrollView, Pressable, Platform, ActivityIndicator,
  Alert, Image, Animated, LogBox,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as Notifications from "expo-notifications";

import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { useLayout } from "@/hooks/useLayout";
import { useScheduleStepNotifications } from "@/hooks/useScheduleStepNotifications";
import { useFrozenStageNotifications, scheduleFrozenStageNotifications, cancelStoredFrozenNotifications, type FrozenStageData } from "@/hooks/useFrozenStageNotifications";
import { useSpritzNotifications, computeNextSpritzMs } from "@/hooks/useSpritzNotifications";
import { setCookDetailVisible, setCurrentCookId } from "@/hooks/cookDetailVisibility";
import { consumePendingCheckin } from "@/lib/pendingCheckinNotif";
import { useCookLiveActivity } from "@/hooks/useCookLiveActivity";
import { LogoBackground } from "@/components/LogoBackground";
import { useAmbientWeather } from "@/hooks/useAmbientWeather";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useProactiveAlerts } from "@/hooks/useProactiveAlerts";
import { BlurredProSection } from "@/components/BlurredProSection";
import { NextUpBanner } from "@/components/NextUpBanner";
import { CookHealthScoreCard } from "@/components/cook-detail/CookHealthScoreCard";
import { LiveCookSection } from "@/components/cook-detail/LiveCookSection";
import { CookSummaryCard } from "@/components/cook-detail/CookSummaryCard";
import { CookTimelineSection } from "@/components/cook-detail/CookTimelineSection";
import { Cook2NudgeBanner } from "@/components/cook-detail/Cook2NudgeBanner";
import { RateThisCook } from "@/components/cook-detail/RateThisCook";
import { ShareCookButton } from "@/components/cook-detail/ShareCookButton";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";
import { EditCookModal } from "@/components/cook-detail/EditCookModal";
import { EditCookTimesSheet } from "@/components/cook-detail/EditCookTimesSheet";
import { WrapTempSheet } from "@/components/cook-detail/WrapTempSheet";
import { AddToPlannedCookModal } from "@/components/cook-detail/AddToPlannedCookModal";
import { UnifiedCheckinSheet } from "@/components/cook-detail/UnifiedCheckinSheet";
import { CheckinPreviewSheet } from "@/components/cook-detail/CheckinPreviewSheet";
import { PitMasterChatModal } from "@/components/PitMasterChatModal";
import { RateCookSheet } from "@/components/cook-detail/RateCookSheet";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";
import { DecisionsSection } from "@/components/cook-detail/DecisionsSection";
import {
  useListCookCheckins, useListTemperatureReadings, getListTemperatureReadingsQueryKey,
  getGetCookQueryKey, getListCooksQueryKey, getGetCookHealthQueryKey,
  getListCookCheckinsQueryKey, getListCookEventsQueryKey, getGetDashboardSummaryQueryKey,
  type CookCheckin, type Cook,
} from "@workspace/api-client-react";
import { useAutoCheckin } from "@/hooks/useAutoCheckin";
import { useCheckinNotifications, useCheckinDeepLink, rescheduleCheckinNotifications, cancelCheckinNotificationForPhase, scheduleCheckinNotifications, loadRemovedCheckinPhaseKeys } from "@/hooks/useCheckinNotifications";
import { scheduleStepNotifications, cancelStoredStepNotifications } from "@/hooks/useScheduleStepNotifications";
import { getCheckinSchedule, generateCheckinSchedule } from "@/constants/checkinKnowledge";
import type { ScheduledCheckin, CheckinSequenceAnchor } from "@/constants/checkinKnowledge";
import { computeNextStep, rippleScheduleTimestamps } from "@/components/cook-detail/utils";
import { letterGrade, VERDICT_SCORE } from "@/utils/gradeUtils";
import { STATUS_COLORS } from "@/components/cook-detail/constants";
import { s } from "@/components/cook-detail/styles";
import type { SequenceData, Decision } from "@/components/cook-detail/types";
import type { ProbeTimeSeries } from "@/components/TempGraph";
import { QP_COOK_METHODS, QP_INJECTION_OPTIONS, QP_SPRITZ_FREQUENCIES, QP_WRAP_FINISH_OPTIONS } from "@/constants/cookQuickPicks";
import { type QualFactor } from "@/components/CookFactorsSheet";

import { useCookDetail } from "@/hooks/useCookDetail";
import { useProbeState } from "@/hooks/useProbeState";
import { useLiveReadings } from "@/hooks/useLiveReadings";
import { useAnalysis } from "@/hooks/useAnalysis";
import { CookStatusSection } from "@/components/cook-detail/CookStatusSection";
import { LiveProbeSection } from "@/components/cook-detail/LiveProbeSection";
import { CookAnalysisSection } from "@/components/cook-detail/CookAnalysisSection";
import { TechniquesSection } from "@/components/cook-detail/TechniquesSection";
import { CookModals } from "@/components/cook-detail/CookModals";

LogBox.ignoreLogs(["ref.measureLayout must be called with a ref"]);
const logoImg = require("@/assets/images/icon-transparent-light.png");

export default function CookDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = useTopInset();
  const botPad = useBottomInset();
  const { isTablet, detailMaxWidth } = useLayout();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  // ── Core hooks ────────────────────────────────────────────────────────────
  const cd = useCookDetail(id);
  const { cook, cookStatus, cookSeqData, isLoading, cookDataUpdatedAt,
    cookCurrentTempF, cookCheckins, lastCheckin, checkinsLoading, activeCookCount, allCooksForCount,
    grills, updateCook, deleteCook, dismissCookOutlier, showPaywall, parseAndShowFromError,
    paywallUsage, effectivePro, effectiveProRef, isIdentityLinked,
    goBack, goHome,
    rateTenderness, setRateTenderness, rateFlavor, setRateFlavor, rateBark, setRateBark,
    rateSaving, showRatingPrompt, setShowRatingPrompt, saveRatings,
    confirmedSteps, toggleConfirmedStep: _toggleConfirmedStep, confirmWrap,
    wrapTempPending, setWrapTempPending, wrapAdjustedFinishMs, setWrapAdjustedFinishMs, pendingWrapClearRef,
    markingThaw, handleMarkThawStarted,
    editVisible, setEditVisible, editGrillPickerVisible, setEditGrillPickerVisible,
    editFoodType, setEditFoodType, editWeight, setEditWeight,
    editCookTemp, setEditCookTemp, editTargetTemp, setEditTargetTemp,
    editGrillId, setEditGrillId, editActualStartDate, setEditActualStartDate,
    editActualEndDate, setEditActualEndDate,
    editStartDateOpen, setEditStartDateOpen, editStartTimeOpen, setEditStartTimeOpen,
    editEndDateOpen, setEditEndDateOpen, editEndTimeOpen, setEditEndTimeOpen,
    editNotes, setEditNotes, editCookingMethod, setEditCookingMethod,
    editInjection, setEditInjection, editSpritzFrequency, setEditSpritzFrequency,
    editWrapFinish, setEditWrapFinish, editSaving, editDates, editSelectedGrill,
    openEdit, saveEdit,
    editTimesVisible, setEditTimesVisible, editTimesSaving, handleSaveCookTimes,
    handleDelete, handleStatusUpdate, handleLogFuelEvent,
    checkinModalVisible, setCheckinModalVisible, activeCheckin, setActiveCheckin,
    pendingCheckinSc, setPendingCheckinSc,
    firstCheckinNudgeDismissed, setFirstCheckinNudgeDismissed,
    plannedCheckinPreviewSc, setPlannedCheckinPreviewSc,
    noPlanScheduledCheckins, setNoPlanScheduledCheckins,
    removedPlannedKeys, setRemovedPlannedKeys,
    chatModalVisible, setChatModalVisible, openCheckin,
    techMethodSheetOpen, setTechMethodSheetOpen, techInjectionSheetOpen, setTechInjectionSheetOpen,
    techSpritzSheetOpen, setTechSpritzSheetOpen, techWrapFinishSheetOpen, setTechWrapFinishSheetOpen,
    techsExpanded, setTechsExpanded, seqScheduleExpanded, setSeqScheduleExpanded,
    addToSessionOpen, setAddToSessionOpen,
    expandedStoredSections, toggleStoredSection,
    getToken,
    statusColor, nextStatus, qualFactors,
  } = cd;

  const c = cook as any ?? {};

  const probeState = useProbeState({ id, cookStatus, cook, effectivePro, effectiveProRef, updateCookMutate: updateCook.mutate, allCooksForCount });
  const {
    tempMode, setTempMode,
    selectedMeatProbeId, selectedPitProbeId,
    probeLabels, otherCookAssignments,
    meaterLinked, meaterProbes, meaterDataUpdatedAt,
    thermoworksLinked, thermoworksProbes, thermoworksDataUpdatedAt,
    selectedMeaterProbe, selectedMeaterPitProbe,
    selectedThermoworksProbe, selectedThermoworksPitProbe,
    selectedInkbirdProbe, selectedInkbirdPitProbe,
    selectedBleContextDevice, selectedBleContextPitDevice,
    selectedLanProbe, selectedLanPitProbe,
    inkbirdProbes, inkbirdScanning, combinedReconnecting, lastKnownInkbirdDeviceId,
    bleContextDevices, reconnectBanner, dismissReconnectBanner,
    lanProbes, hasActiveProbe, knownProbeIds, probeIntervalMs,
    meatProbeSlots,
    handleSelectMeatProbe, handleAddMeatProbeSlot, handleRemoveMeatProbeSlot,
    handleSelectPitProbe, handleSetProbeLabel,
    autoAssignBanner, setAutoAssignBanner,
    inkbirdReconnectToast, setInkbirdReconnectToast, inkbirdToastMounted, inkbirdToastAnim,
    bleReconnectToast, setBleReconnectToast, handleRestartScan,
  } = probeState;

  const liveState = useLiveReadings({ id, cookStatus, cook, cookCheckins: cookCheckins as any[], probeState });
  const {
    nowMs, liveReadings, setLiveReadings, livePitReadings,
    liveReadingsSeededRef, autoCheckinProbeReading, completedCookReadingsProbes,
  } = liveState;

  const analysisState = useAnalysis({
    id, cook, cookStatus, probeState,
    liveReadings, lastCheckin, weather: useAmbientWeather(),
    pendingWrapClearRef,
  });
  const {
    qpMethod, setQpMethod, qpStartTemp, setQpStartTemp, qpInjection, setQpInjection,
    qpSpritz, setQpSpritz, qpWrap, setQpWrap,
    activeCookNoteTags, setActiveCookNoteTags, cookNotes, setCookNotes,
    images, pickImages, takePhoto, removeImage,
    result, analyzing, expandedRationale, setExpandedRationale,
    showSecondaryDecisions, setShowSecondaryDecisions,
    analyze, autoGradePaused, lastAnalyzedAtMs, onUpgradeAutoGradePress,
    storedAnalysis, storedAssessment, storedVerdictCfg, storedGraphProbes,
    cardWidth, onCardLayout,
  } = analysisState;

  const weather = useAmbientWeather();
  const [fGradeQuip, setFGradeQuip] = useState<string | null>(null);
  const [proactiveCoachingNote, setProactiveCoachingNote] = useState<string | null>(null);
  const proactiveAlerts = useProactiveAlerts();
  useEffect(() => { proactiveAlerts.reset(); }, [id]);
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      if (data.proactiveAlert === true && String(data.cookId) === String(id)) {
        setProactiveCoachingNote(typeof data.alertMessage === "string" ? data.alertMessage : "PitMaster detected a deviation in your cook.");
      }
    });
    return () => sub.remove();
  }, [id]);

  // ── Background AI refinement indicator ────────────────────────────────────
  const cookIdNum = Number(id) || 0;
  const [bgAiRefining, setBgAiRefining] = useState(() => isBgRefining(cookIdNum));
  useEffect(() => {
    setBgAiRefining(isBgRefining(cookIdNum));
    return subscribeBgRefining(() => setBgAiRefining(isBgRefining(cookIdNum)));
  }, [cookIdNum]);

  // ── Auto-update when background AI refinement completes ───────────────────
  // When fireBgAiRefine (plan.tsx) finishes patching the cook record it fires
  // notifyBgAiRefined for this cookId. We respond by invalidating the cook
  // query with the default refetchType:'active', which triggers an immediate
  // refetch so the timeline, factors, and "refining" indicator update in-place
  // without the user needing to pull-to-refresh.
  // The Plan tab is unaffected because it doesn't call onBgAiRefined and is
  // unlikely to have an active observer for this specific cook's query key.
  useEffect(() => {
    if (!cookIdNum) return;
    return onBgAiRefined(cookIdNum, () => {
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(cookIdNum) });
    });
  }, [cookIdNum, qc]);

  // ── Toast state ────────────────────────────────────────────────────────────
  const [checkinSavedToast, setCheckinSavedToast] = useState<string | null>(null);
  const [autoCheckinToast, setAutoCheckinToast] = useState<string | null>(null);
  const checkinSavedToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoCheckinToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Screen visibility tracking ─────────────────────────────────────────────
  useEffect(() => {
    const numId = Number(id);
    setCookDetailVisible(true);
    setCurrentCookId(isNaN(numId) ? null : numId);
    return () => { setCookDetailVisible(false); setCurrentCookId(null); };
  }, [id]);

  // ── Notification hooks ─────────────────────────────────────────────────────
  useScheduleStepNotifications(Number(id) || null, cookStatus, cookSeqData);
  useFrozenStageNotifications(
    Number(id) || null,
    cookStatus,
    cookSeqData as any,
    c.plannedStartAt ?? null,
    c.actualThawStartAt ?? null,
    c.actualStartAt ?? null,
  );
  useSpritzNotifications(
    Number(id) || null,
    cookStatus,
    c.spritzFrequency ?? null,
    c.foodType ?? null,
    cookSeqData as any,
  );

  const storedScheduledCheckins = useCheckinNotifications(
    Number(id) || null,
    cookStatus,
    cookSeqData,
  );

  useCookLiveActivity({
    cookId: cook?.id ?? null,
    status: cook?.status ?? null,
    meatLabel: cook?.foodType ?? "Cook",
    startedAtIso: cook?.actualStartAt ?? null,
    currentTempF: selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? selectedInkbirdProbe?.tempF ?? null,
    targetTempF: cook?.targetTempF ?? null,
    cookTempF: selectedMeaterProbe?.ambientTempF ?? cook?.cookTempF ?? null,
  });

  // ── Auto-scroll refs ───────────────────────────────────────────────────────
  const scheduleScrollViewRef = useRef<ScrollView>(null);
  const scheduleListYRef = useRef<number>(0);
  const itemYRef = useRef<Record<number, number>>({});
  const timelineYRef = useRef<Record<number, number>>({});
  const rowYRef = useRef<Record<string, number>>({});

  // ── Derived values ─────────────────────────────────────────────────────────
  const cookSeqMeatOnMs: number | null = cookSeqData?.schedule?.[0]?.meatOnAt
    ? new Date(cookSeqData.schedule[0].meatOnAt as string).getTime() : null;
  const effectiveMeatOnMs: number | null = (() => {
    if (cookSeqMeatOnMs == null) return null;
    const actualThawMs = (cook as any)?.actualThawStartAt ? new Date((cook as any).actualThawStartAt).getTime() : null;
    const plannedThawMs = cookSeqData?.frozen?.thawStartAt ? new Date(cookSeqData.frozen.thawStartAt as string).getTime() : null;
    if (actualThawMs != null && plannedThawMs != null) return cookSeqMeatOnMs + (actualThawMs - plannedThawMs);
    return cookSeqMeatOnMs;
  })();
  const actualStartMs = cook?.actualStartAt ? new Date(cook.actualStartAt).getTime() : null;
  const isMeatOn =
    (actualStartMs != null && actualStartMs <= nowMs) ||
    effectiveMeatOnMs == null ||
    effectiveMeatOnMs <= nowMs;

  const nextStep = useMemo(() => computeNextStep(cookSeqData, cookStatus, nowMs), [cookSeqData, cookStatus, nowMs]);
  const nextStepKey = nextStep ? `${nextStep.itemIdx}:${nextStep.step}` : null;
  const nextStepItemIdx = nextStep ? nextStep.itemIdx : null;
  const prevNextStepKeyRef = useRef<string | null | undefined>(undefined);

  const estimatedFinishMs = useMemo(() => {
    if (wrapAdjustedFinishMs != null) return wrapAdjustedFinishMs;
    const lower = (cook as any)?.finishTimeRangeLower;
    const upper = (cook as any)?.finishTimeRangeUpper;
    if (lower && upper) return (new Date(lower).getTime() + new Date(upper).getTime()) / 2;
    const seqFinish = cookSeqData?.schedule?.[0]?.estimatedFinishAt;
    return seqFinish ? new Date(seqFinish as string).getTime() : null;
  }, [wrapAdjustedFinishMs, cook, cookSeqData]);

  const nextSpritzMs = cookStatus === "active" ? computeNextSpritzMs(c.spritzFrequency ?? null, cookSeqData as any, nowMs) : null;
  const elapsedAnchorMs = isMeatOn && cook?.actualStartAt ? new Date(cook.actualStartAt).getTime() : null;
  const elapsedMs = elapsedAnchorMs !== null ? nowMs - elapsedAnchorMs : 0;
  const remainingMs = estimatedFinishMs != null ? estimatedFinishMs - nowMs : null;

  const activeProbeName = (selectedMeatProbeId && probeLabels[selectedMeatProbeId])
    ? probeLabels[selectedMeatProbeId]
    : selectedMeaterProbe?.deviceName ?? selectedBleContextDevice?.name ?? selectedLanProbe?.deviceName ?? selectedInkbirdProbe?.deviceName ?? "Probe";
  const activePitProbeName = (selectedPitProbeId && probeLabels[selectedPitProbeId])
    ? probeLabels[selectedPitProbeId] : "Pit / Ambient";

  const liveGraphProbes = useMemo(() => {
    if (tempMode === "probe" && selectedMeatProbeId != null && liveReadings.length >= 2) {
      return [
        { probeName: activeProbeName, timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1]!.tempF },
        ...(livePitReadings.length >= 2 ? [{ probeName: activePitProbeName, timeSeries: livePitReadings, finishingTempF: livePitReadings[livePitReadings.length - 1]!.tempF }] : []),
      ];
    }
    if (tempMode === "manual" && liveReadings.length >= 2) {
      return [{ probeName: "Manual entries", timeSeries: liveReadings, finishingTempF: liveReadings[liveReadings.length - 1]!.tempF }];
    }
    return [];
  }, [tempMode, selectedMeatProbeId, liveReadings, livePitReadings, activeProbeName, activePitProbeName]);

  const effectiveStoredGraphProbes = useMemo(() =>
    storedGraphProbes.length > 0 ? storedGraphProbes : completedCookReadingsProbes,
  [storedGraphProbes, completedCookReadingsProbes]);

  const { nextCheckinMs, nextCheckinLabel, nextCheckinSc, upcomingCheckinsForCard } = useMemo(() => {
    const hasPlan = (cookSeqData?.schedule?.length ?? 0) > 0;
    const upcoming = (hasPlan && storedScheduledCheckins.length > 0 ? storedScheduledCheckins : noPlanScheduledCheckins)
      .filter((sc: ScheduledCheckin) => sc.scheduledAt > nowMs);
    const next = upcoming[0] ?? null;
    return { nextCheckinMs: next?.scheduledAt ?? null, nextCheckinLabel: next?.phaseLabel ?? null, nextCheckinSc: next, upcomingCheckinsForCard: upcoming.slice(1, 5) };
  }, [cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, nowMs]);

  const plannedSequenceCheckins = useMemo<ScheduledCheckin[]>(() => {
    if (cookStatus !== "planned") return [];
    const first = cookSeqData?.schedule?.[0];
    if (!first?.meatOnAt || !first?.estimatedFinishAt) return [];
    const meatOnAtMs = new Date(first.meatOnAt).getTime();
    const estimatedFinishAtMs = new Date(first.estimatedFinishAt).getTime();
    if (estimatedFinishAtMs <= meatOnAtMs) return [];
    const anchor: CheckinSequenceAnchor = { meatOnAt: first.meatOnAt, estimatedFinishAt: first.estimatedFinishAt, wrapAtMinutes: first.wrapAtMinutes ?? null };
    return generateCheckinSchedule(first.foodType ?? null, meatOnAtMs, estimatedFinishAtMs, anchor, typeof first.weightLbs === "number" ? first.weightLbs : null);
  }, [cookStatus, cookSeqData]);

  const handlePitMasterCheckIn = useCallback(() => {
    const hasPlan = (cookSeqData?.schedule?.length ?? 0) > 0;
    const upcoming = (hasPlan && storedScheduledCheckins.length > 0 ? storedScheduledCheckins : noPlanScheduledCheckins)
      .filter((sc: ScheduledCheckin) => sc.scheduledAt > nowMs);
    const targetSc = pendingCheckinSc ?? upcoming[0] ?? null;
    if (targetSc) { openCheckin(targetSc); }
    else {
      const schedule = getCheckinSchedule((cook as any)?.foodType ?? null);
      const phase = schedule.phases[0];
      openCheckin({ id: `manual_${Date.now()}`, phaseKey: phase.key, phaseLabel: phase.label, scheduledAt: Date.now(), phase });
    }
    setPendingCheckinSc(null);
  }, [cook, cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, nowMs, pendingCheckinSc, openCheckin, setPendingCheckinSc]);

  const handleCheckInNext = useCallback(() => {
    if (nextCheckinSc) openCheckin(nextCheckinSc);
    else handlePitMasterCheckIn();
  }, [nextCheckinSc, openCheckin, handlePitMasterCheckIn]);

  const handleCheckinSaved = useCallback((savedInternalTempF: number | null) => {
    if (savedInternalTempF != null && tempMode === "manual" && cook?.actualStartAt) {
      const startMs = new Date(cook.actualStartAt).getTime();
      const elapsedMins = Math.round(Math.max(0, (Date.now() - startMs) / 60000) * 10) / 10;
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
      const completedKeys = new Set((cookCheckins as CookCheckin[]).map((ci) => ci.phaseKey).filter((k): k is string => k != null));
      if (activeCheckin?.phaseKey) completedKeys.add(activeCheckin.phaseKey);
      const adaptiveTemp = savedInternalTempF ?? selectedMeaterProbe?.internalTempF ?? selectedThermoworksProbe?.tempF ?? null;
      rescheduleCheckinNotifications({ cookId: Number(id), foodType: first.foodType ?? null, weightLbs: cook?.weightLbs ?? null, meatOnAt: first.meatOnAt, estimatedFinishAt: first.estimatedFinishAt, wrapAtMinutes: first.wrapAtMinutes ?? null, completedPhaseKeys: completedKeys, actualInternalTempF: adaptiveTemp, aiCheckins: cookSeqData?.aiCheckins ?? null }).catch(() => {});
    }
  }, [tempMode, cook, setLiveReadings, liveReadingsSeededRef, checkinSavedToastTimerRef, setCheckinSavedToast, pendingWrapClearRef, qc, id, cookSeqData, cookCheckins, activeCheckin, selectedMeaterProbe, selectedThermoworksProbe, rescheduleCheckinNotifications]);

  // ── toggleConfirmedStep wrapping wrapTempPending ───────────────────────────
  const toggleConfirmedStep = useCallback(async (key: string) => {
    const sep = key.indexOf("_");
    const itemIdx = sep >= 0 ? parseInt(key.slice(0, sep), 10) : -1;
    const step = sep >= 0 ? key.slice(sep + 1) : key;
    const isConfirming = !confirmedSteps[key];
    if (isConfirming && step === "wrap" && cookSeqData?.schedule?.[itemIdx]) { setWrapTempPending({ key, itemIdx }); return; }
    _toggleConfirmedStep(key);
  }, [confirmedSteps, cookSeqData, setWrapTempPending, _toggleConfirmedStep]);

  // ── Auto-scroll on next step change ───────────────────────────────────────
  useEffect(() => {
    if (!nextStepKey || nextStepItemIdx === null) return;
    setSeqScheduleExpanded(true);
    const timer = setTimeout(() => {
      const rowY = rowYRef.current[nextStepKey];
      if (rowY === undefined) return;
      const targetY = scheduleListYRef.current + (itemYRef.current[nextStepItemIdx] ?? 0) + (timelineYRef.current[nextStepItemIdx] ?? 0) + rowY - 80;
      scheduleScrollViewRef.current?.scrollTo({ y: Math.max(0, targetY), animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [nextStepKey, nextStepItemIdx]);

  useEffect(() => {
    if (prevNextStepKeyRef.current === undefined) { prevNextStepKeyRef.current = nextStepKey; return; }
    const prev = prevNextStepKeyRef.current;
    prevNextStepKeyRef.current = nextStepKey;
    if (nextStepKey === prev || !nextStepKey || cookStatus !== "active") return;
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [nextStepKey, cookStatus]);

  // ── Deep-link handlers ────────────────────────────────────────────────────
  useFocusEffect(useCallback(() => {
    const cookIdNum = Number(id);
    qc.invalidateQueries({ queryKey: getGetCookQueryKey(cookIdNum) });
  }, [id, qc]));

  useFocusEffect(useCallback(() => {
    const pending = consumePendingCheckin();
    if (!pending || pending.cookId !== Number(id)) return;
    const phase = getCheckinSchedule(cook?.foodType).phases.find((p) => p.key === pending.phaseKey) ?? getCheckinSchedule(null).phases[0];
    const sc: ScheduledCheckin = { id: `${pending.phaseKey}_deeplink`, phaseKey: pending.phaseKey, phaseLabel: pending.phaseLabel, scheduledAt: pending.scheduledAt, phase };
    if (pending.autoOpen) openCheckin(sc); else setPendingCheckinSc(sc);
  }, [id, cook?.foodType, openCheckin, setPendingCheckinSc]));

  useCheckinDeepLink(Number(id) || null, useCallback((data) => {
    const phase = getCheckinSchedule(cook?.foodType).phases.find((p) => p.key === data.phaseKey) ?? getCheckinSchedule(null).phases[0];
    setPendingCheckinSc({ id: `${data.phaseKey}_deeplink`, phaseKey: data.phaseKey, phaseLabel: data.phaseLabel, scheduledAt: data.scheduledAt, phase });
  }, [cook?.foodType, setPendingCheckinSc]));

  // ── Auto check-in ─────────────────────────────────────────────────────────
  useAutoCheckin({
    cookId: Number(id) || null, cookStatus,
    scheduledCheckins: storedScheduledCheckins,
    existingCheckins: cookCheckins as CookCheckin[],
    probeReading: autoCheckinProbeReading,
    onAutoCheckinFired: ({ phaseLabel, internalTempF }) => {
      const msg = `Check-in recorded automatically — ${Math.round(internalTempF)}°F at ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
      setAutoCheckinToast(msg);
      if (autoCheckinToastTimerRef.current) clearTimeout(autoCheckinToastTimerRef.current);
      autoCheckinToastTimerRef.current = setTimeout(() => setAutoCheckinToast(null), 5000);
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
      qc.invalidateQueries({ queryKey: getListCookCheckinsQueryKey(Number(id)) });
      qc.invalidateQueries({ queryKey: getGetCookHealthQueryKey(Number(id)) });
      const first = cookSeqData?.schedule?.[0];
      if (first?.meatOnAt && first?.estimatedFinishAt) {
        const completedKeys = new Set((cookCheckins as CookCheckin[]).map((ci) => ci.phaseKey).filter((k): k is string => k != null));
        rescheduleCheckinNotifications({ cookId: Number(id), foodType: first.foodType ?? null, weightLbs: cook?.weightLbs ?? null, meatOnAt: first.meatOnAt, estimatedFinishAt: first.estimatedFinishAt, wrapAtMinutes: first.wrapAtMinutes ?? null, completedPhaseKeys: completedKeys, actualInternalTempF: internalTempF, aiCheckins: cookSeqData?.aiCheckins ?? null }).catch(() => {});
      }
    },
  });

  // ── Start cook phase ───────────────────────────────────────────────────────
  const startCookPhase: "thawing" | "tempering" | "ready" | null = (() => {
    const frozenInfo = cookSeqData?.frozen;
    if (!c.fromFrozen || !frozenInfo?.thawStartAt) return null;
    const thawEndMs = frozenInfo.thawEndAt ? new Date(frozenInfo.thawEndAt).getTime() : null;
    const preheatStartMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
    if (thawEndMs != null && nowMs < thawEndMs) return "thawing";
    if (preheatStartMs != null && nowMs < preheatStartMs) return "tempering";
    return "ready";
  })();
  const startCookLabel = startCookPhase === "thawing" ? "Begin Thawing" : startCookPhase === "tempering" ? "Meat is Thawed — Start Preheat" : "Start Cook";
  const startCookIcon = startCookPhase === "thawing" ? "thermometer" : startCookPhase === "tempering" ? "wind" : "play";
  const startCookCaption = (() => {
    if (startCookPhase === "thawing") { const t = c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : null; return t ? `Marks the start of your thaw timer. The grill goes on at ${t}.` : "Marks the start of your thaw timer."; }
    if (startCookPhase === "tempering") return "Meat is thawed — let it temper before lighting the grill.";
    if (startCookPhase === "ready") return null;
    const meatOnAt = cookSeqData?.schedule?.[0]?.meatOnAt;
    if (meatOnAt) return `Starts your preheat timer. Meat on at ${new Date(meatOnAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
    return "Marks this cook as active and starts your session timer.";
  })();

  // ── Early returns ──────────────────────────────────────────────────────────
  if (isLoading && !cook) {
    return <View style={[s.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}><ActivityIndicator color={colors.primary} /></View>;
  }
  if (!cook) {
    return <View style={[s.container, { backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }]}><Text style={{ color: colors.mutedForeground }}>Cook not found.</Text></View>;
  }

  const saveTechnique = async (data: any) => {
    await updateCook.mutateAsync({ id: Number(id), data });
    await qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
  };

  const currentPitTempF = tempMode === "probe"
    ? ((selectedMeaterPitProbe != null && selectedMeaterPitProbe.deviceId !== selectedMeaterProbe?.deviceId ? selectedMeaterPitProbe.internalTempF ?? null : selectedMeaterProbe?.ambientTempF ?? null) ?? (selectedThermoworksPitProbe != null ? (selectedThermoworksPitProbe as any).tempF ?? null : null) ?? selectedInkbirdPitProbe?.tempF ?? (selectedBleContextPitDevice != null && selectedBleContextPitDevice.id !== selectedBleContextDevice?.id ? selectedBleContextPitDevice.probeTempF ?? null : selectedBleContextDevice?.ambientTempF ?? null) ?? (selectedLanPitProbe != null && selectedLanPitProbe.deviceId !== selectedLanProbe?.deviceId ? selectedLanPitProbe.probeTempF ?? null : selectedLanProbe?.ambientTempF ?? null))
    : null;

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <LinearGradient colors={["#1C1C1F", "#2D1A0E"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.header, { paddingTop: topPad + 14 }]}>
        <LogoBackground opacity={0.06} />
        <Pressable onPress={goBack} style={s.backBtn}><Feather name="chevron-left" size={24} color="#F3EDE1" /></Pressable>
        <Text style={s.headerTitle} numberOfLines={1}>{c.foodType || "Cook"}</Text>
        <View style={s.headerRight}>
          {cookStatus === "active" && <Pressable onPress={() => setEditTimesVisible(true)} style={[s.editBtn, { marginRight: 2 }]} hitSlop={8}><Feather name="clock" size={17} color="#F3EDE1" /></Pressable>}
          <Pressable onPress={openEdit} style={s.editBtn} hitSlop={8}><Feather name="edit-2" size={17} color="#F3EDE1" /></Pressable>
          <Pressable onPress={handleDelete} style={s.delBtn}><Feather name="trash-2" size={18} color="#ef4444" /></Pressable>
          <Pressable onPress={goHome} hitSlop={8}><Image source={logoImg} style={s.headerLogo} resizeMode="contain" /></Pressable>
        </View>
      </LinearGradient>
      <View style={s.fireBar} />

      <NextUpBanner nextStep={nextStep} cookSeqData={cookSeqData} nowMs={nowMs} />

      {cookStatus === "active" && (() => {
        const finishAt = cookSeqData?.schedule?.[0]?.estimatedFinishAt as string | null | undefined;
        if (!finishAt) return null;
        const finishMs = new Date(finishAt).getTime();
        if (finishMs > nowMs + 10 * 60_000) return null;
        return (
          <View style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 2, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F9731618", borderWidth: 1, borderColor: "#F9731660", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
            <Feather name="alert-triangle" size={14} color="#F97316" />
            <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#F97316" }}>Cook may already be done — check your grill.</Text>
          </View>
        );
      })()}

      {bgAiRefining && (
        <View style={{ marginHorizontal: 16, marginTop: 6, marginBottom: 2, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#6C3BF510", borderWidth: 1, borderColor: "#6C3BF540", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }}>
          <ActivityIndicator size="small" color="#6C3BF5" />
          <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#6C3BF5" }}>PitMaster is analyzing your cook…</Text>
        </View>
      )}

      <ScrollView ref={scheduleScrollViewRef} contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={isTablet ? { width: "100%", maxWidth: detailMaxWidth, alignSelf: "center", gap: 16 } : null}>
          <CookStatusSection
            c={c} cook={cook} colors={colors} cookStatus={cookStatus} statusColor={statusColor}
            id={id!} dismissCookOutlier={dismissCookOutlier}
            checkinsLoading={checkinsLoading} cookCheckins={cookCheckins as any[]}
            firstCheckinNudgeDismissed={firstCheckinNudgeDismissed}
            setFirstCheckinNudgeDismissed={setFirstCheckinNudgeDismissed}
            openCheckin={openCheckin} cookSeqData={cookSeqData}
            effectiveMeatOnMs={effectiveMeatOnMs} nowMs={nowMs}
            handleMarkThawStarted={handleMarkThawStarted} markingThaw={markingThaw}
          />

          <LiveProbeSection
            cookStatus={cookStatus} c={c}
            selectedMeaterProbe={selectedMeaterProbe}
            selectedThermoworksProbe={selectedThermoworksProbe}
            cookCurrentTempF={cookCurrentTempF}
            selectedBleContextDevice={selectedBleContextDevice}
            selectedLanProbe={selectedLanProbe}
            selectedInkbirdProbe={selectedInkbirdProbe}
          />

          <CookAnalysisSection
            colors={colors} cookStatus={cookStatus} cookId={Number(id)} isMeatOn={isMeatOn}
            checkinCount={(cookCheckins as CookCheckin[]).length}
            lastDecision={cookStatus === "active" ? (c.analysisResult?.decisions?.[0] ?? null) : null}
            onGradeChange={(grade, quip) => { if (cookStatus === "active") setFGradeQuip(grade === "F" ? quip : null); }}
            proactiveCoachingNote={proactiveCoachingNote}
            setProactiveCoachingNote={setProactiveCoachingNote}
            fGradeQuip={fGradeQuip}
          />

          <LiveCookSection
            c={c} colors={colors} weather={weather} meaterLinked={meaterLinked} meaterProbes={meaterProbes}
            thermoworksLinked={thermoworksLinked} thermoworksProbes={thermoworksProbes}
            inkbirdProbes={inkbirdProbes} bleContextDevices={bleContextDevices} lanProbes={lanProbes}
            autoAssignBanner={autoAssignBanner} onDismissAutoAssignBanner={() => setAutoAssignBanner(null)}
            reconnectBanner={reconnectBanner} onDismissReconnectBanner={dismissReconnectBanner}
            tempMode={tempMode} onSetTempMode={setTempMode}
            selectedMeatProbeId={selectedMeatProbeId} selectedPitProbeId={selectedPitProbeId}
            meatProbeSlots={meatProbeSlots} onAddMeatProbeSlot={handleAddMeatProbeSlot} onRemoveMeatProbeSlot={handleRemoveMeatProbeSlot}
            onSelectMeatProbe={handleSelectMeatProbe} onSelectPitProbe={handleSelectPitProbe}
            probeLabels={probeLabels} onSetProbeLabel={handleSetProbeLabel}
            otherCookAssignments={otherCookAssignments}
            inkbirdScanning={inkbirdScanning} inkbirdReconnecting={combinedReconnecting}
            liveGraphProbes={liveGraphProbes} liveReadings={liveReadings}
            cardWidth={cardWidth} elapsedMs={elapsedMs} remainingMs={remainingMs}
            estimatedFinishMs={estimatedFinishMs} nowMs={nowMs}
            targetTempF={c.targetTempF ?? null} cookTempF={c.cookTempF ?? null}
            nextSpritzMs={nextSpritzMs} isMeatOn={isMeatOn}
            pitMasterResult={result} pitMasterAnalyzing={analyzing}
            renderDecisions={(decisions: Decision[]) => <DecisionsSection decisions={decisions} colors={colors} expandedRationale={expandedRationale} setExpandedRationale={setExpandedRationale} showSecondaryDecisions={showSecondaryDecisions} setShowSecondaryDecisions={setShowSecondaryDecisions} />}
            onCheckIn={handlePitMasterCheckIn} onCheckInNext={handleCheckInNext}
            onOpenChat={() => setChatModalVisible(true)}
            lastAnalyzedAtMs={lastAnalyzedAtMs}
            lastCheckinInternalTempF={lastCheckin?.internalTempF ?? null}
            onRefresh={() => analyze()}
            activeProbeName={activeProbeName !== "Probe" ? activeProbeName : null}
            activePitProbeName={activePitProbeName !== "Pit / Ambient" ? activePitProbeName : undefined}
            currentInternalTempF={autoCheckinProbeReading?.internalTempF ?? null}
            currentPitTempF={autoCheckinProbeReading?.pitTempF ?? null}
            nextCheckinMs={nextCheckinMs} nextCheckinLabel={nextCheckinLabel}
            upcomingCheckins={upcomingCheckinsForCard} onCheckInPhase={openCheckin}
            knownProbeIds={knownProbeIds} lastKnownInkbirdDeviceId={lastKnownInkbirdDeviceId}
            onRestartScan={handleRestartScan} hasActiveProbe={hasActiveProbe}
            factorBreakdown={cookSeqData?.factorBreakdown ?? null}
            planTimedOut={cookSeqData?.planTimedOut ?? null}
            qualFactors={qualFactors}
          />

          <CookSummaryCard c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
            healthGrade={(() => { const stored: string | null | undefined = (c as any).healthScore; if (stored) return stored; const verdict: string | undefined = (c as any).analysisResult?.assessment?.verdict; return verdict !== undefined ? letterGrade(VERDICT_SCORE[verdict] ?? 50) : null; })()}
            rating={(() => { const liveVals = [rateTenderness, rateFlavor, rateBark].filter((v) => v > 0); if (liveVals.length > 0) return liveVals.reduce((a, b) => a + b, 0) / liveVals.length; const r = (c as any).rating; return typeof r === "number" && r > 0 ? r : null; })()}
          />

          {cookStatus === "planned" && (
            <>
              <Pressable style={({ pressed }) => [s.actionBtn, { backgroundColor: STATUS_COLORS["active"] || colors.primary, borderRadius: colors.radius, marginTop: 4 }, (updateCook.isPending || pressed) && { opacity: 0.7 }]} onPress={() => handleStatusUpdate("active")} disabled={updateCook.isPending}>
                {updateCook.isPending ? <ActivityIndicator color="#fff" /> : <><Feather name={startCookIcon as any} size={18} color="#fff" /><Text style={s.actionText}>{startCookLabel}</Text></>}
              </Pressable>
              {startCookCaption && <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", marginTop: 6, paddingHorizontal: 8, lineHeight: 17 }}>{startCookCaption}</Text>}
            </>
          )}

          {cookStatus === "planned" && !(cook as any)?.sessionId && (
            <Pressable onPress={() => setAddToSessionOpen(true)} style={({ pressed }) => [{ flexDirection: "row" as const, alignItems: "center" as const, gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, paddingHorizontal: 16, paddingVertical: 13, marginTop: 8, opacity: pressed ? 0.7 : 1 }]}>
              <Feather name="plus-circle" size={16} color={colors.primary} /><Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground, flex: 1 }}>Add to planned cook</Text><Feather name="chevron-right" size={14} color={colors.mutedForeground} />
            </Pressable>
          )}

          <TechniquesSection
            c={c} colors={colors} id={id!}
            techsExpanded={techsExpanded} setTechsExpanded={setTechsExpanded}
            techMethodSheetOpen={techMethodSheetOpen} setTechMethodSheetOpen={setTechMethodSheetOpen}
            techInjectionSheetOpen={techInjectionSheetOpen} setTechInjectionSheetOpen={setTechInjectionSheetOpen}
            techSpritzSheetOpen={techSpritzSheetOpen} setTechSpritzSheetOpen={setTechSpritzSheetOpen}
            techWrapFinishSheetOpen={techWrapFinishSheetOpen} setTechWrapFinishSheetOpen={setTechWrapFinishSheetOpen}
            saveTechnique={saveTechnique} updateCookMutate={updateCook.mutateAsync}
          />

          <CookTimelineSection
            c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs} id={id}
            cookSeqData={cookSeqData} nextStep={nextStep}
            seqScheduleExpanded={seqScheduleExpanded} setSeqScheduleExpanded={setSeqScheduleExpanded}
            confirmedSteps={confirmedSteps} toggleConfirmedStep={toggleConfirmedStep}
            scheduleListYRef={scheduleListYRef} itemYRef={itemYRef} timelineYRef={timelineYRef} rowYRef={rowYRef}
            handleLogFuelEvent={handleLogFuelEvent as ((event: string) => void) | undefined}
            storedScheduledCheckins={storedScheduledCheckins} noPlanScheduledCheckins={noPlanScheduledCheckins}
            removedPlannedKeys={removedPlannedKeys} cookCheckins={cookCheckins as CookCheckin[]}
            checkinsLoading={checkinsLoading} openCheckin={openCheckin} nextCheckinSc={nextCheckinSc}
            setPlannedCheckinPreviewSc={setPlannedCheckinPreviewSc} plannedSequenceCheckins={plannedSequenceCheckins}
            estimatedFinishMs={estimatedFinishMs} storedAnalysis={storedAnalysis}
            storedAssessment={storedAssessment} storedVerdictCfg={storedVerdictCfg}
            effectiveStoredGraphProbes={effectiveStoredGraphProbes as ProbeTimeSeries[]}
            cardWidth={cardWidth} isIdentityLinked={isIdentityLinked} effectivePro={effectivePro}
            showPaywall={showPaywall} onCardLayout={onCardLayout}
            expandedStoredSections={expandedStoredSections} toggleStoredSection={toggleStoredSection}
            liveReadings={liveReadings} completedCookReadingsProbes={completedCookReadingsProbes}
            probeIntervalMs={probeIntervalMs}
            setRemovedPlannedKeys={setRemovedPlannedKeys}
            cancelCheckinNotificationForPhase={cancelCheckinNotificationForPhase}
          />

          <Cook2NudgeBanner cookStatus={cookStatus} colors={colors} effectivePro={effectivePro} showPaywall={showPaywall as any} foodType={cook?.foodType ?? null} />

          <RateThisCook c={c} colors={colors} rateTenderness={rateTenderness} setRateTenderness={setRateTenderness} rateFlavor={rateFlavor} setRateFlavor={setRateFlavor} rateBark={rateBark} setRateBark={setRateBark} rateSaving={rateSaving} saveRatings={saveRatings} />
          <ShareCookButton cook={c} colors={colors} />

          {nextStatus && cookStatus !== "planned" && (
            <Pressable style={({ pressed }) => [s.actionBtn, { backgroundColor: statusColor, borderRadius: colors.radius }, (updateCook.isPending || pressed) && { opacity: 0.7 }]} onPress={() => handleStatusUpdate(nextStatus)} disabled={updateCook.isPending}>
              {updateCook.isPending ? <ActivityIndicator color="#fff" /> : <><Feather name={nextStatus === "active" ? "play" : "check-circle"} size={18} color="#fff" /><Text style={s.actionText}>{nextStatus === "active" ? "Start Cook" : "Mark Complete"}</Text></>}
            </Pressable>
          )}
          <Pressable onPress={goHome} style={s.homeLink}><Feather name="home" size={14} color={colors.mutedForeground} /><Text style={[s.homeLinkText, { color: colors.mutedForeground }]}>Back to Home</Text></Pressable>
        </View>
      </ScrollView>

      {/* ── Sheets & Modals ────────────────────────────────────────────────── */}
      <CookModals
        cookStatus={cookStatus} cookSeqData={cookSeqData} cook={cook} id={id!}
        colors={colors} insets={insets} grills={grills}
        wrapTempPending={wrapTempPending} confirmWrap={confirmWrap}
        addToSessionOpen={addToSessionOpen} setAddToSessionOpen={setAddToSessionOpen}
        editVisible={editVisible} setEditVisible={setEditVisible}
        editGrillPickerVisible={editGrillPickerVisible} setEditGrillPickerVisible={setEditGrillPickerVisible}
        editFoodType={editFoodType} setEditFoodType={setEditFoodType}
        editWeight={editWeight} setEditWeight={setEditWeight}
        editCookTemp={editCookTemp} setEditCookTemp={setEditCookTemp}
        editTargetTemp={editTargetTemp} setEditTargetTemp={setEditTargetTemp}
        editGrillId={editGrillId} setEditGrillId={setEditGrillId}
        editActualStartDate={editActualStartDate} setEditActualStartDate={setEditActualStartDate}
        editActualEndDate={editActualEndDate} setEditActualEndDate={setEditActualEndDate}
        editStartDateOpen={editStartDateOpen} setEditStartDateOpen={setEditStartDateOpen}
        editStartTimeOpen={editStartTimeOpen} setEditStartTimeOpen={setEditStartTimeOpen}
        editEndDateOpen={editEndDateOpen} setEditEndDateOpen={setEditEndDateOpen}
        editEndTimeOpen={editEndTimeOpen} setEditEndTimeOpen={setEditEndTimeOpen}
        editDates={editDates} editNotes={editNotes} setEditNotes={setEditNotes}
        editCookingMethod={editCookingMethod} setEditCookingMethod={setEditCookingMethod}
        editInjection={editInjection} setEditInjection={setEditInjection}
        editSpritzFrequency={editSpritzFrequency} setEditSpritzFrequency={setEditSpritzFrequency}
        editWrapFinish={editWrapFinish} setEditWrapFinish={setEditWrapFinish}
        editSaving={editSaving} editSelectedGrill={editSelectedGrill} saveEdit={saveEdit}
        editTimesVisible={editTimesVisible} setEditTimesVisible={setEditTimesVisible}
        editTimesSaving={editTimesSaving} handleSaveCookTimes={handleSaveCookTimes}
        checkinSavedToast={checkinSavedToast} setCheckinSavedToast={setCheckinSavedToast}
        autoCheckinToast={autoCheckinToast} setAutoCheckinToast={setAutoCheckinToast}
        inkbirdToastMounted={inkbirdToastMounted} inkbirdToastAnim={inkbirdToastAnim}
        setInkbirdReconnectToast={setInkbirdReconnectToast}
        bleReconnectToast={bleReconnectToast} setBleReconnectToast={setBleReconnectToast}
        activeCheckin={activeCheckin} checkinModalVisible={checkinModalVisible}
        setCheckinModalVisible={setCheckinModalVisible}
        currentPitTempF={currentPitTempF} tempMode={tempMode}
        selectedMeaterProbe={selectedMeaterProbe}
        selectedThermoworksProbe={selectedThermoworksProbe}
        selectedInkbirdProbe={selectedInkbirdProbe}
        selectedBleContextDevice={selectedBleContextDevice}
        selectedLanProbe={selectedLanProbe}
        weather={weather} cookCheckins={cookCheckins as CookCheckin[]}
        onCheckinSaved={handleCheckinSaved}
        onRequestAnalyze={async (opts) => { await analyze({ extraNotes: opts?.notes || undefined, checkinOverride: { internalTempF: opts?.internalTempF ?? null, pitTempF: opts?.pitTempF ?? null } }); }}
        result={result}
        plannedCheckinPreviewSc={plannedCheckinPreviewSc}
        setPlannedCheckinPreviewSc={setPlannedCheckinPreviewSc}
        chatModalVisible={chatModalVisible} setChatModalVisible={setChatModalVisible}
        showRatingPrompt={showRatingPrompt} rateSaving={rateSaving}
        saveRatings={saveRatings} setShowRatingPrompt={setShowRatingPrompt}
      />
    </View>
  );
}
