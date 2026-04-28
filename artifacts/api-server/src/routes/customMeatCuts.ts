import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, customMeatCutsTable } from "@workspace/db";
import {
  CreateCustomMeatCutBody,
  UpdateCustomMeatCutBody,
  UpdateCustomMeatCutParams,
  DeleteCustomMeatCutParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/custom-meat-cuts", requireAuth, async (req: any, res): Promise<void> => {
  const cuts = await db
    .select()
    .from(customMeatCutsTable)
    .where(eq(customMeatCutsTable.userId, req.userId))
    .orderBy(asc(customMeatCutsTable.category), asc(customMeatCutsTable.name));
  res.json(cuts);
});

router.post("/custom-meat-cuts", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateCustomMeatCutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [cut] = await db
    .insert(customMeatCutsTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();
  res.status(201).json(cut);
});

router.patch("/custom-meat-cuts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateCustomMeatCutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateCustomMeatCutBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== null && v !== undefined) updateData[k] = v;
  }
  const [cut] = await db
    .update(customMeatCutsTable)
    .set(updateData)
    .where(
      and(
        eq(customMeatCutsTable.id, params.data.id),
        eq(customMeatCutsTable.userId, req.userId),
      ),
    )
    .returning();
  if (!cut) {
    res.status(404).json({ error: "Custom meat cut not found" });
    return;
  }
  res.json(cut);
});

router.delete("/custom-meat-cuts/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCustomMeatCutParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(customMeatCutsTable)
    .where(
      and(
        eq(customMeatCutsTable.id, params.data.id),
        eq(customMeatCutsTable.userId, req.userId),
      ),
    )
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Custom meat cut not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
