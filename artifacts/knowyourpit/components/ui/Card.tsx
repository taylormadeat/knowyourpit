import React from "react";
import { View, StyleSheet, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { border, radii, spacing } from "@/constants/theme";

export interface CardProps extends ViewProps {
  style?: StyleProp<ViewStyle>;
  variant?: "default" | "outline" | "ghost";
}

export function Card({ style, variant = "default", children, ...props }: CardProps) {
  const colors = useColors();

  const getVariantStyles = () => {
    switch (variant) {
      case "outline":
        return {
          backgroundColor: colors.transparent,
          borderColor: colors.border,
          borderWidth: border.width.thin,
        };
      case "ghost":
        return {
          backgroundColor: colors.transparent,
          borderColor: colors.transparent,
          borderWidth: 0,
        };
      case "default":
      default:
        return {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: border.width.thin,
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.card,
        variantStyles,
        { borderRadius: radii.lg },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    overflow: "hidden",
  },
});
