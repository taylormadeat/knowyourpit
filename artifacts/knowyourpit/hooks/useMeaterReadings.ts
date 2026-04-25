import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/expo";

export type MeaterProbe = {
  deviceId: string;
  deviceName: string;
  internalTempF: number | null;
  ambientTempF: number | null;
  targetMinTempF: number | null;
  targetMaxTempF: number | null;
  cookName: string | null;
  cookState: string | null;
};

export type MeaterReadingsResponse = {
  linked: boolean;
  probes: MeaterProbe[];
  tokenExpired?: boolean;
  error?: string;
};

export function useMeaterReadings(enabled = true) {
  const { getToken } = useAuth();

  const baseUrl =
    process.env.EXPO_PUBLIC_API_URL ??
    (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

  return useQuery<MeaterReadingsResponse>({
    queryKey: ["meater", "readings"],
    queryFn: async () => {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${baseUrl}/api/meater/readings`, { headers });
      if (!res.ok) throw new Error("Failed to fetch MEATER readings");
      return res.json() as Promise<MeaterReadingsResponse>;
    },
    refetchInterval: 15000,
    staleTime: 10000,
    enabled,
  });
}
