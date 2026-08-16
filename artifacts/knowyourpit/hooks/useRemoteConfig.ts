import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  "https://3b4-ffskevbkaeymfrj2e-00-api-server.janeway.replit.dev";

export type RemoteConfig = {
  partnerBigPetes: boolean;
};

const DEFAULT_CONFIG: RemoteConfig = {
  // Defaults to false so no partner cards flash visible before the first fetch
  // resolves. The server fetch enables them once confirmed.
  partnerBigPetes: false,
};

let cached: RemoteConfig | null = null;

/**
 * Fetches feature flags from the API once per app session (result is
 * module-level cached so every screen gets the same value without extra
 * requests).  Returns DEFAULT_CONFIG if the server is unreachable.
 */
export function useRemoteConfig(): RemoteConfig {
  const [config, setConfig] = useState<RemoteConfig>(cached ?? DEFAULT_CONFIG);

  useEffect(() => {
    if (cached !== null) {
      setConfig(cached);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    fetch(`${API_BASE_URL}/api/config`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: RemoteConfig | null) => {
        if (cancelled || !data) return;
        cached = { ...DEFAULT_CONFIG, ...data };
        setConfig(cached);
      })
      .catch(() => {
        // Network failure — keep the default. Partnership stays visible.
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return config;
}
