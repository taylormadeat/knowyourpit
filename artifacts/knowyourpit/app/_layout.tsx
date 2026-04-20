import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache as nativeTokenCache } from "@clerk/expo/token-cache";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter, patchAlert } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

setBaseUrl(`https://${process.env.EXPO_PUBLIC_DOMAIN}`);

const clerkPubKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "";
const clerkProxyUrl = process.env.EXPO_PUBLIC_CLERK_PROXY_URL ?? "";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function requestNotificationPermissions() {
  if (Platform.OS === "web") return;
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing !== "granted") {
    await Notifications.requestPermissionsAsync();
  }
}

function RootLayoutNav() {
  const { getToken } = useAuth();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Global notification listeners — mark timer alerts triggered regardless of which screen is open
  useEffect(() => {
    if (Platform.OS === "web") return;

    function markAlertTriggered(alertId: number) {
      patchAlert(alertId, { triggered: true }).catch(() => {});
    }

    // Fired when a notification is received while the app is in the foreground
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as { alertId?: number } | undefined;
      if (data?.alertId) markAlertTriggered(data.alertId);
    });

    // Fired when the user taps a notification from the background or lock screen
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { alertId?: number } | undefined;
      if (data?.alertId) markAlertTriggered(data.alertId);
    });

    return () => {
      receivedSub.remove();
      responseSub.remove();
    };
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)/sign-in" />
      <Stack.Screen name="(auth)/sign-up" />
      <Stack.Screen name="grills" />
      <Stack.Screen name="recipes" />
      <Stack.Screen name="tips" />
      <Stack.Screen name="temperature" />
      <Stack.Screen name="temp-history" />
      <Stack.Screen name="meat-prep" />
      <Stack.Screen name="shop" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="cooks/[id]" />
      <Stack.Screen name="recipe/[id]" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  const [webReady, setWebReady] = useState(Platform.OS !== "web");
  useEffect(() => {
    if (Platform.OS === "web") {
      const t = setTimeout(() => setWebReady(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError && !webReady) return null;

  const content = (
    <ClerkProvider
      publishableKey={clerkPubKey}
      tokenCache={Platform.OS !== "web" ? nativeTokenCache : undefined}
      {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
    >
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );

  if (Platform.OS === "web") {
    return content;
  }

  return <KeyboardProvider>{content}</KeyboardProvider>;
}
