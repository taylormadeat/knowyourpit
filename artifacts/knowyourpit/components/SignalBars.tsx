import React from "react";
import { View } from "react-native";

export type SignalStrength = "strong" | "medium" | "weak" | "none";

export function rssiToStrength(rssi: number | null | undefined): SignalStrength {
  if (rssi == null) return "none";
  if (rssi >= -65) return "strong";
  if (rssi >= -80) return "medium";
  return "weak";
}

const STRENGTH_COLOR: Record<SignalStrength, string> = {
  strong: "#22c55e",
  medium: "#EAB308",
  weak:   "#f97316",
  none:   "#6b7280",
};

const STRENGTH_BARS: Record<SignalStrength, number> = {
  strong: 3,
  medium: 2,
  weak:   1,
  none:   0,
};

interface Props {
  rssi: number | null | undefined;
  size?: number;
}

export function SignalBars({ rssi, size = 10 }: Props) {
  const strength = rssiToStrength(rssi);
  const filled = STRENGTH_BARS[strength];
  const color = STRENGTH_COLOR[strength];
  const barWidth = Math.max(2, Math.round(size * 0.28));

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1.5 }}>
      {[1, 2, 3].map((b) => (
        <View
          key={b}
          style={{
            width: barWidth,
            height: size * (0.3 + b * 0.24),
            borderRadius: 1,
            backgroundColor: b <= filled ? color : color + "30",
          }}
        />
      ))}
    </View>
  );
}
