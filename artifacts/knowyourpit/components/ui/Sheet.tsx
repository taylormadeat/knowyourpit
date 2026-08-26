import React from "react";
import { View, Text, StyleSheet, Pressable, type ViewProps } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { border, icon, spacing, touch, typography } from "@/constants/theme";

interface SheetProps extends ViewProps {
  title?: string;
  subtitle?: string;
  showClose?: boolean;
  scroll?: boolean;
  onClose?: () => void;
}

export function Sheet({
  title,
  subtitle,
  showClose = true,
  scroll = false,
  onClose,
  style,
  children,
  ...props
}: SheetProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.card,
          paddingBottom: insets.bottom,
        },
        style
      ]}
      {...props}
    >
      {(title || subtitle || showClose) && (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
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
          {showClose && onClose && (
            <Pressable
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.muted }]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
            >
              <Feather name="x" size={icon.lg} color={colors.foreground} />
            </Pressable>
          )}
        </View>
      )}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: border.width.hairline,
    minHeight: 56,
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
  closeBtn: {
    width: touch.target,
    height: touch.target,
    borderRadius: touch.target / 2,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.lg,
  },
  content: {
    flex: 1,
  },
});
