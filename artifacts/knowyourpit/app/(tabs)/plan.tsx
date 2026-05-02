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
import { useColors } from "@/hooks/useColors";
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

  useEffect(() => {
    if (activeCook) {
      setBannerNowMs(Date.now());
      bannerTimerRef.current = setInterval(() => setBannerNowMs(Date.now()), 60000);
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
  }, [activeCook?.id]);

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

  // ── Weather ───────────────────────────────────────────────────────────
  const weather = useAmbientWeather();

  // ── AI predict state ──────────────────────────────────────────────────
  const aiPredict = useAiPredict();
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiResultOpen, setAiResultOpen] = useState(false);

  // ── Multi-cook state ──────────────────────────────────────────────────
  interface MultiItem { cut: MeatCut; weightLbs: string; grillId: number | null; }
  const aiMultiCook = useAiMultiCook();
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();
  const effectivePro = useEffectivePro();

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
            };
          }),
          serveAt: serveAt.toISOString(),
          outdoorTempF: weather.tempF ?? undefined,
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
        const inputItem = inputIdx >= 0 ? remainingItems.splice(inputIdx, 1)[0] : undefined;
        const resolvedGrillId = inputItem?.grillId ?? grillId ?? undefined;
        const wrapMethodDb =
          item.wrapMethod === "foil" ? "foil"
          : item.wrapMethod === "butcher_paper" ? "butcher_paper"
          : item.wrapMethod === "none" ? "none"
          : undefined;
        const noteParts: string[] = [
          `Multi-cook session · Serve at ${new Date(multiResult.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
        ];
        if (item.notes) noteParts.push(item.notes);
        if (item.wrapReason && wrapMethodDb && wrapMethodDb !== "none") noteParts.push(`Wrap: ${item.wrapReason}`);
        await createCook.mutateAsync({
          data: {
            foodType: item.foodType,
            weightLbs: inputItem ? parseFloat(inputItem.weightLbs) || undefined : undefined,
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

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />
      <AppHeader title="Plan a Cook" dark />

      {/* ── Now Cooking banner ───────────────────────────────── */}
      {activeCook && (
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
      )}

      <KeyboardAwareScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: botPad }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
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
          >
            <Feather name="layers" size={14} color={planMode === "multi" ? "#fff" : colors.mutedForeground} />
            <Text style={[s.modeToggleText, { color: planMode === "multi" ? "#fff" : colors.mutedForeground }]}>Multi-Cook</Text>
          </Pressable>
        </View>

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
          onPress={() => {
            if (!effectivePro) {
              showPaywall({
                trigger: "pro_required",
                featureName: "Frozen-to-Table Timeline",
                foodType: selectedCut?.name ?? null,
              });
              return;
            }
            setFrozenEnabled((prev) => !prev);
            Haptics.selectionAsync();
          }}
          style={[
            s.frozenCard,
            {
              backgroundColor: colors.card,
              borderColor: frozenEnabled && effectivePro ? "#3B82F6" : colors.border,
              borderRadius: colors.radius,
              marginTop: 16,
              opacity: effectivePro ? 1 : 0.85,
            },
          ]}
        >
          <View style={[s.frozenIconWrap, { backgroundColor: (effectivePro ? "#3B82F6" : colors.mutedForeground) + "22" }]}>
            <Feather name="cloud-snow" size={16} color={effectivePro ? "#3B82F6" : colors.mutedForeground} />
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[s.frozenTitle, { color: colors.foreground }]}>
                Starting from frozen?
              </Text>
              {!effectivePro && (
                <View style={s.proPill}>
                  <Feather name="star" size={9} color="#fff" />
                  <Text style={s.proPillText}>PRO</Text>
                </View>
              )}
            </View>
            <Text style={[s.frozenSub, { color: colors.mutedForeground }]} numberOfLines={2}>
              {effectivePro
                ? frozenEnabled
                  ? "We'll add thaw + temper time to your full timeline."
                  : "Plan your cook from freezer to table."
                : "Pro: full timeline from freezer to table."}
            </Text>
          </View>
          {effectivePro ? (
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
          ) : (
            <Feather name="lock" size={16} color={colors.mutedForeground} />
          )}
        </Pressable>

        {/* Thaw method picker — only shown when Pro + toggle on */}
        {effectivePro && frozenEnabled && (
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
        {!weather.locationDenied && ((weather.loading && weather.tempF == null) || weather.tempF != null) && (
          <View style={[s.weatherStrip, { borderColor: colors.border }]}>
            <Feather
              name={weatherIcon(weather.conditionCode) as any}
              size={13}
              color={colors.mutedForeground}
            />
            {weather.loading && weather.tempF == null ? (
              <Text style={[s.weatherText, { color: colors.mutedForeground }]}>Fetching outdoor temp…</Text>
            ) : weather.tempF != null ? (
              <>
                <Text style={[s.weatherTempText, { color: colors.foreground }]}>{weather.tempF}°F outdoors</Text>
                {weatherDescription(weather.conditionCode) && (
                  <Text style={[s.weatherText, { color: colors.mutedForeground }]}>
                    · {weatherDescription(weather.conditionCode)}
                  </Text>
                )}
                <Text style={[s.weatherText, { color: colors.mutedForeground }]}>· factored into AI plan</Text>
              </>
            ) : null}
          </View>
        )}

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
        {!weather.locationDenied && weather.tempF != null && (
          <View style={[s.weatherStrip, { borderColor: colors.border }]}>
            <Feather name={weatherIcon(weather.conditionCode) as any} size={13} color={colors.mutedForeground} />
            <Text style={[s.weatherTempText, { color: colors.foreground }]}>{weather.tempF}°F outdoors</Text>
            {weatherDescription(weather.conditionCode) && (
              <Text style={[s.weatherText, { color: colors.mutedForeground }]}>· {weatherDescription(weather.conditionCode)}</Text>
            )}
            <Text style={[s.weatherText, { color: colors.mutedForeground }]}>· factored into sequence</Text>
          </View>
        )}

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

      </KeyboardAwareScrollView>

      {/* ════ MEAT PICKER MODAL ════ */}
      <Modal
        visible={meatPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMeatPickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Select a Meat Cut</Text>
              <Pressable onPress={() => setMeatPickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Category tabs */}
            <View style={s.catTabRow}>
              {MEAT_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => setMeatCategory(cat)}
                  style={[
                    s.catTab,
                    {
                      backgroundColor: meatCategory === cat ? colors.primary : colors.muted,
                      borderRadius: 20,
                    },
                  ]}
                >
                  <Text
                    style={[
                      s.catTabText,
                      { color: meatCategory === cat ? "#fff" : colors.mutedForeground },
                    ]}
                  >
                    {cat}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Cut list */}
            <FlatList
              data={MEAT_CUTS_BY_CATEGORY[meatCategory] ?? []}
              keyExtractor={(item) => item.name}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
              ItemSeparatorComponent={() => <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => handlePickCut(item)}
                  style={({ pressed }) => [
                    s.cutRow,
                    pressed && { opacity: 0.7 },
                    selectedCut?.name === item.name && { backgroundColor: colors.primary + "12" },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                      Target {item.targetTempF}°F · Cook at {item.cookTempF}°F · ~{item.minsPerLb} min/lb
                    </Text>
                    {item.notes && (
                      <Text style={[s.cutNote, { color: colors.mutedForeground }]}>{item.notes}</Text>
                    )}
                  </View>
                  {selectedCut?.name === item.name && (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* ════ DATE PICKER MODAL ════ */}
      <Modal
        visible={datePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setDatePickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Date</Text>
              <Pressable onPress={() => setDatePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {upcomingDates.map((d) => {
                const isSelected =
                  d.getDate() === serveAt.getDate() &&
                  d.getMonth() === serveAt.getMonth() &&
                  d.getFullYear() === serveAt.getFullYear();
                return (
                  <Pressable
                    key={d.toISOString()}
                    onPress={() => {
                      const next = new Date(serveAt);
                      next.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
                      setServeAt(next);
                      setDatePickerOpen(false);
                    }}
                    style={[
                      s.dateRow,
                      isSelected && { backgroundColor: colors.primary + "18" },
                      { borderRadius: colors.radius },
                    ]}
                  >
                    <Text style={[s.dateText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatDate(d)}
                    </Text>
                    <Text style={[s.dateSubText, { color: colors.mutedForeground }]}>
                      {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ TIME PICKER MODAL ════ */}
      <Modal
        visible={timePickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setTimePickerOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheetSm, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Pick a Time</Text>
              <Pressable onPress={() => setTimePickerOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 30 }}>
              {TIME_SLOTS.map(({ h, m }) => {
                const isSelected = serveAt.getHours() === h && serveAt.getMinutes() === m;
                return (
                  <Pressable
                    key={`${h}:${m}`}
                    onPress={() => {
                      const next = new Date(serveAt);
                      next.setHours(h, m, 0, 0);
                      setServeAt(next);
                      setTimePickerOpen(false);
                    }}
                    style={[
                      s.dateRow,
                      isSelected && { backgroundColor: colors.primary + "18" },
                      { borderRadius: colors.radius },
                    ]}
                  >
                    <Text style={[s.dateText, { color: isSelected ? colors.primary : colors.foreground }]}>
                      {formatTime(h, m)}
                    </Text>
                    {isSelected && <Feather name="check" size={16} color={colors.primary} />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ AI RESULTS MODAL ════ */}
      <Modal
        visible={aiResultOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAiResultOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />

            {/* AI header */}
            <LinearGradient
              colors={["#6C3BF5", "#A855F7"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.aiModalHeader}
            >
              <Feather name="cpu" size={20} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={s.aiModalTitle}>PitMaster Plan</Text>
                {aiResult && (
                  <Text style={s.aiModalSub}>
                    {aiResult.confidence?.toUpperCase()} confidence · {fmtMinutes(aiResult.estimatedDurationMinutes)} active cook
                  </Text>
                )}
              </View>
              <Pressable onPress={() => setAiResultOpen(false)} hitSlop={12}>
                <Feather name="x" size={22} color="rgba(255,255,255,0.8)" />
              </Pressable>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 40 }}>
              {aiResult && (
                <>
                  {/* Rationale */}
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>PitMaster Analysis</Text>
                    <Text style={[s.aiBody, { color: colors.mutedForeground }]}>{aiResult.rationale}</Text>
                  </View>

                  {/* Schedule */}
                  <View style={[s.aiSection, { borderColor: colors.border }]}>
                    <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Suggested Schedule</Text>
                    {[
                      { icon: "power", label: "Light grill", val: aiResult.grillLightAt },
                      { icon: "zap", label: "Put food on", val: aiResult.suggestedStartAt },
                      { icon: "pause", label: "Pull off grill", val: aiResult.estimatedFinishAt },
                      { icon: "check-circle", label: "Ready to serve", val: aiResult.serveAt },
                    ].filter(r => r.val).map((row) => (
                      <View key={row.label} style={s.aiScheduleRow}>
                        <Feather name={row.icon as any} size={14} color="#6C3BF5" style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[s.aiScheduleLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                          <Text style={[s.aiScheduleVal, { color: colors.foreground }]}>
                            {formatDateTime(new Date(row.val as string))}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Wrap recommendation */}
                  {aiResult.wrap && (
                    <View style={[s.aiSection, { borderColor: colors.border }]}>
                      <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Wrapping Guidance</Text>
                      <View style={[s.wrapBadgeRow]}>
                        <View style={[s.wrapBadge, { backgroundColor: "#6C3BF5" + "18" }]}>
                          <Text style={[s.wrapBadgeText, { color: "#6C3BF5" }]}>
                            {aiResult.wrap.method === "none" ? "No wrap needed" : aiResult.wrap.method === "butcher_paper" ? "Butcher Paper" : "Foil (Texas Crutch)"}
                          </Text>
                        </View>
                        {aiResult.wrap.wrapAtMinutes > 0 && (
                          <View style={[s.wrapBadge, { backgroundColor: colors.muted }]}>
                            <Text style={[s.wrapBadgeText, { color: colors.foreground }]}>
                              At {fmtDuration(aiResult.wrap.wrapAtMinutes)} into cook
                            </Text>
                          </View>
                        )}
                        {aiResult.wrap.wrapTempF && (
                          <View style={[s.wrapBadge, { backgroundColor: colors.muted }]}>
                            <Text style={[s.wrapBadgeText, { color: colors.foreground }]}>
                              {aiResult.wrap.wrapTempF}°F internal
                            </Text>
                          </View>
                        )}
                      </View>
                      {aiResult.wrap.reason && (
                        <Text style={[s.aiBody, { color: colors.mutedForeground, marginTop: 8 }]}>{aiResult.wrap.reason}</Text>
                      )}
                      {aiResult.wrap.restMinutes > 0 && (
                        <View style={[s.restRow, { backgroundColor: colors.muted, borderRadius: 8 }]}>
                          <Feather name="coffee" size={14} color={colors.primary} />
                          <Text style={[s.restText, { color: colors.foreground }]}>
                            Rest for <Text style={{ fontFamily: "Inter_700Bold", color: colors.primary }}>{fmtDuration(aiResult.wrap.restMinutes)}</Text> after pulling
                          </Text>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Tips */}
                  {aiResult.tips && aiResult.tips.length > 0 && (
                    <View style={[s.aiSection, { borderColor: colors.border }]}>
                      <Text style={[s.aiSectionTitle, { color: colors.foreground }]}>Pit Master Tips</Text>
                      {aiResult.tips.map((tip: string, i: number) => (
                        <View key={i} style={s.tipRow}>
                          <View style={[s.tipBullet, { backgroundColor: "#6C3BF5" }]} />
                          <Text style={[s.tipText, { color: colors.mutedForeground }]}>{tip}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* Apply button */}
                  <Pressable
                    onPress={applyAiPlan}
                    style={({ pressed }) => [
                      s.applyBtn,
                      { borderRadius: colors.radius },
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <LinearGradient
                      colors={["#6C3BF5", "#A855F7"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={s.applyBtnGradient}
                    >
                      <Feather name="check" size={18} color="#fff" />
                      <Text style={s.applyBtnText}>Apply PitMaster Plan</Text>
                    </LinearGradient>
                  </Pressable>
                  <Pressable
                    onPress={() => setAiResultOpen(false)}
                    style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border }]}
                  >
                    <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Keep manual plan</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ MULTI-COOK RESULT MODAL ════ */}
      <Modal
        visible={multiResultOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMultiResultOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Cook Sequence</Text>
              <Pressable onPress={() => setMultiResultOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
              {multiResult && (
                <>
                  {/* Serve time header */}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <Feather name="check-circle" size={16} color="#22c55e" />
                    <Text style={{ fontSize: 14, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                      Everything ready by {new Date(multiResult.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>

                  {/* Summary */}
                  {multiResult.summary ? (
                    <View style={{ backgroundColor: "#6C3BF510", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                      <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground, lineHeight: 19 }}>
                        {multiResult.summary}
                      </Text>
                    </View>
                  ) : null}

                  {/* Timeline */}
                  {multiResult.schedule.map((item: MultiCookScheduleItem, idx: number) => {
                    const grillLabel = scheduleGrillLabels[idx] ?? null;
                    return (
                    <View
                      key={idx}
                      style={[{
                        borderWidth: 1,
                        borderRadius: 10,
                        marginBottom: 10,
                        overflow: "hidden",
                        borderColor: colors.border,
                        backgroundColor: colors.background,
                      }]}
                    >
                      {/* Item header */}
                      <View style={{ backgroundColor: "#6C3BF518", paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
                        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#6C3BF5", alignItems: "center", justifyContent: "center" }}>
                          <Text style={{ color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" }}>{idx + 1}</Text>
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.foreground }}>{item.foodType}</Text>
                          {grillLabel ? (
                            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                              <Feather name="sliders" size={10} color={colors.mutedForeground} />
                              <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>{grillLabel}</Text>
                            </View>
                          ) : (
                            <Text style={{ fontSize: 11, fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontStyle: "italic" }}>No grill selected</Text>
                          )}
                        </View>
                        <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.mutedForeground }}>
                          {fmtMinutes(item.estimatedDurationMinutes)} cook
                        </Text>
                      </View>
                      {/* Timeline rows */}
                      <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 7 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Feather name="power" size={13} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
                            {grillLabel ? `Light ${grillLabel}` : "Light grill"}
                          </Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: colors.foreground }}>
                            {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Feather name="zap" size={13} color="#E84820" />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Meat on</Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_700Bold", color: "#E84820" }}>
                            {new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        {item.wrapMethod && item.wrapMethod !== "none" && item.wrapAtMinutes && item.wrapAtMinutes > 0 && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                            <Feather name="package" size={13} color="#A855F7" />
                            <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>
                              {item.wrapMethod === "foil" ? "Wrap in foil" : "Wrap in butcher paper"}
                              {item.wrapTempF ? ` · ${item.wrapTempF}°F` : ""}
                            </Text>
                            <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#A855F7" }}>
                              {new Date(new Date(item.meatOnAt).getTime() + item.wrapAtMinutes * 60000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </Text>
                          </View>
                        )}
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Feather name="pause" size={13} color={colors.mutedForeground} />
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, flex: 1 }}>Pull off · rest {item.restMinutes}m</Text>
                          <Text style={{ fontSize: 13, fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                            {new Date(item.estimatedFinishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        {item.wrapReason && item.wrapMethod && item.wrapMethod !== "none" ? (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: "#A855F7", fontStyle: "italic", marginTop: 2 }}>
                            {item.wrapReason}
                          </Text>
                        ) : null}
                        {item.notes ? (
                          <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.mutedForeground, fontStyle: "italic", marginTop: 2 }}>
                            {item.notes}
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    );
                  })}

                  {/* Save All button */}
                  <Pressable
                    onPress={handleSaveMultiCooks}
                    disabled={createCook.isPending}
                    style={({ pressed }) => [{
                      backgroundColor: "#6C3BF5",
                      borderRadius: colors.radius,
                      paddingVertical: 14,
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                      marginTop: 4,
                      opacity: (pressed || createCook.isPending) ? 0.7 : 1,
                    }]}
                  >
                    {createCook.isPending ? (
                      <ActivityIndicator color="#fff" size="small" />
                    ) : (
                      <>
                        <Feather name="save" size={16} color="#fff" />
                        <Text style={{ color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" }}>
                          Save {multiResult.schedule.length} Cooks to My Plan
                        </Text>
                      </>
                    )}
                  </Pressable>

                  <Pressable
                    onPress={() => setMultiResultOpen(false)}
                    style={[s.dismissBtn, { borderRadius: colors.radius, borderColor: colors.border, marginTop: 10 }]}
                  >
                    <Text style={[s.dismissBtnText, { color: colors.mutedForeground }]}>Close</Text>
                  </Pressable>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ════ MULTI-COOK ADD ITEM MODAL ════ */}
      <Modal
        visible={multiAddOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMultiAddOpen(false)}
      >
        <View style={s.modalOverlay}>
          <View style={[s.modalSheet, { backgroundColor: colors.card }]}>
            <View style={[s.modalHandle, { backgroundColor: colors.border }]} />
            <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
              <Text style={[s.modalTitle, { color: colors.foreground }]}>Add Item</Text>
              <Pressable onPress={() => setMultiAddOpen(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {/* Category tabs */}
            <View style={s.catTabRow}>
              {MEAT_CATEGORIES.map(cat => (
                <Pressable
                  key={cat}
                  onPress={() => setMultiAddCat(cat)}
                  style={[s.catTab, { backgroundColor: multiAddCat === cat ? colors.primary : colors.muted, borderRadius: 20 }]}
                >
                  <Text style={[s.catTabText, { color: multiAddCat === cat ? "#fff" : colors.mutedForeground }]}>{cat}</Text>
                </Pressable>
              ))}
            </View>
            <FlatList
              data={MEAT_CUTS_BY_CATEGORY[multiAddCat] ?? []}
              keyExtractor={item => item.name}
              contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
              ItemSeparatorComponent={() => <View style={[s.cutSep, { backgroundColor: colors.border }]} />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setMultiPickedCut(item)}
                  style={({ pressed }) => [
                    s.cutRow,
                    pressed && { opacity: 0.7 },
                    multiPickedCut?.name === item.name && { backgroundColor: colors.primary + "12" },
                  ]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[s.cutName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[s.cutMeta, { color: colors.mutedForeground }]}>
                      Target {item.targetTempF}°F · Cook at {item.cookTempF}°F · ~{item.minsPerLb} min/lb
                    </Text>
                  </View>
                  {multiPickedCut?.name === item.name && (
                    <Feather name="check-circle" size={18} color={colors.primary} />
                  )}
                </Pressable>
              )}
            />
            {multiPickedCut && (
              <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }}>
                <View style={[s.inputWrap, { backgroundColor: colors.background, borderColor: colors.border, borderRadius: colors.radius }]}>
                  <TextInput
                    style={[s.input, { color: colors.foreground }]}
                    placeholder={`Weight in lbs (optional)`}
                    placeholderTextColor={colors.mutedForeground}
                    keyboardType="decimal-pad"
                    value={multiAddWeightInput}
                    onChangeText={setMultiAddWeightInput}
                  />
                </View>
                <Pressable
                  onPress={() => {
                    setMultiItems(prev => [...prev, { cut: multiPickedCut, weightLbs: multiAddWeightInput, grillId: null }]);
                    setMultiAddOpen(false);
                    setMultiPickedCut(null);
                    setMultiAddWeightInput("");
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  style={[s.submitBtn, { backgroundColor: "#6C3BF5", borderRadius: colors.radius }]}
                >
                  <Feather name="plus" size={16} color="#fff" />
                  <Text style={s.submitText}>Add {multiPickedCut.name}</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>

    </View>
  );
}

