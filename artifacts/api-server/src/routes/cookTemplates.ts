import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cookTemplatesTable } from "@workspace/db";
import {
  CreateCookTemplateBody,
  UpdateCookTemplateBody,
  UpdateCookTemplateParams,
  DeleteCookTemplateParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/cook-templates", requireAuth, async (req: any, res): Promise<void> => {
  const templates = await db
    .select()
    .from(cookTemplatesTable)
    .where(eq(cookTemplatesTable.userId, req.userId))
    .orderBy(desc(cookTemplatesTable.updatedAt));
  res.json(templates);
});

router.post("/cook-templates", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateCookTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [tpl] = await db
    .insert(cookTemplatesTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();
  res.status(201).json(tpl);
});

router.patch("/cook-templates/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateCookTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCookTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  if (Object.keys(updateData).length === 0) {
    res.status(400).json({ error: "No fields to update" });
    return;
  }
  const [tpl] = await db
    .update(cookTemplatesTable)
    .set(updateData)
    .where(
      and(
        eq(cookTemplatesTable.id, params.data.id),
        eq(cookTemplatesTable.userId, req.userId),
      ),
    )
    .returning();
  if (!tpl) {
    res.status(404).json({ error: "Cook template not found" });
    return;
  }
  res.json(tpl);
});

router.delete("/cook-templates/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookTemplateParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(cookTemplatesTable)
    .where(
      and(
        eq(cookTemplatesTable.id, params.data.id),
        eq(cookTemplatesTable.userId, req.userId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Cook template not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
