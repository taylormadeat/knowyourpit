export const CACHE_STORAGE_KEY = "kyp_query_cache";

/**
 * Storage key prefix for the v2 per-user query-cache persistence introduced
 * to eliminate cold-open spinners.  Uses a different prefix so the legacy
 * `purgeLegacyQueryCaches` boot routine (which wipes `kyp_query_cache` and
 * `kyp_query_cache:*`) never touches these entries.
 *
 * Full key per user: `kyp_rq_v2:<userId>` (or `kyp_rq_v2:anon`).
 *
 * Bump PERSIST_CACHE_BUSTER whenever the API response shape changes in a
 * backwards-incompatible way — old cached data will be discarded on next boot.
 */
export const PERSIST_CACHE_KEY_V2 = "kyp_rq_v2";
export const PERSIST_CACHE_BUSTER = "v1";
