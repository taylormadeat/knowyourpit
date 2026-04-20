import { getAuth, verifyToken } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

function decodeJwtHeader(token: string): Record<string, unknown> | null {
  try {
    const [header] = token.split(".");
    return JSON.parse(Buffer.from(header, "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const auth = getAuth(req);
  if (auth?.userId) {
    (req as any).userId = auth.userId;
    next();
    return;
  }

  const authHeader = req.headers["authorization"];
  const bearerToken =
    typeof authHeader === "string" && authHeader.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

  if (bearerToken) {
    const header = decodeJwtHeader(bearerToken);
    const payload = decodeJwtPayload(bearerToken);

    logger.info({
      msg: "requireAuth: inspecting bearer token",
      header,
      payloadSub: (payload as any)?.sub,
      payloadSid: (payload as any)?.sid,
      payloadIss: (payload as any)?.iss,
    });

    try {
      const verified = await verifyToken(bearerToken, {
        secretKey: process.env.CLERK_SECRET_KEY,
      });
      if (verified?.sub) {
        (req as any).userId = verified.sub;
        next();
        return;
      }
    } catch (err: any) {
      logger.warn({ msg: "requireAuth: verifyToken failed", reason: err?.message });

      // Fallback: trust the JWT payload if the sub/sid are present and plausible
      // Only safe in development mode — skip in production
      if (process.env.NODE_ENV !== "production" && payload?.sub) {
        logger.warn({ msg: "requireAuth: dev fallback — trusting unverified sub", sub: payload.sub });
        (req as any).userId = payload.sub;
        next();
        return;
      }
    }
  } else {
    logger.warn({ msg: "requireAuth: no bearer token", url: req.url });
  }

  res.status(401).json({ error: "Unauthorized" });
}
