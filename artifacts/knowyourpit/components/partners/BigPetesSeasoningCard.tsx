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
import { trackEvent } from "@/lib/trackEvent";

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

  // Primary dispatch on category — every cut in the app has a precise category string,
  // so we key on that first to avoid cross-contamination between meat types.

  if (cat === "seafood" || cat.includes("seafood") || cat.includes("fish")) {
    return [S.highTide, S.cajunBlast];
  }
  if (cat === "beef") {
    return [S.steakNight, S.sizzle, S.cajunBlast];
  }
  if (cat === "pork") {
    return [S.porken, S.cajunBlast, S.sizzle];
  }
  if (cat === "poultry") {
    return [S.porken, S.everydayTacos, S.sizzle];
  }
  if (cat === "lamb & goat" || cat.includes("lamb") || cat.includes("goat")) {
    return [S.cajunBlast, S.sizzle];
  }
  if (cat === "game" || cat.includes("game") || cat.includes("venison")) {
    return [S.cajunBlast, S.sizzle];
  }

  // Fallback: name-based heuristics for any future cuts with an unrecognised category.
  // Deliberately excludes "rib" and "loin" to prevent beef/game cross-contamination.
  if (n.includes("steak") || n.includes("brisket") || n.includes("beef") || n.includes("chuck") || n.includes("burger")) {
    return [S.steakNight, S.sizzle, S.cajunBlast];
  }
  if (n.includes("pork") || n.includes("bacon") || n.includes("ham") || n.includes("sausage")) {
    return [S.porken, S.cajunBlast, S.sizzle];
  }
  if (n.includes("chicken") || n.includes("turkey") || n.includes("poultry")) {
    return [S.porken, S.everydayTacos, S.sizzle];
  }
  if (n.includes("salmon") || n.includes("fish") || n.includes("shrimp") || n.includes("lobster") || n.includes("seafood")) {
    return [S.highTide, S.cajunBlast];
  }

  return [S.sizzle, S.everydayTacos, S.cajunBlast];
}

// ── Component ──────────────────────────────────────────────────────────────

type Props = {
  /** selectedCut.category from plan.tsx */
  cutCategory?: string;
  /** selectedCut.name from plan.tsx */
  cutName?: string;
  /**
   * Multi-cook variant: array of all cuts in the sequencer.
   * When provided, takes precedence over cutCategory/cutName.
   * Pairings are derived for every cut, then deduped by name.
   */
  cuts?: Array<{ category: string; name: string }>;
  /**
   * Whether the card is shown in single-cook ("single") or multi-cook
   * ("multi") mode. Included in the analytics event so partnership ROI
   * can be broken down by plan flow.
   */
  planMode: "single" | "multi";
};

const ROTATE_MS = 3_000;

export function BigPetesSeasoningCard({ cutCategory, cutName, cuts, planMode }: Props) {
  const colors = useColors();

  // Derive the merged pairings list.
  // When `cuts` is provided use all of them; otherwise fall back to the
  // single-cut props so existing call sites continue working unchanged.
  const { pairings, isMultiCook } = React.useMemo(() => {
    if (cuts && cuts.length > 0) {
      const seen = new Set<string>();
      const merged: Seasoning[] = [];
      for (const cut of cuts) {
        for (const s of pairingsForCut(cut.category, cut.name)) {
          if (!seen.has(s.name)) {
            seen.add(s.name);
            merged.push(s);
          }
        }
      }
      // isMultiCook is true whenever the cuts array is provided — we're always
      // in multi-cook mode when this prop is passed, regardless of how many
      // distinct meat categories are represented.
      return { pairings: merged, isMultiCook: true };
    }
    return {
      pairings: pairingsForCut(cutCategory ?? "", cutName ?? ""),
      isMultiCook: false,
    };
  }, [cuts, cutCategory, cutName]);

  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stable dependency key so the effect only re-runs when the cut selection
  // actually changes (avoids resetting on every render).
  const depsKey = cuts
    ? cuts.map(c => `${c.category}:${c.name}`).join("|")
    : `${cutCategory}:${cutName}`;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey]);

  const current = pairings[idx];

  // Guard: if pairings is ever empty or idx is transiently out of bounds
  // (e.g. during a cut-change render before the reset effect fires), bail out
  // safely rather than crashing on current.accent.
  if (!current) return null;

  function handleShop() {
    // Derive the primary cut category for single-cook mode; for multi-cook
    // summarise as a sorted, deduplicated comma-separated list so the event
    // is readable in the logs without being too noisy.
    const categoryForEvent = cuts && cuts.length > 0
      ? [...new Set(cuts.map(c => c.category))].sort().join(",")
      : (cutCategory ?? "unknown");

    trackEvent("big_petes_shop_tapped", {
      planMode,
      cutCategory: categoryForEvent,
    });

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
            <Text style={s.badgeText}>🤝 Big Pete's Seasoning</Text>
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
              {isMultiCook
                ? "Perfect pairings for your multi-cook"
                : "Perfect pairing for this cook"}
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
