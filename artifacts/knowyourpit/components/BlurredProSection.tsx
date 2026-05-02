import React from "react";
import { View, Text, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface BlurredProSectionProps {
  featureName: string;
  teaser?: string;
  onPress: () => void;
  intensity?: number;
  tint?: "light" | "dark" | "default";
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Optional minimum height to keep the blur surface visible even when children are short. */
  minHeight?: number;
}

/**
 * Wraps any children in a BlurView with a centered "Unlock with Pro" CTA.
 * Children remain rendered (so the blur still has shape/dimensions to obscure)
 * but become unreadable. Tap anywhere to fire the Pro upgrade flow.
 *
 * Used by:
 *   - Cook Coach teaser (cook detail AI analysis sections)
 *   - PitMaster Score on dashboard
 *   - Any future Pro-locked content surface that benefits from a blur tease
 */
export function BlurredProSection({
  featureName,
  teaser,
  onPress,
  intensity = 22,
  tint = "dark",
  children,
  style,
  minHeight,
}: BlurredProSectionProps) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        style,
        minHeight ? { minHeight } : null,
        pressed && { opacity: 0.94 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${featureName} — Pro feature, tap to unlock`}
    >
      <View style={styles.contentWrap} pointerEvents="none">{children}</View>
      <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
      <View style={[styles.scrim, { backgroundColor: "rgba(28,28,31,0.45)" }]} pointerEvents="none" />
      <View style={styles.ctaOverlay} pointerEvents="none">
        <View style={styles.lockCircle}>
          <Feather name="lock" size={18} color="#fff" />
        </View>
        <Text style={styles.ctaTitle}>Unlock {featureName}</Text>
        {teaser ? <Text style={styles.ctaTeaser}>{teaser}</Text> : null}
        <View style={[styles.ctaButton, { backgroundColor: colors.primary }]}>
          <Text style={styles.ctaButtonText}>Upgrade to Pro →</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "relative", overflow: "hidden", borderRadius: 12 },
  contentWrap: { opacity: 0.6 },
  scrim: { ...StyleSheet.absoluteFillObject },
  ctaOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 8,
  },
  lockCircle: {
    width: 38,
    height: 38,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  ctaTitle: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 15,
    textAlign: "center",
  },
  ctaTeaser: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    textAlign: "center",
    lineHeight: 17,
  },
  ctaButton: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaButtonText: {
    color: "#fff",
    fontFamily: "Inter_700Bold",
    fontSize: 12.5,
    letterSpacing: 0.3,
  },
});

export default BlurredProSection;
