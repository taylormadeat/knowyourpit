import React from "react";
import { View, Text } from "react-native";
import { s } from "./styles";
import { computePlanGrade } from "./utils";
import { computeOverallGrade, gradeChipColors } from "@/utils/gradeUtils";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  healthGrade?: string | null;
  rating?: number | null;
}

export function CookSummaryCard(p: Props) {
  const { c, colors, cookStatus, healthGrade, rating } = p;

  const planGrade = cookStatus === "completed" ? computePlanGrade(c) : null;
  const overallGrade =
    cookStatus === "completed"
      ? computeOverallGrade(healthGrade ?? null, rating ?? null)
      : null;

  if (cookStatus === "active") {
    return null;
  }

  if (!planGrade && !overallGrade) return null;

  const overallColors = overallGrade ? gradeChipColors(overallGrade) : null;

  const sizeText: string | null =
    (c.sizingLabel as string | null | undefined) ??
    (typeof c.weightLbs === "number" ? `${c.weightLbs} lbs` : null);

  const hasBorder = !!(planGrade || sizeText);

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
      {overallGrade && overallColors ? (
        <View style={[s.inlineGradeRow, { borderBottomColor: hasBorder ? colors.border : "transparent" }]}>
          <View style={[s.inlineGradeBadge, { backgroundColor: overallColors.bgColor, borderColor: overallColors.color + "40" }]}>
            <Text style={[s.inlineGradeLetter, { color: overallColors.color }]}>{overallGrade}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.inlineGradeTitle, { color: colors.foreground }]}>Overall Grade</Text>
            <Text style={[s.inlineGradeSub, { color: colors.mutedForeground }]}>Process health · your rating</Text>
          </View>
        </View>
      ) : null}

      {planGrade ? (
        <View style={[s.inlineGradeRow, { borderBottomColor: sizeText ? colors.border : "transparent" }]}>
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
      ) : null}

      {sizeText ? (
        <View style={{ paddingHorizontal: 14, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[s.inlineGradeSub, { color: colors.mutedForeground }]}>Size</Text>
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.foreground }}>{sizeText}</Text>
        </View>
      ) : null}
    </View>
  );
}
