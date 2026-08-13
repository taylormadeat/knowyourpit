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

// ─────────────────────────────────────────────────────────────────────────────
// Imports that depend on the mocked db (must come after vi.mock calls)
// ─────────────────────────────────────────────────────────────────────────────
import { db, cooksTable } from "@workspace/db";

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
