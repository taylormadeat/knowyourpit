import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const reviewerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many reviewer requests. Please wait and try again." },
});

const REVIEWER_USER_ID = "user_3D4pIwJgn1lE8EMVXrX6dKuJ10C";

router.post(
  "/reviewer/sign-in-token",
  reviewerLimiter,
  async (req, res): Promise<void> => {
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret) {
      logger.error("reviewer sign-in-token: CLERK_SECRET_KEY not set");
      res.status(503).json({ error: "Not configured" });
      return;
    }

    try {
      const clerkRes = await fetch("https://api.clerk.com/v1/sign_in_tokens", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${clerkSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          user_id: REVIEWER_USER_ID,
          expires_in_seconds: 300,
        }),
      });

      if (!clerkRes.ok) {
        const errBody = await clerkRes.json().catch(() => ({}));
        logger.error({ status: clerkRes.status, errBody }, "Clerk sign-in token creation failed");
        res.status(502).json({ error: "Failed to create sign-in token" });
        return;
      }

      const data = (await clerkRes.json()) as { token?: string };
      if (!data.token) {
        logger.error({ data }, "Clerk returned no token");
        res.status(502).json({ error: "No token in Clerk response" });
        return;
      }

      logger.info("reviewer sign-in token issued");
      res.json({ token: data.token });
    } catch (err) {
      logger.error({ err }, "reviewer sign-in-token request failed");
      res.status(500).json({ error: "Internal error" });
    }
  },
);

export default router;
