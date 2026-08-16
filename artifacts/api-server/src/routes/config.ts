import { Router, type IRouter } from "express";
import { getFlags } from "../lib/featureFlags";

const router: IRouter = Router();

/**
 * GET /api/config
 *
 * Public, unauthenticated endpoint.  Returns the current feature flags so the
 * mobile app can conditionally render features without shipping a new build.
 *
 * Response is intentionally cache-friendly for a short window (60 s) so that
 * a flag flip propagates quickly while not hammering the server on every
 * screen render.
 */
router.get("/config", (_req, res): void => {
  res.set("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
  res.json(getFlags());
});

export default router;
