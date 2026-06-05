import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Decision } from "./types";

const ACTION_CONFIG: Record<string, { label: string; icon: string; colorHex: string }> = {
  wrap:            { label: "Wrap",            icon: "package",       colorHex: "#F97316" },
  spritz:          { label: "Spritz",          icon: "wind",          colorHex: "#0EA5E9" },
  increase_pit:    { label: "Raise Pit Temp",  icon: "trending-up",   colorHex: "#EF4444" },
  decrease_pit:    { label: "Lower Pit Temp",  icon: "trending-down", colorHex: "#22C55E" },
  pull:            { label: "Pull Off",        icon: "check-circle",  colorHex: "#22C55E" },
  recover_schedule:{ label: "Recover",         icon: "refresh-cw",    colorHex: "#6C3BF5" },
  maintain:        { label: "Maintain",        icon: "activity",      colorHex: "#6B7280" },
};

const URGENCY_CONFIG: Record<string, { label: string; colorHex: string }> = {
  now:        { label: "Act now",    colorHex: "#EF4444" },
  soon:       { label: "Soon",       colorHex: "#F97316" },
  when_ready: { label: "When ready", colorHex: "#6B7280" },
};

interface DecisionsSectionProps {
  decisions: Decision[];
  colors: any;
  expandedRationale: number | null;
  setExpandedRationale: (v: number | null) => void;
  showSecondaryDecisions: boolean;
  setShowSecondaryDecisions: (v: boolean) => void;
}

export function DecisionsSection({
  decisions, colors, expandedRationale, setExpandedRationale,
  showSecondaryDecisions, setShowSecondaryDecisions,
}: DecisionsSectionProps) {
  if (!decisions || decisions.length === 0) return null;

  const primary = decisions[0];
  const secondary = decisions.slice(1);
  const showPrimary = primary != null;

  return (
    <View style={{ gap: 8 }}>
      {showPrimary && (() => {
        const cfg = ACTION_CONFIG[primary.action] ?? { label: primary.action, icon: "zap", colorHex: "#6C3BF5" };
        const urg = URGENCY_CONFIG[primary.urgency] ?? { label: primary.urgency, colorHex: "#6B7280" };
        const expanded = expandedRationale === 0;
        return (
          <View style={{ backgroundColor: cfg.colorHex + "12", borderWidth: 1, borderColor: cfg.colorHex + "40", borderRadius: colors.radius as number, overflow: "hidden" }}>
            <Pressable onPress={() => setExpandedRationale(expanded ? null : 0)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 13 }}>
              <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: cfg.colorHex + "25", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Feather name={cfg.icon as any} size={15} color={cfg.colorHex} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: cfg.colorHex }}>{cfg.label}</Text>
                  <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: urg.colorHex + "20", borderWidth: 1, borderColor: urg.colorHex + "40" }}>
                    <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: urg.colorHex }}>{urg.label.toUpperCase()}</Text>
                  </View>
                  {primary.targetValue != null && (
                    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.card }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10, color: colors.foreground }}>{Math.round(primary.targetValue)}°F</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 13, color: colors.foreground, lineHeight: 18 }}>{primary.instruction}</Text>
              </View>
              <Feather name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.mutedForeground as string} />
            </Pressable>
            {expanded && (
              <View style={{ paddingHorizontal: 14, paddingBottom: 13, paddingTop: 2 }}>
                <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>{primary.rationale}</Text>
              </View>
            )}
          </View>
        );
      })()}

      {secondary.length > 0 && (
        <>
          <Pressable onPress={() => setShowSecondaryDecisions(!showSecondaryDecisions)} style={{ flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, alignSelf: "flex-start" }}>
            <Text style={{ fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground }}>{showSecondaryDecisions ? "Hide" : `${secondary.length} more action${secondary.length > 1 ? "s" : ""}`}</Text>
            <Feather name={showSecondaryDecisions ? "chevron-up" : "chevron-down"} size={12} color={colors.mutedForeground as string} />
          </Pressable>
          {showSecondaryDecisions && secondary.map((d, i) => {
            const idx = i + 1;
            const cfg = ACTION_CONFIG[d.action] ?? { label: d.action, icon: "zap", colorHex: "#6B7280" };
            const urg = URGENCY_CONFIG[d.urgency] ?? { label: d.urgency, colorHex: "#6B7280" };
            const expanded = expandedRationale === idx;
            return (
              <View key={idx} style={{ backgroundColor: cfg.colorHex + "0A", borderWidth: 1, borderColor: cfg.colorHex + "30", borderRadius: colors.radius as number, overflow: "hidden" }}>
                <Pressable onPress={() => setExpandedRationale(expanded ? null : idx)} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <Feather name={cfg.icon as any} size={14} color={cfg.colorHex} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 13, color: cfg.colorHex }}>{cfg.label}</Text>
                      <View style={{ paddingHorizontal: 5, paddingVertical: 1, borderRadius: 5, backgroundColor: urg.colorHex + "15" }}>
                        <Text style={{ fontFamily: "Inter_500Medium", fontSize: 10, color: urg.colorHex }}>{urg.label}</Text>
                      </View>
                    </View>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.foreground, lineHeight: 16 }}>{d.instruction}</Text>
                  </View>
                  <Feather name={expanded ? "chevron-up" : "chevron-down"} size={13} color={colors.mutedForeground as string} />
                </Pressable>
                {expanded && (
                  <View style={{ paddingHorizontal: 14, paddingBottom: 11, paddingTop: 2 }}>
                    <Text style={{ fontFamily: "Inter_400Regular", fontSize: 11, color: colors.mutedForeground, lineHeight: 16 }}>{d.rationale}</Text>
                  </View>
                )}
              </View>
            );
          })}
        </>
      )}
    </View>
  );
}
