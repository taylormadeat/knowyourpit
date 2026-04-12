import { Router, type IRouter } from "express";
import { eq, sql } from "drizzle-orm";
import { db, grillsTable, cooksTable } from "@workspace/db";
import {
  CreateGrillBody,
  UpdateGrillBody,
  GetGrillParams,
  UpdateGrillParams,
  DeleteGrillParams,
  GetGrillStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/grills", async (_req, res): Promise<void> => {
  const grills = await db.select().from(grillsTable).orderBy(grillsTable.createdAt);
  res.json(grills);
});

router.post("/grills", async (req, res): Promise<void> => {
  const parsed = CreateGrillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [grill] = await db.insert(grillsTable).values(parsed.data).returning();
  res.status(201).json(grill);
});

router.get("/grills/:id", async (req, res): Promise<void> => {
  const params = GetGrillParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [grill] = await db.select().from(grillsTable).where(eq(grillsTable.id, params.data.id));
  if (!grill) {
    res.status(404).json({ error: "Grill not found" });
    return;
  }
  res.json(grill);
});

router.patch("/grills/:id", async (req, res): Promise<void> => {
  const params = UpdateGrillParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateGrillBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [grill] = await db.update(grillsTable).set(updateData).where(eq(grillsTable.id, params.data.id)).returning();
  if (!grill) {
    res.status(404).json({ error: "Grill not found" });
    return;
  }
  res.json(grill);
});

router.delete("/grills/:id", async (req, res): Promise<void> => {
  const params = DeleteGrillParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(grillsTable).where(eq(grillsTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Grill not found" });
    return;
  }
  res.sendStatus(204);
});

router.get("/grills/:id/stats", async (req, res): Promise<void> => {
  const params = GetGrillStatsParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [grill] = await db.select().from(grillsTable).where(eq(grillsTable.id, params.data.id));
  if (!grill) {
    res.status(404).json({ error: "Grill not found" });
    return;
  }
  const cooks = await db.select().from(cooksTable).where(eq(cooksTable.grillId, params.data.id));
  const completedCooks = cooks.filter(c => c.status === "completed" && c.actualStartAt && c.actualEndAt);
  let totalMinutes = 0;
  for (const cook of completedCooks) {
    const start = new Date(cook.actualStartAt!).getTime();
    const end = new Date(cook.actualEndAt!).getTime();
    totalMinutes += (end - start) / 60000;
  }
  const foodCounts: Record<string, number> = {};
  for (const cook of cooks) {
    foodCounts[cook.foodType] = (foodCounts[cook.foodType] || 0) + 1;
  }
  const mostCookedFood = Object.keys(foodCounts).sort((a, b) => foodCounts[b] - foodCounts[a])[0] ?? null;
  const tempsWithData = cooks.filter(c => c.targetTempF != null);
  const avgTargetTempF = tempsWithData.length > 0
    ? tempsWithData.reduce((s, c) => s + c.targetTempF!, 0) / tempsWithData.length
    : null;

  res.json({
    grillId: params.data.id,
    totalCooks: cooks.length,
    totalHours: totalMinutes / 60,
    avgCookDurationMinutes: completedCooks.length > 0 ? totalMinutes / completedCooks.length : 0,
    mostCookedFood,
    avgTargetTempF,
  });
});

export default router;
