import React, { useCallback, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";

type Seasoning = {
  name: string;
  tagline: string;
  desc: string;
  img: number; // RN bundler resolves require() to a numeric asset ID
  accent: string;
};

const SEASONINGS: Seasoning[] = [
  {
    name: "Steak Night",
    tagline: "For beef, brisket & burgers",
    desc: "Steak seasoning · date night just got better",
    img: require("@/assets/images/partners/bp-steak-night.png") as number,
    accent: "#E84820",
  },
  {
    name: "PORKEN",
    tagline: "Competition pork & chicken rub",
    desc: "BBQ rub · your everyday meat rub",
    img: require("@/assets/images/partners/bp-porken.png") as number,
    accent: "#F97316",
  },
  {
    name: "Cajun Blast",
    tagline: "Bold Cajun heat",
    desc: "Cajun seasoning · blast your food with flavor",
    img: require("@/assets/images/partners/bp-cajun-blast.png") as number,
    accent: "#EF4444",
  },
  {
    name: "Everyday Tacos",
    tagline: "Chicken, tacos & everything",
    desc: "Taco seasoning · making tacos easy",
    img: require("@/assets/images/partners/bp-everyday-tacos.png") as number,
    accent: "#84CC16",
  },
];

const ROTATE_MS = 3_000;

export function BigPetesHomeCard() {
  const colors = useColors();
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = SEASONINGS[idx];

  // Restart the rotation every time the home tab gains focus so the card
  // keeps cycling even after the user navigates away and returns.
  useFocusEffect(
    useCallback(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setIdx(i => (i + 1) % SEASONINGS.length);
      }, ROTATE_MS);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, []),
  );

  function handleDotPress(i: number) {
    setIdx(i);
    // Reset the interval so the new selection gets a full 3 s before advancing.
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIdx(prev => (prev + 1) % SEASONINGS.length);
    }, ROTATE_MS);
  }

  function handleShop() {
    Linking.openURL("https://bigpetesseasoning.com/store");
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: current.accent + "50" }]}>
      {/* Accent top strip */}
      <View style={[s.strip, { backgroundColor: current.accent }]} />

      <View style={s.body}>
        {/* Header row */}
        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: "#E84820" + "18" }]}>
            <Text style={s.badgeText}>🤝 FEATURED PARTNER</Text>
          </View>
          {/* Dot indicator */}
          <View style={s.dots}>
            {SEASONINGS.map((_, i) => (
              <Pressable key={i} onPress={() => handleDotPress(i)} hitSlop={6}>
                <View
                  style={[
                    s.dot,
                    i === idx
                      ? { width: 18, backgroundColor: current.accent }
                      : { width: 6, backgroundColor: colors.border },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>

        {/* Product row */}
        <View style={s.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.tagline, { color: current.accent }]}>{current.tagline}</Text>
            <Text style={[s.productName, { color: colors.foreground }]}>{current.name}</Text>
            <Text style={[s.productDesc, { color: colors.mutedForeground }]}>{current.desc}</Text>
            <Pressable onPress={handleShop}>
              <Text style={[s.shopLink, { color: "#E84820" }]}>
                Use code KYP15 for 15% off →
              </Text>
            </Pressable>
          </View>
          <Image source={current.img} style={s.image} resizeMode="contain" />
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  strip: {
    height: 5,
  },
  body: {
    padding: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#E84820",
    letterSpacing: 0.5,
  },
  dots: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
  productRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 12,
  },
  tagline: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  productName: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  productDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 3,
  },
  shopLink: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginTop: 10,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: Platform.OS === "ios" ? "transparent" : "#0D0C0B",
  },
});
