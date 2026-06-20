import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface ScheduleItem {
  foodType?: string;
  grillLightAt?: string | null;
  meatOnAt?: string | null;
  estimatedFinishAt?: string | null;
  restMinutes?: number;
  wrapAtMinutes?: number | null;
  wrapMethod?: string | null;
}

interface Props {
  sequenceData: { schedule: ScheduleItem[] } | null | undefined;
  confirmedSteps: Record<string, string>;
  currentItemIdx: number;
  colors: any;
}

interface StepEntry {
  key: string;
  label: string;
  plannedMs: number | null;
  actualMs: number | null;
  color: string;
}

function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function deltaLabel(deltaMs: number): { text: string; color: string } {
  const absDelta = Math.abs(deltaMs);
  const mins = Math.round(absDelta / 60_000);
  if (mins < 2) return { text: "Right on time", color: "#22c55e" };
  const direction = deltaMs > 0 ? "late" : "early";
  const color = absDelta < 10 * 60_000 ? "#22c55e" : absDelta < 30 * 60_000 ? "#eab308" : "#ef4444";
  return { text: `${mins} min ${direction}`, color };
}

const STEP_COLORS: Record<string, string> = {
  grillLight: "#f59e0b",
  meatOn: "#EB6C2B",
  wrap: "#A855F7",
  pullOff: "#22c55e",
  serve: "#6366f1",
};

const STEP_LABELS: Record<string, string> = {
  grillLight: "Light grill",
  meatOn: "Meat on",
  wrap: "Wrap",
  pullOff: "Pull off",
  serve: "Ready to serve",
};

export function ActualVsPlannedRecap({ sequenceData, confirmedSteps, currentItemIdx, colors }: Props) {
  const [expanded, setExpanded] = useState(false);

  const item = sequenceData?.schedule?.[currentItemIdx];
  if (!item) return null;

  const steps: StepEntry[] = [];

  const grillLightActual = confirmedSteps[`${currentItemIdx}_grillLight`];
  if (item.grillLightAt) {
    steps.push({
      key: "grillLight",
      label: STEP_LABELS.grillLight,
      plannedMs: new Date(item.grillLightAt).getTime(),
      actualMs: grillLightActual ? new Date(grillLightActual).getTime() : null,
      color: STEP_COLORS.grillLight,
    });
  }

  const meatOnActual = confirmedSteps[`${currentItemIdx}_meatOn`];
  if (item.meatOnAt) {
    steps.push({
      key: "meatOn",
      label: STEP_LABELS.meatOn,
      plannedMs: new Date(item.meatOnAt).getTime(),
      actualMs: meatOnActual ? new Date(meatOnActual).getTime() : null,
      color: STEP_COLORS.meatOn,
    });
  }

  const wrapActual = confirmedSteps[`${currentItemIdx}_wrap`];
  if (item.wrapMethod && item.wrapMethod !== "none" && item.meatOnAt && (item.wrapAtMinutes ?? 0) > 0) {
    const plannedWrapMs = new Date(item.meatOnAt).getTime() + (item.wrapAtMinutes ?? 0) * 60_000;
    steps.push({
      key: "wrap",
      label: STEP_LABELS.wrap,
      plannedMs: plannedWrapMs,
      actualMs: wrapActual ? new Date(wrapActual).getTime() : null,
      color: STEP_COLORS.wrap,
    });
  }

  const pullOffActual = confirmedSteps[`${currentItemIdx}_pullOff`];
  if (item.estimatedFinishAt) {
    steps.push({
      key: "pullOff",
      label: STEP_LABELS.pullOff,
      plannedMs: new Date(item.estimatedFinishAt).getTime(),
      actualMs: pullOffActual ? new Date(pullOffActual).getTime() : null,
      color: STEP_COLORS.pullOff,
    });
  }

  const serveActual = confirmedSteps[`${currentItemIdx}_serve`];
  if ((item.restMinutes ?? 0) > 0 && item.estimatedFinishAt) {
    steps.push({
      key: "serve",
      label: STEP_LABELS.serve,
      plannedMs: new Date(item.estimatedFinishAt).getTime() + (item.restMinutes ?? 0) * 60_000,
      actualMs: serveActual ? new Date(serveActual).getTime() : null,
      color: STEP_COLORS.serve,
    });
  }

  const confirmedCount = steps.filter((s) => s.actualMs != null).length;
  if (confirmedCount === 0) return null;

  return (
    <View
      style={[
        r.card,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
      ]}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        style={[r.header, { borderBottomWidth: expanded ? 1 : 0, borderBottomColor: colors.border }]}
      >
        <LinearGradient colors={["#4f46e5", "#6C3BF5"]} style={r.icon}>
          <Feather name="clock" size={14} color="#fff" />
        </LinearGradient>
        <View style={{ flex: 1 }}>
          <Text style={[r.title, { color: colors.foreground }]}>Timeline Accuracy</Text>
          <Text style={[r.sub, { color: colors.mutedForeground }]}>
            {confirmedCount} of {steps.length} steps confirmed
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={colors.mutedForeground}
        />
      </Pressable>

      {expanded && (
        <View style={r.body}>
          {steps.map((step) => {
            const hasActual = step.actualMs != null;
            const delta =
              hasActual && step.plannedMs != null ? step.actualMs! - step.plannedMs! : null;
            const deltaInfo = delta != null ? deltaLabel(delta) : null;
            return (
              <View
                key={step.key}
                style={[r.row, { borderBottomColor: colors.border }]}
              >
                <View style={[r.dot, { backgroundColor: hasActual ? step.color : colors.border }]} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[r.stepLabel, { color: colors.foreground }]}>{step.label}</Text>
                  <View style={r.timeRow}>
                    <Text style={[r.timeText, { color: colors.mutedForeground }]}>
                      Planned:{" "}
                      <Text style={{ color: colors.foreground }}>
                        {step.plannedMs != null ? fmtTime(step.plannedMs) : "—"}
                      </Text>
                    </Text>
                    {hasActual && (
                      <Text style={[r.timeText, { color: colors.mutedForeground }]}>
                        Actual:{" "}
                        <Text style={{ color: colors.foreground }}>{fmtTime(step.actualMs!)}</Text>
                      </Text>
                    )}
                  </View>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {deltaInfo ? (
                    <Text style={[r.delta, { color: deltaInfo.color }]}>{deltaInfo.text}</Text>
                  ) : (
                    <Text style={[r.delta, { color: colors.mutedForeground }]}>Not yet</Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const r = StyleSheet.create({
  card: { borderWidth: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 14, fontFamily: "Inter_700Bold" },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 1 },
  body: { paddingHorizontal: 14, paddingBottom: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  stepLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  timeRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  timeText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  delta: { fontSize: 12, fontFamily: "Inter_700Bold" },
});
