import type { Request, Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, cooksTable, conversations, messages, aiAnalyzeEvents } from "@workspace/db";
import { listCustomerActiveEntitlements, listEntitlements } from "@replit/revenuecat-sdk";
import { asListItems, getRevenueCatClient } from "./revenuecat";

// Free-tier counters + server-side Pro entitlement check via RevenueCat.
// Kill-switch: PAYWALL_ENABLED=false bypasses every gate.

export const FREE_COOK_LIMIT = 5;
export const FREE_AI_CHAT_DAILY_LIMIT = 5;
export const FREE_AI_ANALYZE_DAILY_LIMIT = 3;

export type PaywallReason =
  | "cook_limit_reached"
  | "ai_message_limit_reached"
  | "ai_analyze_limit_reached"
  | "pro_required";

export function isPaywallEnabled(): boolean {
  const v = process.env.PAYWALL_ENABLED;
  if (v == null) return true;
  const lower = String(v).trim().toLowerCase();
  return !(lower === "false" || lower === "0" || lower === "off" || lower === "no");
}

// Per-user RC entitlement cache. Positive results live longer (Pro is sticky),
// negatives expire fast so a freshly-purchased user isn't blocked. The mobile
// client also calls POST /paywall/refresh after purchase/restore to wipe the
// negative entry instantly via invalidateProCache.
const PRO_CACHE_POSITIVE_TTL_MS = 60_000;
const PRO_CACHE_NEGATIVE_TTL_MS = 5_000;
const proCache = new Map<string, { isPro: boolean; expiresAt: number }>();

const PRO_ENTITLEMENT_LOOKUP_KEY = "pro";

// RC v2 active-entitlement items echo entitlement_id (not lookup_key), so
// resolve our "pro" lookup_key to a project entitlement id once.
let proEntitlementIdCache: string | null = null;

async function resolveProEntitlementId(projectId: string): Promise<string | null> {
  if (proEntitlementIdCache) return proEntitlementIdCache;
  const client = await getRevenueCatClient();
  const list = await listEntitlements({ client, path: { project_id: projectId } });
  if (list.error) {
    console.error("RevenueCat listEntitlements failed:", list.error);
    return null;
  }
  const match = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (e) => e.lookup_key === PRO_ENTITLEMENT_LOOKUP_KEY,
  );
  if (!match) {
    console.error(
      `RevenueCat entitlement "${PRO_ENTITLEMENT_LOOKUP_KEY}" not found in project ${projectId}`,
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
    console.error("RevenueCat listCustomerActiveEntitlements failed:", result.error);
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

export async function getUserHasProEntitlement(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = proCache.get(userId);
  if (cached && cached.expiresAt > now) return cached.isPro;
  let isPro = false;
  try {
    isPro = await fetchUserHasProFromRevenueCat(userId);
  } catch (err) {
    console.error("getUserHasProEntitlement: RC lookup threw:", err);
    isPro = false;
  }
  const ttl = isPro ? PRO_CACHE_POSITIVE_TTL_MS : PRO_CACHE_NEGATIVE_TTL_MS;
  proCache.set(userId, { isPro, expiresAt: now + ttl });
  return isPro;
}

export function invalidateProCache(userId: string): void {
  proCache.delete(userId);
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
  await db.insert(aiAnalyzeEvents).values({ userId });
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
