import React, { useRef, useEffect } from "react";
import { View, Text, Pressable, Animated, Alert } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { relCountdown } from "./utils";
import type { NextStep } from "./types";
import { parseIntervalMinutes } from "@/hooks/useSpritzNotifications";
import { FingerprintCallout } from "./FingerprintCallout";
import type { ScheduledCheckin } from "@/constants/checkinKnowledge";
import type { CookCheckin } from "@workspace/api-client-react";

type Colors = any;

function PulsingCheckinDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    loopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.25, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loopRef.current.start();
    return () => { loopRef.current?.stop(); };
  }, [anim]);

  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 5,
        backgroundColor: color,
        opacity: anim,
      }}
    />
  );
}

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  nextStep: NextStep | null;
  seqScheduleExpanded: boolean;
  setSeqScheduleExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  confirmedSteps: Record<string, unknown>;
  toggleConfirmedStep: (key: string) => void;
  scheduleListYRef: { current: number };
  itemYRef: { current: Record<number, number> };
  timelineYRef: { current: Record<number, number> };
  rowYRef: { current: Record<string, number> };
  onQuickLog?: (action: "charcoal" | "wood") => void;
  scheduledCheckins?: ScheduledCheckin[];
  cookCheckins?: CookCheckin[];
  onCheckinPress?: (sc: ScheduledCheckin) => void;
  nextCheckinSc?: ScheduledCheckin | null;
}

function isStallProneMeat(foodType: string): boolean {
  const ft = (foodType ?? "").toLowerCase();
  return (
    ft.includes("brisket") ||
    ft.includes("pork shoulder") ||
    ft.includes("pork butt") ||
    ft.includes("pork belly") ||
    ft.includes("chuck")
  );
}

function isProbeTenderMeat(foodType: string): boolean {
  const ft = (foodType ?? "").toLowerCase();
  return (
    ft.includes("brisket") ||
    ft.includes("pork shoulder") ||
    ft.includes("pork butt")
  );
}

export function SequenceSchedule(p: Props) {
  const {
    c, colors, cookStatus, nowMs, nextStep,
    seqScheduleExpanded, setSeqScheduleExpanded,
    confirmedSteps, toggleConfirmedStep,
    scheduleListYRef, itemYRef, timelineYRef, rowYRef,
    onQuickLog,
    scheduledCheckins, cookCheckins, onCheckinPress, nextCheckinSc,
  } = p;

  const completedPhaseKeys = new Set(
    (cookCheckins ?? [])
      .filter((ci) => ci.phaseKey != null)
      .map((ci) => ci.phaseKey!)
  );

  const seqData = (c.sequenceData as { schedule: any[]; serveAt: string; summary?: string | null; fingerprintSource?: "grill" | "user" | "pit_bias_only" | null; fingerprintNote?: string | null } | null | undefined);
  if (!seqData?.schedule?.length) return null;
  const cookFoodType = (c.foodType ?? "").toLowerCase().trim();
  const cookMeatOnMs = c.plannedStartAt ? new Date(c.plannedStartAt).getTime() : null;
  let currentIdx = -1;
  if (cookMeatOnMs !== null) {
    let bestDelta = Infinity;
    seqData.schedule.forEach((item: any, idx: number) => {
      if ((item.foodType ?? "").toLowerCase().trim() !== cookFoodType) return;
      const itemMs = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
      if (itemMs === null) return;
      const delta = Math.abs(itemMs - cookMeatOnMs);
      if (delta < bestDelta) { bestDelta = delta; currentIdx = idx; }
    });
  }
  if (currentIdx === -1) {
    currentIdx = seqData.schedule.findIndex(
      (item: any) => (item.foodType ?? "").toLowerCase().trim() === cookFoodType
    );
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
      <Pressable
        onPress={() => setSeqScheduleExpanded((v) => !v)}
        style={[s.seqScheduleHeader, { borderBottomWidth: seqScheduleExpanded ? 1 : 0, borderBottomColor: colors.border }]}
      >
        <LinearGradient colors={["#4f46e5", "#6C3BF5"]} style={s.seqScheduleIcon}>
          <Feather name="list" size={14} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[s.seqScheduleTitle, { color: colors.foreground }]}>Session Schedule</Text>
          {seqData.serveAt ? (
            <Text style={[s.seqScheduleSub, { color: colors.mutedForeground }]}>
              Serve by {new Date(seqData.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
              {" · "}{seqData.schedule.length} item{seqData.schedule.length !== 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>
        <Feather name={seqScheduleExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {/* Completed cook collapsed step summary — only confirmed steps, with ✓ markers and actual confirmation timestamps */}
      {!seqScheduleExpanded && cookStatus === "completed" && currentIdx >= 0 && (() => {
        const item = seqData.schedule[currentIdx];
        if (!item) return null;
        const hasWrap = !!(item.wrapMethod && item.wrapMethod !== "none");
        const wrapAtMin = (item.wrapAtMinutes ?? 0) > 0 ? Math.round(item.wrapAtMinutes) : null;
        const meatOnMs = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
        const wrapMs = meatOnMs && wrapAtMin ? meatOnMs + wrapAtMin * 60_000 : null;
        // confirmedSteps values are ISO timestamp strings of when the user tapped confirm
        const fmtTs = (key: string, fallback?: string | null) => {
          const ts = confirmedSteps[key];
          if (ts && typeof ts === "string") {
            return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
          }
          return fallback ? new Date(fallback).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : "";
        };
        const steps: { label: string; time: string; color: string }[] = [];
        if (confirmedSteps[`${currentIdx}_grillLight`] && item.grillLightAt)
          steps.push({ label: "Light Grill", time: fmtTs(`${currentIdx}_grillLight`, item.grillLightAt), color: "#f59e0b" });
        if (confirmedSteps[`${currentIdx}_meatOn`] && item.meatOnAt)
          steps.push({ label: "Meat On", time: fmtTs(`${currentIdx}_meatOn`, item.meatOnAt), color: "#EB6C2B" });
        if (confirmedSteps[`${currentIdx}_wrap`] && hasWrap && wrapMs)
          steps.push({ label: "Wrap", time: fmtTs(`${currentIdx}_wrap`), color: "#A855F7" });
        if (confirmedSteps[`${currentIdx}_pullOff`] && item.estimatedFinishAt)
          steps.push({ label: "Pull Off", time: fmtTs(`${currentIdx}_pullOff`, item.estimatedFinishAt), color: "#22c55e" });
        if (confirmedSteps[`${currentIdx}_serve`] && item.estimatedFinishAt && (item.restMinutes ?? 0) > 0)
          steps.push({ label: "Serve", time: fmtTs(`${currentIdx}_serve`), color: "#6366f1" });
        return (
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            {steps.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, paddingHorizontal: 12, paddingVertical: 10 }}>
                {steps.map((step, si) => (
                  <View key={si} style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: step.color + "18", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, borderWidth: 1, borderColor: step.color + "35" }}>
                    <Feather name="check-circle" size={10} color={step.color} />
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: step.color }}>{step.label}</Text>
                    {step.time ? <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>{step.time}</Text> : null}
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>Tap to view full timeline ↓</Text>
              </View>
            )}
          </View>
        );
      })()}

      {seqScheduleExpanded && (
        <View
          style={{ padding: 12, gap: 10 }}
          onLayout={(e) => { scheduleListYRef.current = e.nativeEvent.layout.y; }}
        >
          {seqData.schedule.map((item: any, idx: number) => {
            const isCurrent = idx === currentIdx;
            const stallProne = isStallProneMeat(item.foodType ?? "");
            const probeTender = isProbeTenderMeat(item.foodType ?? "");
            const stallConfirmed = !!confirmedSteps[`${idx}_stall`];
            const probeTenderConfirmed = !!confirmedSteps[`${idx}_probeTender`];
            const isActive = cookStatus === "active";

            return (
              <View
                key={idx}
                onLayout={(e) => { itemYRef.current[idx] = e.nativeEvent.layout.y; }}
                style={[
                  s.seqScheduleItem,
                  {
                    borderColor: isCurrent ? "#6C3BF555" : colors.border,
                    backgroundColor: isCurrent ? "#6C3BF508" : colors.background,
                  },
                ]}
              >
                <View style={s.seqScheduleItemHeader}>
                  <LinearGradient
                    colors={isCurrent ? ["#4f46e5", "#6C3BF5"] : ["#3A3A3E", "#52525B"]}
                    style={s.seqScheduleItemIcon}
                  >
                    <Feather name="layers" size={12} color="#fff" />
                  </LinearGradient>
                  <Text style={[s.seqScheduleItemTitle, { color: colors.foreground }]}>{item.foodType}</Text>
                  {isCurrent && (
                    <View style={s.seqScheduleCurrentBadge}>
                      <Text style={s.seqScheduleCurrentText}>YOU ARE HERE</Text>
                    </View>
                  )}
                </View>
                <View
                  style={{ paddingLeft: 4 }}
                  onLayout={(e) => { timelineYRef.current[idx] = e.nativeEvent.layout.y; }}
                >
                  {(() => {
                    const isNextGrillLight = nextStep?.itemIdx === idx && nextStep?.step === "grillLight";
                    const isNextMeatOn = nextStep?.itemIdx === idx && nextStep?.step === "meatOn";
                    const isNextPullOff = nextStep?.itemIdx === idx && nextStep?.step === "pullOff";
                    const isNextServe = nextStep?.itemIdx === idx && nextStep?.step === "serve";
                    const isDoneGrillLight = cookStatus === "active" && new Date(item.grillLightAt).getTime() < nowMs;
                    const isDoneMeatOn = cookStatus === "active" && new Date(item.meatOnAt).getTime() < nowMs;
                    const isDonePullOff = cookStatus === "active" && new Date(item.estimatedFinishAt).getTime() < nowMs;
                    const serveMs = new Date(item.estimatedFinishAt).getTime() + item.restMinutes * 60000;
                    const isDoneServe = cookStatus === "active" && serveMs < nowMs;
                    return (
                      <>
                        {/* ── Light grill ── */}
                        <View onLayout={(e) => { rowYRef.current[`${idx}:grillLight`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextGrillLight && s.seqTlNextRow, isDoneGrillLight && !confirmedSteps[`${idx}_grillLight`] && s.seqTlDoneRow]}>
                          {isDoneGrillLight ? (
                            <Pressable onPress={() => toggleConfirmedStep(`${idx}_grillLight`)} hitSlop={8} style={s.seqTlDotBtn}>
                              {confirmedSteps[`${idx}_grillLight`]
                                ? <Feather name="check-circle" size={14} color="#f59e0b" />
                                : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                            </Pressable>
                          ) : isNextGrillLight ? (
                            <Pressable
                              onPress={() => Alert.alert(
                                "Mark as done?",
                                "Record this step at the current time?",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Confirm", onPress: () => toggleConfirmedStep(`${idx}_grillLight`) },
                                ],
                              )}
                              hitSlop={8}
                              style={s.seqTlDotBtn}
                            >
                              <View style={[s.seqTlDot, { backgroundColor: "#f59e0b" }]} />
                            </Pressable>
                          ) : (
                            <View style={[s.seqTlDot, { backgroundColor: "#f59e0b" }]} />
                          )}
                          <View style={s.seqTlConnector} />
                          <View style={{ flex: 1 }}>
                            <View style={s.seqTlLabelRow}>
                              <Text style={[s.seqTlLabel, { color: isNextGrillLight ? "#f59e0b" : colors.mutedForeground }, isDoneGrillLight && s.seqTlDoneLabel]}>Light grill</Text>
                              {isNextGrillLight && (
                                <View style={[s.seqTlNextBadge, { backgroundColor: "#f59e0b25" }]}>
                                  <Text style={[s.seqTlNextText, { color: "#f59e0b" }]}>NEXT</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.seqTlTime, { color: isDoneGrillLight ? colors.mutedForeground : colors.foreground, opacity: isDoneGrillLight ? 0.55 : 1 }]}>
                              {typeof confirmedSteps[`${idx}_grillLight`] === "string"
                                ? new Date(confirmedSteps[`${idx}_grillLight`] as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                                : new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                              {typeof confirmedSteps[`${idx}_grillLight`] === "string" && (
                                <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                  {" "}· planned {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                                </Text>
                              )}
                              {(cookStatus === "active" || cookStatus === "planned") && !isDoneGrillLight && (
                                <Text style={[s.seqTlMeta, { color: "#f59e0b" }]}>
                                  {" "}· {relCountdown(new Date(item.grillLightAt).getTime(), nowMs)}
                                </Text>
                              )}
                              <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                {" "}· {fmtMinutes(item.preheatMinutes)} preheat
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {/* ── Meat on ── */}
                        <View onLayout={(e) => { rowYRef.current[`${idx}:meatOn`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextMeatOn && s.seqTlNextRow, isDoneMeatOn && !confirmedSteps[`${idx}_meatOn`] && s.seqTlDoneRow]}>
                          {isDoneMeatOn ? (
                            <Pressable onPress={() => toggleConfirmedStep(`${idx}_meatOn`)} hitSlop={8} style={s.seqTlDotBtn}>
                              {confirmedSteps[`${idx}_meatOn`]
                                ? <Feather name="check-circle" size={14} color="#EB6C2B" />
                                : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                            </Pressable>
                          ) : isNextMeatOn ? (
                            <Pressable
                              onPress={() => Alert.alert(
                                "Mark as done?",
                                "Record this step at the current time?",
                                [
                                  { text: "Cancel", style: "cancel" },
                                  { text: "Confirm", onPress: () => toggleConfirmedStep(`${idx}_meatOn`) },
                                ],
                              )}
                              hitSlop={8}
                              style={s.seqTlDotBtn}
                            >
                              <View style={[s.seqTlDot, { backgroundColor: "#EB6C2B" }]} />
                            </Pressable>
                          ) : (
                            <View style={[s.seqTlDot, { backgroundColor: "#EB6C2B" }]} />
                          )}
                          <View style={s.seqTlConnector} />
                          <View style={{ flex: 1 }}>
                            <View style={s.seqTlLabelRow}>
                              <Text style={[s.seqTlLabel, { color: isNextMeatOn ? "#EB6C2B" : colors.mutedForeground }, isDoneMeatOn && s.seqTlDoneLabel]}>Meat on</Text>
                              {isNextMeatOn && (
                                <View style={[s.seqTlNextBadge, { backgroundColor: "#EB6C2B25" }]}>
                                  <Text style={[s.seqTlNextText, { color: "#EB6C2B" }]}>NEXT</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.seqTlTime, { color: isDoneMeatOn ? colors.mutedForeground : colors.foreground, opacity: isDoneMeatOn ? 0.55 : 1 }]}>
                              {typeof confirmedSteps[`${idx}_meatOn`] === "string"
                                ? new Date(confirmedSteps[`${idx}_meatOn`] as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                                : new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                              {typeof confirmedSteps[`${idx}_meatOn`] === "string" && (
                                <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                  {" "}· planned {new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                                </Text>
                              )}
                              {(cookStatus === "active" || cookStatus === "planned") && !isDoneMeatOn && (
                                <Text style={[s.seqTlMeta, { color: "#EB6C2B" }]}>
                                  {" "}· {relCountdown(new Date(item.meatOnAt).getTime(), nowMs)}
                                </Text>
                              )}
                              <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                {" "}·{" "}
                                {fmtMinutes(item.estimatedDurationMinutes)}{" "}cook
                              </Text>
                            </Text>
                          </View>
                        </View>

                        {/* ── Unified sorted middle: Spritz · Mop · Check-ins · Wrap (clock mode) ── */}
                        {(() => {
                          const itemMeatOnMs = item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
                          const itemPullOffMs = item.estimatedFinishAt ? new Date(item.estimatedFinishAt).getTime() : null;
                          if (!itemMeatOnMs || !itemPullOffMs) return null;

                          const itemHasWrap = !!(item.wrapMethod && item.wrapMethod !== "none");
                          const wrapExplicitMin = (item.wrapAtMinutes ?? 0) > 0 ? Math.round(item.wrapAtMinutes) : null;
                          const wrapCookMin = typeof item.estimatedDurationMinutes === "number" && item.estimatedDurationMinutes > 0 ? item.estimatedDurationMinutes : null;
                          const wrapInferredMin = wrapCookMin != null ? Math.max(30, Math.round(wrapCookMin * 0.55)) : null;
                          const wrapMode: "clock" | "temp" = wrapExplicitMin == null && item.wrapTempF != null ? "temp" : "clock";
                          const wrapAtMin = wrapMode === "clock" ? (wrapExplicitMin ?? wrapInferredMin) : null;
                          const itemWrapMs = wrapAtMin != null ? itemMeatOnMs + wrapAtMin * 60_000 : null;
                          const wrapInferred = wrapMode === "clock" && wrapExplicitMin === null;
                          const isDoneWrap = itemWrapMs != null && isActive && itemWrapMs < nowMs;
                          const wrapLabel = item.wrapMethod === "foil" ? "Wrap in foil" : item.wrapMethod === "butcher_paper" ? "Wrap in butcher paper" : "Wrap";
                          const wrapColor = "#A855F7";
                          const isNextWrap = nextStep?.itemIdx === idx && nextStep?.step === "wrap";

                          type MiddleEvent =
                            | { kind: "spritz"; ms: number; i: number }
                            | { kind: "wrap" }
                            | { kind: "checkin"; sc: ScheduledCheckin };
                          const events: MiddleEvent[] = [];

                          // Spritz times (stop at wrap or pull-off, whichever is earlier)
                          const spritzIntervalMin = parseIntervalMinutes((c.spritzFrequency as string | null | undefined) ?? "");
                          if (spritzIntervalMin) {
                            const spritzEnd = itemHasWrap && itemWrapMs != null
                              ? Math.min(itemWrapMs, itemPullOffMs)
                              : itemPullOffMs;
                            let t = itemMeatOnMs + spritzIntervalMin * 60_000;
                            let si = 0;
                            while (t < spritzEnd && si < 12) {
                              events.push({ kind: "spritz", ms: t, i: si });
                              t += spritzIntervalMin * 60_000;
                              si++;
                            }
                          }

                          // Wrap (clock mode only — temp mode renders separately below)
                          if (itemHasWrap && wrapMode === "clock" && itemWrapMs != null) {
                            events.push({ kind: "wrap" });
                          }

                          // Check-in checkpoints (active and planned cooks, meatOn → serve window)
                          if (scheduledCheckins && scheduledCheckins.length > 0) {
                            const itemServeMs = itemPullOffMs + (item.restMinutes ?? 0) * 60_000;
                            for (const sc of scheduledCheckins) {
                              if (sc.scheduledAt >= itemMeatOnMs && sc.scheduledAt <= itemServeMs) {
                                events.push({ kind: "checkin", sc });
                              }
                            }
                          }

                          if (events.length === 0) return null;

                          // Sort everything by timestamp
                          events.sort((a, b) => {
                            const getMs = (e: MiddleEvent) =>
                              e.kind === "wrap" ? (itemWrapMs ?? 0)
                              : e.kind === "checkin" ? e.sc.scheduledAt
                              : e.ms;
                            return getMs(a) - getMs(b);
                          });

                          const spritzColor = "#14b8a6";
                          const ciColor = "#7C3AED";

                          return (
                            <>
                              {events.map((event, evIdx) => {
                                if (event.kind === "spritz") {
                                  const spritzMs = event.ms;
                                  const isDone = isActive && spritzMs < nowMs;
                                  const isFuture = (cookStatus === "active" || cookStatus === "planned") && spritzMs > nowMs;
                                  return (
                                    <View key={`s${evIdx}`} style={[s.seqTlRow, { marginLeft: 4, marginBottom: 6, opacity: isDone ? 0.45 : 1 }]}>
                                      <View style={[s.seqTlDot, { width: 7, height: 7, borderRadius: 4, marginTop: 5, backgroundColor: isDone ? colors.mutedForeground : spritzColor }]} />
                                      <View style={{ flex: 1 }}>
                                        <View style={s.seqTlLabelRow}>
                                          <Feather name="droplet" size={9} color={isDone ? colors.mutedForeground : spritzColor} style={{ marginRight: 2 }} />
                                          <Text style={[s.seqTlLabel, { color: isDone ? colors.mutedForeground : spritzColor, fontSize: 9 }]}>Spritz/Mop</Text>
                                        </View>
                                        <Text style={[s.seqTlMeta, { color: isDone ? colors.mutedForeground : colors.foreground, fontSize: 12, fontFamily: "Inter_600SemiBold" }]}>
                                          {new Date(spritzMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                                          {isFuture && <Text style={[s.seqTlMeta, { color: spritzColor }]}>{" "}· {relCountdown(spritzMs, nowMs)}</Text>}
                                        </Text>
                                      </View>
                                    </View>
                                  );
                                }
                                if (event.kind === "wrap") {
                                  return (
                                    <View key={`w${evIdx}`} onLayout={(e) => { rowYRef.current[`${idx}:wrap`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextWrap && s.seqTlNextRow, isDoneWrap && !confirmedSteps[`${idx}_wrap`] && s.seqTlDoneRow]}>
                                      {isDoneWrap ? (
                                        <Pressable onPress={() => toggleConfirmedStep(`${idx}_wrap`)} hitSlop={8} style={s.seqTlDotBtn}>
                                          {confirmedSteps[`${idx}_wrap`]
                                            ? <Feather name="check-circle" size={14} color={wrapColor} />
                                            : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                                        </Pressable>
                                      ) : isNextWrap ? (
                                        <Pressable
                                          onPress={() => Alert.alert(
                                            "Mark as done?",
                                            "Record this step at the current time?",
                                            [
                                              { text: "Cancel", style: "cancel" },
                                              { text: "Confirm", onPress: () => toggleConfirmedStep(`${idx}_wrap`) },
                                            ],
                                          )}
                                          hitSlop={8}
                                          style={s.seqTlDotBtn}
                                        >
                                          <View style={[s.seqTlDot, { backgroundColor: wrapColor }]} />
                                        </Pressable>
                                      ) : (
                                        <View style={[s.seqTlDot, { backgroundColor: wrapColor }]} />
                                      )}
                                      <View style={s.seqTlConnector} />
                                      <View style={{ flex: 1 }}>
                                        <View style={s.seqTlLabelRow}>
                                          <Text style={[s.seqTlLabel, { color: isNextWrap ? wrapColor : colors.mutedForeground }, isDoneWrap && s.seqTlDoneLabel]}>{wrapLabel}</Text>
                                          {isNextWrap && (
                                            <View style={[s.seqTlNextBadge, { backgroundColor: wrapColor + "25" }]}>
                                              <Text style={[s.seqTlNextText, { color: wrapColor }]}>NEXT</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={[s.seqTlTime, { color: isDoneWrap ? colors.mutedForeground : colors.foreground, opacity: isDoneWrap ? 0.55 : 1 }]}>
                                          {typeof confirmedSteps[`${idx}_wrap`] === "string"
                                            ? new Date(confirmedSteps[`${idx}_wrap`] as string).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })
                                            : `${wrapInferred ? "≈ " : ""}${itemWrapMs != null ? new Date(itemWrapMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true }) : ""}`}
                                          {typeof confirmedSteps[`${idx}_wrap`] === "string" && itemWrapMs != null && (
                                            <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                              {" "}· planned {wrapInferred ? "≈ " : ""}{new Date(itemWrapMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                                            </Text>
                                          )}
                                          {itemWrapMs != null && (cookStatus === "active" || cookStatus === "planned") && !isDoneWrap && (
                                            <Text style={[s.seqTlMeta, { color: wrapColor }]}>{" "}· {relCountdown(itemWrapMs, nowMs)}</Text>
                                          )}
                                          {item.wrapTempF ? (
                                            <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>{" "}· at {item.wrapTempF}°F internal</Text>
                                          ) : wrapInferred ? (
                                            <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>{" "}· around the stall</Text>
                                          ) : null}
                                        </Text>
                                        {item.wrapReason ? <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16 }]}>{item.wrapReason}</Text> : null}
                                        {c.wrapFinish ? <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16, fontStyle: "italic" }]}>{c.wrapFinish}</Text> : null}
                                      </View>
                                    </View>
                                  );
                                }
                                if (event.kind === "checkin") {
                                  const sc = event.sc;
                                  const isDone = completedPhaseKeys.has(sc.phaseKey);
                                  const isUpcoming = sc.scheduledAt > nowMs;
                                  const isPastDue = !isDone && !isUpcoming;
                                  const msTillDue = sc.scheduledAt - nowMs;
                                  const isDueSoon = !isDone && isUpcoming && msTillDue >= 0 && msTillDue <= 20 * 60_000;
                                  const isNext = !isDone && isUpcoming && sc.phaseKey === nextCheckinSc?.phaseKey;
                                  const ciDotColor = isDone ? "#22c55e" : isPastDue ? colors.mutedForeground as string : ciColor;
                                  const dueSoonColor = "#f59e0b";
                                  const isPlannedCook = cookStatus === "planned";
                                  // For planned cooks: clock time + offset from meat-on.
                                  // For active cooks: clock time (past) or countdown from now (upcoming).
                                  const offsetMin = itemMeatOnMs != null ? Math.round((sc.scheduledAt - itemMeatOnMs) / 60_000) : null;
                                  const offsetLabel = offsetMin != null && offsetMin > 0 ? fmtMinutes(offsetMin) + " after meat-on" : null;
                                  const clockLabel = new Date(sc.scheduledAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
                                  // Planned cooks: always tappable (opens preview) if onCheckinPress provided and not done.
                                  // Active cooks: tappable only when upcoming and not done (opens check-in log).
                                  const isTappable = isPlannedCook
                                    ? !isDone && !!onCheckinPress
                                    : !isDone && isUpcoming && !!onCheckinPress;
                                  const rowOpacity = isDone ? 0.65 : isPastDue ? 0.5 : 1;
                                  return (
                                    <Pressable
                                      key={`ci-${sc.phaseKey}`}
                                      onPress={isTappable ? () => onCheckinPress!(sc) : undefined}
                                      style={[s.seqTlRow, { marginLeft: 4, marginBottom: 6, opacity: rowOpacity }]}
                                    >
                                      {isNext
                                        ? <PulsingCheckinDot color={ciDotColor} />
                                        : isDone
                                          ? (
                                            <View style={{ marginTop: 5 }}>
                                              <Feather name="check-circle" size={10} color="#22c55e" />
                                            </View>
                                          )
                                          : <View style={[s.seqTlDot, { width: 8, height: 8, borderRadius: 4, marginTop: 5, backgroundColor: ciDotColor }]} />
                                      }
                                      <View style={{ flex: 1 }}>
                                        <View style={s.seqTlLabelRow}>
                                          <Feather name={isDone ? "check-circle" : "bell"} size={9} color={ciDotColor} style={{ marginRight: 2 }} />
                                          <Text style={[s.seqTlLabel, { color: ciDotColor, fontSize: 9 }]}>{isDone ? "Checked In" : "Check-In"}</Text>
                                          {isDueSoon && (
                                            <View style={[s.seqTlNextBadge, { backgroundColor: dueSoonColor + "25" }]}>
                                              <Text style={[s.seqTlNextText, { color: dueSoonColor }]}>DUE SOON</Text>
                                            </View>
                                          )}
                                        </View>
                                        <Text style={[s.seqTlMeta, { color: isDone || isPastDue ? colors.mutedForeground as string : colors.foreground as string, fontSize: 12, fontFamily: "Inter_600SemiBold" }]}>
                                          {sc.phaseLabel}
                                          {isPlannedCook ? (
                                            <Text style={[s.seqTlMeta, { color: ciColor }]}>
                                              {" "}· {clockLabel}{offsetLabel ? ` · ${offsetLabel}` : ""}
                                            </Text>
                                          ) : (
                                            <Text style={[s.seqTlMeta, { color: isUpcoming ? ciColor : colors.mutedForeground as string }]}>
                                              {" "}· {isUpcoming ? relCountdown(sc.scheduledAt, nowMs) : clockLabel}
                                            </Text>
                                          )}
                                        </Text>
                                        {isTappable && (
                                          <Text style={{ fontSize: 10, fontFamily: "Inter_400Regular", color: ciColor, marginTop: 1 }}>
                                            {isPlannedCook ? "Tap to preview →" : "Tap to check in →"}
                                          </Text>
                                        )}
                                      </View>
                                    </Pressable>
                                  );
                                }
                                return null;
                              })}
                            </>
                          );
                        })()}

                        {/* ── Wrap (temp mode only — no clock timestamp, renders at fixed position) ── */}
                        {item.wrapMethod && item.wrapMethod !== "none" && (() => {
                          const tempModeExplicit = (item.wrapAtMinutes ?? 0) > 0 ? Math.round(item.wrapAtMinutes) : null;
                          if (!(tempModeExplicit == null && item.wrapTempF != null)) return null;
                          const isNextWrap2 = nextStep?.itemIdx === idx && nextStep?.step === "wrap";
                          const wrapLabel2 = item.wrapMethod === "foil" ? "Wrap in foil" : item.wrapMethod === "butcher_paper" ? "Wrap in butcher paper" : "Wrap";
                          const wrapColor2 = "#A855F7";
                          return (
                            <View onLayout={(e) => { rowYRef.current[`${idx}:wrap`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextWrap2 && s.seqTlNextRow]}>
                              <View style={[s.seqTlDot, { backgroundColor: wrapColor2 }]} />
                              <View style={s.seqTlConnector} />
                              <View style={{ flex: 1 }}>
                                <View style={s.seqTlLabelRow}>
                                  <Text style={[s.seqTlLabel, { color: isNextWrap2 ? wrapColor2 : colors.mutedForeground }]}>{wrapLabel2}</Text>
                                  {isNextWrap2 && (
                                    <View style={[s.seqTlNextBadge, { backgroundColor: wrapColor2 + "25" }]}>
                                      <Text style={[s.seqTlNextText, { color: wrapColor2 }]}>NEXT</Text>
                                    </View>
                                  )}
                                </View>
                                <Text style={[s.seqTlTime, { color: colors.foreground }]}>
                                  When internal reaches {item.wrapTempF}°F
                                </Text>
                                {item.wrapReason ? <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16 }]}>{item.wrapReason}</Text> : null}
                                {c.wrapFinish ? <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16, fontStyle: "italic" }]}>{c.wrapFinish}</Text> : null}
                              </View>
                            </View>
                          );
                        })()}

                        {/* ── Stall zone (brisket / pork shoulder / chuck — active cooks only) ── */}
                        {isActive && stallProne && (
                          <View style={[s.seqTlRow, { marginLeft: 4 }]}>
                            <Pressable
                              onPress={() => toggleConfirmedStep(`${idx}_stall`)}
                              hitSlop={8}
                              style={s.seqTlDotBtn}
                            >
                              {stallConfirmed
                                ? <Feather name="check-circle" size={14} color="#ef4444" />
                                : <View style={[s.seqTlDot, { backgroundColor: "#ef444488" }]} />}
                            </Pressable>
                            <View style={[s.seqTlConnector, { borderColor: "#ef444433" }]} />
                            <View style={{ flex: 1 }}>
                              <View style={s.seqTlLabelRow}>
                                <Feather name="activity" size={11} color="#ef4444" style={{ marginRight: 3 }} />
                                <Text style={[s.seqTlLabel, { color: "#ef4444" }]}>
                                  {stallConfirmed ? "Stall detected" : "Stall zone"}
                                </Text>
                              </View>
                              <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 1 }]}>
                                {stallConfirmed ? "Temp plateau logged" : "Tap when temp plateaus — pick your move"}
                              </Text>
                              {stallConfirmed && (
                                <View style={s.seqTlStallBtns}>
                                  <Pressable
                                    onPress={() => toggleConfirmedStep(`${idx}_wrap`)}
                                    style={[s.seqTlStallBtn, { borderColor: "#A855F7" }]}
                                  >
                                    <Feather name="package" size={11} color="#A855F7" />
                                    <Text style={[s.seqTlStallBtnText, { color: "#A855F7" }]}>Wrap Now</Text>
                                  </Pressable>
                                  <View style={[s.seqTlStallBtn, { borderColor: colors.border }]}>
                                    <Feather name="wind" size={11} color={colors.mutedForeground} />
                                    <Text style={[s.seqTlStallBtnText, { color: colors.mutedForeground }]}>Riding It Out</Text>
                                  </View>
                                </View>
                              )}
                            </View>
                          </View>
                        )}

                        {/* ── Probe tenderness check (brisket / pork shoulder — active cooks only) ── */}
                        {isActive && probeTender && (
                          <View style={[s.seqTlRow, { marginLeft: 4 }]}>
                            <Pressable
                              onPress={() => toggleConfirmedStep(`${idx}_probeTender`)}
                              hitSlop={8}
                              style={s.seqTlDotBtn}
                            >
                              {probeTenderConfirmed
                                ? <Feather name="check-circle" size={14} color="#84cc16" />
                                : <View style={[s.seqTlDot, { backgroundColor: "#84cc1688" }]} />}
                            </Pressable>
                            <View style={[s.seqTlConnector, { borderColor: "#84cc1633" }]} />
                            <View style={{ flex: 1 }}>
                              <View style={s.seqTlLabelRow}>
                                <Feather name="check-square" size={11} color="#84cc16" style={{ marginRight: 3 }} />
                                <Text style={[s.seqTlLabel, { color: "#84cc16" }]}>
                                  {probeTenderConfirmed ? "Probe tender ✓" : "Check probe tenderness"}
                                </Text>
                              </View>
                              <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 1 }]}>
                                {probeTenderConfirmed
                                  ? "Probe slides in cleanly — nearly done"
                                  : "Tap when probe slides in with zero resistance"}
                              </Text>
                            </View>
                          </View>
                        )}

                        {/* ── Pull off ── */}
                        <View onLayout={(e) => { rowYRef.current[`${idx}:pullOff`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, { marginBottom: item.restMinutes > 0 ? 8 : 0 }, isNextPullOff && s.seqTlNextRow, isDonePullOff && !confirmedSteps[`${idx}_pullOff`] && s.seqTlDoneRow]}>
                          {isDonePullOff ? (
                            <Pressable onPress={() => toggleConfirmedStep(`${idx}_pullOff`)} hitSlop={8} style={s.seqTlDotBtn}>
                              {confirmedSteps[`${idx}_pullOff`]
                                ? <Feather name="check-circle" size={14} color="#22c55e" />
                                : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                            </Pressable>
                          ) : (
                            <View style={[s.seqTlDot, { backgroundColor: "#22c55e" }]} />
                          )}
                          {item.restMinutes > 0
                            ? <View style={s.seqTlConnector} />
                            : <View style={[s.seqTlConnector, { borderColor: "transparent" }]} />}
                          <View style={{ flex: 1 }}>
                            <View style={s.seqTlLabelRow}>
                              <Text style={[s.seqTlLabel, { color: isNextPullOff ? "#22c55e" : colors.mutedForeground }, isDonePullOff && s.seqTlDoneLabel]}>Pull off</Text>
                              {isNextPullOff && (
                                <View style={[s.seqTlNextBadge, { backgroundColor: "#22c55e25" }]}>
                                  <Text style={[s.seqTlNextText, { color: "#22c55e" }]}>NEXT</Text>
                                </View>
                              )}
                            </View>
                            <Text style={[s.seqTlTime, { color: isDonePullOff ? colors.mutedForeground : colors.foreground, opacity: isDonePullOff ? 0.55 : 1 }]}>
                              {new Date(item.estimatedFinishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                              {(cookStatus === "active" || cookStatus === "planned") && !isDonePullOff && (
                                <Text style={[s.seqTlMeta, { color: "#22c55e" }]}>
                                  {" "}· {relCountdown(new Date(item.estimatedFinishAt).getTime(), nowMs)}
                                </Text>
                              )}
                              {item.restMinutes > 0 && (
                                <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                  {" "}· {fmtMinutes(item.restMinutes)} rest
                                </Text>
                              )}
                            </Text>
                          </View>
                        </View>

                        {/* ── Ready to serve ── */}
                        {item.restMinutes > 0 && (
                          <View onLayout={(e) => { rowYRef.current[`${idx}:serve`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, { marginBottom: 0 }, isNextServe && s.seqTlNextRow, isDoneServe && !confirmedSteps[`${idx}_serve`] && s.seqTlDoneRow]}>
                            {isDoneServe ? (
                              <Pressable onPress={() => toggleConfirmedStep(`${idx}_serve`)} hitSlop={8} style={s.seqTlDotBtn}>
                                {confirmedSteps[`${idx}_serve`]
                                  ? <Feather name="check-circle" size={14} color="#6366f1" />
                                  : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
                              </Pressable>
                            ) : (
                              <View style={[s.seqTlDot, { backgroundColor: "#6366f1" }]} />
                            )}
                            <View style={[s.seqTlConnector, { borderColor: "transparent" }]} />
                            <View style={{ flex: 1 }}>
                              <View style={s.seqTlLabelRow}>
                                <Text style={[s.seqTlLabel, { color: isNextServe ? "#6366f1" : colors.mutedForeground }, isDoneServe && s.seqTlDoneLabel]}>Ready to serve</Text>
                                {isNextServe && (
                                  <View style={[s.seqTlNextBadge, { backgroundColor: "#6366f125" }]}>
                                    <Text style={[s.seqTlNextText, { color: "#6366f1" }]}>NEXT</Text>
                                  </View>
                                )}
                              </View>
                              <Text style={[s.seqTlTime, { color: isDoneServe ? colors.mutedForeground : colors.foreground, opacity: isDoneServe ? 0.55 : 1 }]}>
                                {new Date(serveMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true })}
                                {(cookStatus === "active" || cookStatus === "planned") && !isDoneServe && (
                                  <Text style={[s.seqTlMeta, { color: "#6366f1" }]}>
                                    {" "}· {relCountdown(serveMs, nowMs)}
                                  </Text>
                                )}
                              </Text>
                            </View>
                          </View>
                        )}
                      </>
                    );
                  })()}
                </View>

                {/* ── Item notes ── */}
                {item.notes ? (
                  <View style={[s.seqTlNoteBox, { backgroundColor: colors.border + "44" }]}>
                    <Feather name="info" size={12} color={colors.mutedForeground} />
                    <Text style={[s.seqTlNoteText, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  </View>
                ) : null}

                {/* ── Fuel quick-log (active cooks only) ── */}
                {isActive && onQuickLog && (
                  <View style={[s.seqTlFuelRow, { borderTopColor: colors.border }]}>
                    <Text style={[s.seqTlFuelLabel, { color: colors.mutedForeground }]}>Log fuel</Text>
                    <Pressable
                      onPress={() => onQuickLog("charcoal")}
                      style={[s.seqTlFuelBtn, s.seqTlFuelBtnCharcoal]}
                    >
                      <Feather name="grid" size={13} color="#9CA3AF" />
                      <Text style={[s.seqTlFuelBtnText, { color: "#9CA3AF" }]}>Charcoal</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => onQuickLog("wood")}
                      style={[s.seqTlFuelBtn, s.seqTlFuelBtnWood]}
                    >
                      <Feather name="wind" size={13} color="#D97706" />
                      <Text style={[s.seqTlFuelBtnText, { color: "#D97706" }]}>Wood</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
          <FingerprintCallout
            fingerprintSource={seqData.fingerprintSource}
            fingerprintNote={seqData.fingerprintNote}
            colors={colors}
          />
        </View>
      )}
    </View>
  );
}
