import React from "react";
import { Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { planStyles as s } from "./styles";

export function Label({
  children,
  colors,
}: {
  children: React.ReactNode;
  colors: any;
}) {
  return (
    <Text style={[s.label, { color: colors.foreground }]}>{children}</Text>
  );
}

export function StatCell({
  label,
  value,
  colors,
  highlight,
}: {
  label: string;
  value: string;
  colors: any;
  highlight?: boolean;
}) {
  return (
    <View style={s.statCell}>
      <Text style={[s.statLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
      <Text
        style={[
          s.statValue,
          { color: highlight ? colors.primary : colors.foreground },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

export function ScheduleRow({
  icon,
  label,
  value,
  sub,
  colors,
  highlight,
  trailing,
}: {
  icon: any;
  label: string;
  value: string;
  sub: string;
  colors: any;
  highlight?: boolean;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={s.scheduleRow}>
      <View
        style={[
          s.scheduleIcon,
          {
            backgroundColor: highlight
              ? colors.primary + "20"
              : colors.muted,
          },
        ]}
      >
        <Feather
          name={icon}
          size={14}
          color={highlight ? colors.primary : colors.mutedForeground}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[s.scheduleLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        <Text
          style={[
            s.scheduleValue,
            { color: highlight ? colors.primary : colors.foreground },
          ]}
        >
          {value}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[s.scheduleSub, { color: colors.mutedForeground }]}>
            {sub}
          </Text>
          {trailing}
        </View>
      </View>
    </View>
  );
}
