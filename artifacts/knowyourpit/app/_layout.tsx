import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth } from "@clerk/expo";
import { tokenCache as nativeTokenCache } from "@clerk/expo/token-cache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter, patchAlert, listAlerts } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useWatchBridge } from "@/hooks/useWatchBridge";
import { CACHE_STORAGE_KEY } from "@/constants/cache";

SplashScreen.preventAutoHideAsync();

const CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24; // 24 hours

// One-time cleanup of the legacy un-scoped persisted cache. Older builds wrote
// a single shared cache bucket at CACHE_STORAGE_KEY, which leaked between
// accounts on the same device. Per-user scoping replaces it (see
// ScopedQueryProvider below); we delete the legacy key on boot so any stale
// data from before this fix can never be restored.
AsyncStorage.removeItem(CACHE_STORAGE_KEY).catch(() => {});

function userCacheKey(userId: string | null | undefined): string {
  return `${CACHE_STORAGE_KEY}:${userId ?? "anon"}`;
}

// EXPO_PUBLIC_API_URL: set to the deployed API server URL for production builds.
// Current production URL: https://pitking.replit.app (see eas.json and app.json)
// If a custom domain is connected (e.g. knowyourpit.com), update eas.json and app.json and rebuild.
// In development (Replit), EXPO_PUBLIC_DOMAIN is used as a fallback.
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");
setBaseUrl(apiBaseUrl);

// Clerk publishable key — two env vars are supported:
//   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY      → development key (used in Replit dev, starts with pk_test_)
//   EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD → production key  (must be set before running eas build, starts with pk_live_)
//
// Before running "eas build --profile production":
//   1. Obtain your production publishable key from https://dashboard.clerk.com
//   2. Set it as an EAS secret: eas secret:create EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD pk_live_xxxx
//   3. Add it to eas.json build.production.env (see eas.json for the placeholder)
const clerkPubKey =
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD ??
  process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ??
  "";
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
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Bridges the phone app to the Apple Watch companion app (iOS only, no-op elsewhere)
  useWatchBridge();

  useEffect(() => {
    setAuthTokenGetter(() => getToken());
  }, [getToken]);

  // Global auth gate: keep signed-in users out of /(auth) and signed-out users out of /(tabs)
  useEffect(() => {
    if (!isLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (isSignedIn && inAuthGroup) {
      router.replace("/(tabs)");
    } else if (!isSignedIn && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    }
  }, [isSignedIn, isLoaded, segments, router]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Startup reconciliation: mark any timer alerts whose scheduled notification already fired
  useEffect(() => {
    if (Platform.OS === "web") return;
    async function reconcileOverdueTimerAlerts() {
      try {
        const [activeAlerts, scheduled] = await Promise.all([
          listAlerts(),
          Notifications.getAllScheduledNotificationsAsync(),
        ]);
        const scheduledIds = new Set(scheduled.map((n) => n.identifier));
        const overdue = activeAlerts.filter(
          (a) =>
            a.alertType === "time_before_serve" &&
            a.isActive &&
            a.scheduledNotificationId != null &&
            !scheduledIds.has(a.scheduledNotificationId),
        );
        for (const alert of overdue) {
          await patchAlert(alert.id, { triggered: true }).catch(() => {});
        }
      } catch {
        // Non-critical — ignore errors
      }
    }
    reconcileOverdueTimerAlerts();
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
    <View style={{ flex: 1 }}>
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
    </View>
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
          <ClerkGatedShell />
        </ErrorBoundary>
      </SafeAreaProvider>
    </ClerkProvider>
  );

  if (Platform.OS === "web") {
    return content;
  }

  return <KeyboardProvider>{content}</KeyboardProvider>;
}

// Waits for Clerk to finish loading, then mounts a ScopedQueryProvider whose
// React `key` is the current Clerk userId. When the userId changes
// (sign-out, sign-in as a different account) the entire query cache subtree
// unmounts and remounts: a brand-new QueryClient and a brand-new persister
// pointed at the new user's AsyncStorage bucket. This makes it impossible for
// in-memory or on-disk cached data from one account to ever be displayed to
// another account on the same device.
function ClerkGatedShell() {
  const { isLoaded, userId } = useAuth();
  if (!isLoaded) {
    return <View style={{ flex: 1 }} />;
  }
  return (
    <ScopedQueryProvider key={userId ?? "anon"} userId={userId ?? null}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootLayoutNav />
      </GestureHandlerRootView>
    </ScopedQueryProvider>
  );
}

function ScopedQueryProvider({
  userId,
  children,
}: {
  userId: string | null;
  children: React.ReactNode;
}) {
  // Fresh QueryClient per mount — guaranteed clean in-memory cache.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { gcTime: CACHE_MAX_AGE_MS } },
      }),
  );
  // Per-user AsyncStorage bucket — guaranteed clean on-disk cache.
  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: AsyncStorage,
        key: userCacheKey(userId),
      }),
    [userId],
  );
  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
