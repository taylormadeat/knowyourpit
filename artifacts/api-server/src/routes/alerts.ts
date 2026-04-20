import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { CreateAlertBody, DeleteAlertParams, PatchAlertParams, PatchAlertBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/alerts", async (_req, res): Promise<void> => {
  const alerts = await db.select().from(alertsTable).orderBy(alertsTable.createdAt);
  res.json(alerts);
});

router.post("/alerts", async (req, res): Promise<void> => {
  const parsed = CreateAlertBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [alert] = await db.insert(alertsTable).values(parsed.data).returning();
  res.status(201).json(alert);
});

router.patch("/alerts/:id", async (req, res): Promise<void> => {
  const params = PatchAlertParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const body = PatchAlertBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: body.error.message }); return; }

  const updateData: any = {};
  if (body.data.triggered === true) {
    updateData.triggeredAt = new Date();
    updateData.isActive = false;
  }
  if (body.data.scheduledNotificationId !== undefined) {
    updateData.scheduledNotificationId = body.data.scheduledNotificationId;
  }
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }

  const [updated] = await db
    .update(alertsTable)
    .set(updateData)
    .where(eq(alertsTable.id, params.data.id))
    .returning();
  if (!updated) { res.status(404).json({ error: "Alert not found" }); return; }
  res.json(updated);
});

router.delete("/alerts/:id", async (req, res): Promise<void> => {
  const params = DeleteAlertParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(alertsTable).where(eq(alertsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Alert not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
