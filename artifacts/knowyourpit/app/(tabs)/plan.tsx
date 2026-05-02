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
} from "react-native";
import { fmtMinutes } from "@/utils/duration";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import * as Haptics from "expo-haptics";
import * as Crypto from "expo-crypto";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useColors } from "@/hooks/useColors";
import { useLayout } from "@/hooks/useLayout";
import {
  useListGrills,
  useCreateCook,
  useAiPredict,
  useAiMultiCook,
  useListCooks,
  getListCooksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  ListCooksStatus,
  type Cook,
  type MultiCookScheduleItem,
} from "@workspace/api-client-react";
import { NextUpBanner, getStepTargetMs } from "@/components/NextUpBanner";
import { computeNextStep } from "@/components/cook-detail/utils";
import type { SequenceData } from "@/components/cook-detail/types";
import { useAmbientWeather, weatherDescription, weatherIcon } from "@/hooks/useAmbientWeather";
import {
  MEAT_CUTS,
  MEAT_CATEGORIES,
  MEAT_CUTS_BY_CATEGORY,
  type MeatCut,
} from "@/constants/meatCuts";
import { useMeaterReadings, type MeaterProbe } from "@/hooks/useMeaterReadings";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import { useEffectivePro } from "@/hooks/useEffectivePro";

import { planStyles as s, probeCardStyles as sp } from "@/components/plan-screen/styles";
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
import { MeatPickerModal } from "@/components/plan-screen/MeatPickerModal";
import { DatePickerModal, TimePickerModal } from "@/components/plan-screen/DateTimePickerModals";
import { AiResultsModal } from "@/components/plan-screen/AiResultsModal";
import { MultiCookResultModal } from "@/components/plan-screen/MultiCookResultModal";
import { CompetitionSetupModal, type CompetitionPayload } from "@/components/plan-screen/CompetitionSetupModal";
import {
  KCBS_CATEGORY_LABEL,
  KCBS_CATEGORY_COLOR,
  type KcbsCategory,
} from "@/constants/competitionKnowledge";
import { MultiCookAddItemModal } from "@/components/plan-screen/MultiCookAddItemModal";

export default function PlanScreen() {
  const colors = useColors();
  const router = useRouter();
  const qc = useQueryClient();

  const { data: grills } = useListGrills();
  const createCook = useCreateCook();

  const { data: activeCooks } = useListCooks({ status: ListCooksStatus.active });
  const activeCook: Cook | null = activeCooks?.[0] ?? null;

  const [bannerNowMs, setBannerNowMs] = useState(Date.now());
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

  const activeElapsedMs = activeCook?.actualStartAt
    ? bannerNowMs - new Date(activeCook.actualStartAt).getTime()
    : 0;

  // ── Form state ───────────────────────────────────────────────────────
  const [cookName, setCookName] = useState("");
  const [selectedCut, setSelectedCut] = useState<MeatCut | null>(null);
  const [weightLbs, setWeightLbs] = useState("");
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
  const [serveAt, setServeAt] = useState<Date>(defaultServeAt);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);

  // ── Meat picker state ────────────────────────────────────────────────
  const [meatPickerOpen, setMeatPickerOpen] = useState(false);
  const [meatCategory, setMeatCategory] = useState<string>(MEAT_CATEGORIES[0]);
  const [prepGuideOpen, setPrepGuideOpen] = useState(false);

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
  // Pro users planning a future cook get the forecast for that day; everyone
  // else (free users on a future date, or anyone on a same-day cook) sees
  // current conditions. The hook itself just fetches — entitlement gating is
  // here, and the AI submit handlers also block free users hitting the
  // forecast path before any network call.
  const isFutureCookDay = useMemo(() => {
    const now = new Date();
    return !(
      serveAt.getFullYear() === now.getFullYear() &&
      serveAt.getMonth() === now.getMonth() &&
      serveAt.getDate() === now.getDate()
    ) && serveAt.getTime() > now.getTime();
  }, [serveAt]);
  const weatherTargetDate = effectivePro && isFutureCookDay ? serveAt : null;
  const weather = useAmbientWeather(weatherTargetDate);

  // ── AI predict state ──────────────────────────────────────────────────
  const aiPredict = useAiPredict();
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiResultOpen, setAiResultOpen] = useState(false);

  // ── Multi-cook state ──────────────────────────────────────────────────
  interface MultiItem { cut: MeatCut; weightLbs: string; grillId: number | null; }
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

  // ── Competition Mode state ────────────────────────────────────────────
  const [competitionSetupOpen, setCompetitionSetupOpen] = useState(false);
  const [competition, setCompetition] = useState<CompetitionPayload | null>(null);

  // ── Form reset helpers ───────────────────────────────────────────────
  // Called after a successful save so the next visit feels like a fresh
  // planning session. `grillId` and `planMode` are intentionally preserved.
  const resetForm = () => {
    setCookName("");
    setSelectedCut(null);
    setWeightLbs("");
    setNotes("");
    setTargetTempF("");
    setCookTempF("");
    const fresh = new Date();
    fresh.setDate(fresh.getDate() + 1);
    fresh.setHours(18, 0, 0, 0);
    setServeAt(fresh);
    setAiResult(null);
    setAiResultOpen(false);
    setSelectedProbeId(null);
    setPrepGuideOpen(false);
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
    setCompetition(null);
  };

  // ── Derived values ───────────────────────────────────────────────────
  const selectedGrill = useMemo(
    () => (grills as any[] | undefined)?.find((g: any) => g.id === grillId) ?? null,
    [grills, grillId]
  );

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

  const parsedWeight = parseFloat(weightLbs) || 0;
  const schedule = useMemo(() => {
    if (!selectedCut || parsedWeight <= 0) return null;
    return calcSchedule(serveAt, selectedCut, parsedWeight, selectedGrill, {
      enabled: frozenEnabled,
      method: thawMethod,
    });
  }, [selectedCut, parsedWeight, serveAt, selectedGrill, frozenEnabled, thawMethod]);

  // Edge case: if frozen toggle is on and the calculated thaw start is in the
  // past, the serve time is too soon for a full thaw. We surface a warning
  // and recommend cold-water (or moving the serve time later).
  const frozenStartInPast =
    !!schedule?.frozen && schedule.frozen.thawStartAt.getTime() < Date.now();

  // When user picks a meat cut, auto-fill temps
  const handlePickCut = (cut: MeatCut) => {
    setSelectedCut(cut);
    setTargetTempF(String(cut.targetTempF));
    setCookTempF(String(cut.cookTempF));
    setMeatPickerOpen(false);
    setPrepGuideOpen(false);
  };

  // ── AI Plan ──────────────────────────────────────────────────────────
  const handleAiPlan = async () => {
    if (!selectedCut) {
      Alert.alert("Select a Meat Cut First", "Choose a meat cut so PitMaster can tailor the plan.");
      return;
    }
    // Pro gate for cook-day forecasts. Free users planning a future cook
    // get the paywall instead of having today's weather silently misapplied
    // to tomorrow's cook.
    if (isFutureCookDay && !effectivePro) {
      showPaywall({
        trigger: "pro_required",
        featureName: "Cook-Day Weather Forecast",
        subtitle: "Pro plans use the forecast for your cook day so weather adjustments line up with the day you're actually cooking.",
      });
      return;
    }
    try {
      const result = await aiPredict.mutateAsync({
        data: {
          foodType: selectedCut.name,
          weightLbs: parsedWeight > 0 ? parsedWeight : undefined,
          cookTempF: cookTempF ? Number(cookTempF) : selectedCut.cookTempF,
          targetTempF: targetTempF ? Number(targetTempF) : selectedCut.targetTempF,
          grillId: grillId ?? undefined,
          desiredFinishAt: serveAt instanceof Date ? serveAt.toISOString() : serveAt,
          preheatMinutes: preheatMinsForGrill(selectedGrill),
          outdoorTempF: weather.tempF ?? undefined,
          outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
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
    // Clear any stale competition context from a prior session so a regular
    // multi-cook save never inherits competition metadata.
    setCompetition(null);
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
            };
          }),
          serveAt: serveAt.toISOString(),
          outdoorTempF: weather.tempF ?? undefined,
          outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
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

  // Competition Mode entrypoint — gathers competition setup, then runs the
  // same multi-cook AI route with per-item turn-in times and a competition
  // context block injected server-side.
  const handleCompetitionContinue = async (payload: CompetitionPayload) => {
    if (!effectivePro) {
      showPaywall({ trigger: "pro_required", featureName: "Competition Mode" });
      return;
    }
    setCompetition(payload);
    try {
      const result = await aiMultiCook.mutateAsync({
        data: {
          items: payload.items.map((item) => {
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
              category: item.category,
              turnInAt: item.turnInAt.toISOString(),
            };
          }),
          // Pass the latest turn-in as serveAt for backwards compatibility;
          // the server uses each item's turnInAt for backwards planning.
          serveAt: new Date(
            Math.max(...payload.items.map((i) => i.turnInAt.getTime())),
          ).toISOString(),
          outdoorTempF: weather.tempF ?? undefined,
          outdoorTempIsForecast: weather.tempF != null ? weather.isForecast : undefined,
          competition: {
            isCompetition: true,
            name: payload.competitionName,
            categories: Array.from(
              new Set(payload.items.map((i) => i.category)),
            ),
          },
        },
      });
      setCompetitionSetupOpen(false);
      setMultiResult(result as any);
      setMultiResultOpen(true);
    } catch (e: any) {
      if (parseAndShowFromError(e)) return;
      // On error, drop the staged competition payload so a subsequent regular
      // multi-cook save can't accidentally inherit it.
      setCompetition(null);
      Alert.alert("Competition Plan Error", e?.message || "Could not build competition plan. Try again.");
    }
  };

  const handleSaveMultiCooks = async () => {
    if (!multiResult) return;
    const isComp = competition !== null;
    try {
      const sessionId = Crypto.randomUUID();
      const remainingItems = [...multiItems];
      const remainingCompItems = competition ? [...competition.items] : [];
      for (const item of multiResult.schedule) {
        const matchedCut = MEAT_CUTS.find(c => c.name.toLowerCase() === item.foodType.toLowerCase());

        // Resolve input + weight differently for competition vs. regular multi-cook
        let inputWeightLbs: number | undefined;
        let resolvedGrillId: number | undefined;
        let compItem: typeof remainingCompItems[number] | undefined;
        if (isComp) {
          const idx = remainingCompItems.findIndex(
            (m) => m.cut.name.toLowerCase() === item.foodType.toLowerCase(),
          );
          compItem = idx >= 0 ? remainingCompItems.splice(idx, 1)[0] : undefined;
          inputWeightLbs = compItem ? parseFloat(compItem.weightLbs) || undefined : undefined;
          resolvedGrillId = compItem?.grillId ?? grillId ?? undefined;
        } else {
          const inputIdx = remainingItems.findIndex(m => m.cut.name.toLowerCase() === item.foodType.toLowerCase());
          const inputItem = inputIdx >= 0 ? remainingItems.splice(inputIdx, 1)[0] : undefined;
          inputWeightLbs = inputItem ? parseFloat(inputItem.weightLbs) || undefined : undefined;
          resolvedGrillId = inputItem?.grillId ?? grillId ?? undefined;
        }

        const wrapMethodDb =
          item.wrapMethod === "foil" ? "foil"
          : item.wrapMethod === "butcher_paper" ? "butcher_paper"
          : item.wrapMethod === "none" ? "none"
          : undefined;

        const noteHeader = isComp
          ? `${competition?.competitionName ?? "Competition"} · Turn-in ${
              (item as any).turnInAt
                ? new Date((item as any).turnInAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                : "—"
            }`
          : `Multi-cook session · Serve at ${new Date(multiResult.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
        const noteParts: string[] = [noteHeader];
        if (item.notes) noteParts.push(item.notes);
        if (item.wrapReason && wrapMethodDb && wrapMethodDb !== "none") noteParts.push(`Wrap: ${item.wrapReason}`);

        const itemTurnInIso = (item as any).turnInAt ?? compItem?.turnInAt?.toISOString() ?? null;
        const itemCategory = (item as any).category ?? compItem?.category ?? null;

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
            ...(isComp && {
              isCompetition: true,
              competitionName: competition!.competitionName,
              ...(itemCategory && { competitionCategory: itemCategory }),
              ...(itemTurnInIso && { turnInAt: itemTurnInIso }),
              sessionLabel: competition!.competitionName,
            }),
            sequenceData: {
              schedule: multiResult.schedule,
              serveAt: multiResult.serveAt,
              summary: (multiResult as any).summary ?? null,
              ...(isComp && {
                competition: {
                  name: competition!.competitionName,
                  date: competition!.competitionDate.toISOString(),
                },
              }),
            },
          } as any,
        });
      }
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      resetMultiForm();
      resetForm();
      router.push("/(tabs)/cooks");
    } catch (e: any) {
      // Free user hit the cook cap mid-multi-save → paywall.
      if (parseAndShowFromError(e)) return;
      Alert.alert("Error", e?.message || "Failed to save cooks.");
    }
  };

  const applyAiPlan = () => {
    if (!aiResult) return;
    // Update serve time and recalculate schedule from AI's serve time
    if (aiResult.serveAt) setServeAt(new Date(aiResult.serveAt));
    setAiResultOpen(false);
  };

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedCut) {
      Alert.alert("Required", "Please select a meat cut");
      return;
    }
    if (!weightLbs || parsedWeight <= 0) {
      Alert.alert("Required", "Please enter the weight in lbs");
      return;
    }
    // Free-tier pre-checks — fire paywall before any API work.
    if (paywallUsage && !paywallUsage.unlimited) {
      if (paywallUsage.remaining.cooks <= 0) {
        showPaywall({ trigger: "cook_limit_reached" });
        return;
      }
      if (paywallUsage.usage.plannedCooks >= 1) {
        showPaywall({ trigger: "planned_cook_limit_reached" });
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

    try {
      await createCook.mutateAsync({
        data: {
          foodType: selectedCut.name,
          weightLbs: parsedWeight,
          targetTempF: targetTempF ? Number(targetTempF) : selectedCut.targetTempF,
          cookTempF: cookTempF ? Number(cookTempF) : selectedCut.cookTempF,
          grillId: grillId ?? undefined,
          notes: noteParts.join("\n\n") || undefined,
          status: "planned",
          plannedEndAt: serveAt,
          plannedStartAt: plannedStart,
          preheatMinutes: preheatMins,
          restMinutes: restMins,
          // Wrap guidance from AI plan
          ...(wrapMethodDb !== undefined && { wrapMethod: wrapMethodDb }),
          ...(wrap?.wrapAtMinutes > 0 && { wrapAtMinutes: Math.round(wrap.wrapAtMinutes) }),
          ...(wrap?.wrapTempF && { wrapTempF: Math.round(wrap.wrapTempF) }),
          ...(wrap?.reason && { wrapReason: wrap.reason }),
        } as any,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
      qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
      resetForm();
      router.push("/(tabs)/cooks" as any);
    } catch (e: any) {
      // Free user hit the cook cap → upgrade modal instead of generic error.
      if (parseAndShowFromError(e)) return;
      Alert.alert("Error", e?.message || "Failed to create cook");
    }
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
              <Text style={s.nowCookingTitle} numberOfLines={1}>
                🔥 Now cooking · {activeCook.foodType ?? "Cook in progress"}
              </Text>
            </View>
            <Text style={s.nowCookingElapsed}>
              {activeElapsedMs > 0 ? fmtElapsedPlan(activeElapsedMs) : "Just started"}
            </Text>
            <Feather name="chevron-right" size={16} color="#fff" />
          </Pressable>
          <NextUpBanner
            nextStep={activeNextStep}
            cookSeqData={activeSeqData}
            nowMs={bannerNowMs}
            onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
          />
        </>
      )}

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isTablet ? { width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" } : null}>
        {/* ── Plan Mode Toggle ── */}
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
              // Inline PRO chip so free users immediately see this is a
              // locked feature, not just an inactive tab. Tap still opens
              // the paywall (handled above).
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

        {/* ── Competition Mode entry card (Pro-gated) — visible in BOTH modes ── */}
        <Pressable
          onPress={() => {
            if (!effectivePro) {
              showPaywall({ trigger: "pro_required", featureName: "Competition Mode" });
              return;
            }
            setCompetitionSetupOpen(true);
          }}
          style={{ marginBottom: 14 }}
        >
          <LinearGradient
            colors={["#EAB308", "#F59E0B"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              borderRadius: colors.radius,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: "rgba(255,255,255,0.22)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Feather name="award" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Text style={{ fontFamily: "Inter_700Bold", color: "#fff", fontSize: 14 }}>
                  KCBS Competition Mode
                </Text>
                {!effectivePro && (
                  <View style={{ backgroundColor: "rgba(0,0,0,0.25)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                    <Text style={{ color: "#fff", fontFamily: "Inter_700Bold", fontSize: 9 }}>PRO</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.92)", fontSize: 11, marginTop: 2 }}>
                Plan a sanctioned cook with per-category turn-in times + box-pack alarms.
              </Text>
            </View>
            <Feather name={effectivePro ? "chevron-right" : "lock"} size={18} color="#fff" />
          </LinearGradient>
        </Pressable>

        {planMode === "single" && (<>

        {/* ── Cook Name ── */}
        <Label colors={colors}>Cook Name (optional)</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. Sunday Brisket Comp"
            placeholderTextColor={colors.mutedForeground}
            value={cookName}
            onChangeText={setCookName}
          />
        </View>

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

        {/* ── Meat Prep Guide ── */}
        {(() => {
          const prep = getMeatPrep(selectedCut);
          if (!prep) return null;
          return (
            <Pressable
              onPress={() => setPrepGuideOpen(o => !o)}
              style={[s.prepGuideCard, { backgroundColor: colors.card, borderColor: prepGuideOpen ? colors.primary : colors.border, borderRadius: colors.radius }]}
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

        {/* ── Weight ── */}
        <Label colors={colors}>Weight (lbs) *</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
          <TextInput
            style={[s.input, { color: colors.foreground }]}
            placeholder="e.g. 12.5"
            placeholderTextColor={colors.mutedForeground}
            value={weightLbs}
            onChangeText={setWeightLbs}
            keyboardType="decimal-pad"
          />
          <Text style={[s.inputUnit, { color: colors.mutedForeground }]}>lbs</Text>
        </View>

        {/* ── Frozen-to-Table Toggle ── */}
        <Pressable
          onPress={async () => {
            // Pro users — toggle freely.
            if (effectivePro) {
              setFrozenEnabled((prev) => !prev);
              Haptics.selectionAsync();
              return;
            }
            // Free users turning OFF — always allowed; lifetime counter is
            // not refunded but they can keep planning without it.
            if (frozenEnabled) {
              setFrozenEnabled(false);
              Haptics.selectionAsync();
              return;
            }
            // Free users turning ON — if we've already consumed for this cook
            // draft, the toggle works freely. Otherwise check + record one
            // lifetime use server-side.
            if (frozenConsumedThisCook) {
              setFrozenEnabled(true);
              Haptics.selectionAsync();
              return;
            }
            if (frozenConsumePending) return;
            // Pre-flight: if the cached usage already shows 0 remaining,
            // skip the network call and surface the paywall immediately.
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
              const headers: Record<string, string> = {
                "Content-Type": "application/json",
              };
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
                // Already at lifetime cap — surface the upgrade paywall.
                showPaywall({
                  trigger: "frozen_timeline_limit_reached",
                  featureName: "Frozen-to-Table Timeline",
                  foodType: selectedCut?.name ?? null,
                });
                return;
              }
              if (!res.ok) {
                Alert.alert(
                  "Couldn't enable Frozen-to-Table",
                  "Please try again in a moment.",
                );
                return;
              }
              setFrozenEnabled(true);
              setFrozenConsumedThisCook(true);
              Haptics.selectionAsync();
              // Refresh the cached usage counters so other screens reflect
              // the new lifetime usage immediately.
              qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
            } finally {
              setFrozenConsumePending(false);
            }
          }}
          style={[
            s.frozenCard,
            {
              backgroundColor: colors.card,
              borderColor: frozenEnabled ? "#3B82F6" : colors.border,
              borderRadius: colors.radius,
              marginTop: 16,
              opacity: 1,
            },
          ]}
        >
          <View style={[s.frozenIconWrap, { backgroundColor: "#3B82F622" }]}>
            <Feather name="cloud-snow" size={16} color="#3B82F6" />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.frozenTitle, { color: colors.foreground }]}>
                Starting from frozen?
              </Text>
              {/* Free users get one lifetime trial — once consumed (or already
                  at cap server-side), surface the PRO pill so they understand
                  future toggles will require an upgrade. */}
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
            </View>
            <Text style={[s.frozenSub, { color: colors.mutedForeground }]} numberOfLines={2}>
              {frozenEnabled
                ? "We'll add thaw + temper time to your full timeline."
                : effectivePro
                  ? "Plan your cook from freezer to table."
                  : frozenConsumedThisCook
                    ? "Plan your cook from freezer to table."
                    : paywallUsage &&
                        !paywallUsage.unlimited &&
                        paywallUsage.remaining.frozenTimelineLifetime > 0
                      ? "Try it free once — full timeline from freezer to table."
                      : "Plan your cook from freezer to table."}
            </Text>
          </View>
          {frozenConsumePending ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <View
              style={[
                s.toggleTrack,
                {
                  backgroundColor: frozenEnabled ? "#3B82F6" : colors.muted,
                  borderColor: frozenEnabled ? "#3B82F6" : colors.border,
                },
              ]}
            >
              <View
                style={[
                  s.toggleThumb,
                  {
                    backgroundColor: "#fff",
                    transform: [{ translateX: frozenEnabled ? 18 : 0 }],
                  },
                ]}
              />
            </View>
          )}
        </Pressable>

        {/* Thaw method picker — only shown when toggle on (Pro or free trial). */}
        {frozenEnabled && (
          <View style={[s.thawMethodRow, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
            {([
              { key: "fridge" as const, label: "Refrigerator", icon: "box" as const, sub: "~24h per 4–5 lbs" },
              { key: "cold_water" as const, label: "Cold Water", icon: "droplet" as const, sub: "~1h per lb" },
            ]).map((m) => {
              const active = thawMethod === m.key;
              return (
                <Pressable
                  key={m.key}
                  onPress={() => {
                    setThawMethod(m.key);
                    Haptics.selectionAsync();
                  }}
                  style={[
                    s.thawMethodBtn,
                    {
                      backgroundColor: active ? "#3B82F6" : "transparent",
                      borderRadius: colors.radius - 2,
                    },
                  ]}
                >
                  <Feather name={m.icon} size={14} color={active ? "#fff" : colors.mutedForeground} />
                  <View style={{ alignItems: "center" }}>
                    <Text style={[s.thawMethodLabel, { color: active ? "#fff" : colors.foreground }]}>
                      {m.label}
                    </Text>
                    <Text
                      style={[
                        s.thawMethodSub,
                        { color: active ? "rgba(255,255,255,0.85)" : colors.mutedForeground },
                      ]}
                    >
                      {m.sub}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* ── Temp overrides ── */}
        <View style={s.tempRow}>
          <View style={{ flex: 1 }}>
            <Label colors={colors}>Target Temp (°F)</Label>
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
            <Label colors={colors}>Cook Temp (°F)</Label>
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

        {/* ── Live MEATER probes ────────────────────── */}
        {activeProbes.length > 0 && (
          <View style={[sp.probeCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>
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

        {/* ── Serve By ── */}
        <Label colors={colors}>When do you want to serve?</Label>
        <View style={[s.serveByCard, { backgroundColor: colors.card, borderColor: colors.primary + "40", borderRadius: colors.radius }]}>
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
        </View>

        {/* ── Outdoor Temperature Strip ── */}
        <WeatherStrip
          weather={weather}
          colors={colors}
          isFutureCookDay={isFutureCookDay}
          effectivePro={effectivePro}
          serveAt={serveAt}
          factoredLabel="factored into AI plan"
          onLockedTap={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Cook-Day Weather Forecast",
              subtitle: "Pro plans pull the forecast for your cook day so weather adjustments line up with the day you're actually cooking.",
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
                A full {schedule.frozen.method === "fridge" ? "fridge thaw" : "cold-water thaw"} for {parsedWeight} lbs needs about {fmtDuration(schedule.frozen.thawMins)}. Push the serve time later
                {schedule.frozen.method === "fridge" ? " or switch to cold-water thaw" : ""}.
              </Text>
            </View>
          </View>
        )}

        {/* ── Cook Schedule Summary ── */}
        {schedule && (
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

        {/* ── Notes ── */}
        <Label colors={colors}>Notes</Label>
        <View style={[s.inputWrap, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, height: 80 }]}>
          <TextInput
            style={[s.input, { color: colors.foreground, textAlignVertical: "top", paddingTop: 10 }]}
            placeholder="Rub recipe, wood choice, timing notes…"
            placeholderTextColor={colors.mutedForeground}
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </View>

        {/* Free-tier planned-cook slot counter. Hidden for Pro and until first planned cook. */}
        {paywallUsage && !paywallUsage.unlimited && paywallUsage.usage.plannedCooks > 0 && (
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
          onPress={handleSubmit}
          disabled={createCook.isPending}
        >
          {createCook.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="zap" size={18} color="#fff" />
              <Text style={s.submitText}>Save Cook Plan</Text>
            </>
          )}
        </Pressable>

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
                    <Text style={[s.multiItemName, { color: colors.foreground }]}>{item.cut.name}</Text>
                    <Text style={[s.multiItemMeta, { color: colors.mutedForeground }]}>
                      {parseFloat(item.weightLbs) > 0 ? `${item.weightLbs} lbs` : "weight not set"}
                      {" · "}{item.cut.cookTempF}°F cook · target {item.cut.targetTempF}°F
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
                  <Pressable
                    onPress={() => setMultiItems(prev => prev.filter((_, i) => i !== idx))}
                    hitSlop={10}
                    style={{ padding: 4, marginTop: 2 }}
                  >
                    <Feather name="x-circle" size={18} color={colors.mutedForeground} />
                  </Pressable>
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
          serveAt={serveAt}
          factoredLabel="factored into sequence"
          onLockedTap={() =>
            showPaywall({
              trigger: "pro_required",
              featureName: "Cook-Day Weather Forecast",
              subtitle: "Pro plans pull the forecast for your cook day so weather adjustments line up with the day you're actually cooking.",
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
                      : `AI will schedule ${multiItems.length} items for ${formatTime(serveAt.getHours(), serveAt.getMinutes())}`}
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
        serveAt={serveAt}
        setServeAt={setServeAt}
        upcomingDates={upcomingDates}
      />

      {/* ════ TIME PICKER MODAL ════ */}
      <TimePickerModal
        visible={timePickerOpen}
        onClose={() => setTimePickerOpen(false)}
        colors={colors}
        serveAt={serveAt}
        setServeAt={setServeAt}
      />

      {/* ════ AI RESULTS MODAL ════ */}
      <AiResultsModal
        visible={aiResultOpen}
        onClose={() => setAiResultOpen(false)}
        colors={colors}
        aiResult={aiResult}
        applyAiPlan={applyAiPlan}
        grillName={selectedGrill?.name}
      />

      {/* ════ MULTI-COOK RESULT MODAL ════ */}
      <MultiCookResultModal
        visible={multiResultOpen}
        onClose={() => setMultiResultOpen(false)}
        colors={colors}
        multiResult={multiResult}
        scheduleGrillLabels={scheduleGrillLabels}
        handleSaveMultiCooks={handleSaveMultiCooks}
        createCookPending={createCook.isPending}
      />

      {/* ════ MULTI-COOK ADD ITEM MODAL ════ */}
      <MultiCookAddItemModal
        visible={multiAddOpen}
        onClose={() => setMultiAddOpen(false)}
        colors={colors}
        multiAddCat={multiAddCat}
        setMultiAddCat={setMultiAddCat}
        multiPickedCut={multiPickedCut}
        setMultiPickedCut={setMultiPickedCut}
        multiAddWeightInput={multiAddWeightInput}
        setMultiAddWeightInput={setMultiAddWeightInput}
        setMultiItems={setMultiItems}
      />

      {/* ════ COMPETITION SETUP MODAL ════ */}
      <CompetitionSetupModal
        visible={competitionSetupOpen}
        onClose={() => {
          setCompetitionSetupOpen(false);
          // Drop staged competition payload on cancel so it can't leak into
          // a later regular multi-cook save.
          setCompetition(null);
        }}
        colors={colors}
        defaultGrillId={grillId}
        onContinue={handleCompetitionContinue}
        pending={aiMultiCook.isPending}
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
  // Free-tier upsell: future-day forecast is Pro-only. Show the strip with a
  // lock badge so the value of upgrading is visible right where it matters.
  if (isFutureCookDay && !effectivePro) {
    return (
      <Pressable
        onPress={onLockedTap}
        style={[s.weatherStrip, { borderColor: colors.border }]}
      >
        <Feather name="cloud" size={13} color={colors.mutedForeground} />
        <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
          Forecast for {formatDate(serveAt)} —
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
