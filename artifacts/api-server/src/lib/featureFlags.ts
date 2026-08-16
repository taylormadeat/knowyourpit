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

export type FeatureFlags = {
  partnerBigPetes: boolean;
};

const flags: FeatureFlags = {
  partnerBigPetes: process.env.FEATURE_PARTNER_BIG_PETES !== "false",
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
