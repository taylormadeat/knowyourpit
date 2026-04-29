import { useAuth } from "@clerk/expo";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const GUEST_MODE_KEY = "knowyourpit:guestMode";

export default function Index() {
  const { isSignedIn, isLoaded } = useAuth();
  const colors = useColors();
  const [guestMode, setGuestMode] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(GUEST_MODE_KEY)
      .then((v) => {
        if (!cancelled) setGuestMode(v === "1");
      })
      .catch(() => {
        if (!cancelled) setGuestMode(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (guestMode === null) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (guestMode) {
    return <Redirect href="/(tabs)" />;
  }

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/(auth)/sign-in" />;
}
