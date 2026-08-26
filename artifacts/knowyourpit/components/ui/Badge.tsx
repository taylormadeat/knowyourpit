import React from "react";
import { View, Text, StyleSheet, type ViewProps, type StyleProp, type ViewStyle, type TextStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { border, radii, spacing, typography } from "@/constants/theme";

export type BadgeVariant = "default" | "secondary" | "outline" | "destructive";

interface BadgeProps extends ViewProps {
  variant?: BadgeVariant;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children: React.ReactNode;
}

export function Badge({ variant = "default", style, textStyle, children, ...props }: BadgeProps) {
  const colors = useColors();

  const getVariantStyles = () => {
    switch (variant) {
      case "secondary":
        return {
          bg: colors.secondary,
          border: colors.secondary,
          text: colors.secondaryForeground,
        };
      case "outline":
        return {
          bg: colors.transparent,
          border: colors.border,
          text: colors.foreground,
        };
      case "destructive":
        return {
          bg: colors.destructive,
          border: colors.destructive,
          text: colors.destructiveForeground,
        };
      case "default":
      default:
        return {
          bg: colors.primary,
          border: colors.primary,
          text: colors.primaryForeground,
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: vStyles.bg,
          borderColor: vStyles.border,
          borderRadius: radii.lg,
        },
        style,
      ]}
      {...props}
    >
      {typeof children === "string" || typeof children === "number" ? (
        <Text style={[styles.text, { color: vStyles.text }, textStyle]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: border.width.thin,
    alignSelf: "flex-start",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 12,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -0.1,
  },
});
