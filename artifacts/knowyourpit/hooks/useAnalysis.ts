import { useState, useEffect, useRef, useCallback } from "react";
import { Alert, AppState } from "react-native";
import type { AppStateStatus } from "react-native";
import { useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@clerk/expo";

import {
  useAnalyzeCook,
  useUpdateCook,
  getGetCookQueryKey,
  getListCooksQueryKey,
  getListCookEventsQueryKey,
} from "@workspace/api-client-react";
import { usePaywall } from "@/contexts/PaywallContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";
import type { PickedImage, Assessment, AnalysisResult } from "@/components/cook-detail/types";
import { VERDICT_CONFIG } from "@/components/cook-detail/constants";
import { getTokenSafe } from "@/lib/getTokenSafe";

interface UseAnalysisParams {
  id: string | undefined;
  cook: any;
  cookStatus: string | undefined;
  probeState: {
    selectedMeaterProbe: any | null;
    selectedBleContextDevice: any | null;
    selectedLanProbe: any | null;
    lanProbes: any[];
    bleContextDevices: any[];
    // Multi-probe support: ordered meat slots with labels
    meatProbeSlots?: Array<{id: string; label: string}>;
    meaterProbes?: any[];
    thermoworksProbes?: any[];
    inkbirdProbes?: any[];
  };
  liveReadings: Array<{ timeMinutes: number; tempF: number }>;
  lastCheckin: any;
  weather: { tempF?: number | null; windSpeedMph?: number | null } | null;
  pendingWrapClearRef: React.MutableRefObject<boolean>;
}

export type AnalysisState = ReturnType<typeof useAnalysis>;

export function useAnalysis({
  id,
  cook,
  cookStatus,
  probeState,
  liveReadings,
  lastCheckin,
  weather,
  pendingWrapClearRef,
}: UseAnalysisParams) {
  const qc = useQueryClient();
  const { getToken } = useAuth();
  const { showPaywall, parseAndShowFromError } = usePaywall();
  const { data: paywallUsage } = usePaywallUsage();
  const analyzeMutation = useAnalyzeCook();
  const updateCook = useUpdateCook();

  const {
    selectedMeaterProbe,
    selectedBleContextDevice,
    selectedLanProbe,
    lanProbes,
    bleContextDevices,
    meatProbeSlots = [],
    meaterProbes = [],
    thermoworksProbes = [],
    inkbirdProbes = [],
  } = probeState;

  // ── QP chip state ────────────────────────────────────────────────────────
  const [qpMethod, setQpMethod] = useState<string | null>(null);
  const [qpStartTemp, setQpStartTemp] = useState<string | null>(null);
  const [qpInjection, setQpInjection] = useState<string | null>(null);
  const [qpSpritz, setQpSpritz] = useState<string | null>(null);
  const [qpWrap, setQpWrap] = useState<string | null>(null);
  const [activeCookNoteTags, setActiveCookNoteTags] = useState<string[]>([]);
  const [cookNotes, setCookNotes] = useState("");
  const [scanNotes, setScanNotes] = useState("");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [cardWidth, setCardWidth] = useState(300);

  // ── Analysis result state ────────────────────────────────────────────────
  const [result, setResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedRationale, setExpandedRationale] = useState<number | null>(null);
  const [showSecondaryDecisions, setShowSecondaryDecisions] = useState(false);
  const [expandedStoredSections, setExpandedStoredSections] = useState<Set<string>>(new Set());

  const toggleStoredSection = useCallback((key: string) => {
    setExpandedStoredSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Auto-grade state ─────────────────────────────────────────────────────
  const [autoGradePaused, setAutoGradePaused] = useState(true);
  const [lastAnalyzedAtMs, setLastAnalyzedAtMs] = useState<number | null>(null);
  const [appActive, setAppActive] = useState<boolean>(AppState.currentState === "active");
  const [isFocused, setIsFocused] = useState(false);
  const AUTO_GRADE_INTERVAL_MS = 30 * 60 * 1000;

  // ── Reset on cook change ─────────────────────────────────────────────────
  useEffect(() => {
    setResult(null);
    setImages([]);
    setCookNotes("");
    setScanNotes("");
    setQpMethod(null);
    setQpStartTemp(null);
    setQpInjection(null);
    setQpSpritz(null);
    setQpWrap(null);
    setActiveCookNoteTags([]);
    setExpandedRationale(null);
    setShowSecondaryDecisions(false);
    setExpandedStoredSections(new Set());
  }, [id]);

  // Build scanNotes from QP chips + free-text notes
  useEffect(() => {
    const parts: string[] = [];
    if (qpMethod) parts.push(`Method: ${qpMethod}`);
    if (qpStartTemp) parts.push(`Start temp: ${qpStartTemp}`);
    if (qpInjection) parts.push(`Injection: ${qpInjection}`);
    if (qpSpritz) parts.push(`Spritz: ${qpSpritz}`);
    if (qpWrap) parts.push(`Wrap: ${qpWrap}`);
    if (activeCookNoteTags.length > 0) parts.push(activeCookNoteTags.join(", "));
    const chipText = parts.join(" · ");
    const combined = [chipText, cookNotes.trim()].filter(Boolean).join("\n\n");
    setScanNotes(combined);
  }, [qpMethod, qpStartTemp, qpInjection, qpSpritz, qpWrap, activeCookNoteTags, cookNotes]);

  // Seed lastAnalyzedAtMs from server
  useEffect(() => {
    const cookAny = cook as any;
    const stored = cookAny?.analysisResult?.analyzedAt as string | null | undefined;
    const hist = Array.isArray(cookAny?.analysisHistory) ? cookAny.analysisHistory : [];
    const histLast = hist.length > 0 ? (hist[hist.length - 1]?.savedAt ?? hist[hist.length - 1]?.analyzedAt ?? null) : null;
    const raw = stored ?? histLast ?? null;
    if (!raw) return;
    const ms = new Date(raw).getTime();
    if (!Number.isFinite(ms)) return;
    setLastAnalyzedAtMs((prev) => (prev != null && prev > ms ? prev : ms));
  }, [(cook as any)?.id, (cook as any)?.analysisResult?.analyzedAt, (cook as any)?.analysisHistory?.length]);

  // Sync auto-grade pause with subscription
  useEffect(() => {
    if (paywallUsage?.unlimited) {
      setAutoGradePaused(false);
    } else if (paywallUsage && !paywallUsage.unlimited) {
      setAutoGradePaused(true);
    }
  }, [paywallUsage?.unlimited]);

  // AppState foreground/background tracking
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      setAppActive(state === "active");
    });
    return () => sub.remove();
  }, []);

  // Screen focus tracking
  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, []),
  );

  // ── Core analyze function ────────────────────────────────────────────────
  const analyze = useCallback(async (opts: {
    auto?: boolean;
    extraNotes?: string;
    checkinOverride?: { internalTempF: number | null; pitTempF: number | null };
  } = {}) => {
    const auto = opts.auto === true;
    const notesForAnalysis = opts.extraNotes != null
      ? [opts.extraNotes.trim(), scanNotes.trim()].filter(Boolean).join(" · ")
      : scanNotes.trim();

    const c = cook as any;
    const liveMeaterInternalTempF = selectedMeaterProbe?.internalTempF != null ? (selectedMeaterProbe.internalTempF as number) : null;
    const liveBleInternalTempF = selectedBleContextDevice?.probeTempF ?? null;
    const liveBleAmbientTempF = selectedBleContextDevice?.ambientTempF ?? null;
    const liveLanInternalTempF = selectedLanProbe?.probeTempF ?? null;
    const liveLanAmbientTempF = selectedLanProbe?.ambientTempF ?? null;
    const hasMeaterTemp = liveMeaterInternalTempF != null;
    const hasLiveProbeTemp = liveBleInternalTempF != null || liveLanInternalTempF != null;

    const resolvedInternalTempF =
      liveMeaterInternalTempF ??
      liveBleInternalTempF ??
      liveLanInternalTempF ??
      opts.checkinOverride?.internalTempF ??
      lastCheckin?.internalTempF ??
      null;

    let snapshotTempSourceLabel: string | null = null;
    if (liveMeaterInternalTempF != null) snapshotTempSourceLabel = selectedMeaterProbe?.deviceName ?? "MEATER Probe";
    else if (liveBleInternalTempF != null) snapshotTempSourceLabel = selectedBleContextDevice?.name ?? "BLE Probe";
    else if (liveLanInternalTempF != null) snapshotTempSourceLabel = selectedLanProbe?.deviceName ?? "LAN Probe";
    else if (opts.checkinOverride?.internalTempF != null) snapshotTempSourceLabel = "Manual Entry";
    else if (lastCheckin?.internalTempF != null) snapshotTempSourceLabel = "Last Check-In";

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
      if (auto) return;
      if (cookStatus === "active") {
        Alert.alert("Nothing to check in with", "Log a check-in with your probe and pit temperatures, or add a note about what's happening.");
      } else {
        Alert.alert("Add something", "Upload a thermometer image, enter your temperature reading, or add cook notes before analyzing.");
      }
      return;
    }

    if (!auto) {
      setAnalyzing(true);
      setResult(null);
    }
    try {
      // Pre-warm the Clerk JWT before the mutation so customFetch finds a
      // valid token in Clerk's cache and never has to wait up to 3 s for it.
      // If the token isn't available after 10 s the session is genuinely gone —
      // bail out with a soft message rather than making an auth-less request
      // that triggers the global 401 → sign-out chain.
      const preWarmedToken = await getTokenSafe(getToken, 10000);
      if (!preWarmedToken) {
        if (!auto) {
          setAnalyzing(false);
          Alert.alert(
            "Session issue",
            "Couldn't reach your session. Please tap Check In again in a moment.",
          );
        }
        return;
      }

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
            userEnteredTempF: resolvedInternalTempF,
            liveReadings: liveReadings.length >= 2 ? liveReadings : null,
            elapsedMinutes: c?.actualStartAt ? Math.round((Date.now() - new Date(c.actualStartAt).getTime()) / 60000) : null,
            currentPitTempF: resolvedPitTempF,
            outdoorTempF: weather?.tempF ?? null,
            cookStatus: c?.status ?? null,
            cookingMethod: c?.cookingMethod ?? null,
            injection: c?.injection ?? null,
            spritzFrequency: c?.spritzFrequency ?? null,
            wrapFinish: c?.wrapFinish ?? null,
            fromFrozen: c?.fromFrozen ?? false,
            thawMethod: c?.thawMethod ?? null,
            actualThawStartAt: c?.actualThawStartAt ? new Date(c.actualThawStartAt).toISOString() : null,
            actualEndAt: c?.actualEndAt ? new Date(c.actualEndAt).toISOString() : null,
            stepDrift: (() => {
              const seqData = c.sequenceData as { schedule: any[] } | null | undefined;
              const confSteps = c.confirmedSteps as Record<string, string> | null | undefined;
              if (!seqData?.schedule?.length || !confSteps || !Object.keys(confSteps).length) return null;

              // Find item index matching this cook (same logic as CookTimelineSection)
              const cookFT = (c.foodType ?? "").toLowerCase().trim();
              const meatOnMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
              let itemIdx = 0;
              if (meatOnMs !== null) {
                let bestDelta = Infinity;
                seqData.schedule.forEach((schedItem: any, idx: number) => {
                  if ((schedItem.foodType ?? "").toLowerCase().trim() !== cookFT) return;
                  const t = schedItem.meatOnAt ? new Date(schedItem.meatOnAt).getTime() : null;
                  if (t === null) return;
                  const delta = Math.abs(t - meatOnMs);
                  if (delta < bestDelta) { bestDelta = delta; itemIdx = idx; }
                });
              }

              const schedItem = seqData.schedule[itemIdx];
              if (!schedItem) return null;

              const steps: Array<{ stepKey: string; stepLabel: string; plannedAt: string; actualAt: string; deltaMinutes: number }> = [];

              const grillLightActual = confSteps[`${itemIdx}_grillLight`];
              if (schedItem.grillLightAt && grillLightActual) {
                const deltaMs = new Date(grillLightActual).getTime() - new Date(schedItem.grillLightAt).getTime();
                steps.push({ stepKey: "grillLight", stepLabel: "Light grill", plannedAt: schedItem.grillLightAt, actualAt: grillLightActual, deltaMinutes: Math.round(deltaMs / 60000) });
              }

              const meatOnActual = confSteps[`${itemIdx}_meatOn`];
              if (schedItem.meatOnAt && meatOnActual) {
                const deltaMs = new Date(meatOnActual).getTime() - new Date(schedItem.meatOnAt).getTime();
                steps.push({ stepKey: "meatOn", stepLabel: "Meat on", plannedAt: schedItem.meatOnAt, actualAt: meatOnActual, deltaMinutes: Math.round(deltaMs / 60000) });
              }

              const wrapActual = confSteps[`${itemIdx}_wrap`];
              if (schedItem.wrapMethod && schedItem.wrapMethod !== "none" && schedItem.meatOnAt && (schedItem.wrapAtMinutes ?? 0) > 0 && wrapActual) {
                const plannedWrapAt = new Date(new Date(schedItem.meatOnAt).getTime() + (schedItem.wrapAtMinutes ?? 0) * 60000).toISOString();
                const deltaMs = new Date(wrapActual).getTime() - new Date(plannedWrapAt).getTime();
                steps.push({ stepKey: "wrap", stepLabel: "Wrap", plannedAt: plannedWrapAt, actualAt: wrapActual, deltaMinutes: Math.round(deltaMs / 60000) });
              }

              const pullOffActual = confSteps[`${itemIdx}_pullOff`];
              if (schedItem.estimatedFinishAt && pullOffActual) {
                const deltaMs = new Date(pullOffActual).getTime() - new Date(schedItem.estimatedFinishAt).getTime();
                steps.push({ stepKey: "pullOff", stepLabel: "Pull off", plannedAt: schedItem.estimatedFinishAt, actualAt: pullOffActual, deltaMinutes: Math.round(deltaMs / 60000) });
              }

              const serveActual = confSteps[`${itemIdx}_serve`];
              if ((schedItem.restMinutes ?? 0) > 0 && schedItem.estimatedFinishAt && serveActual) {
                const plannedServeAt = new Date(new Date(schedItem.estimatedFinishAt).getTime() + (schedItem.restMinutes ?? 0) * 60000).toISOString();
                const deltaMs = new Date(serveActual).getTime() - new Date(plannedServeAt).getTime();
                steps.push({ stepKey: "serve", stepLabel: "Ready to serve", plannedAt: plannedServeAt, actualAt: serveActual, deltaMinutes: Math.round(deltaMs / 60000) });
              }

              return steps.length > 0 ? steps : null;
            })(),
            probeChannels: (() => {
              const channels: Array<{ channelLabel: string; probeTempF: number }> = [];
              // Multi-probe: include all assigned meat slots with their labels
              const addedKeys = new Set<string>();
              for (const slot of meatProbeSlots) {
                const k = slot.id;
                addedKeys.add(k);
                let temp: number | null = null;
                if (k.startsWith("lan_")) {
                  temp = (lanProbes as any[]).find((p: any) => `lan_${p.deviceId}` === k)?.probeTempF ?? null;
                } else if (k.startsWith("ble_")) {
                  temp = (inkbirdProbes as any[]).find((p: any) => `ble_${p.deviceId}_${p.probeIndex}` === k)?.tempF ?? null;
                } else if (k.startsWith("bleCtx_")) {
                  temp = (bleContextDevices as any[]).find((d: any) => `bleCtx_${d.id}` === k)?.probeTempF ?? null;
                } else if (k.startsWith("tw_")) {
                  temp = (thermoworksProbes as any[]).find((p: any) => `tw_${p.deviceId}_${p.channelNumber}` === k)?.tempF ?? null;
                } else {
                  // MEATER — deviceId direct
                  temp = (meaterProbes as any[]).find((p: any) => p.deviceId === k)?.internalTempF ?? null;
                }
                if (temp != null) channels.push({ channelLabel: slot.label, probeTempF: temp });
              }
              // Fallback: add any lan / bleCtx probes not already in a slot
              for (const p of lanProbes) {
                if (!addedKeys.has(`lan_${(p as any).deviceId}`)) {
                  channels.push({ channelLabel: (p as any).channelLabel, probeTempF: (p as any).probeTempF });
                }
              }
              for (const d of bleContextDevices) {
                if (!addedKeys.has(`bleCtx_${(d as any).id}`) && (d as any).probeTempF != null) {
                  channels.push({ channelLabel: (d as any).name, probeTempF: (d as any).probeTempF });
                }
              }
              return channels.length > 0 ? channels : null;
            })(),
          },
        } as any,
      });

      setResult(data);
      setExpandedRationale(null);

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
      pendingWrapClearRef.current = true;
      qc.invalidateQueries({ queryKey: getGetCookQueryKey(Number(id)) });
      setLastAnalyzedAtMs(Date.now());
      if (paywallUsage?.unlimited) setAutoGradePaused(false);
      if (!auto) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      if (auto) {
        const status = (e as any)?.status ?? (e as any)?.statusCode ?? (e as any)?.response?.status ?? null;
        if (status === 402) setAutoGradePaused(true);
        return;
      }
      if (parseAndShowFromError(e, { foodType: cook?.foodType ?? null })) return;
      const serverMsg = (e as any)?.response?.data?.error ?? (e as any)?.data?.error ?? null;
      Alert.alert("Analysis failed", typeof serverMsg === "string" ? serverMsg : "Could not analyze the cook. Please check your connection and try again.");
    } finally {
      if (!auto) setAnalyzing(false);
    }
  }, [
    id, cook, cookStatus, scanNotes, images, liveReadings, weather, lastCheckin,
    selectedMeaterProbe, selectedBleContextDevice, selectedLanProbe,
    paywallUsage, analyzeMutation, updateCook, qc, pendingWrapClearRef,
    parseAndShowFromError, lanProbes, bleContextDevices,
    meatProbeSlots, meaterProbes, thermoworksProbes, inkbirdProbes,
  ]);

  // Auto-grade tick ref (mutable ref so timer callback always gets latest values)
  const autoTickRef = useRef({ analyze, scanNotes, lastCheckinInternalTempF: null as number | null, selectedMeaterProbeTemp: null as number | null, analyzing, hasActiveProbe: false });
  useEffect(() => {
    autoTickRef.current = {
      analyze,
      scanNotes,
      lastCheckinInternalTempF: lastCheckin?.internalTempF ?? null,
      selectedMeaterProbeTemp: selectedMeaterProbe?.internalTempF ?? null,
      analyzing,
      hasActiveProbe: selectedMeaterProbe != null || selectedBleContextDevice != null || selectedLanProbe != null,
    };
  });

  // Auto-grade interval
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
      if (cur.analyzing) { timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS); return; }
      const hasCheckinTemp = cur.lastCheckinInternalTempF != null;
      const hasMeaterTemp = cur.selectedMeaterProbeTemp != null;
      const hasNotes = cur.scanNotes.trim().length > 0;
      if (!hasCheckinTemp && !hasMeaterTemp && !hasNotes) { timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS); return; }
      if (!cur.hasActiveProbe) { timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS); return; }
      try { await cur.analyze({ auto: true }); } catch {}
      if (cancelled) return;
      timer = setTimeout(tick, AUTO_GRADE_INTERVAL_MS);
    };

    const elapsed = lastAnalyzedAtMs != null ? Date.now() - lastAnalyzedAtMs : Infinity;
    const wait = elapsed >= AUTO_GRADE_INTERVAL_MS ? 0 : AUTO_GRADE_INTERVAL_MS - elapsed;
    timer = setTimeout(tick, wait);
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [cookStatus, autoGradePaused, appActive, isFocused, lastAnalyzedAtMs, AUTO_GRADE_INTERVAL_MS]);

  // Upgrade auto-grade press handler
  const onUpgradeAutoGradePress = useCallback(() => {
    showPaywall({ trigger: "pro_required", featureName: "Live auto-grading", foodType: cook?.foodType ?? null });
  }, [showPaywall, cook]);

  // Image pickers
  const pickImages = useCallback(async () => {
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
  }, []);

  const takePhoto = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission needed", "Allow camera access to take photos"); return; }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
    if (!res.canceled && res.assets[0].base64) {
      setImages((prev) => [...prev, { uri: res.assets[0].uri, base64: res.assets[0].base64!, mimeType: (res.assets[0].mimeType as string) || "image/jpeg" }].slice(0, 5));
      setResult(null);
    }
  }, []);

  const removeImage = useCallback((idx: number) => { setImages((p) => p.filter((_, i) => i !== idx)); setResult(null); }, []);

  const onCardLayout = useCallback((e: any) => {
    const w = e.nativeEvent.layout.width - 32;
    if (w > 100) setCardWidth(w);
  }, []);

  // Stored analysis values
  const storedAnalysis = (cook as any)?.analysisResult as AnalysisResult | null | undefined;
  const storedAssessment = storedAnalysis?.assessment ?? null;
  const storedVerdictCfg = storedAssessment ? (VERDICT_CONFIG[storedAssessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;
  const storedGraphProbes = (storedAnalysis?.probes ?? []).filter((p: any) => p.timeSeries && p.timeSeries.length >= 2);

  // Live result
  const assessment = result?.assessment as Assessment | null | undefined;
  const verdictCfg = assessment ? (VERDICT_CONFIG[assessment.verdict] ?? VERDICT_CONFIG.needs_work) : null;

  return {
    // QP chip state
    qpMethod, setQpMethod,
    qpStartTemp, setQpStartTemp,
    qpInjection, setQpInjection,
    qpSpritz, setQpSpritz,
    qpWrap, setQpWrap,
    activeCookNoteTags, setActiveCookNoteTags,
    cookNotes, setCookNotes,
    scanNotes,
    // Image state
    images, setImages,
    pickImages, takePhoto, removeImage,
    // Result state
    result, setResult,
    analyzing,
    expandedRationale, setExpandedRationale,
    showSecondaryDecisions, setShowSecondaryDecisions,
    expandedStoredSections, toggleStoredSection,
    // Analysis function
    analyze,
    // Auto-grade
    autoGradePaused, setAutoGradePaused,
    lastAnalyzedAtMs, setLastAnalyzedAtMs,
    appActive, isFocused,
    onUpgradeAutoGradePress,
    // Stored analysis
    storedAnalysis, storedAssessment, storedVerdictCfg, storedGraphProbes,
    // Live result assessment
    assessment, verdictCfg,
    // Card layout
    cardWidth, onCardLayout,
  };
}
