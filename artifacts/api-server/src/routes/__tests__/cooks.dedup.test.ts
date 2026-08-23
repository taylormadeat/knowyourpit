/**
 * Tests proving that two concurrent identical POST /cooks requests can never
 * create duplicate rows.
 *
 * Two paths are exercised:
 *  1. True concurrency — both requests land simultaneously; the unique index
 *     (cooks_session_dedup_idx) or the pre-insert guard ensures exactly one row.
 *  2. 23505 fallback — the pre-insert guard is bypassed (simulated via a
 *     module-level mock on db.insert / db.select) and the insert raises a
 *     unique-constraint violation; the catch block must fetch and return the
 *     existing row instead of surfacing a 500.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq } from "drizzle-orm";

// ─────────────────────────────────────────────────────────────────────────────
// Hoisted control state — must be created before any vi.mock() factory runs.
// ─────────────────────────────────────────────────────────────────────────────
const ctrl = vi.hoisted(() => ({
  /**
   * When set, the NEXT call to db.select() returns this builder and clears the
   * override; subsequent calls go through to the real db.
   */
  nextSelectResult: null as unknown[] | null,
  /**
   * When true, the next call to db.insert() returns a rejecting builder that
   * mimics the Drizzle-wrapped 23505 unique-constraint error.
   */
  injectInsert23505: false,
  /**
   * Counts how many times the mocked db.insert() was invoked.
   */
  insertCallCount: 0,
}));

// ─────────────────────────────────────────────────────────────────────────────
// @workspace/db mock — wraps the real db so we can intercept individual calls
// while keeping real DB I/O for all other operations.
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("@workspace/db", async (importOriginal) => {
  const original = await importOriginal<typeof import("@workspace/db")>();
  const realDb = original.db;

  /** Returns an awaitable builder that resolves to `rows`. */
  function fakeSelectBuilder(rows: unknown[]) {
    const p = Promise.resolve(rows);
    const b: any = {
      from: () => b,
      where: () => b,
      limit: () => b,
      then: (res: any, rej: any) => p.then(res, rej),
      catch: (rej: any) => p.catch(rej),
      finally: (fn: any) => p.finally(fn),
    };
    return b;
  }

  /** The Drizzle-shaped error produced by drizzle-orm/node-postgres. */
  function make23505Error() {
    const pgCause = Object.assign(new Error("unique_violation"), {
      code: "23505",
      constraint: "cooks_session_dedup_idx",
    });
    return Object.assign(
      new Error(
        'Failed query: insert into "cooks" … duplicate key violates unique constraint "cooks_session_dedup_idx"',
      ),
      { cause: pgCause },
    );
  }

  /** A chainable insert builder whose .returning() rejects with a 23505. */
  function fakeInsertBuilder() {
    const err = make23505Error();
    const b: any = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then" || prop === "catch" || prop === "finally")
            return undefined;
          if (prop === "returning") return () => Promise.reject(err);
          return (..._a: any[]) => b;
        },
      },
    );
    return b;
  }

  const proxyDb: typeof realDb = new Proxy(realDb, {
    get(target, prop, receiver) {
      // ── Intercept select ────────────────────────────────────────────────
      if (prop === "select") {
        if (ctrl.nextSelectResult !== null) {
          const rows = ctrl.nextSelectResult;
          ctrl.nextSelectResult = null; // consume; next call is real
          return (..._args: any[]) => fakeSelectBuilder(rows);
        }
        // Fall through to the real select.
        const fn = Reflect.get(target, prop, receiver);
        return typeof fn === "function" ? fn.bind(target) : fn;
      }

      // ── Intercept insert ────────────────────────────────────────────────
      if (prop === "insert") {
        if (ctrl.injectInsert23505) {
          ctrl.injectInsert23505 = false; // consume flag
          return (..._args: any[]) => {
            ctrl.insertCallCount++;
            return fakeInsertBuilder();
          };
        }
        const fn = Reflect.get(target, prop, receiver);
        return typeof fn === "function" ? fn.bind(target) : fn;
      }

      // All other db methods go through to the real implementation.
      const val = Reflect.get(target, prop, receiver);
      return typeof val === "function" ? val.bind(target) : val;
    },
  });

  return { ...original, db: proxyDb };
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth mock — must precede router import
// ─────────────────────────────────────────────────────────────────────────────
const TEST_USER_ID = "test-user-cooks-dedup-7412";

vi.mock("../../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = TEST_USER_ID;
    next();
  },
}));

// ─────────────────────────────────────────────────────────────────────────────
// Paywall bypass — all dedup tests use a Pro-equivalent user
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("../../lib/paywall", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/paywall")>();
  return {
    ...original,
    userBypassesPaywall: vi.fn().mockResolvedValue(true),
  };
});

// ─────────────────────────────────────────────────────────────────────────────
// Silence side-effect helpers
// ─────────────────────────────────────────────────────────────────────────────
vi.mock("../ai", async (importOriginal) => {
  const original = await importOriginal<typeof import("../ai")>();
  return { ...original, clearHomeInsightsCache: vi.fn() };
});
vi.mock("../../lib/smokerCalibration", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../lib/smokerCalibration")>();
  return { ...original, invalidateSmokerInsightsCache: vi.fn() };
});
vi.mock("../../lib/liveActivityPush", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../lib/liveActivityPush")>();
  return { ...original, endLiveActivitiesForCook: vi.fn().mockResolvedValue(undefined) };
});
vi.mock("../../lib/thinTemperatureReadings", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../../lib/thinTemperatureReadings")>();
  return { ...original, thinTemperatureReadings: vi.fn().mockResolvedValue(undefined) };
});

// ─────────────────────────────────────────────────────────────────────────────
// Imports that depend on the mocked db (must come after vi.mock calls)
// ─────────────────────────────────────────────────────────────────────────────
import { db, cooksTable } from "@workspace/db";
import { clearHomeInsightsCache } from "../ai";
import { invalidateSmokerInsightsCache } from "../../lib/smokerCalibration";
import { endLiveActivitiesForCook } from "../../lib/liveActivityPush";
import { thinTemperatureReadings } from "../../lib/thinTemperatureReadings";

// ─────────────────────────────────────────────────────────────────────────────
// App factory
// ─────────────────────────────────────────────────────────────────────────────
let cooksRouter: (typeof import("../cooks"))["default"];

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api", cooksRouter);
  return app;
}

// Shared session ID; each test uses a unique plannedStartAt to avoid collisions.
const SESSION_ID = "sess-dedup-test-abc123";

// Cook IDs to clean up in afterAll.
const createdCookIds: number[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Request body helper
// ─────────────────────────────────────────────────────────────────────────────
function cookBody(plannedStartAt: string) {
  return {
    foodType: "brisket",
    targetTempF: 203,
    cookTempF: 225,
    status: "planned",
    sessionId: SESSION_ID,
    plannedStartAt,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup / teardown
// ─────────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  cooksRouter = (await import("../cooks")).default;
});

afterAll(async () => {
  for (const id of createdCookIds) {
    await db.delete(cooksTable).where(eq(cooksTable.id, id));
  }
  await db.delete(cooksTable).where(eq(cooksTable.userId, TEST_USER_ID));
});

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /cooks — idempotency / dedup", () => {
  /**
   * Fire two truly concurrent identical requests using Promise.all.
   * Exactly one DB row should exist; both callers receive the same cook.
   */
  it("concurrent identical creates produce exactly one row and both callers receive the same cook", async () => {
    const plannedStartAt = new Date(Date.now() + 3_600_000).toISOString();
    const app = buildApp();

    const [res1, res2] = await Promise.all([
      request(app).post("/api/cooks").send(cookBody(plannedStartAt)),
      request(app).post("/api/cooks").send(cookBody(plannedStartAt)),
    ]);

    expect([200, 201]).toContain(res1.status);
    expect([200, 201]).toContain(res2.status);
    expect(typeof res1.body.id).toBe("number");
    expect(typeof res2.body.id).toBe("number");
    expect(res1.body.id).toBe(res2.body.id);

    createdCookIds.push(res1.body.id);

    // Exactly one row for this sessionId + plannedStartAt.
    const rows = await db
      .select()
      .from(cooksTable)
      .where(
        and(
          eq(cooksTable.userId, TEST_USER_ID),
          eq(cooksTable.sessionId, SESSION_ID),
        ),
      );
    const matching = rows.filter(
      (r) =>
        r.plannedStartAt !== null &&
        new Date(r.plannedStartAt).toISOString() ===
          new Date(plannedStartAt).toISOString(),
    );
    expect(matching).toHaveLength(1);
  });

  /**
   * Retry of an already-completed create — pre-insert guard path.
   */
  it("retrying an already-created cook returns 200 with the existing cook (pre-insert guard)", async () => {
    const plannedStartAt = new Date(Date.now() + 7_200_000).toISOString();
    const app = buildApp();

    const first = await request(app)
      .post("/api/cooks")
      .send(cookBody(plannedStartAt));
    expect(first.status).toBe(201);
    createdCookIds.push(first.body.id);

    const second = await request(app)
      .post("/api/cooks")
      .send(cookBody(plannedStartAt));
    expect(second.status).toBe(200);
    expect(second.body.id).toBe(first.body.id);

    const rows = await db
      .select()
      .from(cooksTable)
      .where(
        and(
          eq(cooksTable.userId, TEST_USER_ID),
          eq(cooksTable.sessionId, SESSION_ID),
        ),
      );
    const matching = rows.filter(
      (r) =>
        r.plannedStartAt !== null &&
        new Date(r.plannedStartAt).toISOString() ===
          new Date(plannedStartAt).toISOString(),
    );
    expect(matching).toHaveLength(1);
  });

  /**
   * 23505 fallback path: simulate a true race where both requests pass the
   * pre-insert guard simultaneously and the DB throws a unique-constraint
   * violation on the second insert.
   *
   * Setup:
   *  - Pre-insert the row directly so the DB already has it.
   *  - ctrl.nextSelectResult = [] makes the pre-insert guard see an empty
   *    result (simulating the race window before the first request commits).
   *  - ctrl.injectInsert23505 = true makes the next db.insert() reject with
   *    a DrizzleQueryError wrapping a pg code "23505".
   *  - The catch-path db.select() (ctrl.nextSelectResult is null by then)
   *    hits the real DB and finds the existing row.
   *
   * Assertions:
   *  - ctrl.insertCallCount === 1 confirms the spy ran (23505 path reached).
   *  - Response is 200 with the pre-existing cook's id.
   */
  it("23505 unique-violation on insert falls back to returning the existing cook", async () => {
    const plannedStartAt = new Date(Date.now() + 10_800_000).toISOString();

    // Insert the row directly so it already exists in the DB.
    const [existingCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "brisket",
        targetTempF: 203,
        cookTempF: 225,
        status: "planned",
        sessionId: SESSION_ID,
        plannedStartAt: new Date(plannedStartAt),
      })
      .returning();
    createdCookIds.push(existingCook.id);

    // Pre-insert guard returns [] → guard passes (race window simulated).
    ctrl.nextSelectResult = [];
    // Next insert throws a Drizzle-wrapped 23505.
    ctrl.injectInsert23505 = true;
    ctrl.insertCallCount = 0;

    const app = buildApp();
    let res: Awaited<ReturnType<typeof request>>;
    try {
      res = await request(app)
        .post("/api/cooks")
        .send(cookBody(plannedStartAt));
    } finally {
      // Clean up flags regardless of assertion outcome.
      ctrl.nextSelectResult = null;
      ctrl.injectInsert23505 = false;
    }

    // The mocked insert must have been invoked — proves the 23505 path ran.
    expect(ctrl.insertCallCount).toBe(1);

    // Response must be 200 (idempotent) with the pre-existing cook.
    expect(res!.status).toBe(200);
    expect(res!.body.id).toBe(existingCook.id);
    expect(res!.body.foodType).toBe("brisket");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /cooks/:id — activate idempotency guard
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /cooks/:id — activate idempotency guard", () => {
  /**
   * Two concurrent PATCH requests race to activate the same planned cook.
   * Both should return 200 with the same cook id and status="active".
   * The conditional UPDATE (WHERE status != 'active') means exactly one
   * request wins the database UPDATE; the other hits the fallback path and
   * returns the already-active row. clearHomeInsightsCache therefore fires
   * exactly once (only from the winning request's full update path).
   */
  it("concurrent PATCH activate requests both return 200 and side-effects fire exactly once", async () => {
    const [plannedCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "ribs",
        targetTempF: 195,
        cookTempF: 225,
        status: "planned",
      })
      .returning();
    createdCookIds.push(plannedCook.id);

    const cacheMock = vi.mocked(clearHomeInsightsCache);
    cacheMock.mockClear();

    const app = buildApp();

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/cooks/${plannedCook.id}`)
        .send({ status: "active" }),
      request(app)
        .patch(`/api/cooks/${plannedCook.id}`)
        .send({ status: "active" }),
    ]);

    // Both callers receive a successful response with consistent data.
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.id).toBe(plannedCook.id);
    expect(res2.body.id).toBe(plannedCook.id);
    expect(res1.body.status).toBe("active");
    expect(res2.body.status).toBe("active");

    // The conditional UPDATE ensures exactly one request ran the full update
    // path (including clearHomeInsightsCache); the other hit the guard.
    expect(cacheMock).toHaveBeenCalledTimes(1);
  });

  /**
   * A single PATCH to activate an already-active cook must return 200 without
   * re-running any side-effects. The conditional UPDATE returns no rows
   * (status is already 'active'), so the handler falls back to fetching and
   * returning the existing row without touching clearHomeInsightsCache.
   */
  it("PATCH activate on an already-active cook returns 200 without re-running side-effects", async () => {
    const [activeCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "chicken",
        targetTempF: 165,
        cookTempF: 275,
        status: "active",
      })
      .returning();
    createdCookIds.push(activeCook.id);

    const cacheMock = vi.mocked(clearHomeInsightsCache);
    cacheMock.mockClear();

    const app = buildApp();
    const res = await request(app)
      .patch(`/api/cooks/${activeCook.id}`)
      .send({ status: "active" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activeCook.id);
    expect(res.body.status).toBe("active");
    // The guard short-circuits; clearHomeInsightsCache must not be called.
    expect(cacheMock).not.toHaveBeenCalled();
  });

  /**
   * A combined PATCH (status + another field) to an already-active cook must
   * still apply the non-status field changes. The narrowly-scoped guard only
   * protects status-only activate retries and must not interfere with combined
   * updates.
   */
  it("combined activate + field update on an already-active cook applies all fields", async () => {
    const [activeCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "brisket",
        targetTempF: 200,
        cookTempF: 225,
        status: "active",
      })
      .returning();
    createdCookIds.push(activeCook.id);

    const app = buildApp();
    const res = await request(app)
      .patch(`/api/cooks/${activeCook.id}`)
      .send({ status: "active", targetTempF: 203 });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(activeCook.id);
    expect(res.body.status).toBe("active");
    // Non-status field must be updated (guard does not apply here).
    expect(res.body.targetTempF).toBe(203);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /cooks/:id — complete idempotency guard
// ─────────────────────────────────────────────────────────────────────────────
describe("PATCH /cooks/:id — complete idempotency guard", () => {
  /**
   * Two concurrent PATCH requests race to complete the same active cook.
   * Both should return 200 with the same cook id and status="completed".
   * The conditional UPDATE (WHERE status != 'completed') means exactly one
   * request wins the database UPDATE; the other hits the fallback path and
   * returns the already-completed row. Heavy side-effects (outlier detection,
   * temperature thinning, smoker calibration invalidation, live activity
   * teardown) therefore fire exactly once.
   */
  it("concurrent PATCH complete requests both return 200 and side-effects fire exactly once", async () => {
    const [activeCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "brisket",
        targetTempF: 203,
        cookTempF: 225,
        status: "active",
        actualStartAt: new Date(Date.now() - 3 * 60 * 60_000), // 3 hours ago
      })
      .returning();
    createdCookIds.push(activeCook.id);

    const smokerMock = vi.mocked(invalidateSmokerInsightsCache);
    const liveActivityMock = vi.mocked(endLiveActivitiesForCook);
    const thinMock = vi.mocked(thinTemperatureReadings);
    smokerMock.mockClear();
    liveActivityMock.mockClear();
    thinMock.mockClear();

    const app = buildApp();

    const [res1, res2] = await Promise.all([
      request(app)
        .patch(`/api/cooks/${activeCook.id}`)
        .send({ status: "completed" }),
      request(app)
        .patch(`/api/cooks/${activeCook.id}`)
        .send({ status: "completed" }),
    ]);

    // Both callers receive a successful response with consistent data.
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(res1.body.id).toBe(activeCook.id);
    expect(res2.body.id).toBe(activeCook.id);
    expect(res1.body.status).toBe("completed");
    expect(res2.body.status).toBe("completed");

    // The conditional UPDATE ensures exactly one request ran the full update
    // path (including side-effects); the other hit the guard and returned early.
    expect(smokerMock).toHaveBeenCalledTimes(1);
    expect(liveActivityMock).toHaveBeenCalledTimes(1);
    expect(thinMock).toHaveBeenCalledTimes(1);
  });

  /**
   * A single PATCH to complete an already-completed cook must return 200
   * without re-running any side-effects. The conditional UPDATE returns no
   * rows (status is already 'completed'), so the handler falls back to
   * fetching and returning the existing row without touching any side-effect
   * functions.
   */
  it("PATCH complete on an already-completed cook returns 200 without re-running side-effects", async () => {
    const [completedCook] = await db
      .insert(cooksTable)
      .values({
        userId: TEST_USER_ID,
        foodType: "pork shoulder",
        targetTempF: 195,
        cookTempF: 225,
        status: "completed",
        actualStartAt: new Date(Date.now() - 8 * 60 * 60_000),
        actualEndAt: new Date(Date.now() - 60_000),
      })
      .returning();
    createdCookIds.push(completedCook.id);

    const smokerMock = vi.mocked(invalidateSmokerInsightsCache);
    const liveActivityMock = vi.mocked(endLiveActivitiesForCook);
    const thinMock = vi.mocked(thinTemperatureReadings);
    smokerMock.mockClear();
    liveActivityMock.mockClear();
    thinMock.mockClear();

    const app = buildApp();
    const res = await request(app)
      .patch(`/api/cooks/${completedCook.id}`)
      .send({ status: "completed" });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(completedCook.id);
    expect(res.body.status).toBe("completed");

    // The guard short-circuits; no side-effect must have been called.
    expect(smokerMock).not.toHaveBeenCalled();
    expect(liveActivityMock).not.toHaveBeenCalled();
    expect(thinMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /cooks — null-sessionId contract
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /cooks — null-sessionId cook contract", () => {
  /**
   * Cooks posted without a sessionId (e.g. quick-start cooks) are
   * intentionally NOT deduplicated. The dedup guard in cooks.ts requires both
   * `sessionId` and `plannedStartAt` to be present before it runs the
   * pre-insert lookup or treats a 23505 as an idempotent retry. Without a
   * sessionId there is no reliable identity key, so each POST creates an
   * independent row.
   *
   * This test pins that contract:
   *  - Two identical POSTs omitting sessionId must both return 201.
   *  - The two returned cooks must have different IDs (distinct rows).
   *
   * If the dedup guard is ever extended to cover null-sessionId cooks via a
   * different key (e.g. userId + foodType + plannedStartAt), this test should
   * be updated to reflect the new intended behaviour.
   */
  it("two identical posts without a sessionId each create a distinct row", async () => {
    const app = buildApp();

    const body = {
      foodType: "brisket",
      targetTempF: 203,
      cookTempF: 225,
      status: "planned",
      sessionId: null, // Explicit null — simulates quick-start cooks that send sessionId: null.
    };

    const [res1, res2] = await Promise.all([
      request(app).post("/api/cooks").send(body),
      request(app).post("/api/cooks").send(body),
    ]);

    // Both must succeed — the null-sessionId path has no dedup gate.
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    // Each response represents a distinct row.
    expect(typeof res1.body.id).toBe("number");
    expect(typeof res2.body.id).toBe("number");
    expect(res1.body.id).not.toBe(res2.body.id);

    // Track for cleanup.
    createdCookIds.push(res1.body.id, res2.body.id);

    // Neither row should carry a sessionId.
    expect(res1.body.sessionId).toBeFalsy();
    expect(res2.body.sessionId).toBeFalsy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /sessions/:sessionId/reconcile — durable live session outbox
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /sessions/:sessionId/reconcile", () => {
  function reconciliationBody(
    anchorCookId: number,
    anchorStartAt: string,
    addedStartAt: string,
    operationId: string,
  ) {
    return {
      operationId,
      anchorCookId,
      sequenceData: {
        type: "multi_cook",
        serveAt: new Date(Date.now() + 10_000_000).toISOString(),
        schedule: [
          { foodType: "brisket", meatOnAt: anchorStartAt, estimatedFinishAt: addedStartAt },
          { foodType: "ribs", meatOnAt: addedStartAt, estimatedFinishAt: new Date(Date.now() + 14_000_000).toISOString() },
        ],
      },
      members: [
        {
          serverId: anchorCookId,
          foodType: "brisket",
          status: "active",
          plannedStartAt: anchorStartAt,
          plannedEndAt: addedStartAt,
        },
        {
          foodType: "ribs",
          status: "planned",
          plannedStartAt: addedStartAt,
          plannedEndAt: new Date(Date.now() + 14_000_000).toISOString(),
        },
      ],
    };
  }

  it("retries a complete live-session revision without creating a duplicate member", async () => {
    const anchorStartAt = new Date(Date.now() - 90 * 60_000).toISOString();
    const addedStartAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const sessionId = `live-reconcile-${Date.now()}`;
    const [anchor] = await db.insert(cooksTable).values({
      userId: TEST_USER_ID,
      foodType: "brisket",
      status: "active",
      plannedStartAt: new Date(anchorStartAt),
    }).returning();
    createdCookIds.push(anchor.id);

    const app = buildApp();
    const body = reconciliationBody(anchor.id, anchorStartAt, addedStartAt, `op-${sessionId}`);
    const first = await request(app).post(`/api/sessions/${sessionId}/reconcile`).send(body);
    expect(first.status).toBe(200);
    expect(first.body.cooks).toHaveLength(2);

    const retry = await request(app).post(`/api/sessions/${sessionId}/reconcile`).send(body);
    expect(retry.status).toBe(200);
    expect(retry.body.cooks).toHaveLength(2);

    const rows = await db.select().from(cooksTable)
      .where(and(eq(cooksTable.userId, TEST_USER_ID), eq(cooksTable.sessionId, sessionId)));
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.sequenceData != null)).toBe(true);
  });

  it("creates a locally-started active anchor and its added member in one reconciliation", async () => {
    const sessionId = `offline-anchor-${Date.now()}`;
    const anchorStartAt = new Date(Date.now() - 60 * 60_000).toISOString();
    const addedStartAt = new Date(Date.now() + 45 * 60_000).toISOString();
    const app = buildApp();
    const response = await request(app).post(`/api/sessions/${sessionId}/reconcile`).send({
      operationId: `op-${sessionId}`,
      anchorCookId: null,
      sequenceData: { type: "multi_cook", schedule: [], isLocalBaseline: true },
      members: [
        {
          foodType: "pork shoulder",
          status: "active",
          plannedStartAt: anchorStartAt,
          plannedEndAt: addedStartAt,
        },
        {
          foodType: "chicken thighs",
          status: "planned",
          plannedStartAt: addedStartAt,
        },
      ],
    });

    expect(response.status).toBe(200);
    expect(response.body.cooks).toHaveLength(2);
    expect(response.body.cooks.filter((cook: { status: string }) => cook.status === "active")).toHaveLength(1);
    const rows = await db.select().from(cooksTable)
      .where(and(eq(cooksTable.userId, TEST_USER_ID), eq(cooksTable.sessionId, sessionId)));
    expect(rows).toHaveLength(2);
    expect(rows.some((row) => row.status === "active")).toBe(true);
  });

  it("rejects an over-capacity revision without adding only part of the session", async () => {
    const sessionId = `live-capacity-${Date.now()}`;
    const anchorStartAt = new Date(Date.now() - 90 * 60_000).toISOString();
    const [anchor] = await db.insert(cooksTable).values({
      userId: TEST_USER_ID,
      sessionId,
      foodType: "brisket",
      status: "active",
      plannedStartAt: new Date(anchorStartAt),
    }).returning();
    createdCookIds.push(anchor.id);
    for (let index = 1; index < 5; index++) {
      const [sibling] = await db.insert(cooksTable).values({
        userId: TEST_USER_ID,
        sessionId,
        foodType: `item-${index}`,
        status: "planned",
        plannedStartAt: new Date(Date.now() + index * 60 * 60_000),
      }).returning();
      createdCookIds.push(sibling.id);
    }

    const addedStartAt = new Date(Date.now() + 6 * 60 * 60_000).toISOString();
    const app = buildApp();
    const response = await request(app)
      .post(`/api/sessions/${sessionId}/reconcile`)
      .send(reconciliationBody(anchor.id, anchorStartAt, addedStartAt, `op-${sessionId}`));
    expect(response.status).toBe(409);

    const rows = await db.select().from(cooksTable)
      .where(and(eq(cooksTable.userId, TEST_USER_ID), eq(cooksTable.sessionId, sessionId)));
    expect(rows).toHaveLength(5);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema smoke test — confirm the dedup unique index still exists
// ─────────────────────────────────────────────────────────────────────────────
describe("schema smoke test — cooks_session_dedup_idx", () => {
  /**
   * Query pg_indexes to assert that the unique index backing the
   * concurrent-insert dedup guard is present on the cooks table.
   *
   * If a future migration accidentally drops or renames this index, the 23505
   * constraint silently stops working and duplicate cooks can be created.
   * This test catches that regression before it reaches users.
   */
  it("cooks_session_dedup_idx unique index exists on the cooks table", async () => {
    const rows = await db.execute(
      `SELECT indexname, tablename, indexdef
       FROM pg_indexes
       WHERE tablename = 'cooks'
         AND indexname = 'cooks_session_dedup_idx'`,
    );

    expect(rows.rows).toHaveLength(1);

    const idx = rows.rows[0] as {
      indexname: string;
      tablename: string;
      indexdef: string;
    };
    expect(idx.indexname).toBe("cooks_session_dedup_idx");
    expect(idx.tablename).toBe("cooks");
    // Confirm the index definition describes a UNIQUE index.
    expect(idx.indexdef.toUpperCase()).toContain("UNIQUE");
  });
});
