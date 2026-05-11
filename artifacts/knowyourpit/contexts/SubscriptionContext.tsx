import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useAuth } from "@clerk/expo";
import { setSubscriptionActiveGetter, customFetch } from "@workspace/api-client-react";
import * as SecureStore from "expo-secure-store";

interface IOSIntroductoryDiscount {
  identifier?: string;
  type?: string;
  paymentMode?: string;
  price?: number;
  priceString?: string;
  period?: string;
  periodUnit?: string;
  periodNumberOfUnits?: number;
}

interface AndroidBillingPeriod {
  unit?: string;
  value?: number;
  iso8601?: string;
}

interface AndroidOfferPhase {
  billingPeriod?: AndroidBillingPeriod;
  offerPaymentMode?: string | null;
}

interface AndroidSubscriptionOption {
  id?: string;
  offerPhases?: AndroidOfferPhase[];
}

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
    introductoryDiscount?: IOSIntroductoryDiscount | null;
    subscriptionOptions?: AndroidSubscriptionOption[] | null;
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
  /**
   * True once the userId-linked RC check has completed (or immediately when
   * there is no signed-in user). Use this — not isReady — to decide whether
   * to show the paywall blur. isReady becomes true after the anonymous Phase-1
   * check, which can briefly return isPro=false even for Pro users because RC
   * hasn't yet been aliased to their Clerk userId. isIdentityLinked only
   * becomes true after the Phase-2 logIn+refresh cycle, so the Pro state is
   * authoritative.
   */
  isIdentityLinked: boolean;
  /** True while a purchase or restore is in flight. */
  isLoading: boolean;
  /** True when the user has the `pro` entitlement (monthly OR annual). */
  isPro: boolean;
  /**
   * True when the active Pro entitlement is in its free-trial / introductory
   * phase (RevenueCat `periodType === "TRIAL"` or `"INTRO"`). Drives the
   * "Pro trial active — N days remaining" home-screen banner.
   */
  isInTrial: boolean;
  /** When the active subscription expires, or null when not subscribed. */
  expirationDate: Date | null;
  /** RevenueCat current offering (Monthly + Annual packages). null if RC is unavailable. */
  currentOffering: OfferingLike | null;
  /**
   * Whether the current user is eligible for the annual plan's introductory
   * free trial.
   * - true  → confirmed eligible (iOS checkTrialOrIntroductoryPriceEligibility)
   * - false → confirmed ineligible
   * - null  → check failed / SDK unavailable (fall back to product metadata)
   * On Android this always remains null; RevenueCat already strips ineligible
   * offer phases from subscriptionOptions, so metadata is reliable.
   */
  isAnnualTrialEligible: boolean | null;
  /**
   * True once the iOS trial eligibility check has completed (success or error).
   * Use together with isAnnualTrialEligible to distinguish "pending" from
   * "check failed" on iOS. Always true on Android (no async check needed).
   */
  isAnnualTrialCheckComplete: boolean;
  /** Last error message from a purchase / restore call, or null. */
  lastError: string | null;
  /** Whether RevenueCat is actually loaded (false in dev builds without the SDK). */
  isRevenueCatAvailable: boolean;
  /**
   * True when Phase 1 completed (or timed out) with no offerings loaded —
   * either because the safety timer fired before RC responded, or because
   * getOfferings() returned no current offering. Resets to false when
   * retryOfferings() succeeds. Use this to distinguish "timed out / failed"
   * from "still loading" in the paywall UI.
   */
  offeringsLoadFailed: boolean;
  /**
   * Why offerings failed to load. Use this to show a specific error message
   * in the paywall instead of a generic one.
   * - "timeout"     → safety timer fired before RC responded
   * - "error"       → RC/StoreKit threw a catchable exception (see lastError)
   * - "no_products" → getOfferings() succeeded but returned no packages
   * - null          → no failure; offerings loaded OK (or not yet attempted)
   */
  offeringsFailureReason: "timeout" | "error" | "no_products" | null;
  /** Trigger an in-app purchase for a specific package. */
  purchasePackage: (pkg: PurchasePackageLike) => Promise<{ success: boolean; cancelled: boolean }>;
  /** Restore previous purchases (App Store / Play Store flow). */
  restorePurchases: () => Promise<{ success: boolean; error?: string | null }>;
  /** Re-poll RevenueCat for fresh customerInfo (used after grant scripts run). */
  refresh: () => Promise<void>;
  /**
   * Re-fetch offerings from RevenueCat. Call this when the paywall shows a
   * "couldn't load" state (e.g. after a 12-second timeout on iPadOS) so the
   * user can retry without restarting the app.
   */
  retryOfferings: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue | null>(null);

const PRO_ENTITLEMENT_ID = "pro";
const PRO_CACHE_KEY = "kyp_is_pro_v1";

function getEligibleStatus(): number {
  try {
    const mod = require("react-native-purchases");
    const sdkMod = mod?.default ?? mod;
    const fromSdk = sdkMod?.IntroEligibilityStatus?.INTRO_ELIGIBILITY_STATUS_ELIGIBLE;
    if (typeof fromSdk === "number") return fromSdk;
  } catch {}
  return 2;
}

const INTRO_ELIGIBILITY_STATUS_ELIGIBLE = getEligibleStatus();

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

/**
 * True when the active Pro entitlement is currently in its free-trial or
 * introductory phase. RevenueCat sets `periodType` to "TRIAL" / "INTRO" /
 * "NORMAL" on every active entitlement; we treat the first two as "trial"
 * for UX purposes (banner copy, "Cancel before X" messaging, etc).
 */
function readIsInTrial(customerInfo: any): boolean {
  const ent = customerInfo?.entitlements?.active?.[PRO_ENTITLEMENT_ID];
  const period = (ent?.periodType ?? "").toString().toUpperCase();
  return period === "TRIAL" || period === "INTRO";
}

/** Read cached Pro status synchronously on launch. Returns false if no cache. */
function readCachedIsPro(): boolean {
  try {
    const val = SecureStore.getItem(PRO_CACHE_KEY);
    return val === "1";
  } catch {
    return false;
  }
}

/** Persist Pro status so next launch starts with the correct optimistic value. */
async function writeCachedIsPro(value: boolean): Promise<void> {
  try {
    if (value) {
      await SecureStore.setItemAsync(PRO_CACHE_KEY, "1");
    } else {
      await SecureStore.deleteItemAsync(PRO_CACHE_KEY);
    }
  } catch {
    // Non-fatal — RC will re-establish correct state on next launch.
  }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { userId, isLoaded: clerkLoaded } = useAuth();

  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Seed isPro from SecureStore so returning Pro users never see the paywall flash.
  const [isPro, setIsPro] = useState(() => readCachedIsPro());

  // isIdentityLinked: true once the userId-aliased RC check is done (Phase 2).
  // Starts true when there's no userId (guest/logged-out = no linking needed).
  const [isIdentityLinked, setIsIdentityLinked] = useState(() => !userId);

  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [isInTrial, setIsInTrial] = useState<boolean>(false);
  const [currentOffering, setCurrentOffering] = useState<OfferingLike | null>(null);
  const [offeringsLoadFailed, setOfferingsLoadFailed] = useState(false);
  const [offeringsFailureReason, setOfferingsFailureReason] = useState<"timeout" | "error" | "no_products" | null>(null);
  const [isAnnualTrialEligible, setIsAnnualTrialEligible] = useState<boolean | null>(null);
  const [isAnnualTrialCheckComplete, setIsAnnualTrialCheckComplete] = useState<boolean>(
    Platform.OS !== "ios",
  );
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

  /**
   * Update isPro and persist the new value to SecureStore so the next launch
   * starts with the correct optimistic state (eliminates the paywall flash).
   */
  const updateIsPro = useCallback((value: boolean) => {
    setIsPro(value);
    writeCachedIsPro(value).catch(() => {});
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
      updateIsPro(entitlementsHavePro(info));
      setExpirationDate(readExpiration(info));
      setIsInTrial(readIsInTrial(info));
    } catch {
      // Keep previous state on transient failure.
    }
  }, [updateIsPro]);

  const retryOfferings = useCallback(async () => {
    const purchases = purchasesRef.current;
    if (!purchases) return;
    // RC is already configured from Phase 1 — we only need to re-fetch offerings.
    // A full re-configure is not needed and would risk duplicate SDK init.
    try {
      const offerings = await purchases.getOfferings();
      const current = offerings?.current;
      if (current) {
        const monthly = current.monthly ?? null;
        const annual = current.annual ?? null;
        setCurrentOffering({
          identifier: current.identifier,
          serverDescription: current.serverDescription,
          availablePackages: current.availablePackages ?? [],
          monthly,
          annual,
        });
        if (!monthly && !annual) {
          setOfferingsLoadFailed(true);
          setOfferingsFailureReason("no_products");
        } else {
          // Packages loaded — clear stale error text and failure flags.
          setOfferingsLoadFailed(false);
          setOfferingsFailureReason(null);
          setLastError(null);
        }
      } else {
        // getOfferings() returned no current offering without throwing —
        // keep failure flag set and update the reason so diagnostics are accurate.
        setOfferingsLoadFailed(true);
        setOfferingsFailureReason("no_products");
      }
    } catch (e: any) {
      // Non-fatal — keep failure flags set so the retry countdown restarts.
      setLastError(`retry: ${e?.message ?? e}`);
      setOfferingsLoadFailed(true);
      setOfferingsFailureReason("error");
    }
  }, []);

  // Initial RC configure + first customerInfo + offerings fetch (Phase 1).
  //
  // We DO NOT gate this on `clerkLoaded`. RevenueCat can be configured
  // anonymously (appUserID=null) and re-aliased to a Clerk userId later via
  // `purchases.logIn(userId)` (see the second effect below). Gating on
  // clerkLoaded means that when the user falls through to guest mode via
  // the boot escape hatch — Clerk's isLoaded is still false at that point —
  // the paywall would be stuck on "Loading subscription options…" forever.
  //
  // Phase 1 result is NOT used to downgrade isPro when a userId is present:
  // the anonymous RC user won't have the Pro entitlement, so we preserve the
  // cached value and wait for Phase 2 (logIn+refresh) for the authoritative check.
  useEffect(() => {
    let cancelled = false;
    const purchases = loadPurchases();

    if (!purchases) {
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      // No RC = no linking needed; mark identity as linked immediately.
      if (!cancelled) setIsIdentityLinked(true);
      return () => {
        cancelled = true;
      };
    }

    const apiKey = Platform.OS === "ios" ? IOS_API_KEY : ANDROID_API_KEY;

    if (!apiKey) {
      setIsRevenueCatAvailable(false);
      setIsReady(true);
      if (!cancelled) setIsIdentityLinked(true);
      return () => {
        cancelled = true;
      };
    }

    purchasesRef.current = purchases;
    setIsRevenueCatAvailable(true);
    setIsAnnualTrialEligible(null);
    if (Platform.OS === "ios") setIsAnnualTrialCheckComplete(false);

    let listener: ((info: any) => void) | null = null;

    // Safety timer: if RC's network calls haven't resolved within 25 seconds
    // (StoreKit can stall in sandbox / on iPadOS beta), force isReady=true
    // and flag offeringsLoadFailed=true so the paywall shows a retry button
    // instead of spinning forever.
    const safetyTimer = setTimeout(() => {
      if (!cancelled) {
        setOfferingsLoadFailed(true);
        setOfferingsFailureReason("timeout");
        setIsReady(true);
      }
    }, 25000);

    (async () => {
      try {
        if (typeof purchases.configure === "function") {
          purchases.configure({ apiKey, appUserID: userId ?? null });
        }

        let silentOfferingsError: string | null = null;
        const [info, offerings] = await Promise.all([
          purchases.getCustomerInfo().catch((e: any) => {
            if (!cancelled) setLastError(`customerInfo: ${e?.message ?? e}`);
            return null;
          }),
          purchases.getOfferings().catch((e: any) => {
            silentOfferingsError = e?.message ?? String(e);
            if (!cancelled) setLastError(`getOfferings: ${silentOfferingsError}`);
            return null;
          }),
        ]);

        if (cancelled) return;

        if (info) {
          const proFromPhase1 = entitlementsHavePro(info);
          // Phase 1 is authoritative only when there's no userId to link later.
          // If a userId is present, Phase 2 will do the definitive check — we
          // only apply Phase 1's result if it returns true (early Pro confirm)
          // to avoid briefly flashing the paywall for Pro users mid-login.
          if (proFromPhase1 || !userId) {
            updateIsPro(proFromPhase1);
            setExpirationDate(readExpiration(info));
            setIsInTrial(readIsInTrial(info));
          }
        }

        const current = offerings?.current;
        if (current) {
          const monthly = current.monthly ?? null;
          const annual = current.annual ?? null;
          if (!monthly && !annual) {
            // Offering returned but StoreKit provided no products — flag as failure
            // so the paywall error screen and retry countdown are shown.
            setOfferingsLoadFailed(true);
            setOfferingsFailureReason("no_products");
          } else {
            // Real packages arrived — clear any stale failure and prior error text.
            setOfferingsLoadFailed(false);
            setOfferingsFailureReason(null);
            setLastError(null);
          }
          setCurrentOffering({
            identifier: current.identifier,
            serverDescription: current.serverDescription,
            availablePackages: current.availablePackages ?? [],
            monthly,
            annual,
          });

          if (Platform.OS === "ios" && current.annual) {
            const annualProductId: string = current.annual.product.identifier;
            try {
              if (typeof purchases.checkTrialOrIntroductoryPriceEligibility === "function") {
                const eligibility = await purchases.checkTrialOrIntroductoryPriceEligibility([annualProductId]);
                if (!cancelled) {
                  const status: number = eligibility?.[annualProductId]?.status ?? -1;
                  setIsAnnualTrialEligible(status === INTRO_ELIGIBILITY_STATUS_ELIGIBLE);
                }
              }
            } catch {
              // Non-fatal: isAnnualTrialEligible stays null → paywall falls
              // back to product metadata for trial display.
            } finally {
              if (!cancelled) setIsAnnualTrialCheckComplete(true);
            }
          } else if (Platform.OS === "ios") {
            if (!cancelled) setIsAnnualTrialCheckComplete(true);
          }
        } else {
          // getOfferings() either threw silently (silentOfferingsError set) or
          // returned no current offering — mark as failed so the paywall shows retry.
          if (!cancelled) {
            setOfferingsLoadFailed(true);
            setOfferingsFailureReason(silentOfferingsError ? "error" : "no_products");
          }
        }

        if (typeof purchases.addCustomerInfoUpdateListener === "function") {
          listener = (info: any) => {
            if (cancelled) return;
            updateIsPro(entitlementsHavePro(info));
            setExpirationDate(readExpiration(info));
            setIsInTrial(readIsInTrial(info));
          };
          purchases.addCustomerInfoUpdateListener(listener);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLastError(err?.message ?? "Failed to initialize subscriptions.");
          // Mark offerings as failed so the paywall shows a retry button rather
          // than an ambiguous empty state.
          setOfferingsLoadFailed(true);
          setOfferingsFailureReason("error");
        }
      } finally {
        clearTimeout(safetyTimer);
        if (!cancelled) setIsReady(true);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
      if (listener && typeof purchases.removeCustomerInfoUpdateListener === "function") {
        try {
          purchases.removeCustomerInfoUpdateListener(listener);
        } catch {}
      }
    };
  }, [userId, updateIsPro]);

  // Phase 2: alias RC to the Clerk userId and re-fetch authoritative customerInfo.
  // This is the definitive Pro check. Sets isIdentityLinked=true when done so
  // screens can safely show or hide paywall content without a false-positive flash.
  useEffect(() => {
    const purchases = purchasesRef.current;
    if (!purchases) {
      // RC unavailable — mark linked immediately so UI isn't stuck in skeleton.
      setIsIdentityLinked(true);
      return;
    }
    if (!clerkLoaded) return;

    if (!userId) {
      // Signed out — clear cached Pro status and mark as linked (no linking needed).
      writeCachedIsPro(false).catch(() => {});
      setIsIdentityLinked(true);
      return;
    }

    // A userId is present: mark as NOT yet linked while we alias RC and re-fetch.
    setIsIdentityLinked(false);

    (async () => {
      try {
        if (typeof purchases.logIn === "function") {
          await purchases.logIn(userId);
        }
        await refresh();
      } catch {
        // Non-fatal: keep previous state; RC listener will update if entitlements change.
      } finally {
        setIsIdentityLinked(true);
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
        const pro = entitlementsHavePro(info);
        if (info) {
          updateIsPro(pro);
          setExpirationDate(readExpiration(info));
          setIsInTrial(readIsInTrial(info));
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
    [updateIsPro, refreshServerCache],
  );

  const restorePurchases = useCallback(async () => {
    const purchases = purchasesRef.current;
    if (!purchases) {
      const msg = "Subscriptions are not available in this build yet.";
      setLastError(msg);
      return { success: false, error: msg };
    }
    setIsLoading(true);
    setLastError(null);
    try {
      const info = await purchases.restorePurchases();
      const pro = entitlementsHavePro(info);
      updateIsPro(pro);
      setExpirationDate(readExpiration(info));
      setIsInTrial(readIsInTrial(info));
      // Always sync the server cache after a restore attempt so the Postgres
      // entitlement row stays accurate regardless of the outcome (clears stale
      // Pro rows when a subscription has lapsed, or activates Pro for device
      // switches with a missed webhook).
      await refreshServerCache();
      return { success: pro, error: null };
    } catch (err: any) {
      const msg: string = err?.message ?? "Restore failed. Please try again.";
      setLastError(msg);
      return { success: false, error: msg };
    } finally {
      setIsLoading(false);
    }
  }, [updateIsPro, refreshServerCache]);

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      isReady,
      isIdentityLinked,
      isLoading,
      isPro,
      isInTrial,
      expirationDate,
      currentOffering,
      isAnnualTrialEligible,
      isAnnualTrialCheckComplete,
      lastError,
      isRevenueCatAvailable,
      offeringsLoadFailed,
      offeringsFailureReason,
      purchasePackage,
      restorePurchases,
      refresh,
      retryOfferings,
    }),
    [
      isReady,
      isIdentityLinked,
      isLoading,
      isPro,
      isInTrial,
      expirationDate,
      currentOffering,
      isAnnualTrialEligible,
      isAnnualTrialCheckComplete,
      lastError,
      isRevenueCatAvailable,
      offeringsLoadFailed,
      offeringsFailureReason,
      purchasePackage,
      restorePurchases,
      refresh,
      retryOfferings,
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
