import React from "react";
import { View, Text, Image, StyleSheet, Platform, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";

const logoImg = require("@/assets/images/logo.png");

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
  gradient?: boolean;
}

export function AppHeader({ title, showBack = false, right, gradient = false }: AppHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);

  const textColor = gradient ? "#F3EDE1" : colors.foreground;

  const inner = (
    <View style={[s.row, { paddingTop: topPad + 14 }]}>
      {showBack ? (
        <Pressable onPress={() => router.back()} style={s.backBtn} hitSlop={8}>
          <Feather name="chevron-left" size={24} color={textColor} />
        </Pressable>
      ) : (
        <Image source={logoImg} style={s.logo} resizeMode="contain" />
      )}

      <Text style={[s.title, { color: textColor }]} numberOfLines={1}>
        {title}
      </Text>

      {/* Right slot: prefer explicit right content, else show logo on back-screens */}
      {right ? (
        <View style={s.rightSlot}>{right}</View>
      ) : showBack ? (
        <Image source={logoImg} style={s.logoSmall} resizeMode="contain" />
      ) : (
        <View style={s.rightSlot} />
      )}
    </View>
  );

  if (gradient) {
    return (
      <LinearGradient
        colors={["#1C1C1F", "#2D1A0E"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.container, s.gradientBorder]}
      >
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
