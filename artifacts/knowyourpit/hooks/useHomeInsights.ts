import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";

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

// Runs for all identified users. Score computation is free; AI tips are Pro-only
// (the server skips the OpenAI call for free users and returns tips: []).
export function useHomeInsights(enabled = true) {
  const { getToken } = useAuth();
  const { isPro, isIdentityLinked } = useSubscription();
  const effectivePro = useEffectivePro();

  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  return useQuery<HomeInsights>({
    queryKey: ["home", "insights", effectivePro, isPro],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (isPro) headers["X-Subscription-Active"] = "true";
      const res = await fetch(`${baseUrl}/api/ai/home-insights`, { headers });
      if (!res.ok) throw new Error("Failed to fetch home insights");
      return res.json() as Promise<HomeInsights>;
    },
    enabled: enabled && !!isIdentityLinked,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
