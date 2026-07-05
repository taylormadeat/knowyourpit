import { Router, type IRouter } from "express";
import { eq, sql, desc, and, inArray } from "drizzle-orm";
import { db, grillsTable, cooksTable, temperatureReadingsTable } from "@workspace/db";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

router.get("/dashboard/summary", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const [grillCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(grillsTable)
    .where(eq(grillsTable.userId, userId));
  const [cookCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(eq(cooksTable.userId, userId));
  const [plannedCookCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "planned")));
  const [activeCookCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "active")));
  const ratedCooks = await db
    .select({ rating: cooksTable.rating })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), sql`${cooksTable.rating} IS NOT NULL`));
  const avgCookRating = ratedCooks.length > 0
    ? ratedCooks.reduce((s, c) => s + (c.rating ?? 0), 0) / ratedCooks.length
    : null;

  const grillUsage = await db
    .select({ grillId: cooksTable.grillId, count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), sql`${cooksTable.grillId} IS NOT NULL`))
    .groupBy(cooksTable.grillId)
    .orderBy(sql`count(*) DESC`)
    .limit(1);

  let mostUsedGrill: string | null = null;
  if (grillUsage[0]?.grillId) {
    const [grill] = await db
      .select({ name: grillsTable.name })
      .from(grillsTable)
      .where(and(eq(grillsTable.id, grillUsage[0].grillId), eq(grillsTable.userId, userId)));
    mostUsedGrill = grill?.name ?? null;
  }

  const foodCounts = await db
    .select({ foodType: cooksTable.foodType, count: sql<number>`count(*)` })
    .from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .groupBy(cooksTable.foodType)
    .orderBy(sql`count(*) DESC`)
    .limit(1);
  const favoriteFood = foodCounts[0]?.foodType ?? null;

  const completedCooks = await db
    .select({
      actualStartAt: cooksTable.actualStartAt,
      actualEndAt: cooksTable.actualEndAt,
    })
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
    totalCooks: Number(cookCount.count),
    totalGrills: Number(grillCount.count),
    plannedCooks: Number(plannedCookCount.count),
    activeCooks: Number(activeCookCount.count),
    avgCookRating,
    mostUsedGrill,
    favoriteFood,
    totalHoursCooking,
  });
});

router.get("/dashboard/recent-cooks", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const cooks = await db
    .select()
    .from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .orderBy(desc(cooksTable.createdAt))
    .limit(10);
  const result = await Promise.all(cooks.map(async (cook) => {
    let grillName: string | null = null;
    if (cook.grillId) {
      const [grill] = await db
        .select({ name: grillsTable.name })
        .from(grillsTable)
        .where(and(eq(grillsTable.id, cook.grillId), eq(grillsTable.userId, userId)));
      grillName = grill?.name ?? null;
    }
    let currentTempF: number | null = null;
    let currentMeatTempF: number | null = null;
    let currentPitTempF: number | null = null;
    if (cook.status === "active") {
      const [latestOverall, latestMeat, latestPit] = await Promise.all([
        db
          .select({ tempF: temperatureReadingsTable.tempF })
          .from(temperatureReadingsTable)
          .where(eq(temperatureReadingsTable.cookId, cook.id))
          .orderBy(desc(temperatureReadingsTable.recordedAt))
          .limit(1),
        db
          .select({ tempF: temperatureReadingsTable.tempF })
          .from(temperatureReadingsTable)
          .where(and(eq(temperatureReadingsTable.cookId, cook.id), eq(temperatureReadingsTable.probeNumber, 0)))
          .orderBy(desc(temperatureReadingsTable.recordedAt))
          .limit(1),
        db
          .select({ tempF: temperatureReadingsTable.tempF })
          .from(temperatureReadingsTable)
          .where(and(eq(temperatureReadingsTable.cookId, cook.id), eq(temperatureReadingsTable.probeNumber, 1)))
          .orderBy(desc(temperatureReadingsTable.recordedAt))
          .limit(1),
      ]);
      currentTempF = latestOverall[0]?.tempF ?? null;
      currentMeatTempF = latestMeat[0]?.tempF ?? null;
      currentPitTempF = latestPit[0]?.tempF ?? null;
    }
    return { ...cook, grillName, currentTempF, currentMeatTempF, currentPitTempF };
  }));
  res.json(result);
});

router.get("/dashboard/temperature-history", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const cookIds = await db
    .select({ id: cooksTable.id, foodType: cooksTable.foodType, createdAt: cooksTable.createdAt })
    .from(cooksTable)
    .where(and(eq(cooksTable.userId, userId), eq(cooksTable.status, "completed")))
    .orderBy(desc(cooksTable.createdAt))
    .limit(20);

  if (cookIds.length === 0) {
    res.json([]);
    return;
  }

  const result = await Promise.all(cookIds.map(async (cook) => {
    const readings = await db
      .select({ tempF: temperatureReadingsTable.tempF })
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
