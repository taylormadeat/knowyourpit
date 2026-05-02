import React, { useEffect } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useBiometricLockContext } from "@/contexts/BiometricLockContext";

const logoImg = require("@/assets/images/logo.png");

export function AppLockScreen() {
  const { unlock } = useBiometricLockContext();

  // Trigger Face ID immediately on mount so the user gets the native prompt
  // without first tapping Unlock. If they cancel, the on-screen Unlock
  // button remains as a manual retry path.
  useEffect(() => {
    unlock();
  }, [unlock]);

  return (
    <View style={s.container}>
      <View style={s.content}>
        <Image source={logoImg} style={s.logo} resizeMode="contain" />
        <Text style={s.title}>knowyourpit</Text>
        <Text style={s.subtitle}>Locked</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Unlock with Face ID"
        onPress={() => {
          unlock();
        }}
        style={({ pressed }) => [s.button, pressed && { opacity: 0.85 }]}
      >
        <Feather name="lock" size={18} color="#fff" />
        <Text style={s.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0e0e10",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 120,
    paddingBottom: 80,
    paddingHorizontal: 32,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#F0E8D5",
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#8A7D70",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#E84520",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 200,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
