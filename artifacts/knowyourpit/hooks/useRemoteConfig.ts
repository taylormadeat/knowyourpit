import { useEffect, useState } from "react";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export type RemoteConfig = {
  partnerBigPetes: boolean;
};

// Each signed build carries an explicit visibility default:
// - development and preview/TestFlight builds: true
// - production/App Store builds: false
//
// The API response remains the final kill switch. This lets us safely test
// partner content through TestFlight without changing the public app, while
// still allowing the server to turn the feature off across every build.
const buildPartnerDefault = process.env.EXPO_PUBLIC_PARTNER_BIG_PETES;
const buildPartnerEnabled = buildPartnerDefault === "true";

const DEFAULT_CONFIG: RemoteConfig = {
  partnerBigPetes: buildPartnerEnabled,
};

let cached: RemoteConfig | null = null;

export function resolvePartnerVisibility(
  isBuildEnabled: boolean,
  serverConfig: RemoteConfig | null,
): boolean {
  // A build must opt in AND the server must allow the feature. A false server
  // value therefore kills the partner cards in preview, production, and dev
  // builds as soon as the remote config refresh completes.
  return isBuildEnabled && (serverConfig?.partnerBigPetes ?? true);
}

export function resolveRemoteConfig(serverConfig: RemoteConfig | null): RemoteConfig {
  return {
    partnerBigPetes: resolvePartnerVisibility(buildPartnerEnabled, serverConfig),
  };
}

/**
 * Fetches feature flags from the API once per app session (result is
 * module-level cached so every screen gets the same value without extra
 * requests). The build profile establishes initial visibility; the server can
 * subsequently disable the feature for every build as an emergency kill switch.
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
      // Keeps the compiled build default observable in OTA-export validation.
      // The API does not trust or use this public diagnostic value for access.
      headers: { "X-KYP-Partner-Build": buildPartnerDefault ?? "unset" },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: RemoteConfig | null) => {
        if (cancelled || !data) return;
        cached = resolveRemoteConfig(data);
        setConfig(cached);
      })
      .catch(() => {
        // Network failure — retain the build-specific default.
      })
      .finally(() => clearTimeout(timeout));

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

  return config;
}
