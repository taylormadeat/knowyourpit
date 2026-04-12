import { Router, type IRouter } from "express";
import { eq, sql, and } from "drizzle-orm";
import { db, grillsTable, cooksTable, temperatureReadingsTable } from "@workspace/db";
import {
  CreateGrillBody,
  UpdateGrillBody,
  GetGrillParams,
  UpdateGrillParams,
  DeleteGrillParams,
  GetGrillStatsParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const PIT_PROBE_NAMES = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
const isPitProbe = (name: string | null) =>
  name ? PIT_PROBE_NAMES.some(k => name.toLowerCase().includes(k)) : false;

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

  // ── Temperature aggregates from readings ──────────────────────────────────
  const readings = await db.select().from(temperatureReadingsTable)
    .where(eq(temperatureReadingsTable.grillId, params.data.id));

  const pitReadings = readings.filter(r => isPitProbe(r.probeName));
  const probeReadings = readings.filter(r => !isPitProbe(r.probeName));

  const avgPitTempF = pitReadings.length > 0
    ? pitReadings.reduce((s, r) => s + r.tempF, 0) / pitReadings.length
    : null;

  // Per-cook pit temp variance: avg(max-min per cook)
  let pitTempVarianceF: number | null = null;
  if (pitReadings.length > 0) {
    const byCook: Record<number, number[]> = {};
    for (const r of pitReadings) {
      if (!byCook[r.cookId]) byCook[r.cookId] = [];
      byCook[r.cookId].push(r.tempF);
    }
    const variances = Object.values(byCook).map(temps => Math.max(...temps) - Math.min(...temps));
    pitTempVarianceF = variances.length > 0 ? variances.reduce((a, b) => a + b, 0) / variances.length : null;
  }

  const probeHighTempF = probeReadings.length > 0
    ? Math.max(...probeReadings.map(r => r.tempF))
    : null;

  res.json({
    grillId: params.data.id,
    totalCooks: cooks.length,
    totalHours: totalMinutes / 60,
    avgCookDurationMinutes: completedCooks.length > 0 ? totalMinutes / completedCooks.length : 0,
    mostCookedFood,
    avgTargetTempF,
    avgPitTempF,
    pitTempVarianceF,
    probeHighTempF,
    totalReadings: readings.length,
  });
});

export default router;
