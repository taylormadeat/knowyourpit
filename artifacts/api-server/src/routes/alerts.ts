import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, alertsTable } from "@workspace/db";
import { CreateAlertBody, DeleteAlertParams } from "@workspace/api-zod";

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
