import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { useColors } from "@/hooks/useColors";

interface DashboardSummary {
  totalCooks?: number;
  totalGrills?: number;
  activeCooks?: number;
}

export interface PreviewHomeUIProps {
  colors: ReturnType<typeof useColors>;
  topPad: number;
  firstName: string;
  heroSub: string;
  summary?: DashboardSummary;
  summaryLoading: boolean;
}

export function PreviewHomeUI({
  colors,
  topPad,
  firstName,
  heroSub,
  summary,
  summaryLoading,
}: PreviewHomeUIProps) {
  const router = useRouter();

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: topPad + 30,
          backgroundColor: colors.foreground,
          borderBottomColor: colors.primary,
        },
      ]}
    >
      <Text style={[styles.eyebrow, { color: colors.primary }]}>
        FIRE CONTROL
      </Text>
      <Text
        accessibilityRole="header"
        style={[styles.title, { color: colors.background }]}
      >
        Ready to light the fire, {firstName}?
      </Text>
      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {heroSub}
      </Text>

      {!summaryLoading && (
        <View
          style={[
            styles.statStrip,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {[
            { value: summary?.totalCooks ?? 0, label: "COOKS" },
            { value: summary?.totalGrills ?? 0, label: "GRILLS" },
            { value: summary?.activeCooks ?? 0, label: "ACTIVE" },
          ].map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.foreground }]}>
                {stat.value}
              </Text>
              <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>
                {stat.label}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push("/(tabs)/plan")}
          accessibilityRole="button"
          accessibilityLabel="Plan a cook"
          style={({ pressed }) => [
            styles.action,
            { backgroundColor: colors.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text
            style={[styles.actionText, { color: colors.primaryForeground }]}
          >
            PLAN COOK
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/(tabs)/cooks")}
          accessibilityRole="button"
          accessibilityLabel="View cook history"
          style={({ pressed }) => [
            styles.action,
            {
              backgroundColor: colors.foreground,
              borderColor: colors.card,
              borderWidth: 1,
            },
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.actionText, { color: colors.background }]}>
            HISTORY
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomWidth: 4,
  },
  eyebrow: {
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 1.8,
    marginBottom: 12,
  },
  title: {
    maxWidth: 430,
    fontFamily: "Inter_700Bold",
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
  },
  subtitle: {
    maxWidth: 520,
    fontFamily: "Inter_400Regular",
    fontSize: 16,
    lineHeight: 23,
    marginTop: 12,
  },
  statStrip: {
    flexDirection: "row",
    marginTop: 24,
    borderWidth: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  stat: {
    flex: 1,
    minHeight: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    fontFamily: "Inter_700Bold",
    fontSize: 20,
  },
  statLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 9,
    letterSpacing: 0.9,
    marginTop: 3,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  action: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  actionText: {
    fontFamily: "Inter_700Bold",
    fontSize: 12,
    letterSpacing: 0.9,
  },
  pressed: {
    opacity: 0.78,
  },
});