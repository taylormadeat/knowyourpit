import React from "react";
import { Image, StyleSheet, View } from "react-native";

const logoImg = require("@/assets/images/icon-transparent-light.png");

interface LogoBackgroundProps {
  opacity?: number;
}

export function LogoBackground({ opacity = 0.05 }: LogoBackgroundProps) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Image
        source={logoImg}
        style={[s.logo, { opacity }]}
        resizeMode="cover"
      />
    </View>
  );
}

const s = StyleSheet.create({
  logo: {
    position: "absolute",
    width: "140%",
    height: "140%",
    top: "-20%",
    left: "-20%",
  },
});
