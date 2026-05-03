import React, { useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Alert, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Sharing from "expo-sharing";
import type { ViewShotRef } from "react-native-view-shot";
import { CookShareCard } from "./CookShareCard";

interface Props {
  cook: any;
  colors: any;
}

function isCookRated(cook: any): boolean {
  return !!(cook?.ratingTenderness || cook?.ratingFlavor || cook?.ratingBark);
}

export function ShareCookButton({ cook, colors }: Props) {
  if (cook?.status !== "completed") return null;

  const shotRef = useRef<ViewShotRef | null>(null);
  const [busy, setBusy] = useState(false);
  const rated = isCookRated(cook);

  const onShare = async () => {
    if (!rated) {
      Alert.alert("Rate your cook first", "Add a star rating so PitMaster can build your share card.");
      return;
    }
    if (Platform.OS === "web") {
      Alert.alert("Share unavailable", "Cook share cards are available in the iOS app.");
      return;
    }
    setBusy(true);
    try {
      await Haptics.selectionAsync().catch(() => {});
      const node = shotRef.current;
      if (!node || typeof (node as any).capture !== "function") {
        throw new Error("Share card not ready");
      }
      const uri = await (node as any).capture();
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Share unavailable", "Sharing isn't supported on this device.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your cook",
        UTI: "public.png",
      });
    } catch (e: any) {
      Alert.alert("Couldn't share", e?.message || "Could not generate the share card. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Off-screen render of the 1080x1080 card. ViewShot still captures it
          even though it's pushed off the visible area. */}
      <View pointerEvents="none" style={ss.offscreen} collapsable={false}>
        <CookShareCard ref={shotRef} cook={cook} />
      </View>

      <Pressable
        onPress={onShare}
        disabled={busy || !rated}
        style={({ pressed }) => [
          ss.btn,
          {
            backgroundColor: rated ? "#E84520" : colors.muted,
            borderRadius: colors.radius,
            opacity: !rated ? 0.6 : pressed || busy ? 0.7 : 1,
          },
        ]}
        accessibilityLabel="Share cook"
        accessibilityHint={rated ? "Generates a shareable image of your cook" : "Rate your cook first"}
      >
        <Feather
          name="share"
          size={18}
          color={rated ? "#fff" : colors.mutedForeground}
        />
        <Text
          style={[
            ss.btnText,
            { color: rated ? "#fff" : colors.mutedForeground },
          ]}
        >
          {busy ? "Preparing…" : rated ? "Share Cook" : "Rate your cook first"}
        </Text>
      </Pressable>
    </>
  );
}

const ss = StyleSheet.create({
  offscreen: {
    position: "absolute",
    left: -10000,
    top: -10000,
    width: 1080,
    height: 1080,
    opacity: 0,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  btnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
  },
});
