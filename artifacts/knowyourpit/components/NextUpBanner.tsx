import React, { useMemo } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import type {
  NextStep,
  NextStepKey,
  SequenceData,
} from "@/components/cook-detail/types";

const STEP_LABELS: Record<NextStepKey, string> = {
  grillLight: "Light the Grill",
  meatOn: "Meat On",
  pullOff: "Pull Off",
  serve: "Serve",
};

export function getStepTargetMs(
  seqData: SequenceData | null | undefined,
  nextStep: NextStep | null | undefined,
): number | null {
  if (!seqData?.schedule || !nextStep) return null;
  const item = seqData.schedule[nextStep.itemIdx];
  if (!item) return null;
  switch (nextStep.step) {
    case "grillLight":
      return item.grillLightAt ? new Date(item.grillLightAt).getTime() : null;
    case "meatOn":
      return item.meatOnAt ? new Date(item.meatOnAt).getTime() : null;
    case "pullOff":
      return item.estimatedFinishAt
        ? new Date(item.estimatedFinishAt).getTime()
        : null;
    case "serve":
      return item.estimatedFinishAt
        ? new Date(item.estimatedFinishAt).getTime() +
            (item.restMinutes ?? 0) * 60000
        : null;
  }
}

export function formatNextUpCountdown(remainingMs: number): string {
  if (remainingMs <= 0) return "now";
  const totalSec = Math.floor(remainingMs / 1000);
  if (totalSec < 60) return `in ${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `in ${totalMin}m`;
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  return `in ${hours}h ${mins}m`;
}

interface NextUpBannerProps {
  nextStep: NextStep | null | undefined;
  cookSeqData: SequenceData | null | undefined;
  nowMs: number;
  onPress?: () => void;
}

export function NextUpBanner({
  nextStep,
  cookSeqData,
  nowMs,
  onPress,
}: NextUpBannerProps) {
  const targetMs = useMemo(
    () => getStepTargetMs(cookSeqData, nextStep ?? null),
    [cookSeqData, nextStep],
  );

  if (!nextStep || targetMs == null) return null;

  const stepLabel = STEP_LABELS[nextStep.step] ?? nextStep.step;
  const countdown = formatNextUpCountdown(targetMs - nowMs);

  const inner = (
    <View style={styles.banner}>
      <Feather name="clock" size={14} color="#fff" />
      <Text style={styles.label}>NEXT UP</Text>
      <Text style={styles.step} numberOfLines={1}>
        {stepLabel}
      </Text>
      <Text style={styles.countdown}>{countdown}</Text>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    backgroundColor: "#E84520",
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "rgba(255,255,255,0.78)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  step: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  countdown: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    opacity: 0.95,
  },
});
