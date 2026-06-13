import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { s } from "./styles";
import { computePlanGrade } from "./utils";
import { computeOverallGrade, gradeChipColors, letterGrade, VERDICT_SCORE } from "@/utils/gradeUtils";

type Colors = any;

const HEALTH_GRADE_SCORE: Record<string, number> = {
  "A+": 98, A: 95, "A-": 91,
  "B+": 88, B: 82, "B-": 81,
  "C+": 78, C: 73, "C-": 71,
  "D+": 68, D: 64, "D-": 61,
  F: 20,
};

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  healthGrade?: string | null;
  rating?: number | null;
  onOpenHealthBreakdown?: () => void;
}

export function CookSummaryCard(p: Props) {
  const { c, colors, cookStatus, healthGrade, rating, onOpenHealthBreakdown } = p;
  const [gradeSheetVisible, setGradeSheetVisible] = useState(false);

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

  const hasSecondaryRows = !!(planGrade || sizeText);

  const healthScore =
    healthGrade != null
      ? (HEALTH_GRADE_SCORE[healthGrade] ?? HEALTH_GRADE_SCORE[healthGrade.charAt(0).toUpperCase()] ?? null)
      : null;
  const ratingScore =
    rating != null && rating > 0
      ? Math.min(100, Math.max(0, Math.round(rating * 20)))
      : null;

  const bothPresent = healthScore !== null && ratingScore !== null;

  const scoreSummary: string | null = (() => {
    const parts: string[] = [];
    if (healthGrade != null) parts.push(`Cook Health: ${healthGrade}`);
    if (rating != null && rating > 0)
      parts.push(`You rated ${rating % 1 === 0 ? rating : rating.toFixed(1)}★`);
    return parts.length > 0 ? parts.join(" · ") : null;
  })();
  const blended = bothPresent
    ? Math.round(0.5 * healthScore + 0.5 * ratingScore!)
    : healthScore ?? ratingScore ?? 0;

  const gradeSheet = overallGrade && overallColors ? (
    <Modal
      visible={gradeSheetVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setGradeSheetVisible(false)}
    >
      <Pressable
        style={{ flex: 1, backgroundColor: "#00000060" }}
        onPress={() => setGradeSheetVisible(false)}
      />
      <View
        style={{
          backgroundColor: colors.card,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          borderWidth: 1,
          borderColor: colors.border,
          maxHeight: "80%",
        }}
      >
        <LinearGradient
          colors={["#1C1C1F", "#2D1A0E"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 16,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={{ fontFamily: "Inter_700Bold", fontSize: 17, color: "#F3EDE1" }}>
            Overall Grade Breakdown
          </Text>
          <Pressable onPress={() => setGradeSheetVisible(false)} hitSlop={8}>
            <Feather name="x" size={22} color="#F3EDE1" />
          </Pressable>
        </LinearGradient>

        <ScrollView style={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          <View style={{ alignItems: "center", marginBottom: 24 }}>
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 20,
                backgroundColor: overallColors.bgColor,
                borderWidth: 3,
                borderColor: overallColors.color,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 10,
              }}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 44, color: overallColors.color }}>
                {overallGrade}
              </Text>
            </View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>
              Overall Grade
            </Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, marginTop: 4, textAlign: "center" }}>
              Blended score from cook health and your star rating
            </Text>
          </View>

          <View
            style={{
              backgroundColor: colors.muted ?? colors.border + "40",
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
              gap: 14,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#6C3BF518",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="activity" size={16} color="#6C3BF5" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>
                    Cook Health
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}> · 50%</Text>
                  </Text>
                  {healthGrade != null ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: gradeChipColors(healthGrade).color }}>
                        {healthGrade}
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                        → {healthScore}pts
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                      Not available
                    </Text>
                  )}
                </View>
                {healthScore !== null && (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 6, overflow: "hidden" }}>
                    <View style={{ width: `${healthScore}%` as any, height: 4, borderRadius: 2, backgroundColor: "#6C3BF5" }} />
                  </View>
                )}
              </View>
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: "#F59E0B18",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Feather name="star" size={16} color="#F59E0B" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "space-between" }}>
                  <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground }}>
                    Your Rating
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}> · 50%</Text>
                  </Text>
                  {rating != null && rating > 0 ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ fontFamily: "Inter_700Bold", fontSize: 13, color: "#F59E0B" }}>
                        {rating % 1 === 0 ? rating : rating.toFixed(1)}★
                      </Text>
                      <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                        → {ratingScore}pts
                      </Text>
                    </View>
                  ) : (
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground }}>
                      Not rated yet
                    </Text>
                  )}
                </View>
                {ratingScore !== null && (
                  <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.border, marginTop: 6, overflow: "hidden" }}>
                    <View style={{ width: `${ratingScore}%` as any, height: 4, borderRadius: 2, backgroundColor: "#F59E0B" }} />
                  </View>
                )}
              </View>
            </View>
          </View>

          <View
            style={{
              backgroundColor: overallColors.bgColor,
              borderRadius: 12,
              borderWidth: 1.5,
              borderColor: overallColors.color + "50",
              padding: 14,
              marginBottom: 20,
            }}
          >
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground, marginBottom: 6 }}>
              How the grade is calculated
            </Text>
            {bothPresent ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                {"(Cook Health × 50%) + (Your Rating × 50%)"}
                {"\n"}= ({healthScore}pts × 50%) + ({ratingScore}pts × 50%)
                {"\n"}= {blended}pts → <Text style={{ fontFamily: "Inter_700Bold", color: overallColors.color }}>{overallGrade}</Text>
              </Text>
            ) : healthScore !== null ? (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                No star rating yet — grade is based on Cook Health alone.
                {"\n"}Cook Health: {healthScore}pts → <Text style={{ fontFamily: "Inter_700Bold", color: overallColors.color }}>{overallGrade}</Text>
              </Text>
            ) : (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground, lineHeight: 19 }}>
                No health data yet — grade is based on your star rating alone.
                {"\n"}Your Rating: {ratingScore}pts → <Text style={{ fontFamily: "Inter_700Bold", color: overallColors.color }}>{overallGrade}</Text>
              </Text>
            )}
          </View>

          {onOpenHealthBreakdown && (
            <Pressable
              onPress={() => {
                setGradeSheetVisible(false);
                setTimeout(() => onOpenHealthBreakdown(), 300);
              }}
              style={({ pressed }) => ({
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                paddingVertical: 14,
                borderRadius: 10,
                backgroundColor: "#6C3BF518",
                borderWidth: 1,
                borderColor: "#6C3BF540",
                opacity: pressed ? 0.75 : 1,
                marginBottom: 8,
              })}
            >
              <Feather name="activity" size={15} color="#6C3BF5" />
              <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: "#6C3BF5" }}>
                See Cook Health breakdown
              </Text>
              <Feather name="arrow-right" size={14} color="#6C3BF5" />
            </Pressable>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      </View>
    </Modal>
  ) : null;

  if (cookStatus === "completed" && overallGrade && overallColors) {
    return (
      <>
        <Pressable
          onPress={() => setGradeSheetVisible(true)}
          style={({ pressed }) => [
            s.card,
            {
              backgroundColor: colors.card,
              borderColor: overallColors.color + "55",
              borderRadius: colors.radius,
              overflow: "hidden",
              borderWidth: 1.5,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View style={{ backgroundColor: overallColors.bgColor, padding: 20, alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                backgroundColor: overallColors.color + "22",
                borderWidth: 2.5,
                borderColor: overallColors.color,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ fontFamily: "Inter_700Bold", fontSize: 40, color: overallColors.color, lineHeight: 48 }}>
                {overallGrade}
              </Text>
            </View>
            <Text style={{ fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground }}>Overall Grade</Text>
            <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.mutedForeground }}>
              Process health · your rating
            </Text>
            {scoreSummary != null && (
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, opacity: 0.75 }}>
                {scoreSummary}
              </Text>
            )}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
              <Feather name="info" size={12} color={colors.mutedForeground} />
              <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground }}>
                Tap to see breakdown
              </Text>
            </View>
          </View>

          {hasSecondaryRows && (
            <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
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
          )}
        </Pressable>
        {gradeSheet}
      </>
    );
  }

  return (
    <>
      <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
        {overallGrade && overallColors ? (
          <Pressable
            onPress={() => setGradeSheetVisible(true)}
            style={({ pressed }) => [
              s.inlineGradeRow,
              {
                borderBottomColor: hasSecondaryRows ? colors.border : "transparent",
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={[s.inlineGradeBadge, { backgroundColor: overallColors.bgColor, borderColor: overallColors.color + "40" }]}>
              <Text style={[s.inlineGradeLetter, { color: overallColors.color }]}>{overallGrade}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.inlineGradeTitle, { color: colors.foreground }]}>Overall Grade</Text>
              <Text style={[s.inlineGradeSub, { color: colors.mutedForeground }]}>Process health · your rating</Text>
              {scoreSummary != null && (
                <Text style={[s.inlineGradeSub, { color: colors.mutedForeground, opacity: 0.75 }]}>
                  {scoreSummary}
                </Text>
              )}
            </View>
            <Feather name="info" size={14} color={colors.mutedForeground} />
          </Pressable>
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
      {gradeSheet}
    </>
  );
}
