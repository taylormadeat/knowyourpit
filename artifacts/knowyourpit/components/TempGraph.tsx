import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop } from "react-native-svg";
import { useColors } from "@/hooks/useColors";

export type ProbeTimeSeries = {
  probeName: string;
  timeSeries: Array<{ timeMinutes: number; tempF: number }>;
  finishingTempF: number;
};

export type GraphEvent = {
  type: string;
  timeMinutes: number;
  description: string;
};

type Props = {
  probes: ProbeTimeSeries[];
  events?: GraphEvent[];
  targetTempF?: number | null;
  width?: number;
  height?: number;
};

const PROBE_COLORS = ["#E84820", "#64748B", "#A855F7", "#22c55e", "#eab308"];

const PAD = { top: 14, right: 20, bottom: 36, left: 44 };

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpx = (prev.x + curr.x) / 2;
    d += ` C ${cpx} ${prev.y} ${cpx} ${curr.y} ${curr.x} ${curr.y}`;
  }
  return d;
}

/** Pick a readable whole-minute interval that fits within the chart width */
function pickTickInterval(rangeMinutes: number, chartWidth: number): number {
  const MIN_TICK_PX = 52;
  const maxTicks = Math.max(2, Math.floor(chartWidth / MIN_TICK_PX));
  const INTERVALS = [5, 10, 15, 20, 30, 60, 90, 120, 180, 240, 360, 480, 720];
  for (const iv of INTERVALS) {
    if (rangeMinutes / iv + 1 <= maxTicks) return iv;
  }
  return INTERVALS[INTERVALS.length - 1];
}

function fmtTick(totalMinutesRaw: number): string {
  const totalMins = Math.round(totalMinutesRaw);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h${mins}m`;
}

export function TempGraph({ probes, events = [], targetTempF, width = 320, height = 200 }: Props) {
  const colors = useColors();

  const chartW = width - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const allPoints = probes.flatMap((p) => p.timeSeries);
  if (allPoints.length === 0) {
    return (
      <View style={[s.empty, { height, borderColor: colors.border }]}>
        <Text style={[s.emptyText, { color: colors.mutedForeground }]}>No temperature data</Text>
      </View>
    );
  }

  const allTimes = allPoints.map((p) => p.timeMinutes);
  const allTemps = allPoints.map((p) => p.tempF);
  if (targetTempF) allTemps.push(targetTempF);

  const minTime = Math.min(...allTimes);
  const maxTime = Math.max(...allTimes);
  const minTemp = Math.floor(Math.min(...allTemps) / 25) * 25 - 10;
  const maxTemp = Math.ceil(Math.max(...allTemps) / 25) * 25 + 10;

  const rangeTime = maxTime - minTime || 1;
  const rangeTemp = maxTemp - minTemp || 1;

  const toX = (t: number) => PAD.left + ((t - minTime) / rangeTime) * chartW;
  const toY = (f: number) => PAD.top + ((maxTemp - f) / rangeTemp) * chartH;

  // Smart X-axis ticks — round-minute boundaries, evenly spaced, never crowded
  const tickInterval = pickTickInterval(rangeTime, chartW);
  const firstTick = Math.ceil(minTime / tickInterval) * tickInterval;
  const xTicks: number[] = [];
  if (minTime < firstTick - tickInterval * 0.1) xTicks.push(minTime);
  for (let t = firstTick; t <= maxTime + 0.5; t += tickInterval) {
    xTicks.push(t);
  }

  const yGridLines = 5;

  return (
    <View>
      <Svg width={width} height={height}>
        <Defs>
          {probes.map((_, i) => (
            <LinearGradient key={i} id={`probeFill${i}`} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={PROBE_COLORS[i % PROBE_COLORS.length]} stopOpacity="0.18" />
              <Stop offset="1" stopColor={PROBE_COLORS[i % PROBE_COLORS.length]} stopOpacity="0" />
            </LinearGradient>
          ))}
        </Defs>

        {/* Y grid lines + labels */}
        {Array.from({ length: yGridLines + 1 }, (_, i) => {
          const f = minTemp + (rangeTemp * i) / yGridLines;
          const y = toY(f);
          return (
            <React.Fragment key={i}>
              <Line x1={PAD.left} y1={y} x2={PAD.left + chartW} y2={y}
                stroke={colors.border} strokeWidth="1" strokeOpacity="0.6" strokeDasharray="4 3" />
              <SvgText x={PAD.left - 6} y={y + 4} fontSize="9" fill={colors.mutedForeground}
                textAnchor="end" fontFamily="Inter_400Regular">
                {Math.round(f)}°
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* X axis ticks + labels — clean integer minutes, no overlap */}
        {xTicks.map((t, i) => {
          const x = toX(t);
          return (
            <React.Fragment key={i}>
              <Line x1={x} y1={PAD.top + chartH} x2={x} y2={PAD.top + chartH + 4}
                stroke={colors.border} strokeWidth="1" />
              <SvgText x={x} y={height - 4} fontSize="9" fill={colors.mutedForeground}
                textAnchor="middle" fontFamily="Inter_400Regular">
                {fmtTick(t - minTime)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Target temp line */}
        {targetTempF != null && targetTempF >= minTemp && targetTempF <= maxTemp && (
          <>
            <Line
              x1={PAD.left} y1={toY(targetTempF)}
              x2={PAD.left + chartW} y2={toY(targetTempF)}
              stroke="#22c55e" strokeWidth="1.5" strokeDasharray="6 4" strokeOpacity="0.8"
            />
            <SvgText x={PAD.left + chartW - 2} y={toY(targetTempF) - 4}
              fontSize="9" fill="#22c55e" textAnchor="end" fontFamily="Inter_600SemiBold">
              target {targetTempF}°
            </SvgText>
          </>
        )}

        {/* Probe lines */}
        {probes.map((probe, pi) => {
          const color = PROBE_COLORS[pi % PROBE_COLORS.length];
          const pts = probe.timeSeries
            .filter((p) => p.timeMinutes != null && p.tempF != null)
            .sort((a, b) => a.timeMinutes - b.timeMinutes)
            .map((p) => ({ x: toX(p.timeMinutes), y: toY(p.tempF) }));
          if (pts.length < 2) return null;

          const closedFill =
            `${smoothPath(pts)} L ${pts[pts.length - 1].x} ${toY(minTemp)} L ${pts[0].x} ${toY(minTemp)} Z`;

          return (
            <React.Fragment key={pi}>
              <Path d={closedFill} fill={`url(#probeFill${pi})`} />
              <Path d={smoothPath(pts)} stroke={color} strokeWidth="2.2" fill="none"
                strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={4} fill={color} />
              <Circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r={7} fill={color} fillOpacity="0.2" />
            </React.Fragment>
          );
        })}

        {/* Event markers */}
        {events.map((ev, i) => {
          if (ev.timeMinutes < minTime || ev.timeMinutes > maxTime) return null;
          const x = toX(ev.timeMinutes);
          return (
            <React.Fragment key={i}>
              <Line x1={x} y1={PAD.top} x2={x} y2={PAD.top + chartH}
                stroke="#eab308" strokeWidth="1" strokeDasharray="3 3" strokeOpacity="0.7" />
              <Circle cx={x} cy={PAD.top} r={3} fill="#eab308" />
            </React.Fragment>
          );
        })}

        {/* Y axis line */}
        <Line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + chartH}
          stroke={colors.border} strokeWidth="1" />

        {/* X axis line */}
        <Line x1={PAD.left} y1={PAD.top + chartH} x2={PAD.left + chartW} y2={PAD.top + chartH}
          stroke={colors.border} strokeWidth="1" />
      </Svg>

      {/* Legend */}
      {probes.length > 0 && (
        <View style={s.legend}>
          {probes.map((probe, pi) => (
            <View key={pi} style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: PROBE_COLORS[pi % PROBE_COLORS.length] }]} />
              <Text style={[s.legendText, { color: colors.mutedForeground }]}>
                {probe.probeName} ({probe.finishingTempF}°F)
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  empty: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderRadius: 8, borderStyle: "dashed" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 44, paddingTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
