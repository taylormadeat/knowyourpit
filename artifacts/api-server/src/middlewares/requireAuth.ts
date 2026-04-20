import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    const authHeader = req.headers["authorization"];
    logger.warn({
      msg: "requireAuth: denied",
      hasAuthHeader: !!authHeader,
      authHeaderPrefix: authHeader ? authHeader.slice(0, 20) : null,
      clerkSessionId: (auth as any)?.sessionId ?? null,
      clerkDebug: (auth as any)?.debug?.() ?? null,
    });
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).userId = userId;
  next();
}
