import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, cooksTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/profile/stats", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId;

  const [totalRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(eq(cooksTable.userId, userId));

  const [completedRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "completed")));

  const ratedCooks = await db
    .select({ rating: cooksTable.rating })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), sql`${cooksTable.rating} IS NOT NULL`));

  const avgRating =
    ratedCooks.length > 0
      ? ratedCooks.reduce((s, c) => s + (c.rating ?? 0), 0) / ratedCooks.length
      : null;

  const foodCounts = await db
    .select({ foodType: cooksTable.foodType, count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), sql`${cooksTable.foodType} IS NOT NULL`))
    .groupBy(cooksTable.foodType)
    .orderBy(sql`count(*) DESC`);

  const favoriteFood = foodCounts[0]?.foodType ?? null;
  const foodTypeBreakdown = foodCounts.map((r) => ({
    foodType: r.foodType as string,
    count: Number(r.count),
  }));

  const completedCooks = await db
    .select({ actualStartAt: cooksTable.actualStartAt, actualEndAt: cooksTable.actualEndAt })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "completed")));

  let totalHoursCooking = 0;
  for (const cook of completedCooks) {
    if (cook.actualStartAt && cook.actualEndAt) {
      const ms = new Date(cook.actualEndAt).getTime() - new Date(cook.actualStartAt).getTime();
      totalHoursCooking += ms / 3600000;
    }
  }

  res.json({
    totalCooks: Number(totalRow?.count ?? 0),
    completedCooks: Number(completedRow?.count ?? 0),
    avgRating,
    favoriteFood,
    totalHoursCooking: Math.round(totalHoursCooking * 10) / 10,
    foodTypeBreakdown,
  });
});

export default router;
