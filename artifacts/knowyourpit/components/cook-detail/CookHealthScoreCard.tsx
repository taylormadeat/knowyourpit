import React, { useState, useEffect } from "react";
import type { ComponentProps } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import type { DimensionValue } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useGetCookHealth, getGetCookHealthQueryKey } from "@workspace/api-client-react";

type FeatherName = ComponentProps<typeof Feather>["name"];

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

const URGENCY_COLORS: Record<string, string> = {
  now: "#EF4444",
  soon: "#F59E0B",
  when_ready: "#6C3BF5",
};

interface LastDecision {
  action: string;
  urgency: string;
  instruction: string;
  rationale?: string;
}

const GRADE_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  A: { color: "#22c55e", bgColor: "#22c55e20", label: "Excellent" },
  B: { color: "#84cc16", bgColor: "#84cc1620", label: "Good" },
  C: { color: "#F59E0B", bgColor: "#F59E0B20", label: "Fair" },
  D: { color: "#F97316", bgColor: "#F9731620", label: "Needs Attention" },
  F: { color: "#EF4444", bgColor: "#EF444420", label: "Critical" },
};

const F_GRADE_QUIPS = [
  "Honestly? The raccoons would turn this down. Let it go.",
  "Even the dog walked away. That says everything.",
  "This is a medical waste situation, not a BBQ.",
  "At this point it's a fire hazard, not a meal.",
  "PitMaster's official recommendation: cut your losses and order pizza.",
  "This cook is done. Not in the good way.",
  "The smoke detector called — it's filing a complaint.",
  "Your grill tried its best. This one's not salvageable.",
];

export function getFGradeQuip(cookId: number): string {
  return F_GRADE_QUIPS[cookId % F_GRADE_QUIPS.length];
}

const GRADE_SCORE: Record<string, number> = { A: 1, B: 0.8, C: 0.6, D: 0.4, F: 0.2 };

interface Props {
  cookId: number;
  colors: Colors;
  cookStatus: string | undefined;
  checkinCount: number;
  lastDecision?: LastDecision | null;
  onGradeChange?: (grade: string, quip: string | null) => void;
  compact?: boolean;
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

export function CookHealthScoreCard({ cookId, colors, cookStatus, checkinCount, lastDecision, onGradeChange, compact, externalOpen, onExternalOpenHandled }: Props) {
  const [breakdownVisible, setBreakdownVisible] = useState(false);

  useEffect(() => {
    if (externalOpen) {
      setBreakdownVisible(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen, onExternalOpenHandled]);

  const { data: health, isLoading } = useGetCookHealth(cookId, {
    query: {
      queryKey: getGetCookHealthQueryKey(cookId),
      enabled: cookStatus === "active" || cookStatus === "completed",
      refetchInterval: cookStatus === "active" ? 60000 : false,
    },
  });

  const grade = health?.grade as string | undefined;

  useEffect(() => {
    if (!onGradeChange || !grade) return;
    onGradeChange(grade, grade === "F" ? getFGradeQuip(cookId) : null);
  }, [grade, cookId, onGradeChange]);

  if (cookStatus !== "active" && cookStatus !== "completed") return null;
  if (isLoading || !health) return null;

  if (health.grade === null) {
    return (
      <View
        style={{
          backgroundColor: "#f59e0b0a",
          borderRadius: 12,
          borderWidth: 1,
          borderColor: "#f59e0b40",
          padding: 14,
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
        }}
      >
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 14,
            backgroundColor: "#f59e0b18",
            borderWidth: 2,
            borderColor: "#f59e0b",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 26, color: "#f59e0b" }}>—</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#f59e0b" }}>
            Cook Health — Under Review
          </Text>
          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: "#f59e0b99", marginTop: 3, lineHeight: 17 }}>
            {health.reason}
          </Text>
        </View>
        <Feather name="alert-triangle" size={16} color="#f59e0b" />
      </View>
    );
  }

  const resolvedGrade = health.grade as string;
  const cfg = GRADE_CONFIG[resolvedGrade] ?? GRADE_CONFIG.C;
  const score = GRADE_SCORE[resolvedGrade] ?? 0.5;
  const fQuip = resolvedGrade === "F" ? getFGradeQuip(cookId) : null;
  const displayReason = fQuip ?? health.reason;

  const breakdownModal = (
    <Modal visible={breakdownVisible} transparent animationType="slide" onRequestClose={() => setBreakdownVisible(false)}>
      <Pressable style={{ flex: 1, backgroundColor: "#00000060" }} onPress={() => setBreakdownVisible(false)} />
      <View
        style={{
          backgroundColor: colors.card as string,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: colors.border as string,
          maxHeight: "70%",
        }}
      >
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: "#F3EDE1" }}>Health Score Breakdown</Text>
          <Pressable onPress={() => setBreakdownVisible(false)} hitSlop={8}>
            <Feather name="x" size={22} color="#F3EDE1" />
          </Pressable>
        </LinearGradient>

        <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", marginBottom: 20 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: cfg.bgColor,
                borderWidth: 3,
                borderColor: cfg.color,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 44, color: cfg.color }}>{resolvedGrade}</Text>
            </View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 20, color: cfg.color }}>{cfg.label}</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 14, color: resolvedGrade === "F" ? "#EF4444" : colors.mutedForeground as string, marginTop: 4, textAlign: "center" }}>
              {displayReason}
            </Text>
          </View>

          {(
            [
              {
                label: "AI Verdict",
                icon: "cpu" as FeatherName,
                value: health.factors.aiVerdict
                  ? ({ perfect: "Perfect", good: "Good", needs_work: "Needs Work", overcooked: "Overcooked", undercooked: "Undercooked" }[health.factors.aiVerdict] ?? health.factors.aiVerdict)
                  : "Not yet analyzed",
                ok: health.factors.aiVerdict === "perfect" || health.factors.aiVerdict === "good",
                note: "60% of health score",
              },
              {
                label: "Process Score",
                icon: "activity" as FeatherName,
                value: health.factors.issueCount === 0 && !health.factors.stallDetected && !health.factors.pitDrift
                  ? "Clean cook"
                  : [
                      health.factors.issueCount > 0 ? `${health.factors.issueCount} issue(s)` : null,
                      health.factors.stallDetected ? "stall detected" : null,
                      health.factors.pitDrift ? "pit drift" : null,
                    ].filter(Boolean).join(", "),
                ok: health.factors.issueCount === 0 && !health.factors.stallDetected && !health.factors.pitDrift,
                note: "25% of health score",
              },
              {
                label: "Plan Adherence",
                icon: "target" as FeatherName,
                value: health.factors.planAccuracyScore != null ? `${health.factors.planAccuracyScore}% on target` : "No plan data",
                ok: health.factors.planAccuracyScore != null && health.factors.planAccuracyScore >= 70,
                note: "15% of health score",
              },
              {
                label: "Temperature Tracking",
                icon: "thermometer" as FeatherName,
                value: health.factors.tempTracking ?? "No data yet",
                ok: !health.factors.pitDrift,
                note: null,
              },
              {
                label: "Step Timing",
                icon: "clock" as FeatherName,
                value: health.factors.stepTiming ?? "No data yet",
                ok: health.factors.stepTiming === "On time" || !health.factors.stepTiming,
                note: null,
              },
            ] satisfies Array<{ label: string; icon: FeatherName; value: string; ok: boolean; note: string | null }>
          ).map((f) => (
            <View
              key={f.label}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: 1,
                borderBottomColor: colors.border as string,
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: (f.ok ? "#22c55e" : "#EF4444") + "18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name={f.icon} size={16} color={f.ok ? "#22c55e" : "#EF4444"} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground as string }}>
                    {f.label}
                  </Text>
                  {f.note && (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 10, color: colors.mutedForeground as string }}>
                      {f.note}
                    </Text>
                  )}
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground as string, marginTop: 2 }}>
                  {f.value}
                </Text>
              </View>
              <Feather name={f.ok ? "check-circle" : "x-circle"} size={18} color={f.ok ? "#22c55e" : "#EF4444"} />
            </View>
          ))}

          <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, marginTop: 16, textAlign: "center" }}>
            Score computed at {new Date(health.computedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </Text>
          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  if (compact) {
    return (
      <>
        <Pressable
          onPress={() => setBreakdownVisible(true)}
          style={({ pressed }) => ({
            backgroundColor: colors.card as string,
            borderRadius: colors.radius as number,
            borderWidth: 1,
            borderColor: colors.border as string,
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 14,
            paddingVertical: 11,
            gap: 12,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              backgroundColor: cfg.bgColor,
              borderWidth: 1.5,
              borderColor: cfg.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: cfg.color }}>{resolvedGrade}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground as string }}>
              Cook Health · <Text style={{ color: cfg.color }}>{cfg.label}</Text>
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string, marginTop: 2, lineHeight: 15 }} numberOfLines={1}>
              {displayReason}
            </Text>
          </View>
          <Feather name="info" size={15} color={colors.mutedForeground as string} />
        </Pressable>
        {breakdownModal}
      </>
    );
  }

  return (
    <>
      <Pressable
        onPress={() => setBreakdownVisible(true)}
        style={({ pressed }) => ({
          backgroundColor: colors.card as string,
          borderRadius: colors.radius as number,
          borderWidth: 1,
          borderColor: cfg.color + "55",
          overflow: "hidden",
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 14 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: cfg.bgColor,
              borderWidth: 2,
              borderColor: cfg.color,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 26, color: cfg.color }}>{resolvedGrade}</Text>
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground as string }}>
                Cook Health
              </Text>
              <View style={{ paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10, backgroundColor: cfg.bgColor }}>
                <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 11, color: cfg.color }}>{cfg.label}</Text>
              </View>
            </View>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: resolvedGrade === "F" ? "#EF4444" : colors.mutedForeground as string, marginTop: 3, lineHeight: 17 }}>
              {displayReason}
            </Text>
            <View style={{ height: 5, borderRadius: 3, backgroundColor: colors.border as string, marginTop: 8, overflow: "hidden" }}>
              <View style={{ width: `${score * 100}%` as DimensionValue, height: 5, borderRadius: 3, backgroundColor: cfg.color }} />
            </View>
          </View>

          <Feather name="info" size={16} color={colors.mutedForeground as string} />
        </View>

        {checkinCount === 0 && cookStatus === "active" && (
          <View style={{ paddingHorizontal: 14, paddingBottom: lastDecision ? 0 : 10 }}>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
              Score refines after your first check-in
            </Text>
          </View>
        )}

        {lastDecision && cookStatus === "active" && (() => {
          const color = lastDecision.action === "maintain"
            ? "#22c55e"
            : (URGENCY_COLORS[lastDecision.urgency] ?? "#6C3BF5");
          const urgencyLabel = lastDecision.action === "maintain"
            ? "HOLD STEADY"
            : lastDecision.urgency === "now"
            ? "ACTION NEEDED"
            : lastDecision.urgency === "soon"
            ? "DO THIS SOON"
            : "WHEN READY";
          return (
            <View style={{
              marginHorizontal: 12,
              marginBottom: 12,
              marginTop: checkinCount === 0 ? 6 : 0,
              padding: 10,
              borderRadius: 8,
              backgroundColor: color + "12",
              borderWidth: 1,
              borderColor: color + "40",
              gap: 5,
            }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 7 }}>
                <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5, backgroundColor: color }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 10, color: "#fff", letterSpacing: 0.5 }}>
                    {urgencyLabel}
                  </Text>
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground as string }}>
                  Last PitMaster guidance
                </Text>
              </View>
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground as string, lineHeight: 18 }}>
                {lastDecision.instruction}
              </Text>
            </View>
          );
        })()}
      </Pressable>

      {breakdownModal}
    </>
  );
}
