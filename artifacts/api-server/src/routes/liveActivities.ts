import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, liveActivitiesTable } from "@workspace/db";
import { z } from "zod/v4";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const RegisterBody = z.object({
  activityId: z.string().min(1),
  pushToken: z.string().min(1),
});

router.post(
  "/cooks/:id/live-activity",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const cookId = Number(req.params.id);
    if (!Number.isFinite(cookId)) {
      res.status(400).json({ error: "Invalid cook id" });
      return;
    }

    const parsed = RegisterBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const [cook] = await db
      .select()
      .from(cooksTable)
      .where(and(eq(cooksTable.id, cookId), eq(cooksTable.userId, req.userId)));
    if (!cook) {
      res.status(404).json({ error: "Cook not found" });
      return;
    }

    const { activityId, pushToken } = parsed.data;
    await db
      .insert(liveActivitiesTable)
      .values({ activityId, userId: req.userId, cookId, pushToken })
      .onConflictDoUpdate({
        target: liveActivitiesTable.activityId,
        set: { pushToken, cookId, userId: req.userId, updatedAt: new Date() },
      });

    res.json({ activityId, cookId });
  }
);

router.delete(
  "/cooks/:id/live-activity",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const cookId = Number(req.params.id);
    if (!Number.isFinite(cookId)) {
      res.status(400).json({ error: "Invalid cook id" });
      return;
    }
    await db
      .delete(liveActivitiesTable)
      .where(
        and(
          eq(liveActivitiesTable.cookId, cookId),
          eq(liveActivitiesTable.userId, req.userId)
        )
      );
    res.status(204).end();
  }
);

export default router;
