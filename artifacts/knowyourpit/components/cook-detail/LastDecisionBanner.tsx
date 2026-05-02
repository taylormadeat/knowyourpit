import React from "react";
import { View, Text } from "react-native";
import { s } from "./styles";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
}

const URGENCY_COLORS: Record<string, string> = {
  now: "#EF4444",
  soon: "#F59E0B",
  when_ready: "#6C3BF5",
};

export function LastDecisionBanner({ c, colors }: Props) {
  if (c.status !== "active") return null;
  const stored = c.analysisResult as any;
  const decisions: any[] = stored?.decisions ?? [];
  if (decisions.length === 0) return null;
  const top = decisions[0];
  const color = top.action === "maintain" ? "#22c55e" : (URGENCY_COLORS[top.urgency] ?? "#6C3BF5");
  const urgencyLabel = top.action === "maintain"
    ? "HOLD STEADY"
    : (top.urgency === "now" ? "ACTION NEEDED" : top.urgency === "soon" ? "DO THIS SOON" : "WHEN READY");

  return (
    <View style={[s.persistentDecisionBanner, { backgroundColor: color + "12", borderColor: color + "45" }]}>
      <View style={s.persistentDecisionHeader}>
        <View style={[s.persistentUrgencyBadge, { backgroundColor: color }]}>
          <Text style={s.persistentUrgencyText}>{urgencyLabel}</Text>
        </View>
        <Text style={[s.persistentDecisionLabel, { color: colors.mutedForeground }]}>
          Last PitMaster guidance
        </Text>
      </View>
      <Text style={[s.persistentDecisionInstruction, { color: colors.foreground }]}>
        {top.instruction}
      </Text>
      {top.rationale ? (
        <Text style={[s.persistentDecisionRationale, { color: colors.mutedForeground }]}>
          {top.rationale}
        </Text>
      ) : null}
    </View>
  );
}
