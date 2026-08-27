import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { partnerImpressionEvent, partnerShopEvents } from "./partnerAnalytics";
import {
  getPartnerDefinition,
  getPartnerPairings,
  type PartnerId,
} from "./partnerData";

const ROTATE_MS = 3_000;

type Props = {
  partnerId: PartnerId;
  cutCategory?: string;
  cutName?: string;
  cuts?: Array<{ category: string; name: string }>;
  planMode: "single" | "multi";
};

export function PartnerSeasoningCard({
  partnerId,
  cutCategory,
  cutName,
  cuts,
  planMode,
}: Props) {
  const colors = useColors();
  const partner = getPartnerDefinition(partnerId);
  const { pairings, isMultiCook } = useMemo(() => {
    if (cuts && cuts.length > 0) {
      const seen = new Set<string>();
      const merged = cuts.flatMap(cut => getPartnerPairings(partnerId, cut.category, cut.name))
        .filter(product => {
          if (seen.has(product.name)) return false;
          seen.add(product.name);
          return true;
        });
      return { pairings: merged, isMultiCook: true };
    }
    return {
      pairings: getPartnerPairings(partnerId, cutCategory ?? "", cutName ?? ""),
      isMultiCook: false,
    };
  }, [partnerId, cutCategory, cutName, cuts]);

  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const depsKey = cuts
    ? cuts.map(cut => `${cut.category}:${cut.name}`).join("|")
    : `${cutCategory}:${cutName}`;
  const current = pairings[idx] ?? pairings[0];

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
  }, [depsKey, pairings.length]);

  useEffect(() => {
    const event = partnerImpressionEvent({
      partnerId: partner.id,
      surface: "plan",
      planMode,
    });
    trackEvent(event.event, event.properties);
  }, [partner.id, planMode]);

  if (!current) return null;

  function handleShop() {
    const categoryForEvent = cuts && cuts.length > 0
      ? [...new Set(cuts.map(cut => cut.category))].sort().join(",")
      : (cutCategory ?? "unknown");
    const events = partnerShopEvents({
      partnerId: partner.id,
      surface: "plan",
      planMode,
      cutCategory: categoryForEvent,
    });
    events.forEach(event => trackEvent(event.event, event.properties));
    void Linking.openURL(partner.storeUrl).catch(() => undefined);
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
      <View style={[s.strip, { backgroundColor: current.accent }]} />
      <View style={s.body}>
        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: partner.accent + "18" }]}>
            <Text style={[s.badgeText, { color: partner.accent }]}>{partner.brandName}</Text>
          </View>
          {pairings.length > 1 && (
            <View style={s.dots}>
              {pairings.map((_, index) => (
                <View
                  key={index}
                  style={[
                    s.dot,
                    index === idx
                      ? { width: 18, backgroundColor: current.accent }
                      : { width: 6, backgroundColor: colors.border },
                  ]}
                />
              ))}
            </View>
          )}
        </View>

        <View style={s.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.productName, { color: colors.foreground }]}>{current.name}</Text>
            <Text style={[s.productDesc, { color: colors.mutedForeground }]}>{current.desc}</Text>
            <Text style={[s.pairing, { color: partner.accent }]}>
              {isMultiCook ? "Perfect pairings for your multi-cook" : "Perfect pairing for this cook"}
            </Text>
          </View>
          <Image source={current.image} style={s.image} resizeMode="contain" />
        </View>

        <View style={[s.divider, { backgroundColor: colors.border }]} />

        <View style={s.footer}>
          {partner.promoCode ? (
            <View style={[s.codePill, { borderColor: partner.accent + "40", backgroundColor: partner.accent + "18" }]}>
              <Text style={[s.codeText, { color: partner.accent }]}>Code: {partner.promoCode}</Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={handleShop}
            accessibilityRole="link"
            accessibilityLabel={`Shop ${partner.brandName}`}
          >
            <Text style={[s.shopLink, { color: partner.accent }]}>{partner.planCta}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[s.footerNote, { color: colors.mutedForeground }]}>{partner.footerNote}</Text>
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