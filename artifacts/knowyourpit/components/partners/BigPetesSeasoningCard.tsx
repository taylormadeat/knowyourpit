import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  StyleSheet,
  Linking,
  Platform,
} from "react-native";
import { useColors } from "@/hooks/useColors";

// ── Seasoning catalogue ────────────────────────────────────────────────────

type Seasoning = {
  name: string;
  desc: string;
  img: number; // RN bundler resolves require() to a numeric asset ID
  accent: string;
};

const S: Record<string, Seasoning> = {
  steakNight: {
    name: "Steak Night",
    desc: "Steak seasoning · date night just got better",
    img: require("@/assets/images/partners/bp-steak-night.png") as number,
    accent: "#E84820",
  },
  porken: {
    name: "PORKEN",
    desc: "BBQ rub · your everyday meat rub",
    img: require("@/assets/images/partners/bp-porken.png") as number,
    accent: "#F97316",
  },
  sizzle: {
    name: "Sizzle",
    desc: "Chipotle BBQ rub · Porken's sassy southwestern cousin",
    img: require("@/assets/images/partners/bp-sizzle.png") as number,
    accent: "#EF4444",
  },
  everydayTacos: {
    name: "Everyday Tacos",
    desc: "Taco seasoning · making tacos easy",
    img: require("@/assets/images/partners/bp-everyday-tacos.png") as number,
    accent: "#84CC16",
  },
  cajunBlast: {
    name: "Cajun Blast",
    desc: "Cajun seasoning · blast your food with flavor",
    img: require("@/assets/images/partners/bp-cajun-blast.png") as number,
    accent: "#EF4444",
  },
  highTide: {
    name: "High Tide",
    desc: "A fisherman's delight · seafood seasoning",
    img: require("@/assets/images/partners/bp-high-tide.png") as number,
    accent: "#22D3EE",
  },
};

// ── Category → seasoning pairing ──────────────────────────────────────────

function pairingsForCut(category: string, name: string): Seasoning[] {
  const cat = category.toLowerCase();
  const n = name.toLowerCase();

  if (cat.includes("seafood") || cat.includes("fish")) {
    return [S.highTide, S.cajunBlast];
  }
  if (cat.includes("pork") || n.includes("pork") || n.includes("rib") || n.includes("bacon") || n.includes("ham") || n.includes("loin")) {
    return [S.porken, S.cajunBlast, S.sizzle];
  }
  if (cat.includes("chicken") || cat.includes("poultry") || cat.includes("turkey") || n.includes("chicken") || n.includes("turkey")) {
    return [S.porken, S.everydayTacos, S.sizzle];
  }
  if (cat.includes("beef") || cat.includes("brisket") || n.includes("beef") || n.includes("brisket") || n.includes("steak") || n.includes("ribeye") || n.includes("chuck")) {
    return [S.steakNight, S.sizzle, S.cajunBlast];
  }
  if (cat.includes("lamb") || cat.includes("game") || cat.includes("venison")) {
    return [S.cajunBlast, S.sizzle];
  }
  return [S.sizzle, S.everydayTacos, S.cajunBlast];
}

// ── Component ──────────────────────────────────────────────────────────────

type Props = {
  /** selectedCut.category from plan.tsx */
  cutCategory: string;
  /** selectedCut.name from plan.tsx */
  cutName: string;
};

const ROTATE_MS = 3_000;

export function BigPetesSeasoningCard({ cutCategory, cutName }: Props) {
  const colors = useColors();
  const pairings = pairingsForCut(cutCategory, cutName);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when the cut changes
  useEffect(() => {
    setIdx(0);
    if (timerRef.current) clearInterval(timerRef.current);
    if (pairings.length > 1) {
      timerRef.current = setInterval(() => {
        setIdx(i => (i + 1) % pairings.length);
      }, ROTATE_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // pairings changes reference every render but is derived from the two stable props
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cutCategory, cutName]);

  const current = pairings[idx];

  function handleShop() {
    Linking.openURL("https://bigpetesseasoning.com/store");
  }

  return (
    <View
      style={[
        s.card,
        {
          backgroundColor: colors.card,
          borderColor: current.accent + "55",
        },
      ]}
    >
      {/* Accent top strip */}
      <View style={[s.strip, { backgroundColor: current.accent }]} />

      <View style={s.body}>
        {/* Header row */}
        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: "#E84820" + "18" }]}>
            <Text style={s.badgeText}>🤝 FEATURED PARTNER</Text>
          </View>
          {/* Dots — only shown when there's more than one pairing */}
          {pairings.length > 1 && (
            <View style={s.dots}>
              {pairings.map((_, i) => (
                <View
                  key={i}
                  style={[
                    s.dot,
                    i === idx
                      ? { width: 18, backgroundColor: current.accent }
                      : { width: 6, backgroundColor: colors.border },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        {/* Product row */}
        <View style={s.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.productName, { color: colors.foreground }]}>
              {current.name}
            </Text>
            <Text style={[s.productDesc, { color: colors.mutedForeground }]}>
              {current.desc}
            </Text>
            <Text style={[s.pairing, { color: "#E84820" }]}>
              Perfect pairing for this cook
            </Text>
          </View>
          <Image source={current.img} style={s.image} resizeMode="contain" />
        </View>

        {/* Divider */}
        <View style={[s.divider, { backgroundColor: colors.border }]} />

        {/* Footer */}
        <View style={s.footer}>
          <View style={[s.codePill, { borderColor: "#E84820" + "40", backgroundColor: "#E84820" + "18" }]}>
            <Text style={s.codeText}>Code: KYP15</Text>
          </View>
          <Pressable onPress={handleShop}>
            <Text style={[s.shopLink, { color: "#E84820" }]}>
              Shop Big Pete's →
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Subtle bottom label */}
      <Text style={[s.footerNote, { color: colors.mutedForeground }]}>
        15% off · bigpetesseasoning.com
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: "hidden",
    marginBottom: 8,
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
    marginTop: 10,
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
  pairing: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    marginTop: 6,
  },
  image: {
    width: 76,
    height: 76,
    borderRadius: 10,
    backgroundColor: Platform.OS === "ios" ? "transparent" : "#0D0C0B",
  },
  divider: {
    height: 1,
    marginTop: 12,
    marginBottom: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  codePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  codeText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#E84820",
  },
  shopLink: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  footerNote: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 10,
  },
});
