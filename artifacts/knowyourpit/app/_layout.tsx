import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { ClerkProvider, useAuth, useUser } from "@clerk/expo";
import { safeTokenCache } from "@/lib/tokenCache";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter, patchAlert, listAlerts } from "@workspace/api-client-react";
import { isCookDetailVisible } from "@/hooks/cookDetailVisibility";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BootDiagnostic } from "@/components/BootDiagnostic";
import { useWatchBridge } from "@/hooks/useWatchBridge";
import { CACHE_STORAGE_KEY } from "@/constants/cache";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PaywallProvider } from "@/contexts/PaywallContext";
import {
  consumeLastBootError,
  formatBootErrorForDisplay,
  installBootErrorCapture,
  persistBootError,
} from "@/lib/bootDiagnostics";
import { mark, installFetchTracker } from "@/lib/bootBreadcrumbs";

// Install the global JS error handler as early as possible — before any
// providers, hooks, or other module side-effects run — so that an exception
// thrown during the boot sequence is persisted to disk and can be displayed
// on the next launch's diagnostic screen. Without this, a silent crash in
// e.g. ClerkProvider initialisation would be invisible on TestFlight.
installBootErrorCapture();

// Wrap globalThis.fetch to record every Clerk-related HTTP call as a
// timestamped breadcrumb. The BootDiagnostic screen renders these so we
// can see — on a real device, in production — exactly which request is
// blocking the boot. Must run before ClerkProvider mounts.
installFetchTracker();
mark("module.load");

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
// Current production URL: https://api.knowyourpit.com (see eas.json)
// DNS: CNAME api.knowyourpit.com → the Replit deployment CNAME shown in Publishing settings.
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

let _appIsActive = true;
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (nextState) => {
    _appIsActive = nextState === "active";
  });

  Notifications.setNotificationHandler({
    handleNotification: async (notification): Promise<Notifications.NotificationBehavior> => {
      const isScheduleStep = notification.request.content.data?.scheduleStep === true;
      const suppressForeground = isScheduleStep && _appIsActive && isCookDetailVisible();
      return {
        shouldShowBanner: !suppressForeground,
        shouldShowList: true,
        shouldPlaySound: !suppressForeground,
        shouldSetBadge: false,
      };
    },
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
  const { user, isLoaded: userLoaded } = useUser();
  const segments = useSegments();
  const router = useRouter();
  // Bridges the phone app to the Apple Watch companion app (iOS only, no-op elsewhere)
  useWatchBridge();

  // Global auth gate: keep signed-in users out of /(auth) and signed-out users out of /(tabs).
  // Also enforces the username gate: signed-in users without a username are redirected to
  // /(auth)/set-username regardless of where they are in the app.
  useEffect(() => {
    if (!isLoaded || !userLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    const onSetUsername = segments[1] === "set-username";

    const hasUsername = !!((user?.unsafeMetadata as any)?.username || user?.username);

    if (!isSignedIn && (onSetUsername || !inAuthGroup)) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup && !onSetUsername) {
      if (hasUsername) {
        router.replace("/(tabs)");
      } else {
        router.replace("/(auth)/set-username");
      }
    } else if (isSignedIn && onSetUsername && hasUsername) {
      router.replace("/(tabs)");
    } else if (isSignedIn && !inAuthGroup && !hasUsername) {
      router.replace("/(auth)/set-username");
    }
  }, [isSignedIn, isLoaded, userLoaded, user?.username, user?.unsafeMetadata, segments, router]);

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
        <Stack.Screen name="(auth)/set-username" options={{ gestureEnabled: false }} />
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

  useEffect(() => {
    if (fontsLoaded) mark("fonts.loaded");
    if (fontError) mark("fonts.error", String(fontError));
  }, [fontsLoaded, fontError]);

  // Mark the moment RootLayout first renders, which is when ClerkProvider
  // is about to mount. Combined with `module.load`, `fonts.loaded`, and
  // the subsequent `fetch.start clerk...` crumbs, this gives an unambiguous
  // timeline of who is delaying boot — fonts, React, or Clerk itself.
  useEffect(() => {
    mark("clerk.boot.start");
  }, []);

  const [webReady, setWebReady] = useState(Platform.OS !== "web");
  useEffect(() => {
    if (Platform.OS === "web") {
      const t = setTimeout(() => setWebReady(true), 300);
      return () => clearTimeout(t);
    }
  }, []);

  // Only dismiss the splash once BOTH fonts and Clerk are ready.
  // Previously we dismissed as soon as fonts loaded, which left a white
  // frame visible while Clerk initialised — causing the App Store rejection.
  const [clerkReady, setClerkReady] = useState(false);
  useEffect(() => {
    if ((fontsLoaded || fontError) && clerkReady) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, clerkReady]);

  // Fallback: if Clerk's SDK stalls (network issue, OS compatibility, etc.)
  // and never sets isLoaded=true, the splash screen would freeze forever.
  // After 8 seconds with fonts ready, force-dismiss regardless of Clerk state.
  // ClerkGatedShell already renders #0e0e10 (matching the splash background)
  // while isLoaded is false, so the transition is visually seamless.
  useEffect(() => {
    if (!fontsLoaded && !fontError) return;
    const timer = setTimeout(() => {
      setClerkReady(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Read (and clear) any error a previous launch persisted via the global
  // error handler installed at module load. Surfaced on the BootDiagnostic
  // screen so we can see what crashed last time without needing a debugger.
  const [bootErrorText, setBootErrorText] = useState<string | null>(null);
  useEffect(() => {
    consumeLastBootError().then((err) => {
      if (err) setBootErrorText(formatBootErrorForDisplay(err));
    });
  }, []);

  // Hard escape hatch: if Clerk's `isLoaded` never flips true (e.g. iOS-26
  // network stack quirk, FAPI cert validation issue, SecureStore hang in the
  // tokenCache), we still mount the app shell after this timeout so the user
  // (and Apple reviewer) is never stuck on the diagnostic screen forever.
  //
  // We ALSO persist a "guest mode" flag in AsyncStorage when this flips. The
  // root index route (app/index.tsx) reads that flag *before* it consults
  // Clerk's `useAuth().isLoaded` — which means once the escape hatch trips,
  // index.tsx redirects straight to /(tabs) instead of falling through to
  // the still-spinning Clerk gate. Without that, "Continue without sign-in"
  // would dump the user onto an ActivityIndicator that never resolves
  // (because Clerk's underlying boot never resolves either).
  const [proceedAnyway, setProceedAnyway] = useState(false);
  const flipProceed = React.useCallback(() => {
    mark("escape.fired");
    setProceedAnyway(true);
    // Only auto-enter guest mode if the user has NOT explicitly signed out.
    // Without this check, a user who signs out while Clerk is hung gets
    // bounced right back into a guest session on the next cold launch
    // because the escape hatch fires again and re-sets the flag — making
    // sign-out feel completely broken.
    AsyncStorage.getItem("knowyourpit:explicitSignOut")
      .then((v) => {
        if (v === "1") {
          mark("escape.respect-signout");
          return;
        }
        AsyncStorage.setItem("knowyourpit:guestMode", "1").catch(() => {});
      })
      .catch(() => {
        AsyncStorage.setItem("knowyourpit:guestMode", "1").catch(() => {});
      });
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => {
      flipProceed();
    }, 12000);
    return () => clearTimeout(timer);
  }, [flipProceed]);

  // Periodic "still waiting" ticks while Clerk hasn't loaded. This makes it
  // unambiguous from the breadcrumb log whether anything is happening between
  // the initial fetches and the eventual escape — i.e. is the JS thread alive
  // or is everything frozen?
  useEffect(() => {
    let n = 0;
    const interval = setInterval(() => {
      n += 1;
      mark(`waiting.tick.${n * 2}s`);
      if (n >= 6) clearInterval(interval); // stops at 12s, after escape fires
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  if (!fontsLoaded && !fontError && !webReady) return null;

  // ErrorBoundary now wraps every other provider — including
  // KeyboardProvider and ClerkProvider — so an error thrown during *any*
  // provider's own initialisation surfaces to a visible fallback instead
  // of producing a silent black screen. The architect specifically called
  // out KeyboardProvider (from `react-native-keyboard-controller`, which
  // uses native modules) as a remaining black-screen risk on iPadOS 26 +
  // new arch; placing it inside the boundary closes that gap.
  // SafeAreaProvider must remain the outermost provider because
  // ErrorFallback uses `useSafeAreaInsets()`, which would be unavailable
  // if it were inside the boundary.
  return (
    <SafeAreaProvider>
      <ErrorBoundary
        onError={(error, componentStack) => {
          // Persist React render errors so they survive a manual reload
          // and are visible on the next launch's diagnostic screen.
          persistBootError(error, componentStack);
        }}
      >
        <KeyboardProviderOrFragment>
          <ClerkProvider
            publishableKey={clerkPubKey}
            tokenCache={Platform.OS !== "web" ? safeTokenCache : undefined}
            {...(clerkProxyUrl ? { proxyUrl: clerkProxyUrl } : {})}
          >
            <ClerkGatedShell
              onReady={() => setClerkReady(true)}
              publishableKey={clerkPubKey}
              bootErrorText={bootErrorText}
              proceedAnyway={proceedAnyway}
              onProceedAnyway={() => setProceedAnyway(true)}
            />
          </ClerkProvider>
        </KeyboardProviderOrFragment>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

// On native, wraps children in KeyboardProvider; on web, returns children
// as-is. Lifted out of RootLayout so KeyboardProvider can sit *inside* the
// top-level ErrorBoundary without extra branching at the JSX call site.
function KeyboardProviderOrFragment({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") {
    return <>{children}</>;
  }
  return <KeyboardProvider>{children}</KeyboardProvider>;
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
function ClerkGatedShell({
  onReady,
  publishableKey,
  bootErrorText,
  proceedAnyway,
  onProceedAnyway,
}: {
  onReady: () => void;
  publishableKey: string;
  bootErrorText: string | null;
  proceedAnyway: boolean;
  onProceedAnyway: () => void;
}) {
  const { isLoaded, userId, getToken } = useAuth();

  // Synchronous-during-render update of the module-level token getter.
  // Doing this here (rather than in a useEffect) guarantees that when the
  // child IsolatedQueryProvider remounts on a userId change, every query it
  // owns will read the current user's token from the very first request —
  // no useEffect-timing gap during which the previous user's getter is still
  // wired up. Writing to a module-level pointer is idempotent and side-effect
  // safe for our purposes (single source of truth, no React state involved).
  _currentGetToken = isLoaded && userId ? getToken : null;

  // Notify RootLayout so it can dismiss the splash screen only after Clerk
  // has finished loading. This closes the timing window that caused the white-
  // screen App Store rejection (splash dismissed → fonts loaded but Clerk not
  // yet ready → blank white frame visible to the reviewer).
  useEffect(() => {
    if (isLoaded) {
      mark("clerk.isLoaded.true");
      onReady();
    }
  }, [isLoaded, onReady]);

  // Once the user successfully signs in, clear the persisted "guest mode"
  // flag set by the escape hatch. Otherwise a future cold launch where Clerk
  // boots fast would still bypass the auth gate because the AsyncStorage
  // flag would still say "1".
  useEffect(() => {
    if (isLoaded && userId) {
      AsyncStorage.removeItem("knowyourpit:guestMode").catch(() => {});
    }
  }, [isLoaded, userId]);

  if (!isLoaded && !proceedAnyway) {
    // Visible diagnostic boot screen — replaces the previous silent black
    // <View> placeholder, which was indistinguishable from a hung/crashed
    // app and caused multiple App Store review rejections. If Clerk takes
    // longer than expected (or never loads), the user (and the reviewer)
    // can read on-screen state instead of staring at a black void, and
    // can press the "Continue without sign-in" button (revealed at 15s)
    // to fall through to the app shell. A 25s hard timer in RootLayout
    // also flips `proceedAnyway` automatically as a last-resort backstop.
    return (
      <BootDiagnostic
        clerkState="not ready"
        publishableKey={publishableKey}
        extra={bootErrorText}
        onContinue={onProceedAnyway}
      />
    );
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
