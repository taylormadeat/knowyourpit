import React from "react";
import { View, Text } from "react-native";
import { s } from "./styles";
import { computePlanGrade } from "./utils";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
}

export function CookSummaryCard(p: Props) {
  const { c, colors, cookStatus } = p;

  const planGrade = cookStatus === "completed" ? computePlanGrade(c) : null;

  if (cookStatus === "active") {
    return null;
  }

  if (!planGrade) return null;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
      <View style={[s.inlineGradeRow, { borderBottomColor: colors.border }]}>
        <View style={[s.inlineGradeBadge, { backgroundColor: planGrade.color + "18", borderColor: planGrade.color + "40" }]}>
          <Text style={[s.inlineGradeLetter, { color: planGrade.color }]}>{planGrade.grade}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.inlineGradeTitle, { color: colors.foreground }]}>Plan Accuracy · {planGrade.accuracy}%</Text>
          <Text style={[s.inlineGradeSub, { color: colors.mutedForeground }]}>{planGrade.deviation}</Text>
        </View>
        <View style={[s.gradeBarTrackSmall, { backgroundColor: colors.border, width: 52 }]}>
          <View style={[s.gradeBarFill, { width: `${planGrade.accuracy}%` as any, backgroundColor: planGrade.color }]} />
        </View>
      </View>
    </View>
  );
}
