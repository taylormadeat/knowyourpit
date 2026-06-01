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
    width: "120%",
    height: "120%",
    top: "-10%",
    left: "-10%",
  },
});
