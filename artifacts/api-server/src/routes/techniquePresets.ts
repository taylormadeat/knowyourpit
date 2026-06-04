import { Router, type IRouter } from "express";
import { db, techniquePresetsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";

const router: IRouter = Router();

router.get("/technique-presets", async (req, res): Promise<void> => {
  const { cutName } = req.query as { cutName?: string };

  const rows = cutName
    ? await db
        .select()
        .from(techniquePresetsTable)
        .where(eq(techniquePresetsTable.cutName, cutName))
        .orderBy(asc(techniquePresetsTable.sortOrder))
    : await db
        .select()
        .from(techniquePresetsTable)
        .orderBy(asc(techniquePresetsTable.cutName), asc(techniquePresetsTable.sortOrder));

  res.json(rows);
});

export default router;
