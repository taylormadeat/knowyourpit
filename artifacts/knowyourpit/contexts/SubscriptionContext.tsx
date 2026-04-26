import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { setSubscriptionActiveGetter } from "@workspace/api-client-react";

// SubscriptionContext: source of truth for the user's `pro` entitlement.
// Loads react-native-purchases lazily so the JS bundle still works in Expo
// Go (no native module). Identifies users to RevenueCat by Clerk userId so
// grants from `scripts grant-pro` are picked up on the next poll.

interface PurchasePackageLike {
  identifier: string;
  packageType?: string;
  product: {
    identifier: string;
    title?: string;
    description?: string;
    priceString: string;
    price: number;
    currencyCode?: string;
    subscriptionPeriod?: string | null;
  };
}

interface OfferingLike {
  identifier: string;
  serverDescription?: string;
  availablePackages: PurchasePackageLike[];
  monthly?: PurchasePackageLike | null;
  annual?: PurchasePackageLike | null;
}

interface SubscriptionContextValue {
  /** True once we've made at least one attempt to fetch entitlement state. */
  isReady: boolean;
  /** True while a purchase or restore is in flight. */
  isLoading: boolean;
  /** True when the user has the `pro` entitlement (monthly OR annual). */
  isPro: boolean;
  /** When the active subscription expires, or null when not subscribed. */
  expirationDate: Date | null;
  /** RevenueCat current offering (Monthly + Annual packages). null if RC is unavailable. */
  currentOffering: OfferingLike | null;
  /** Last error message from a purchase / restore call, or null. */
  lastError: string | null;
  /** Whether RevenueCat is actually loaded (false in dev builds without the SDK). */
  isRevenueCatAvailable: boolean;
  /** Trigger an in-app purchase for a specific package. */
  purchasePackage: (pkg: PurchasePackageLike) => Promise<{ success: boolean; cancelled: boolean }>;
  /** Restore previous purchases (App Store / Play Store flow). */
  restorePurchases: () => Promise<{ success: boolean }>;
  /** Re-poll RevenueCat for fresh customerInfo (used after grant scripts run). */
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const PRO_ENTITLEMENT_ID = "pro";

const IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";

/**
 * Lazy-load react-native-purchases. Returns null if the module is missing or
 * native code isn't linked. We catch synchronously so the rest of the app
 * keeps working in dev builds that haven't been rebuilt against the new
 * native dependency yet.
 */
function loadPurchases(): any | null {
  if (Platform.OS === "web") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const mod = require("react-native-purchases");
    return mod?.default ?? mod ?? null;
  } catch {
    return null;
  }
}

function entitlementsHavePro(customerInfo: any): boolean {
  const active = customerInfo?.entitlements?.active;
  if (!active) return false;
  return Boolean(active[PRO_ENTITLEMENT_ID]);
}

function readExpiration(customerInfo: any): Date | null {
  const ent = customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  if (!ent?.expirationDate) return null;
  const d = new Date(ent.expirationDate);
  return isNaN(d.getTime()) ? null : d;
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded: clerkLoaded } = useAuth();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPro, setIsPro] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [currentOffering, setCurrentOffering] = useState<OfferingLike | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);

  // Mirror isPro into a ref so the API client's synchronous header getter can
  // read the latest value without going through React state.
  const isProRef = useRef(false);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  // Track RC availability separately so screens can show "subscriptions
  // unavailable" messages in builds that haven't been rebuilt yet.
  const purchasesRef = useRef<any | null>(null);
  const [isRevenueCatAvailable, setIsRevenueCatAvailable] = useState(false);

  // Register the synchronous subscription getter with the API client exactly
  // once. The getter reads the ref, so subsequent isPro changes propagate
  // without re-registering.
  useEffect(() => {
    setSubscriptionActiveGetter(() => isProRef.current);
    return () => {
      setSubscriptionActiveGetter(null);
    };
  }, []);

  const refresh = useCallback(async () => {
    const purchases = purchasesRef.current;
    if (!purchases) return;
    try {
      const info = await purchases.getCustomerInfo();
      setIsPro(entitlementsHavePro(info));
      setExpirationDate(readExpiration(info));
    } catch {
      // Network blip: keep the previous entitlement state rather than
      // accidentally locking the user out mid-cook.
    }
  }, []);

  // Initial RC configure + first customerInfo + offerings fetch.
  useEffect(() => {
    if (!clerkLoaded) return;

    let cancelled = false;
    const purchases = loadPurchases();

    if (!purchases) {
      // No RC SDK available — treat as free tier and report ready so screens
      // don't sit on loading forever.
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;

    if (!apiKey) {
      // Native SDK is present but the API key hasn't been provisioned yet
      // (RevenueCat integration not connected). Treat as free tier and ready.
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    purchasesRef.current = purchases;
    setIsRevenueCatAvailable(true);

    // Hold a reference to the listener we register so we can remove it on
    // cleanup. RC's addCustomerInfoUpdateListener returns nothing, so we have
    // to keep the function identity ourselves and pass it to
    // removeCustomerInfoUpdateListener.
    let listener: ((info: any) => void) | null = null;

    (async () => {
      try {
        // Identify with Clerk userId when available so grant/revoke scripts
        // can target users by their Clerk id.
        if (typeof purchases.configure === "function") {
          purchases.configure({ apiKey, appUserID: userId ?? null });
        }

        const [info, offerings] = await Promise.all([
          purchases.getCustomerInfo().catch(() => null),
          purchases.getOfferings().catch(() => null),
        ]);

        if (cancelled) return;

        if (info) {
          setIsPro(entitlementsHavePro(info));
          setExpirationDate(readExpiration(info));
        }

        const current = offerings?.current;
        if (current) {
          setCurrentOffering({
            identifier: current.identifier,
            serverDescription: current.serverDescription,
            availablePackages: current.availablePackages ?? [],
            monthly: current.monthly ?? null,
            annual: current.annual ?? null,
          });
        }

        // Subscribe to live customerInfo updates so external grants surface
        // without requiring the user to restart the app. The listener is
        // explicitly removed in the effect cleanup below to prevent stacking
        // duplicate callbacks across userId changes.
        if (typeof purchases.addCustomerInfoUpdateListener === "function") {
          listener = (info: any) => {
            if (cancelled) return;
            setIsPro(entitlementsHavePro(info));
            setExpirationDate(readExpiration(info));
          };
          purchases.addCustomerInfoUpdateListener(listener);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLastError(err?.message ?? "Failed to initialize subscriptions.");
        }
      } finally {
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
      // Remove the listener we registered above so re-running the effect
      // (e.g. on userId change or hot-reload) doesn't accumulate callbacks.
      if (listener && typeof purchases.removeCustomerInfoUpdateListener === "function") {
        try {
          purchases.removeCustomerInfoUpdateListener(listener);
        } catch {
          // Best effort — ignore if the SDK has changed shape.
        }
      }
    };
  }, [clerkLoaded, userId]);

  // When Clerk userId changes (sign in/out), re-identify with RC.
  useEffect(() => {
    const purchases = purchasesRef.current;
    if (!purchases) return;
    if (!clerkLoaded) return;

    (async () => {
      try {
        if (userId && typeof purchases.logIn === "function") {
          await purchases.logIn(userId);
        } else if (!userId && typeof purchases.logOut === "function") {
          await purchases.logOut();
        }
        await refresh();
      } catch {
        // Identity transitions are best-effort — never block the app.
      }
    })();
  }, [userId, clerkLoaded, refresh]);

  const purchasePackage = useCallback(
    async (pkg: PurchasePackageLike) => {
      const purchases = purchasesRef.current;
      if (!purchases) {
        setLastError("Subscriptions are not available in this build yet.");
        return { success: false, cancelled: false };
      }
      setIsLoading(true);
      setLastError(null);
      try {
        const result = await purchases.purchasePackage(pkg);
        const info = result?.customerInfo;
        if (info) {
          setIsPro(entitlementsHavePro(info));
          setExpirationDate(readExpiration(info));
        }
        return { success: entitlementsHavePro(info), cancelled: false };
      } catch (err: any) {
        if (err?.userCancelled) {
          return { success: false, cancelled: true };
        }
        setLastError(err?.message ?? "Purchase failed. Please try again.");
        return { success: false, cancelled: false };
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const restorePurchases = useCallback(async () => {
    const purchases = purchasesRef.current;
    if (!purchases) {
      setLastError("Subscriptions are not available in this build yet.");
      return { success: false };
    }
    setIsLoading(true);
    setLastError(null);
    try {
      const info = await purchases.restorePurchases();
      const pro = entitlementsHavePro(info);
      setIsPro(pro);
      setExpirationDate(readExpiration(info));
      return { success: pro };
    } catch (err: any) {
      setLastError(err?.message ?? "Restore failed. Please try again.");
      return { success: false };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isReady,
      isLoading,
      isPro,
      expirationDate,
      currentOffering,
      lastError,
      isRevenueCatAvailable,
      purchasePackage,
      restorePurchases,
      refresh,
    }),
    [
      isReady,
      isLoading,
      isPro,
      expirationDate,
      currentOffering,
      lastError,
      isRevenueCatAvailable,
      purchasePackage,
      restorePurchases,
      refresh,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription(): SubscriptionContextValue {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used inside <SubscriptionProvider>");
  }
  return ctx;
}

export type { PurchasePackageLike, OfferingLike };
