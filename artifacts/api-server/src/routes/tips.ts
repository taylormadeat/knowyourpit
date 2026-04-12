import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cookingTipsTable } from "@workspace/db";
import { ListTipsQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/tips", async (req, res): Promise<void> => {
  const parsed = ListTipsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { category } = parsed.data;
  const conditions = category != null ? [eq(cookingTipsTable.category, category)] : [];
  const tips = await db.select().from(cookingTipsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  res.json(tips);
});

export default router;
