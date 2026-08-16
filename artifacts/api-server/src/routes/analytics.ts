import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod/v4";
import { logger } from "../lib/logger";
import { db, analyticsEvents } from "@workspace/db";

const router: IRouter = Router();

// 60 events per minute per IP — generous for legitimate app usage but blocks
// bulk flooding from unauthenticated callers.
const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  // Always return 204 so the client's fire-and-forget pattern is unaffected.
  handler: (_req, res) => res.status(204).end(),
});

// Cap the serialized properties object at 4 KB to prevent giant payloads from
// being written permanently into the database.
const MAX_PROPERTIES_BYTES = 4096;

const AnalyticsEventBody = z.object({
  event: z.string().min(1).max(100),
  properties: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/analytics/event
 *
 * Lightweight, auth-optional analytics ingestion endpoint.
 * Events are written to the structured log AND persisted to the
 * `analytics_events` database table so records survive server restarts.
 *
 * The client fires this fire-and-forget — we always return 204 even if the
 * body is malformed (to avoid noisy errors on the client when the payload
 * drifts out of sync with the schema).
 */
router.post("/analytics/event", analyticsLimiter, (req: any, res): void => {
  const parsed = AnalyticsEventBody.safeParse(req.body);
  if (!parsed.success) {
    // Still 204 — client doesn't need to retry on schema mismatches.
    res.status(204).end();
    return;
  }

  // Optionally attach the authenticated userId when the Clerk middleware has
  // already resolved it (same middleware chain as the rest of /api).
  const userId: string | null = req.auth?.userId ?? null;

  // Reject properties that would bloat the database row.
  const propertiesJson = parsed.data.properties
    ? JSON.stringify(parsed.data.properties)
    : null;
  if (propertiesJson !== null && Buffer.byteLength(propertiesJson) > MAX_PROPERTIES_BYTES) {
    logger.warn(
      { analyticsEvent: parsed.data.event, userId, propertiesBytes: Buffer.byteLength(propertiesJson) },
      "analytics_event_properties_too_large",
    );
    res.status(204).end();
    return;
  }

  logger.info(
    {
      analyticsEvent: parsed.data.event,
      userId,
      properties: parsed.data.properties ?? {},
    },
    "analytics_event",
  );

  // Persist to DB — fire-and-forget; errors are logged but never surfaced to
  // the client so the mobile app's fire-and-forget pattern is unaffected.
  db.insert(analyticsEvents)
    .values({
      event: parsed.data.event,
      userId,
      properties: parsed.data.properties ?? null,
    })
    .catch((err) => {
      logger.error({ err, analyticsEvent: parsed.data.event }, "analytics_event_db_insert_failed");
    });

  res.status(204).end();
});

export default router;
