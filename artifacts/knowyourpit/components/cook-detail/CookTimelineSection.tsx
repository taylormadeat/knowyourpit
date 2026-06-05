import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";
import { TempGraph } from "@/components/TempGraph";
import { FrozenTimeline } from "@/components/cook-detail/FrozenTimeline";
import { PlannedCookTimeline } from "@/components/cook-detail/PlannedCookTimeline";
import { SequenceSchedule } from "@/components/cook-detail/SequenceSchedule";
import { ActualVsPlannedRecap } from "@/components/cook-detail/ActualVsPlannedRecap";
import { StoredAiAnalysis } from "@/components/cook-detail/StoredAiAnalysis";
import { CookActivityTimeline } from "@/components/cook-detail/CookActivityTimeline";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import type { CookCheckin } from "@workspace/api-client-react";
import type { SequenceData } from "@/components/cook-detail/types";
import type { ProbeTimeSeries } from "@/components/TempGraph";

interface CookTimelineSectionProps {
  c: any;
  colors: any;
  cookStatus: string | undefined;
  nowMs: number;
  id: string;
  cookSeqData: SequenceData | null;
  nextStep: any;
  seqScheduleExpanded: boolean;
  setSeqScheduleExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  confirmedSteps: Record<string, any>;
  toggleConfirmedStep: (key: string) => void;
  scheduleListYRef: React.MutableRefObject<number>;
  itemYRef: React.MutableRefObject<Record<number, number>>;
  timelineYRef: React.MutableRefObject<Record<number, number>>;
  rowYRef: React.MutableRefObject<Record<string, number>>;
  handleLogFuelEvent?: (event: string) => void;
  storedScheduledCheckins: ScheduledCheckin[];
  noPlanScheduledCheckins: ScheduledCheckin[];
  removedPlannedKeys: Set<string>;
  cookCheckins: CookCheckin[];
  checkinsLoading: boolean;
  openCheckin: (sc: ScheduledCheckin) => void;
  nextCheckinSc: ScheduledCheckin | null;
  setPlannedCheckinPreviewSc: (sc: ScheduledCheckin | null) => void;
  plannedSequenceCheckins: ScheduledCheckin[];
  estimatedFinishMs: number | null;
  storedAnalysis: any;
  storedAssessment: any;
  storedVerdictCfg: any;
  effectiveStoredGraphProbes: ProbeTimeSeries[];
  cardWidth: number;
  isIdentityLinked: boolean;
  effectivePro: boolean;
  showPaywall: (opts: any) => void;
  onCardLayout: (e: any) => void;
  expandedStoredSections: Set<string>;
  toggleStoredSection: (key: string) => void;
  liveReadings: Array<{ timeMinutes: number; tempF: number }>;
  completedCookReadingsProbes: ProbeTimeSeries[];
  probeIntervalMs: number;
  setRemovedPlannedKeys: (updater: (prev: Set<string>) => Set<string>) => void;
  cancelCheckinNotificationForPhase: (cookId: number, phaseKey: string) => Promise<void>;
}

export function CookTimelineSection({
  c, colors, cookStatus, nowMs, id, cookSeqData,
  nextStep, seqScheduleExpanded, setSeqScheduleExpanded,
  confirmedSteps, toggleConfirmedStep,
  scheduleListYRef, itemYRef, timelineYRef, rowYRef,
  handleLogFuelEvent, storedScheduledCheckins, noPlanScheduledCheckins,
  removedPlannedKeys, cookCheckins, checkinsLoading, openCheckin, nextCheckinSc,
  setPlannedCheckinPreviewSc, plannedSequenceCheckins, estimatedFinishMs,
  storedAnalysis, storedAssessment, storedVerdictCfg, effectiveStoredGraphProbes,
  cardWidth, isIdentityLinked, effectivePro, showPaywall, onCardLayout,
  expandedStoredSections, toggleStoredSection, liveReadings, completedCookReadingsProbes,
  probeIntervalMs, setRemovedPlannedKeys, cancelCheckinNotificationForPhase,
}: CookTimelineSectionProps) {
  const activeScheduledCheckins = React.useMemo<ScheduledCheckin[]>(() => {
    if (cookStatus !== "active") return [];
    const hasPlan = !!(cookSeqData?.schedule?.length);
    const base = hasPlan && storedScheduledCheckins.length > 0
      ? storedScheduledCheckins
      : noPlanScheduledCheckins;
    return base.filter((sc) => !removedPlannedKeys.has(sc.phaseKey));
  }, [cookStatus, cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, removedPlannedKeys]);

  const stepConfirmations = React.useMemo(() => {
    const schedule = (cookSeqData?.schedule ?? []) as Array<{ phaseKey?: string | null; phaseLabel?: string | null; confirmedAt?: string | null }>;
    return schedule
      .filter((item) => item.confirmedAt != null)
      .map((item, i) => ({
        id: `step-${item.phaseKey ?? i}`,
        label: item.phaseLabel ?? "Step complete",
        confirmedAt: item.confirmedAt as string,
      }));
  }, [cookSeqData]);

  const liveReadingMilestones = React.useMemo(() => {
    if (cookStatus === "completed") return [];
    return liveReadings
      .filter((r, i, arr) => {
        if (i === 0) return false;
        const prev = arr[i - 1];
        return Math.floor(r.tempF / 25) > Math.floor(prev.tempF / 25);
      })
      .map((r, i) => ({ id: `probe-${i}`, tempF: r.tempF, timeMinutes: r.timeMinutes }));
  }, [liveReadings, cookStatus]);

  const plannedCheckins = React.useMemo(() => {
    if (cookStatus !== "active") return [];
    const hasPlan = !!cookSeqData?.schedule?.length;
    const base = hasPlan && storedScheduledCheckins.length > 0
      ? storedScheduledCheckins
      : noPlanScheduledCheckins;
    return base
      .filter((sc) => !removedPlannedKeys.has(sc.phaseKey) && sc.scheduledAt > nowMs)
      .sort((a, b) => a.scheduledAt - b.scheduledAt);
  }, [cookStatus, cookSeqData, storedScheduledCheckins, noPlanScheduledCheckins, removedPlannedKeys, nowMs]);

  const currentItemIdx = React.useMemo(() => {
    if (!cookSeqData) return 0;
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
  }, [cookSeqData, c.foodType, c.plannedStartAt]);

  return (
    <>
      {/* ── Planned cook: Frozen + Schedule + Timeline ─────────────────── */}
      {cookStatus === "planned" && (
        <>
          <FrozenTimeline c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs} />
          <SequenceSchedule
            c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
            nextStep={nextStep} seqScheduleExpanded={seqScheduleExpanded}
            setSeqScheduleExpanded={setSeqScheduleExpanded}
            confirmedSteps={confirmedSteps} toggleConfirmedStep={toggleConfirmedStep}
            scheduleListYRef={scheduleListYRef} itemYRef={itemYRef}
            timelineYRef={timelineYRef} rowYRef={rowYRef}
            onQuickLog={undefined}
            scheduledCheckins={plannedSequenceCheckins}
            onCheckinPress={setPlannedCheckinPreviewSc}
          />
          <PlannedCookTimeline c={c} colors={colors} />
        </>
      )}

      {/* ── Active cook: Frozen + Schedule + PlannedTimeline fallback ───── */}
      {cookStatus !== "planned" && cookStatus !== "completed" && (
        <>
          <FrozenTimeline c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs} />
          <SequenceSchedule
            c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
            nextStep={nextStep} seqScheduleExpanded={seqScheduleExpanded}
            setSeqScheduleExpanded={setSeqScheduleExpanded}
            confirmedSteps={confirmedSteps} toggleConfirmedStep={toggleConfirmedStep}
            scheduleListYRef={scheduleListYRef} itemYRef={itemYRef}
            timelineYRef={timelineYRef} rowYRef={rowYRef}
            onQuickLog={cookStatus === "active" ? handleLogFuelEvent : undefined}
            scheduledCheckins={cookStatus === "active" ? activeScheduledCheckins : undefined}
            cookCheckins={cookCheckins as CookCheckin[]}
            onCheckinPress={cookStatus === "active" ? openCheckin : undefined}
            nextCheckinSc={cookStatus === "active" ? nextCheckinSc : null}
          />
          <PlannedCookTimeline c={c} colors={colors} cookStatus={cookStatus} estimatedFinishMs={estimatedFinishMs} />
        </>
      )}

      {/* ── Timeline accuracy recap ────────────────────────────────────── */}
      {Object.keys(confirmedSteps).length > 0 && cookSeqData && (
        <ActualVsPlannedRecap
          sequenceData={cookSeqData}
          confirmedSteps={confirmedSteps}
          currentItemIdx={currentItemIdx}
          colors={colors}
        />
      )}

      {/* ── Stored AI analysis (non-active cooks) ──────────────────────── */}
      {cookStatus !== "active" && (
        <StoredAiAnalysis
          c={c} colors={colors}
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
        />
      )}

      {/* ── Completed: Cook Timeline + Activity ────────────────────────── */}
      {cookStatus === "completed" && (
        <>
          <SequenceSchedule
            c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
            nextStep={null} seqScheduleExpanded={seqScheduleExpanded}
            setSeqScheduleExpanded={setSeqScheduleExpanded}
            confirmedSteps={confirmedSteps} toggleConfirmedStep={toggleConfirmedStep}
            scheduleListYRef={scheduleListYRef} itemYRef={itemYRef}
            timelineYRef={timelineYRef} rowYRef={rowYRef}
            cookCheckins={cookCheckins as CookCheckin[]}
          />
          <PlannedCookTimeline c={c} colors={colors} cookStatus={cookStatus} estimatedFinishMs={estimatedFinishMs} />
          <CookActivityTimeline
            c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
            cookId={Number(id)} cookSeqData={cookSeqData}
            checkins={cookCheckins} checkinsLoading={checkinsLoading}
            onOpenCheckin={openCheckin} triggeredAlerts={[]}
            stepConfirmations={stepConfirmations}
            liveReadingMilestones={[]}
            effectivePro={effectivePro} isIdentityLinked={isIdentityLinked}
            showPaywall={showPaywall} plannedCheckins={[]}
            refetchIntervalMs={probeIntervalMs}
          />
        </>
      )}

      {/* ── Standalone Temperature History (completed, no AI analysis) ─── */}
      {cookStatus === "completed" && !storedAnalysis && completedCookReadingsProbes.length > 0 && (
        <View style={{ backgroundColor: colors.card, borderRadius: colors.radius, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <Feather name="activity" size={15} color={colors.mutedForeground as string} />
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, letterSpacing: 0.3 }}>
              Temperature History
            </Text>
          </View>
          <TempGraph probes={completedCookReadingsProbes} targetTempF={c.targetTempF ?? null} width={cardWidth} height={190} />
        </View>
      )}

      {/* ── Activity Timeline (active / planned cooks) ─────────────────── */}
      {cookStatus !== "completed" && (
        <CookActivityTimeline
          c={c} colors={colors} cookStatus={cookStatus} nowMs={nowMs}
          cookId={Number(id)} cookSeqData={cookSeqData}
          checkins={cookCheckins} checkinsLoading={checkinsLoading}
          onOpenCheckin={openCheckin} triggeredAlerts={[]}
          stepConfirmations={stepConfirmations}
          liveReadingMilestones={liveReadingMilestones}
          effectivePro={effectivePro} isIdentityLinked={isIdentityLinked}
          showPaywall={showPaywall}
          refetchIntervalMs={probeIntervalMs}
          plannedCheckins={plannedCheckins}
          onRemovePlanned={(phaseKey) => {
            setRemovedPlannedKeys((prev) => new Set([...prev, phaseKey]));
            cancelCheckinNotificationForPhase(Number(id), phaseKey).catch(() => {});
          }}
        />
      )}
    </>
  );
}
