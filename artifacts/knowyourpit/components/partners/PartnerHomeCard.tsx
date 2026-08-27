import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { trackEvent } from "@/lib/trackEvent";
import { partnerImpressionEvent, partnerShopEvents } from "./partnerAnalytics";
import {
  getHomeProducts,
  getPartnerDefinition,
  type PartnerId,
} from "./partnerData";

const ROTATE_MS = 3_000;

type Props = {
  partnerId: PartnerId;
};

export function PartnerHomeCard({ partnerId }: Props) {
  const colors = useColors();
  const partner = getPartnerDefinition(partnerId);
  const products = getHomeProducts(partnerId);
  const [idx, setIdx] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const current = products[idx] ?? products[0];

  useEffect(() => {
    const event = partnerImpressionEvent({
      partnerId: partner.id,
      surface: "home",
    });
    trackEvent(event.event, event.properties);
  }, [partner.id]);

  useFocusEffect(
    useCallback(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (products.length > 1) {
        timerRef.current = setInterval(() => {
          setIdx(i => (i + 1) % products.length);
        }, ROTATE_MS);
      }
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }, [products.length]),
  );

  if (!current) return null;

  function handleDotPress(index: number) {
    setIdx(index);
    if (timerRef.current) clearInterval(timerRef.current);
    if (products.length > 1) {
      timerRef.current = setInterval(() => {
        setIdx(prev => (prev + 1) % products.length);
      }, ROTATE_MS);
    }
  }

  function handleShop() {
    const events = partnerShopEvents({
      partnerId: partner.id,
      surface: "home",
    });
    events.forEach(event => trackEvent(event.event, event.properties));
    void Linking.openURL(partner.storeUrl).catch(() => undefined);
  }

  return (
    <View style={[s.card, { backgroundColor: colors.card, borderColor: current.accent + "50" }]}>
      <View style={[s.strip, { backgroundColor: current.accent }]} />
      <View style={s.body}>
        <View style={s.headerRow}>
          <View style={[s.badge, { backgroundColor: partner.accent + "18" }]}>
            <Text style={[s.badgeText, { color: partner.accent }]}>{partner.brandName}</Text>
          </View>
          <View style={s.dots}>
            {products.map((_, index) => (
              <Pressable
                key={index}
                onPress={() => handleDotPress(index)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={`Show seasoning ${index + 1} of ${products.length}`}
              >
                <View
                  style={[
                    s.dot,
                    index === idx
                      ? { width: 18, backgroundColor: current.accent }
                      : { width: 6, backgroundColor: colors.border },
                  ]}
                />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={s.productRow}>
          <View style={{ flex: 1 }}>
            <Text style={[s.tagline, { color: current.accent }]}>{current.tagline}</Text>
            <Text style={[s.productName, { color: colors.foreground }]}>{current.name}</Text>
            <Text style={[s.productDesc, { color: colors.mutedForeground }]}>{current.desc}</Text>
            <Pressable
              onPress={handleShop}
              accessibilityRole="link"
              accessibilityLabel={`Shop ${partner.brandName}`}
            >
              <Text style={[s.shopLink, { color: partner.accent }]}>{partner.homeCta}</Text>
            </Pressable>
          </View>
          <Image source={current.image} style={s.image} resizeMode="contain" />
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