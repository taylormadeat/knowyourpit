import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface LockedFeatureCardProps {
  featureName: string;
  teaser: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
}

export function LockedFeatureCard({
  featureName,
  teaser,
  icon = "lock",
  onPress,
}: LockedFeatureCardProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${featureName} — Pro feature, tap to learn more`}
    >
      <View style={styles.proBadge}>
        <Feather name="lock" size={10} color={colors.primary} />
        <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
      </View>
      <View style={styles.iconWrap}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + "1A" }]}>
          <Feather name={icon} size={22} color={colors.primary} />
        </View>
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{featureName}</Text>
      <Text style={[styles.teaser, { color: colors.mutedForeground }]}>{teaser}</Text>
      <View style={[styles.cta, { backgroundColor: colors.primary + "12" }]}>
        <Feather name="arrow-up-right" size={13} color={colors.primary} />
        <Text style={[styles.ctaText, { color: colors.primary }]}>Unlock with Pro</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    padding: 16,
    gap: 8,
    position: "relative",
    overflow: "hidden",
  },
  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(232,69,32,0.12)",
  },
  proBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.6,
  },
  iconWrap: { flexDirection: "row", alignItems: "center" },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 15, fontFamily: "Inter_700Bold" },
  teaser: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  cta: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  ctaText: { fontSize: 12.5, fontFamily: "Inter_600SemiBold" },
});

export default LockedFeatureCard;
