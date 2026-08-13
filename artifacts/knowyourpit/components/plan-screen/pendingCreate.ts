/**
 * pendingCreate — pure helpers for the "Start Cook" watchdog/recovery flow.
 *
 * When a "Start Cooking Now" create request is slow (or the user cancels the
 * wait / backgrounds the app), the request may still have reached the server —
 * iOS does not reliably honour fetch aborts. We remember the idempotency key
 * we sent (`sessionId` + `plannedStartAt`) so that:
 *
 *   1. A manual retry reuses the SAME key → the server dedup guard returns
 *      the already-created cook instead of duplicating it.
 *   2. Foreground recovery can look for a cook carrying that sessionId and
 *      navigate to it instead of leaving the user stranded.
 *
 * A pending record expires after PENDING_CREATE_TTL_MS: past that point a
 * retry is a genuinely new cook attempt and should use a fresh key.
 */

export interface PendingCreate {
  /** Idempotency sessionId sent with the create request. */
  sessionId: string;
  /** plannedStartAt sent with the create request (part of the dedup key). */
  plannedStartAt: string | Date;
  /**
   * Stable fingerprint of the full create intent (cut, weight, temps, grill,
   * notes, technique picks, frozen settings, …). Reuse is only safe when the
   * retry describes the exact same cook — otherwise the server dedup guard
   * would silently return the original cook and discard the revised intent.
   */
  fingerprint: string;
  /** Date.now() when the first attempt started. */
  startedAt: number;
}

/**
 * Build a stable fingerprint of the user-editable create intent. Must NOT
 * include time-derived values (e.g. a "now" plannedStartAt) — those change
 * on every render and would defeat reuse for a genuine identical retry.
 */
export function createIntentFingerprint(intent: unknown): string {
  return JSON.stringify(intent);
}

export const PENDING_CREATE_TTL_MS = 10 * 60_000;

/** A pending create is fresh while it is within its TTL. */
export function isPendingCreateFresh(
  pending: PendingCreate | null | undefined,
  now: number,
): pending is PendingCreate {
  return !!pending && now - pending.startedAt <= PENDING_CREATE_TTL_MS;
}

/**
 * Reuse the pending idempotency key only when retrying the IDENTICAL create
 * intent within the TTL. Any changed form value (cut, grill, temps, weight,
 * notes, frozen settings, …) makes it a genuinely different cook — reusing
 * the key there could silently return the earlier cook from the server and
 * discard the user's revisions.
 */
export function shouldReusePendingCreate(
  pending: PendingCreate | null | undefined,
  fingerprint: string,
  now: number,
): pending is PendingCreate {
  return isPendingCreateFresh(pending, now) && pending.fingerprint === fingerprint;
}

/**
 * Find the cook created by a pending request in a list fetched from the
 * server, by its idempotency sessionId.
 */
export function findPendingCook<T extends { sessionId?: string | null }>(
  cooks: readonly T[] | null | undefined,
  pending: PendingCreate | null | undefined,
): T | null {
  if (!pending || !cooks) return null;
  return cooks.find(c => c.sessionId === pending.sessionId) ?? null;
}
