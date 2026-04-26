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
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter, patchAlert, listAlerts } from "@workspace/api-client-react";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useWatchBridge } from "@/hooks/useWatchBridge";
import { CACHE_STORAGE_KEY } from "@/constants/cache";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PaywallProvider } from "@/contexts/PaywallContext";

SplashScreen.preventAutoHideAsync();

// Aggressive boot-time cleanup of any persisted react-query caches from older
// builds. We previously experimented with PersistQueryClientProvider (both
// un-scoped at CACHE_STORAGE_KEY and per-user at `${CACHE_STORAGE_KEY}:*`).
// Either could leak data between accounts on the same device. This release
// removes on-disk react-query persistence entirely — all query state lives in
// memory only and is destroyed when the user signs out — and we proactively
// purge every legacy bucket on launch so no future code path can ever rehydrate
// stale data into the wrong session.
async function purgeLegacyQueryCaches() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const stale = keys.filter(
      (k) => k === CACHE_STORAGE_KEY || k.startsWith(`${CACHE_STORAGE_KEY}:`),
    );
    if (stale.length > 0) {
      await AsyncStorage.multiRemove(stale);
    }
  } catch {
    // Non-critical — if we cannot enumerate storage, the per-user QueryClient
    // remount in IsolatedQueryProvider still prevents in-memory leaks.
  }
}
purgeLegacyQueryCaches();

// EXPO_PUBLIC_API_URL: set to the deployed API server URL for production builds.
// Current production URL: https://pitking.replit.app (see eas.json and app.json)
// If a custom domain is connected (e.g. knowyourpit.com), update eas.json and app.json and rebuild.
// In development (Replit), EXPO_PUBLIC_DOMAIN is used as a fallback.
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");
setBaseUrl(apiBaseUrl);

// Module-level holder for the current Clerk session's getToken function.
// ClerkGatedShell updates this synchronously during render whenever the active
// userId or getToken reference changes, so any descendant mounted in the same
// commit cycle (including the per-user QueryClient and any of its queries)
// always reads the *current* user's token at request time. The wrapper passed
// to setAuthTokenGetter is stable and never re-registered — only the inner
// pointer changes — which closes the post-mount useEffect window where a
// freshly-mounted query could otherwise fire with the previous user's token.
let _currentGetToken: (() => Promise<string | null>) | null = null;
setAuthTokenGetter(async () => {
  if (!_currentGetToken) return null;
  try {
    return await _currentGetToken();
  } catch {
    return null;
  }
});

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
  const { isSignedIn, isLoaded } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  // Bridges the phone app to the Apple Watch companion app (iOS only, no-op elsewhere)
  useWatchBridge();

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
        <Stack.Screen name="sessions/[sessionId]" />
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

// Waits for Clerk to finish loading, then mounts an IsolatedQueryProvider whose
// React `key` is the current Clerk userId. When the userId changes
// (sign-out, sign-in as a different account) the entire query cache subtree
// unmounts and remounts with a brand-new in-memory QueryClient. Combined with
// the absence of any on-disk persistence (see purgeLegacyQueryCaches above),
// this makes it impossible for cached data from one account to ever be
// displayed to another account on the same device.
//
// We also call setAuthTokenGetter here, BEFORE the QueryClient mounts, so that
// the very first network request fired by any descendant screen is guaranteed
// to use the currently-signed-in user's token. If we set this in a child of
// QueryClientProvider, there would be a brief render window where queries
// could fire with the previous user's token.
function ClerkGatedShell() {
  const { isLoaded, userId, getToken } = useAuth();

  // Synchronous-during-render update of the module-level token getter.
  // Doing this here (rather than in a useEffect) guarantees that when the
  // child IsolatedQueryProvider remounts on a userId change, every query it
  // owns will read the current user's token from the very first request —
  // no useEffect-timing gap during which the previous user's getter is still
  // wired up. Writing to a module-level pointer is idempotent and side-effect
  // safe for our purposes (single source of truth, no React state involved).
  _currentGetToken = isLoaded && userId ? getToken : null;

  if (!isLoaded) {
    return <View style={{ flex: 1 }} />;
  }
  return (
    <IsolatedQueryProvider key={userId ?? "anon"}>
      <SubscriptionProvider>
        <PaywallProvider>
          <GestureHandlerRootView style={{ flex: 1 }}>
            <RootLayoutNav />
          </GestureHandlerRootView>
        </PaywallProvider>
      </SubscriptionProvider>
    </IsolatedQueryProvider>
  );
}

function IsolatedQueryProvider({ children }: { children: React.ReactNode }) {
  // Fresh QueryClient per mount (per Clerk userId) — guaranteed clean
  // in-memory cache. No persister is attached: nothing is written to disk,
  // so no leakage path between accounts exists.
  const [client] = useState(() => new QueryClient());
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
