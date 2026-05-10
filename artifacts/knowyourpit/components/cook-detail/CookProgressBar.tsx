import React from "react";
import { View, Text } from "react-native";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function fmtDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  if (totalMin < 60) return `${totalMin}m`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtRemaining(remainingMs: number, isOver: boolean, overMs: number): string {
  if (isOver) return `+${fmtDuration(overMs)} over`;
  return `~${fmtDuration(remainingMs)} remaining`;
}

function phaseLabel(progress: number, isOver: boolean): string {
  if (isOver) return "Over estimate";
  if (progress < 0.25) return "Early cook";
  if (progress < 0.5) return "Building heat";
  if (progress < 0.7) return "Deep in the cook";
  if (progress < 0.9) return "Final stretch";
  return "Almost done!";
}

function barColor(progress: number, isOver: boolean): string {
  if (isOver) return "#ef4444";
  if (progress >= 0.9) return "#22c55e";
  if (progress >= 0.6) return "#F59E0B";
  return "#FF6B2B";
}

interface Props {
  startMs: number;
  estimatedFinishMs: number | null;
  nowMs: number;
  colors: any;
}

export function CookProgressBar({ startMs, estimatedFinishMs, nowMs, colors }: Props) {
  if (!startMs) return null;

  if (estimatedFinishMs === null) {
    // Elapsed-aware indeterminate fill: grows from 0 → ~50% over 12 hours so
    // it tracks time without implying we know when the cook will end.
    const elapsedMs = Math.max(0, nowMs - startMs);
    const indeterminateFill = Math.min(elapsedMs / (12 * 3600 * 1000), 0.5);
    return (
      <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2 }}>
        <View
          style={{
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.border,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              width: `${indeterminateFill * 100}%`,
              height: "100%",
              borderRadius: 3,
              backgroundColor: "#FF6B2B60",
            }}
          />
        </View>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_400Regular",
            color: colors.mutedForeground,
            marginTop: 5,
          }}
        >
          Cook in progress · estimate pending
        </Text>
      </View>
    );
  }

  const totalMs = estimatedFinishMs - startMs;
  const elapsedMs = nowMs - startMs;
  const rawProgress = totalMs > 0 ? elapsedMs / totalMs : 0;
  const isOver = rawProgress >= 1;
  const progress = clamp(rawProgress, 0, 1);
  const accent = barColor(progress, isOver);
  const label = phaseLabel(progress, isOver);
  const overMs = isOver ? nowMs - estimatedFinishMs : 0;
  const remainingMs = isOver ? 0 : estimatedFinishMs - nowMs;
  const countdownLabel = fmtRemaining(remainingMs, isOver, overMs);

  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 2 }}>
      <View
        style={{
          height: 7,
          borderRadius: 4,
          backgroundColor: colors.border,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${progress * 100}%`,
            height: "100%",
            borderRadius: 4,
            backgroundColor: accent,
          }}
        />
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 5,
        }}
      >
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_500Medium",
            color: isOver ? accent : colors.mutedForeground,
          }}
        >
          {label}
        </Text>
        <Text
          style={{
            fontSize: 11,
            fontFamily: "Inter_700Bold",
            color: accent,
          }}
        >
          {Math.round(progress * 100)}%
        </Text>
      </View>
      <Text
        style={{
          fontSize: 11,
          fontFamily: "Inter_400Regular",
          color: isOver ? accent : colors.mutedForeground,
          marginTop: 2,
          textAlign: "right",
        }}
      >
        {countdownLabel}
      </Text>
    </View>
  );
}
