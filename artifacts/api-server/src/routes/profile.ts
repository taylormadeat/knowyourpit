import { Router, type IRouter } from "express";
import { eq, and, sql, inArray } from "drizzle-orm";
import { clerkClient } from "@clerk/express";
import {
  db,
  cooksTable,
  alertsTable,
  conversations,
  customMeatCutsTable,
  grillsTable,
  meaterCredentialsTable,
  thermoworksCredentialsTable,
  subscriptionEntitlements,
  aiAnalyzeEvents,
  temperatureReadingsTable,
} from "@workspace/db";
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

router.delete("/profile/me", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  try {
    await db.transaction(async (tx) => {
      const userCooks = await tx
        .select({ id: cooksTable.id })
        .from(cooksTable)
        .where(eq(cooksTable.userId, userId));
      const cookIds = userCooks.map((c) => c.id);

      if (cookIds.length > 0) {
        await tx
          .delete(temperatureReadingsTable)
          .where(inArray(temperatureReadingsTable.cookId, cookIds));
      }

      await tx.delete(aiAnalyzeEvents).where(eq(aiAnalyzeEvents.userId, userId));
      await tx.delete(alertsTable).where(eq(alertsTable.userId, userId));
      await tx.delete(conversations).where(eq(conversations.userId, userId));
      await tx.delete(customMeatCutsTable).where(eq(customMeatCutsTable.userId, userId));
      await tx.delete(cooksTable).where(eq(cooksTable.userId, userId));
      await tx.delete(grillsTable).where(eq(grillsTable.userId, userId));
      await tx.delete(meaterCredentialsTable).where(eq(meaterCredentialsTable.userId, userId));
      await tx.delete(thermoworksCredentialsTable).where(eq(thermoworksCredentialsTable.userId, userId));
      await tx.delete(subscriptionEntitlements).where(eq(subscriptionEntitlements.userId, userId));
    });
  } catch (err) {
    req.log.error({ err, userId }, "account deletion: db cleanup failed");
    res.status(500).json({ error: "Failed to delete account data. Please try again." });
    return;
  }

  try {
    await clerkClient.users.deleteUser(userId);
  } catch (err) {
    req.log.error({ err, userId }, "account deletion: clerk delete failed");
    // Data was wiped successfully; only the auth account could not be removed.
    // Return 200 with a partial-success body so the client signs the user out
    // (their data is gone — they should not stay signed in) and shows a
    // distinct, accurate message instead of a generic failure.
    res.status(200).json({
      ok: true,
      dataDeleted: true,
      accountDeleted: false,
      message:
        "Your data was deleted, but your sign-in account could not be removed automatically. Please email support@knowyourpit.com to finish closing it.",
    });
    return;
  }

  res.json({ ok: true, dataDeleted: true, accountDeleted: true });
});

export default router;
