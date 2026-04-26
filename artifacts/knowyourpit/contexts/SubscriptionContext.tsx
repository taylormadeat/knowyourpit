import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { setSubscriptionActiveGetter, customFetch } from "@workspace/api-client-react";

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

  const isProRef = useRef(false);
  useEffect(() => {
    isProRef.current = isPro;
  }, [isPro]);

  const purchasesRef = useRef<any | null>(null);
  const [isRevenueCatAvailable, setIsRevenueCatAvailable] = useState(false);

  useEffect(() => {
    setSubscriptionActiveGetter(() => isProRef.current);
    return () => {
      setSubscriptionActiveGetter(null);
    };
  }, []);

  // Tells the API server to drop its negative-cache entry for this user so
  // gated routes see the new Pro state on the very next request.
  const refreshServerCache = useCallback(async () => {
    try {
      await customFetch("/paywall/refresh", { method: "POST" });
    } catch {
      // Server will refresh itself within ~5s anyway.
    }
  }, []);

  const refresh = useCallback(async () => {
    const purchases = purchasesRef.current;
    if (!purchases) return;
    try {
      const info = await purchases.getCustomerInfo();
      setIsPro(entitlementsHavePro(info));
      setExpirationDate(readExpiration(info));
    } catch {
      // Keep previous state on transient failure.
    }
  }, []);

  // Initial RC configure + first customerInfo + offerings fetch.
  useEffect(() => {
    if (!clerkLoaded) return;

    let cancelled = false;
    const purchases = loadPurchases();

    if (!purchases) {
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;

    if (!apiKey) {
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      return () => {
        cancelled = true;
      };
    }

    purchasesRef.current = purchases;
    setIsRevenueCatAvailable(true);

    let listener: ((info: any) => void) | null = null;

    (async () => {
      try {
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
      if (listener && typeof purchases.removeCustomerInfoUpdateListener === "function") {
        try {
          purchases.removeCustomerInfoUpdateListener(listener);
        } catch {}
      }
    };
  }, [clerkLoaded, userId]);

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
      } catch {}
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
        const pro = entitlementsHavePro(info);
        if (info) {
          setIsPro(pro);
          setExpirationDate(readExpiration(info));
        }
        if (pro) await refreshServerCache();
        return { success: pro, cancelled: false };
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
      if (pro) await refreshServerCache();
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
