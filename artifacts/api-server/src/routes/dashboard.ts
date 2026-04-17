import { Router, type IRouter } from "express";
import { eq, sql, desc } from "drizzle-orm";
import { db, grillsTable, cooksTable, recipesTable, alertsTable, temperatureReadingsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [grillCount] = await db.select({ count: sql<number>`count(*)` }).from(grillsTable);
  const [cookCount] = await db.select({ count: sql<number>`count(*)` }).from(cooksTable);
  const [plannedCookCount] = await db.select({ count: sql<number>`count(*)` }).from(cooksTable).where(eq(cooksTable.status, "planned"));
  const [recipeCount] = await db.select({ count: sql<number>`count(*)` }).from(recipesTable);
  const [alertCount] = await db.select({ count: sql<number>`count(*)` }).from(alertsTable).where(eq(alertsTable.isActive, true));

  const ratedCooks = await db.select({ rating: cooksTable.rating }).from(cooksTable).where(sql`${cooksTable.rating} IS NOT NULL`);
  const avgCookRating = ratedCooks.length > 0
    ? ratedCooks.reduce((s, c) => s + (c.rating ?? 0), 0) / ratedCooks.length
    : null;

  const grillUsage = await db.select({ grillId: cooksTable.grillId, count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(sql`${cooksTable.grillId} IS NOT NULL`)
    .groupBy(cooksTable.grillId)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  let mostUsedGrill: string | null = null;
  if (grillUsage[0]?.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, grillUsage[0].grillId));
    mostUsedGrill = grill?.name ?? null;
  }

  const foodCounts = await db.select({ foodType: cooksTable.foodType, count: sql<number>`count(*)` })
    .from(cooksTable)
    .groupBy(cooksTable.foodType)
    .orderBy(sql`count(*) DESC`)
    .limit(1);
  const favoriteFood = foodCounts[0]?.foodType ?? null;

  const completedCooks = await db.select({
    actualStartAt: cooksTable.actualStartAt,
    actualEndAt: cooksTable.actualEndAt
  }).from(cooksTable).where(eq(cooksTable.status, "completed"));

  let totalHoursCooking = 0;
  for (const cook of completedCooks) {
    if (cook.actualStartAt && cook.actualEndAt) {
      const ms = new Date(cook.actualEndAt).getTime() - new Date(cook.actualStartAt).getTime();
      totalHoursCooking += ms / 3600000;
    }
  }

  res.json({
    totalCooks: Number(cookCount.count),
    totalGrills: Number(grillCount.count),
    plannedCooks: Number(plannedCookCount.count),
    totalRecipes: Number(recipeCount.count),
    avgCookRating,
    mostUsedGrill,
    favoriteFood,
    totalHoursCooking,
    activeAlerts: Number(alertCount.count),
  });
});

router.get("/dashboard/recent-cooks", async (_req, res): Promise<void> => {
  const cooks = await db.select().from(cooksTable).orderBy(desc(cooksTable.createdAt)).limit(10);
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

router.get("/dashboard/temperature-history", async (_req, res): Promise<void> => {
  const cookIds = await db.select({ id: cooksTable.id, foodType: cooksTable.foodType, createdAt: cooksTable.createdAt })
    .from(cooksTable)
    .where(eq(cooksTable.status, "completed"))
    .orderBy(desc(cooksTable.createdAt))
    .limit(20);

  const result = await Promise.all(cookIds.map(async (cook) => {
    const readings = await db.select({ tempF: temperatureReadingsTable.tempF })
      .from(temperatureReadingsTable)
      .where(eq(temperatureReadingsTable.cookId, cook.id));

    const temps = readings.map(r => r.tempF);
    const avgTempF = temps.length > 0 ? temps.reduce((a, b) => a + b, 0) / temps.length : 0;
    const maxTempF = temps.length > 0 ? Math.max(...temps) : 0;
    const minTempF = temps.length > 0 ? Math.min(...temps) : 0;

    return {
      cookId: cook.id,
      foodType: cook.foodType,
      avgTempF,
      maxTempF,
      minTempF,
      readingCount: temps.length,
      cookedAt: cook.createdAt.toISOString(),
    };
  }));

  res.json(result.filter(r => r.readingCount > 0));
});

export default router;
