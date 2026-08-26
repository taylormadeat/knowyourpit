import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Card, Badge, Button } from "@/components/ui";

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
      style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      accessibilityRole="button"
      accessibilityLabel={`${featureName} — Pro feature, tap to learn more`}
    >
      <Card style={styles.card}>
        <View style={styles.proBadge}>
          <Badge variant="outline" style={{ borderColor: colors.primary, backgroundColor: colors.primarySubtle, paddingHorizontal: 6, paddingVertical: 2 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Feather name="lock" size={10} color={colors.primary} />
              <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO</Text>
            </View>
          </Badge>
        </View>
        <View style={styles.iconWrap}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primarySubtle }]}>
            <Feather name={icon} size={22} color={colors.primary} />
          </View>
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{featureName}</Text>
        <Text style={[styles.teaser, { color: colors.mutedForeground }]}>{teaser}</Text>

        <View style={{ alignSelf: "flex-start", marginTop: 8 }}>
          <Button
            variant="outline"
            size="sm"
            onPress={onPress}
            title="Unlock with Pro"
            leftIcon={<Feather name="arrow-up-right" size={14} color={colors.primary} />}
            style={{ backgroundColor: colors.primarySubtle, borderColor: colors.transparent }}
            textStyle={{ color: colors.primary, fontSize: 13 }}
          />
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 8,
    position: "relative",
    overflow: "hidden",
  },
  proBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    zIndex: 10,
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
  title: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: -0.2 },
  teaser: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
});

export default LockedFeatureCard;
