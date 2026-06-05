import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

interface Cook2NudgeBannerProps {
  cookStatus: string | null | undefined;
  colors: any;
  effectivePro: boolean;
  showPaywall: (opts: { trigger: string; featureName: string; foodType: string | null }) => void;
  foodType: string | null;
}

/**
 * A subtle nudge banner shown on completed cooks for free users,
 * prompting them to upgrade to Pro for auto-grading and AI coaching
 * on their future cooks.
 */
export function Cook2NudgeBanner({ cookStatus, colors, effectivePro, showPaywall, foodType }: Cook2NudgeBannerProps) {
  if (cookStatus !== "completed") return null;
  if (effectivePro) return null;

  return (
    <Pressable
      onPress={() => showPaywall({ trigger: "cook_complete_nudge", featureName: "Live PitMaster coaching", foodType })}
      style={({ pressed }) => ({
        backgroundColor: "#6C3BF512",
        borderWidth: 1,
        borderColor: "#6C3BF530",
        borderRadius: colors.radius as number,
        paddingHorizontal: 14,
        paddingVertical: 14,
        flexDirection: "row" as const,
        alignItems: "center" as const,
        gap: 12,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: "#6C3BF525", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Feather name="zap" size={18} color="#A855F7" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: "Inter_700Bold", fontSize: 14, color: "#A855F7", marginBottom: 3 }}>
          Get live coaching on your next cook
        </Text>
        <Text style={{ fontFamily: "Inter_400Regular", fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }}>
          Pro gives you real-time PitMaster analysis every 30 minutes, auto-grading, and personalized tips.
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color="#A855F7" />
    </Pressable>
  );
}
