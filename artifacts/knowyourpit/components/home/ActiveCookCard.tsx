import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, StyleSheet, Animated } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useStoredScheduledCheckins } from "@/hooks/useCheckinNotifications";
import { setPendingCheckin } from "@/lib/pendingCheckinNotif";
import { getCookCardBar } from "@/utils/cookCardBar";
import { letterGrade, scoreColor } from "@/utils/gradeUtils";
import { AnimatedBarFill } from "@/components/cook-detail/CookProgressBar";
import { ThawStatusBanner } from "@/components/cook-detail/ThawStatusBanner";

const URGENCY_COLOR: Record<string, string> = {
  now: "#EF4444",
  soon: "#F59E0B",
  when_ready: "#6C3BF5",
  maintain: "#22c55e",
};

function fmtElapsed(ms: number): string {
  const totalMins = Math.floor(ms / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function fmtCountdown(targetMs: number): string {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "now";
  const totalMins = Math.floor(diff / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function fmtCheckinCountdown(nowMs: number, targetMs: number): string {
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "now";
  const mins = Math.floor(diffMs / 60000);
  if (mins <= 5) return "soon";
  if (mins < 60) return `in ${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return rem > 0 ? `in ${hrs}h ${rem}m` : `in ${hrs}h`;
}

interface ActiveCookCardProps {
  activeCook: any;
  nowMs: number;
  insights: any | null | undefined;
}

export function ActiveCookCard({ activeCook, nowMs, insights }: ActiveCookCardProps) {
  const colors = useColors();
  const router = useRouter();

  const cookSeqMeatOnAt = activeCook?.sequenceData?.schedule?.[0]?.meatOnAt ?? null;
  const cookSeqMeatOnMs: number | null = cookSeqMeatOnAt
    ? new Date(cookSeqMeatOnAt as string).getTime()
    : null;
  const cookActualStartMs = activeCook?.actualStartAt
    ? new Date(activeCook.actualStartAt).getTime()
    : null;
  const cookIsMeatOn =
    (cookActualStartMs != null && cookActualStartMs <= nowMs) ||
    cookSeqMeatOnMs == null ||
    cookSeqMeatOnMs <= nowMs;
  const cookTopDecision = activeCook?.analysisResult?.decisions?.[0] ?? null;
  const cookTopDecisionColor = cookTopDecision
    ? URGENCY_COLOR[cookTopDecision.urgency] ?? "#6C3BF5"
    : null;
  const bar = getCookCardBar(activeCook, nowMs);

  const storedCheckins = useStoredScheduledCheckins(activeCook?.id ?? null);
  const nextCheckin = storedCheckins.find((sc) => sc.scheduledAt > nowMs) ?? null;

  const isCheckinUrgent =
    nextCheckin != null && nextCheckin.scheduledAt - nowMs <= 5 * 60 * 1000;

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isCheckinUrgent) {
      pulseRef.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 750,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 750,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseRef.current.start();
    } else {
      pulseRef.current?.stop();
      pulseAnim.setValue(1);
    }
    return () => {
      pulseRef.current?.stop();
    };
  }, [isCheckinUrgent, pulseAnim]);

  return (
    <Pressable
      style={({ pressed }) => [pressed && { opacity: 0.88 }]}
      onPress={() => router.push(`/cooks/${activeCook.id}` as any)}
    >
      <LinearGradient
        colors={["#2D1008", "#1E0B04"]}
        style={[s.activeCookWidget, { borderColor: "#E8482055" }]}
      >
        {/* Live indicator row */}
        <View style={s.activeLiveRow}>
          <View style={[s.liveDot, !cookIsMeatOn && { backgroundColor: "#38bdf8" }]} />
          <Text style={[s.liveLabel, !cookIsMeatOn && { color: "#38bdf8" }]}>
            {cookIsMeatOn ? "LIVE ON THE SMOKER" : "THAWING"}
          </Text>
          {cookIsMeatOn ? (
            ((cookSeqMeatOnMs != null && cookSeqMeatOnMs <= nowMs) ||
              activeCook.actualStartAt) && (
              <Text style={s.elapsedBadge}>
                {fmtElapsed(
                  nowMs -
                    (cookSeqMeatOnMs != null && cookSeqMeatOnMs <= nowMs
                      ? cookSeqMeatOnMs
                      : new Date(activeCook.actualStartAt!).getTime()),
                )}{" "}
                in
              </Text>
            )
          ) : cookSeqMeatOnMs != null ? (
            <Text style={[s.elapsedBadge, { color: "#38bdf8" }]}>
              meat on in {fmtCountdown(cookSeqMeatOnMs)}
            </Text>
          ) : null}
          {insights &&
            (() => {
              const g = letterGrade(insights.pitMasterScore);
              const gc = scoreColor(insights.pitMasterScore);
              return (
                <View
                  style={{
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: 5,
                    backgroundColor: gc + "22",
                    borderWidth: 1,
                    borderColor: gc + "55",
                  }}
                >
                  <Text
                    style={{
                      fontFamily: "Inter_700Bold",
                      fontSize: 10,
                      color: gc,
                    }}
                  >
                    {g}
                  </Text>
                </View>
              );
            })()}
        </View>

        {/* Food type */}
        <Text style={s.activeFoodType}>
          {activeCook.foodType || "Cook in progress"}
        </Text>
        {activeCook.grillName ? (
          <Text style={s.activeGrill}>{activeCook.grillName}</Text>
        ) : null}

        {/* Next check-in countdown — tappable: jumps straight to check-in sheet */}
        {nextCheckin != null && (
          <Animated.View style={{ opacity: pulseAnim, alignSelf: "flex-start" }}>
            <Pressable
              style={({ pressed }) => [s.checkinRow, pressed && { opacity: 0.7 }]}
              hitSlop={8}
              onPress={(e) => {
                e.stopPropagation();
                setPendingCheckin({
                  cookId: activeCook.id,
                  phaseKey: nextCheckin.phaseKey,
                  phaseLabel: nextCheckin.phaseLabel,
                  scheduledAt: nextCheckin.scheduledAt,
                  autoOpen: true,
                });
                router.push(`/cooks/${activeCook.id}` as any);
              }}
            >
              <Feather name="clock" size={11} color="#96908A" />
              <Text style={s.checkinText}>
                {"Next check-in: "}
                <Text style={s.checkinLabel}>{nextCheckin.phaseLabel}</Text>
                {" · "}
                <Text
                  style={[
                    s.checkinCountdown,
                    isCheckinUrgent && { color: "#EF4444" },
                  ]}
                >
                  {fmtCheckinCountdown(nowMs, nextCheckin.scheduledAt)}
                </Text>
              </Text>
              <Feather name="chevron-right" size={10} color="#96908A" style={{ marginLeft: 2 }} />
            </Pressable>
          </Animated.View>
        )}

        {/* Thaw status banner — shown when meat is not yet on the grill */}
        {!cookIsMeatOn && (
          <View style={{ marginTop: 10 }}>
            <ThawStatusBanner
              cookStatus={activeCook.status}
              isMeatOn={cookIsMeatOn}
              actualStartAt={activeCook.actualStartAt}
              cookSeqData={activeCook.sequenceData}
              meatOnMs={cookSeqMeatOnMs}
              nowMs={nowMs}
              thawMethod={activeCook.thawMethod}
              actualThawStartAt={activeCook.actualThawStartAt}
              colors={colors}
            />
          </View>
        )}

        {/* Temp chips */}
        {(activeCook.targetTempF != null ||
          activeCook.cookTempF != null ||
          activeCook.currentTempF != null) && (
          <View
            style={{
              flexDirection: "row",
              gap: 6,
              marginTop: 6,
              marginBottom: 2,
              flexWrap: "wrap",
            }}
          >
            {activeCook.targetTempF != null && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: "#22c55e12",
                  borderWidth: 1,
                  borderColor: "#22c55e30",
                }}
              >
                <Feather name="thermometer" size={10} color="#22c55e" />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "#22c55e",
                  }}
                >
                  {activeCook.targetTempF}°F
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 10,
                    color: "#22c55e99",
                  }}
                >
                  target
                </Text>
              </View>
            )}
            {activeCook.cookTempF != null && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: "#3b82f612",
                  borderWidth: 1,
                  borderColor: "#3b82f630",
                }}
              >
                <Feather name="wind" size={10} color="#3b82f6" />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "#3b82f6",
                  }}
                >
                  {activeCook.cookTempF}°F
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 10,
                    color: "#3b82f699",
                  }}
                >
                  pit
                </Text>
              </View>
            )}
            {activeCook.currentTempF != null && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                  paddingHorizontal: 7,
                  paddingVertical: 3,
                  borderRadius: 6,
                  backgroundColor: "#F59E0B12",
                  borderWidth: 1,
                  borderColor: "#F59E0B30",
                }}
              >
                <Feather name="activity" size={10} color="#F59E0B" />
                <Text
                  style={{
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 10,
                    color: "#F59E0B",
                  }}
                >
                  {activeCook.currentTempF}°F
                </Text>
                <Text
                  style={{
                    fontFamily: "Inter_400Regular",
                    fontSize: 10,
                    color: "#F59E0B99",
                  }}
                >
                  probe
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Decision block / CTA */}
        {cookTopDecision ? (
          <View
            style={[
              s.decisionTeaser,
              {
                backgroundColor: cookTopDecisionColor! + "15",
                borderColor: cookTopDecisionColor! + "35",
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              },
            ]}
          >
            <View
              style={{
                width: 3,
                alignSelf: "stretch",
                backgroundColor: cookTopDecisionColor!,
                borderRadius: 2,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Inter_700Bold",
                  fontSize: 10,
                  color: cookTopDecisionColor!,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                  marginBottom: 2,
                }}
              >
                {cookTopDecision.action.replace(/_/g, " ")}
              </Text>
              <Text
                style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: "#F3EDE1" }}
                numberOfLines={2}
              >
                {cookTopDecision.instruction}
              </Text>
            </View>
            <Feather name="chevron-right" size={14} color={cookTopDecisionColor!} />
          </View>
        ) : (
          <View
            style={[s.decisionTeaser, { flexDirection: "row", alignItems: "center", gap: 8 }]}
          >
            <Feather name="zap" size={13} color="#F59E0B" />
            <Text style={[s.decisionTeaserText, { color: "#F59E0B", flex: 1 }]}>
              Tap to get PitMaster coaching
            </Text>
            <Feather name="chevron-right" size={14} color="#F59E0B" />
          </View>
        )}

        {/* Progress bar — 3px flush at bottom edge */}
        {bar !== null && (
          <View style={s.activeCookBar}>
            <AnimatedBarFill progress={bar.progress} color={bar.color} borderRadius={0} />
          </View>
        )}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  activeCookWidget: {
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    gap: 10,
    overflow: "hidden",
  },
  activeCookBar: {
    height: 3,
    backgroundColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
    marginTop: 6,
    marginHorizontal: -16,
  },
  activeLiveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#E84820",
  },
  liveLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#E84820",
    letterSpacing: 0.8,
    flex: 1,
  },
  elapsedBadge: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#96908A",
  },
  activeFoodType: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#F3EDE1",
  },
  activeGrill: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#7A6E62",
    marginTop: -6,
  },
  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -4,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  checkinText: {
    fontFamily: "Inter_400Regular",
    fontSize: 12,
    color: "#96908A",
  },
  checkinLabel: {
    fontFamily: "Inter_500Medium",
    fontSize: 12,
    color: "#B8B2AA",
  },
  checkinCountdown: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    color: "#D4CEC8",
  },
  decisionTeaser: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  decisionTeaserText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    lineHeight: 18,
  },
});
