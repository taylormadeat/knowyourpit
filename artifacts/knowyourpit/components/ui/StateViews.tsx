import React from "react";
import { View, Text, ActivityIndicator, StyleSheet, type ViewProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Button } from "./Button";
import { icon as iconSize, radii, spacing, typography } from "@/constants/theme";

interface StateViewProps extends ViewProps {
  title?: string;
  description?: string;
  icon?: keyof typeof Feather.glyphMap;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export function EmptyState({
  title = "No data available",
  description,
  icon = "inbox",
  action,
  style,
  ...props
}: StateViewProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]} {...props}>
      <View style={[styles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={iconSize.xl} color={colors.mutedForeground} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      )}
      {action && (
        <Button
          variant="outline"
          title={action.label}
          onPress={action.onPress}
          style={styles.actionButton}
        />
      )}
    </View>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "Please try again later.",
  icon = "alert-triangle",
  action,
  style,
  ...props
}: StateViewProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]} {...props}>
      <View style={[styles.iconBox, { backgroundColor: colors.destructiveSubtle }]}>
        <Feather name={icon} size={iconSize.xl} color={colors.destructive} />
      </View>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      )}
      {action && (
        <Button
          variant="default"
          title={action.label}
          onPress={action.onPress}
          style={styles.actionButton}
        />
      )}
    </View>
  );
}

export function LoadingState({
  description = "Loading...",
  style,
  ...props
}: Omit<StateViewProps, "title" | "icon" | "action">) {
  const colors = useColors();

  return (
    <View style={[styles.container, style]} {...props}>
      <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
      {description && (
        <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xxl,
    minHeight: 200,
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    textAlign: "center",
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  description: {
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
    textAlign: "center",
    lineHeight: typography.lineHeight.base,
    maxWidth: 280,
  },
  actionButton: {
    marginTop: spacing.xxl,
    minWidth: 140,
  },
  loader: {
    marginBottom: spacing.lg,
  },
});
