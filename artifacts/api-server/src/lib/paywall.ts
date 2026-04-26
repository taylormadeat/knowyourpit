import type { Request, Response } from "express";
import { and, eq, gte, sql } from "drizzle-orm";
import { db, cooksTable, conversations, messages, aiAnalyzeEvents } from "@workspace/db";

/**
 * ──────────────────────────────────────────────────────────────────────────────
 * knowyourpit paywall helpers
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * Free tier limits:
 *   - 5 cooks per account (lifetime)
 *   - 5 AI chat messages per UTC day
 *   - 3 AI image analyzes per UTC day
 *
 * Pro features (entirely gated):
 *   - Multi-Cook Sequencer (POST /ai/multi-cook)
 *   - MEATER + ThermoWorks linking (POST /meater/link, POST /thermoworks/link)
 *   - AI Home Insights (GET /ai/home-insights)
 *   - Cook Quality Analytics (Profile screen)
 *
 * Kill-switch:
 *   - Setting PAYWALL_ENABLED=false disables all gates server-side. Use this if
 *     payment processing breaks in production so paying & free users can keep
 *     using the app while we investigate.
 *
 * Subscription verification:
 *   - The mobile client tells the server its current entitlement via the
 *     `X-Subscription-Active: true` header. RevenueCat is the source of truth
 *     on the client (Purchases.getCustomerInfo). The grant/revoke CLI scripts
 *     write to RevenueCat directly so granted users automatically appear as
 *     subscribed on their next API call. A determined attacker could spoof the
 *     header from outside the app, but for launch this trade-off is acceptable
 *     (web-hook-based authoritative verification is tracked as follow-up work).
 */

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

/**
 * True when the request is from a Pro subscriber (per the client header) or
 * the kill-switch has globally disabled the paywall. When this returns true,
 * gates should be skipped entirely.
 */
export function userBypassesPaywall(req: Request): boolean {
  if (!isPaywallEnabled()) return true;
  const header = req.headers["x-subscription-active"];
  if (typeof header === "string" && header.trim().toLowerCase() === "true") {
    return true;
  }
  return false;
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
