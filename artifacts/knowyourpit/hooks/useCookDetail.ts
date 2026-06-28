import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { getTokenSafe } from "@/lib/getTokenSafe";
import { Platform, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";

import {
  useGetCook,
  useDeleteCook,
  useUpdateCook,
  useAnalyzeCook,
  useDismissCookOutlier,
  useListGrills,
  useListCooks,
  useListCookCheckins,
  useCreateCookCheckin,
  type Cook,
  type UpdateCookBody,
  getListCooksQueryKey,
  getGetCookQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentCooksQueryKey,
  getListCookCheckinsQueryKey,
  getGetCookHealthQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@clerk/expo";
import { usePaywall, type ShowOptions } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import { useEffectivePro } from "@/hooks/useEffectivePro";
import { useSubscription } from "@/contexts/SubscriptionContext";
import {
  cancelStoredFrozenNotifications,
  scheduleFrozenStageNotifications,
  type FrozenStageData,
} from "@/hooks/useFrozenStageNotifications";
import {
  cancelStoredCheckinNotifications,
  scheduleCheckinNotifications,
} from "@/hooks/useCheckinNotifications";
import {
  scheduleStepNotifications,
  cancelStoredStepNotifications,
} from "@/hooks/useScheduleStepNotifications";
import { STATUS_COLORS } from "@/components/cook-detail/constants";
import { type QualFactor } from "@/components/CookFactorsSheet";
import { getEditDates, rippleScheduleTimestamps } from "@/components/cook-detail/utils";
import { loadRemovedCheckinPhaseKeys } from "@/hooks/useCheckinNotifications";
import type { ScheduleItem, SequenceData } from "@/components/cook-detail/types";
import { generateCheckinSchedule } from "@/constants/checkinKnowledge";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export type CookDetailState = ReturnType<typeof useCookDetail>;

export function useCookDetail(id: string | undefined) {
  const router = useRouter();
  const qc = useQueryClient();
  const { getToken } = useAuth();
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();
  const effectivePro = useEffectivePro();
  const effectiveProRef = useRef(effectivePro);
  effectiveProRef.current = effectivePro;
  const { isIdentityLinked } = useSubscription();

  const cookFromListCache = useMemo(() => {
    const numId = Number(id);
    const keysToSearch = [getListCooksQueryKey(), getGetRecentCooksQueryKey()];
    for (const key of keysToSearch) {
      const allCaches = qc.getQueriesData<Cook[]>({ queryKey: key });
      for (const [, cooks] of allCaches) {
        const found = cooks?.find((c) => c.id === numId);
        if (found) return found;
      }
    }
    return undefined;
  }, [qc, id]);

  const { data: cook, isLoading, dataUpdatedAt: cookDataUpdatedAt } = useGetCook(
    Number(id),
    {
      query: {
        staleTime: 20_000,
        initialData: cookFromListCache,
        initialDataUpdatedAt: cookFromListCache ? 0 : undefined,
      } as any,
    },
  );

  const deleteCook = useDeleteCook();
  const updateCook = useUpdateCook();
  const dismissCookOutlier = useDismissCookOutlier();
  const analyzeMutation = useAnalyzeCook();
  const createCheckin = useCreateCookCheckin();

  const cookStatus = (cook as any)?.status as string | undefined;

  const { data: allCooksForCount } = useListCooks(undefined, {
    query: {
      queryKey: [...getListCooksQueryKey(), "active_count"],
      enabled: cookStatus === "active",
      staleTime: 30_000,
    },
  });

  const activeCookCount = (allCooksForCount ?? []).filter(
    (c: any) => c?.status === "active",
  ).length;

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

  const lastCheckin = useMemo(() => {
    if (!Array.isArray(cookCheckins) || cookCheckins.length === 0) return null;
    const withTemps = (cookCheckins as any[]).filter(
      (ci: any) => ci.internalTempF != null || ci.pitTempF != null,
    );
    if (withTemps.length === 0) return null;
    return withTemps.reduce((best: any, ci: any) =>
      new Date(ci.createdAt) > new Date(best.createdAt) ? ci : best,
    );
  }, [cookCheckins]);

  const cookSeqData = (cook as { sequenceData?: SequenceData | null } | null | undefined)?.sequenceData ?? null;

  type CookWithServerExtras = {
    finishTimeRangeLower?: string | null;
    finishTimeRangeUpper?: string | null;
    currentTempF?: number | null;
  };
  const cookWithFinishWindow = cook as CookWithServerExtras | undefined;
  const cookFinishLower: string | null = cookWithFinishWindow?.finishTimeRangeLower ?? null;
  const cookFinishUpper: string | null = cookWithFinishWindow?.finishTimeRangeUpper ?? null;
  const cookCurrentTempF: number | null = cookWithFinishWindow?.currentTempF ?? null;

  const { data: grillsList } = useListGrills();
  const grills: any[] = Array.isArray(grillsList) ? grillsList : [];

  // Ratings state
  const [rateTenderness, setRateTenderness] = useState<number>(0);
  const [rateFlavor, setRateFlavor] = useState<number>(0);
  const [rateBark, setRateBark] = useState<number>(0);
  const [rateSaving, setRateSaving] = useState(false);
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const cookRatingT = (cook as any)?.ratingTenderness ?? 0;
  const cookRatingF = (cook as any)?.ratingFlavor ?? 0;
  const cookRatingB = (cook as any)?.ratingBark ?? 0;
  useEffect(() => {
    setRateTenderness(cookRatingT);
    setRateFlavor(cookRatingF);
    setRateBark(cookRatingB);
  }, [(cook as any)?.id, cookRatingT, cookRatingF, cookRatingB]);

  // Confirmed steps
  const [confirmedSteps, setConfirmedSteps] = useState<Record<string, string>>({});
  useEffect(() => {
    const stored = cook?.confirmedSteps;
    setConfirmedSteps(stored && typeof stored === "object" ? stored : {});
  }, [id, cook?.confirmedSteps]);

  // Wrap temp pending
  const [wrapTempPending, setWrapTempPending] = useState<{ key: string; itemIdx: number } | null>(null);
  const [wrapAdjustedFinishMs, setWrapAdjustedFinishMs] = useState<number | null>(null);
  const pendingWrapClearRef = useRef(false);

  useEffect(() => { setWrapAdjustedFinishMs(null); }, [id]);

  const prevFinishWindowRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const current = `${cookFinishLower}|${cookFinishUpper}`;
    const prev = prevFinishWindowRef.current;
    prevFinishWindowRef.current = current;
    if (prev !== undefined && prev !== current) {
      setWrapAdjustedFinishMs(null);
    }
  }, [cookFinishLower, cookFinishUpper]);

  useEffect(() => {
    if (!pendingWrapClearRef.current) return;
    pendingWrapClearRef.current = false;
    setWrapAdjustedFinishMs(null);
  }, [cookDataUpdatedAt]);

  // Thaw state
  const [markingThaw, setMarkingThaw] = useState(false);

  // Checkin modal state
  const [checkinModalVisible, setCheckinModalVisible] = useState(false);
  const [activeCheckin, setActiveCheckin] = useState<ScheduledCheckin | null>(null);
  const [pendingCheckinSc, setPendingCheckinSc] = useState<ScheduledCheckin | null>(null);
  const [firstCheckinNudgeDismissed, setFirstCheckinNudgeDismissed] = useState(false);
  const [plannedCheckinPreviewSc, setPlannedCheckinPreviewSc] = useState<ScheduledCheckin | null>(null);
  const [noPlanScheduledCheckins, setNoPlanScheduledCheckins] = useState<ScheduledCheckin[]>([]);
  const [removedPlannedKeys, setRemovedPlannedKeys] = useState<Set<string>>(new Set());
  const [chatModalVisible, setChatModalVisible] = useState(false);

  useEffect(() => { setNoPlanScheduledCheckins([]); }, [id, cookStatus]);

  useEffect(() => {
    if (Platform.OS === "web" || !id) return;
    loadRemovedCheckinPhaseKeys(Number(id))
      .then((keys) => { setRemovedPlannedKeys(keys); })
      .catch(() => { setRemovedPlannedKeys(new Set()); });
  }, [id]);

  const openCheckin = useCallback((sc: ScheduledCheckin) => {
    setActiveCheckin(sc);
    setCheckinModalVisible(true);
  }, []);

  // Technique picker state
  const [techMethodSheetOpen, setTechMethodSheetOpen] = useState(false);
  const [techInjectionSheetOpen, setTechInjectionSheetOpen] = useState(false);
  const [techSpritzSheetOpen, setTechSpritzSheetOpen] = useState(false);
  const [techWrapFinishSheetOpen, setTechWrapFinishSheetOpen] = useState(false);
  const [techsExpanded, setTechsExpanded] = useState(false);
  const [seqScheduleExpanded, setSeqScheduleExpanded] = useState(false);

  useEffect(() => {
    const seqData = (cook as any)?.sequenceData;
    if ((cookStatus === "planned" || cookStatus === "active") && seqData?.schedule?.length > 0) {
      setSeqScheduleExpanded(true);
    }
  }, [cookStatus, (cook as any)?.id]);

  useEffect(() => {
    if (cookStatus === "planned" || cookStatus === "active") setSeqScheduleExpanded(true);
  }, [cookStatus]);

  const [addToSessionOpen, setAddToSessionOpen] = useState(false);

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
  const editSelectedGrill = useMemo(() => grills.find((g: any) => g.id === editGrillId) ?? null, [grills, editGrillId]);

  // Edit times state
  const [editTimesVisible, setEditTimesVisible] = useState(false);
  const [editTimesSaving, setEditTimesSaving] = useState(false);

  // Expanded sections for analysis
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

  // ── Handlers ──────────────────────────────────────────────────────────────

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
            await cancelStoredFrozenNotifications(Number(id)).catch(() => {});
            await cancelStoredCheckinNotifications(Number(id)).catch(() => {});
            qc.removeQueries({ queryKey: getGetCookQueryKey(Number(id)) });
            qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
            qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
            qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
            qc.invalidateQueries({ queryKey: ["paywall", "usage"] });
            qc.invalidateQueries({ queryKey: ["home", "insights"] });
            router.replace("/(tabs)/cooks" as any);
          } catch (e: any) {
            Alert.alert("Delete Failed", e?.message ?? "Could not delete this cook. Please try again.");
          }
        },
      },
    ]);
  };

  const handleStatusUpdate = async (status: string) => {
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
    try {
      await updateCook.mutateAsync({ id: Number(id), data: updatePayload });
    } catch (e: any) {
      const isTimeout =
        e?.name === "AbortError" ||
        (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert(
        "Couldn't update cook",
        isTimeout
          ? "The request timed out — check your connection and try again."
          : (e?.message || "Something went wrong. Please try again."),
      );
      return;
    }
    // Immediately patch caches so the UI reflects the new status without
    // waiting for a background refetch round-trip.
    const cookIdNum = Number(id);
    const patchedFields: Record<string, unknown> = { status: updatePayload.status };
    if (updatePayload.actualStartAt != null) {
      patchedFields.actualStartAt =
        updatePayload.actualStartAt instanceof Date
          ? updatePayload.actualStartAt.toISOString()
          : updatePayload.actualStartAt;
    }
    if (updatePayload.actualEndAt != null) {
      patchedFields.actualEndAt =
        updatePayload.actualEndAt instanceof Date
          ? updatePayload.actualEndAt.toISOString()
          : updatePayload.actualEndAt;
    }
    qc.setQueryData(getGetCookQueryKey(cookIdNum), (old: any) =>
      old ? { ...old, ...patchedFields } : old,
    );
    qc.setQueriesData<any[]>({ queryKey: getListCooksQueryKey() }, (old) =>
      Array.isArray(old)
        ? old.map((c: any) => (c?.id === cookIdNum ? { ...c, status: updatePayload.status } : c))
        : old,
    );
    qc.setQueriesData<any[]>({ queryKey: getGetRecentCooksQueryKey() }, (old) =>
      Array.isArray(old)
        ? old.map((c: any) => (c?.id === cookIdNum ? { ...c, status: updatePayload.status } : c))
        : old,
    );
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Background refetches to confirm server state — not awaited so they
    // don't delay notification scheduling or the rating prompt below.
    qc.invalidateQueries({ queryKey: getGetCookQueryKey(cookIdNum) });
    qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetRecentCooksQueryKey() });
    qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    qc.invalidateQueries({ queryKey: ["home", "insights"] });

    if (status === "completed" && !(cook as any)?.rating) {
      setShowRatingPrompt(true);
    }

    if ((status === "completed" || status === "cancelled") && id && Platform.OS !== "web") {
      // Probe state cleared via callback in useProbeState (passed externally)
    }

    if (status === "active" && Platform.OS !== "web") {
      const hasPlan = !!cookSeqData?.schedule?.length;
      if (!hasPlan) {
        type CookForCheckinSchedule = { foodType?: string | null; weightLbs?: number | null; plannedEndAt?: string | null };
        const cookFields = cook as CookForCheckinSchedule | undefined;
        const meatOnAtMs = Date.now();
        const foodType: string | null = cookFields?.foodType ?? null;
        const weightLbs: number | null = cookFields?.weightLbs ?? null;
        const estimatedFinishAtMs = cookFields?.plannedEndAt
          ? new Date(cookFields.plannedEndAt).getTime()
          : meatOnAtMs + 6 * 60 * 60 * 1000;
        if (estimatedFinishAtMs > meatOnAtMs) {
          const checkins = generateCheckinSchedule(foodType, meatOnAtMs, estimatedFinishAtMs, null, weightLbs);
          // Defer notification scheduling behind a setTimeout(0) so the
          // status-change re-render (which enables useListCookEvents) gets a
          // committed frame before the notification + query-response callbacks
          // compete for the JS thread, keeping the Activity spinner unblocked.
          setTimeout(() => {
            const cookIdNum = Number(id);
            let gen = 0;
            const isCurrent = () => gen === 0;
            scheduleCheckinNotifications(cookIdNum, checkins, foodType, isCurrent).catch(() => {});
            setNoPlanScheduledCheckins(checkins);
          }, 0);
        }
      }
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
    } catch (e: any) {
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Save failed", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not save changes. Please try again."));
    } finally {
      setEditSaving(false);
    }
  };

  const saveRatings = async (tenderness: number, flavor: number, bark: number) => {
    if (rateSaving) return;
    setRateSaving(true);
    try {
      const nonZero = [tenderness, flavor, bark].filter(v => v > 0);
      const avg = nonZero.length > 0 ? Math.round(nonZero.reduce((s, v) => s + v, 0) / nonZero.length) : null;
      await updateCook.mutateAsync({
        id: Number(id),
        data: { ratingTenderness: tenderness || null, ratingFlavor: flavor || null, ratingBark: bark || null, rating: avg },
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    } catch (e: any) {
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Save failed", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not save ratings. Please try again."));
    } finally {
      setRateSaving(false);
    }
  };

  const toggleConfirmedStep = async (key: string) => {
    const sep = key.indexOf("_");
    const itemIdx = sep >= 0 ? parseInt(key.slice(0, sep), 10) : -1;
    const step = sep >= 0 ? key.slice(sep + 1) : key;
    const prev = confirmedSteps;
    const isConfirming = !prev[key];

    if (isConfirming && step === "wrap" && cookSeqData?.schedule?.[itemIdx]) {
      setWrapTempPending({ key, itemIdx });
      return;
    }

    const prevWrapAdjustedFinishMs = wrapAdjustedFinishMs;
    if (!isConfirming && step === "wrap") {
      setWrapAdjustedFinishMs(null);
    }

    const next = { ...prev };
    const actualTime = new Date();
    if (next[key]) { delete next[key]; } else { next[key] = actualTime.toISOString(); }
    setConfirmedSteps(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let updatedSeqData: SequenceData | null = null;
    const ripplableSteps = ["grillLight", "meatOn", "pullOff"] as const;
    // actualTime is always new Date() regardless of whether the scheduled time has
    // passed yet. This means early-confirms (tapped before the clock time arrives)
    // and late-confirms both flow through the same ripple path — subsequent step
    // timestamps are recalculated from the actual confirmation moment in both cases.
    if (isConfirming && itemIdx >= 0 && cookSeqData?.schedule) {
      const rippleStep = step as (typeof ripplableSteps)[number];
      if ((ripplableSteps as readonly string[]).includes(rippleStep)) {
        const updatedSchedule = rippleScheduleTimestamps(cookSeqData.schedule, itemIdx, rippleStep, actualTime.getTime());
        const maxServeMs = Math.max(0, ...updatedSchedule.map((item: ScheduleItem) =>
          item.estimatedFinishAt ? new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000 : 0));
        updatedSeqData = { ...cookSeqData, schedule: updatedSchedule, ...(maxServeMs > 0 ? { serveAt: new Date(maxServeMs).toISOString() } : {}) };
      }
    }

    try {
      await updateCook.mutateAsync({ id: Number(id), data: { confirmedSteps: next, ...(updatedSeqData ? { sequenceData: updatedSeqData } : {}) } as any });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });

      if (step === "stall" || step === "probeTender") {
        const noteText = step === "stall" ? "Stall detected" : "Probe tender achieved";
        try {
          const token = await getTokenSafe(getToken);
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          if (isConfirming) {
            await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events`, {
              method: "POST", headers,
              body: JSON.stringify({ eventType: "user_note", note: noteText, metadata: { milestoneStep: step } }),
            });
          } else {
            const eventsRes = await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            });
            if (eventsRes.ok) {
              const events: { id: number; eventType: string; note: string | null; metadata: Record<string, unknown> | null }[] = await eventsRes.json();
              const match = [...events].reverse().find((e) => e.eventType === "user_note" && e.metadata?.milestoneStep === step);
              if (match) {
                await fetch(`${API_BASE_URL}/api/cooks/${Number(id)}/events/${match.id}`, {
                  method: "DELETE", headers: token ? { Authorization: `Bearer ${token}` } : {},
                });
              }
            }
          }
          qc.invalidateQueries({ queryKey: [`/api/cooks/${Number(id)}/events`] });
        } catch {}
      }
    } catch (e: any) {
      setConfirmedSteps(prev);
      if (!isConfirming && step === "wrap") setWrapAdjustedFinishMs(prevWrapAdjustedFinishMs);
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Step not saved", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not save step. Please try again."));
    }
  };

  const confirmWrap = async (key: string, itemIdx: number, tempF: number | null) => {
    setWrapTempPending(null);
    const prev = confirmedSteps;
    const actualTime = new Date();
    const next = { ...prev, [key]: actualTime.toISOString() };
    setConfirmedSteps(next);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    let updatedSeqData: SequenceData | null = null;
    if (cookSeqData?.schedule) {
      const updatedSchedule = rippleScheduleTimestamps(cookSeqData.schedule, itemIdx, "wrap", actualTime.getTime(), tempF);
      const maxServeMs = Math.max(0, ...updatedSchedule.map((item: ScheduleItem) =>
        item.estimatedFinishAt ? new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000 : 0));
      updatedSeqData = { ...cookSeqData, schedule: updatedSchedule, ...(maxServeMs > 0 ? { serveAt: new Date(maxServeMs).toISOString() } : {}) };
    }

    if (tempF !== null && updatedSeqData?.schedule?.[0]?.estimatedFinishAt) {
      setWrapAdjustedFinishMs(new Date(updatedSeqData.schedule[0].estimatedFinishAt).getTime());
    }

    try {
      await updateCook.mutateAsync({ id: Number(id), data: { confirmedSteps: next, ...(updatedSeqData ? { sequenceData: updatedSeqData } : {}) } as any });
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
    } catch (e: any) {
      setConfirmedSteps(prev);
      setWrapAdjustedFinishMs(null);
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Step not saved", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not save wrap step. Please try again."));
    }
  };

  const handleMarkThawStarted = useCallback(async () => {
    if (!cook?.id) return;
    setMarkingThaw(true);
    try {
      const actualNow = new Date().toISOString();
      await updateCook.mutateAsync({ id: cook.id, data: { actualThawStartAt: actualNow as any } });

      const currentSeqData = (cook as any)?.sequenceData as SequenceData | null | undefined;
      const frozen = currentSeqData?.frozen;
      if (frozen?.thawStartAt && frozen.thawEndAt) {
        const plannedStartMs = new Date(frozen.thawStartAt as string).getTime();
        const actualStartMs = new Date(actualNow).getTime();
        const diffMs = actualStartMs - plannedStartMs;
        if (Math.abs(diffMs) > 5 * 60_000) {
          const originalDurationMs = new Date(frozen.thawEndAt as string).getTime() - plannedStartMs;
          const adjustedThawEndAt = new Date(actualStartMs + originalDurationMs).toISOString();
          const shiftIso = (iso: string | null | undefined): string | null | undefined => {
            if (!iso) return iso;
            return new Date(new Date(iso).getTime() + diffMs).toISOString();
          };
          const currentSchedule = currentSeqData?.schedule ?? [];
          const updatedSchedule = currentSchedule.map((item: any, idx: number) => {
            if (idx !== 0) return item;
            return { ...item, grillLightAt: shiftIso(item.grillLightAt), meatOnAt: shiftIso(item.meatOnAt) };
          });
          const updatedSeqData: SequenceData = {
            ...currentSeqData,
            schedule: updatedSchedule,
            frozen: { ...frozen, thawStartAt: actualNow, thawEndAt: adjustedThawEndAt },
          };
          const existingPlannedStart = (cook as any)?.plannedStartAt as string | null | undefined;
          const shiftedPlannedStartAt: string | null = existingPlannedStart
            ? new Date(new Date(existingPlannedStart).getTime() + diffMs).toISOString()
            : null;
          await updateCook.mutateAsync({ id: cook.id, data: { sequenceData: updatedSeqData, ...(shiftedPlannedStartAt ? { plannedStartAt: shiftedPlannedStartAt as any } : {}) } as any });
          scheduleFrozenStageNotifications({
            cookId: cook.id, frozen: updatedSeqData.frozen,
            preheatStartAt: shiftedPlannedStartAt, foodType: (frozen as any)?.foodType ?? null,
            includePreheat: cookStatus === "planned", actualThawStartAt: actualNow,
          }).catch(() => {});
        } else {
          scheduleFrozenStageNotifications({
            cookId: cook.id, frozen: frozen as FrozenStageData,
            preheatStartAt: (cook as any)?.plannedStartAt ?? null, foodType: (frozen as any)?.foodType ?? null,
            includePreheat: cookStatus === "planned", actualThawStartAt: actualNow,
          }).catch(() => {});
        }
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(cook.id) });
    } catch (e: any) {
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Error", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not record thaw start time. Please try again."));
    } finally {
      setMarkingThaw(false);
    }
  }, [cook, updateCook, qc, cookStatus]);

  const handleSaveCookTimes = async (meatOnAt: Date, thawStartAt: Date | null) => {
    setEditTimesSaving(true);
    try {
      const payload: Record<string, unknown> = { actualStartAt: meatOnAt.toISOString() };
      if (thawStartAt !== null) payload.actualThawStartAt = thawStartAt.toISOString();
      const updated = await updateCook.mutateAsync({ id: Number(id), data: payload as any });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
      qc.invalidateQueries({ queryKey: getListCooksQueryKey() });
      qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
      setEditTimesVisible(false);
      const freshSchedule =
        ((updated as any)?.sequenceData as SequenceData | undefined)?.schedule ?? cookSeqData?.schedule;
      if (freshSchedule?.length) {
        cancelStoredStepNotifications(Number(id)).catch(() => {});
        scheduleStepNotifications(Number(id), freshSchedule, () => true).catch(() => {});
      }
    } catch (e: any) {
      const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
      Alert.alert("Save failed", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not update cook times. Please try again."));
    } finally {
      setEditTimesSaving(false);
    }
  };

  const handleLogFuelEvent = useCallback(
    async (action: "charcoal" | "wood") => {
      if (!cook?.id) return;
      const eventType = action === "charcoal" ? "charcoal_add" : "wood_add";
      try {
        const token = await getTokenSafe(getToken);
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;
        await fetch(`${API_BASE_URL}/api/cooks/${cook.id}/events`, {
          method: "POST", headers, body: JSON.stringify({ eventType }),
        });
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        qc.invalidateQueries({ queryKey: [`/api/cooks/${cook.id}/events`] });
      } catch (e: any) {
        const isTimeout = e?.name === "AbortError" || (typeof e?.message === "string" && e.message.includes("timed out"));
        Alert.alert("Log failed", isTimeout ? "Request timed out — check your connection and try again." : (e?.message || "Could not log fuel event. Please try again."));
      }
    },
    [cook?.id, getToken, qc],
  );

  // ── Derived presentation values ────────────────────────────────────────────
  const cAny = cook as any ?? {};
  const statusColor = cookStatus ? (STATUS_COLORS[cookStatus] ?? "#6B7280") : "#6B7280";
  const nextStatus: "active" | "completed" | null = cookStatus === "planned" ? "active" : cookStatus === "active" ? "completed" : null;

  const qualFactors = useMemo<QualFactor[]>(() => {
    const items: QualFactor[] = [];
    const breakdown = cookSeqData?.factorBreakdown ?? [];
    const hasSlower = breakdown.some((f: any) => f.label === "Learned Pace (Slower)");
    const fpSrc = cookSeqData?.fingerprintSource;
    if (fpSrc === "grill" || fpSrc === "user") {
      if (!hasSlower) items.push({ label: "Faster Pace", colorHex: "#22C55E", icon: "trending-down" });
      items.push({ label: "Grill Tuned", colorHex: "#22C55E", icon: "activity" });
    }
    if (breakdown.some((f: any) => f.label === "Cold Weather")) items.push({ label: "Cold Weather", colorHex: "#38BDF8", icon: "thermometer" });
    if (breakdown.some((f: any) => f.label === "Grill Load")) items.push({ label: "Grill Load", colorHex: "#F97316", icon: "layers" });
    if (cAny.fromFrozen) items.push({ label: "Frozen", colorHex: "#3B82F6", icon: "box" });
    if (cAny.injection) items.push({ label: "Injection", colorHex: "#8B5CF6", icon: "droplet" });
    if (cAny.wrapMethod) items.push({ label: "Wrap", colorHex: "#F97316", icon: "package" });
    return items;
  }, [cookSeqData, cAny]);

  return {
    // Data
    cook, isLoading, cookDataUpdatedAt, cookStatus, cookSeqData,
    cookFinishLower, cookFinishUpper, cookCurrentTempF,
    cookCheckins, lastCheckin, checkinsLoading,
    allCooksForCount, activeCookCount,
    grills, grillsList,
    // Mutations
    updateCook, deleteCook, dismissCookOutlier, analyzeMutation, createCheckin,
    // Paywall
    showPaywall, parseAndShowFromError, paywallUsage, effectivePro, effectiveProRef, isIdentityLinked,
    // Navigation
    goBack, goHome,
    // Rating state
    rateTenderness, setRateTenderness, rateFlavor, setRateFlavor,
    rateBark, setRateBark, rateSaving, showRatingPrompt, setShowRatingPrompt,
    saveRatings,
    // Confirmed steps
    confirmedSteps, toggleConfirmedStep, confirmWrap,
    wrapTempPending, setWrapTempPending,
    wrapAdjustedFinishMs, setWrapAdjustedFinishMs, pendingWrapClearRef,
    // Thaw
    markingThaw, handleMarkThawStarted,
    // Edit modal
    editVisible, setEditVisible, editGrillPickerVisible, setEditGrillPickerVisible,
    editFoodType, setEditFoodType, editWeight, setEditWeight,
    editCookTemp, setEditCookTemp, editTargetTemp, setEditTargetTemp,
    editGrillId, setEditGrillId, editActualStartDate, setEditActualStartDate,
    editActualEndDate, setEditActualEndDate,
    editStartDateOpen, setEditStartDateOpen, editStartTimeOpen, setEditStartTimeOpen,
    editEndDateOpen, setEditEndDateOpen, editEndTimeOpen, setEditEndTimeOpen,
    editNotes, setEditNotes,
    editCookingMethod, setEditCookingMethod, editInjection, setEditInjection,
    editSpritzFrequency, setEditSpritzFrequency, editWrapFinish, setEditWrapFinish,
    editSaving, editDates, editSelectedGrill,
    openEdit, saveEdit,
    // Edit times
    editTimesVisible, setEditTimesVisible, editTimesSaving, handleSaveCookTimes,
    // Handlers
    handleDelete, handleStatusUpdate, handleLogFuelEvent,
    // Checkin modal
    checkinModalVisible, setCheckinModalVisible,
    activeCheckin, setActiveCheckin,
    pendingCheckinSc, setPendingCheckinSc,
    firstCheckinNudgeDismissed, setFirstCheckinNudgeDismissed,
    plannedCheckinPreviewSc, setPlannedCheckinPreviewSc,
    noPlanScheduledCheckins, setNoPlanScheduledCheckins,
    removedPlannedKeys, setRemovedPlannedKeys,
    chatModalVisible, setChatModalVisible,
    openCheckin,
    // Technique pickers
    techMethodSheetOpen, setTechMethodSheetOpen,
    techInjectionSheetOpen, setTechInjectionSheetOpen,
    techSpritzSheetOpen, setTechSpritzSheetOpen,
    techWrapFinishSheetOpen, setTechWrapFinishSheetOpen,
    techsExpanded, setTechsExpanded,
    seqScheduleExpanded, setSeqScheduleExpanded,
    addToSessionOpen, setAddToSessionOpen,
    // Section toggle
    expandedStoredSections, toggleStoredSection,
    expandedResultSections, toggleResultSection,
    // Misc
    getToken,
    // Derived presentation
    statusColor, nextStatus, qualFactors,
  };
}
