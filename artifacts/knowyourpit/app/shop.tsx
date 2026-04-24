import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { useBottomInset } from "@/hooks/useBottomInset";
import { AppHeader } from "@/components/AppHeader";
import { LogoBackground } from "@/components/LogoBackground";

const SHOP_ITEMS = [
  {
    category: "Thermometers",
    items: [
      { name: "ThermoWorks Smoke X4", price: "$249", badge: "Best Overall", desc: "4-channel wireless thermometer with 1,000ft range. Industry standard for pitmasters.", url: "https://www.thermoworks.com/smokeX" },
      { name: "MEATER Block", price: "$249", badge: "Smart", desc: "True wireless probes with app connectivity and guided cook system.", url: "https://www.meater.com" },
      { name: "ThermoPop 2", price: "$35", badge: "Budget Pick", desc: "Instant-read thermometer in 2-3 seconds. Perfect for quick checks.", url: "https://www.thermoworks.com" },
    ],
  },
  {
    category: "Rubs & Seasonings",
    items: [
      { name: "Oakridge BBQ Black Ops Brisket", price: "$14", badge: "Competition", desc: "Award-winning brisket rub used by competition pitmasters.", url: null },
      { name: "Killer Hogs The BBQ Rub", price: "$11", badge: "Popular", desc: "Balanced all-purpose BBQ rub that works on everything.", url: null },
      { name: "Meat Church Holy Cow", price: "$12", badge: "Texas Style", desc: "Heavy salt and pepper base with depth — brisket specialist.", url: null },
    ],
  },
  {
    category: "Tools & Accessories",
    items: [
      { name: "Pink Butcher Paper Roll", price: "$18", badge: "Essential", desc: "Unwaxed peach butcher paper for the Texas Crutch without steam-softening bark.", url: null },
      { name: "BBQ Gloves (600°F)", price: "$28", badge: "Safety", desc: "Silicone-tipped heat-resistant gloves for handling hot grates and meat.", url: null },
      { name: "Charcoal Chimney Starter", price: "$24", badge: "Must Have", desc: "Light charcoal in 20 minutes with no lighter fluid taste.", url: null },
    ],
  },
];

export default function ShopScreen() {
  const colors = useColors();
  const router = useRouter();

  const topPad = useTopInset();
  const botPad = useBottomInset();

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LogoBackground opacity={0.04} />

      <AppHeader title="BBQ Shop" showBack dark />

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: botPad + 40, gap: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {SHOP_ITEMS.map((section) => (
          <View key={section.category}>
            <Text style={[s.catTitle, { color: colors.foreground }]}>{section.category}</Text>
            <View style={s.itemList}>
              {section.items.map((item, i) => (
                <Pressable
                  key={item.name}
                  style={({ pressed }) => [
                    s.item,
                    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                    i < section.items.length - 1 && s.itemBorder,
                    pressed && { opacity: 0.8 },
                  ]}
                  onPress={() => item.url && Linking.openURL(item.url)}
                >
                  <View style={s.itemTop}>
                    <Text style={[s.itemName, { color: colors.foreground }]}>{item.name}</Text>
                    <Text style={[s.itemPrice, { color: colors.primary }]}>{item.price}</Text>
                  </View>
                  <Text style={[s.itemDesc, { color: colors.mutedForeground }]}>{item.desc}</Text>
                  <View style={s.itemBottom}>
                    <View style={[s.badge, { backgroundColor: colors.primary + "22" }]}>
                      <Text style={[s.badgeText, { color: colors.primary }]}>{item.badge}</Text>
                    </View>
                    {item.url && <Feather name="external-link" size={14} color={colors.mutedForeground} />}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <View style={[s.disclaimer, { backgroundColor: colors.muted, borderRadius: colors.radius }]}>
          <Feather name="info" size={14} color={colors.mutedForeground} />
          <Text style={[s.disclaimerText, { color: colors.mutedForeground }]}>
            Recommendations are based on community testing and reviews. Prices may vary.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingBottom: 16, borderBottomWidth: 1 },
  back: { padding: 2 },
  title: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold" },
  catTitle: { fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 10 },
  itemList: { gap: 0 },
  item: { borderWidth: 1, padding: 14, gap: 8 },
  itemBorder: { borderBottomWidth: 0, borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  itemTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  itemName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", marginRight: 12 },
  itemPrice: { fontSize: 15, fontFamily: "Inter_700Bold" },
  itemDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20 },
  itemBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  disclaimer: { flexDirection: "row", gap: 8, padding: 12, alignItems: "flex-start" },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 18 },
});
