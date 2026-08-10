/**
 * Route-level integration test for POST /ai/multi-cook — cookingMethod threading.
 *
 * Purpose: verify that cookingMethod is correctly threaded from the request body
 * through the route handler into processMultiCookResult, so that the direct-heat
 * wrap suppression gate actually fires.
 *
 * The processMultiCookResult unit tests (processMultiCookResult.test.ts) already
 * confirm the gate works *when given a correctly-structured requestItems array*.
 * This test catches a different failure mode: a refactor that drops cookingMethod
 * from the AiMultiCookBody Zod schema or strips it before passing items to
 * processMultiCookResult — silent regressions that the unit tests would miss.
 *
 * The AI layer is replaced by a deterministic stub that always returns
 * wrapMethod = "foil" for every schedule item. If the route correctly threads
 * cookingMethod, processMultiCookResult will override the direct-heat item's
 * wrapMethod to "none" before sending the response. If cookingMethod is dropped,
 * the stub's "foil" leaks through and the assertions fail.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted mock state ────────────────────────────────────────────────────────
// Must be hoisted so vi.mock() factories can reference them.
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

// ── Mock heavy external dependencies ─────────────────────────────────────────

// Auth middleware: bypass Clerk; inject a stable userId.
// Path is relative to THIS test file (one level deeper than multiCook.ts).
vi.mock("../../../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-multicook-1433";
    next();
  },
}));

// Paywall: all requests are treated as Pro so the route doesn't 402.
vi.mock("../../../lib/paywall", () => ({
  respondPaywall: vi.fn(),
  userBypassesPaywall: vi.fn().mockResolvedValue(true),
}));

// OpenAI client: return a deterministic JSON payload that intentionally sets
// wrapMethod = "foil" for every item, regardless of cooking method.
// The route should suppress wrap for the direct-heat item via processMultiCookResult.
vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  },
}));

// DB: no grill rows needed — items have no grillId so the select is skipped.
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }),
  },
  grillsTable: { id: "id", type: "type" },
  cooksTable: {},
}));

// Smoker calibration: return empty strings so the prompts build without errors.
vi.mock("../../../lib/smokerCalibration", () => ({
  computeSmokerInsights: vi.fn().mockResolvedValue(null),
  formatSmokerProfile: vi.fn().mockReturnValue(""),
}));

// Shared AI helpers: provide only what multiCook.ts uses — buildUserCookHistory
// and aiRateLimit. Other exports (AuthedRequest, etc.) are type-only so they
// don't need to appear here.
vi.mock("../shared", () => ({
  buildUserCookHistory: vi.fn().mockResolvedValue(""),
  // aiRateLimit must be a real Express middleware, not a mock object.
  aiRateLimit: (_req: any, _res: any, next: any) => next(),
}));

// Grill classifier: return null coaching notes (no grill rows in this test).
// isDirectHeat must be included because buildMultiCookContext uses it to scope
// wrap guidance in the system prompt.
vi.mock("../../../lib/grillClassify", () => ({
  classifyGrillType: vi.fn().mockReturnValue(null),
  grillClassCoachingNote: vi.fn().mockReturnValue(null),
  isDirectHeat: vi.fn((m: string | null) =>
    typeof m === "string" && /direct|sear|griddle/i.test(m)
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build a fake AI schedule item with wrapMethod = "foil" so the suppression
 *  gate must fire to clear it for direct-heat items. */
function aiScheduleItem(foodType: string, meatOnAt: string, estimatedFinishAt: string, durationMin: number) {
  return {
    foodType,
    estimatedDurationMinutes: durationMin,
    preheatMinutes: 25,
    restMinutes: 15,
    grillLightAt: new Date(new Date(meatOnAt).getTime() - 25 * 60_000).toISOString(),
    meatOnAt,
    estimatedFinishAt,
    // AI stubbornly returns foil for everything — suppression gate must override
    // direct-heat items to "none".
    wrapMethod: "foil",
    wrapAtMinutes: Math.round(durationMin * 0.5),
    wrapTempF: 165,
    wrapReason: "Stub AI always suggests foil wrap.",
    notes: "Stub note.",
  };
}

/** Minimal valid AiMultiCookBody item. */
function bodyItem(foodType: string, cookingMethod: string | null) {
  return {
    foodType,
    weightLbs: 10,
    cookTempF: 225,
    targetTempF: cookingMethod?.toLowerCase().includes("direct") ? 165 : 205,
    grillId: null,
    grillName: null,
    preheatMinutes: 25,
    cookingMethod,
    fromFrozen: false,
    thawMethod: null,
    notes: null,
    cookingStylePreset: null,
    baselineEstimateMinutes: null,
    restMins: 15,
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────

let app: express.Express;

const SERVE_AT = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 h from now

beforeAll(async () => {
  // Build timestamps far enough in the future to be "feasible" so
  // processMultiCookResult's realignment logic doesn't interfere with the wrap assertions.
  const brisketMeatOn  = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
  const brisketFinish  = new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString();
  const chickenMeatOn  = new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString();
  const chickenFinish  = new Date(Date.now() + 10.5 * 60 * 60 * 1000).toISOString();

  const aiPayload = {
    schedule: [
      aiScheduleItem("Brisket",        brisketMeatOn, brisketFinish, 540),
      aiScheduleItem("Chicken Thighs", chickenMeatOn, chickenFinish,  30),
    ],
    serveAt: SERVE_AT.toISOString(),
    summary: "Start Brisket first, then Chicken Thighs last.",
    sharedGrillTips: null,
  };

  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(aiPayload) } }],
  });

  const multiCookRouter = (await import("../multiCook")).default;
  app = express();
  app.use(express.json());
  // Inject a minimal pino-compatible logger so req.log.error/warn don't throw
  // in the route's catch blocks (the real server uses pino-http middleware).
  app.use((req: any, _res, next) => {
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  // The router registers its own "/ai/multi-cook" paths, so mount at root.
  app.use("/", multiCookRouter);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /ai/multi-cook — cookingMethod threading through the full route", () => {
  /**
   * The core regression scenario:
   * - Item 1: "Chicken Thighs" with cookingMethod = "Direct Heat"
   * - Item 2: "Brisket" with cookingMethod = "Low and Slow"
   * - Stub AI returns wrapMethod = "foil" for BOTH items.
   *
   * Expected:
   *   - Chicken Thighs → wrapMethod = "none" (suppressed by direct-heat gate)
   *   - Brisket        → wrapMethod = "foil"  (smoke method; AI suggestion kept)
   *
   * If cookingMethod is dropped anywhere between the route handler and
   * processMultiCookResult, the direct-heat gate never fires and the chicken
   * item leaks wrapMethod = "foil", causing the first assertion to fail.
   */
  it("suppresses wrapMethod to 'none' for the direct-heat item and preserves wrap for the smoke item", async () => {
    const res = await request(app)
      .post("/ai/multi-cook")
      .send({
        serveAt: SERVE_AT.toISOString(),
        items: [
          bodyItem("Chicken Thighs", "Direct Heat"),
          bodyItem("Brisket", "Low and Slow"),
        ],
        outdoorTempF: null,
        outdoorTempIsForecast: false,
        notes: null,
      });

    expect(res.status).toBe(200);

    const schedule: any[] = res.body.schedule;
    expect(Array.isArray(schedule)).toBe(true);
    expect(schedule).toHaveLength(2);

    const chicken = schedule.find((s: any) => s.foodType === "Chicken Thighs");
    const brisket = schedule.find((s: any) => s.foodType === "Brisket");

    expect(chicken).toBeDefined();
    expect(brisket).toBeDefined();

    // Direct-heat item: wrap must be fully suppressed.
    expect(chicken.wrapMethod).toBe("none");
    expect(chicken.wrapAtMinutes).toBeNull();
    expect(chicken.wrapTempF).toBeNull();
    expect(chicken.wrapReason).toBeNull();

    // Smoke item: AI's foil suggestion must be preserved.
    expect(brisket.wrapMethod).toBe("foil");
    expect(brisket.wrapAtMinutes).not.toBeNull();
  });

  it("also clears wrapAtMinutes, wrapTempF, and wrapReason for the direct-heat item", async () => {
    const res = await request(app)
      .post("/ai/multi-cook")
      .send({
        serveAt: SERVE_AT.toISOString(),
        items: [
          bodyItem("Chicken Thighs", "Direct Heat"),
          bodyItem("Brisket", "Low and Slow"),
        ],
        outdoorTempF: null,
        outdoorTempIsForecast: false,
        notes: null,
      });

    expect(res.status).toBe(200);

    const chicken = res.body.schedule.find((s: any) => s.foodType === "Chicken Thighs");
    expect(chicken.wrapAtMinutes).toBeNull();
    expect(chicken.wrapTempF).toBeNull();
    expect(chicken.wrapReason).toBeNull();
  });

  it("returns a 200 with a schedule array when cookingMethod is present on all items", async () => {
    const res = await request(app)
      .post("/ai/multi-cook")
      .send({
        serveAt: SERVE_AT.toISOString(),
        items: [
          bodyItem("Chicken Thighs", "Direct Heat"),
          bodyItem("Brisket", "Low and Slow"),
        ],
        outdoorTempF: null,
        outdoorTempIsForecast: false,
        notes: null,
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("schedule");
    expect(res.body).toHaveProperty("serveAt");
  });
});
