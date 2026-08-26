import React from "react";
import { View, Text, Image, StyleSheet, Pressable, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogoBackground } from "@/components/LogoBackground";
import { WEB_PREVIEW_TOP_OFFSET } from "@/constants/layout";

const logoImg = require("@/assets/images/icon-transparent-light.png");

interface AppHeaderProps {
  title: string;
  showBack?: boolean;
  right?: React.ReactNode;
  dark?: boolean;
}

export function AppHeader({ title, showBack = false, right, dark = false }: AppHeaderProps) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const isWeb = Platform.OS === "web";
  const topPad = insets.top + (isWeb ? WEB_PREVIEW_TOP_OFFSET : 0);

  const textColor = colors.foreground;
  const gradientStart = dark ? colors.card : colors.card;
  const gradientEnd = dark ? colors.background : colors.background;

  const logoClickable = (
    <Pressable
      onPress={() => router.replace("/(tabs)" as any)}
      hitSlop={10}
      style={s.logoBtn}
      accessibilityRole="button"
      accessibilityLabel="Go to home"
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
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <Feather name="chevron-left" size={28} color={textColor} />
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
        <Pressable
          onPress={() => router.replace("/(tabs)" as any)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Go to home"
        >
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
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[s.container, s.gradientBorder, { borderBottomColor: colors.primary }]}
      >
        <LogoBackground opacity={0.03} />
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
    paddingHorizontal: 16,
    paddingBottom: 14,
    overflow: "hidden",
  },
  gradientBorder: {
    borderBottomWidth: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logo: {
    width: 36,
    height: 36,
  },
  logoSmall: {
    width: 30,
    height: 30,
    opacity: 0.85,
  },
  logoBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -4,
  },
  title: {
    flex: 1,
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.4,
  },
  rightSlot: {
    minWidth: 36,
    alignItems: "flex-end",
  },
});
