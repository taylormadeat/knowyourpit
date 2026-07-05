import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq } from "drizzle-orm";
import { db, cooksTable, temperatureReadingsTable } from "@workspace/db";

vi.mock("../../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = TEST_USER_ID;
    next();
  },
}));

const TEST_USER_ID = "test-user-dashboard-1394";

let dashboardRouter: (typeof import("../dashboard"))["default"];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", dashboardRouter);
  return app;
}

async function insertCook(overrides: Partial<typeof cooksTable.$inferInsert> = {}) {
  const [cook] = await db
    .insert(cooksTable)
    .values({
      userId: TEST_USER_ID,
      foodType: "brisket",
      status: "active",
      targetTempF: 203,
      cookTempF: 225,
      ...overrides,
    })
    .returning();
  return cook;
}

async function insertReading(cookId: number, probeNumber: number, tempF: number, secondsAgo: number) {
  await db.insert(temperatureReadingsTable).values({
    cookId,
    probeNumber,
    tempF,
    recordedAt: new Date(Date.now() - secondsAgo * 1000),
    source: "manual",
  });
}

const insertedCookIds: number[] = [];

describe("GET /dashboard/recent-cooks — multi-probe temp resolution", () => {
  beforeAll(async () => {
    dashboardRouter = (await import("../dashboard")).default;
  });

  afterAll(async () => {
    if (insertedCookIds.length > 0) {
      for (const id of insertedCookIds) {
        await db.delete(temperatureReadingsTable).where(eq(temperatureReadingsTable.cookId, id));
      }
      await db.delete(cooksTable).where(eq(cooksTable.userId, TEST_USER_ID));
    }
  });

  it("resolves the meat chip from a second meat probe (probeNumber != 0) instead of falling back to target", async () => {
    const cook = await insertCook();
    insertedCookIds.push(cook.id);

    // Only a non-zero, non-pit probeNumber reports for this cook (e.g. a
    // second meat probe, or a CSV-imported reading with a different probe
    // index). Strict `probeNumber = 0` matching would miss this entirely and
    // incorrectly fall back to the planned target temp.
    await insertReading(cook.id, 2, 172, 30);
    await insertReading(cook.id, 1, 240, 30);

    const app = buildApp();
    const res = await request(app).get("/api/dashboard/recent-cooks");

    expect(res.status).toBe(200);
    const found = res.body.find((c: any) => c.id === cook.id);
    expect(found).toBeDefined();
    expect(found.currentMeatTempF).toBe(172);
    expect(found.currentPitTempF).toBe(240);
  });

  it("picks the most recently reported meat probe when multiple non-pit probes have readings", async () => {
    const cook = await insertCook();
    insertedCookIds.push(cook.id);

    // Primary meat probe (probeNumber 0) reported a while ago; a second meat
    // probe (probeNumber 2) reported more recently. The chip should reflect
    // whichever probe actually has the freshest data, not always slot 0.
    await insertReading(cook.id, 0, 150, 600);
    await insertReading(cook.id, 2, 165, 15);

    const app = buildApp();
    const res = await request(app).get("/api/dashboard/recent-cooks");

    const found = res.body.find((c: any) => c.id === cook.id);
    expect(found.currentMeatTempF).toBe(165);
  });

  it("returns null (not a stale/target value) when no readings exist at all", async () => {
    const cook = await insertCook({ targetTempF: 195, cookTempF: 250 });
    insertedCookIds.push(cook.id);

    const app = buildApp();
    const res = await request(app).get("/api/dashboard/recent-cooks");

    const found = res.body.find((c: any) => c.id === cook.id);
    expect(found.currentMeatTempF).toBeNull();
    expect(found.currentPitTempF).toBeNull();
  });
});
