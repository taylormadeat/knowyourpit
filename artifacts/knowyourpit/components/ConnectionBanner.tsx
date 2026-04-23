import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { ServerStatus } from "@/hooks/useServerStatus";
import { useLastUpdated } from "@/hooks/useLastUpdated";

type ConnectionBannerProps = {
  status: ServerStatus;
  onRetry: () => void;
};

const BANNER_HEIGHT = 44;

export function ConnectionBanner({ status, onRetry }: ConnectionBannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;
  const visible = status === "unreachable";
  const lastUpdated = useLastUpdated();

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: visible ? 0 : -BANNER_HEIGHT,
      duration: 280,
      useNativeDriver: true,
    }).start();
  }, [visible, translateY]);

  if (status === "unknown") return null;

  const bannerLabel = lastUpdated
    ? `Offline — last updated ${lastUpdated}`
    : "Can't reach server — check your connection";

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          backgroundColor: colors.destructive,
          top: insets.top,
          transform: [{ translateY }],
        },
      ]}
      pointerEvents={visible ? "auto" : "none"}
      accessibilityLiveRegion="polite"
      accessibilityLabel="No server connection"
    >
      <View style={styles.inner}>
        <Feather name="wifi-off" size={14} color={colors.destructiveForeground} />
        <Text style={[styles.label, { color: colors.destructiveForeground }]}>
          {bannerLabel}
        </Text>
        <Pressable
          onPress={onRetry}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retry connection"
          style={({ pressed }) => [styles.retryBtn, pressed && styles.retryPressed]}
        >
          <Text style={[styles.retryText, { color: colors.destructiveForeground }]}>
            Retry
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    left: 0,
    right: 0,
    height: BANNER_HEIGHT,
    zIndex: 9999,
    elevation: 20,
    justifyContent: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 8,
  },
  label: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  retryBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  retryPressed: {
    opacity: 0.7,
  },
  retryText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
