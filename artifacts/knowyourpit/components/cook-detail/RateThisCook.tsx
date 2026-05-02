import React from "react";
import { View, Text, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { s } from "./styles";

type Colors = any;

interface Props {
  c: any;
  colors: Colors;
  rateTenderness: number;
  setRateTenderness: (v: number) => void;
  rateFlavor: number;
  setRateFlavor: (v: number) => void;
  rateBark: number;
  setRateBark: (v: number) => void;
  rateSaving: boolean;
  saveRatings: (t: number, f: number, b: number) => void;
}

export function RateThisCook(p: Props) {
  const { c, colors, rateTenderness, setRateTenderness, rateFlavor, setRateFlavor, rateBark, setRateBark, rateSaving, saveRatings } = p;
  if (c.status !== "completed") return null;

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: "#eab30840", borderRadius: colors.radius }]}>
      <View style={[s.logHeader, { padding: 14 }]}>
        <View style={[s.logIconWrap, { backgroundColor: "#eab308" }]}>
          <Feather name="star" size={15} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.logTitle, { color: colors.foreground }]}>Rate This Cook</Text>
          <Text style={[s.logSub, { color: colors.mutedForeground }]}>
            {rateSaving ? "Saving…" : "Tap a star to rate · saves instantly"}
          </Text>
        </View>
      </View>

      {[
        { label: "Tenderness", icon: "droplet" as const, value: rateTenderness, setter: setRateTenderness, field: "tenderness" },
        { label: "Flavor",     icon: "heart"   as const, value: rateFlavor,    setter: setRateFlavor,    field: "flavor"    },
        { label: "Bark/Color", icon: "layers"  as const, value: rateBark,      setter: setRateBark,      field: "bark"      },
      ].map((row) => (
        <View key={row.label} style={[s.rateRow, { borderTopColor: colors.border }]}>
          <View style={s.rateRowLeft}>
            <Feather name={row.icon} size={14} color={colors.mutedForeground} />
            <Text style={[s.rateRowLabel, { color: colors.foreground }]}>{row.label}</Text>
          </View>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => {
                  const newVal = star === row.value ? 0 : star;
                  row.setter(newVal);
                  const t = row.field === "tenderness" ? newVal : rateTenderness;
                  const f = row.field === "flavor"     ? newVal : rateFlavor;
                  const b = row.field === "bark"       ? newVal : rateBark;
                  saveRatings(t, f, b);
                }}
                hitSlop={6}
                disabled={rateSaving}
              >
                <Text style={[s.star, { color: star <= row.value ? "#eab308" : colors.border, opacity: rateSaving ? 0.5 : 1 }]}>
                  {star <= row.value ? "★" : "☆"}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
