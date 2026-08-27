/**
 * Runtime feature flags.
 *
 * Defaults are read from environment variables on startup so a permanent kill
 * can be done by setting FEATURE_PARTNER_BIG_PETES=false in the environment
 * (takes effect on next deploy restart without a code change).
 *
 * The admin endpoint POST /api/admin/config lets you flip flags at runtime
 * without any restart.
 */

export const ACTIVE_PARTNERS = ["bigPetes", "barbecueLab"] as const;

export type ActivePartner = (typeof ACTIVE_PARTNERS)[number];

export type FeatureFlags = {
  partnerBigPetes: boolean;
  activePartner: ActivePartner | null;
};

function readActivePartner(): ActivePartner | null {
  const value = process.env.FEATURE_ACTIVE_PARTNER;
  if (value === undefined) return "bigPetes";
  return ACTIVE_PARTNERS.includes(value as ActivePartner)
    ? value as ActivePartner
    : null;
}

const activePartner = readActivePartner();

const flags: FeatureFlags = {
  partnerBigPetes:
    activePartner !== null && process.env.FEATURE_PARTNER_BIG_PETES !== "false",
  activePartner,
};

export function getFlags(): Readonly<FeatureFlags> {
  return flags;
}

export function setFlag<K extends keyof FeatureFlags>(
  key: K,
  value: FeatureFlags[K],
): void {
  flags[key] = value;
}
