import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, grillsTable } from "@workspace/db";
import {
  CreateCookBody,
  UpdateCookBody,
  GetCookParams,
  UpdateCookParams,
  DeleteCookParams,
  ListCooksQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/cooks", async (req, res): Promise<void> => {
  const parsed = ListCooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { grillId, status } = parsed.data;
  const conditions = [];
  if (grillId != null) conditions.push(eq(cooksTable.grillId, grillId));
  if (status != null) conditions.push(eq(cooksTable.status, status));

  const cooks = await db.select().from(cooksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
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

router.post("/cooks", async (req, res): Promise<void> => {
  const parsed = CreateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cook] = await db.insert(cooksTable).values({
    ...parsed.data,
    status: parsed.data.status ?? "planned",
  }).returning();
  if (cook.grillId) {
    await db.update(grillsTable).set({ totalCooks: (await db.select({ tc: grillsTable.totalCooks }).from(grillsTable).where(eq(grillsTable.id, cook.grillId)))[0]?.tc + 1 || 1 }).where(eq(grillsTable.id, cook.grillId));
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  res.status(201).json({ ...cook, grillName });
});

router.get("/cooks/:id", async (req, res): Promise<void> => {
  const params = GetCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable).where(eq(cooksTable.id, params.data.id));
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

router.patch("/cooks/:id", async (req, res): Promise<void> => {
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
  const [cook] = await db.update(cooksTable).set(updateData).where(eq(cooksTable.id, params.data.id)).returning();
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

router.delete("/cooks/:id", async (req, res): Promise<void> => {
  const params = DeleteCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db.delete(cooksTable).where(eq(cooksTable.id, params.data.id)).returning();
  if (!deleted) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
