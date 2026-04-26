import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useSubscription } from "@/contexts/SubscriptionContext";

export interface HomeInsights {
  pitMasterScore: number;
  scoreLabel: string;
  scoreBreakdown: {
    avgRating: number | null;
    planAccuracy: number | null;
    aiAssessmentScore: number | null;
    cookCount: number;
  };
  tips: string[];
  tipsGeneratedAt: string;
}

/**
 * Fetches AI Home Insights — a Pro-only feature.
 *
 * Free users: the query stays disabled so we never spend an OpenAI call on a
 * user who can't see the result. The home screen renders a locked upgrade
 * card instead of the score widget.
 *
 * Pro users: we attach `X-Subscription-Active: true` so the server bypasses
 * its paywall guard. (This hook uses raw `fetch`, not the orval-generated
 * customFetch, so the header has to be attached here explicitly.)
 */
export function useHomeInsights(enabled = true) {
  const { getToken } = useAuth();
  const { isPro } = useSubscription();

  const baseUrl =
    typeof process !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";

  return useQuery<HomeInsights>({
    queryKey: ["home", "insights", isPro],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (isPro) headers["X-Subscription-Active"] = "true";
      const res = await fetch(`${baseUrl}/api/ai/home-insights`, { headers });
      if (!res.ok) throw new Error("Failed to fetch home insights");
      return res.json() as Promise<HomeInsights>;
    },
    enabled: enabled && isPro,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
