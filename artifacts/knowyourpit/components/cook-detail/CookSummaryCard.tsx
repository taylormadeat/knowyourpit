import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";
import { fmtMinutes } from "@/utils/duration";
import { fmtDuration, formatDT, computePlanGrade } from "./utils";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  cookStatus: string | undefined;
  nowMs: number;
  showCookDetails: boolean;
  setShowCookDetails: (updater: (v: boolean) => boolean) => void;
}

export function CookSummaryCard(p: Props) {
  const { c, colors, cookStatus, nowMs, showCookDetails, setShowCookDetails } = p;

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

  const statTiles: { icon: string; label: string; value: string; sub?: string }[] = [];
  if (c.targetTempF) statTiles.push({ icon: "thermometer", label: "Target", value: `${c.targetTempF}°F` });
  if (c.cookTempF) statTiles.push({ icon: "wind", label: "Pit Temp", value: `${c.cookTempF}°F` });
  if (plannedDurMs) statTiles.push({ icon: "clock", label: "Planned", value: fmtDuration(plannedDurMs) });
  if (actualDurMs) statTiles.push({
    icon: cookStatus === "active" ? "loader" : "check-circle",
    label: cookStatus === "active" ? "Elapsed" : "Actual",
    value: fmtDuration(actualDurMs),
  });
  if (!statTiles.length && c.weightLbs) statTiles.push({ icon: "package", label: "Weight", value: `${c.weightLbs} lbs` });

  const planDetailRows = [
    { label: "Food", value: c.foodType },
    { label: "Grill", value: (c as any).grillName },
    { label: "Weight", value: c.weightLbs ? `${c.weightLbs} lbs` : null },
    { label: "Target Temp", value: c.targetTempF ? `${c.targetTempF}°F` : null },
    { label: "Pit Temp", value: c.cookTempF ? `${c.cookTempF}°F` : null },
    { label: "Planned Start", value: c.plannedStartAt ? new Date(c.plannedStartAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
    { label: "Serve By", value: c.plannedEndAt ? new Date(c.plannedEndAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : null },
    { label: "Planned Duration", value: plannedDurMs ? fmtDuration(plannedDurMs) : null },
    { label: "Preheat", value: c.preheatMinutes ? fmtMinutes(c.preheatMinutes) : null },
    { label: "Wrap", value: wrapStr },
    { label: "Wrap Notes", value: c.wrapReason ?? null },
    { label: "Rest", value: c.restMinutes ? fmtMinutes(c.restMinutes) : null },
  ].filter((r) => r.value);

  const actualDetailRows = (cookStatus === "active" || cookStatus === "completed") ? [
    { label: "Started", value: c.actualStartAt ? formatDT(c.actualStartAt) : null },
    { label: "Finished", value: c.actualEndAt ? formatDT(c.actualEndAt) : null },
    { label: "Actual Duration", value: actualDurMs ? fmtDuration(actualDurMs) : null },
  ].filter((r) => r.value) : [];

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, overflow: "hidden" }]}>
      {statTiles.length > 0 && (
        <View style={[s.statTileRow, { borderBottomColor: colors.border }]}>
          {statTiles.map((tile, i) => (
            <View
              key={tile.label}
              style={[
                s.statTile,
                i < statTiles.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border },
              ]}
            >
              <Feather name={tile.icon as any} size={14} color={colors.mutedForeground} style={{ marginBottom: 4 }} />
              <Text style={[s.statTileValue, { color: colors.foreground }]}>{tile.value}</Text>
              <Text style={[s.statTileLabel, { color: colors.mutedForeground }]}>{tile.label}</Text>
            </View>
          ))}
        </View>
      )}

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

      {showCookDetails && (
        <>
          {planDetailRows.length > 0 && (
            <>
              <View style={[s.sectionHeaderRow, { borderBottomColor: colors.border, borderTopWidth: planGrade || statTiles.length ? 0 : 0 }]}>
                <View style={[s.sectionIconWrap, { backgroundColor: "#3b82f618" }]}>
                  <Feather name="clipboard" size={13} color="#3b82f6" />
                </View>
                <Text style={[s.sectionHeaderLabel, { color: "#3b82f6" }]}>The Plan</Text>
              </View>
              {planDetailRows.map((row) => (
                <View key={row.label} style={[s.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
                </View>
              ))}
              {c.notes && (
                <View style={[s.row, { flexDirection: "column", alignItems: "flex-start", gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>Notes</Text>
                  <Text style={[s.notesText, { color: colors.foreground }]}>{c.notes}</Text>
                </View>
              )}
            </>
          )}
          {actualDetailRows.length > 0 && (
            <>
              <View style={[s.sectionHeaderRow, { borderBottomColor: colors.border }]}>
                <View style={[s.sectionIconWrap, { backgroundColor: "#22c55e18" }]}>
                  <Feather name="bar-chart-2" size={13} color="#22c55e" />
                </View>
                <Text style={[s.sectionHeaderLabel, { color: "#22c55e" }]}>How It Went</Text>
              </View>
              {actualDetailRows.map((row, i) => (
                <View key={row.label} style={[s.row, i < actualDetailRows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[s.rowLabel, { color: colors.mutedForeground }]}>{row.label}</Text>
                  <Text style={[s.rowValue, { color: colors.foreground }]}>{row.value}</Text>
                </View>
              ))}
            </>
          )}
        </>
      )}

      <Pressable
        onPress={() => setShowCookDetails((v) => !v)}
        style={[s.detailsToggle, { borderTopColor: colors.border }]}
      >
        <Text style={[s.detailsToggleText, { color: colors.primary }]}>
          {showCookDetails ? "Hide details" : "View full details"}
        </Text>
        <Feather name={showCookDetails ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
      </Pressable>
    </View>
  );
}
