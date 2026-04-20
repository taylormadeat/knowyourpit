import { useAuth } from "@clerk/expo";
import { useCallback } from "react";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export function useAuthFetch() {
  const { getToken, isSignedIn } = useAuth();

  const authFetch = useCallback(
    async (path: string, options: RequestInit = {}): Promise<any> => {
      let token: string | null = null;
      if (isSignedIn) {
        token = await getToken();
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> | undefined),
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}${path}`, { ...options, headers });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [getToken, isSignedIn],
  );

  return authFetch;
}
