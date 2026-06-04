import type { Request, Response } from "express";
import { and, eq, gte, ne, sql } from "drizzle-orm";
import {
  db,
  cooksTable,
  conversations,
  messages,
  aiAnalyzeEvents,
  frozenTimelineEvents,
  subscriptionEntitlements,
} from "@workspace/db";
import { listCustomerActiveEntitlements, listEntitlements } from "@replit/revenuecat-sdk";
import { asListItems, getRevenueCatClient } from "./revenuecat";
import { logger } from "./logger";

// Free-tier counters + server-side Pro entitlement check via RevenueCat.
// Kill-switch: PAYWALL_ENABLED=false bypasses every gate.

export const FREE_COOK_LIMIT = 3;
// Wave 2 (#329): tightened from 5→3 to cut the largest variable AI cost ~40%
// while still leaving enough headroom for a meaningful conversation per day.
export const FREE_AI_CHAT_DAILY_LIMIT = 3;
// Pro users still get a generous daily cap (20 messages) to bound AI costs
// without meaningfully impacting normal BBQ-session use.
export const PRO_AI_CHAT_DAILY_LIMIT = 20;
// Wave 2 (#329): tightened from 3→1. Free users realistically don't photograph
// three cook situations per day; the prior cap was mostly mathematical.
export const FREE_AI_ANALYZE_DAILY_LIMIT = 1;
// Wave 2 (#329): Frozen-to-Table is now a 1-lifetime free trial instead of a
// pure Pro-gate. Free users get to plan one frozen cook end-to-end so they
// can experience the value before being asked to upgrade.
export const FREE_FROZEN_TIMELINE_LIFETIME_LIMIT = 1;

export type PaywallReason =
  | "cook_limit_reached"
  | "active_cook_limit_reached"
  | "planned_cook_limit_reached"
  | "ai_message_limit_reached"
  | "ai_analyze_limit_reached"
  | "frozen_timeline_limit_reached"
  | "pro_required";

export function isPaywallEnabled(): boolean {
  const v = process.env.PAYWALL_ENABLED;
  if (v == null) return true;
  const lower = String(v).trim().toLowerCase();
  return !(lower === "false" || lower === "0" || lower === "off" || lower === "no");
}

// Short-lived in-process cache used only to deduplicate burst requests within
// the same server instance. The Postgres table is the authoritative source.
const MEM_CACHE_TTL_MS = 10_000;

// If a Postgres row has isPro=false and has not been updated within this window,
// re-poll the live RC API in case a webhook was missed (e.g. user just purchased).
const PG_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
const proMemCache = new Map<string, { isPro: boolean; expiresAt: number }>();

const PRO_ENTITLEMENT_LOOKUP_KEY = "pro";

// RC v2 active-entitlement items echo entitlement_id (not lookup_key), so
// resolve our "pro" lookup_key to a project entitlement id once.
let proEntitlementIdCache: string | null = null;

async function resolveProEntitlementId(projectId: string): Promise<string | null> {
  if (proEntitlementIdCache) return proEntitlementIdCache;
  const client = await getRevenueCatClient();
  const list = await listEntitlements({ client, path: { project_id: projectId } });
  if (list.error) {
    logger.error({ err: list.error }, "RevenueCat listEntitlements failed");
    return null;
  }
  const match = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (e) => e.lookup_key === PRO_ENTITLEMENT_LOOKUP_KEY,
  );
  if (!match) {
    logger.error(
      { lookupKey: PRO_ENTITLEMENT_LOOKUP_KEY, projectId },
      "RevenueCat Pro entitlement not found in project",
    );
    return null;
  }
  proEntitlementIdCache = match.id;
  return match.id;
}

interface ActiveEntitlement {
  entitlement_id?: string;
  expires_at?: number | null;
}

async function fetchUserHasProFromRevenueCat(userId: string): Promise<boolean> {
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) return false;
  const proEntitlementId = await resolveProEntitlementId(projectId);
  if (!proEntitlementId) return false;
  const client = await getRevenueCatClient();
  const result = await listCustomerActiveEntitlements({
    client,
    path: { project_id: projectId, customer_id: userId },
  });
  if (result.error) {
    const status = (result.response as { status?: number } | undefined)?.status;
    if (status === 404) return false;
    logger.error({ err: result.error, userId }, "RevenueCat listCustomerActiveEntitlements failed");
    return false;
  }
  const items = asListItems<ActiveEntitlement>(result.data);
  const now = Date.now();
  return items.some((ent) => {
    if (ent.entitlement_id !== proEntitlementId) return false;
    if (ent.expires_at == null) return true;
    return ent.expires_at > now;
  });
}

/**
 * Upsert an entitlement row into Postgres. Called by the webhook handler and
 * also by the fallback RC API poll so every access path keeps the cache warm.
 *
 * Two write modes:
 *
 * **Webhook write** (`eventAtMs` is a number):
 *   - Only applies if the stored `lastEventAtMs` is older (monotonicity guard).
 *   - Updates all fields including `lastEventAtMs` and `expiresAt`.
 *
 * **Poll write** (`eventAtMs` is null/undefined):
 *   - Updates `isPro`, `lastEventType`, and `updatedAt` only.
 *   - Preserves existing `lastEventAtMs` and `expiresAt` so that previously
 *     delivered webhook ordering state is never erased by a poll.
 */
export async function upsertEntitlementCache(
  userId: string,
  isPro: boolean,
  eventType: string,
  expiresAt?: Date | null,
  eventAtMs?: number | null,
): Promise<void> {
  const now = new Date();

  if (eventAtMs != null) {
    // Webhook write: full update, guarded by monotonicity.
    await db
      .insert(subscriptionEntitlements)
      .values({
        userId,
        isPro,
        expiresAt: expiresAt ?? null,
        lastEventType: eventType,
        lastEventAtMs: eventAtMs,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subscriptionEntitlements.userId,
        set: {
          isPro,
          expiresAt: expiresAt ?? null,
          lastEventType: eventType,
          lastEventAtMs: eventAtMs,
          updatedAt: now,
        },
        // Skip if this event is older than what is already stored.
        where: sql`COALESCE(${subscriptionEntitlements.lastEventAtMs}, 0) < ${eventAtMs}`,
      });
  } else {
    // Poll write: update isPro + bookkeeping but PRESERVE existing
    // lastEventAtMs so webhook ordering is not disrupted.
    //
    // expiresAt handling:
    //   - Positive poll (isPro=true): set expiresAt=null. A live RC confirmation
    //     means the subscription is active now; any past expiry is stale and must
    //     not block access. Future expiry (from cancellation webhooks) can be
    //     re-established by the next EXPIRATION webhook.
    //   - Negative poll (isPro=false): preserve existing expiresAt (harmless;
    //     user is not Pro regardless).
    await db
      .insert(subscriptionEntitlements)
      .values({
        userId,
        isPro,
        expiresAt: null,
        lastEventType: eventType,
        lastEventAtMs: null,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subscriptionEntitlements.userId,
        set: {
          isPro,
          lastEventType: eventType,
          updatedAt: now,
          // Keep whatever the webhook put there — do not erase.
          lastEventAtMs: sql`${subscriptionEntitlements.lastEventAtMs}`,
          // Clear stale past expiry on positive poll so active Pro users are
          // not blocked. Preserve on negative poll (user is not Pro anyway).
          expiresAt: isPro ? null : sql`${subscriptionEntitlements.expiresAt}`,
        },
      });
  }
}

/**
 * Reads the Postgres entitlement cache for a user, then falls back to a live
 * RevenueCat API poll if the cache row is absent or older than the staleness
 * threshold. The in-process memory cache sits in front of Postgres to avoid
 * hammering the DB on burst requests within the same server process.
 *
 * Authority order (highest → lowest):
 *   1. In-process memory cache (10 s, burst dedup only)
 *   2. Postgres subscription_entitlements row (set by webhooks)
 *   3. Live RevenueCat API poll (fallback when no webhook has arrived yet)
 */
export async function getUserHasProEntitlement(userId: string): Promise<boolean> {
  const now = Date.now();

  // 1. In-process memory cache.
  const mem = proMemCache.get(userId);
  if (mem && mem.expiresAt > now) return mem.isPro;

  // 2. Postgres cache (authoritative; kept current by webhooks).
  let isPro = false;
  try {
    const [row] = await db
      .select()
      .from(subscriptionEntitlements)
      .where(eq(subscriptionEntitlements.userId, userId))
      .limit(1);

    if (row) {
      // A row exists — trust it. If the subscription has a known expiry that
      // has already passed, treat as not-Pro even if isPro is still true (can
      // happen if a webhook delivery was delayed or out of order).
      const expired =
        row.expiresAt != null && row.expiresAt.getTime() <= now;
      isPro = row.isPro && !expired;

      // 3. Staleness re-poll: if the row says not-Pro and hasn't been updated
      // recently, re-poll RC in case a purchase webhook was missed. This
      // prevents users from being permanently blocked by a stale false-negative.
      const rowAge = now - row.updatedAt.getTime();
      if (!isPro && rowAge > PG_STALE_THRESHOLD_MS) {
        const liveIsPro = await fetchUserHasProFromRevenueCat(userId);
        if (liveIsPro !== isPro) {
          await upsertEntitlementCache(userId, liveIsPro, "rc_api_poll");
        }
        isPro = liveIsPro;
      }
    } else {
      // 3. No Postgres row yet — fall back to live RC API poll.
      isPro = await fetchUserHasProFromRevenueCat(userId);
      // Warm the Postgres cache so subsequent requests hit it.
      await upsertEntitlementCache(userId, isPro, "rc_api_poll");
    }
  } catch (err) {
    logger.error({ err, userId }, "getUserHasProEntitlement: lookup threw");
    isPro = false;
  }

  // Update in-process memory cache.
  proMemCache.set(userId, { isPro, expiresAt: now + MEM_CACHE_TTL_MS });
  return isPro;
}

export function invalidateProCache(userId: string): void {
  proMemCache.delete(userId);
}

/**
 * Force a live RevenueCat API poll for this user, update the Postgres cache,
 * and invalidate the in-process mem cache. Call this from the /paywall/refresh
 * endpoint so post-purchase unlocks are immediate regardless of webhook lag.
 */
export async function pollAndRefreshEntitlement(userId: string): Promise<boolean> {
  const isPro = await fetchUserHasProFromRevenueCat(userId);
  await upsertEntitlementCache(userId, isPro, "rc_api_poll");
  invalidateProCache(userId);
  return isPro;
}

export async function userBypassesPaywall(req: Request): Promise<boolean> {
  if (!isPaywallEnabled()) return true;
  const userId = (req as any).userId as string | undefined;
  if (!userId) return false;
  return getUserHasProEntitlement(userId);
}

/** Returns the start of the current UTC day. */
export function startOfUtcDay(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Returns the start of the next UTC day (when free counters reset). */
export function startOfNextUtcDay(now: Date = new Date()): Date {
  const d = startOfUtcDay(now);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

/** Total cooks ever created by this user (planned + active + completed). */
export async function countCooksForUser(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cooksTable)
    .where(eq(cooksTable.userId, userId));
  return row?.c ?? 0;
}

/**
 * Cooks with status = "active" for this user.
 * Pass `excludeCookId` to exclude a specific cook — used in PATCH so that
 * re-saving an already-active cook as active does not trigger the cap.
 */
export async function countActiveCooksForUser(userId: string, excludeCookId?: number): Promise<number> {
  const conditions = [
    eq(cooksTable.userId, userId),
    eq(cooksTable.status, "active"),
    ...(excludeCookId != null ? [ne(cooksTable.id, excludeCookId)] : []),
  ];
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cooksTable)
    .where(and(...conditions));
  return row?.c ?? 0;
}

/**
 * Cooks with status = "planned" for this user.
 * Pass `excludeCookId` to exclude a specific cook — used in PATCH so that
 * re-saving an already-planned cook as planned does not trigger the cap.
 */
export async function countPlannedCooksForUser(userId: string, excludeCookId?: number): Promise<number> {
  const conditions = [
    eq(cooksTable.userId, userId),
    eq(cooksTable.status, "planned"),
    ...(excludeCookId != null ? [ne(cooksTable.id, excludeCookId)] : []),
  ];
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(cooksTable)
    .where(and(...conditions));
  return row?.c ?? 0;
}

/**
 * Pure helper — builds the 402 paywall payload for an AI chat attempt, or
 * returns null if the request should be allowed through.
 *
 * Encapsulates all daily-limit gate logic so it can be unit-tested without
 * spinning up Express:
 *   - `paywallEnabled=false` → always null (kill-switch).
 *   - `isPro=false`  → free-tier cap (FREE_AI_CHAT_DAILY_LIMIT).
 *   - `isPro=true`   → Pro cap (PRO_AI_CHAT_DAILY_LIMIT).
 */
export function checkAiChatDailyLimit(
  isPro: boolean,
  paywallEnabled: boolean,
  used: number,
  resetsAt: string,
): PaywallResponseOptions | null {
  if (!paywallEnabled) return null;
  if (!isPro && used >= FREE_AI_CHAT_DAILY_LIMIT) {
    return {
      code: "ai_message_limit_reached",
      limit: FREE_AI_CHAT_DAILY_LIMIT,
      used,
      resetsAt,
      message: `You've used your ${FREE_AI_CHAT_DAILY_LIMIT} free messages today. Upgrade to Pro for unlimited AI chat.`,
    };
  }
  if (isPro && used >= PRO_AI_CHAT_DAILY_LIMIT) {
    return {
      code: "ai_message_limit_reached",
      limit: PRO_AI_CHAT_DAILY_LIMIT,
      used,
      resetsAt,
      message: `You've reached your ${PRO_AI_CHAT_DAILY_LIMIT} daily messages. Your limit resets at midnight UTC.`,
    };
  }
  return null;
}

/** AI chat messages (role=user) sent today by this user across all sessions. */
export async function countAiChatMessagesToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(messages)
    .innerJoin(conversations, eq(conversations.id, messages.conversationId))
    .where(
      and(
        eq(conversations.userId, userId),
        eq(messages.role, "user"),
        gte(messages.createdAt, startOfUtcDay()),
      ),
    );
  return row?.c ?? 0;
}

/** AI scan/analyze invocations made today by this user. */
export async function countAiAnalyzesToday(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(aiAnalyzeEvents)
    .where(
      and(
        eq(aiAnalyzeEvents.userId, userId),
        gte(aiAnalyzeEvents.createdAt, startOfUtcDay()),
      ),
    );
  return row?.c ?? 0;
}

/** Records that the user invoked an AI analyze (call after the analysis succeeds). */
export async function recordAiAnalyzeEvent(userId: string): Promise<void> {
  // Sweep stale rows for this user before inserting the new one.
  // ai_analyze_events is only ever read to count today's calls, so anything
  // older than 2 days is dead weight. Running the delete at write-time keeps
  // the table bounded without a cron job or schema change.
  await db
    .delete(aiAnalyzeEvents)
    .where(
      and(
        eq(aiAnalyzeEvents.userId, userId),
        sql`${aiAnalyzeEvents.createdAt} < now() - interval '2 days'`,
      ),
    );
  await db.insert(aiAnalyzeEvents).values({ userId });
}

/** Lifetime count of frozen-to-table planning sessions consumed by this user. */
export async function countFrozenTimelineEventsLifetime(userId: string): Promise<number> {
  const [row] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(frozenTimelineEvents)
    .where(eq(frozenTimelineEvents.userId, userId));
  return row?.c ?? 0;
}

/**
 * Atomically records that the user consumed their one lifetime free
 * Frozen-to-Table planning session. Returns `true` if a row was newly
 * inserted (the user just consumed their lifetime use), or `false` if a
 * row already existed (they were already at the cap). The DB unique index
 * on `user_id` guarantees that concurrent requests cannot both succeed —
 * there is exactly one row per user, ever.
 */
export async function recordFrozenTimelineEvent(userId: string): Promise<boolean> {
  const inserted = await db
    .insert(frozenTimelineEvents)
    .values({ userId })
    .onConflictDoNothing({ target: frozenTimelineEvents.userId })
    .returning({ id: frozenTimelineEvents.id });
  return inserted.length > 0;
}

/**
 * Standard 402 payload contract used by every paywall gate.
 *
 *   {
 *     error:       PaywallReason,           // legacy alias of `code`, kept for compat
 *     code:        PaywallReason,           // canonical machine-readable reason
 *     trigger:     PaywallReason,           // hint for which UI variant to show
 *     featureName: string | null,           // human label for the locked feature
 *     feature:     string | null,           // machine slug for FEATURE_LABELS map
 *     message:     string,                  // user-facing subtitle
 *     limit?:      number,                  // free-tier ceiling (cap gates only)
 *     used?:       number,                  // current usage (cap gates only)
 *     resetsAt?:   string,                  // ISO daily-reset timestamp (per-day caps)
 *   }
 *
 * The mobile client's `parseAndShowFromError` accepts either `error` or `code`
 * as the reason, but new code should set both for forward-compat and so HTTP
 * inspectors / curl users can read the response without prior knowledge.
 */
export interface PaywallResponseOptions {
  code: PaywallReason;
  message: string;
  /** Machine slug used by the client to map to a featureName label. */
  feature?: string | null;
  /** Free-tier ceiling. Pass for cap-style gates so the UI can render "X of Y". */
  limit?: number;
  /** Current usage. Pass for cap-style gates so the UI can render "X of Y". */
  used?: number;
  /** ISO timestamp when the per-day counter resets. Pass for daily caps only. */
  resetsAt?: string;
}

export function respondPaywall(res: Response, opts: PaywallResponseOptions): void {
  const body: Record<string, unknown> = {
    error: opts.code,
    code: opts.code,
    trigger: opts.code,
    feature: opts.feature ?? null,
    featureName: opts.feature ?? null,
    message: opts.message,
  };
  if (typeof opts.limit === "number") body.limit = opts.limit;
  if (typeof opts.used === "number") body.used = opts.used;
  if (opts.resetsAt) body.resetsAt = opts.resetsAt;
  res.status(402).json(body);
}
