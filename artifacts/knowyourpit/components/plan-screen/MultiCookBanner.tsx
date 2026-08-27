import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Cook } from "@workspace/api-client-react";
import type { SequenceData } from "@/components/cook-detail/types";
import { fmtRemaining } from "@/components/cook-detail/CookProgressBar";
import { fmtElapsedPlan } from "@/components/plan-screen/utils";

const BANNER_BG = "#FF6B2B";

/**
 * Per-cook elapsed / remaining derivation for the condensed multi-cook banner.
 * Mirrors the single-cook logic in plan.tsx so the two banners agree: elapsed
 * is anchored to meatOnAt (falling back to actualStartAt) so thaw/preheat time
 * isn't counted as "time on the smoker", and remaining prefers the sequence's
 * estimated finish over the planned end.
 */
function cookTimes(cook: Cook, nowMs: number) {
  const seq = (cook as { sequenceData?: SequenceData | null }).sequenceData ?? null;
  const meatOnAt = seq?.schedule?.[0]?.meatOnAt;
  const meatOnMs = meatOnAt ? new Date(meatOnAt as string).getTime() : null;
  const isMeatOn = meatOnMs == null || meatOnMs <= nowMs;

  let elapsedMs = 0;
  if (isMeatOn) {
    if (meatOnMs != null) elapsedMs = nowMs - meatOnMs;
    else if (cook.actualStartAt) elapsedMs = nowMs - new Date(cook.actualStartAt).getTime();
  }

  const rawFinish = seq?.schedule?.[0]?.estimatedFinishAt ?? cook.plannedEndAt ?? null;
  let remainingLabel: string | null = null;
  if (rawFinish) {
    const finishMs = new Date(rawFinish).getTime();
    const isOver = nowMs >= finishMs;
    remainingLabel = fmtRemaining(
      Math.max(0, finishMs - nowMs),
      isOver,
      Math.max(0, nowMs - finishMs),
    );
  }

  return { isMeatOn, elapsedMs, remainingLabel };
}

interface MultiCookBannerProps {
  cooks: Cook[];
  nowMs: number;
  onPressCook: (id: string) => void;
}

/**
 * Condensed banner shown when 2+ cooks are running at once (a Pro multi-cook
 * scenario). Lists every active cook with a compact status/timer; each row taps
 * through to that specific cook's live screen.
 */
export function MultiCookBanner({ cooks, nowMs, onPressCook }: MultiCookBannerProps) {
  return (
    <View style={[styles.wrap, { backgroundColor: BANNER_BG }]}>
      <View style={styles.headerRow}>
        <View style={styles.dot} />
        <Text style={styles.headerText} numberOfLines={1}>
          🔥 Now cooking · {cooks.length} cooks
        </Text>
      </View>
      {cooks.map((cook) => {
        const { isMeatOn, elapsedMs, remainingLabel } = cookTimes(cook, nowMs);
        const status = !isMeatOn
          ? "Warming up"
          : elapsedMs > 0
            ? fmtElapsedPlan(elapsedMs)
            : "Just started";
        return (
          <Pressable
            key={cook.id}
            onPress={() => onPressCook(String(cook.id))}
            style={styles.row}
            hitSlop={4}
          >
            <View style={styles.rowLeft}>
              <Text style={styles.foodText} numberOfLines={1}>
                {cook.foodType ?? "Cook in progress"}
              </Text>
              {remainingLabel ? (
                <Text style={styles.subText} numberOfLines={1}>
                  {remainingLabel}
                </Text>
              ) : null}
            </View>
            <Text style={styles.elapsedText} numberOfLines={1}>
              {status}
            </Text>
            <Feather name="chevron-right" size={16} color="#fff" />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 11, paddingBottom: 7 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff", opacity: 0.9 },
  headerText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#ffffff33",
  },
  rowLeft: { flex: 1, flexShrink: 1 },
  foodText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  subText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_400Regular",
    color: "#ffffff99",
    marginTop: 1,
  },
  elapsedText: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
    opacity: 0.9,
  },
});
