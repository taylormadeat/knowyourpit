import React, { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Image } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import {
  generateCheckinSchedule,
  type ScheduledCheckin,
  type CheckinSequenceAnchor,
} from "@/constants/checkinKnowledge";
import type { SequenceData } from "./types";
import type { CookCheckin } from "@workspace/api-client-react";

type Colors = Record<string, unknown> & {
  card: string;
  border: string;
  foreground: string;
  mutedForeground: string;
  primary: string;
  radius: number;
  muted: string;
  background: string;
};

interface Props {
  c: Record<string, unknown> | null | undefined;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  cookSeqData: SequenceData | null | undefined;
  checkins: CookCheckin[];
  checkinsLoading: boolean;
  onOpenCheckin: (checkin: ScheduledCheckin) => void;
}

const fmtTime = (ms: number) => {
  try {
    return new Date(ms).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const fmtDateTime = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const fmtCountdown = (targetMs: number, nowMs: number) => {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "Now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `in ${hrs}h ${rem}m`;
};

type StatusFlagKey = NonNullable<CookCheckin["statusFlag"]>;
const STATUS_FLAG_CONFIG: Partial<Record<StatusFlagKey, { label: string; color: string }>> = {
  all_good: { label: "All good", color: "#22c55e" },
  running_behind: { label: "Running behind", color: "#F59E0B" },
  flare_up: { label: "Flare-up", color: "#EF4444" },
  low_fuel: { label: "Low fuel", color: "#8B5CF6" },
};

export function CookCheckinTimeline({
  c,
  colors,
  cookStatus,
  nowMs,
  cookSeqData,
  checkins,
  checkinsLoading,
  onOpenCheckin,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const firstItem = cookSeqData?.schedule?.[0];
  const meatOnAt = firstItem?.meatOnAt;
  const estimatedFinishAt = firstItem?.estimatedFinishAt;
  const foodType = (firstItem?.foodType ?? (c?.foodType as string | null | undefined)) || null;

  const scheduledCheckins: ScheduledCheckin[] = React.useMemo(() => {
    if (!meatOnAt || !estimatedFinishAt) return [];
    const meatOnAtMs = new Date(meatOnAt).getTime();
    const finishAtMs = new Date(estimatedFinishAt).getTime();
    if (finishAtMs <= meatOnAtMs) return [];
    const anchor: CheckinSequenceAnchor = {
      meatOnAt,
      estimatedFinishAt,
      wrapAtMinutes: firstItem?.wrapAtMinutes ?? null,
    };
    return generateCheckinSchedule(foodType, meatOnAtMs, finishAtMs, anchor);
  }, [foodType, meatOnAt, estimatedFinishAt, firstItem?.wrapAtMinutes]);

  const completedMap = React.useMemo(() => {
    const map = new Map<string, CookCheckin>();
    for (const ci of checkins) {
      if (ci.phaseKey) map.set(ci.phaseKey, ci);
    }
    return map;
  }, [checkins]);

  const isActive = cookStatus === "active";
  const isCompleted = cookStatus === "completed";
  const isPlanned = cookStatus === "planned";

  if (!isActive && !isCompleted && !isPlanned) return null;
  if (scheduledCheckins.length === 0 && checkins.length === 0) return null;

  const completedCount = checkins.length;
  const upcomingCount = scheduledCheckins.filter(
    (sc) => !completedMap.has(sc.phaseKey) && sc.scheduledAt > nowMs,
  ).length;

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: colors.radius,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden",
      }}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
      >
        <LinearGradient
          colors={["#374151", "#52525B"]}
          style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="check-square" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground }}>
            Check-In Timeline
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            {isPlanned
              ? `${scheduledCheckins.length} check-in${scheduledCheckins.length !== 1 ? "s" : ""} planned`
              : completedCount > 0 ? `${completedCount} completed` : isActive ? `${upcomingCount} upcoming` : "No check-ins recorded"}
            {isActive && upcomingCount > 0 && completedCount > 0 ? ` · ${upcomingCount} upcoming` : ""}
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
          {checkinsLoading ? (
            <View style={{ padding: 20, alignItems: "center" }}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : (
            <View style={{ padding: 14, gap: 0 }}>
              {scheduledCheckins.map((sc, idx) => {
                const completed = completedMap.get(sc.phaseKey);
                const upcoming = scheduledCheckins
                  .filter((s) => !completedMap.has(s.phaseKey) && s.scheduledAt > nowMs);
                const isNext = isActive && !completed && upcoming[0]?.phaseKey === sc.phaseKey;
                const isPast = sc.scheduledAt <= nowMs && !completed;

                return (
                  <View key={sc.id}>
                    {idx > 0 && (
                      <View style={{
                        width: 1,
                        height: 16,
                        backgroundColor: completed ? "#22c55e40" : colors.border,
                        marginLeft: 16,
                      }} />
                    )}
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: completed ? "#22c55e20" : isNext ? `${colors.primary}20` : isPast ? "#F59E0B20" : colors.muted,
                        borderWidth: 1.5,
                        borderColor: completed ? "#22c55e" : isNext ? colors.primary : isPast ? "#F59E0B" : colors.border,
                      }}>
                        {completed ? (
                          <Feather name="check" size={14} color="#22c55e" />
                        ) : isNext ? (
                          <Feather name="clock" size={13} color={colors.primary} />
                        ) : isPast ? (
                          <Feather name="alert-circle" size={13} color="#F59E0B" />
                        ) : (
                          <Feather name="circle" size={13} color={colors.mutedForeground} />
                        )}
                      </View>

                      <View style={{ flex: 1, paddingVertical: 4 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 }}>
                          <Text style={{
                            fontFamily: completed || isNext ? "Inter_600SemiBold" : "Inter_500Medium",
                            fontSize: 13,
                            color: completed ? "#22c55e" : isNext ? colors.primary : isPast ? "#F59E0B" : colors.mutedForeground,
                          }}>
                            {sc.phaseLabel}
                          </Text>
                          {completed?.statusFlag && (() => {
                            const cfg = STATUS_FLAG_CONFIG[completed.statusFlag];
                            return cfg ? (
                              <View style={{
                                paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10,
                                backgroundColor: `${cfg.color}20`, borderWidth: 1, borderColor: `${cfg.color}40`,
                              }}>
                                <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: cfg.color }}>
                                  {cfg.label}
                                </Text>
                              </View>
                            ) : null;
                          })()}
                        </View>

                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                          {completed
                            ? `Checked in ${fmtDateTime(completed.firedAt ?? completed.createdAt)}`
                            : isNext
                            ? fmtCountdown(sc.scheduledAt, nowMs)
                            : isPast
                            ? `Missed · ${fmtTime(sc.scheduledAt)}`
                            : isPlanned && sc.scheduledAt > nowMs
                            ? `${fmtTime(sc.scheduledAt)} · ${fmtCountdown(sc.scheduledAt, nowMs)}`
                            : fmtTime(sc.scheduledAt)}
                        </Text>

                        {completed && (
                          <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                            {completed.internalTempF != null && (
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground }}>
                                🌡 {Math.round(completed.internalTempF)}°F
                              </Text>
                            )}
                            {completed.pitTempF != null && (
                              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground }}>
                                🔥 Pit {Math.round(completed.pitTempF)}°F
                              </Text>
                            )}
                          </View>
                        )}
                        {completed?.userNote && (
                          <Text style={{
                            fontFamily: "Inter_400Regular", fontSize: 11,
                            color: colors.mutedForeground, fontStyle: "italic", marginTop: 3,
                          }} numberOfLines={2}>
                            "{completed.userNote}"
                          </Text>
                        )}
                        {completed?.aiGuidanceShown && (
                          <Text style={{
                            fontFamily: "Inter_400Regular", fontSize: 11,
                            color: `${colors.primary}CC`, marginTop: 3,
                          }} numberOfLines={2}>
                            PitMaster: {completed.aiGuidanceShown}
                          </Text>
                        )}

                        {isNext && isActive && !isPlanned && (
                          <Pressable
                            onPress={() => onOpenCheckin(sc)}
                            style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 6, alignSelf: "flex-start" }}
                          >
                            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.primary }}>
                              Check in now
                            </Text>
                            <Feather name="arrow-right" size={12} color={colors.primary} />
                          </Pressable>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })}

              {checkins
                .filter((ci) => !scheduledCheckins.some((sc) => sc.phaseKey === ci.phaseKey))
                .map((ci, idx) => (
                  <View key={`extra_${ci.id}`} style={{ marginTop: idx === 0 && scheduledCheckins.length > 0 ? 12 : 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
                      <View style={{
                        width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
                        backgroundColor: "#22c55e20", borderWidth: 1.5, borderColor: "#22c55e",
                      }}>
                        <Feather name="check" size={14} color="#22c55e" />
                      </View>
                      <View style={{ flex: 1, paddingVertical: 4 }}>
                        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#22c55e" }}>
                          {ci.phaseLabel ?? "Manual Check-In"}
                        </Text>
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                          {fmtDateTime(ci.firedAt ?? ci.createdAt)}
                        </Text>
                        {ci.internalTempF != null && (
                          <Text style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: colors.mutedForeground, marginTop: 2 }}>
                            🌡 {Math.round(ci.internalTempF)}°F
                          </Text>
                        )}
                        {ci.userNote && (
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, fontStyle: "italic", marginTop: 3 }} numberOfLines={2}>
                            "{ci.userNote}"
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

interface CookJourneyProps {
  c: Record<string, unknown> | null | undefined;
  colors: Colors;
  checkins: CookCheckin[];
  cookSeqData: SequenceData | null | undefined;
}

export function CookJourneyReplay({ c, colors, checkins, cookSeqData: _cookSeqData }: CookJourneyProps) {
  const [expanded, setExpanded] = useState(false);

  if ((c?.status as string | undefined) !== "completed") return null;
  if (checkins.length === 0) return null;

  return (
    <View style={{
      backgroundColor: colors.card, borderRadius: colors.radius,
      borderWidth: 1, borderColor: colors.border, overflow: "hidden",
    }}>
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14 }}
      >
        <LinearGradient
          colors={["#6C3BF5", "#3B82F6"]}
          style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" }}
        >
          <Feather name="book-open" size={16} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground }}>
            Cook Journey
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, marginTop: 2 }}>
            {checkins.length} check-in{checkins.length !== 1 ? "s" : ""} · replay the full cook
          </Text>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
      </Pressable>

      {expanded && (
        <View style={{ borderTopWidth: 1, borderTopColor: colors.border, padding: 14, gap: 16 }}>
          {[...checkins]
            .sort((a, b) => new Date(a.firedAt ?? a.createdAt).getTime() - new Date(b.firedAt ?? b.createdAt).getTime())
            .map((ci, idx) => {
              const flagCfg = ci.statusFlag ? STATUS_FLAG_CONFIG[ci.statusFlag] : null;
              return (
                <View key={ci.id} style={{ gap: 8 }}>
                  {idx > 0 && <View style={{ height: 1, backgroundColor: colors.border }} />}
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: "#22c55e20", borderWidth: 1, borderColor: "#22c55e",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#22c55e" }}>{idx + 1}</Text>
                    </View>
                    <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: colors.foreground, flex: 1 }}>
                      {ci.phaseLabel ?? "Check-In"}
                    </Text>
                    {flagCfg && (
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: `${flagCfg.color}20` }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: flagCfg.color }}>
                          {flagCfg.label}
                        </Text>
                      </View>
                    )}
                  </View>

                  <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                    {new Date(ci.firedAt ?? ci.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </Text>

                  {(ci.internalTempF != null || ci.pitTempF != null) && (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      {ci.internalTempF != null && (
                        <View style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Internal</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground }}>{Math.round(ci.internalTempF)}°F</Text>
                        </View>
                      )}
                      {ci.pitTempF != null && (
                        <View style={{ backgroundColor: colors.background, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground }}>Pit</Text>
                          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground }}>{Math.round(ci.pitTempF)}°F</Text>
                        </View>
                      )}
                    </View>
                  )}

                  {ci.userNote && (
                    <View style={{ backgroundColor: colors.background, borderRadius: 8, padding: 10, borderLeftWidth: 3, borderLeftColor: colors.primary }}>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, fontStyle: "italic", lineHeight: 18 }}>
                        "{ci.userNote}"
                      </Text>
                    </View>
                  )}

                  {ci.photoKey && (
                    ci.photoKey.startsWith("local:") ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Feather name="camera" size={12} color={colors.mutedForeground} />
                        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                          Photo captured
                        </Text>
                      </View>
                    ) : (
                      <View>
                        <Image
                          source={{ uri: ci.photoKey }}
                          style={{ width: "100%", height: 140, borderRadius: 8 }}
                          resizeMode="cover"
                        />
                      </View>
                    )
                  )}

                  {ci.aiGuidanceShown && (
                    <View style={{ backgroundColor: `${colors.primary}10`, borderRadius: 8, padding: 10 }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.primary, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        PitMaster Coaching
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, lineHeight: 18 }}>
                        {ci.aiGuidanceShown}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
        </View>
      )}
    </View>
  );
}
