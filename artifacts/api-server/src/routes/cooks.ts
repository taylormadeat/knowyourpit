import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, grillsTable, alertsTable } from "@workspace/db";
import {
  CreateCookBody,
  UpdateCookBody,
  GetCookParams,
  UpdateCookParams,
  DeleteCookParams,
  ListCooksQueryParams,
  UpdateSessionParams,
  UpdateSessionBody,
} from "@workspace/api-zod";
import { requireAuth } from "../middlewares/requireAuth";
import { clearHomeInsightsCache } from "./ai";
import {
  FREE_COOK_LIMIT,
  respondPaywall,
  countCooksForUser,
  countActiveCooksForUser,
  countPlannedCooksForUser,
  countGradedCooksForUser,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../lib/paywall";

const router: IRouter = Router();

router.get("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListCooksQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { grillId, status } = parsed.data;
  const conditions: ReturnType<typeof eq>[] = [eq(cooksTable.userId, req.userId)];
  if (grillId != null) conditions.push(eq(cooksTable.grillId, grillId));
  if (status != null) conditions.push(eq(cooksTable.status, status));

  const cooks = await db.select().from(cooksTable)
    .where(and(...conditions))
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

router.post("/cooks", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = CreateCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Free-tier caps. Pro subscribers and PAYWALL_ENABLED=false bypass all gates.
  if (!(await userBypassesPaywall(req))) {
    // 1. Total cook cap
    const existingCount = await countCooksForUser(req.userId);
    if (existingCount >= FREE_COOK_LIMIT) {
      respondPaywall(res, {
        code: "cook_limit_reached",
        limit: FREE_COOK_LIMIT,
        used: existingCount,
        message: `Free plan is capped at ${FREE_COOK_LIMIT} cooks. Upgrade to Pro for unlimited.`,
      });
      return;
    }
    // 2. Planned cook cap (default status is "planned")
    const incomingStatus = parsed.data.status ?? "planned";
    if (incomingStatus === "planned") {
      const plannedCount = await countPlannedCooksForUser(req.userId);
      if (plannedCount >= 1) {
        respondPaywall(res, {
          code: "planned_cook_limit_reached",
          message: "Free plan only allows one planned cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    // 2b. Active cook cap (if POST is called with status="active" directly)
    if (incomingStatus === "active") {
      const activeCount = await countActiveCooksForUser(req.userId);
      if (activeCount >= 1) {
        respondPaywall(res, {
          code: "active_cook_limit_reached",
          message: "Free plan only allows one active cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    // 3. Graded cook cap (POST with an analysisResult that has a verdict)
    const incomingVerdict = req.body?.analysisResult?.assessment?.verdict;
    if (incomingVerdict != null) {
      const gradedCount = await countGradedCooksForUser(req.userId);
      if (gradedCount >= 1) {
        respondPaywall(res, {
          code: "graded_cook_limit_reached",
          message: "Free plan includes one AI-graded cook. Upgrade for unlimited.",
        });
        return;
      }
    }
  }

  const analysisResult = req.body.analysisResult ?? null;
  const [cook] = await db.insert(cooksTable).values({
    ...parsed.data,
    userId: req.userId,
    status: parsed.data.status ?? "planned",
    ...(analysisResult !== null ? { analysisResult } : {}),
  }).returning();
  if (cook.grillId) {
    await db.update(grillsTable).set({ totalCooks: (await db.select({ tc: grillsTable.totalCooks }).from(grillsTable).where(eq(grillsTable.id, cook.grillId)))[0]?.tc + 1 || 1 }).where(eq(grillsTable.id, cook.grillId));
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  res.status(201).json({ ...cook, grillName });
});

router.get("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = GetCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
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

router.patch("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
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
  // Free-tier caps on status transitions and graded-cook saves.
  if (!(await userBypassesPaywall(req))) {
    if (parsed.data.status === "planned") {
      // Exclude the current cook so re-saving an already-planned cook is never blocked.
      const plannedCount = await countPlannedCooksForUser(req.userId, params.data.id);
      if (plannedCount >= 1) {
        respondPaywall(res, {
          code: "planned_cook_limit_reached",
          message: "Free plan only allows one planned cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    if (parsed.data.status === "active") {
      // Exclude the current cook so re-saving an already-active cook is never blocked.
      const activeCount = await countActiveCooksForUser(req.userId, params.data.id);
      if (activeCount >= 1) {
        respondPaywall(res, {
          code: "active_cook_limit_reached",
          message: "Free plan only allows one active cook at a time. Upgrade to Pro for unlimited.",
        });
        return;
      }
    }
    const patchVerdict = req.body?.analysisResult?.assessment?.verdict;
    if (patchVerdict != null) {
      // Exclude the current cook so re-grading the same cook is always allowed.
      const gradedCount = await countGradedCooksForUser(req.userId, params.data.id);
      if (gradedCount >= 1) {
        respondPaywall(res, {
          code: "graded_cook_limit_reached",
          message: "Free plan includes one AI-graded cook. Upgrade for unlimited.",
        });
        return;
      }
    }
  }

  const updateData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) updateData[k] = v;
  }
  if (req.body.analysisResult !== undefined) {
    updateData.analysisResult = req.body.analysisResult;
    // Append to history — fetch current history first, then accumulate
    const [current] = await db
      .select({ analysisHistory: cooksTable.analysisHistory })
      .from(cooksTable)
      .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
    const existingHistory = Array.isArray(current?.analysisHistory) ? (current.analysisHistory as unknown[]) : [];
    updateData.analysisHistory = [
      ...existingHistory,
      { ...req.body.analysisResult, savedAt: new Date().toISOString() },
    ];
  }
  if ("sessionId" in req.body) {
    const sid = req.body.sessionId;
    if (sid !== null && typeof sid !== "string") {
      res.status(400).json({ error: "sessionId must be a string or null" });
      return;
    }
    updateData.sessionId = sid ?? null;
  }
  const [cook] = await db.update(cooksTable).set(updateData)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)))
    .returning();
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  let grillName: string | null = null;
  if (cook.grillId) {
    const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
    grillName = grill?.name ?? null;
  }
  clearHomeInsightsCache(req.userId);
  res.json({ ...cook, grillName });
});

router.get("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const cooks = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  if (!cooks.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const result = await Promise.all(cooks.map(async (cook) => {
    let grillName: string | null = null;
    if (cook.grillId) {
      const [grill] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
      grillName = grill?.name ?? null;
    }
    return { ...cook, grillName };
  }));
  result.sort((a, b) => {
    const aTime = a.plannedStartAt ? new Date(a.plannedStartAt).getTime() : Infinity;
    const bTime = b.plannedStartAt ? new Date(b.plannedStartAt).getTime() : Infinity;
    return aTime - bTime;
  });
  res.json(result);
});

router.patch("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [first] = await db.select({ id: cooksTable.id }).from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)))
    .limit(1);
  if (!first) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  const updateData: Record<string, unknown> = {};
  if (parsed.data.sessionLabel !== undefined) updateData.sessionLabel = parsed.data.sessionLabel;
  if (parsed.data.sessionNotes !== undefined) updateData.sessionNotes = parsed.data.sessionNotes;
  await db.update(cooksTable).set(updateData)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  res.json({ sessionId: params.data.sessionId, ...parsed.data });
});

router.delete("/sessions/:sessionId", requireAuth, async (req: any, res): Promise<void> => {
  const params = UpdateSessionParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const cooks = await db.select({ id: cooksTable.id }).from(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  if (!cooks.length) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  for (const cook of cooks) {
    await db.delete(alertsTable).where(eq(alertsTable.cookId, cook.id));
  }
  await db.delete(cooksTable)
    .where(and(eq(cooksTable.sessionId, params.data.sessionId), eq(cooksTable.userId, req.userId)));
  res.sendStatus(204);
});

router.delete("/cooks/:id", requireAuth, async (req: any, res): Promise<void> => {
  const params = DeleteCookParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [cook] = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.id, params.data.id), eq(cooksTable.userId, req.userId)));
  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }
  await db.delete(alertsTable).where(eq(alertsTable.cookId, params.data.id));
  await db.delete(cooksTable).where(eq(cooksTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
