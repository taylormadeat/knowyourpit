import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useTopInset } from "@/hooks/useTopInset";
import { LogoBackground } from "@/components/LogoBackground";

const logoImg = require("@/assets/images/logo-light.png");

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
  dark?: boolean;
}

export function AppHeader({ title, showBack = false, right, dark = false }: AppHeaderProps) {
  const colors = useColors();
  const router = useRouter();
  const topPad = useTopInset();

  const textColor = dark ? "#F3EDE1" : colors.foreground;
  const subBg = dark ? ["#1C1C1F", "#2A1608"] as const : [colors.card, colors.card] as const;

  const logoClickable = (
    <Pressable
      onPress={() => router.replace("/(tabs)" as any)}
      hitSlop={10}
      style={s.logoBtn}
    >
      <Image source={logoImg} style={s.logo} resizeMode="contain" />
    </Pressable>
  );

  const backBtn = (
    <Pressable
      onPress={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)" as any);
        }
      }}
      style={s.backBtn}
      hitSlop={8}
    >
      <Feather name="chevron-left" size={24} color={textColor} />
    </Pressable>
  );

  const inner = (
    <View style={[s.row, { paddingTop: topPad + 14 }]}>
      {showBack ? backBtn : logoClickable}

      <Text style={[s.title, { color: textColor }]} numberOfLines={1}>
        {title}
      </Text>

      {right ? (
        <View style={s.rightSlot}>{right}</View>
      ) : showBack ? (
        <Pressable onPress={() => router.replace("/(tabs)" as any)} hitSlop={8}>
          <Image source={logoImg} style={s.logoSmall} resizeMode="contain" />
        </Pressable>
      ) : (
        <View style={s.rightSlot} />
      )}
    </View>
  );

  if (dark) {
    return (
      <LinearGradient
        colors={["#1C1C1F", "#2D1A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.container, s.gradientBorder]}
      >
        <LogoBackground opacity={0.06} />
        {inner}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        s.container,
        { backgroundColor: colors.card, borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      {inner}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    overflow: "hidden",
  },
  gradientBorder: {
    borderBottomWidth: 2,
    borderBottomColor: "#E84820",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  logo: {
    width: 34,
    height: 34,
  },
  logoSmall: {
    width: 28,
    height: 28,
    opacity: 0.85,
  },
  logoBtn: {
    width: 34,
    height: 34,
  },
  backBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },
  rightSlot: {
    minWidth: 34,
    alignItems: "flex-end",
  },
});
