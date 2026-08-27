import React from "react";
import { View, Text, Pressable, StyleSheet, ViewProps, TextProps, PressableProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

interface PreviewSurfaceProps extends ViewProps {
  colors: ReturnType<typeof useColors>;
}

export function PreviewSurface({ colors, style, children, ...props }: PreviewSurfaceProps) {
  return (
    <View style={[{ backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 16, overflow: "hidden" }, style]} {...props}>
      {children}
    </View>
  );
}

interface PreviewSectionHeaderProps extends TextProps {
  colors: ReturnType<typeof useColors>;
  title: string;
}

export function PreviewSectionHeader({ colors, title, style, ...props }: PreviewSectionHeaderProps) {
  return (
    <Text style={[{ fontSize: 13, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 1.2, color: colors.mutedForeground, marginBottom: 12 }, style]} {...props}>
      {title}
    </Text>
  );
}

interface PreviewActionProps extends PressableProps {
  colors: ReturnType<typeof useColors>;
  title: string;
  icon?: keyof typeof Feather.glyphMap;
  variant?: "primary" | "secondary" | "destructive";
}

export function PreviewAction({
  colors,
  title,
  icon,
  variant = "primary",
  style,
  accessibilityLabel = title,
  ...props
}: PreviewActionProps) {
  const getBgColor = () => {
    if (variant === "primary") return colors.primary;
    if (variant === "destructive") return colors.destructive;
    return colors.card;
  };
  
  const getTextColor = () => {
    if (variant === "secondary") return colors.foreground;
    if (variant === "destructive") return colors.destructiveForeground;
    return colors.primaryForeground;
  };

  const getBorderColor = () => {
    if (variant === "secondary") return colors.border;
    return "transparent";
  };

  return (
    <Pressable
      style={(state) => [
        {
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "secondary" ? 1 : 0,
          borderRadius: 12,
          paddingHorizontal: 16,
          gap: 8,
          opacity: state.pressed ? 0.8 : 1,
        },
        typeof style === "function" ? style(state) : style,
      ]}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      {icon && <Feather name={icon} size={18} color={getTextColor()} />}
      <Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: getTextColor() }}>{title}</Text>
    </Pressable>
  );
}

interface PreviewEmptyStateProps extends ViewProps {
  colors: ReturnType<typeof useColors>;
  title: string;
  description: string;
  icon?: keyof typeof Feather.glyphMap;
  action?: React.ReactNode;
}

export function PreviewEmptyState({ colors, title, description, icon = "inbox", action, style, ...props }: PreviewEmptyStateProps) {
  return (
    <View style={[{ alignItems: "center", justifyContent: "center", padding: 32, gap: 12 }, style]} {...props}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
        <Feather name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={{ fontSize: 20, fontFamily: "Inter_700Bold", color: colors.foreground, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 15, fontFamily: "Inter_400Regular", color: colors.mutedForeground, textAlign: "center", lineHeight: 22 }}>{description}</Text>
      {action && <View style={{ marginTop: 16, width: "100%" }}>{action}</View>}
    </View>
  );
}
