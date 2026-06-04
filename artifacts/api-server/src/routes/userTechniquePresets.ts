import { Router, type IRouter } from "express";
import { eq, and, asc } from "drizzle-orm";
import { db, userTechniquePresetsTable } from "@workspace/db";
import {
  CreateUserTechniquePresetBody,
  DeleteUserTechniquePresetParams,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/user-technique-presets", requireAuth, async (req: any, res): Promise<void> => {
  const { cutName } = req.query as { cutName?: string };

  const rows = cutName
    ? await db
        .select()
        .from(userTechniquePresetsTable)
        .where(and(
          eq(userTechniquePresetsTable.userId, req.userId),
          eq(userTechniquePresetsTable.cutName, cutName),
        ))
        .orderBy(asc(userTechniquePresetsTable.createdAt))
    : await db
        .select()
        .from(userTechniquePresetsTable)
        .where(eq(userTechniquePresetsTable.userId, req.userId))
        .orderBy(asc(userTechniquePresetsTable.cutName), asc(userTechniquePresetsTable.createdAt));

  res.json(rows);
});

router.post("/user-technique-presets", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateUserTechniquePresetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [preset] = await db
    .insert(userTechniquePresetsTable)
    .values({ ...parsed.data, userId: req.userId })
    .returning();
  res.status(201).json(preset);
});

router.delete("/user-technique-presets/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteUserTechniquePresetParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [deleted] = await db
    .delete(userTechniquePresetsTable)
    .where(and(
      eq(userTechniquePresetsTable.id, params.data.id),
      eq(userTechniquePresetsTable.userId, req.userId),
    ))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Preset not found" });
    return;
  }
  res.status(204).send();
});

export default router;
