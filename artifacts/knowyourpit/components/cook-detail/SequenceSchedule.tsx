import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { relCountdown } from "./utils";
import type { NextStep } from "./types";

type Colors = any;

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
}

export function SequenceSchedule(p: Props) {
  const {
    c, colors, cookStatus, nowMs, nextStep,
    seqScheduleExpanded, setSeqScheduleExpanded,
    confirmedSteps, toggleConfirmedStep,
    scheduleListYRef, itemYRef, timelineYRef, rowYRef,
  } = p;

  const seqData = (c.sequenceData as { schedule: any[]; serveAt: string; summary?: string | null } | null | undefined);
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
              Serve by {new Date(seqData.serveAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {" · "}{seqData.schedule.length} item{seqData.schedule.length !== 1 ? "s" : ""}
            </Text>
          ) : null}
        </View>
        <Feather name={seqScheduleExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {seqScheduleExpanded && (
        <View
          style={{ padding: 12, gap: 10 }}
          onLayout={(e) => { scheduleListYRef.current = e.nativeEvent.layout.y; }}
        >
          {seqData.schedule.map((item: any, idx: number) => {
            const isCurrent = idx === currentIdx;
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
                        <View onLayout={(e) => { rowYRef.current[`${idx}:grillLight`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextGrillLight && s.seqTlNextRow, isDoneGrillLight && !confirmedSteps[`${idx}_grillLight`] && s.seqTlDoneRow]}>
                          {isDoneGrillLight ? (
                            <Pressable onPress={() => toggleConfirmedStep(`${idx}_grillLight`)} hitSlop={8} style={s.seqTlDotBtn}>
                              {confirmedSteps[`${idx}_grillLight`]
                                ? <Feather name="check-circle" size={14} color="#f59e0b" />
                                : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
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
                              {new Date(item.grillLightAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                        <View onLayout={(e) => { rowYRef.current[`${idx}:meatOn`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextMeatOn && s.seqTlNextRow, isDoneMeatOn && !confirmedSteps[`${idx}_meatOn`] && s.seqTlDoneRow]}>
                          {isDoneMeatOn ? (
                            <Pressable onPress={() => toggleConfirmedStep(`${idx}_meatOn`)} hitSlop={8} style={s.seqTlDotBtn}>
                              {confirmedSteps[`${idx}_meatOn`]
                                ? <Feather name="check-circle" size={14} color="#EB6C2B" />
                                : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
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
                              {new Date(item.meatOnAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                        {item.wrapMethod && item.wrapMethod !== "none" ? (() => {
                          const explicitWrapMin = (item.wrapAtMinutes ?? 0) > 0
                            ? Math.round(item.wrapAtMinutes)
                            : null;
                          const cookMin = typeof item.estimatedDurationMinutes === "number" && item.estimatedDurationMinutes > 0
                            ? item.estimatedDurationMinutes
                            : null;
                          // Inferred wrap timing — used only as a last-resort display
                          // when neither explicit `wrapAtMinutes` nor `wrapTempF` is
                          // available. We intentionally keep this fallback so cooks
                          // saved before the AI sequencer reliably emitted wrap fields
                          // still surface a wrap row. The display marks it with "≈"
                          // and "around the stall" so the pitmaster knows it's an
                          // estimate, and `computeNextStep` deliberately ignores
                          // inferred timing so the persistent banner never counts
                          // down to a guess.
                          const inferredWrapMin = cookMin != null
                            ? Math.max(30, Math.round(cookMin * 0.55))
                            : null;
                          // Spec: when wrapAtMinutes is missing but wrapTempF is set,
                          // the wrap is purely temp-triggered — render "when internal
                          // reaches X°F" instead of an inferred clock time so the
                          // pitmaster doesn't anchor on a fake countdown.
                          const wrapMode: "clock" | "temp" =
                            explicitWrapMin == null && item.wrapTempF != null
                              ? "temp"
                              : "clock";
                          const wrapAtMin = wrapMode === "clock" ? (explicitWrapMin ?? inferredWrapMin) : null;
                          if (wrapMode === "clock" && wrapAtMin == null) return null;
                          const wrapInferred = wrapMode === "clock" && explicitWrapMin === null;
                          const wrapMs = wrapAtMin != null && item.meatOnAt
                            ? new Date(item.meatOnAt).getTime() + wrapAtMin * 60000
                            : null;
                          const isDoneWrap = wrapMs != null && cookStatus === "active" && wrapMs < nowMs;
                          // Match NextUpBanner.getStepLabel and useScheduleStepNotifications:
                          // unknown wrap methods fall back to plain "Wrap" rather than
                          // mislabeling as butcher paper.
                          const wrapLabel =
                            item.wrapMethod === "foil"
                              ? "Wrap in foil"
                              : item.wrapMethod === "butcher_paper"
                                ? "Wrap in butcher paper"
                                : "Wrap";
                          const wrapColor = "#A855F7";
                          // Only highlight as NEXT when we have an explicit clock time —
                          // matches computeNextStep's eligibility, so the persistent
                          // banner countdown and the timeline highlight stay in sync.
                          const isNextWrap =
                            nextStep?.itemIdx === idx && nextStep?.step === "wrap";
                          return (
                            <View onLayout={(e) => { rowYRef.current[`${idx}:wrap`] = e.nativeEvent.layout.y; }} style={[s.seqTlRow, isNextWrap && s.seqTlNextRow, isDoneWrap && !confirmedSteps[`${idx}_wrap`] && s.seqTlDoneRow]}>
                              {isDoneWrap ? (
                                <Pressable onPress={() => toggleConfirmedStep(`${idx}_wrap`)} hitSlop={8} style={s.seqTlDotBtn}>
                                  {confirmedSteps[`${idx}_wrap`]
                                    ? <Feather name="check-circle" size={14} color={wrapColor} />
                                    : <View style={[s.seqTlDot, { backgroundColor: colors.mutedForeground, opacity: 0.45 }]} />}
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
                                {wrapMode === "temp" ? (
                                  <Text style={[s.seqTlTime, { color: colors.foreground }]}>
                                    When internal reaches {item.wrapTempF}°F
                                  </Text>
                                ) : (
                                  <Text style={[s.seqTlTime, { color: isDoneWrap ? colors.mutedForeground : colors.foreground, opacity: isDoneWrap ? 0.55 : 1 }]}>
                                    {wrapInferred ? "≈ " : ""}{wrapMs != null ? new Date(wrapMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""}
                                    {wrapMs != null && (cookStatus === "active" || cookStatus === "planned") && !isDoneWrap && (
                                      <Text style={[s.seqTlMeta, { color: wrapColor }]}>
                                        {" "}· {relCountdown(wrapMs, nowMs)}
                                      </Text>
                                    )}
                                    {item.wrapTempF ? (
                                      <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                        {" "}· at {item.wrapTempF}°F internal
                                      </Text>
                                    ) : wrapInferred ? (
                                      <Text style={[s.seqTlMeta, { color: colors.mutedForeground }]}>
                                        {" "}· around the stall
                                      </Text>
                                    ) : null}
                                  </Text>
                                )}
                                {item.wrapReason ? (
                                  <Text style={[s.seqTlMeta, { color: colors.mutedForeground, marginTop: 2, lineHeight: 16 }]}>{item.wrapReason}</Text>
                                ) : null}
                              </View>
                            </View>
                          );
                        })() : null}
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
                              {new Date(item.estimatedFinishAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                                {new Date(serveMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
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
                {item.notes ? (
                  <View style={[s.seqTlNoteBox, { backgroundColor: colors.border + "44" }]}>
                    <Feather name="info" size={12} color={colors.mutedForeground} />
                    <Text style={[s.seqTlNoteText, { color: colors.mutedForeground }]}>{item.notes}</Text>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
