import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";

export interface DurationPattern {
  actualMinsPerLb: number;
  baselineMinsPerLb: number | null;
  sampleSize: number;
}

export interface SmokerInsights {
  cookCount: number;
  pitBiasF: number | null;
  overshootF: number | null;
  durationByMeat: Record<string, DurationPattern>;
  runLong: boolean | null;
  runShort: boolean | null;
}

export function useSmokerProfile(enabled = true) {
  const { getToken } = useAuth();

  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  return useQuery<SmokerInsights>({
    queryKey: ["smoker", "profile"],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/api/ai/smoker-profile`, { headers });
      if (!res.ok) throw new Error("Failed to fetch smoker profile");
      return res.json() as Promise<SmokerInsights>;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}
