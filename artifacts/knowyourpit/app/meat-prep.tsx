import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

const MEATS = [
  {
    name: "Brisket",
    icon: "award",
    targetTemp: "203°F",
    restTime: "1-2 hours",
    steps: [
      "Trim fat cap to ¼ inch — too thick insulates, too thin dries out.",
      "Remove hard fat deposits near the point-flat seam.",
      "Apply rub: equal parts coarse salt and black pepper. Add garlic powder if desired.",
      "Wrap tightly in plastic wrap, rest in fridge overnight (up to 24h).",
      "Remove 1 hour before cooking — allows more even bark formation.",
    ],
    tips: "Grain direction matters for slicing. Cut against the grain after resting.",
  },
  {
    name: "Pork Butt",
    icon: "layers",
    targetTemp: "203°F",
    restTime: "1 hour",
    steps: [
      "Leave the fat cap on — it bastes the meat during the long cook.",
      "Score the fat cap in a cross-hatch pattern for better rub penetration.",
      "Apply yellow mustard as binder, then generous BBQ rub all over.",
      "Optional: inject with apple juice, butter, and rub mixture.",
      "Rest uncovered overnight in the fridge for better bark.",
    ],
    tips: "At 160°F, the stall hits. Wrap in butcher paper to power through.",
  },
  {
    name: "Ribs",
    icon: "align-justify",
    targetTemp: "195-203°F",
    restTime: "30 min",
    steps: [
      "Remove the membrane from the bone side using a paper towel for grip.",
      "Trim off any dangly bits of meat or excess fat.",
      "Apply thin coat of mustard, then generously coat with rub.",
      "Let sit 30-60 minutes before cooking, or overnight in the fridge.",
    ],
    tips: "3-2-1 method (3hr smoke, 2hr wrapped, 1hr unwrapped) works great for baby backs.",
  },
  {
    name: "Chicken",
    icon: "zap",
    targetTemp: "165°F",
    restTime: "10 min",
    steps: [
      "Brine whole chickens in salt water (1 cup salt per gallon) for 4-12 hours.",
      "Pat completely dry with paper towels — key for crispy skin.",
      "Separate skin from breast and apply butter/seasoning underneath.",
      "Truss the bird if cooking whole for even cooking.",
      "Apply oil or mayo on outside, then season liberally.",
    ],
    tips: "Spatchcock for faster, more even cooking and better bark.",
  },
  {
    name: "Salmon",
    icon: "droplet",
    targetTemp: "130-140°F",
    restTime: "5 min",
    steps: [
      "Remove pin bones with tweezers.",
      "Dry brine with salt for 1-4 hours in the fridge — forms the pellicle.",
      "Rinse, pat dry, let air dry 30 min for sticky pellicle that holds smoke.",
      "Apply light rub or glaze just before cooking.",
    ],
    tips: "The white protein (albumin) squeezes out when overcooked. Pull at 130°F for moist fish.",
  },
  {
    name: "Lamb",
    icon: "star",
    targetTemp: "145°F (medium)",
    restTime: "15 min",
    steps: [
      "Trim excess fat but leave some for flavor and moisture.",
      "Score the fat cap to help rendered fat baste the meat.",
      "Marinate with garlic, rosemary, olive oil, and lemon zest overnight.",
      "Bring to room temp 30 min before cooking.",
    ],
    tips: "Lamb loves smoke from cherry or apple wood — avoid mesquite, it overpowers.",
  },
];

export default function MeatPrepScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const botPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  const meat = MEATS.find((m) => m.name === selected);

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <AppHeader title={selected || "Meat Prep Guide"} showBack />

      {!selected ? (
        <ScrollView
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: botPad + 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.subtitle, { color: colors.mutedForeground }]}>
            Select a protein to see prep instructions
          </Text>
          {MEATS.map((m) => (
            <Pressable
              key={m.name}
              style={({ pressed }) => [
                s.meatCard,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => setSelected(m.name)}
            >
              <View style={[s.meatIcon, { backgroundColor: colors.primary + "22" }]}>
                <Feather name={m.icon as any} size={20} color={colors.primary} />
              </View>
              <View style={s.meatInfo}>
                <Text style={[s.meatName, { color: colors.foreground }]}>{m.name}</Text>
                <Text style={[s.meatTemp, { color: colors.mutedForeground }]}>
                  Target: {m.targetTemp}
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </ScrollView>
      ) : meat ? (
        <ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: botPad + 40, gap: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.infoBar, { backgroundColor: colors.primary + "15", borderRadius: colors.radius }]}>
            <View style={s.infoItem}>
              <Feather name="thermometer" size={16} color={colors.primary} />
              <View>
                <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Pull Temp</Text>
                <Text style={[s.infoValue, { color: colors.foreground }]}>{meat.targetTemp}</Text>
              </View>
            </View>
            <View style={[s.infoDivider, { backgroundColor: colors.border }]} />
            <View style={s.infoItem}>
              <Feather name="clock" size={16} color={colors.primary} />
              <View>
                <Text style={[s.infoLabel, { color: colors.mutedForeground }]}>Rest Time</Text>
                <Text style={[s.infoValue, { color: colors.foreground }]}>{meat.restTime}</Text>
              </View>
            </View>
          </View>

          <View>
            <Text style={[s.sectionTitle, { color: colors.foreground }]}>Prep Steps</Text>
            {meat.steps.map((step, i) => (
              <View key={i} style={s.step}>
                <View style={[s.stepNum, { backgroundColor: colors.primary }]}>
                  <Text style={s.stepNumText}>{i + 1}</Text>
                </View>
                <Text style={[s.stepText, { color: colors.foreground }]}>{step}</Text>
              </View>
            ))}
          </View>

          <View style={[s.tipCard, { backgroundColor: colors.secondary + "22", borderRadius: colors.radius }]}>
            <Feather name="zap" size={18} color={colors.secondary} />
            <Text style={[s.tipText, { color: colors.foreground }]}>{meat.tips}</Text>
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  meatCard: { flexDirection: "row", alignItems: "center", gap: 14, borderWidth: 1, padding: 16 },
  meatIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  meatInfo: { flex: 1 },
  meatName: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  meatTemp: { fontSize: 12, fontFamily: "Inter_400Regular" },
  infoBar: { flexDirection: "row", alignItems: "center", padding: 16 },
  infoItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  infoDivider: { width: 1, height: 40, marginHorizontal: 12 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  infoValue: { fontSize: 15, fontFamily: "Inter_700Bold" },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 14 },
  step: { flexDirection: "row", gap: 12, marginBottom: 14, alignItems: "flex-start" },
  stepNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  stepNumText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  stepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
  tipCard: { flexDirection: "row", gap: 12, padding: 16, alignItems: "flex-start" },
  tipText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 22 },
});
