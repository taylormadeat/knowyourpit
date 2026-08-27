import { useEffect, useState } from "react";
import { isPartnerId, type PartnerId } from "@/components/partners/partnerData";

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : "");

export type RemoteConfig = {
  /** Backward-compatible feature-visibility field retained for existing callers. */
  partnerBigPetes: boolean;
  activePartner: PartnerId | null;
};

type ServerRemoteConfig = {
  partnerBigPetes?: boolean;
  activePartner?: unknown;
};

// Each signed build carries an explicit partner visibility and partner identity:
// - development and preview/TestFlight builds: true
// - production/App Store builds: false
//
// The API response remains the final kill switch. This lets us safely test
// partner content through TestFlight without changing the public app, while
// still allowing the server to turn the feature off across every build.
const buildPartnerDefault = process.env.EXPO_PUBLIC_PARTNER_BIG_PETES;
const buildPartnerId = process.env.EXPO_PUBLIC_ACTIVE_PARTNER === undefined
  ? "bigPetes"
  : isPartnerId(process.env.EXPO_PUBLIC_ACTIVE_PARTNER)
  ? process.env.EXPO_PUBLIC_ACTIVE_PARTNER
  : null;
const buildPartnerEnabled = buildPartnerDefault === "true" && buildPartnerId !== null;

const DEFAULT_CONFIG: RemoteConfig = {
  partnerBigPetes: buildPartnerEnabled,
  activePartner: buildPartnerEnabled ? buildPartnerId : null,
};

let cached: RemoteConfig | null = null;

export function resolvePartnerVisibility(
  isBuildEnabled: boolean,
  serverConfig: ServerRemoteConfig | null,
): boolean {
  // A build must opt in AND the server must allow the feature. A false server
  // value therefore kills the partner cards in preview, production, and dev
  // builds as soon as the remote config refresh completes.
  return isBuildEnabled && (serverConfig?.partnerBigPetes ?? true);
}

export function resolveActivePartner(
  buildPartner: PartnerId | null,
  isBuildEnabled: boolean,
  serverConfig: ServerRemoteConfig | null,
): PartnerId | null {
  if (!resolvePartnerVisibility(isBuildEnabled, serverConfig)) return null;

  const serverPartner = serverConfig?.activePartner;
  if (serverPartner === undefined) return buildPartner;
  return isPartnerId(serverPartner) ? serverPartner : null;
}

export function resolveRemoteConfig(serverConfig: ServerRemoteConfig | null): RemoteConfig {
  const activePartner = resolveActivePartner(
    buildPartnerId,
    buildPartnerEnabled,
    serverConfig,
  );

  return {
    // Kept for compatibility with clients built before activePartner existed.
    partnerBigPetes: activePartner !== null,
    activePartner,
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
      headers: {
        "X-KYP-Partner-Build": buildPartnerDefault ?? "unset",
        "X-KYP-Active-Partner-Build": buildPartnerId ?? "invalid",
      },
    })
      .then(r => (r.ok ? r.json() : null))
      .then((data: ServerRemoteConfig | null) => {
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
