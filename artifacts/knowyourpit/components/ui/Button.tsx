import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { border, radii, spacing, touch, typography } from "@/constants/theme";

export type ButtonVariant = "default" | "secondary" | "outline" | "ghost" | "destructive";
export type ButtonSize = "default" | "sm" | "lg" | "icon";

interface ButtonProps extends PressableProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  title?: string;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  children?: React.ReactNode;
}

export function Button({
  variant = "default",
  size = "default",
  title,
  loading = false,
  disabled,
  leftIcon,
  rightIcon,
  style,
  textStyle,
  children,
  ...props
}: ButtonProps) {
  const colors = useColors();
  const isDisabled = disabled || loading;

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
          bg: "transparent",
          border: colors.border,
          text: colors.foreground,
        };
      case "ghost":
        return {
          bg: "transparent",
          border: "transparent",
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

  const getSizeStyles = () => {
    switch (size) {
      case "sm":
        return { minHeight: touch.target, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: typography.fontSize.sm };
      case "lg":
        return { minHeight: 52, paddingHorizontal: spacing.xxl, paddingVertical: spacing.md, fontSize: 16 };
      case "icon":
        return { minHeight: touch.target, width: touch.target, paddingHorizontal: 0, paddingVertical: 0, fontSize: 14 };
      case "default":
      default:
        return { minHeight: touch.target, paddingHorizontal: spacing.lg, paddingVertical: 10, fontSize: typography.fontSize.base };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: vStyles.bg,
          borderColor: vStyles.border,
          borderRadius: radii.lg,
          minHeight: sStyles.minHeight,
          width: size === "icon" ? sStyles.width : undefined,
          paddingHorizontal: sStyles.paddingHorizontal,
          paddingVertical: sStyles.paddingVertical,
          opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...props}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator color={vStyles.text} size="small" style={styles.loader} />
        ) : leftIcon ? (
          <View style={styles.iconContainer}>{leftIcon}</View>
        ) : null}
        
        {!loading && title && size !== "icon" && (
          <Text
            style={[
              styles.text,
              { color: vStyles.text, fontSize: sStyles.fontSize },
              textStyle,
            ]}
          >
            {title}
          </Text>
        )}
        
        {!loading && (typeof children === "string" || typeof children === "number") ? (
          <Text
            style={[
              styles.text,
              { color: vStyles.text, fontSize: sStyles.fontSize },
              textStyle,
            ]}
          >
            {children}
          </Text>
        ) : !loading ? (
          children
        ) : null}

        {!loading && rightIcon ? (
          <View style={styles.iconContainer}>{rightIcon}</View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderWidth: border.width.thin,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  text: {
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -0.2,
    textAlign: "center",
  },
  iconContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  loader: {
    marginRight: 4,
  },
});
