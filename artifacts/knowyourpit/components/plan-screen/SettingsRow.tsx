import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

type FeatherName = ComponentProps<typeof Feather>["name"];

interface SettingsRowProps {
  label: string;
  value: string | null;
  placeholder?: string;
  icon?: FeatherName;
  iconColor?: string;
  onPress: () => void;
  colors: any;
  rightElement?: React.ReactNode;
  disabled?: boolean;
  isLast?: boolean;
}

export function SettingsRow({
  label,
  value,
  placeholder = "Not set",
  icon,
  iconColor,
  onPress,
  colors,
  rightElement,
  disabled,
  isLast,
}: SettingsRowProps) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={({ pressed }) => [
        sr.row,
        { borderBottomColor: colors.border, borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth },
        pressed && !disabled && { opacity: 0.65 },
      ]}
    >
      {icon && (
        <View
          style={[
            sr.iconWrap,
            { backgroundColor: (iconColor ?? colors.mutedForeground) + "20" },
          ]}
        >
          <Feather
            name={icon}
            size={14}
            color={iconColor ?? colors.mutedForeground}
          />
        </View>
      )}
      <Text style={[sr.label, { color: colors.foreground }]}>{label}</Text>
      <View style={sr.right}>
        {rightElement ?? (
          <Text
            style={[
              sr.value,
              { color: value ? colors.mutedForeground : colors.mutedForeground + "60" },
            ]}
            numberOfLines={1}
          >
            {value ?? placeholder}
          </Text>
        )}
        {!disabled && (
          <Feather name="chevron-right" size={14} color={colors.mutedForeground + "80"} />
        )}
      </View>
    </Pressable>
  );
}

const sr = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 2,
    gap: 10,
    minHeight: 44,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    maxWidth: "55%",
  },
  value: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
});
