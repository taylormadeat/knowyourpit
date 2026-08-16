import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { z } from "zod";
import { upsertEntitlementCache, invalidateProCache } from "../lib/paywall";
import { logger } from "../lib/logger";
import { getFlags, setFlag, type FeatureFlags } from "../lib/featureFlags";

const router: IRouter = Router();

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = process.env.ADMIN_API_TOKEN;
  if (!token) {
    logger.error({ msg: "admin route hit but ADMIN_API_TOKEN is unset" });
    res.status(503).json({ error: "Admin API not configured" });
    return;
  }

  const authHeader = req.headers["authorization"];
  const provided =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  if (!provided || provided !== token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  next();
}

const grantBodySchema = z.object({
  userId: z.string().min(1),
  expiresAt: z.string().datetime().nullish(),
});

const revokeBodySchema = z.object({
  userId: z.string().min(1),
});

router.post("/admin/grant-pro", requireAdmin, async (req, res): Promise<void> => {
  const parsed = grantBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { userId } = parsed.data;
  const expiresAt = parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null;

  await upsertEntitlementCache(userId, true, "manual_grant", expiresAt);
  invalidateProCache(userId);

  logger.info({ msg: "admin grant-pro", userId, expiresAt });
  res.json({ ok: true, userId, isPro: true, expiresAt });
});

router.post("/admin/revoke-pro", requireAdmin, async (req, res): Promise<void> => {
  const parsed = revokeBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { userId } = parsed.data;
  await upsertEntitlementCache(userId, false, "manual_revoke");
  invalidateProCache(userId);

  logger.info({ msg: "admin revoke-pro", userId });
  res.json({ ok: true, userId, isPro: false });
});

const configBodySchema = z.object({
  key: z.enum(["partnerBigPetes"] satisfies [keyof FeatureFlags, ...(keyof FeatureFlags)[]]),
  value: z.boolean(),
});

/**
 * POST /api/admin/config
 *
 * Flip a feature flag at runtime without a code change or redeploy.
 * Requires Authorization: Bearer <ADMIN_API_TOKEN>.
 *
 * Body: { "key": "partnerBigPetes", "value": false }
 */
router.post("/admin/config", requireAdmin, (req, res): void => {
  const parsed = configBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body", details: parsed.error.flatten() });
    return;
  }

  const { key, value } = parsed.data;
  setFlag(key, value);
  logger.info({ msg: "admin config flag set", key, value });
  res.json({ ok: true, flags: getFlags() });
});

export default router;
