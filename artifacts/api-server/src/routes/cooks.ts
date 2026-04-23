import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, grillsTable, alertsTable } from "@workspace/db";
import {
  CreateCookBody,
  UpdateCookBody,
  GetCookParams,
  UpdateCookParams,
  DeleteCookParams,
  ListCooksQueryParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { clearHomeInsightsCache } from "./ai";

const router: IRouter = Router();

router.get("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListCooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { grillId, status } = parsed.data;
  const conditions: ReturnType<typeof eq>[] = [eq(cooksTable.userId, req.userId)];
  if (grillId != null) conditions.push(eq(cooksTable.grillId, grillId));
  if (status != null) conditions.push(eq(cooksTable.status, status));

  const cooks = await db.select().from(cooksTable)
    .where(and(...conditions))
    .orderBy(cooksTable.createdAt);

  const result = await Promise.all(cooks.map(async (cook) => {
    let grillName: string | null = null;
    if (cook.grillId) {
      const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
      grillName = grill?.name ?? null;
    }
    return { ...cook, grillName };
  }));
  res.json(result);
});

router.post("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const analysisResult = req.body.analysisResult ?? null;
  const [cook] = await db.insert(cooksTable).values({
    ...parsed.data,
    userId: req.userId,
    status: parsed.data.status ?? "planned",
    ...(analysisResult !== null ? { analysisResult } : {}),
  }).returning();
  if (cook.grillId) {
    await db.update(grillsTable).set({ totalCooks: (await db.select({ tc: grillsTable.totalCooks }).from(grillsTable).where(eq(grillsTable.id, cook.grillId)))[0]?.tc + 1 || 1 }).where(eq(grillsTable.id, cook.grillId));
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  res.status(201).json({ ...cook, grillName });
});

router.get("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  res.json({ ...cook, grillName });
});

router.patch("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  if (req.body.analysisResult !== undefined) {
    updateData.analysisResult = req.body.analysisResult;
    // Append to history — fetch current history first, then accumulate
    const [current] = await db
      .select({ analysisHistory: cooksTable.analysisHistory })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    const existingHistory = Array.isArray(current?.analysisHistory) ? (current.analysisHistory as unknown[]) : [];
    updateData.analysisHistory = [
      ...existingHistory,
      { ...req.body.analysisResult, savedAt: new Date().toISOString() },
    ];
  }
  const [cook] = await db.update(cooksTable).set(updateData)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)))
    .returning();
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  res.json({ ...cook, grillName });
});

router.delete("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  await db.delete(alertsTable).where(eq(alertsTable.cookId, params.data.id));
  await db.delete(cooksTable).where(eq(cooksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
