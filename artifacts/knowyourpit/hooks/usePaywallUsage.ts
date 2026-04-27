import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useSubscription } from "@/contexts/SubscriptionContext";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export interface PaywallUsage {
  paywallEnabled: boolean;
  isPro: boolean;
  unlimited: boolean;
  limits: {
    cooks: number;
    aiChatPerDay: number;
    aiAnalyzePerDay: number;
  };
  usage: {
    cooks: number;
    activeCooks: number;
    plannedCooks: number;
    gradedCooks: number;
    aiMessagesToday: number;
    aiAnalyzesToday: number;
  };
  remaining: {
    cooks: number;
    activeCooks: number;
    plannedCooks: number;
    gradedCooks: number;
    aiMessagesToday: number;
    aiAnalyzesToday: number;
  };
  resetsAt: string;
}

/**
 * Fetches the user's free-tier usage counters from the server. The server is
 * authoritative — it reports what's left for cooks (lifetime) and AI chat /
 * analyzes (per UTC day). Use this on screens that show "X of Y remaining"
 * badges. The query is invalidated whenever the user creates a cook, sends a
 * chat message, or runs an AI scan, so counters update without manual refresh.
 *
 * Pro users still get a response (with `unlimited: true`); UI should hide the
 * counter strip when `unlimited` is true.
 */
export function usePaywallUsage(enabled = true) {
  const { isSignedIn, getToken } = useAuth();
  // We can't use the orval-generated client for this endpoint (it lives outside
  // the OpenAPI surface), so we replicate the X-Subscription-Active header here
  // by reading from the SubscriptionContext. Without this, Pro users would be
  // reported as `unlimited:false` and free counters would still apply on the
  // client even though the server bypass works on the actual gates.
  const { isPro } = useSubscription();
  return useQuery<PaywallUsage>({
    queryKey: ["paywall", "usage", isPro],
    enabled: enabled && !!isSignedIn,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const token = await getToken().catch(() => null);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (isPro) headers["X-Subscription-Active"] = "true";
      const res = await fetch(`${API_BASE_URL}/api/paywall/usage`, { headers });
      if (!res.ok) throw new Error(`paywall/usage ${res.status}`);
      return (await res.json()) as PaywallUsage;
    },
  });
}
