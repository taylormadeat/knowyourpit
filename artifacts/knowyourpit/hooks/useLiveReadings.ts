import { useState, useEffect, useRef, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListTemperatureReadings,
  getListTemperatureReadingsQueryKey,
  useUploadTemperatureData,
  type TemperatureReading,
} from "@workspace/api-client-react";
import type { ProbeTimeSeries } from "@/components/TempGraph";
import type { ProbeState } from "./useProbeState";

interface UseLiveReadingsParams {
  id: string | undefined;
  cookStatus: string | undefined;
  cook: any;
  cookCheckins: any[];
  probeState: Pick<
    ProbeState,
    | "tempMode"
    | "selectedMeatProbeId"
    | "selectedPitProbeId"
    | "probeLabels"
    | "selectedMeaterProbe"
    | "selectedMeaterPitProbe"
    | "selectedThermoworksProbe"
    | "selectedThermoworksPitProbe"
    | "selectedInkbirdProbe"
    | "selectedInkbirdPitProbe"
    | "selectedBleContextDevice"
    | "selectedBleContextPitDevice"
    | "selectedLanProbe"
    | "selectedLanPitProbe"
    | "meaterDataUpdatedAt"
    | "thermoworksDataUpdatedAt"
    | "lanProbes"
    | "bleContextDevices"
    | "hasActiveProbe"
  >;
}

export type LiveReadingsState = ReturnType<typeof useLiveReadings>;

export function useLiveReadings({ id, cookStatus, cook, cookCheckins, probeState }: UseLiveReadingsParams) {
  const {
    tempMode, selectedMeatProbeId, selectedPitProbeId, probeLabels,
    selectedMeaterProbe, selectedMeaterPitProbe,
    selectedThermoworksProbe, selectedThermoworksPitProbe,
    selectedInkbirdProbe, selectedInkbirdPitProbe,
    selectedBleContextDevice, selectedBleContextPitDevice,
    selectedLanProbe, selectedLanPitProbe,
    meaterDataUpdatedAt, thermoworksDataUpdatedAt,
    lanProbes, bleContextDevices,
  } = probeState;

  const [nowMs, setNowMs] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [liveReadings, setLiveReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);
  const [livePitReadings, setLivePitReadings] = useState<Array<{ timeMinutes: number; tempF: number }>>([]);
  const liveReadingsSeededRef = useRef(false);

  const uploadTemperatureData = useUploadTemperatureData();

  // Reset on cook change
  useEffect(() => {
    setLiveReadings([]);
    setLivePitReadings([]);
    liveReadingsSeededRef.current = false;
    setNowMs(Date.now());
  }, [id]);

  // nowMs timer
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

  // Historical temperature readings
  const { data: historicalReadings } = useListTemperatureReadings(
    { cookId: Number(id) },
    {
      query: {
        queryKey: getListTemperatureReadingsQueryKey({ cookId: Number(id) }),
        enabled: (cookStatus === "active" || cookStatus === "completed") && !!cook?.actualStartAt,
      },
    },
  );

  // Seed from historical probe readings (probe-sourced)
  useEffect(() => {
    if (liveReadingsSeededRef.current) return;
    if (!historicalReadings || historicalReadings.length === 0) return;
    if (!cook?.actualStartAt) return;

    const startMs = new Date(cook.actualStartAt).getTime();
    const toEntry = (r: TemperatureReading) => ({
      timeMinutes: Math.round(Math.max(0, (new Date(r.recordedAt).getTime() - startMs) / 60000) * 10) / 10,
      tempF: r.tempF,
    });

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

  // Seed from check-ins (manual mode fallback)
  useEffect(() => {
    if (liveReadingsSeededRef.current) return;
    if (tempMode !== "manual") return;
    if (!cook?.actualStartAt) return;
    if (!Array.isArray(cookCheckins) || cookCheckins.length === 0) return;

    const startMs = new Date(cook.actualStartAt).getTime();
    const entries = (cookCheckins as any[])
      .filter((ci: any) => ci.internalTempF != null)
      .map((ci: any) => ({
        timeMinutes: Math.round(Math.max(0, (new Date(ci.createdAt).getTime() - startMs) / 60000) * 10) / 10,
        tempF: ci.internalTempF as number,
      }))
      .sort((a, b) => a.timeMinutes - b.timeMinutes);

    if (entries.length > 0) {
      setLiveReadings(entries);
      liveReadingsSeededRef.current = true;
    }
  }, [cookCheckins, cook?.actualStartAt, tempMode]);

  // Helper: elapsed minutes from cook start
  const elapsedMins = () => {
    const startAt = cook?.actualStartAt;
    return startAt ? Math.max(0, (Date.now() - new Date(startAt).getTime()) / 60000) : 0;
  };

  // Accumulate MEATER readings
  useEffect(() => {
    if (selectedMeaterProbe == null || selectedMeaterProbe.internalTempF == null) return;
    const currentTemp = selectedMeaterProbe.internalTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLiveReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
    if (selectedMeaterProbe.ambientTempF != null && selectedMeaterPitProbe == null) {
      setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: selectedMeaterProbe.ambientTempF! }]);
    }
  }, [selectedMeaterProbe]);

  // Accumulate MEATER dedicated pit probe
  useEffect(() => {
    if (selectedMeaterPitProbe == null || selectedMeaterPitProbe.internalTempF == null) return;
    if (selectedMeaterPitProbe.deviceId === selectedMeaterProbe?.deviceId) return;
    const currentTemp = selectedMeaterPitProbe.internalTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedMeaterPitProbe]);

  // Accumulate BLE context device readings
  useEffect(() => {
    if (selectedBleContextDevice == null || selectedBleContextDevice.probeTempF == null) return;
    const currentTemp = selectedBleContextDevice.probeTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLiveReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
    if (selectedBleContextDevice.ambientTempF != null && selectedBleContextPitDevice == null) {
      setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: selectedBleContextDevice.ambientTempF! }]);
    }
  }, [selectedBleContextDevice]);

  // Accumulate BLE context pit device
  useEffect(() => {
    if (selectedBleContextPitDevice == null || selectedBleContextPitDevice.probeTempF == null) return;
    const currentTemp = selectedBleContextPitDevice.probeTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedBleContextPitDevice]);

  // Accumulate LAN probe readings
  useEffect(() => {
    if (selectedLanProbe == null || selectedLanProbe.probeTempF == null) return;
    const currentTemp = selectedLanProbe.probeTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLiveReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
    if (selectedLanProbe.ambientTempF != null && selectedLanPitProbe == null) {
      setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: selectedLanProbe.ambientTempF! }]);
    }
  }, [selectedLanProbe]);

  // Accumulate LAN pit probe
  useEffect(() => {
    if (selectedLanPitProbe == null || selectedLanPitProbe.probeTempF == null) return;
    const currentTemp = selectedLanPitProbe.probeTempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedLanPitProbe]);

  // Accumulate ThermoWorks readings
  useEffect(() => {
    if (selectedThermoworksProbe == null || (selectedThermoworksProbe as any).tempF == null) return;
    const currentTemp = (selectedThermoworksProbe as any).tempF as number;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLiveReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedThermoworksProbe]);

  // Accumulate ThermoWorks pit readings
  useEffect(() => {
    if (selectedThermoworksPitProbe == null || (selectedThermoworksPitProbe as any).tempF == null) return;
    const currentTemp = (selectedThermoworksPitProbe as any).tempF as number;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedThermoworksPitProbe]);

  // Accumulate Inkbird readings
  useEffect(() => {
    if (selectedInkbirdProbe?.tempF == null) return;
    const currentTemp = selectedInkbirdProbe.tempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLiveReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedInkbirdProbe]);

  // Accumulate Inkbird pit readings
  useEffect(() => {
    if (selectedInkbirdPitProbe?.tempF == null) return;
    const currentTemp = selectedInkbirdPitProbe.tempF;
    const elapsed = Math.round(elapsedMins() * 10) / 10;
    setLivePitReadings((prev) => [...prev, { timeMinutes: elapsed, tempF: currentTemp }]);
  }, [selectedInkbirdPitProbe]);

  // Build autoCheckinProbeReading for auto-checkin + upload
  const autoCheckinProbeReading = useMemo(() => {
    if (tempMode !== "probe") return null;
    if (selectedMeaterProbe?.internalTempF != null) {
      const pitTempF =
        selectedMeaterPitProbe != null && selectedMeaterPitProbe.deviceId !== selectedMeaterProbe.deviceId
          ? (selectedMeaterPitProbe.internalTempF ?? null)
          : (selectedMeaterProbe.ambientTempF ?? null);
      return { internalTempF: selectedMeaterProbe.internalTempF, pitTempF, probeSource: "meater" as const, fetchedAtMs: meaterDataUpdatedAt };
    }
    if (selectedThermoworksProbe != null && (selectedThermoworksProbe as any).tempF != null) {
      return {
        internalTempF: (selectedThermoworksProbe as any).tempF,
        pitTempF: selectedThermoworksPitProbe != null ? ((selectedThermoworksPitProbe as any).tempF ?? null) : null,
        probeSource: "thermoworks" as const,
        fetchedAtMs: thermoworksDataUpdatedAt,
      };
    }
    if (selectedInkbirdProbe?.tempF != null) {
      return { internalTempF: selectedInkbirdProbe.tempF, pitTempF: selectedInkbirdPitProbe?.tempF ?? null, probeSource: "inkbird" as const, fetchedAtMs: selectedInkbirdProbe.lastSeenMs };
    }
    if (selectedBleContextDevice?.probeTempF != null) {
      const pitTempF =
        selectedBleContextPitDevice != null && selectedBleContextPitDevice.id !== selectedBleContextDevice.id
          ? (selectedBleContextPitDevice.probeTempF ?? null)
          : (selectedBleContextDevice.ambientTempF ?? null);
      return { internalTempF: selectedBleContextDevice.probeTempF, pitTempF, probeSource: "ble" as const, fetchedAtMs: selectedBleContextDevice.lastSeenMs };
    }
    if (selectedLanProbe?.probeTempF != null) {
      const pitTempF =
        selectedLanPitProbe != null && selectedLanPitProbe.deviceId !== selectedLanProbe.deviceId
          ? (selectedLanPitProbe.probeTempF ?? null)
          : (selectedLanProbe.ambientTempF ?? null);
      return { internalTempF: selectedLanProbe.probeTempF, pitTempF, probeSource: "lan" as const, fetchedAtMs: selectedLanProbe.lastSeenMs };
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

  // Upload probe readings to backend
  const lastUploadedProbeTs = useRef<number>(0);
  useEffect(() => {
    if (!autoCheckinProbeReading) return;
    const { internalTempF, probeSource, fetchedAtMs } = autoCheckinProbeReading;
    if (internalTempF == null) return;
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
          { probeNumber: 0, tempF: internalTempF, probeName: probeName ?? undefined, recordedAt: new Date(fetchedAtMs).toISOString() },
          ...(autoCheckinProbeReading.pitTempF != null ? [{ probeNumber: 1, tempF: autoCheckinProbeReading.pitTempF, probeName: pitProbeName, recordedAt: new Date(fetchedAtMs).toISOString() }] : []),
        ],
      },
    });
  }, [autoCheckinProbeReading, id, cookStatus, probeLabels, selectedMeatProbeId, selectedPitProbeId]);

  // Completed cook readings probes (for graph on completed cooks without AI analysis)
  const completedCookReadingsProbes = useMemo<ProbeTimeSeries[]>(() => {
    if (!cook) return [];
    if (cookStatus !== "completed") return [];
    if (!historicalReadings || historicalReadings.length === 0) return [];
    const actualStartAt = (cook as any)?.actualStartAt;
    if (!actualStartAt) return [];

    const startMs = new Date(actualStartAt).getTime();
    const probeNumbers = [...new Set(historicalReadings.map((r: TemperatureReading) => r.probeNumber))].sort((a: number, b: number) => a - b);

    return probeNumbers
      .map((probeNum: number) => {
        const timeSeries = historicalReadings
          .filter((r: TemperatureReading) => r.probeNumber === probeNum)
          .map((r: TemperatureReading) => ({
            timeMinutes: Math.round(Math.max(0, (new Date(r.recordedAt).getTime() - startMs) / 60000) * 10) / 10,
            tempF: r.tempF,
          }))
          .sort((a: { timeMinutes: number }, b: { timeMinutes: number }) => a.timeMinutes - b.timeMinutes);
        const lastTemp = timeSeries[timeSeries.length - 1]?.tempF ?? 0;
        const probeName = probeNum === 1 ? "Internal" : probeNum === 2 ? "Ambient" : `Probe ${probeNum}`;
        return { probeName, timeSeries, finishingTempF: lastTemp };
      })
      .filter((p) => p.timeSeries.length >= 2);
  }, [cook, cookStatus, historicalReadings]);

  return {
    nowMs, setNowMs,
    liveReadings, setLiveReadings,
    livePitReadings, setLivePitReadings,
    liveReadingsSeededRef,
    historicalReadings,
    autoCheckinProbeReading,
    completedCookReadingsProbes,
  };
}
