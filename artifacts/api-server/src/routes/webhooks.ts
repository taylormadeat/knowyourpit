import { Router, type IRouter, type Request, type Response } from "express";
import { Webhook } from "svix";
import { db, webhookEvents } from "@workspace/db";
import { invalidateProCache, upsertEntitlementCache } from "../lib/paywall";
import { sendWelcomeEmail } from "../lib/email";

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
    req.log.error(
      "REVENUECAT_WEBHOOK_SECRET is not set — rejecting webhook request. Set this env var to enable RevenueCat webhooks.",
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
    req.log.warn({ eventType }, "RevenueCat webhook: event has no app_user_id, ignoring");
    res.json({ ok: true, skipped: true });
    return;
  }

  const expiresAt = expirationMs != null ? new Date(expirationMs) : null;

  if (ACTIVATING_EVENT_TYPES.has(eventType)) {
    if (!affectsProEntitlement) {
      req.log.info(
        { eventType, userId },
        "RevenueCat webhook: event does not include Pro entitlement — skipping",
      );
    } else {
      await upsertEntitlementCache(userId, true, eventType, expiresAt, eventAtMs);
      invalidateProCache(userId);
      req.log.info({ eventType, userId }, "RevenueCat webhook: user is now Pro");
    }
  } else if (IMMEDIATE_REVOKE_EVENT_TYPES.has(eventType)) {
    if (!affectsProEntitlement) {
      req.log.info(
        { eventType, userId },
        "RevenueCat webhook: event does not include Pro entitlement — skipping",
      );
    } else {
      await upsertEntitlementCache(userId, false, eventType, null, eventAtMs);
      invalidateProCache(userId);
      req.log.info({ eventType, userId }, "RevenueCat webhook: user is no longer Pro");
    }
  } else if (CANCELLATION_EVENT_TYPES.has(eventType)) {
    // Cancellation means the subscription won't renew, but access continues
    // until the expiry date. Keep isPro=true and store expiresAt so the paywall
    // check handles revocation when that time arrives.
    if (!affectsProEntitlement) {
      req.log.info(
        { eventType, userId },
        "RevenueCat webhook: event does not include Pro entitlement — skipping",
      );
    } else {
      await upsertEntitlementCache(userId, true, eventType, expiresAt, eventAtMs);
      invalidateProCache(userId);
      req.log.info(
        { eventType, userId, accessUntil: expiresAt?.toISOString() ?? "unknown" },
        "RevenueCat webhook: user cancelled; access continues until expiry",
      );
    }
  } else {
    // Unknown/uninteresting event type — log and acknowledge.
    req.log.info({ eventType, userId }, "RevenueCat webhook: unhandled event type");
  }

  // Always return 200 so RevenueCat doesn't retry.
  res.json({ ok: true });
});

/**
 * POST /api/webhooks/clerk
 *
 * Receives Clerk server-to-server webhook events, verifies the Svix signature,
 * and handles user lifecycle events. Currently sends a welcome email when a
 * new user registers (user.created).
 *
 * Idempotency: each Svix message ID is stored in the webhook_events table on
 * first processing. Duplicate deliveries (Clerk retries) with the same ID are
 * acknowledged and skipped without re-sending the email.
 */
router.post("/webhooks/clerk", async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    req.log.error(
      "CLERK_WEBHOOK_SECRET is not set — rejecting Clerk webhook. Set this env var to enable Clerk webhooks.",
    );
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  // express.raw() gives us a Buffer for this route; fall back to JSON stringify
  // for any edge case where the body is already parsed (should not happen).
  const payload: string | Buffer = Buffer.isBuffer(req.body)
    ? req.body
    : JSON.stringify(req.body);

  const svixId = req.headers["svix-id"] as string | undefined;
  const svixTimestamp = req.headers["svix-timestamp"] as string | undefined;
  const svixSignature = req.headers["svix-signature"] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    req.log.warn("Clerk webhook: missing Svix headers");
    res.status(400).json({ error: "Missing Svix headers" });
    return;
  }

  let event: Record<string, unknown>;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as Record<string, unknown>;
  } catch (err: unknown) {
    req.log.warn({ err }, "Clerk webhook: signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  const eventType = (event.type as string | undefined) ?? "";

  if (eventType !== "user.created") {
    // Acknowledge unhandled event types so Clerk doesn't retry.
    req.log.info({ eventType }, "Clerk webhook: unhandled event type — acknowledged");
    res.json({ ok: true, skipped: true });
    return;
  }

  // Idempotency check: skip if we've already processed this Svix message.
  // Only treat a Postgres unique-constraint violation (error code 23505) as a
  // duplicate — all other DB errors are re-thrown so Clerk retries the delivery.
  try {
    await db.insert(webhookEvents).values({
      messageId: svixId,
      source: "clerk",
      eventType,
    });
  } catch (dbErr: unknown) {
    const pgCode =
      dbErr !== null &&
      typeof dbErr === "object" &&
      "code" in dbErr &&
      typeof (dbErr as Record<string, unknown>).code === "string"
        ? (dbErr as Record<string, unknown>).code
        : undefined;

    if (pgCode === "23505") {
      // Unique constraint violation — we already processed this message ID.
      req.log.info({ svixId }, "Clerk webhook: duplicate message ID — skipping");
      res.json({ ok: true, skipped: true });
      return;
    }

    // Any other DB error: log and return 500 so Clerk retries.
    req.log.error({ err: dbErr, svixId }, "Clerk webhook: DB error recording idempotency key");
    res.status(500).json({ error: "Internal error" });
    return;
  }

  // Typed shape for a Clerk email address object within user.created payload.
  interface ClerkEmailAddress {
    id: string;
    email_address: string;
  }

  function isClerkEmailAddress(val: unknown): val is ClerkEmailAddress {
    return (
      typeof val === "object" &&
      val !== null &&
      typeof (val as Record<string, unknown>).id === "string" &&
      typeof (val as Record<string, unknown>).email_address === "string"
    );
  }

  // Extract user details from the Clerk user.created payload.
  const data = (event.data ?? {}) as Record<string, unknown>;
  const rawEmailAddresses = Array.isArray(data.email_addresses) ? data.email_addresses : [];
  const emailAddresses = rawEmailAddresses.filter(isClerkEmailAddress);
  const primaryEmailId =
    typeof data.primary_email_address_id === "string" ? data.primary_email_address_id : undefined;

  const primaryEmail =
    emailAddresses.find((e) => e.id === primaryEmailId) ?? emailAddresses[0];
  const toEmail = primaryEmail?.email_address;

  if (!toEmail) {
    req.log.warn({ svixId }, "Clerk webhook: user.created has no email address — skipping welcome email");
    res.json({ ok: true });
    return;
  }

  const firstName =
    typeof data.first_name === "string" && data.first_name.trim().length > 0
      ? data.first_name.trim()
      : null;

  try {
    await sendWelcomeEmail({ toEmail, firstName });
    req.log.info({ svixId, toEmail }, "Clerk webhook: welcome email sent");
  } catch (err) {
    req.log.error({ err, toEmail }, "Clerk webhook: failed to send welcome email");
    // Don't return a non-200 — Clerk would retry, but the email failure is
    // non-critical and we've already committed the idempotency row.
  }

  res.json({ ok: true });
});

export default router;
