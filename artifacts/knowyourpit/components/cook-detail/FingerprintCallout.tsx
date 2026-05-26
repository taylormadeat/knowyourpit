import React from "react";
import { View, Text } from "react-native";
import { Feather } from "@expo/vector-icons";

type Colors = any;

interface Props {
  fingerprintSource: "grill" | "user" | "pit_bias_only" | null | undefined;
  fingerprintNote: string | null | undefined;
  colors: Colors;
}

function buildLabel(
  fingerprintSource: "grill" | "user" | "pit_bias_only" | null | undefined,
  fingerprintNote: string | null | undefined,
): string | null {
  if (fingerprintSource !== "grill" && fingerprintSource !== "user") return null;
  const note = fingerprintNote ?? null;
  const countMatch = note ? note.match(/across (\d+) cook/) : null;
  const n = countMatch ? parseInt(countMatch[1], 10) : null;
  const cookWord = n === 1 ? "cook" : "cooks";
  if (fingerprintSource === "grill") {
    return n != null
      ? `Tuned to your ${n} ${cookWord} on this grill`
      : "Tuned to your cook history on this grill";
  }
  const meatMatch = note ? note.match(/learned pace on ([^(]+?) \(across all grills\)/) : null;
  const meat = meatMatch ? meatMatch[1].trim() : null;
  return n != null && meat
    ? `Tuned to your ${n} ${meat} ${cookWord}`
    : n != null
      ? `Tuned to your ${n} personal ${cookWord}`
      : "Tuned to your personal cook history";
}

export function FingerprintCallout({ fingerprintSource, fingerprintNote, colors }: Props) {
  const label = buildLabel(fingerprintSource, fingerprintNote);
  if (!label) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        paddingTop: 10,
        paddingHorizontal: 2,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      <Feather name="bar-chart-2" size={12} color={colors.mutedForeground} />
      <Text
        style={{
          fontFamily: "Inter_400Regular",
          fontSize: 12,
          color: colors.mutedForeground,
          flex: 1,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
