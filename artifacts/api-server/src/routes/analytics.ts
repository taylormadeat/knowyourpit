import { Router, type IRouter } from "express";
import { z } from "zod/v4";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const AnalyticsEventBody = z.object({
  event: z.string().min(1).max(100),
  properties: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/analytics/event
 *
 * Lightweight, auth-optional analytics ingestion endpoint.
 * Events are written to the structured log so they can be queried / exported
 * from any log aggregator without requiring a DB schema migration.
 *
 * The client fires this fire-and-forget — we always return 204 even if the
 * body is malformed (to avoid noisy errors on the client when the payload
 * drifts out of sync with the schema).
 */
router.post("/analytics/event", (req: any, res): void => {
  const parsed = AnalyticsEventBody.safeParse(req.body);
  if (!parsed.success) {
    // Still 204 — client doesn't need to retry on schema mismatches.
    res.status(204).end();
    return;
  }

  // Optionally attach the authenticated userId when the Clerk middleware has
  // already resolved it (same middleware chain as the rest of /api).
  const userId: string | null = req.auth?.userId ?? null;

  logger.info(
    {
      analyticsEvent: parsed.data.event,
      userId,
      properties: parsed.data.properties ?? {},
    },
    "analytics_event",
  );

  res.status(204).end();
});

export default router;
