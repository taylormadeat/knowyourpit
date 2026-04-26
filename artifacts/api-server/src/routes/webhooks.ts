import { Router, type IRouter, type Request, type Response } from "express";
import { invalidateProCache, upsertEntitlementCache } from "../lib/paywall";

const router: IRouter = Router();

// The lookup_key of the Pro entitlement in RevenueCat. Only events that affect
// this entitlement should change Pro access state.
const PRO_ENTITLEMENT_LOOKUP_KEY = "pro";

// RevenueCat event types that activate Pro access.
const ACTIVATING_EVENT_TYPES = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "UNCANCELLATION",
  "TRANSFER",
  "RESUME",
  "NON_RENEWING_PURCHASE",
  // RC v2 webhook names (dot-notation format)
  "subscription.activated",
  "subscription.renewed",
]);

// RevenueCat event types that immediately revoke Pro access (access has ended).
// EXPIRATION = billing period ended; PAUSE = subscription paused (no access).
const IMMEDIATE_REVOKE_EVENT_TYPES = new Set([
  "EXPIRATION",
  "PAUSE",
  // RC v2 webhook names (dot-notation format)
  "subscription.expired",
]);

// Cancellation events mean "won't auto-renew" but access continues until the
// expiry date embedded in the event. We keep isPro=true and let the expiresAt
// field do the revoking when that time comes.
const CANCELLATION_EVENT_TYPES = new Set([
  "CANCELLATION",
  // RC v2 webhook names (dot-notation format)
  "subscription.cancelled",
]);

/**
 * Verify the shared-secret Authorization header sent by RevenueCat.
 *
 * RevenueCat sends `Authorization: <secret>` (no "Bearer" prefix).
 * We also accept `Authorization: Bearer <secret>` defensively.
 *
 * Returns false (fail-closed) when REVENUECAT_WEBHOOK_SECRET is not set,
 * preventing unauthenticated callers from modifying entitlement state.
 */
function verifyWebhookSecret(req: Request): boolean {
  const expectedSecret = process.env.REVENUECAT_WEBHOOK_SECRET;
  if (!expectedSecret) {
    console.error(
      "REVENUECAT_WEBHOOK_SECRET is not set — rejecting webhook request. " +
        "Set this env var to enable RevenueCat webhooks.",
    );
    return false;
  }

  const authHeader = req.headers["authorization"] ?? "";
  const providedSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  // Use a constant-time comparison to prevent timing attacks.
  if (providedSecret.length !== expectedSecret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expectedSecret.length; i++) {
    mismatch |= providedSecret.charCodeAt(i) ^ expectedSecret.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * POST /api/webhooks/revenuecat
 *
 * Receives RevenueCat server-to-server subscription lifecycle events,
 * verifies the shared secret, and updates the Postgres entitlement cache so
 * that paywall.ts can use webhook-verified data instead of polling the RC API
 * on every request.
 *
 * Supported event types:
 *   INITIAL_PURCHASE / subscription.activated  → mark Pro
 *   RENEWAL         / subscription.renewed     → mark Pro
 *   UNCANCELLATION                             → mark Pro
 *   CANCELLATION    / subscription.cancelled   → keep Pro, update expiresAt
 *                                                (access continues until billing period ends)
 *   EXPIRATION      / subscription.expired     → mark not-Pro (access ended)
 *   PAUSE                                      → mark not-Pro (access suspended)
 *
 * Unknown event types are acknowledged (200) and ignored so RC doesn't retry.
 */
router.post("/webhooks/revenuecat", async (req: Request, res: Response): Promise<void> => {
  // 1. Verify shared secret.
  if (!verifyWebhookSecret(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // 2. Parse body.
  const body = req.body as Record<string, unknown>;
  const event = (body?.event ?? body) as Record<string, unknown>;

  const eventType = (event?.type as string | undefined) ?? "";
  // The subscriber's Clerk user ID is stored as the RC app_user_id.
  const userId =
    ((event?.app_user_id as string | undefined) ?? "").trim() ||
    ((event?.original_app_user_id as string | undefined) ?? "").trim();
  const expirationMs =
    typeof event?.expiration_at_ms === "number" ? event.expiration_at_ms : null;
  // RC includes the event's own Unix timestamp in milliseconds.
  const eventAtMs =
    typeof event?.event_timestamp_ms === "number" ? event.event_timestamp_ms : null;
  // RC includes `entitlement_ids` (array of lookup_key strings) on most events.
  // When present, only process events that affect the Pro entitlement so we
  // don't accidentally grant/revoke Pro for unrelated future entitlements.
  const entitlementIds = Array.isArray(event?.entitlement_ids)
    ? (event.entitlement_ids as string[])
    : null;
  const affectsProEntitlement =
    entitlementIds === null || entitlementIds.includes(PRO_ENTITLEMENT_LOOKUP_KEY);

  if (!userId) {
    // RC occasionally fires system events with no user — acknowledge and skip.
    console.warn("RevenueCat webhook: event has no app_user_id, ignoring.", { eventType });
    res.json({ ok: true, skipped: true });
    return;
  }

  const expiresAt = expirationMs != null ? new Date(expirationMs) : null;

  if (ACTIVATING_EVENT_TYPES.has(eventType)) {
    if (!affectsProEntitlement) {
      console.log(
        `RevenueCat webhook: ${eventType} for user ${userId} does not include Pro entitlement — skipping`,
      );
    } else {
      await upsertEntitlementCache(userId, true, eventType, expiresAt, eventAtMs);
      invalidateProCache(userId);
      console.log(`RevenueCat webhook: ${eventType} → user ${userId} is now Pro`);
    }
  } else if (IMMEDIATE_REVOKE_EVENT_TYPES.has(eventType)) {
    if (!affectsProEntitlement) {
      console.log(
        `RevenueCat webhook: ${eventType} for user ${userId} does not include Pro entitlement — skipping`,
      );
    } else {
      await upsertEntitlementCache(userId, false, eventType, null, eventAtMs);
      invalidateProCache(userId);
      console.log(`RevenueCat webhook: ${eventType} → user ${userId} is no longer Pro`);
    }
  } else if (CANCELLATION_EVENT_TYPES.has(eventType)) {
    // Cancellation means the subscription won't renew, but access continues
    // until the expiry date. Keep isPro=true and store expiresAt so the paywall
    // check handles revocation when that time arrives.
    if (!affectsProEntitlement) {
      console.log(
        `RevenueCat webhook: ${eventType} for user ${userId} does not include Pro entitlement — skipping`,
      );
    } else {
      await upsertEntitlementCache(userId, true, eventType, expiresAt, eventAtMs);
      invalidateProCache(userId);
      console.log(
        `RevenueCat webhook: ${eventType} → user ${userId} cancelled; access until ${expiresAt?.toISOString() ?? "unknown"}`,
      );
    }
  } else {
    // Unknown/uninteresting event type — log and acknowledge.
    console.log(`RevenueCat webhook: unhandled event type "${eventType}" for user ${userId}`);
  }

  // Always return 200 so RevenueCat doesn't retry.
  res.json({ ok: true });
});

export default router;
