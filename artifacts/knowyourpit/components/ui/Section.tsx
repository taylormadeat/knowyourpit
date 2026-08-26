import React from "react";
import { View, Text, StyleSheet, type ViewProps } from "react-native";
import { useColors } from "@/hooks/useColors";
import { spacing, typography } from "@/constants/theme";

interface SectionProps extends ViewProps {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function Section({ title, subtitle, action, style, children, ...props }: SectionProps) {
  const colors = useColors();

  return (
    <View style={[styles.section, style]} {...props}>
      {(title || subtitle || action) && (
        <View style={styles.header}>
          <View style={styles.headerText}>
            {title && (
              <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
            )}
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
                {subtitle}
              </Text>
            )}
          </View>
          {action && <View style={styles.action}>{action}</View>}
        </View>
      )}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xxl,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  headerText: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: typography.fontSize.lg,
    fontFamily: typography.fontFamily.semibold,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  action: {
    marginLeft: spacing.lg,
  },
  content: {
    // Content can handle its own padding, but generally matches 20px horizontally
  },
});
