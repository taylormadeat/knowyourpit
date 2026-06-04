import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { useEffectivePro } from "@/hooks/useEffectivePro";

export interface HomeInsights {
  pitMasterScore: number;
  scoreLabel: string;
  scoreBreakdown: {
    avgRating: number | null;
    avgHealthScore: number | null;
    cookCount: number;
  };
  unratedCount: number;
}

// Score endpoint — pure DB math, responds instantly.
// Runs for all identified users regardless of Pro status.
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
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}

// Tips endpoint — AI call, only fired when the user opens the tips panel.
// `enabled` is controlled by the caller (tipsExpanded && effectivePro && hasCooks).
export function useHomeTips(enabled: boolean) {
  const { getToken } = useAuth();
  const { isPro } = useSubscription();

  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  return useQuery<{ tips: string[] }>({
    queryKey: ["home", "insights", "tips"],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      if (isPro) headers["X-Subscription-Active"] = "true";
      const res = await fetch(`${baseUrl}/api/ai/home-insights/tips`, { headers });
      if (!res.ok) throw new Error("Failed to fetch tips");
      return res.json() as Promise<{ tips: string[] }>;
    },
    enabled,
    staleTime: 4 * 60 * 60 * 1000,
    gcTime: 4 * 60 * 60 * 1000,
  });
}
