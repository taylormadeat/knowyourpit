import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { fmtMinutes } from "@/utils/duration";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  scheduleFrozenStageNotifications,
  cancelStoredFrozenNotifications,
} from "@/hooks/useFrozenStageNotifications";
import {
  scheduleStepNotifications,
  cancelStoredStepNotifications,
} from "@/hooks/useScheduleStepNotifications";
import { EditCookTimesSheet } from "@/components/cook-detail/EditCookTimesSheet";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import {
  useListGrills,
  useCreateCook,
  useUpdateCook,
  useDeleteCook,
  useGetCook,
  useAiPredict,
  useAiMultiCook,
  useListCooks,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  getGetCookQueryKey,
  ListCooksStatus,
  type Cook,
  type MultiCookScheduleItem,
} from "@workspace/api-client-react";
import { NextUpBanner, getStepTargetMs } from "@/components/NextUpBanner";
import { computeNextStep } from "@/components/cook-detail/utils";
import { fmtRemaining } from "@/components/cook-detail/CookProgressBar";
import type { SequenceData, FactorBreakdownItem } from "@/components/cook-detail/types";
import { CookFactorsSheet, type QualFactor } from "@/components/CookFactorsSheet";
import { useAmbientWeather, weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import {
  MEAT_CUTS,
  MEAT_CATEGORIES,
  MEAT_CUTS_BY_CATEGORY,
  type MeatCut,
} from "@/constants/meatCuts";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_MEAT_START_TEMPS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
  type QpCookMethod,
  type QpInjectionOption,
  type QpMeatStartTemp,
  type QpSpritzFrequency,
  type QpWrapFinishOption,
} from "@/constants/cookQuickPicks";
import { useMeaterReadings, type MeaterProbe } from "@/hooks/useMeaterReadings";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import { useEffectivePro } from "@/hooks/useEffectivePro";

import { planStyles as s, probeCardStyles as sp } from "@/components/plan-screen/styles";
import { PitMasterChatModal } from "@/components/PitMasterChatModal";
import {
  getUpcomingDates,
  formatDate,
  formatTime,
  formatDateTime,
  preheatMinsForGrill,
  fmtDuration,
  fmtElapsedPlan,
  fmtFromNow,
  TIME_SLOTS,
} from "@/components/plan-screen/utils";
import {
  type ThawMethod,
  calcSchedule,
} from "@/components/plan-screen/frozenSchedule";
import {
  getMeatPrep,
} from "@/components/plan-screen/prepGuides";
import { Label, StatCell, ScheduleRow } from "@/components/plan-screen/MiniRows";
import { SizeInputRow, SizeInputRowOutput } from "@/components/plan-screen/SizeInputRow";
import { SettingsRow } from "@/components/plan-screen/SettingsRow";
import { OptionBottomSheet } from "@/components/plan-screen/OptionBottomSheet";
import { MeatPickerModal } from "@/components/plan-screen/MeatPickerModal";
import { DatePickerModal, TimePickerModal } from "@/components/plan-screen/DateTimePickerModals";
import { AiResultsModal } from "@/components/plan-screen/AiResultsModal";
import { MultiCookResultModal } from "@/components/plan-screen/MultiCookResultModal";
import { MultiCookAddItemModal, type MultiItem } from "@/components/plan-screen/MultiCookAddItemModal";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";

const COOK_METHOD_STORAGE_PREFIX = "@knowyourpit:cookMethod:";
const MEAT_START_TEMP_STORAGE_PREFIX = "@knowyourpit:meatStartTemp:";
const INJECTION_STORAGE_PREFIX = "@knowyourpit:injection:";
const SPRITZ_STORAGE_PREFIX = "@knowyourpit:spritz:";
const WRAP_FINISH_STORAGE_PREFIX = "@knowyourpit:wrapFinish:";

async function loadLastCookMethod(cutName: string): Promise<QpCookMethod | null> {
  try {
    const stored = await AsyncStorage.getItem(COOK_METHOD_STORAGE_PREFIX + cutName);
    if (stored && (QP_COOK_METHODS as readonly string[]).includes(stored)) {
      return stored as QpCookMethod;
    }
  } catch {}
  return null;
}

async function saveLastCookMethod(cutName: string, method: QpCookMethod): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_METHOD_STORAGE_PREFIX + cutName, method);
  } catch {}
}

async function loadLastMeatStartTemp(cutName: string): Promise<QpMeatStartTemp | null> {
  try {
    const stored = await AsyncStorage.getItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName);
    if (stored && (QP_MEAT_START_TEMPS as readonly string[]).includes(stored)) return stored as QpMeatStartTemp;
  } catch {}
  return null;
}
async function saveLastMeatStartTemp(cutName: string, v: QpMeatStartTemp): Promise<void> {
  try { await AsyncStorage.setItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastInjection(cutName: string): Promise<QpInjectionOption | null> {
  try {
    const stored = await AsyncStorage.getItem(INJECTION_STORAGE_PREFIX + cutName);
    if (stored && (QP_INJECTION_OPTIONS as readonly string[]).includes(stored)) return stored as QpInjectionOption;
  } catch {}
  return null;
}
async function saveLastInjection(cutName: string, v: QpInjectionOption): Promise<void> {
  try { await AsyncStorage.setItem(INJECTION_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastSpritz(cutName: string): Promise<QpSpritzFrequency | null> {
  try {
    const stored = await AsyncStorage.getItem(SPRITZ_STORAGE_PREFIX + cutName);
    if (stored && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(stored)) return stored as QpSpritzFrequency;
  } catch {}
  return null;
}
async function saveLastSpritz(cutName: string, v: QpSpritzFrequency): Promise<void> {
  try { await AsyncStorage.setItem(SPRITZ_STORAGE_PREFIX + cutName, v); } catch {}
}

async function loadLastWrapFinish(cutName: string): Promise<QpWrapFinishOption | null> {
  try {
    const stored = await AsyncStorage.getItem(WRAP_FINISH_STORAGE_PREFIX + cutName);
    if (stored && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(stored)) return stored as QpWrapFinishOption;
  } catch {}
  return null;
}
async function saveLastWrapFinish(cutName: string, v: QpWrapFinishOption): Promise<void> {
  try { await AsyncStorage.setItem(WRAP_FINISH_STORAGE_PREFIX + cutName, v); } catch {}
}

export default function PlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();
  const updateCook = useUpdateCook();
  const deleteCook = useDeleteCook();

  // ── Replan mode ────────────────────────────────────────────────────────
  // When the cook detail screen navigates here with ?replanCookId=<n> the
  // Plan screen runs in "replan" mode: handleSubmit UPDATES the identified
  // planned cook in place rather than creating a new one. The existing
  // actualThawStartAt is forwarded into scheduleFrozenStageNotifications so
  // the 30-min thaw-end warning is re-armed against the new thawEndAt.
  const { replanCookId: replanCookIdParam } = useLocalSearchParams<{ replanCookId?: string }>();
  const replanCookIdNum: number | null = replanCookIdParam ? Number(replanCookIdParam) : null;
  const { data: replanCookData } = useGetCook(replanCookIdNum!, {
    query: {
      queryKey: getGetCookQueryKey(replanCookIdNum!),
      enabled: !!replanCookIdNum,
    },
  });
  const replanActualThawStartAt: string | null =
    replanCookIdNum && replanCookData
      ? ((replanCookData as any).actualThawStartAt
          ? new Date((replanCookData as any).actualThawStartAt).toISOString()
          : null)
      : null;
  const replanSeqData: SequenceData | null =
    replanCookIdNum && replanCookData
      ? ((replanCookData as { sequenceData?: SequenceData | null } | undefined)?.sequenceData ?? null)
      : null;

  const { data: activeCooks } = useListCooks({ status: ListCooksStatus.active });
  const activeCook: Cook | null = activeCooks?.[0] ?? null;

  const { data: plannedCooks } = useListCooks({ status: ListCooksStatus.planned });

  // Edit times sheet (correct active cook timestamps)
  const [editTimesVisible, setEditTimesVisible] = useState(false);
  const [editTimesSaving, setEditTimesSaving] = useState(false);

  const handleSaveCookTimes = async (meatOnAt: Date, thawStartAt: Date | null) => {
    if (!activeCook) return;
    setEditTimesSaving(true);
    try {
      const payload: Record<string, unknown> = {
        actualStartAt: meatOnAt.toISOString(),
      };
      if (thawStartAt !== null) {
        payload.actualThawStartAt = thawStartAt.toISOString();
      }
      const updated = await updateCook.mutateAsync({ id: activeCook.id, data: payload as any });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(activeCook.id) });
      qc.invalidateQueries({ queryKey: ["home", "insights"] });
      setEditTimesVisible(false);
      // Use the freshly returned schedule from the server — not the stale local state.
      const freshSchedule =
        ((updated as any)?.sequenceData as SequenceData | undefined)?.schedule ??
        activeSeqData?.schedule;
      if (freshSchedule?.length) {
        cancelStoredStepNotifications(activeCook.id).catch(() => {});
        scheduleStepNotifications(activeCook.id, freshSchedule, () => true).catch(() => {});
      }
    } catch {
      Alert.alert("Save failed", "Could not update cook times. Please try again.");
    } finally {
      setEditTimesSaving(false);
    }
  };

  const [bannerNowMs, setBannerNowMs] = useState(Date.now());
  // ── Soft post-plan tip card ──
  // After a free user plans a cook AND already had 1+ cooks logged, surface
  // an inline (non-blocking) tip card promoting Multi-Cook Sequencer instead
  // of an alert. `multi_cook_nudge_dismissed` in AsyncStorage suppresses it
  // permanently after dismissal.
  const [showMultiCookTip, setShowMultiCookTip] = useState(false);
  const [multiCookTipFood, setMultiCookTipFood] = useState<string | null>(null);
  // `null` = AsyncStorage hasn't resolved yet → suppress the tip until we
  // know whether the user previously dismissed it. This guarantees a
  // dismissed user never sees the tip a second time, even if they plan a
  // cook within the first few ms after mount.
  const [multiCookTipDismissed, setMultiCookTipDismissed] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("multi_cook_nudge_dismissed")
      .then((v) => { if (!cancelled) setMultiCookTipDismissed(v === "1"); })
      .catch(() => { if (!cancelled) setMultiCookTipDismissed(false); });
    return () => { cancelled = true; };
  }, []);
  const bannerTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // The Cook type from the API client doesn't include the `sequenceData` JSON
  // field, so narrow with a cast for the bits we actually use here (matches
  // the same pattern in the cook detail screen).
  const activeSeqData =
    (activeCook as { sequenceData?: SequenceData | null } | null | undefined)
      ?.sequenceData ?? null;

  const activeNextStep = useMemo(
    () => computeNextStep(activeSeqData, activeCook?.status, bannerNowMs),
    [activeSeqData, activeCook?.status, bannerNowMs],
  );

  // Adaptive tick rate: when the next step is more than 90s out, a 30s tick
  // is plenty for the "in Xh Ym" / "in Xm" countdown plus the elapsed-minutes
  // display. Inside the last 90 seconds we tick every second so the banner can
  // switch to "in Xs" and count down smoothly without ever skipping.
  const nextStepRemainingMs =
    activeNextStep != null
      ? (() => {
          const target = getStepTargetMs(activeSeqData, activeNextStep);
          return target == null ? null : target - bannerNowMs;
        })()
      : null;
  const tickIntervalMs =
    nextStepRemainingMs != null && nextStepRemainingMs < 90_000 ? 1000 : 30_000;

  useEffect(() => {
    if (activeCook) {
      setBannerNowMs(Date.now());
      bannerTimerRef.current = setInterval(() => setBannerNowMs(Date.now()), tickIntervalMs);
    } else {
      if (bannerTimerRef.current) {
        clearInterval(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    }
    return () => {
      if (bannerTimerRef.current) {
        clearInterval(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    };
  }, [activeCook?.id, tickIntervalMs]);

  const activeCookMeatOnMs = useMemo(() => {
    const meatOnAt = activeSeqData?.schedule?.[0]?.meatOnAt;
    return meatOnAt ? new Date(meatOnAt as string).getTime() : null;
  }, [activeSeqData]);

  const activeCookIsMeatOn = activeCookMeatOnMs == null || activeCookMeatOnMs <= bannerNowMs;

  // Anchor elapsed to meatOnAt (same as cook-list cards) so the banner doesn't
  // inflate "time on the smoker" with thaw/preheat time for frozen cooks.
  const activeElapsedMs = (() => {
    if (!activeCook) return 0;
    if (!activeCookIsMeatOn) return 0; // meat not yet on — hide elapsed
    if (activeCookMeatOnMs != null) return bannerNowMs - activeCookMeatOnMs;
    if (activeCook.actualStartAt) return bannerNowMs - new Date(activeCook.actualStartAt).getTime();
    return 0;
  })();

  const activeCookRemainingLabel = useMemo(() => {
    const seqFinish = activeSeqData?.schedule?.[0]?.estimatedFinishAt;
    const rawFinish = seqFinish ?? activeCook?.plannedEndAt ?? null;
    if (!rawFinish) return null;
    const finishMs = new Date(rawFinish).getTime();
    const overMs = Math.max(0, bannerNowMs - finishMs);
    const remainingMs = Math.max(0, finishMs - bannerNowMs);
    const isOver = bannerNowMs >= finishMs;
    return fmtRemaining(remainingMs, isOver, overMs);
  }, [activeSeqData, activeCook?.plannedEndAt, bannerNowMs]);

  // ── Form state ───────────────────────────────────────────────────────
  const [cookName, setCookName] = useState("");
  const [selectedCut, setSelectedCut] = useState<MeatCut | null>(null);
  const [sizeOutput, setSizeOutput] = useState<SizeInputRowOutput>({
    effectiveWeightLbs: null,
    sizingLabel: null,
    isEstimated: false,
    pieceCount: null,
    mode: "weight",
  });
  const [grillId, setGrillId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [targetTempF, setTargetTempF] = useState("");
  const [cookTempF, setCookTempF] = useState("");

  // ── Frozen-to-table planning ─────────────────────────────────────────
  const [frozenEnabled, setFrozenEnabled] = useState(false);
  const [thawMethod, setThawMethod] = useState<ThawMethod>("fridge");
  // Tracks whether this user already burned their lifetime free trial of the
  // Frozen-to-Table planner during the current cook draft. Once consumed, we
  // allow toggling on/off freely without re-charging the lifetime counter.
  const [frozenConsumedThisCook, setFrozenConsumedThisCook] = useState(false);
  const [frozenConsumePending, setFrozenConsumePending] = useState(false);
  const { getToken } = useAuth();

  // ── Serve-by picker state ────────────────────────────────────────────
  const upcomingDates = useMemo(() => getUpcomingDates(), []);
  const defaultServeAt = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(18, 0, 0, 0);
    return d;
  }, []);
  const [serveAt, setServeAt] = useState<Date | null>(null);
  const [cookNowMode, setCookNowMode] = useState<"now" | "later">("now");
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // ── Meat picker state ────────────────────────────────────────────────
  const [meatPickerOpen, setMeatPickerOpen] = useState(false);
  const [meatCategory, setMeatCategory] = useState<string>(MEAT_CATEGORIES[0]);
  const [prepGuideOpen, setPrepGuideOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // ── MEATER probe picker state ─────────────────────────────────────────
  const [selectedProbeId, setSelectedProbeId] = useState<string | null>(null);
  const { data: meaterData } = useMeaterReadings();
  const activeProbes: MeaterProbe[] = meaterData?.linked ? (meaterData.probes ?? []) : [];

  const selectProbe = (probe: MeaterProbe) => {
    if (selectedProbeId === probe.deviceId) {
      setSelectedProbeId(null);
      return;
    }
    setSelectedProbeId(probe.deviceId);
    if (probe.targetMaxTempF != null && !targetTempF.trim()) {
      setTargetTempF(String(probe.targetMaxTempF));
    }
    if (probe.cookName && !cookName.trim()) {
      setCookName(probe.cookName);
    }
  };

  // ── Plan mode ─────────────────────────────────────────────────────────
  const [planMode, setPlanMode] = useState<"single" | "multi">("single");

  // ── Pro / paywall plumbing (declared before weather so the forecast hook
  //     can be gated on entitlement). ─────────────────────────────────────
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();
  const effectivePro = useEffectivePro();

  // ── Weather ───────────────────────────────────────────────────────────
  // Weather is a Pro-only feature. Free users never trigger a location request
  // and receive no weather data whatsoever. Pro users planning a same-day cook
  // see current conditions; a future cook date gets the daily forecast for
  // that specific day.
  const isFutureCookDay = useMemo(() => {
    if (!serveAt) return false;
    const now = new Date();
    return !(
      serveAt.getFullYear() === now.getFullYear() &&
      serveAt.getMonth() === now.getMonth() &&
      serveAt.getDate() === now.getDate()
    ) && serveAt.getTime() > now.getTime();
  }, [serveAt]);
  const weatherTargetDate = isFutureCookDay ? serveAt : null;
  const weather = useAmbientWeather(weatherTargetDate, { enabled: effectivePro });

  // ── AI predict state ──────────────────────────────────────────────────
  const aiPredict = useAiPredict();
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiResultOpen, setAiResultOpen] = useState(false);
  const [factorsSheetOpen, setFactorsSheetOpen] = useState(false);
  const [planChatOpen, setPlanChatOpen] = useState(false);
  const [planChatSeed, setPlanChatSeed] = useState<string | undefined>(undefined);
  // AI schedule overrides: set when the user applies a PitMaster plan,
  // cleared when they change the cut, weight, or grill.
  const [aiCookMins, setAiCookMins] = useState<number | null>(null);
  const [aiPreheatMins, setAiPreheatMins] = useState<number | null>(null);
  const clearAiScheduleOverride = () => { setAiCookMins(null); setAiPreheatMins(null); };
  // Use this for all user-initiated serve-time changes (date/time picker, clear
  // button, Cook-Now toggle). The AI apply path uses raw setServeAt directly so
  // it does not clear the overrides it just set.
  const setServeAtManual = (d: Date | null) => { clearAiScheduleOverride(); setServeAt(d); };

  // ── Technique quick-picks (carried into AI prediction) ────────────────
  const [qpCookMethod, setQpCookMethod] = useState<QpCookMethod | null>(null);
  const [lastUsedCookMethod, setLastUsedCookMethod] = useState<QpCookMethod | null>(null);
  const [qpMeatStartTemp, setQpMeatStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [lastUsedMeatStartTemp, setLastUsedMeatStartTemp] = useState<QpMeatStartTemp | null>(null);
  const [qpInjection, setQpInjection] = useState<QpInjectionOption | null>(null);
  const [lastUsedInjection, setLastUsedInjection] = useState<QpInjectionOption | null>(null);
  const [qpSpritz, setQpSpritz] = useState<QpSpritzFrequency | null>(null);
  const [lastUsedSpritz, setLastUsedSpritz] = useState<QpSpritzFrequency | null>(null);
  const [qpWrapFinish, setQpWrapFinish] = useState<QpWrapFinishOption | null>(null);
  const [lastUsedWrapFinish, setLastUsedWrapFinish] = useState<QpWrapFinishOption | null>(null);

  // On mount: restore the last-used technique quick-picks so the user's
  // preferred options are already selected when they open the Plan screen.
  // Each value is validated against its current option set so a stale entry
  // from an older app version never injects an unknown option into state.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem("plan_technique_qp")
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          const saved = JSON.parse(raw);
          if (cancelled) return;
          if (saved.cookMethod && (QP_COOK_METHODS as readonly string[]).includes(saved.cookMethod))
            setQpCookMethod(saved.cookMethod as QpCookMethod);
          if (saved.meatStartTemp && (QP_MEAT_START_TEMPS as readonly string[]).includes(saved.meatStartTemp))
            setQpMeatStartTemp(saved.meatStartTemp as QpMeatStartTemp);
          if (saved.injection && (QP_INJECTION_OPTIONS as readonly string[]).includes(saved.injection))
            setQpInjection(saved.injection as QpInjectionOption);
          if (saved.spritz && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(saved.spritz))
            setQpSpritz(saved.spritz as QpSpritzFrequency);
          if (saved.wrapFinish && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(saved.wrapFinish))
            setQpWrapFinish(saved.wrapFinish as QpWrapFinishOption);
        } catch {
          // corrupt storage — ignore
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // ── Advanced Options bottom-sheet state ───────────────────────────────
  type AdvSheet = "cookMethod" | "meatStartTemp" | "injection" | "spritz" | "wrapFinish" | "thawMethod" | "notes";
  const [activeSheet, setActiveSheet] = useState<AdvSheet | null>(null);
  const [notesSheetDraft, setNotesSheetDraft] = useState("");

  // ── Multi-cook state ──────────────────────────────────────────────────
  const aiMultiCook = useAiMultiCook();

  // Mount-time gate: if the user has hit the total cook cap, fire the paywall
  // immediately so the form is never usable when it can't succeed.
  useEffect(() => {
    if (paywallUsage && !paywallUsage.unlimited && paywallUsage.remaining.cooks <= 0) {
      showPaywall({ trigger: "cook_limit_reached" });
    }
  }, [paywallUsage]);
  const [multiItems, setMultiItems] = useState<MultiItem[]>([]);
  const [multiResult, setMultiResult] = useState<{ schedule: MultiCookScheduleItem[]; serveAt: string; summary: string } | null>(null);
  const [multiResultOpen, setMultiResultOpen] = useState(false);
  const [multiAddOpen, setMultiAddOpen] = useState(false);
  const [multiAddCat, setMultiAddCat] = useState<string>(MEAT_CATEGORIES[0]);
  const [multiAddWeightInput, setMultiAddWeightInput] = useState("");
  const [multiPickedCut, setMultiPickedCut] = useState<MeatCut | null>(null);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);

  // ── Form reset helpers ───────────────────────────────────────────────
  // Called after a successful save so the next visit feels like a fresh
  // planning session. `grillId` and `planMode` are intentionally preserved.
  const resetForm = () => {
    setCookName("");
    setSelectedCut(null);
    setSizeOutput({ effectiveWeightLbs: null, sizingLabel: null, isEstimated: false, pieceCount: null, mode: "weight" });
    setNotes("");
    setTargetTempF("");
    setCookTempF("");
    setServeAt(null);
    clearAiScheduleOverride();
    setCookNowMode("now");
    setAiResult(null);
    setAiResultOpen(false);
    setSelectedProbeId(null);
    setPrepGuideOpen(false);
    setAdvancedOpen(false);
    setMeatPickerOpen(false);
    setMeatCategory(MEAT_CATEGORIES[0]);
    setFrozenEnabled(false);
    setFrozenConsumedThisCook(false);
    setThawMethod("fridge");
  };

  const resetMultiForm = () => {
    setMultiItems([]);
    setMultiResult(null);
    setMultiResultOpen(false);
    setMultiAddOpen(false);
    setMultiAddCat(MEAT_CATEGORIES[0]);
    setMultiAddWeightInput("");
    setMultiPickedCut(null);
  };

  // Multi-cook mode requires a serve time.
  // When the user switches to that mode, initialize serveAt if not yet set.
  useEffect(() => {
    if (planMode === "multi" && !serveAt) {
      setServeAt(defaultServeAt);
    }
  }, [planMode]);

  // ── Derived values ───────────────────────────────────────────────────
  const selectedGrill = useMemo(
    () => (grills as any[] | undefined)?.find((g: any) => g.id === grillId) ?? null,
    [grills, grillId]
  );

  // Clear AI schedule overrides when the user picks a different grill,
  // since preheat time and cook calibration are grill-specific.
  useEffect(() => { clearAiScheduleOverride(); }, [grillId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-compute per-schedule-item grill labels using a consume-splice pattern
  // so duplicate food types each resolve to their own distinct grill.
  // Falls back to the screen-level default grillId (same logic as handleSaveMultiCooks).
  const scheduleGrillLabels = useMemo<(string | null)[]>(() => {
    if (!multiResult) return [];
    const remaining = [...multiItems];
    return multiResult.schedule.map((item) => {
      const normalised = item.foodType.trim().toLowerCase();
      const idx = remaining.findIndex((mi) => mi.cut.name.trim().toLowerCase() === normalised);
      const matched = idx >= 0 ? remaining.splice(idx, 1)[0] : undefined;
      const resolvedGrillId = matched?.grillId ?? grillId ?? null;
      if (resolvedGrillId == null) return null;
      const grill = (grills as any[] | undefined)?.find((g: any) => g.id === resolvedGrillId) ?? null;
      return grill?.name ?? null;
    });
  }, [multiResult, multiItems, grillId, grills]);

  const effectiveWeightLbs = sizeOutput.effectiveWeightLbs ?? 0;
  const schedule = useMemo(() => {
    if (!selectedCut || effectiveWeightLbs <= 0 || !serveAt) return null;
    return calcSchedule(
      serveAt,
      selectedCut,
      effectiveWeightLbs,
      selectedGrill,
      { enabled: frozenEnabled, method: thawMethod },
      {
        cookMinsOverride: aiCookMins ?? undefined,
        preheatMinsOverride: aiPreheatMins ?? undefined,
      },
    );
  }, [selectedCut, effectiveWeightLbs, serveAt, selectedGrill, frozenEnabled, thawMethod, aiCookMins, aiPreheatMins]);

  // Edge case: if frozen toggle is on and the calculated thaw start is in the
  // past, the serve time is too soon for a full thaw. We surface a warning
  // and recommend cold-water (or moving the serve time later).
  const frozenStartInPast =
    !!schedule?.frozen && schedule.frozen.thawStartAt.getTime() < Date.now();

  // Edge case: the thaw window is long enough that it extends past the preheat
  // start — the meat won't be fully thawed before the grill needs to light.
  // This can happen even when thawStartAt is in the future if the serve time
  // is set less than (thawMins + temperMins + preheatMins + cookMins + restMins)
  // from now. Show an amber warning distinct from frozenStartInPast.
  const frozenThawOverlapsGrill =
    !!schedule?.frozen &&
    !frozenStartInPast &&
    schedule.frozen.thawEndAt.getTime() > schedule.startAt.getTime();

  // True while "Begin Thawing Now" is the user's chosen action; false once
  // the pitmaster switches intent to "Save Cook Plan". Drives callout visibility.
  // Resets to true whenever the user re-enters the frozen + Cook Now state.
  const [showBeginThawCallout, setShowBeginThawCallout] = React.useState(true);
  React.useEffect(() => {
    if (frozenEnabled && cookNowMode === "now") {
      setShowBeginThawCallout(true);
    }
  }, [frozenEnabled, cookNowMode]);

  // When user picks a meat cut, auto-fill temps and restore per-cut quick-picks
  const handlePickCut = (cut: MeatCut) => {
    setSelectedCut(cut);
    setTargetTempF(String(cut.targetTempF));
    setCookTempF(String(cut.cookTempF));
    clearAiScheduleOverride();
    setMeatPickerOpen(false);
    setPrepGuideOpen(false);
    // Load the last-used quick-pick settings for this cut and pre-select them.
    loadLastCookMethod(cut.name).then(method => {
      setQpCookMethod(method);
      setLastUsedCookMethod(method);
    });
    loadLastMeatStartTemp(cut.name).then(v => { setQpMeatStartTemp(v); setLastUsedMeatStartTemp(v); });
    loadLastInjection(cut.name).then(v => { setQpInjection(v); setLastUsedInjection(v); });
    loadLastSpritz(cut.name).then(v => { setQpSpritz(v); setLastUsedSpritz(v); });
    loadLastWrapFinish(cut.name).then(v => { setQpWrapFinish(v); setLastUsedWrapFinish(v); });
  };

  // ── AI Plan ──────────────────────────────────────────────────────────
  const handleAiPlan = async () => {
    if (!selectedCut) {
      Alert.alert("Select a Meat Cut First", "Choose a meat cut so PitMaster can tailor the plan.");
      return;
    }
    try {
      const result = await aiPredict.mutateAsync({
        data: {
          foodType: selectedCut.name,
          weightLbs: effectiveWeightLbs > 0 ? effectiveWeightLbs : undefined,
          cookTempF: cookTempF ? Number(cookTempF) : selectedCut.cookTempF,
          targetTempF: targetTempF ? Number(targetTempF) : selectedCut.targetTempF,
          grillId: grillId ?? undefined,
          desiredFinishAt: serveAt ? serveAt.toISOString() : undefined,
          preheatMinutes: preheatMinsForGrill(selectedGrill),
          outdoorTempF: weather.tempF ?? undefined,
          outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
          fromFrozen: frozenEnabled || undefined,
          thawMethod: frozenEnabled ? thawMethod : undefined,
          cookingMethod: qpCookMethod ?? undefined,
          meatStartTemp: qpMeatStartTemp ?? undefined,
          injection: qpInjection ?? undefined,
          spritzFrequency: qpSpritz ?? undefined,
          wrapFinish: qpWrapFinish ?? undefined,
          notes: notes.trim() || undefined,
          pieceCount: sizeOutput.pieceCount ?? undefined,
          isIndividualCook: selectedCut.isIndividualCook ?? undefined,
          sizingLabel: sizeOutput.sizingLabel ?? undefined,
        },
      });
      setAiResult(result);
      setAiResultOpen(true);
    } catch (e: any) {
      Alert.alert("PitMaster Error", e?.message || "Could not get PitMaster prediction. Try again.");
    }
  };

  // ── Multi-Cook Sequence ───────────────────────────────────────────────
  const handleMultiCook = async () => {
    // Pro-only (or unlocked when the kill switch is off). Pre-check before
    // hitting the server so we can show a richer paywall modal context.
    if (!effectivePro) {
      showPaywall({ trigger: "pro_required", featureName: "Multi-Cook Sequencer" });
      return;
    }
    if (multiItems.length < 2) {
      Alert.alert("Add More Items", "Add at least 2 items to sequence a multi-cook.");
      return;
    }
    try {
      const result = await aiMultiCook.mutateAsync({
        data: {
          items: multiItems.map(item => {
            const itemGrill = item.grillId != null
              ? ((grills as any[] | undefined)?.find((g: any) => g.id === item.grillId) ?? null)
              : selectedGrill;
            return {
              foodType: item.cut.name,
              weightLbs: parseFloat(item.weightLbs) > 0 ? parseFloat(item.weightLbs) : undefined,
              cookTempF: item.cut.cookTempF,
              targetTempF: item.cut.targetTempF,
              grillId: item.grillId ?? grillId ?? undefined,
              preheatMinutes: preheatMinsForGrill(itemGrill),
              cookingMethod: item.cookMethod ?? undefined,
              fromFrozen: item.isFrozen || undefined,
              thawMethod: item.isFrozen ? item.thawMethod : undefined,
              notes: item.notes || undefined,
            };
          }),
          serveAt: (serveAt ?? defaultServeAt).toISOString(),
          outdoorTempF: weather.tempF ?? undefined,
          outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
          notes: notes.trim() || undefined,
        },
      });
      setMultiResult(result as any);
      setMultiResultOpen(true);
    } catch (e: any) {
      // 402 (pro_required) shouldn't happen post-effectivePro check, but a stale
      // entitlement state is possible. Fall through to the modal in that case.
      if (parseAndShowFromError(e)) return;
      Alert.alert("PitMaster Error", e?.message || "Could not sequence cooks. Try again.");
    }
  };

  const handleSaveMultiCooks = async () => {
    if (!multiResult) return;
    try {
      const sessionId = Crypto.randomUUID();
      const remainingItems = [...multiItems];
      for (const item of multiResult.schedule) {
        const matchedCut = MEAT_CUTS.find(c => c.name.toLowerCase() === item.foodType.toLowerCase());

        const inputIdx = remainingItems.findIndex(m => m.cut.name.toLowerCase() === item.foodType.toLowerCase());
        const inputItem: MultiItem | undefined = inputIdx >= 0 ? remainingItems.splice(inputIdx, 1)[0] : undefined;
        const inputWeightLbs = inputItem ? parseFloat(inputItem.weightLbs) || undefined : undefined;
        const resolvedGrillId = inputItem?.grillId ?? grillId ?? undefined;

        const wrapMethodDb =
          item.wrapMethod === "foil" ? "foil"
          : item.wrapMethod === "butcher_paper" ? "butcher_paper"
          : item.wrapMethod === "none" ? "none"
          : undefined;

        const noteHeader = `Multi-cook session · Serve at ${new Date(multiResult.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        const noteParts: string[] = [noteHeader];
        if (item.notes) noteParts.push(item.notes);
        if (item.wrapReason && wrapMethodDb && wrapMethodDb !== "none") noteParts.push(`Wrap: ${item.wrapReason}`);

        await createCook.mutateAsync({
          data: {
            foodType: item.foodType,
            weightLbs: inputWeightLbs,
            cookTempF: matchedCut?.cookTempF ?? undefined,
            targetTempF: matchedCut?.targetTempF ?? undefined,
            grillId: resolvedGrillId ?? undefined,
            plannedStartAt: new Date(item.meatOnAt),
            sessionId,
            notes: noteParts.join("\n"),
            ...(wrapMethodDb !== undefined && { wrapMethod: wrapMethodDb }),
            ...(item.wrapAtMinutes && item.wrapAtMinutes > 0 && { wrapAtMinutes: Math.round(item.wrapAtMinutes) }),
            ...(item.wrapTempF && { wrapTempF: Math.round(item.wrapTempF) }),
            ...(item.wrapReason && { wrapReason: item.wrapReason }),
            ...(inputItem?.isFrozen && { fromFrozen: true, thawMethod: inputItem.thawMethod }),
            sequenceData: {
              schedule: multiResult.schedule,
              serveAt: multiResult.serveAt,
              summary: (multiResult as any).summary ?? null,
            },
          } as any,
        });
      }
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["home", "insights"] });
      resetMultiForm();
      resetForm();
      setPlanMode("single");
      router.push("/(tabs)/cooks");
    } catch (e: any) {
      // Free user hit the cook cap mid-multi-save → paywall.
      if (parseAndShowFromError(e)) return;
      Alert.alert("Error", e?.message || "Failed to save cooks.");
    }
  };

  const applyAiPlan = () => {
    if (!aiResult) return;
    if (aiResult.serveAt) setServeAt(new Date(aiResult.serveAt));
    if (typeof aiResult.estimatedDurationMinutes === "number") {
      setAiCookMins(aiResult.estimatedDurationMinutes);
    }
    if (typeof aiResult.preheatMinutes === "number") {
      setAiPreheatMins(aiResult.preheatMinutes);
    }
    setAiResultOpen(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────
  // modeOverride: when "later" is passed the function behaves as if
  // cookNowMode === "later" regardless of current state — used by the
  // secondary "Save Cook Plan" button in frozen Cook Now mode.
  const handleSubmit = async (modeOverride?: "later") => {
    const effectiveCookNowMode = modeOverride ?? cookNowMode;

    if (!selectedCut) {
      Alert.alert("Required", "Please select a meat cut");
      return;
    }
    // Free-tier pre-checks — fire paywall before any API work. Pass the
    // currently-selected food type so the paywall can personalize copy
    // (e.g. "Want to log this brisket cook?").
    // Replan mode updates an existing cook in place — no new slot consumed.
    if (!replanCookIdNum && paywallUsage && !paywallUsage.unlimited) {
      if (paywallUsage.remaining.cooks <= 0) {
        showPaywall({
          trigger: "cook_limit_reached",
          foodType: selectedCut?.name ?? null,
        });
        return;
      }
      if (effectiveCookNowMode === "later" && paywallUsage.usage.plannedCooks >= 1) {
        showPaywall({
          trigger: "planned_cook_limit_reached",
          foodType: selectedCut?.name ?? null,
        });
        return;
      }
    }
    const preheatMins = preheatMinsForGrill(selectedGrill);
    const wrap = aiResult?.wrap ?? null;

    // Map AI wrap method string → DB enum value
    const wrapMethodDb: "foil" | "butcher_paper" | "none" | undefined =
      wrap?.method === "foil" ? "foil"
      : wrap?.method === "butcher_paper" ? "butcher_paper"
      : wrap?.method === "none" ? "none"
      : undefined;

    // Prefer AI grill-light time for plannedStartAt, fall back to local schedule
    const plannedStart: Date | undefined =
      aiResult?.grillLightAt ? new Date(aiResult.grillLightAt)
      : schedule?.startAt ?? undefined;

    // Prefer AI rest recommendation, fall back to cut default
    const restMins: number = wrap?.restMinutes > 0 ? wrap.restMinutes : selectedCut.restMins;

    // Build notes — AI rationale + tips appended after user notes
    const noteParts: string[] = [];
    if (cookName) noteParts.push(`Name: ${cookName}`);
    if (selectedCut.cookMethod) noteParts.push(`Method: ${selectedCut.cookMethod}`);
    if (notes.trim()) noteParts.push(notes.trim());
    if (aiResult?.rationale) noteParts.push(`PitMaster Analysis:\n${aiResult.rationale}`);
    if (aiResult?.tips?.length) {
      noteParts.push(`Pit Master Tips:\n${(aiResult.tips as string[]).map((t, i) => `${i + 1}. ${t}`).join("\n")}`);
    }

    // Persist Frozen-to-Table thaw/temper times in sequenceData so the cook
    // detail screen can re-schedule notifications later (e.g. after edits).
    const frozenForCook = schedule?.frozen
      ? {
          method: schedule.frozen.method,
          thawStartAt: schedule.frozen.thawStartAt.toISOString(),
          // thawEndAt === temperStartAt by construction; one timestamp covers both.
          thawEndAt: schedule.frozen.thawEndAt.toISOString(),
          foodType: selectedCut.name,
        }
      : null;

    // Before creating a new frozen cook, check whether the pitmaster already
    // has a planned frozen cook for the same food type + grill. If so, ask
    // whether to replace (delete the old record) or keep both.
    let shouldReplaceStale = false;
    if (frozenForCook && !replanCookIdNum) {
      const stalePlannedFrozen = (plannedCooks ?? []).filter(
        (c: Cook & { fromFrozen?: boolean }) =>
          c.fromFrozen &&
          c.foodType === selectedCut.name &&
          (grillId == null || c.grillId === grillId),
      );
      if (stalePlannedFrozen.length > 0) {
        shouldReplaceStale = await new Promise<boolean>((resolve) => {
          Alert.alert(
            `Existing ${selectedCut.name} Plan`,
            `You already have a planned ${selectedCut.name} cook. Replace it with the new plan, or keep both?`,
            [
              { text: "Keep Both", style: "cancel", onPress: () => resolve(false) },
              { text: "Replace", style: "destructive", onPress: () => resolve(true) },
            ],
          );
        });
      }
    }

    try {
      // ── UPDATE path (replan mode) ─────────────────────────────────────
      // When replanCookId is set the Plan screen was opened from a planned
      // frozen cook's detail screen via the "Adjust Timing" button. We patch
      // the existing cook's timing + frozen schedule rather than creating a
      // new one, then reschedule notifications so the 30-min "almost thawed"
      // warning fires against the new thawEndAt using the cook's existing
      // actualThawStartAt as the trigger flag.
      if (replanCookIdNum) {
        // Was this cook frozen before this edit? Used to decide whether we need
        // to clear sequenceData.frozen and fromFrozen in the DB.
        const wasFrozen = !!(replanSeqData?.frozen);

        // Build sequenceData: update frozen timing when still frozen, or
        // explicitly null it out so the hook doesn't reschedule stale alerts.
        // Also carry forward any AI fingerprint adjustment so the callout
        // remains visible after a replan.
        const hasFingerprint =
          aiResult?.fingerprintSource === "grill" ||
          aiResult?.fingerprintSource === "user";
        const updatedFrozenSeqData: SequenceData = {
          ...(replanSeqData ?? ({} as SequenceData)),
          ...(frozenForCook ? { frozen: frozenForCook } : { frozen: null }),
          ...(hasFingerprint
            ? { fingerprintSource: aiResult!.fingerprintSource, fingerprintNote: aiResult!.fingerprintNote ?? null }
            : {}),
          ...(aiResult?.factorBreakdown?.length ? { factorBreakdown: aiResult.factorBreakdown } : {}),
        };
        await updateCook.mutateAsync({
          id: replanCookIdNum,
          data: {
            ...(serveAt && { plannedEndAt: serveAt }),
            ...(plannedStart && { plannedStartAt: plannedStart }),
            // Persist sequenceData when: frozen state is changing, or an AI
            // fingerprint adjustment needs to be recorded.
            ...((frozenForCook || wasFrozen || hasFingerprint) && { sequenceData: updatedFrozenSeqData }),
            // When the pitmaster removes the frozen flag, clear it in the DB so
            // useFrozenStageNotifications no longer sees this as a frozen cook
            // and doesn't re-schedule the cancelled notifications on remount.
            ...(!frozenForCook && wasFrozen ? { fromFrozen: false } : {}),
          } as any,
        });
        // Cancel stale IDs keyed to this cook. If the cook is still frozen
        // (just with updated timing/method), re-arm with the new schedule.
        // Passing the existing actualThawStartAt ensures the 30-min warning
        // is re-scheduled against the new thawEndAt — which is the fix for
        // task #784's re-plan scenario.
        await cancelStoredFrozenNotifications(replanCookIdNum);
        scheduleFrozenStageNotifications({
          cookId: replanCookIdNum,
          frozen: frozenForCook,
          preheatStartAt: plannedStart ? plannedStart.toISOString() : null,
          foodType: selectedCut.name,
          includePreheat: true,
          actualThawStartAt: replanActualThawStartAt,
        }).catch(() => {});
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCookQueryKey(replanCookIdNum) });
        qc.invalidateQueries({ queryKey: ["home", "insights"] });
        resetForm();
        router.push(`/cooks/${replanCookIdNum}` as any);
        return;
      }

      // ── CREATE path (normal new-cook flow) ───────────────────────────
      const createdCook = await createCook.mutateAsync({
        data: {
          foodType: selectedCut.name,
          weightLbs: effectiveWeightLbs > 0 ? effectiveWeightLbs : undefined,
          sizingLabel: sizeOutput.sizingLabel ?? undefined,
          targetTempF: targetTempF ? Number(targetTempF) : selectedCut.targetTempF,
          cookTempF: cookTempF ? Number(cookTempF) : selectedCut.cookTempF,
          grillId: grillId ?? undefined,
          notes: noteParts.join("\n\n") || undefined,
          status: effectiveCookNowMode === "now" ? "active" : "planned",
          ...(effectiveCookNowMode === "now"
            ? {
                actualStartAt: new Date() as any,
                // When starting a frozen cook immediately, record the thaw
                // start time now so the cook detail screen can compute
                // accurate countdowns and so that the 30-min "almost thawed"
                // warning fires without requiring the user to separately tap
                // "Mark Thaw Started" on the cook detail screen.
                ...(frozenForCook ? { actualThawStartAt: new Date() as any } : {}),
              }
            : {
                ...(serveAt && { plannedEndAt: serveAt }),
                ...(plannedStart && { plannedStartAt: plannedStart }),
              }),
          preheatMinutes: preheatMins,
          restMinutes: restMins,
          // Wrap guidance from AI plan
          ...(wrapMethodDb !== undefined && { wrapMethod: wrapMethodDb }),
          ...(wrap?.wrapAtMinutes > 0 && { wrapAtMinutes: Math.round(wrap.wrapAtMinutes) }),
          ...(wrap?.wrapTempF && { wrapTempF: Math.round(wrap.wrapTempF) }),
          ...(wrap?.reason && { wrapReason: wrap.reason }),
          ...(frozenForCook && {
            sequenceData: {
              schedule: [],
              frozen: frozenForCook,
              aiCheckins: aiResult?.checkins ?? null,
              ...(aiResult?.fingerprintSource === "grill" || aiResult?.fingerprintSource === "user"
                ? { fingerprintSource: aiResult.fingerprintSource, fingerprintNote: aiResult.fingerprintNote ?? null }
                : {}),
              ...(aiResult?.factorBreakdown?.length ? { factorBreakdown: aiResult.factorBreakdown } : {}),
            },
            fromFrozen: true,
            thawMethod: frozenForCook.method,
          }),
          ...(!frozenForCook && (aiResult?.checkins?.length || aiResult?.fingerprintSource === "grill" || aiResult?.fingerprintSource === "user" || aiResult?.factorBreakdown?.length) && {
            sequenceData: {
              schedule: [],
              ...(aiResult?.checkins?.length ? { aiCheckins: aiResult.checkins } : {}),
              ...(aiResult?.fingerprintSource === "grill" || aiResult?.fingerprintSource === "user"
                ? { fingerprintSource: aiResult.fingerprintSource, fingerprintNote: aiResult.fingerprintNote ?? null }
                : {}),
              ...(aiResult?.factorBreakdown?.length ? { factorBreakdown: aiResult.factorBreakdown } : {}),
            },
          }),
          // Technique quick-picks from the Plan screen
          ...(qpCookMethod && { cookingMethod: qpCookMethod }),
          ...(qpMeatStartTemp && { meatStartTemp: qpMeatStartTemp }),
          ...(qpInjection && { injection: qpInjection }),
          ...(qpSpritz && { spritzFrequency: qpSpritz }),
          ...(qpWrapFinish && { wrapFinish: qpWrapFinish }),
        } as any,
      });
      // Fire-and-forget: schedule the thaw/temper/preheat alerts immediately
      // so they're armed even if the user never opens the cook detail screen.
      // The cook detail screen's hook will re-reconcile these on mount.
      const newCookId = (createdCook as { id?: number } | undefined)?.id;

      // Cancel thaw notifications for any existing planned or active frozen
      // cooks that match the same food type + grill. This prevents stale alerts
      // from a previous plan (e.g. an adjusted serve time, or a prior "Begin
      // Thawing Now" session) from firing alongside the new ones. When the
      // pitmaster chose "Replace" (shouldReplaceStale), planned stale cooks are
      // also deleted from the database; otherwise only notifications are cleared.
      // "later" mode: stale cooks are planned. "now" mode: stale cooks may also
      // be active (a previous "Begin Thawing Now" was already started).
      if (frozenForCook) {
        const cooksToSweep = [
          ...(plannedCooks ?? []),
          ...(effectiveCookNowMode === "now" ? (activeCooks ?? []) : []),
        ] as Array<Cook & { fromFrozen?: boolean }>;
        const staleFrozenCooks = cooksToSweep.filter(
          (c) =>
            c.fromFrozen &&
            c.foodType === selectedCut.name &&
            (grillId == null || c.grillId === grillId) &&
            c.id !== newCookId,
        );
        for (const stale of staleFrozenCooks) {
          cancelStoredFrozenNotifications(stale.id).catch(() => {});
          if (shouldReplaceStale && stale.status === "planned") {
            deleteCook.mutateAsync({ id: stale.id }).catch(() => {});
          }
        }
      }

      if (newCookId) {
        if (effectiveCookNowMode === "later" && (frozenForCook || plannedStart)) {
          // Planned frozen cook: schedule thawStart, temper, and preheat
          // notifications. actualThawStartAt is not yet set because the pitmaster
          // hasn't confirmed the thaw is underway. The 30-min thaw-end warning
          // will be added by useFrozenStageNotifications when the cook detail
          // mounts and actualThawStartAt becomes non-null (via handleMarkThawStarted).
          scheduleFrozenStageNotifications({
            cookId: newCookId,
            frozen: frozenForCook,
            preheatStartAt: plannedStart ? plannedStart.toISOString() : null,
            foodType: selectedCut.name,
            includePreheat: true,
          }).catch(() => {});
        } else if (effectiveCookNowMode === "now" && frozenForCook) {
          // "Begin Thawing Now": the pitmaster is starting the thaw this
          // instant. Pass actualThawStartAt = now so the 30-min "almost thawed"
          // warning is armed immediately — no need to visit the cook detail
          // screen and tap "Mark Thaw Started" for the warning to fire.
          // preheatStartAt is omitted; the cook is already active and
          // useScheduleStepNotifications handles grillLight from the detail screen.
          const actualThawNow = new Date().toISOString();
          scheduleFrozenStageNotifications({
            cookId: newCookId,
            frozen: frozenForCook,
            preheatStartAt: null,
            foodType: selectedCut.name,
            includePreheat: false,
            actualThawStartAt: actualThawNow,
          }).catch(() => {});
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
      qc.invalidateQueries({ queryKey: ["home", "insights"] });
      const usedCooksBefore = paywallUsage?.usage?.cooks ?? 0;
      const isFreeAccount = !!paywallUsage && !paywallUsage.unlimited;
      const plannedFood = selectedCut?.name ?? null;

      // Persist the technique quick-picks so they pre-fill on the next visit.
      AsyncStorage.setItem("plan_technique_qp", JSON.stringify({
        cookMethod: qpCookMethod,
        meatStartTemp: qpMeatStartTemp,
        injection: qpInjection,
        spritz: qpSpritz,
        wrapFinish: qpWrapFinish,
      })).catch(() => {});

      // Persist the cook method per cut so it pre-selects next time the same
      // cut is picked — matching the behaviour in MultiCookAddItemModal.
      if (selectedCut && qpCookMethod) {
        saveLastCookMethod(selectedCut.name, qpCookMethod);
      }

      resetForm();
      // ── Inline soft tip card (NOT a blocking alert) ──
      // Surfaces only on the next render of the Plan screen and only when
      // the user is free, has 1+ cooks logged already, and hasn't dismissed
      // it permanently. The card promotes Multi-Cook Sequencer.
      // Strict gate: only show when AsyncStorage has resolved (=== false),
      // never while the dismissal flag is still loading (null).
      // "Save Cook Plan" (secondary frozen CTA): always land on the new cook's
      // detail screen so the pitmaster can tap "Start Thaw" when ready — same
      // post-save flow as "Plan for Later" mode per the task spec.
      if (modeOverride === "later" && newCookId) {
        router.push(`/cooks/${newCookId}` as any);
        return;
      }

      const willShowTip =
        effectiveCookNowMode !== "now" && isFreeAccount && usedCooksBefore >= 1 && multiCookTipDismissed === false;
      if (willShowTip) {
        setMultiCookTipFood(plannedFood);
        setShowMultiCookTip(true);
        // Persist "shown" the moment the tip appears so it never reappears
        // on a future visit, even if the user ignores it. This satisfies
        // the "shown once per context" requirement.
        setMultiCookTipDismissed(true);
        AsyncStorage.setItem("multi_cook_nudge_dismissed", "1").catch(() => {});
        // Skip auto-navigating to the Cooks tab so the user actually sees
        // the inline tip before leaving the Plan screen. They can navigate
        // manually after reading or dismissing it.
      } else if (effectiveCookNowMode === "now" && newCookId) {
        router.push(`/cooks/${newCookId}` as any);
      } else {
        router.push("/(tabs)/cooks" as any);
      }
    } catch (e: any) {
      // Free user hit the cook cap → upgrade modal instead of generic error.
      if (parseAndShowFromError(e)) return;
      Alert.alert("Error", e?.message || "Failed to create cook");
    }
  };

  // Secondary CTA for frozen Cook Now mode: saves with status "planned" so
  // the pitmaster can initiate thawing manually from the cook detail screen.
  const handleSaveFrozenPlan = async () => {
    setShowBeginThawCallout(false);
    await handleSubmit("later");
  };

  const botPad = useBottomTabBarHeight();
  const { isTablet, contentMaxWidth } = useLayout();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Plan a Cook" dark />

      {/* ── Now Cooking banner ───────────────────────────────── */}
      {activeCook && (
        <>
          <Pressable
            onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
            style={[s.nowCookingBanner, { backgroundColor: "#FF6B2B" }]}
          >
            <View style={s.nowCookingLeft}>
              <View style={[s.nowCookingDot, { backgroundColor: "#fff" }]} />
              <View style={{ flexShrink: 1 }}>
                <Text style={s.nowCookingTitle} numberOfLines={1}>
                  🔥 Now cooking · {activeCook.foodType ?? "Cook in progress"}
                </Text>
                {activeCookRemainingLabel && (
                  <Text
                    style={{
                      fontSize: 11,
                      fontFamily: "Inter_400Regular",
                      color: "#ffffff99",
                      marginTop: 1,
                    }}
                    numberOfLines={1}
                  >
                    {activeCookRemainingLabel}
                  </Text>
                )}
              </View>
            </View>
            <Text style={s.nowCookingElapsed}>
              {activeElapsedMs > 0 ? fmtElapsedPlan(activeElapsedMs) : "Just started"}
            </Text>
            <Pressable
              onPress={() => setEditTimesVisible(true)}
              hitSlop={10}
              style={{ padding: 4, marginRight: 2 }}
            >
              <Feather name="clock" size={16} color="#ffffffcc" />
            </Pressable>
            <Feather name="chevron-right" size={16} color="#fff" />
          </Pressable>
          <NextUpBanner
            nextStep={activeNextStep}
            cookSeqData={activeSeqData}
            nowMs={bannerNowMs}
            onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
          />
          {!activeCookIsMeatOn && (
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4 }}>
              <ThawStatusBanner
                cookStatus={activeCook.status}
                isMeatOn={activeCookIsMeatOn}
                cookSeqData={activeSeqData}
                meatOnMs={activeCookMeatOnMs}
                nowMs={bannerNowMs}
                thawMethod={(activeCook as any).thawMethod ?? null}
                onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
                colors={colors}
              />
            </View>
          )}
          {/* "Cook may already be done" — shown when estimated finish has
              passed or is within 10 min so the pitmaster knows to check the
              grill without opening the cook detail screen. */}
          {(() => {
            const finishAt = activeSeqData?.schedule?.[0]?.estimatedFinishAt as string | null | undefined;
            if (!finishAt) return null;
            const finishMs = new Date(finishAt).getTime();
            if (finishMs > bannerNowMs + 10 * 60_000) return null;
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
        </>
      )}

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isTablet ? { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" } : null}>
        {/* ── Multi-Cook Sequencer soft tip card ──
            Inline, dismissible nudge shown after a free user plans a cook
            when they already had 1+ cooks logged. Promotes the Multi-Cook
            Sequencer Pro feature. Persists dismissal in AsyncStorage so
            it never reappears once dismissed. */}
        {showMultiCookTip && !effectivePro && (
          <View
            style={{
              marginBottom: 14,
              padding: 14,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: "#6C3BF5",
              backgroundColor: "rgba(108,59,245,0.08)",
              flexDirection: "row",
              gap: 12,
              alignItems: "flex-start",
            }}
          >
            <Feather name="layers" size={18} color="#6C3BF5" style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 14,
                  marginBottom: 4,
                }}
              >
                Cooking more than one thing?
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12.5,
                  lineHeight: 18,
                }}
              >
                {multiCookTipFood
                  ? `You've planned ${multiCookTipFood}. Pro's Multi-Cook Sequencer plans every dish around one shared serve time so everything finishes together.`
                  : "Pro's Multi-Cook Sequencer plans every dish around one shared serve time so everything finishes together."}
              </Text>
              <View style={{ flexDirection: "row", gap: 14, marginTop: 10 }}>
                <Pressable
                  onPress={() => {
                    setShowMultiCookTip(false);
                    showPaywall({
                      trigger: "pro_required",
                      featureName: "Multi-Cook Sequencer",
                      foodType: multiCookTipFood,
                    });
                  }}
                  accessibilityRole="button"
                >
                  <Text style={{ color: "#6C3BF5", fontFamily: "Inter_700Bold", fontSize: 13 }}>
                    See Multi-Cook Sequencer →
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    setShowMultiCookTip(false);
                    setMultiCookTipDismissed(true);
                    AsyncStorage.setItem("multi_cook_nudge_dismissed", "1").catch(() => {});
                  }}
                  accessibilityRole="button"
                >
                  <Text style={{ color: colors.mutedForeground, fontFamily: "Inter_500Medium", fontSize: 13 }}>
                    Dismiss
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* ── Plan Mode Selector (three-way) ── */}
        <View style={[s.modeToggleRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <Pressable
            style={[
              s.modeToggleBtn,
              planMode === "single" && { backgroundColor: "#6C3BF5" },
              { borderRadius: colors.radius - 2 },
            ]}
            onPress={() => setPlanMode("single")}
          >
            <Text style={[s.modeToggleText, { color: planMode === "single" ? "#fff" : colors.mutedForeground }]}>Single Cook</Text>
          </Pressable>
          <Pressable
            style={[
              s.modeToggleBtn,
              planMode === "multi" && { backgroundColor: "#6C3BF5" },
              { borderRadius: colors.radius - 2 },
            ]}
            onPress={() => {
              if (!effectivePro) {
                showPaywall({ trigger: "pro_required", featureName: "Multi-Cook Sequencer" });
                return;
              }
              setPlanMode("multi");
            }}
            accessibilityRole="button"
            accessibilityLabel={effectivePro ? "Switch to Multi-Cook mode" : "Multi-Cook Sequencer, Pro feature, tap to learn more"}
          >
            <Feather
              name={effectivePro ? "layers" : "lock"}
              size={14}
              color={planMode === "multi" ? "#fff" : colors.mutedForeground}
            />
            <Text style={[s.modeToggleText, { color: planMode === "multi" ? "#fff" : colors.mutedForeground }]}>Multi-Cook</Text>
            {!effectivePro && (
              <View
                style={{
                  paddingHorizontal: 5,
                  paddingVertical: 1,
                  borderRadius: 4,
                  backgroundColor: colors.primary + "22",
                }}
              >
                <Text
                  style={{
                    fontSize: 8.5,
                    fontFamily: "Inter_700Bold",
                    color: colors.primary,
                    letterSpacing: 0.4,
                  }}
                >
                  PRO
                </Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Compact single-line Multi-Cook promo for free users. */}
        {!effectivePro && (
          <Pressable
            onPress={() =>
              showPaywall({
                trigger: "pro_required",
                featureName: "Multi-Cook Sequencer",
              })
            }
            accessibilityRole="button"
            accessibilityLabel="Multi-Cook Sequencer, Pro feature, tap to unlock"
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 14,
              padding: 12,
              borderRadius: colors.radius,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Feather name="layers" size={15} color={colors.primary} />
            <Text style={{ flex: 1, fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>
              Multi-Cook Sequencer
            </Text>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 3,
                paddingHorizontal: 6,
                paddingVertical: 3,
                borderRadius: 6,
                backgroundColor: colors.primary + "15",
              }}
            >
              <Feather name="lock" size={9} color={colors.primary} />
              <Text style={{ fontSize: 10, fontFamily: "Inter_700Bold", color: colors.primary, letterSpacing: 0.4 }}>
                PRO
              </Text>
            </View>
            <Text style={{ fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: colors.primary }}>
              Unlock →
            </Text>
          </Pressable>
        )}

        {planMode === "single" && (<>

        {/* ── Cook Now / Plan for Later toggle ── */}
        <View style={[s.modeToggleRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, marginBottom: 18 }]}>
          <Pressable
            style={[
              s.modeToggleBtn,
              cookNowMode === "now" && { backgroundColor: "#22c55e" },
              { borderRadius: colors.radius - 2 },
            ]}
            onPress={() => { setCookNowMode("now"); setServeAtManual(null); Haptics.selectionAsync(); }}
          >
            <Feather name="play" size={14} color={cookNowMode === "now" ? "#fff" : colors.mutedForeground} />
            <Text style={[s.modeToggleText, { color: cookNowMode === "now" ? "#fff" : colors.mutedForeground }]}>Cook Now</Text>
          </Pressable>
          <Pressable
            style={[
              s.modeToggleBtn,
              cookNowMode === "later" && { backgroundColor: colors.primary },
              { borderRadius: colors.radius - 2 },
            ]}
            onPress={() => {
              setCookNowMode("later");
              if (!serveAt) {
                const d = new Date();
                d.setDate(d.getDate() + 1);
                d.setHours(18, 0, 0, 0);
                setServeAt(d);
              }
              Haptics.selectionAsync();
            }}
          >
            <Feather name="calendar" size={14} color={cookNowMode === "later" ? "#fff" : colors.mutedForeground} />
            <Text style={[s.modeToggleText, { color: cookNowMode === "later" ? "#fff" : colors.mutedForeground }]}>Plan for Later</Text>
          </Pressable>
        </View>

        {/* ══ ZONE 1 — Essentials ══
            Meat cut, weight, and serve-by are the three inputs needed to
            produce a basic schedule. They appear above the fold with no
            scrolling required so first-time users are never overwhelmed. */}

        {/* ── Meat Cut ── */}
        <Label colors={colors}>Meat Cut *</Label>
        <Pressable
          onPress={() => setMeatPickerOpen(true)}
          style={[
            s.dropdown,
            {
              backgroundColor: colors.card,
              borderColor: selectedCut ? colors.primary : colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            {selectedCut ? (
              <>
                <Text style={[s.dropdownValue, { color: colors.foreground }]}>{selectedCut.name}</Text>
                <Text style={[s.dropdownSub, { color: colors.mutedForeground }]}>
                  {selectedCut.category} · Target {selectedCut.targetTempF}°F · {selectedCut.cookMethod}
                </Text>
              </>
            ) : (
              <Text style={[s.dropdownPlaceholder, { color: colors.mutedForeground }]}>
                Select a cut of meat…
              </Text>
            )}
          </View>
          <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* ── Size ── */}
        <SizeInputRow
          cut={selectedCut}
          colors={colors}
          onChange={(output) => { setSizeOutput(output); clearAiScheduleOverride(); }}
        />

        {/* ── Serve By (Plan for Later only) ── */}
        {cookNowMode === "later" && (
          <>
            <Label colors={colors}>When do you want to serve?</Label>
            <View style={[s.serveByCard, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radius }]}>
              {serveAt ? (
                <>
                  <View style={s.serveByRow}>
                    <Feather name="calendar" size={16} color={colors.primary} />
                    <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Date</Text>
                    <Pressable
                      onPress={() => setDatePickerOpen(true)}
                      style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
                    >
                      <Text style={[s.serveByBtnText, { color: colors.primary }]}>{formatDate(serveAt)}</Text>
                    </Pressable>
                  </View>
                  <View style={[s.serveByDivider, { backgroundColor: colors.border }]} />
                  <View style={s.serveByRow}>
                    <Feather name="clock" size={16} color={colors.primary} />
                    <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Time</Text>
                    <Pressable
                      onPress={() => setTimePickerOpen(true)}
                      style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
                    >
                      <Text style={[s.serveByBtnText, { color: colors.primary }]}>
                        {formatTime(serveAt.getHours(), serveAt.getMinutes())}
                      </Text>
                    </Pressable>
                  </View>
                  <View style={[s.serveByDivider, { backgroundColor: colors.border }]} />
                  <Pressable
                    onPress={() => setServeAtManual(null)}
                    style={s.serveByRow}
                  >
                    <Feather name="x-circle" size={16} color={colors.mutedForeground} />
                    <Text style={[s.serveByLabel, { flex: 1, color: colors.mutedForeground }]}>No serve time</Text>
                    <Text style={[s.serveByBtnText, { color: colors.mutedForeground, fontSize: 12 }]}>Clear</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable
                  onPress={() => {
                    const d = new Date();
                    d.setDate(d.getDate() + 1);
                    d.setHours(18, 0, 0, 0);
                    setServeAt(d);
                    setDatePickerOpen(true);
                  }}
                  style={[s.serveByRow, { justifyContent: "center", paddingVertical: 14 }]}
                >
                  <Feather name="calendar" size={16} color={colors.primary} />
                  <Text style={[s.serveByBtnText, { color: colors.primary, marginLeft: 8 }]}>Set a serve time (optional)</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* ══ ZONE 2 — Your Setup ══
            Grill selection and temperature overrides. Auto-filled from the
            meat cut, so they feel like quick confirmation rather than extra
            data entry. Always visible — frequently reviewed mid-plan. */}

        {/* ── Grill Selection ── */}
        <Label colors={colors}>Grill</Label>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, marginBottom: 12 }}
        >
          {(grills as any[] || []).map((g: any) => (
            <Pressable
              key={g.id}
              onPress={() => setGrillId(g.id === grillId ? null : g.id)}
              style={[
                s.grillChip,
                {
                  backgroundColor: grillId === g.id ? colors.primary : colors.card,
                  borderColor: grillId === g.id ? colors.primary : colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Feather name="wind" size={14} color={grillId === g.id ? "#fff" : colors.primary} />
              <Text style={[s.chipText, { color: grillId === g.id ? "#fff" : colors.foreground }]}>
                {g.name}
              </Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => router.push("/grills" as any)}
            style={[s.grillChip, { backgroundColor: colors.muted, borderColor: colors.border, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={14} color={colors.mutedForeground} />
            <Text style={[s.chipText, { color: colors.mutedForeground }]}>Add Grill</Text>
          </Pressable>
        </ScrollView>

        {/* Grill stats card */}
        {selectedGrill && (
          <View style={[s.grillStatsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <View style={s.grillStatsHeader}>
              <LinearGradient colors={["#E84820", "#FF6B2B"]} style={s.grillStatIcon}>
                <Feather name="wind" size={14} color="#fff" />
              </LinearGradient>
              <Text style={[s.grillStatsTitle, { color: colors.foreground }]}>{selectedGrill.name}</Text>
            </View>
            <View style={s.grillStatsGrid}>
              {!!selectedGrill.type && <StatCell label="Type" value={selectedGrill.type} colors={colors} />}
              {selectedGrill.minTempF != null && selectedGrill.maxTempF != null && (
                <StatCell label="Temp Range" value={`${selectedGrill.minTempF}°F – ${selectedGrill.maxTempF}°F`} colors={colors} />
              )}
              {selectedGrill.cookingSurfaceSqIn != null && (
                <StatCell label="Surface" value={`${selectedGrill.cookingSurfaceSqIn} sq in`} colors={colors} />
              )}
              {selectedGrill.numProbes != null && (
                <StatCell label="Probes" value={String(selectedGrill.numProbes)} colors={colors} />
              )}
              {selectedGrill.hopperSizeLbs != null && (
                <StatCell label="Hopper" value={`${selectedGrill.hopperSizeLbs} lbs`} colors={colors} />
              )}
              <StatCell
                label="Preheat Est."
                value={`~${fmtMinutes(preheatMinsForGrill(selectedGrill))}`}
                colors={colors}
                highlight
              />
            </View>
            {selectedGrill.maxTempF && selectedCut && selectedCut.cookTempF > selectedGrill.maxTempF && (
              <View style={[s.tempWarning, { backgroundColor: "#ef4444" + "18" }]}>
                <Feather name="alert-triangle" size={14} color="#ef4444" />
                <Text style={s.tempWarningText}>
                  This grill's max temp ({selectedGrill.maxTempF}°F) may not reach the recommended cook temp ({selectedCut.cookTempF}°F)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Temp overrides ── */}
        <View style={s.tempRow}>
          <View style={{ flex: 1 }}>
            <Label colors={colors}>Internal Target (°F)</Label>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder={selectedCut ? String(selectedCut.targetTempF) : "203"}
                placeholderTextColor={colors.mutedForeground}
                value={targetTempF}
                onChangeText={setTargetTempF}
                keyboardType="number-pad"
              />
              <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>°F</Text>
            </View>
          </View>
          <View style={{ width: 12 }} />
          <View style={{ flex: 1 }}>
            <Label colors={colors}>Pit Temp (°F)</Label>
            <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
              <TextInput
                style={[s.input, { color: colors.foreground }]}
                placeholder={selectedCut ? String(selectedCut.cookTempF) : "225"}
                placeholderTextColor={colors.mutedForeground}
                value={cookTempF}
                onChangeText={setCookTempF}
                keyboardType="number-pad"
              />
              <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>°F</Text>
            </View>
          </View>
        </View>

        {/* ══ ZONE 3 — Advanced Options ══
            Collapsible accordion. Starts closed so new users see a clean
            form. A one-line summary appears when collapsed and any option
            inside is configured. Cook Name, Prep Guide, Frozen timeline,
            MEATER probes, Technique Quick-Picks, and Notes live here. */}
        {(() => {
          const advParts: string[] = [];
          if (cookName.trim()) advParts.push(cookName.trim());
          if (frozenEnabled) advParts.push("Starting frozen");
          if (qpCookMethod) advParts.push(qpCookMethod);
          if (qpMeatStartTemp) advParts.push(qpMeatStartTemp);
          if (qpInjection) advParts.push(qpInjection);
          if (qpSpritz) advParts.push(qpSpritz);
          if (qpWrapFinish) advParts.push(qpWrapFinish);
          if (selectedProbeId) advParts.push("Probe linked");
          if (notes.trim()) advParts.push("Notes");
          const advSummary = advParts.join(" · ");
          return (
            <>
              <Pressable
                onPress={() => { setAdvancedOpen(o => !o); Haptics.selectionAsync(); }}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginTop: 16,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: advancedOpen ? colors.primary + "60" : colors.border,
                  backgroundColor: colors.card,
                  borderTopLeftRadius: colors.radius,
                  borderTopRightRadius: colors.radius,
                  borderBottomLeftRadius: advancedOpen ? 0 : colors.radius,
                  borderBottomRightRadius: advancedOpen ? 0 : colors.radius,
                  borderBottomWidth: advancedOpen ? 0 : 1,
                }}
              >
                <Feather name="sliders" size={14} color={advancedOpen ? colors.primary : colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground }}>
                    Advanced Options
                  </Text>
                  {!advancedOpen && advSummary ? (
                    <Text
                      numberOfLines={1}
                      style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, marginTop: 2 }}
                    >
                      {advSummary}
                    </Text>
                  ) : null}
                </View>
                <Feather
                  name={advancedOpen ? "chevron-up" : "chevron-down"}
                  size={16}
                  color={colors.mutedForeground}
                />
              </Pressable>

              {advancedOpen && (
                <View
                  style={{
                    borderWidth: 1,
                    borderTopWidth: 0,
                    borderColor: colors.primary + "60",
                    borderBottomLeftRadius: colors.radius,
                    borderBottomRightRadius: colors.radius,
                    backgroundColor: colors.card,
                    padding: 14,
                    paddingTop: 8,
                    marginBottom: 4,
                  }}
                >
                  {/* ── Cook Name (compact inline row) ── */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      paddingHorizontal: 12,
                      marginBottom: 10,
                      minHeight: 44,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        backgroundColor: colors.mutedForeground + "20",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Feather name="tag" size={14} color={colors.mutedForeground} />
                    </View>
                    <TextInput
                      style={{
                        flex: 1,
                        height: 44,
                        fontSize: 14,
                        fontFamily: "Inter_400Regular",
                        color: colors.foreground,
                      }}
                      placeholder="Cook name (optional)"
                      placeholderTextColor={colors.mutedForeground + "80"}
                      value={cookName}
                      onChangeText={setCookName}
                    />
                  </View>

                  {/* ── Meat Prep Guide ── */}
                  {(() => {
                    const prep = getMeatPrep(selectedCut);
                    if (!prep) return null;
                    return (
                      <Pressable
                        onPress={() => setPrepGuideOpen(o => !o)}
                        style={[s.prepGuideCard, { backgroundColor: colors.background, borderColor: prepGuideOpen ? colors.primary : colors.border, borderRadius: colors.radius }]}
                      >
                        <View style={s.prepGuideHeader}>
                          <View style={[s.prepGuideIconWrap, { backgroundColor: colors.primary + "20" }]}>
                            <Feather name="scissors" size={14} color={colors.primary} />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.prepGuideTitle, { color: colors.foreground }]}>Prep Guide</Text>
                            {!prepGuideOpen && (
                              <Text style={[s.prepGuidePreview, { color: colors.mutedForeground }]} numberOfLines={1}>
                                {prep.steps[0]}
                              </Text>
                            )}
                          </View>
                          <Feather name={prepGuideOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                        </View>
                        {prepGuideOpen && (
                          <View style={s.prepGuideBody}>
                            {prep.steps.map((step, i) => (
                              <View key={i} style={s.prepStep}>
                                <View style={[s.prepStepNum, { backgroundColor: colors.primary }]}>
                                  <Text style={s.prepStepNumText}>{i + 1}</Text>
                                </View>
                                <Text style={[s.prepStepText, { color: colors.foreground }]}>{step}</Text>
                              </View>
                            ))}
                            <View style={[s.prepTipCard, { backgroundColor: colors.primary + "12", borderRadius: colors.radius }]}>
                              <Feather name="zap" size={14} color={colors.primary} />
                              <Text style={[s.prepTipText, { color: colors.foreground }]}>{prep.tip}</Text>
                            </View>
                          </View>
                        )}
                      </Pressable>
                    );
                  })()}

                  {/* ── Frozen-to-Table Toggle + Thaw Method (compact grouped rows) ── */}
                  <View
                    style={{
                      marginTop: 10,
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: frozenEnabled ? "#3B82F660" : colors.border,
                      backgroundColor: colors.background,
                      paddingHorizontal: 12,
                      overflow: "hidden",
                    }}
                  >
                    {/* Frozen toggle compact row */}
                    <Pressable
                      onPress={async () => {
                        // Pro users — toggle freely.
                        if (effectivePro) {
                          setFrozenEnabled((prev) => !prev);
                          Haptics.selectionAsync();
                          return;
                        }
                        // Free users turning OFF — always allowed.
                        if (frozenEnabled) {
                          setFrozenEnabled(false);
                          Haptics.selectionAsync();
                          return;
                        }
                        // Free users turning ON — if already consumed for this draft, toggle freely.
                        if (frozenConsumedThisCook) {
                          setFrozenEnabled(true);
                          Haptics.selectionAsync();
                          return;
                        }
                        if (frozenConsumePending) return;
                        // Pre-flight: cached usage already shows 0 remaining → show paywall.
                        if (
                          paywallUsage &&
                          !paywallUsage.unlimited &&
                          paywallUsage.remaining.frozenTimelineLifetime <= 0
                        ) {
                          showPaywall({
                            trigger: "frozen_timeline_limit_reached",
                            featureName: "Frozen-to-Table Timeline",
                            foodType: selectedCut?.name ?? null,
                          });
                          return;
                        }
                        setFrozenConsumePending(true);
                        try {
                          const token = await getToken().catch(() => null);
                          const headers: Record<string, string> = { "Content-Type": "application/json" };
                          if (token) headers["Authorization"] = `Bearer ${token}`;
                          const apiBase =
                            process.env.EXPO_PUBLIC_API_URL ??
                            (process.env.EXPO_PUBLIC_DOMAIN
                              ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
                              : "");
                          const res = await fetch(
                            `${apiBase}/api/paywall/frozen-timeline/consume`,
                            { method: "POST", headers },
                          );
                          if (res.status === 402) {
                            showPaywall({
                              trigger: "frozen_timeline_limit_reached",
                              featureName: "Frozen-to-Table Timeline",
                              foodType: selectedCut?.name ?? null,
                            });
                            return;
                          }
                          if (!res.ok) {
                            Alert.alert("Couldn't enable Frozen-to-Table", "Please try again in a moment.");
                            return;
                          }
                          setFrozenEnabled(true);
                          setFrozenConsumedThisCook(true);
                          Haptics.selectionAsync();
                          qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
                        } finally {
                          setFrozenConsumePending(false);
                        }
                      }}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          paddingVertical: 11,
                          gap: 10,
                          minHeight: 44,
                          borderBottomWidth: frozenEnabled ? 0.5 : 0,
                          borderBottomColor: colors.border,
                        },
                        pressed && { opacity: 0.65 },
                      ]}
                    >
                      <View style={{ width: 26, height: 26, borderRadius: 7, backgroundColor: "#3B82F620", alignItems: "center", justifyContent: "center" }}>
                        <Feather name="cloud-snow" size={14} color="#3B82F6" />
                      </View>
                      <Text style={{ flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: colors.foreground }}>
                        Starting from frozen?
                      </Text>
                      {/* PRO pill for free users who have used or exhausted their trial */}
                      {!effectivePro &&
                        (frozenConsumedThisCook ||
                          (paywallUsage &&
                            !paywallUsage.unlimited &&
                            paywallUsage.remaining.frozenTimelineLifetime <= 0)) && (
                          <View style={s.proPill}>
                            <Feather name="star" size={9} color="#fff" />
                            <Text style={s.proPillText}>PRO</Text>
                          </View>
                        )}
                      {frozenConsumePending ? (
                        <ActivityIndicator size="small" color="#3B82F6" />
                      ) : (
                        <View style={[s.toggleTrack, { backgroundColor: frozenEnabled ? "#3B82F6" : colors.muted, borderColor: frozenEnabled ? "#3B82F6" : colors.border }]}>
                          <View style={[s.toggleThumb, { backgroundColor: "#fff", transform: [{ translateX: frozenEnabled ? 18 : 0 }] }]} />
                        </View>
                      )}
                    </Pressable>

                    {/* Thaw method row — shown when frozen is on */}
                    {frozenEnabled && (
                      <SettingsRow
                        label="Thaw Method"
                        icon="box"
                        iconColor="#3B82F6"
                        value={thawMethod === "fridge" ? "Refrigerator  (~24h / 4–5 lbs)" : "Cold Water  (~1h per lb)"}
                        onPress={() => setActiveSheet("thawMethod")}
                        colors={colors}
                        isLast
                      />
                    )}
                  </View>

                  {/* ── Live MEATER probes ── */}
                  {activeProbes.length > 0 && (
                    <View style={[sp.probeCard, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                      <View style={sp.probeHeader}>
                        <View style={[sp.probeIconWrap, { backgroundColor: "#E8482018" }]}>
                          <Feather name="thermometer" size={16} color="#E84820" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[sp.probeTitle, { color: colors.foreground }]}>Live MEATER Probes</Text>
                          <Text style={[sp.probeSub, { color: colors.mutedForeground }]}>
                            Select a probe to link it to this cook
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#34C759" }} />
                          <Text style={{ fontSize: 10, color: "#34C759", fontFamily: "Inter_600SemiBold" }}>LIVE</Text>
                        </View>
                      </View>

                      {activeProbes.map((probe) => {
                        const isSelected = selectedProbeId === probe.deviceId;
                        return (
                          <Pressable
                            key={probe.deviceId}
                            onPress={() => selectProbe(probe)}
                            style={({ pressed }) => [
                              sp.probeRow,
                              {
                                borderColor: isSelected ? "#E84820" : colors.border,
                                backgroundColor: isSelected ? "#E8482008" : colors.background,
                                borderRadius: colors.radius,
                              },
                              pressed && { opacity: 0.75 },
                            ]}
                          >
                            <View style={{ flex: 1, gap: 2 }}>
                              <Text style={{ color: colors.foreground, fontSize: 14, fontFamily: "Inter_600SemiBold" }}>
                                {probe.deviceName}
                              </Text>
                              {probe.cookName ? (
                                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: "Inter_400Regular" }}>
                                  {probe.cookName}{probe.cookState ? ` · ${probe.cookState}` : ""}
                                </Text>
                              ) : null}
                            </View>
                            <View style={{ alignItems: "flex-end", gap: 3 }}>
                              {probe.internalTempF != null && (
                                <View style={[sp.tempBadge, { backgroundColor: "#E8482018" }]}>
                                  <Text style={{ color: "#E84820", fontSize: 14, fontFamily: "Inter_700Bold" }}>
                                    {probe.internalTempF}°F
                                  </Text>
                                </View>
                              )}
                              {probe.targetMaxTempF != null && (
                                <Text style={{ color: colors.mutedForeground, fontSize: 11, fontFamily: "Inter_400Regular" }}>
                                  Target {probe.targetMaxTempF}°F
                                </Text>
                              )}
                            </View>
                            <View style={[
                              sp.selectCircle,
                              {
                                borderColor: isSelected ? "#E84820" : colors.border,
                                backgroundColor: isSelected ? "#E84820" : "transparent",
                              },
                            ]}>
                              {isSelected && <Feather name="check" size={12} color="#fff" />}
                            </View>
                          </Pressable>
                        );
                      })}

                      {selectedProbeId && (
                        <View style={[sp.linkedBanner, { backgroundColor: "#E8482010", borderColor: "#E8482030", borderRadius: colors.radius }]}>
                          <Feather name="link" size={13} color="#E84820" />
                          <Text style={{ color: "#E84820", fontSize: 12, fontFamily: "Inter_500Medium", flex: 1 }}>
                            Probe linked — target temp auto-filled from your live cook
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* ── Technique Quick-Picks (compact settings rows) ── */}
                  <View
                    style={{
                      marginTop: 12,
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      paddingHorizontal: 12,
                      overflow: "hidden",
                    }}
                  >
                    <SettingsRow
                      label="Cooking Method"
                      icon="activity"
                      value={qpCookMethod}
                      placeholder="Any"
                      onPress={() => setActiveSheet("cookMethod")}
                      onClear={() => setQpCookMethod(null)}
                      colors={colors}
                    />
                    <SettingsRow
                      label="Meat Starting Temp"
                      icon="thermometer"
                      value={qpMeatStartTemp}
                      placeholder="Any"
                      onPress={() => setActiveSheet("meatStartTemp")}
                      onClear={() => setQpMeatStartTemp(null)}
                      colors={colors}
                    />
                    <SettingsRow
                      label="Injection"
                      icon="droplet"
                      value={qpInjection}
                      placeholder="Any"
                      onPress={() => setActiveSheet("injection")}
                      onClear={() => setQpInjection(null)}
                      colors={colors}
                    />
                    <SettingsRow
                      label="Spritz/Mop Frequency"
                      icon="wind"
                      value={qpSpritz}
                      placeholder="Any"
                      onPress={() => setActiveSheet("spritz")}
                      onClear={() => setQpSpritz(null)}
                      colors={colors}
                    />
                    <SettingsRow
                      label="Wrap / Finish"
                      icon="package"
                      value={qpWrapFinish}
                      placeholder="Any"
                      onPress={() => setActiveSheet("wrapFinish")}
                      onClear={() => setQpWrapFinish(null)}
                      colors={colors}
                      isLast
                    />
                  </View>

                  {/* ── Notes (compact row → bottom sheet) ── */}
                  <View
                    style={{
                      marginTop: 10,
                      borderRadius: colors.radius,
                      borderWidth: 1,
                      borderColor: colors.border,
                      backgroundColor: colors.background,
                      paddingHorizontal: 12,
                      overflow: "hidden",
                    }}
                  >
                    <SettingsRow
                      label="Notes"
                      icon="edit-3"
                      value={notes.trim() || null}
                      placeholder="Rub recipe, wood choice, timing notes…"
                      onPress={() => {
                        setNotesSheetDraft(notes);
                        setActiveSheet("notes");
                      }}
                      colors={colors}
                      isLast
                    />
                  </View>

                  {/* ── Option bottom sheets ── */}
                  <OptionBottomSheet
                    visible={activeSheet === "cookMethod"}
                    title="Cooking Method"
                    options={QP_COOK_METHODS}
                    selected={qpCookMethod}
                    lastUsed={lastUsedCookMethod}
                    onChange={(v) => {
                      const method = v as QpCookMethod | null;
                      setQpCookMethod(method);
                      setLastUsedCookMethod(null);
                      if (selectedCut && method) {
                        saveLastCookMethod(selectedCut.name, method);
                      }
                    }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                  />
                  <OptionBottomSheet
                    visible={activeSheet === "meatStartTemp"}
                    title="Meat Starting Temp"
                    options={QP_MEAT_START_TEMPS}
                    selected={qpMeatStartTemp}
                    lastUsed={lastUsedMeatStartTemp}
                    onChange={(v) => {
                      const val = v as QpMeatStartTemp | null;
                      setQpMeatStartTemp(val);
                      setLastUsedMeatStartTemp(null);
                      if (selectedCut && val) saveLastMeatStartTemp(selectedCut.name, val);
                    }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                  />
                  <OptionBottomSheet
                    visible={activeSheet === "injection"}
                    title="Injection"
                    options={QP_INJECTION_OPTIONS}
                    selected={qpInjection}
                    lastUsed={lastUsedInjection}
                    onChange={(v) => {
                      const val = v as QpInjectionOption | null;
                      setQpInjection(val);
                      setLastUsedInjection(null);
                      if (selectedCut && val) saveLastInjection(selectedCut.name, val);
                    }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                  />
                  <OptionBottomSheet
                    visible={activeSheet === "spritz"}
                    title="Spritz Frequency"
                    options={QP_SPRITZ_FREQUENCIES}
                    selected={qpSpritz}
                    lastUsed={lastUsedSpritz}
                    onChange={(v) => {
                      const val = v as QpSpritzFrequency | null;
                      setQpSpritz(val);
                      setLastUsedSpritz(null);
                      if (selectedCut && val) saveLastSpritz(selectedCut.name, val);
                    }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                  />
                  <OptionBottomSheet
                    visible={activeSheet === "wrapFinish"}
                    title="Wrap / Finish"
                    options={QP_WRAP_FINISH_OPTIONS}
                    selected={qpWrapFinish}
                    lastUsed={lastUsedWrapFinish}
                    onChange={(v) => {
                      const val = v as QpWrapFinishOption | null;
                      setQpWrapFinish(val);
                      setLastUsedWrapFinish(null);
                      if (selectedCut && val) saveLastWrapFinish(selectedCut.name, val);
                    }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                  />
                  <OptionBottomSheet
                    visible={activeSheet === "thawMethod"}
                    title="Thaw Method"
                    options={[
                      { label: "Refrigerator  (~24h per 4–5 lbs)", value: "fridge" },
                      { label: "Cold Water  (~1h per lb)", value: "cold_water" },
                    ]}
                    selected={thawMethod}
                    onChange={(v) => { if (v) setThawMethod(v as ThawMethod); }}
                    onClose={() => setActiveSheet(null)}
                    colors={colors}
                    allowDeselect={false}
                  />
                  {/* Notes sheet */}
                  <Modal
                    visible={activeSheet === "notes"}
                    transparent
                    animationType="slide"
                    onRequestClose={() => { setNotes(notesSheetDraft); setActiveSheet(null); }}
                  >
                    <Pressable
                      style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
                      onPress={() => { setNotes(notesSheetDraft); setActiveSheet(null); }}
                    />
                    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
                    <View
                      style={{
                        backgroundColor: colors.card,
                        borderTopWidth: 1,
                        borderTopColor: colors.border + "60",
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                        paddingTop: 8,
                        paddingHorizontal: 18,
                        paddingBottom: 40,
                        gap: 14,
                      }}
                    >
                      <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground + "55", alignSelf: "center", marginBottom: 4 }} />
                      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontSize: 17, fontFamily: "Inter_700Bold", color: colors.foreground }}>Notes</Text>
                        <Pressable
                          onPress={() => { setNotes(notesSheetDraft); setActiveSheet(null); }}
                          style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 }}
                        >
                          <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" }}>Done</Text>
                        </Pressable>
                      </View>
                      <TextInput
                        style={{
                          backgroundColor: colors.background,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: colors.radius,
                          color: colors.foreground,
                          fontSize: 15,
                          fontFamily: "Inter_400Regular",
                          padding: 14,
                          minHeight: 120,
                          textAlignVertical: "top",
                        }}
                        placeholder="Rub recipe, wood choice, timing notes…"
                        placeholderTextColor={colors.mutedForeground}
                        value={notesSheetDraft}
                        onChangeText={setNotesSheetDraft}
                        multiline
                        autoFocus
                      />
                    </View>
                    </KeyboardAvoidingView>
                  </Modal>
                </View>
              )}
            </>
          );
        })()}

        {/* ── Outdoor Temperature Strip ── */}
        <WeatherStrip
          weather={weather}
          colors={colors}
          isFutureCookDay={isFutureCookDay}
          effectivePro={effectivePro}
          serveAt={serveAt ?? new Date()}
          factoredLabel="factored into AI plan"
          onLockedTap={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Weather Insights",
              subtitle: "Pro members see current outdoor conditions and cook-day forecasts factored directly into AI time estimates.",
            })
          }
        />

        {/* ── AI Cook Planner ── */}
        <Pressable
          style={({ pressed }) => [
            s.aiBtn,
            { borderRadius: colors.radius },
            (aiPredict.isPending || pressed) && { opacity: 0.75 },
          ]}
          onPress={handleAiPlan}
          disabled={aiPredict.isPending}
        >
          <LinearGradient
            colors={["#6C3BF5", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.aiBtnGradient}
          >
            {aiPredict.isPending ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.aiBtnText}>PitMaster is planning your cook…</Text>
              </>
            ) : (
              <>
                <Feather name="cpu" size={18} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.aiBtnText}>Ask PitMaster</Text>
                  <Text style={s.aiBtnSub}>
                    {selectedCut
                      ? `Get PitMaster timing, wrap tips & rest guidance for ${selectedCut.name}`
                      : "Select a meat cut first"}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* AI result banner (applied) */}
        {aiResult && !aiResultOpen && (
          <Pressable
            onPress={() => setAiResultOpen(true)}
            style={[s.aiAppliedBanner, { backgroundColor: "#6C3BF5" + "15", borderColor: "#6C3BF5" + "40", borderRadius: colors.radius }]}
          >
            <Feather name="check-circle" size={14} color="#6C3BF5" />
            <Text style={[s.aiAppliedText, { color: "#6C3BF5" }]}>
              PitMaster plan applied · {aiResult.confidence} confidence · Tap to review
            </Text>
          </Pressable>
        )}

        {/* Ask PitMaster about this plan — shown after a plan is generated */}
        {aiResult && (
          <Pressable
            onPress={() => {
              const parts: string[] = [];
              if (selectedCut) parts.push(`Meat: ${selectedCut.name}`);
              if (sizeOutput.sizingLabel) parts.push(`Size: ${sizeOutput.sizingLabel}`);
              else if (effectiveWeightLbs > 0) parts.push(`Weight: ${effectiveWeightLbs} lbs`);
              if (qpCookMethod) parts.push(`Method: ${qpCookMethod}`);
              if (cookTempF) parts.push(`Pit temp: ${cookTempF}°F`);
              if (targetTempF) parts.push(`Target internal: ${targetTempF}°F`);
              if (selectedGrill?.name) parts.push(`Grill: ${selectedGrill.name}`);
              if (aiResult.estimatedDurationMinutes) parts.push(`Estimated cook time: ${aiResult.estimatedDurationMinutes} minutes`);
              if (aiResult.confidence) parts.push(`Plan confidence: ${aiResult.confidence}`);
              if (aiResult.rationale) parts.push(`PitMaster rationale: ${aiResult.rationale}`);
              parts.push("I have a follow-up question about this plan.");
              setPlanChatSeed(parts.join("\n"));
              setPlanChatOpen(true);
            }}
            style={({ pressed }) => [
              s.askPitMasterPlanBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            <Feather name="message-circle" size={15} color="#E84820" />
            <Text style={[s.askPitMasterPlanText, { color: colors.foreground }]}>
              Ask PitMaster about this plan
            </Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* ── First-action hero (frozen mode only) ── */}
        {schedule?.frozen && !frozenStartInPast && (
          <View style={[s.firstActionCard, { borderRadius: colors.radius }]}>
            <LinearGradient
              colors={["#3B82F6", "#60A5FA"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[s.firstActionInner, { borderRadius: colors.radius }]}
            >
              <View style={s.firstActionIcon}>
                <Feather
                  name={schedule.frozen.method === "fridge" ? "box" : "droplet"}
                  size={20}
                  color="#fff"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.firstActionLabel}>NEXT UP</Text>
                <Text style={s.firstActionTitle}>
                  {schedule.frozen.method === "fridge"
                    ? "Move to fridge"
                    : "Start cold-water thaw"}{" "}
                  {fmtFromNow(schedule.frozen.thawStartAt)}
                </Text>
                <Text style={s.firstActionSub}>
                  {formatDateTime(schedule.frozen.thawStartAt)}
                </Text>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* ── Frozen warning: thaw start in the past ── */}
        {schedule?.frozen && frozenStartInPast && (
          <View style={[s.frozenWarning, { borderRadius: colors.radius }]}>
            <Feather name="alert-triangle" size={16} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={s.frozenWarningTitle}>Serve time is too soon</Text>
              <Text style={s.frozenWarningBody}>
                A full {schedule.frozen.method === "fridge" ? "fridge thaw" : "cold-water thaw"} for {effectiveWeightLbs} lbs needs about {fmtDuration(schedule.frozen.thawMins)}. Push the serve time later
                {schedule.frozen.method === "fridge" ? " or switch to cold-water thaw" : ""}.
              </Text>
            </View>
          </View>
        )}

        {/* ── Frozen warning: thaw window overlaps preheat (serve time too tight) ── */}
        {schedule?.frozen && frozenThawOverlapsGrill && (
          <View style={[s.frozenWarning, { borderRadius: colors.radius }]}>
            <Feather name="alert-triangle" size={16} color="#F59E0B" />
            <View style={{ flex: 1 }}>
              <Text style={s.frozenWarningTitle}>Not enough time to fully thaw</Text>
              <Text style={s.frozenWarningBody}>
                The {schedule.frozen.method === "fridge" ? "fridge thaw" : "cold-water thaw"} ({fmtDuration(schedule.frozen.thawMins)}) won&apos;t finish before the grill needs to light. Push the serve time later{schedule.frozen.method === "fridge" ? " or switch to cold-water thaw" : ""}.
              </Text>
            </View>
          </View>
        )}

        {/* ── Cook Schedule Summary (Plan for Later only) ── */}
        {cookNowMode === "later" && schedule && (
          <View style={[s.scheduleCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <LinearGradient
              colors={["#E84820", "#FF6B2B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.scheduleHeader}
            >
              <Feather name="clock" size={16} color="#fff" />
              <Text style={s.scheduleHeaderText}>
                {schedule.frozen ? "Frozen → Table Timeline" : "Your Cook Schedule"}
              </Text>
            </LinearGradient>
            <View style={s.scheduleBody}>
              {schedule.frozen && (
                <>
                  <ScheduleRow
                    icon={schedule.frozen.method === "fridge" ? "box" : "droplet"}
                    label={
                      schedule.frozen.method === "fridge"
                        ? "Move to fridge"
                        : "Start cold-water thaw"
                    }
                    value={formatDateTime(schedule.frozen.thawStartAt)}
                    sub={`~${fmtDuration(schedule.frozen.thawMins)} thaw · ${
                      schedule.frozen.method === "fridge"
                        ? "fridge thaw"
                        : "change water every 30 min"
                    }`}
                    colors={colors}
                  />
                  <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
                  <ScheduleRow
                    icon="check"
                    label="Meat fully thawed"
                    value={formatDateTime(schedule.frozen.thawEndAt)}
                    sub="Move to counter for temper"
                    colors={colors}
                  />
                  <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
                  <ScheduleRow
                    icon="thermometer"
                    label="Temper at room temp"
                    value={formatDateTime(schedule.frozen.temperStartAt)}
                    sub={`~${fmtDuration(schedule.frozen.temperMins)} on the counter`}
                    colors={colors}
                  />
                  <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
                </>
              )}
              <ScheduleRow
                icon="power"
                label="Start preheat"
                value={formatDateTime(schedule.startAt)}
                sub={`~${fmtDuration(schedule.preheatMins)} preheat`}
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="zap"
                label="Meat on"
                value={formatDateTime(schedule.meatOnAt)}
                sub={`~${fmtDuration(schedule.cookMins)} cook time`}
                colors={colors}
                trailing={
                  Array.isArray((aiResult as any)?.factorBreakdown) && (aiResult as any).factorBreakdown.length > 0
                    ? (
                      <Pressable
                        onPress={() => setFactorsSheetOpen(true)}
                        style={{ flexDirection: "row", alignItems: "center", gap: 3 }}
                        hitSlop={8}
                      >
                        <Text style={{ color: "#8B5CF6", fontSize: 11, fontFamily: "Inter_600SemiBold" }}>What&apos;s driving this?</Text>
                        <Feather name="chevron-right" size={10} color="#8B5CF6" />
                      </Pressable>
                    )
                    : undefined
                }
              />
              {schedule.wrap && (
                <>
                  <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
                  <ScheduleRow
                    icon="package"
                    label="Stall / wrap"
                    value={formatDateTime(schedule.wrap.wrapAt)}
                    sub={`Wrap around ${schedule.wrap.wrapTempF}°F internal to push through the stall`}
                    colors={colors}
                  />
                </>
              )}
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="pause"
                label="Pull off the grill"
                value={formatDateTime(schedule.pullAt)}
                sub="Hits target internal temp"
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="coffee"
                label="Rest"
                value={formatDateTime(schedule.pullAt)}
                sub={`~${fmtDuration(schedule.restMins)} rest before slicing`}
                colors={colors}
              />
              <View style={[s.scheduleLine, { backgroundColor: colors.border }]} />
              <ScheduleRow
                icon="check-circle"
                label="Serve!"
                value={formatDateTime(schedule.restEndAt)}
                sub={
                  schedule.frozen
                    ? `Cook total: ${fmtDuration(schedule.totalMins)} · Plus ${fmtDuration(schedule.frozen.thawMins + schedule.frozen.temperMins)} thaw + temper`
                    : `Total: ${fmtDuration(schedule.totalMins)}`
                }
                colors={colors}
                highlight
              />
            </View>
            {selectedCut?.notes && (
              <View style={[s.scheduleTip, { backgroundColor: colors.primary + "12" }]}>
                <Feather name="info" size={13} color={colors.primary} />
                <Text style={[s.scheduleTipText, { color: colors.foreground }]}>{selectedCut.notes}</Text>
              </View>
            )}
          </View>
        )}

        {/* Free-tier planned-cook slot counter. Only shown in Plan for Later mode. */}
        {cookNowMode === "later" && paywallUsage && !paywallUsage.unlimited && paywallUsage.usage.plannedCooks > 0 && (
          <Text
            style={{
              fontSize: 12,
              fontFamily: "Inter_500Medium",
              color:
                paywallUsage.remaining.plannedCooks <= 1
                  ? colors.primary
                  : colors.mutedForeground,
              textAlign: "center",
              marginTop: 6,
              marginBottom: -2,
            }}
          >
            {paywallUsage.remaining.plannedCooks} planned cook slot{paywallUsage.remaining.plannedCooks !== 1 ? "s" : ""} remaining
          </Text>
        )}
        {/* ── Submit ── */}
        <Pressable
          style={({ pressed }) => [
            s.submitBtn,
            { backgroundColor: colors.primary, borderRadius: colors.radius },
            (createCook.isPending || pressed) && { opacity: 0.7 },
          ]}
          onPress={() => handleSubmit()}
          disabled={createCook.isPending}
        >
          {createCook.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name={frozenEnabled && cookNowMode === "now" ? "thermometer" : cookNowMode === "now" ? "play" : "zap"} size={18} color="#fff" />
              <Text style={s.submitText}>{frozenEnabled && cookNowMode === "now" ? "Begin Thawing Now" : cookNowMode === "now" ? "Start Cooking Now" : "Save Cook Plan"}</Text>
            </>
          )}
        </Pressable>

        {/* ── Frozen-thaw informational callout (Cook Now + frozen, Begin Thawing Now path only) ── */}
        {frozenEnabled && cookNowMode === "now" && showBeginThawCallout && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 8,
              backgroundColor: "#3B82F615",
              borderWidth: 1,
              borderColor: "#3B82F640",
              borderRadius: colors.radius,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          >
            <Feather name="info" size={13} color="#3B82F6" style={{ marginTop: 1 }} />
            <Text
              style={{
                fontSize: 12,
                fontFamily: "Inter_400Regular",
                color: colors.foreground,
                flex: 1,
                lineHeight: 17,
              }}
            >
              Starting this plan begins your thaw countdown. Notifications will fire when it&apos;s time to move the meat to the counter, then to the grill.
            </Text>
          </View>
        )}

        {/* ── Secondary: Save Cook Plan (frozen + Cook Now only) ── */}
        {frozenEnabled && cookNowMode === "now" && (
          <Pressable
            style={({ pressed }) => [
              s.submitBtn,
              {
                backgroundColor: "transparent",
                borderRadius: colors.radius,
                borderWidth: 1.5,
                borderColor: colors.primary,
                marginTop: 10,
              },
              (createCook.isPending || pressed) && { opacity: 0.6 },
            ]}
            onPress={handleSaveFrozenPlan}
            disabled={createCook.isPending}
          >
            <Feather name="bookmark" size={18} color={colors.primary} />
            <Text style={[s.submitText, { color: colors.primary }]}>Save Cook Plan</Text>
          </Pressable>
        )}

        </>)}{/* end planMode === "single" */}

        {/* ════ MULTI-COOK SEQUENCER ════ */}
        {planMode === "multi" && (<>

        {/* Serve By (shared with single via serveAt state) */}
        <Label colors={colors}>When do you want to serve?</Label>
        <View style={[s.serveByCard, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radius }]}>
          <View style={s.serveByRow}>
            <Feather name="calendar" size={16} color={colors.primary} />
            <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Date</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Text style={[s.serveByBtnText, { color: colors.primary }]}>{formatDate(serveAt ?? defaultServeAt)}</Text>
            </Pressable>
          </View>
          <View style={[s.serveByDivider, { backgroundColor: colors.border }]} />
          <View style={s.serveByRow}>
            <Feather name="clock" size={16} color={colors.primary} />
            <Text style={[s.serveByLabel, { color: colors.mutedForeground }]}>Time</Text>
            <Pressable
              onPress={() => setTimePickerOpen(true)}
              style={[s.serveByBtn, { backgroundColor: colors.primary + "18", borderRadius: 8 }]}
            >
              <Text style={[s.serveByBtnText, { color: colors.primary }]}>
                {formatTime((serveAt ?? defaultServeAt).getHours(), (serveAt ?? defaultServeAt).getMinutes())}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Grill selector (default for all items) */}
        {(grills as any[] | undefined)?.length ? (
          <>
            <Label colors={colors}>Default Grill (override per item)</Label>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {(grills as any[]).map((g: any) => (
                  <Pressable
                    key={g.id}
                    onPress={() => setGrillId(grillId === g.id ? null : g.id)}
                    style={[
                      s.grillChip,
                      {
                        borderColor: grillId === g.id ? colors.primary : colors.border,
                        backgroundColor: grillId === g.id ? colors.primary + "15" : colors.card,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Text style={[s.grillChipText, { color: grillId === g.id ? colors.primary : colors.foreground }]}>
                      {g.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </>
        ) : null}

        {/* Items list */}
        <Label colors={colors}>Cooks to Sequence</Label>
        {multiItems.length === 0 ? (
          <View style={[s.multiEmptyBox, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            <Feather name="layers" size={22} color={colors.mutedForeground} />
            <Text style={[s.multiEmptyText, { color: colors.mutedForeground }]}>
              Add 2–5 items and PitMaster will sequence them so everything is ready at the same time.
            </Text>
          </View>
        ) : (
          <View style={[s.multiItemsList, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {multiItems.map((item, idx) => (
              <View key={idx}>
                {idx > 0 && <View style={[s.multiItemSep, { backgroundColor: colors.border }]} />}
                <View style={[s.multiItemRow, { alignItems: "flex-start" }]}>
                  <View style={s.multiItemInfo}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <Text style={[s.multiItemName, { color: colors.foreground }]}>{item.cut.name}</Text>
                      {item.cookMethod && (
                        <View style={{ backgroundColor: colors.primary + "18", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                          <Text style={{ fontSize: 11, fontFamily: "Inter_600SemiBold", color: colors.primary }}>{item.cookMethod}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[s.multiItemMeta, { color: colors.mutedForeground }]}>
                      {parseFloat(item.weightLbs) > 0 ? `${item.weightLbs} lbs` : "weight not set"}
                      {" · "}Pit: {item.cut.cookTempF}°F · Internal target: {item.cut.targetTempF}°F
                    </Text>
                    {(grills as any[] | undefined)?.length ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: "row", gap: 6 }}>
                          {(grills as any[]).map((g: any) => {
                            const active = item.grillId === g.id;
                            const inherited = item.grillId === null && grillId === g.id;
                            const chipColor = active ? colors.primary : inherited ? colors.primary + "80" : colors.mutedForeground;
                            return (
                              <Pressable
                                key={g.id}
                                onPress={() =>
                                  setMultiItems(prev =>
                                    prev.map((it, i) =>
                                      i === idx ? { ...it, grillId: active ? null : g.id } : it
                                    )
                                  )
                                }
                                style={[
                                  s.multiItemGrillChip,
                                  {
                                    borderColor: active ? colors.primary : inherited ? colors.primary + "50" : colors.border,
                                    backgroundColor: active ? colors.primary + "18" : inherited ? colors.primary + "08" : colors.muted,
                                    borderRadius: colors.radius,
                                    borderStyle: inherited ? "dashed" : "solid",
                                  },
                                ]}
                              >
                                <Feather name="wind" size={11} color={chipColor} />
                                <Text style={[s.multiItemGrillChipText, { color: chipColor }]}>
                                  {inherited ? `${g.name} (default)` : g.name}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </ScrollView>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: "row", gap: 6, alignItems: "flex-start", marginTop: 2 }}>
                    <Pressable
                      onPress={() => {
                        const item = multiItems[idx];
                        setMultiPickedCut(item.cut);
                        setMultiAddCat(item.cut.category);
                        setMultiAddWeightInput(item.weightLbs);
                        setEditingItemIdx(idx);
                        setMultiAddOpen(true);
                      }}
                      hitSlop={10}
                      style={{ padding: 4 }}
                    >
                      <Feather name="edit-2" size={16} color={colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => setMultiItems(prev => prev.filter((_, i) => i !== idx))}
                      hitSlop={10}
                      style={{ padding: 4 }}
                    >
                      <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Add Item button */}
        {multiItems.length < 5 && (
          <Pressable
            onPress={() => {
              setMultiPickedCut(null);
              setMultiAddWeightInput("");
              setMultiAddCat(MEAT_CATEGORIES[0]);
              setEditingItemIdx(null);
              setMultiAddOpen(true);
            }}
            style={[s.multiAddBtn, { borderColor: colors.border, borderRadius: colors.radius, backgroundColor: colors.card }]}
          >
            <Feather name="plus-circle" size={16} color={colors.primary} />
            <Text style={[s.multiAddBtnText, { color: colors.primary }]}>Add Item</Text>
          </Pressable>
        )}

        {/* Outdoor temp strip */}
        <WeatherStrip
          weather={weather}
          colors={colors}
          isFutureCookDay={isFutureCookDay}
          effectivePro={effectivePro}
          serveAt={serveAt ?? new Date()}
          factoredLabel="factored into sequence"
          onLockedTap={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Weather Insights",
              subtitle: "Pro members see current outdoor conditions and cook-day forecasts factored directly into AI time estimates.",
            })
          }
        />

        {/* Sequence button */}
        <Pressable
          style={({ pressed }) => [
            s.aiBtn,
            { borderRadius: colors.radius },
            (aiMultiCook.isPending || pressed) && { opacity: 0.75 },
          ]}
          onPress={handleMultiCook}
          disabled={aiMultiCook.isPending || multiItems.length < 2}
        >
          <LinearGradient
            colors={["#6C3BF5", "#A855F7"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.aiBtnGradient}
          >
            {aiMultiCook.isPending ? (
              <>
                <ActivityIndicator color="#fff" size="small" />
                <Text style={s.aiBtnText}>Sequencing your cooks…</Text>
              </>
            ) : (
              <>
                <Feather name="layers" size={18} color="#fff" />
                <View style={{ flex: 1 }}>
                  <Text style={s.aiBtnText}>Sequence My Cook</Text>
                  <Text style={s.aiBtnSub}>
                    {multiItems.length < 2
                      ? "Add at least 2 items first"
                      : `AI will schedule ${multiItems.length} items for ${formatTime((serveAt ?? defaultServeAt).getHours(), (serveAt ?? defaultServeAt).getMinutes())}`}
                  </Text>
                </View>
                <Feather name="chevron-right" size={16} color="rgba(255,255,255,0.7)" />
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Multi result summary (tappable if result exists) */}
        {multiResult && !multiResultOpen && (
          <Pressable
            onPress={() => setMultiResultOpen(true)}
            style={[s.aiAppliedBanner, { backgroundColor: "#6C3BF5" + "15", borderColor: "#6C3BF5" + "40", borderRadius: colors.radius }]}
          >
            <Feather name="check-circle" size={14} color="#6C3BF5" />
            <Text style={[s.aiAppliedText, { color: "#6C3BF5" }]}>
              Sequence ready · {multiResult.schedule.length} items · Tap to review
            </Text>
          </Pressable>
        )}

        </>)}{/* end planMode === "multi" */}
        </View>

      </KeyboardAwareScrollView>

      {/* ════ MEAT PICKER MODAL ════ */}
      <MeatPickerModal
        visible={meatPickerOpen}
        onClose={() => setMeatPickerOpen(false)}
        colors={colors}
        meatCategory={meatCategory}
        setMeatCategory={setMeatCategory}
        selectedCut={selectedCut}
        handlePickCut={handlePickCut}
      />

      {/* ════ DATE PICKER MODAL ════ */}
      <DatePickerModal
        visible={datePickerOpen}
        onClose={() => setDatePickerOpen(false)}
        colors={colors}
        serveAt={serveAt ?? defaultServeAt}
        setServeAt={setServeAtManual}
        upcomingDates={upcomingDates}
      />

      {/* ════ TIME PICKER MODAL ════ */}
      <TimePickerModal
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        colors={colors}
        serveAt={serveAt ?? defaultServeAt}
        setServeAt={setServeAtManual}
      />

      {/* ════ AI RESULTS MODAL ════ */}
      <AiResultsModal
        visible={aiResultOpen}
        onClose={() => setAiResultOpen(false)}
        colors={colors}
        aiResult={aiResult}
        applyAiPlan={applyAiPlan}
        grillName={selectedGrill?.name}
        selectedChips={{
          cookingMethod: qpCookMethod,
          meatStartTemp: qpMeatStartTemp,
          injection: qpInjection,
          spritzFrequency: qpSpritz,
          wrapFinish: qpWrapFinish,
        }}
      />

      {/* ════ MULTI-COOK RESULT MODAL ════ */}
      <MultiCookResultModal
        visible={multiResultOpen}
        onClose={() => {
          setMultiResultOpen(false);
        }}
        colors={colors}
        multiResult={multiResult}
        scheduleGrillLabels={scheduleGrillLabels}
        handleSaveMultiCooks={handleSaveMultiCooks}
        createCookPending={createCook.isPending}
      />

      {/* ════ MULTI-COOK ADD ITEM MODAL ════ */}
      <MultiCookAddItemModal
        visible={multiAddOpen}
        onClose={() => {
          setMultiAddOpen(false);
          setEditingItemIdx(null);
        }}
        colors={colors}
        multiAddCat={multiAddCat}
        setMultiAddCat={setMultiAddCat}
        multiPickedCut={multiPickedCut}
        setMultiPickedCut={setMultiPickedCut}
        multiAddWeightInput={multiAddWeightInput}
        setMultiAddWeightInput={setMultiAddWeightInput}
        setMultiItems={setMultiItems}
        editItem={editingItemIdx != null ? multiItems[editingItemIdx] : null}
        editIndex={editingItemIdx}
        effectivePro={effectivePro}
        frozenTrialAvailable={effectivePro || ((paywallUsage?.remaining?.frozenTimelineLifetime ?? 0) > 0)}
        showPaywall={showPaywall}
      />

      {/* ════ EDIT COOK TIMES SHEET ════ */}
      {activeCook && (
        <EditCookTimesSheet
          visible={editTimesVisible}
          fromFrozen={!!(activeCook as any).fromFrozen}
          initialMeatOnAt={
            (activeCook as any).actualStartAt
              ? new Date((activeCook as any).actualStartAt)
              : activeSeqData?.schedule?.[0]?.meatOnAt
                ? new Date(activeSeqData.schedule[0].meatOnAt as string)
                : null
          }
          initialThawStartAt={
            (activeCook as any).actualThawStartAt
              ? new Date((activeCook as any).actualThawStartAt)
              : (activeSeqData?.frozen as any)?.thawStartAt
                ? new Date((activeSeqData!.frozen as any).thawStartAt)
                : null
          }
          estimatedFinishAt={activeSeqData?.schedule?.[0]?.estimatedFinishAt ?? null}
          saving={editTimesSaving}
          onClose={() => setEditTimesVisible(false)}
          onSave={handleSaveCookTimes}
          colors={colors}
        />
      )}

      <PitMasterChatModal
        visible={planChatOpen}
        onClose={() => setPlanChatOpen(false)}
        seedMessage={planChatSeed}
        contextLabel="Asking about this plan"
      />

      <CookFactorsSheet
        visible={factorsSheetOpen}
        onClose={() => setFactorsSheetOpen(false)}
        factorBreakdown={(aiResult as any)?.factorBreakdown ?? []}
        qualFactors={(() => {
          const items: QualFactor[] = [];
          const breakdown: any[] = (aiResult as any)?.factorBreakdown ?? [];
          const fingerprintSource = (aiResult as any)?.fingerprintSource;
          if (fingerprintSource === "grill" || fingerprintSource === "user") {
            const hasSlower = breakdown.some((f: any) => f.label === "Learned Pace (Slower)");
            if (!hasSlower) items.push({ label: "Faster Pace", colorHex: "#22C55E", icon: "trending-down" });
            items.push({ label: "Grill Tuned", colorHex: "#22C55E", icon: "activity" });
          }
          if (breakdown.some((f: any) => f.label === "Cold Weather")) items.push({ label: "Cold Weather", colorHex: "#38BDF8", icon: "thermometer" });
          if (breakdown.some((f: any) => f.label === "Grill Load")) items.push({ label: "Grill Load", colorHex: "#F97316", icon: "layers" });
          if (frozenEnabled) items.push({ label: "Frozen", colorHex: "#3B82F6", icon: "box" });
          if (qpInjection) items.push({ label: "Injection", colorHex: "#8B5CF6", icon: "droplet" });
          if (qpWrapFinish) items.push({ label: "Wrap Method", colorHex: "#F97316", icon: "package" });
          return items;
        })()}
        colors={colors}
      />

    </View>
  );
}


// ─── Weather strip ────────────────────────────────────────────────────────
// Single source of truth for the outdoor-temp strip on both single and
// multi-cook plan modes. Renders three states:
//   1. Free user picked a future date → "Pro" lock badge, tap opens paywall.
//   2. Pro user with future date → "Forecast for [Day]: X°F, [condition]".
//   3. Same-day cook (or anyone before forecast loads) → "Current: X°F, …".
function WeatherStrip({
  weather,
  colors,
  isFutureCookDay,
  effectivePro,
  serveAt,
  factoredLabel,
  onLockedTap,
}: {
  weather: ReturnType<typeof useAmbientWeather>;
  colors: any;
  isFutureCookDay: boolean;
  effectivePro: boolean;
  serveAt: Date;
  factoredLabel: string;
  onLockedTap: () => void;
}) {
  // Weather is fully Pro-only. Show a lock badge for all free users so the
  // value of upgrading is visible right where it matters.
  if (!effectivePro) {
    return (
      <Pressable
        onPress={onLockedTap}
        style={[s.weatherStrip, { borderColor: colors.border }]}
      >
        <Feather name="cloud" size={13} color={colors.mutedForeground} />
        <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
          {isFutureCookDay ? `Forecast for ${formatDate(serveAt)}` : "Outdoor weather"} —
        </Text>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 6,
            backgroundColor: "#6C3BF5" + "15",
            borderWidth: 1,
            borderColor: "#6C3BF5" + "40",
          }}
        >
          <Feather name="lock" size={10} color="#6C3BF5" />
          <Text
            style={{
              fontSize: 11,
              fontFamily: "Inter_700Bold",
              color: "#6C3BF5",
            }}
          >
            Pro
          </Text>
        </View>
      </Pressable>
    );
  }

  if (weather.locationDenied) return null;

  // Loading shimmer when we don't yet have a value to show.
  if (weather.loading && weather.tempF == null) {
    return (
      <View style={[s.weatherStrip, { borderColor: colors.border }]}>
        <Feather name="cloud" size={13} color={colors.mutedForeground} />
        <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
          {weather.isForecast
            ? `Loading forecast for ${formatDate(serveAt)}…`
            : "Fetching outdoor temp…"}
        </Text>
      </View>
    );
  }

  if (weather.tempF == null) return null;

  const desc = weatherDescription(weather.conditionCode);
  const prefix = weather.isForecast
    ? `Forecast for ${formatDate(serveAt)}:`
    : "Current:";

  return (
    <View style={[s.weatherStrip, { borderColor: colors.border }]}>
      <Feather
        name={weatherIcon(weather.conditionCode) as any}
        size={13}
        color={colors.mutedForeground}
      />
      <Text style={[s.weatherText, { color: colors.mutedForeground }]}>{prefix}</Text>
      <Text style={[s.weatherTempText, { color: colors.foreground }]}>
        {weather.tempF}°F
      </Text>
      {desc && (
        <Text style={[s.weatherText, { color: colors.mutedForeground }]}>· {desc}</Text>
      )}
      <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
        · {factoredLabel}
      </Text>
    </View>
  );
}
