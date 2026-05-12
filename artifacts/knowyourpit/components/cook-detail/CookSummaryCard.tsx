import React, { useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { fmtDuration, formatDT, computePlanGrade } from "./utils";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  planSheetVisible?: boolean;
  setPlanSheetVisible?: (v: boolean) => void;
}

export function CookSummaryCard(p: Props) {
  const { c, colors, cookStatus, nowMs, planSheetVisible: externalVisible, setPlanSheetVisible: setExternalVisible } = p;
  const insets = useSafeAreaInsets();
  const [internalVisible, setInternalVisible] = useState(false);
  const planSheetVisible = externalVisible !== undefined ? externalVisible : internalVisible;
  const setPlanSheetVisible = setExternalVisible ?? setInternalVisible;

  const wrapStr = (() => {
    const parts: string[] = [];
    if (c.wrapMethod === "foil") parts.push("Foil (Texas Crutch)");
    else if (c.wrapMethod === "butcher_paper") parts.push("Butcher Paper");
    else if (c.wrapMethod === "none") parts.push("No wrap");
    if (c.wrapAtMinutes) parts.push(`at ${Math.floor(c.wrapAtMinutes / 60)}h ${c.wrapAtMinutes % 60}m`);
    if (c.wrapTempF) parts.push(`${c.wrapTempF}°F internal`);
    return parts.length ? parts.join(" · ") : null;
  })();
  const plannedDurMs = c.plannedStartAt && c.plannedEndAt
    ? new Date(c.plannedEndAt).getTime() - new Date(c.plannedStartAt).getTime()
    : null;
  const actualDurMs = c.actualStartAt && c.actualEndAt
    ? new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()
    : c.actualStartAt && cookStatus === "active" ? nowMs - new Date(c.actualStartAt).getTime() : null;
  const planGrade = cookStatus === "completed" ? computePlanGrade(c) : null;

  const planDetailRows = [
    { label: "Food", value: c.foodType },
    { label: "Grill", value: (c as any).grillName },
    { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
    { label: "Internal Target", value: c.targetTempF ? `${c.targetTempF}°F` : null },
    { label: "Pit Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
    { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
    { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
    { label: "Planned Duration", value: plannedDurMs ? fmtDuration(plannedDurMs) : null },
    { label: "Preheat", value: c.preheatMinutes ? fmtMinutes(c.preheatMinutes) : null },
    { label: "Wrap", value: wrapStr },
    { label: "Rest", value: c.restMinutes ? fmtMinutes(c.restMinutes) : null },
  ].filter((r) => r.value);

  const planFullWidthRows = [
    { label: "Wrap Notes", value: c.wrapReason ?? null },
    { label: "Notes", value: c.notes ?? null },
  ].filter((r) => r.value);

  const actualDetailRows = (cookStatus === "active" || cookStatus === "completed") ? [
    { label: "Started", value: c.actualStartAt ? formatDT(c.actualStartAt) : null },
    { label: "Finished", value: c.actualEndAt ? formatDT(c.actualEndAt) : null },
    { label: "Actual Duration", value: actualDurMs ? fmtDuration(actualDurMs) : null },
  ].filter((r) => r.value) : [];

  const planModal = (
    <Modal
      visible={planSheetVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setPlanSheetVisible(false)}
    >
      <View style={s.planSheetOverlay}>
        <Pressable style={{ flex: 1 }} onPress={() => setPlanSheetVisible(false)} />
        <View style={[s.planSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={[s.planSheetHandle, { backgroundColor: colors.border }]} />
          <View style={[s.planSheetHeader, { borderBottomColor: colors.border }]}>
            <View style={[s.sectionIconWrap, { backgroundColor: "#3b82f618" }]}>
              <Feather name="clipboard" size={13} color="#3b82f6" />
            </View>
            <Text style={[s.planSheetTitle, { color: colors.foreground }]}>The Plan</Text>
            <Pressable onPress={() => setPlanSheetVisible(false)} style={s.planSheetClose} hitSlop={10}>
              <Feather name="x" size={18} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={s.planGrid}>
              {planDetailRows.map((row, i) => {
                const isLast = i === planDetailRows.length - 1;
                const isOdd = planDetailRows.length % 2 !== 0;
                const isLastSolo = isOdd && isLast;

                if (isLastSolo) {
                  return (
                    <View
                      key={row.label}
                      style={[
                        s.planGridCellFull,
                        { borderTopColor: colors.border, borderBottomColor: colors.border },
                      ]}
                    >
                      <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                      <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{row.value}</Text>
                    </View>
                  );
                }

                if (i % 2 === 1) return null;

                const nextRow = planDetailRows[i + 1];
                return (
                  <View key={row.label} style={[s.planGridRow, { borderTopColor: colors.border }]}>
                    <View style={[s.planGridCell, { borderRightColor: colors.border }]}>
                      <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                      <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{row.value}</Text>
                    </View>
                    {nextRow ? (
                      <View style={s.planGridCell}>
                        <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{nextRow.label}</Text>
                        <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{nextRow.value}</Text>
                      </View>
                    ) : (
                      <View style={s.planGridCell} />
                    )}
                  </View>
                );
              })}

              {planFullWidthRows.map((row) => (
                <View
                  key={row.label}
                  style={[s.planGridCellFull, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
                >
                  <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[s.notesText, { color: colors.foreground, marginTop: 4 }]}>{row.value}</Text>
                </View>
              ))}
            </View>

            {actualDetailRows.length > 0 && (
              <>
                <View style={[s.sectionHeaderRow, { borderBottomColor: colors.border, borderTopWidth: 1, borderTopColor: colors.border, marginTop: 8 }]}>
                  <View style={[s.sectionIconWrap, { backgroundColor: "#22c55e18" }]}>
                    <Feather name="bar-chart-2" size={13} color="#22c55e" />
                  </View>
                  <Text style={[s.sectionHeaderLabel, { color: "#22c55e" }]}>How It Went</Text>
                </View>

                <View style={s.planGrid}>
                  {actualDetailRows.length >= 2 ? (
                    <>
                      {(() => {
                        const rows = actualDetailRows;
                        const pairs: React.JSX.Element[] = [];
                        for (let i = 0; i < rows.length; i += 2) {
                          const left = rows[i];
                          const right = rows[i + 1];
                          if (!right) {
                            pairs.push(
                              <View
                                key={left.label}
                                style={[s.planGridCellFull, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
                              >
                                <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{left.label}</Text>
                                <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{left.value}</Text>
                              </View>
                            );
                          } else {
                            pairs.push(
                              <View key={left.label} style={[s.planGridRow, { borderTopColor: colors.border }]}>
                                <View style={[s.planGridCell, { borderRightColor: colors.border }]}>
                                  <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{left.label}</Text>
                                  <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{left.value}</Text>
                                </View>
                                <View style={s.planGridCell}>
                                  <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{right.label}</Text>
                                  <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{right.value}</Text>
                                </View>
                              </View>
                            );
                          }
                        }
                        return pairs;
                      })()}
                    </>
                  ) : (
                    <View
                      style={[s.planGridCellFull, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
                    >
                      <Text style={[s.planGridCellLabel, { color: colors.mutedForeground }]}>{actualDetailRows[0].label}</Text>
                      <Text style={[s.planGridCellValue, { color: colors.foreground }]}>{actualDetailRows[0].value}</Text>
                    </View>
                  )}
                </View>
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  if (cookStatus === "active") {
    return planModal;
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
      {planGrade && (
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
      )}

      <Pressable
        onPress={() => setPlanSheetVisible(true)}
        style={[s.detailsToggle, { borderTopColor: colors.border }]}
      >
        <Text style={[s.detailsToggleText, { color: colors.primary }]}>View full details</Text>
        <Feather name="chevron-down" size={14} color={colors.primary} />
      </Pressable>

      {planModal}
    </View>
  );
}
