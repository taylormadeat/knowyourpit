import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Platform, Animated } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import type { UseMutateAsyncFunction } from "@tanstack/react-query";

import {
  useListCooks,
  getListCooksQueryKey,
  getGetMeaterReadingsQueryKey,
  getGetThermoworksReadingsQueryKey,
  useGetMeaterReadings,
  useGetThermoworksReadings,
} from "@workspace/api-client-react";
import { getProbePollingIntervalMs } from "@/constants/polling";
import {
  loadProbeState,
  saveMeatProbeId,
  savePitProbeId,
  saveProbeLabels,
  buildUpdatedProbeLabels,
  clearLastInkbird,
} from "@/utils/probePersistence";
import { useInkbirdBLE } from "@/hooks/useInkbirdBLE";
import { useBleProbes } from "@/contexts/BleProbeContext";
import { useLanProbes, type LanProbeReading } from "@/hooks/useLanProbes";
import { usePaywall } from "@/contexts/PaywallContext";

interface UseProbeStateParams {
  id: string | undefined;
  cookStatus: string | undefined;
  effectivePro: boolean;
  effectiveProRef: React.MutableRefObject<boolean>;
  updateCookMutate: (args: any) => void;
  cook: any;
  allCooksForCount: any[] | undefined;
}

export type ProbeState = ReturnType<typeof useProbeState>;

// Persists across remounts within a single app session (module scope survives navigation)
const SESSION_TEMP_MODES = new Map<string, "probe" | "manual">();

export function useProbeState({
  id,
  cookStatus,
  effectivePro,
  effectiveProRef,
  updateCookMutate,
  cook,
  allCooksForCount,
}: UseProbeStateParams) {
  const { showPaywall } = usePaywall();
  const cookId = Number(id);

  // v2 multi-probe: ordered meat slots. selectedMeatProbeId is derived as first slot's id.
  const [meatProbeSlots, setMeatProbeSlots] = useState<Array<{id: string; label: string}>>([]);
  const selectedMeatProbeId = meatProbeSlots[0]?.id ?? null;
  const [selectedPitProbeId, setSelectedPitProbeId] = useState<string | null>(null);
  const [probeLabels, setProbeLabelsState] = useState<Record<string, string>>({});
  const [otherCookAssignments, setOtherCookAssignments] = useState<Record<string, string>>({});
  const [tempMode, setTempModeState] = useState<"probe" | "manual">(
    () => (id ? (SESSION_TEMP_MODES.get(String(id)) ?? "manual") : "manual"),
  );

  const setTempMode = useCallback(
    (mode: "probe" | "manual") => {
      if (mode === "probe" && !effectivePro) {
        showPaywall({ trigger: "pro_required", featureName: "Live Thermometer Connection" });
        return;
      }
      setTempModeState(mode);
      if (id) SESSION_TEMP_MODES.set(String(id), mode);
    },
    [id, effectivePro, showPaywall],
  );

  useEffect(() => {
    setMeatProbeSlots([]);
    setSelectedPitProbeId(null);
    setProbeLabelsState({});
  }, [id]);

  // Rehydrate probe state from server or AsyncStorage
  useEffect(() => {
    const currentStatus = (cook as any)?.status;
    if (Platform.OS === "web" || !id || currentStatus !== "active") return;
    const sessionMode = SESSION_TEMP_MODES.get(String(id));

    (async () => {
      try {
        let meatProbeId: string | null;
        let pitProbeId: string | null;
        let resolvedLabels: Record<string, string>;

        const serverAssignments = (cook as any)?.probeAssignments as {
          meatProbes?: Array<{id: string; label: string}> | null;
          meatProbeId?: string | null;
          pitProbeId?: string | null;
          labels?: Record<string, string>;
        } | null | undefined;

        let resolvedMeatSlots: Array<{id: string; label: string}>;
        if (serverAssignments !== null && serverAssignments !== undefined) {
          // Prefer new meatProbes array; fall back to legacy meatProbeId for pre-v2 records
          resolvedMeatSlots = Array.isArray(serverAssignments.meatProbes) && serverAssignments.meatProbes.length > 0
            ? serverAssignments.meatProbes
            : serverAssignments.meatProbeId
              ? [{id: serverAssignments.meatProbeId, label: "Internal"}]
              : [];
          meatProbeId = resolvedMeatSlots[0]?.id ?? null;
          pitProbeId = serverAssignments.pitProbeId ?? null;
          resolvedLabels = serverAssignments.labels ?? {};
          await Promise.all([
            saveMeatProbeId(id, meatProbeId, AsyncStorage),
            savePitProbeId(id, pitProbeId, AsyncStorage),
            saveProbeLabels(id, resolvedLabels, AsyncStorage),
          ]).catch(() => {});
        } else {
          const local = await loadProbeState(id, AsyncStorage);
          meatProbeId = local.meatProbeId;
          pitProbeId = local.pitProbeId;
          resolvedLabels = local.probeLabels;
          resolvedMeatSlots = meatProbeId ? [{id: meatProbeId, label: "Internal"}] : [];
        }

        setMeatProbeSlots(resolvedMeatSlots);
        setSelectedPitProbeId(pitProbeId);
        setProbeLabelsState(resolvedLabels);
        if (meatProbeId != null && sessionMode == null) {
          if (effectiveProRef.current) {
            setTempModeState("probe");
            SESSION_TEMP_MODES.set(String(id), "probe");
          }
        } else if (sessionMode != null) {
          setTempModeState(sessionMode);
        }
      } catch {
        setMeatProbeSlots([]);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, (cook as any)?.status, (cook as any)?.probeAssignments]);

  // Other cook assignments
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

  // Probe polling interval
  const probeIntervalRef = useRef<number>(getProbePollingIntervalMs(null, false));
  const probeIntervalSet = useRef(false);
  if (!probeIntervalSet.current && cook != null) {
    probeIntervalSet.current = true;
    const durMins = cook.plannedStartAt && cook.plannedEndAt
      ? Math.round((new Date(cook.plannedEndAt).getTime() - new Date(cook.plannedStartAt).getTime()) / 60000)
      : null;
    const pa = (cook as any)?.probeAssignments as { meatProbes?: Array<{id: string}> | null; meatProbeId?: string | null; pitProbeId?: string | null } | null;
    const hasMeatProbe = (pa?.meatProbes?.length ?? 0) > 0 || pa?.meatProbeId != null;
    probeIntervalRef.current = getProbePollingIntervalMs(durMins, hasMeatProbe || pa?.pitProbeId != null);
  }
  const probeIntervalMs = probeIntervalRef.current;

  const { data: meaterData, isLoading: meaterLoading, dataUpdatedAt: meaterDataUpdatedAt } = useGetMeaterReadings({
    query: {
      queryKey: getGetMeaterReadingsQueryKey(),
      enabled: cookStatus === "active",
      refetchInterval: cookStatus === "active" ? probeIntervalMs : false,
    },
  });
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

  // Probe derivations
  const selectedMeaterProbe = selectedMeatProbeId != null
    ? (meaterProbes.find((p) => p.deviceId === selectedMeatProbeId) ?? null) : null;
  const selectedMeaterPitProbe = selectedPitProbeId != null
    ? (meaterProbes.find((p) => p.deviceId === selectedPitProbeId) ?? null) : null;
  const selectedThermoworksMeatProbe = selectedMeatProbeId != null
    ? (thermoworksProbes.find((p: any) => `tw_${p.deviceId}_${p.channelNumber}` === selectedMeatProbeId) ?? null) : null;
  const selectedThermoworksPitProbe = selectedPitProbeId != null
    ? (thermoworksProbes.find((p: any) => `tw_${p.deviceId}_${p.channelNumber}` === selectedPitProbeId) ?? null) : null;
  const selectedThermoworksProbe = selectedThermoworksMeatProbe;

  // BLE — include ALL meat probe slots so each slot's BLE probe stays scanned
  const bleAssignedProbeKeys = [
    ...meatProbeSlots.map(s => s.id),
    selectedPitProbeId,
  ].filter((k): k is string => k != null && k.startsWith("ble_"));
  const { probes: inkbirdProbes, scanning: inkbirdScanning, reconnecting: inkbirdReconnecting, lastKnownDeviceId: lastKnownInkbirdDeviceId, rescan: inkbirdRescan } = useInkbirdBLE({
    enabled: cookStatus === "active" && tempMode === "probe",
    assignedProbeKeys: bleAssignedProbeKeys,
  });

  const { devices: allBleDevices, reconnectBanner, dismissReconnectBanner, setHasActiveCook, reconnecting: bleCtxReconnecting, startScan: bleScan, stopScan: bleStop } = useBleProbes();

  const combinedReconnecting = inkbirdReconnecting || bleCtxReconnecting;

  useEffect(() => {
    setHasActiveCook(cookStatus === "active");
    return () => setHasActiveCook(false);
  }, [cookStatus, setHasActiveCook]);

  const bleContextDevices = allBleDevices.filter((d) => d.connectionState === "connected" && d.paired);

  const { probes: lanProbes, scan: scanLan } = useLanProbes({ enabled: cookStatus === "active" && tempMode === "probe", pollIntervalMs: 15_000 });

  const handleRestartScan = useCallback(() => { bleStop(); bleScan(); scanLan(); inkbirdRescan(); }, [bleStop, bleScan, scanLan, inkbirdRescan]);

  const selectedLanProbe: LanProbeReading | null = selectedMeatProbeId?.startsWith("lan_")
    ? (lanProbes.find((p) => `lan_${p.deviceId}` === selectedMeatProbeId) ?? null) : null;
  const selectedLanPitProbe: LanProbeReading | null = selectedPitProbeId?.startsWith("lan_")
    ? (lanProbes.find((p) => `lan_${p.deviceId}` === selectedPitProbeId) ?? null) : null;

  const selectedInkbirdProbe = selectedMeatProbeId?.startsWith("ble_")
    ? (inkbirdProbes.find((p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedMeatProbeId) ?? null) : null;
  const selectedInkbirdPitProbe = selectedPitProbeId?.startsWith("ble_")
    ? (inkbirdProbes.find((p) => `ble_${p.deviceId}_${p.probeIndex}` === selectedPitProbeId) ?? null) : null;

  const selectedBleContextDevice = selectedMeatProbeId?.startsWith("bleCtx_")
    ? (bleContextDevices.find((d) => `bleCtx_${d.id}` === selectedMeatProbeId) ?? null) : null;
  const selectedBleContextPitDevice = selectedPitProbeId?.startsWith("bleCtx_")
    ? (bleContextDevices.find((d) => `bleCtx_${d.id}` === selectedPitProbeId) ?? null) : null;

  const hasActiveProbe =
    // Primary slot + pit (existing checks)
    selectedMeaterProbe?.internalTempF != null ||
    selectedMeaterPitProbe?.internalTempF != null ||
    (selectedThermoworksProbe != null && (selectedThermoworksProbe as any).tempF != null) ||
    (selectedThermoworksPitProbe != null && (selectedThermoworksPitProbe as any).tempF != null) ||
    selectedInkbirdProbe?.tempF != null ||
    selectedInkbirdPitProbe?.tempF != null ||
    selectedBleContextDevice?.probeTempF != null ||
    selectedBleContextPitDevice?.probeTempF != null ||
    selectedLanProbe?.probeTempF != null ||
    selectedLanPitProbe?.probeTempF != null ||
    // Additional meat probe slots (slot 2+): check each probe source
    meatProbeSlots.slice(1).some(slot => {
      const k = slot.id;
      if (k.startsWith("tw_"))      return thermoworksProbes.some((p: any) => `tw_${p.deviceId}_${p.channelNumber}` === k && p.tempF != null);
      if (k.startsWith("ble_"))     return inkbirdProbes.some(p => `ble_${p.deviceId}_${p.probeIndex}` === k && p.tempF != null);
      if (k.startsWith("bleCtx_"))  return bleContextDevices.some(d => `bleCtx_${d.id}` === k && d.probeTempF != null);
      if (k.startsWith("lan_"))     return lanProbes.some(p => `lan_${p.deviceId}` === k && p.probeTempF != null);
      return meaterProbes.some((p: any) => p.deviceId === k && p.internalTempF != null);
    });

  // Probe handlers

  /** Toggle a probe in/out of the meat slots array. Passing null clears all slots. */
  const handleSelectMeatProbe = useCallback((probeId: string | null) => {
    if (probeId != null) setTempMode("probe");
    const nextSlots: Array<{id: string; label: string}> = probeId === null
      ? []
      : meatProbeSlots.some(s => s.id === probeId)
        // Toggle off: remove this probe from slots
        ? meatProbeSlots.filter(s => s.id !== probeId)
        // Toggle on: add as new slot ("Internal" for first, "Probe N" for additional)
        : [...meatProbeSlots, { id: probeId, label: meatProbeSlots.length === 0 ? "Internal" : `Probe ${meatProbeSlots.length + 1}` }];
    setMeatProbeSlots(nextSlots);
    if (Platform.OS !== "web" && id) {
      saveMeatProbeId(id, nextSlots[0]?.id ?? null, AsyncStorage);
      if (probeId === null && selectedMeatProbeId?.startsWith("ble_")) clearLastInkbird(AsyncStorage);
      updateCookMutate({ id: cookId, data: { probeAssignments: { meatProbes: nextSlots, meatProbeId: nextSlots[0]?.id ?? null, pitProbeId: selectedPitProbeId, labels: probeLabels } } });
    }
  }, [id, cookId, setTempMode, meatProbeSlots, selectedMeatProbeId, selectedPitProbeId, probeLabels, updateCookMutate]);

  /** Add a probe to the meat slots with an explicit label (slot 2+, called from "Add probe slot" UI). */
  const handleAddMeatProbeSlot = useCallback((probeId: string, label: string) => {
    if (meatProbeSlots.some(s => s.id === probeId)) return;
    const nextSlots = [...meatProbeSlots, { id: probeId, label }];
    setMeatProbeSlots(nextSlots);
    setTempMode("probe");
    if (Platform.OS !== "web" && id) {
      saveMeatProbeId(id, nextSlots[0]?.id ?? null, AsyncStorage);
      updateCookMutate({ id: cookId, data: { probeAssignments: { meatProbes: nextSlots, meatProbeId: nextSlots[0]?.id ?? null, pitProbeId: selectedPitProbeId, labels: probeLabels } } });
    }
  }, [id, cookId, meatProbeSlots, selectedPitProbeId, probeLabels, updateCookMutate, setTempMode]);

  /** Remove a specific probe from the meat slots by its key. */
  const handleRemoveMeatProbeSlot = useCallback((probeId: string) => {
    const nextSlots = meatProbeSlots.filter(s => s.id !== probeId);
    setMeatProbeSlots(nextSlots);
    if (Platform.OS !== "web" && id) {
      saveMeatProbeId(id, nextSlots[0]?.id ?? null, AsyncStorage);
      if (probeId.startsWith("ble_") && nextSlots.every(s => !s.id.startsWith("ble_"))) clearLastInkbird(AsyncStorage);
      updateCookMutate({ id: cookId, data: { probeAssignments: { meatProbes: nextSlots, meatProbeId: nextSlots[0]?.id ?? null, pitProbeId: selectedPitProbeId, labels: probeLabels } } });
    }
  }, [id, cookId, meatProbeSlots, selectedPitProbeId, probeLabels, updateCookMutate]);

  const handleSelectPitProbe = useCallback((probeId: string | null) => {
    setSelectedPitProbeId(probeId);
    if (Platform.OS !== "web" && id) {
      savePitProbeId(id, probeId, AsyncStorage);
      if (probeId === null && selectedPitProbeId?.startsWith("ble_")) clearLastInkbird(AsyncStorage);
      updateCookMutate({ id: cookId, data: { probeAssignments: { meatProbes: meatProbeSlots, meatProbeId: selectedMeatProbeId, pitProbeId: probeId, labels: probeLabels } } });
    }
  }, [id, cookId, meatProbeSlots, selectedMeatProbeId, selectedPitProbeId, probeLabels, updateCookMutate]);

  const handleSetProbeLabel = useCallback((probeKey: string, label: string) => {
    // Also update the label stored in the slot if this probe is a meat slot
    const slotIdx = meatProbeSlots.findIndex(s => s.id === probeKey);
    const nextSlots = slotIdx >= 0
      ? meatProbeSlots.map((s, i) => i === slotIdx ? {...s, label} : s)
      : meatProbeSlots;
    if (slotIdx >= 0) setMeatProbeSlots(nextSlots);
    setProbeLabelsState((prev) => {
      const next = buildUpdatedProbeLabels(prev, probeKey, label);
      if (Platform.OS !== "web" && id) {
        saveProbeLabels(id, next, AsyncStorage);
        updateCookMutate({ id: cookId, data: { probeAssignments: { meatProbes: nextSlots, meatProbeId: nextSlots[0]?.id ?? null, pitProbeId: selectedPitProbeId, labels: next } } });
      }
      return next;
    });
  }, [id, cookId, meatProbeSlots, selectedPitProbeId, updateCookMutate]);

  // Clear probe state (called when cook is completed/cancelled)
  const clearProbeState = useCallback(() => {
    setMeatProbeSlots([]);
    setSelectedPitProbeId(null);
    if (id && Platform.OS !== "web") {
      AsyncStorage.removeItem(`probe_meat_${id}`).catch(() => {});
      AsyncStorage.removeItem(`probe_pit_${id}`).catch(() => {});
    }
  }, [id]);

  // Auto-assign
  const [autoAssignBanner, setAutoAssignBanner] = useState<string | null>(null);
  const autoAssignFiredRef = useRef(false);
  const activeCookCount = (allCooksForCount ?? []).filter((c: any) => c?.status === "active").length;

  useEffect(() => {
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
  }, [activeCookCount, tempMode, selectedMeatProbeId, inkbirdProbes, bleContextDevices, lanProbes, handleSelectMeatProbe]);

  // Reconnect toasts
  const [inkbirdReconnectToast, setInkbirdReconnectToast] = useState(false);
  const inkbirdReconnectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevInkbirdReconnectingRef = useRef(false);
  const [inkbirdToastMounted, setInkbirdToastMounted] = useState(false);
  const inkbirdToastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const wasReconnecting = prevInkbirdReconnectingRef.current;
    prevInkbirdReconnectingRef.current = inkbirdReconnecting;
    if (wasReconnecting && !inkbirdReconnecting) {
      setInkbirdReconnectToast(true);
      if (inkbirdReconnectToastTimerRef.current) clearTimeout(inkbirdReconnectToastTimerRef.current);
      inkbirdReconnectToastTimerRef.current = setTimeout(() => setInkbirdReconnectToast(false), 3000);
    }
  }, [inkbirdReconnecting]);

  useEffect(() => {
    if (inkbirdReconnectToast) {
      setInkbirdToastMounted(true);
      inkbirdToastAnim.setValue(0);
      Animated.timing(inkbirdToastAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    } else {
      Animated.timing(inkbirdToastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setInkbirdToastMounted(false);
      });
    }
  }, [inkbirdReconnectToast, inkbirdToastAnim]);

  const [bleReconnectToast, setBleReconnectToast] = useState<string | null>(null);
  const bleReconnectToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReconnectBannerRef = useRef<string | null>(null);

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

  // Known probe IDs for "previously used" section
  const knownProbeIds = useMemo(() => {
    const result: Record<string, string | null> = {};
    const cookData = cook as any;
    const grillId = cookData?.grillId;
    function addKnown(probeKey: string | null | undefined, labels: Record<string, string>, skipIfPresent = false) {
      if (!probeKey) return;
      if (!probeKey.startsWith("ble_") && !probeKey.startsWith("bleCtx_")) return;
      if (skipIfPresent && probeKey in result) return;
      result[probeKey] = labels[probeKey] ?? null;
    }
    const pa = cookData?.probeAssignments as { meatProbes?: Array<{id: string}> | null; meatProbeId?: string | null; pitProbeId?: string | null; labels?: Record<string, string> } | null | undefined;
    if (pa) {
      const labels = pa.labels ?? {};
      const meatProbes = pa.meatProbes?.length ? pa.meatProbes : (pa.meatProbeId ? [{id: pa.meatProbeId}] : []);
      for (const mp of meatProbes) addKnown(mp.id, labels);
      addKnown(pa.pitProbeId, labels);
    }
    if (grillId && allCooksForCount) {
      const prevCooks = (allCooksForCount as any[])
        .filter((c: any) => String(c.id) !== String(id) && c.grillId === grillId && c.probeAssignments)
        .sort((a: any, b: any) => {
          const ta = new Date((a.updatedAt ?? a.createdAt) || 0).getTime();
          const tb = new Date((b.updatedAt ?? b.createdAt) || 0).getTime();
          return tb - ta;
        });
      const prev = prevCooks[0];
      if (prev?.probeAssignments) {
        const prevPa = prev.probeAssignments as { meatProbes?: Array<{id: string}> | null; meatProbeId?: string | null; pitProbeId?: string | null; labels?: Record<string, string> };
        const prevLabels = prevPa.labels ?? {};
        const prevMeatProbes = prevPa.meatProbes?.length ? prevPa.meatProbes : (prevPa.meatProbeId ? [{id: prevPa.meatProbeId}] : []);
        for (const mp of prevMeatProbes) addKnown(mp.id, prevLabels, true);
        addKnown(prevPa.pitProbeId, prevLabels, true);
      }
    }
    return result;
  }, [cook, id, allCooksForCount]);

  // Backwards-compat setter: sets the first meat slot to the given id (or clears all slots)
  const setSelectedMeatProbeId = useCallback((probeId: string | null) => {
    setMeatProbeSlots(probeId ? [{id: probeId, label: "Internal"}] : []);
  }, []);

  return {
    // Probe selections
    selectedMeatProbeId, setSelectedMeatProbeId,
    meatProbeSlots,
    selectedPitProbeId, setSelectedPitProbeId,
    probeLabels,
    tempMode, setTempMode, setTempModeState,
    otherCookAssignments,
    // Cloud probes
    meaterLinked, meaterProbes, meaterDataUpdatedAt,
    thermoworksLinked, thermoworksProbes, thermoworksDataUpdatedAt,
    // Selected probes
    selectedMeaterProbe, selectedMeaterPitProbe,
    selectedThermoworksProbe, selectedThermoworksPitProbe,
    selectedInkbirdProbe, selectedInkbirdPitProbe,
    selectedBleContextDevice, selectedBleContextPitDevice,
    selectedLanProbe, selectedLanPitProbe,
    // BLE
    inkbirdProbes, inkbirdScanning, inkbirdReconnecting, lastKnownInkbirdDeviceId,
    bleContextDevices, reconnectBanner, dismissReconnectBanner,
    combinedReconnecting, handleRestartScan,
    lanProbes,
    // Computed
    hasActiveProbe, knownProbeIds, probeIntervalMs,
    // Handlers
    handleSelectMeatProbe, handleAddMeatProbeSlot, handleRemoveMeatProbeSlot,
    handleSelectPitProbe, handleSetProbeLabel, clearProbeState,
    // Auto-assign
    autoAssignBanner, setAutoAssignBanner,
    // Toasts
    inkbirdReconnectToast, setInkbirdReconnectToast, inkbirdToastMounted, inkbirdToastAnim,
    bleReconnectToast, setBleReconnectToast,
  };
}
