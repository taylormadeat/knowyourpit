import { useSubscription } from "@/contexts/SubscriptionContext";
import { usePaywallUsage } from "@/hooks/usePaywallUsage";

/**
 * Returns the gate-decision Pro flag the UI should use everywhere it asks
 * "should this feature be unlocked?". It is `true` when either:
 *
 *   - the user actually owns the `pro` entitlement (RevenueCat), OR
 *   - the server-side PAYWALL_ENABLED kill-switch is OFF (in which case the
 *     server bypasses every gate and clients should mirror that).
 *
 * Use `isPro` directly only when you mean "is this user actually paying?"
 * (e.g. the Plan status row, manage-subscription buttons).
 */
export function useEffectivePro(): boolean {
  const { isPro } = useSubscription();
  const { data } = usePaywallUsage();
  if (isPro) return true;
  if (data?.unlimited === true) return true;
  if (data && data.paywallEnabled === false) return true;
  return false;
}
