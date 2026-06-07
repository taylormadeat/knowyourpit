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
import { QueryClient, QueryClientProvider, useQueryClient as useQueryClientInner } from "@tanstack/react-query";
import { type Href, Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { setBaseUrl, setAuthTokenGetter, customFetch } from "@workspace/api-client-react";
import { isCookDetailVisible, getCurrentCookId } from "@/hooks/cookDetailVisibility";
import { setPendingCheckin } from "@/lib/pendingCheckinNotif";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { BootDiagnostic } from "@/components/BootDiagnostic";
import { CACHE_STORAGE_KEY } from "@/constants/cache";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { PaywallProvider } from "@/contexts/PaywallContext";
import { BleProbeProvider } from "@/contexts/BleProbeContext";
import {
  consumeLastBootError,
  formatBootErrorForDisplay,
  installBootErrorCapture,
  persistBootError,
} from "@/lib/bootDiagnostics";
import { mark, installFetchTracker } from "@/lib/bootBreadcrumbs";
import { getTokenSafe } from "@/lib/getTokenSafe";
import { initSentry } from "@/lib/sentry";

// Initialise Sentry as the very first module-level side-effect so that any
// error thrown during boot (ClerkProvider, tokenCache, font loading, etc.)
// is captured before the ErrorBoundary or BootDiagnostic screen is mounted.
// initSentry() is a no-op when EXPO_PUBLIC_SENTRY_DSN is absent.
initSentry();

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
  return getTokenSafe(_currentGetToken);
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

// Loud diagnostic: in a non-__DEV__ build (TestFlight / App Store), refuse to
// silently fall back to a pk_test_ Clerk dev key — that's exactly what bit the
// last App Review (reviewer hits prod app, prod app talks to dev Clerk
// instance, dev Clerk has no reviewer account → "credentials don't work").
if (!__DEV__) {
  if (!clerkPubKey) {
    console.error(
      "[knowyourpit] FATAL: no Clerk publishable key set in production build. " +
        "Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD as an EAS secret and reference it in eas.json build.production.env.",
    );
  } else if (clerkPubKey.startsWith("pk_test_")) {
    console.error(
      "[knowyourpit] WARNING: production build is using a pk_test_ (development) Clerk key. " +
        "Sign-in will hit the dev Clerk instance, where reviewer/production accounts do not exist. " +
        "Set EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD to a pk_live_… key before shipping.",
    );
  }
}

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

// Typed shape of the custom fields stored in Clerk's unsafeMetadata.
// Using a typed interface instead of `as any` so TypeScript catches typos.
interface AppUserMeta {
  username?: string;
  hasSeenOnboarding?: boolean;
  displayName?: string;
  signInProvider?: string;
}
function getAppMeta(user: { unsafeMetadata?: Record<string, unknown> } | null | undefined): AppUserMeta {
  return (user?.unsafeMetadata ?? {}) as AppUserMeta;
}

// Accounts created on or after this date are treated as "new users" who should
// see the onboarding flow. Existing accounts (created before this feature shipped)
// are exempted so they are never interrupted when they update the app.
const ONBOARDING_FEATURE_LAUNCH_MS = new Date("2026-05-18T00:00:00Z").getTime();

// BETA MODE: set to true to show the tutorial on every launch for all users.
// Flip to false when beta testing is complete to revert to first-login-only.
const ONBOARDING_ALWAYS_SHOW = false;

// Session-level flag: set to true when the user explicitly dismisses the
// tutorial (taps Done / Skip / Let's Go). Prevents the nav guard from
// bouncing them back into onboarding after they leave — which happens when
// ONBOARDING_ALWAYS_SHOW=true because the guard otherwise hard-codes
// hasSeenOnboarding=false for every navigation event.
let _sessionOnboardingDone = false;

// Process-level flag: ensures the cold-start notification response is consumed
// at most once per app process lifetime. Guards against hot-reload re-mounts
// in development where RootLayoutNav can unmount and remount without a full
// JS engine restart (and therefore without a fresh getLastNotificationResponseAsync call).
let _coldStartCheckinHandled = false;

export function signalOnboardingDone() {
  _sessionOnboardingDone = true;
}

// Typed route constant — avoids repeating `as any` at every call site.
// Expo Router generates Href types from the file system at build time; because
// the (onboarding) screen was added after the last generation we declare the
// constant here with a single typed cast to Href (not `any`) so callers stay typed.
const ONBOARDING_HREF = "/(onboarding)" as Href;

function RootLayoutNav() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  const segments = useSegments();
  const router = useRouter();

  // Local AsyncStorage supplement for hasSeenOnboarding. If the Clerk metadata
  // write in the onboarding screen fails (e.g. network error), this local flag
  // prevents the nav guard from bouncing the user back into onboarding on the
  // next in-session navigation. Initialised once on mount.
  const [localOnboardingSeen, setLocalOnboardingSeen] = useState(false);
  // Tracks whether the AsyncStorage read has completed. The guard waits for this
  // so it never routes based on a stale false before the flag has been checked.
  const [localFlagLoaded, setLocalFlagLoaded] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem("knowyourpit:hasSeenOnboarding")
      .then((v) => { if (v === "1") setLocalOnboardingSeen(true); })
      .catch(() => {})
      .finally(() => setLocalFlagLoaded(true));
  }, []);

  // ── Cold-start notification tap handling ─────────────────────────────────
  // `addNotificationResponseReceivedListener` only fires when the app is
  // already running (foreground / background). For cold starts — where iOS
  // fully kills the app and relaunches it in response to a notification tap —
  // we must read the tapped response via `getLastNotificationResponseAsync()`
  // before it is cleared by a subsequent interaction.
  //
  // Strategy:
  //  1. Capture the response into a ref + flip `coldStartLoaded` state as soon
  //     as the async API resolves. Using state (not just a ref) ensures the
  //     processing effect below re-runs even when auth was already ready before
  //     the API resolved — purely ref-based storage would be missed because a
  //     ref mutation never triggers a re-render.
  //  2. The processing effect waits for BOTH `coldStartLoaded` AND the full
  //     auth gate to be satisfied, then validates the cook before navigating.
  //  3. A module-level flag (`_coldStartCheckinHandled`) prevents a second
  //     invocation on hot-reload re-mounts during development.
  const coldStartResponseRef = useRef<Notifications.NotificationResponse | null>(null);
  const [coldStartLoaded, setColdStartLoaded] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") { setColdStartLoaded(true); return; }
    if (_coldStartCheckinHandled) { setColdStartLoaded(true); return; }
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        coldStartResponseRef.current = response;
        setColdStartLoaded(true);
      })
      .catch(() => { setColdStartLoaded(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Process the captured cold-start response once BOTH the response is loaded
  // AND auth is fully settled. Declared AFTER the auth guard effect so that
  // the guard's router.replace("/(tabs)") fires first — our push lands on top
  // of a correctly-initialised tab stack.
  useEffect(() => {
    if (!coldStartLoaded) return;
    if (!isLoaded || !userLoaded || !localFlagLoaded) return;
    if (!isSignedIn) return;
    const meta = getAppMeta(user);
    const hasUsername = !!(meta.username || user?.username);
    if (!hasUsername) return;
    if (_coldStartCheckinHandled) return;

    const response = coldStartResponseRef.current;
    if (!response) {
      // No cold-start response — nothing to do; mark handled so future
      // re-renders do not re-enter this branch unnecessarily.
      _coldStartCheckinHandled = true;
      return;
    }

    const data = response.notification.request.content.data as {
      checkin?: boolean;
      cookId?: number;
      phaseKey?: string;
      phaseLabel?: string;
      scheduledAt?: number;
    } | undefined;

    if (
      data?.checkin !== true ||
      typeof data.cookId !== "number" ||
      typeof data.phaseKey !== "string" ||
      typeof data.scheduledAt !== "number"
    ) {
      // Not a check-in notification (e.g. spritz/mop/fuel) — ignore.
      _coldStartCheckinHandled = true;
      return;
    }

    // Mark handled before async work so a concurrent re-render cannot
    // race through this block a second time.
    _coldStartCheckinHandled = true;
    coldStartResponseRef.current = null;

    const { cookId, phaseKey, phaseLabel, scheduledAt } = data;

    // Validate the target cook before navigating. If the cook is gone or
    // already completed, route home gracefully rather than opening a broken
    // cook detail screen.
    customFetch<{ status: string }>(`/api/cooks/${cookId}`)
      .then((cook) => {
        if (!cook || cook.status !== "active") {
          // Cook not found or no longer active — stay on home tabs.
          router.replace("/(tabs)");
          return;
        }
        setPendingCheckin({
          cookId,
          phaseKey,
          phaseLabel: phaseLabel ?? phaseKey,
          scheduledAt,
        });
        router.push({ pathname: "/cooks/[id]", params: { id: String(cookId) } });
      })
      .catch(() => {
        // Network error or 404 — route home gracefully.
        router.replace("/(tabs)");
      });
  }, [coldStartLoaded, isLoaded, isSignedIn, userLoaded, localFlagLoaded, user?.username, user?.unsafeMetadata, router]);

  // Global auth gate: keep signed-in users out of /(auth) and signed-out users out of /(tabs).
  // Gate order (checked in priority order):
  //   1. Not signed in                                   → sign-in
  //   2. Signed in, no username                          → set-username
  //   3. Signed in, has username, no onboarding flag,
  //      account created after feature launch date       → onboarding
  //   4. Otherwise                                       → tabs (or stay put)
  //
  // The account-creation date check ensures existing users who update the app
  // are never redirected to onboarding — only new sign-ups see the flow.
  useEffect(() => {
    if (!isLoaded || !userLoaded || !localFlagLoaded) return;
    const inAuthGroup = segments[0] === "(auth)";
    const onSetUsername = segments[1] === "set-username";
    const inOnboarding = (segments[0] as string) === "(onboarding)";

    const meta = getAppMeta(user);
    const hasUsername = !!(meta.username || user?.username);
    const hasSeenOnboarding = ONBOARDING_ALWAYS_SHOW
      ? _sessionOnboardingDone
      : !!meta.hasSeenOnboarding || localOnboardingSeen;
    // Only show onboarding to accounts created on/after the feature launch date.
    // In beta mode this is bypassed so all accounts see the tutorial every launch.
    const createdMs = user?.createdAt?.getTime() ?? 0;
    const isNewAccount = ONBOARDING_ALWAYS_SHOW
      ? true
      : createdMs >= ONBOARDING_FEATURE_LAUNCH_MS;

    if (!isSignedIn && (onSetUsername || !inAuthGroup)) {
      router.replace("/(auth)/sign-in");
    } else if (isSignedIn && inAuthGroup && !onSetUsername) {
      // Arrived from sign-in / sign-up screen
      if (!hasUsername) {
        router.replace("/(auth)/set-username");
      } else if (!hasSeenOnboarding && isNewAccount) {
        router.replace(ONBOARDING_HREF);
      } else {
        router.replace("/(tabs)");
      }
    } else if (isSignedIn && onSetUsername && hasUsername) {
      // Just completed set-username
      if (!hasSeenOnboarding && isNewAccount) {
        router.replace(ONBOARDING_HREF);
      } else {
        router.replace("/(tabs)");
      }
    } else if (isSignedIn && !inAuthGroup && !inOnboarding && !hasUsername) {
      router.replace("/(auth)/set-username");
    } else if (isSignedIn && !inAuthGroup && !inOnboarding && hasUsername && !hasSeenOnboarding && isNewAccount) {
      // Catch-all: new user whose sign-in screen navigated directly to /(tabs)
      // before the guard's inAuthGroup branch could fire (e.g. SSO flows).
      // Existing users (accounts older than ONBOARDING_FEATURE_LAUNCH_MS) are
      // exempt, so they are never interrupted when they update the app.
      router.replace(ONBOARDING_HREF);
    }
  }, [isSignedIn, isLoaded, userLoaded, localFlagLoaded, user?.username,
      user?.unsafeMetadata, user?.createdAt, segments, router, localOnboardingSeen]);

  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  // Global notification listeners — route check-in taps to the correct cook detail screen
  useEffect(() => {
    if (Platform.OS === "web") return;

    // Fired when a notification is received while the app is in the foreground
    const receivedSub = Notifications.addNotificationReceivedListener((_notification) => {
      // No foreground action required after alert removal
    });

    // Fired when the user taps a notification from the background or lock screen
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        checkin?: boolean;
        cookId?: number;
        phaseKey?: string;
        phaseLabel?: string;
        scheduledAt?: number;
      } | undefined;

      // Route check-in notification taps to the correct cook detail screen.
      // useCheckinDeepLink in [id].tsx handles the foreground case (user already
      // on that cook's screen with a matching cookId). This handler covers taps
      // from the background, lock screen, or any other screen.
      if (
        data?.checkin &&
        typeof data.cookId === "number" &&
        typeof data.phaseKey === "string" &&
        typeof data.scheduledAt === "number"
      ) {
        const alreadyOnCook =
          isCookDetailVisible() && getCurrentCookId() === data.cookId;
        if (!alreadyOnCook) {
          setPendingCheckin({
            cookId: data.cookId,
            phaseKey: data.phaseKey,
            phaseLabel: data.phaseLabel ?? data.phaseKey,
            scheduledAt: data.scheduledAt,
          });
          router.push({ pathname: "/cooks/[id]", params: { id: String(data.cookId) } });
        }
        // else: useCheckinDeepLink listener in [id].tsx handles it directly
      }
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
        <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
        <Stack.Screen name="(auth)/sign-in" />
        <Stack.Screen name="(auth)/sign-up" />
        <Stack.Screen name="(auth)/set-username" options={{ gestureEnabled: false }} />
        <Stack.Screen name="grills" />
        <Stack.Screen name="grills/[id]" />
        <Stack.Screen name="temperature" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="alerts" />
        <Stack.Screen name="cooks/[id]" />
        <Stack.Screen name="sessions/[sessionId]" />
        <Stack.Screen name="pro-features" />
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
      <SessionExpiredGuard />
      <SubscriptionProvider>
        <PaywallProvider>
          <BleProbeProvider>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <RootLayoutNav />
            </GestureHandlerRootView>
          </BleProbeProvider>
        </PaywallProvider>
      </SubscriptionProvider>
    </IsolatedQueryProvider>
  );
}

function IsolatedQueryProvider({ children }: { children: React.ReactNode }) {
  // Fresh QueryClient per mount (per Clerk userId) — guaranteed clean
  // in-memory cache. No persister is attached: nothing is written to disk,
  // so no leakage path between accounts exists.
  //
  // retry: never retry a 401 — the token is gone and retrying just floods the
  // server. Everything else retries up to 2 times (RQ default is 3).
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: (failureCount, error: unknown) => {
              if ((error as any)?.status === 401) return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: (failureCount, error: unknown) => {
              if ((error as any)?.status === 401) return false;
              return failureCount < 1;
            },
          },
        },
      }),
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// Watches for 401 responses across ALL react-query queries and mutations in the
// current QueryClient. When one fires it means Clerk's session token has expired
// or been revoked. We sign the user out immediately so they land on the sign-in
// screen with a clear message rather than experiencing a broken half-loaded app.
//
// Must be rendered inside both ClerkProvider and IsolatedQueryProvider so it
// has access to both useAuth() and useQueryClient().
function SessionExpiredGuard() {
  const { signOut, isSignedIn } = useAuth();
  const client = useQueryClientInner();
  useEffect(() => {
    if (!isSignedIn) return;
    let signedOut = false;
    const handle401 = (err: unknown) => {
      if (signedOut) return;
      // Only sign out for genuine Clerk session expiries — the auth middleware
      // always returns { error: "Unauthorized" } when the token is missing or
      // revoked. Third-party credential failures (MEATER/ThermoWorks wrong
      // password) also return 401 but with a different error body, and must
      // NOT trigger a sign-out.
      if (
        (err as any)?.status === 401 &&
        (err as any)?.data?.error === "Unauthorized"
      ) {
        signedOut = true;
        client.clear();
        void signOut().catch(() => {});
      }
    };
    const unsubQ = client.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "error") {
        handle401(event.action.error);
      }
    });
    const unsubM = client.getMutationCache().subscribe((event) => {
      if (event.type === "updated" && event.mutation?.state.status === "error") {
        handle401(event.mutation.state.error);
      }
    });
    return () => { unsubQ(); unsubM(); };
  }, [client, isSignedIn, signOut]);
  return null;
}
