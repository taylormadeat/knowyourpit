import React from "react";
import { View, Text, StyleSheet, Pressable, type ViewProps, type StyleProp, type ViewStyle } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { border, icon, spacing, touch, typography } from "@/constants/theme";

export interface ListRowProps extends ViewProps {
  title: string;
  subtitle?: string;
  leftIcon?: keyof typeof Feather.glyphMap | React.ReactNode;
  rightIcon?: keyof typeof Feather.glyphMap | React.ReactNode;
  rightComponent?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  hideChevron?: boolean;
}

export function ListRow({
  title,
  subtitle,
  leftIcon,
  rightIcon,
  rightComponent,
  onPress,
  style,
  hideChevron = false,
  ...props
}: ListRowProps) {
  const colors = useColors();

  const content = (
    <View style={[styles.row, { borderBottomColor: colors.border }, style]} {...props}>
      {leftIcon && (
        <View style={styles.leftIconContainer}>
          {typeof leftIcon === "string" ? (
            <Feather name={leftIcon as any} size={icon.md} color={colors.mutedForeground} />
          ) : (
            leftIcon
          )}
        </View>
      )}
      
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={styles.rightContainer}>
        {rightComponent}
        
        {rightIcon && typeof rightIcon === "string" ? (
          <Feather name={rightIcon as any} size={icon.md} color={colors.mutedForeground} />
        ) : rightIcon ? (
          rightIcon
        ) : null}

        {onPress && !hideChevron && !rightIcon && !rightComponent && (
          <Feather name="chevron-right" size={icon.md} color={colors.mutedForeground} />
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ opacity: pressed ? 0.7 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={title}
      >
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: touch.target,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    borderBottomWidth: border.width.hairline,
  },
  leftIconContainer: {
    marginRight: spacing.lg,
    justifyContent: "center",
    alignItems: "center",
    width: 24,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
  rightContainer: {
    marginLeft: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
});
