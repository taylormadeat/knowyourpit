import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";

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

export function useHomeInsights(enabled = true) {
  const { getToken } = useAuth();

  const baseUrl =
    typeof process !== "undefined" && process.env.EXPO_PUBLIC_DOMAIN
      ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
      : "";

  return useQuery<HomeInsights>({
    queryKey: ["home", "insights"],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/api/ai/home-insights`, { headers });
      if (!res.ok) throw new Error("Failed to fetch home insights");
      return res.json() as Promise<HomeInsights>;
    },
    enabled,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
}
