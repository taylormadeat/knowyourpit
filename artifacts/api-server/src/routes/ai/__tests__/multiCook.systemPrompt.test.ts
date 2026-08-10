/**
 * System-prompt content tests for POST /ai/multi-cook.
 *
 * Purpose: verify that `buildMultiCookContext` scopes wrap guidance to the
 * cooking method so that smoker/stall language never appears in the prompt for
 * all-direct-heat sessions, and the per-item direct-heat caveat is present for
 * mixed sessions.
 *
 * The existing multiCook.cookingMethod.test.ts covers the *response* side
 * (processMultiCookResult suppresses wrap fields). These tests catch a
 * different failure mode: a refactor that re-introduces Texas-Crutch /
 * butcher-paper / stall-guidance prose into the prompt for sessions where
 * every item is grilled over direct heat.
 *
 * Strategy: intercept the arguments passed to the mocked openai.chat.completions.create
 * and inspect the system message text directly.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

// ── Hoisted mock state ────────────────────────────────────────────────────────
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});

// ── Mock heavy external dependencies ─────────────────────────────────────────

vi.mock("../../../middlewares/requireAuth", () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.userId = "test-user-sysprompt-1465";
    next();
  },
}));

vi.mock("../../../lib/paywall", () => ({
  respondPaywall: vi.fn(),
  userBypassesPaywall: vi.fn().mockResolvedValue(true),
}));

vi.mock("@workspace/integrations-openai-ai-server", () => ({
  openai: {
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  },
}));

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

vi.mock("../../../lib/smokerCalibration", () => ({
  computeSmokerInsights: vi.fn().mockResolvedValue(null),
  formatSmokerProfile: vi.fn().mockReturnValue(""),
}));

vi.mock("../shared", () => ({
  buildUserCookHistory: vi.fn().mockResolvedValue(""),
  aiRateLimit: (_req: any, _res: any, next: any) => next(),
}));

// Real isDirectHeat behaviour: treat "direct*", "sear*", "griddle*" as direct heat.
vi.mock("../../../lib/grillClassify", () => ({
  classifyGrillType: vi.fn().mockReturnValue(null),
  grillClassCoachingNote: vi.fn().mockReturnValue(null),
  isDirectHeat: vi.fn((m: string | null) =>
    typeof m === "string" && /direct|sear|griddle/i.test(m),
  ),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal valid AiMultiCookBody item. */
function bodyItem(foodType: string, cookingMethod: string | null) {
  return {
    foodType,
    weightLbs: 4,
    cookTempF: 400,
    targetTempF: 165,
    grillId: null,
    grillName: null,
    preheatMinutes: 15,
    cookingMethod,
    fromFrozen: false,
    thawMethod: null,
    notes: null,
    cookingStylePreset: null,
    baselineEstimateMinutes: null,
    restMins: 5,
  };
}

/** Minimal AI payload that satisfies processMultiCookResult without errors. */
function makeAiPayload(foods: string[], serveAt: string) {
  const now = Date.now();
  return {
    schedule: foods.map((foodType) => ({
      foodType,
      estimatedDurationMinutes: 60,
      preheatMinutes: 15,
      restMinutes: 5,
      grillLightAt: new Date(now + 1 * 60 * 60_000).toISOString(),
      meatOnAt: new Date(now + 1.25 * 60 * 60_000).toISOString(),
      estimatedFinishAt: new Date(now + 2.25 * 60 * 60_000).toISOString(),
      wrapMethod: "none",
      wrapAtMinutes: null,
      wrapTempF: null,
      wrapReason: null,
      notes: "Stub note.",
    })),
    serveAt,
    summary: "Stub summary.",
    sharedGrillTips: null,
  };
}

/** Extract the system message text from the last mockCreate call. */
function capturedSystemPrompt(): string {
  const calls = mockCreate.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const lastCall = calls[calls.length - 1];
  const messages: Array<{ role: string; content: string }> = lastCall[0].messages;
  const sys = messages.find((m) => m.role === "system");
  expect(sys).toBeDefined();
  return sys!.content;
}

// ── App fixture ───────────────────────────────────────────────────────────────

let app: express.Express;

// We use a dynamic import once so the vi.mock calls above are in effect.
beforeEach(async () => {
  mockCreate.mockClear();

  // Re-import fresh each time so module-level state doesn't bleed between tests.
  vi.resetModules();
  const multiCookRouter = (await import("../multiCook")).default;
  app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/", multiCookRouter);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildMultiCookContext — system prompt wrap guidance scoping", () => {
  /**
   * All-direct-heat session: the system prompt must NOT mention any
   * smoker-wrap / stall terminology.  If `wrapGuidanceSection` regresses to
   * the full smoker block, these terms would appear and the test fails.
   */
  describe("all-direct-heat session", () => {
    const SERVE_AT = new Date(Date.now() + 4 * 60 * 60_000).toISOString();
    const items = [
      bodyItem("Burger Patties", "Direct Heat"),
      bodyItem("Hot Dogs", "Direct Heat / Grilling"),
    ];

    async function postAndCapture() {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(
                makeAiPayload(["Burger Patties", "Hot Dogs"], SERVE_AT),
              ),
            },
          },
        ],
      });
      const res = await request(app)
        .post("/ai/multi-cook")
        .send({ serveAt: SERVE_AT, items, outdoorTempF: null, outdoorTempIsForecast: false, notes: null });
      expect(res.status).toBe(200);
      return capturedSystemPrompt();
    }

    it("does not contain 'Texas Crutch' language", async () => {
      const prompt = await postAndCapture();
      expect(prompt.toLowerCase()).not.toContain("texas crutch");
    });

    it("does not contain wrap-option descriptions for butcher paper or foil", async () => {
      const prompt = await postAndCapture();
      // "butcher_paper" appears in the JSON schema field ("foil|butcher_paper|none") — that
      // is always present and is fine. What must NOT appear are the prose descriptions of
      // those options that belong to the full smoker wrap block:
      expect(prompt).not.toMatch(/"butcher_paper" \(breathable/i);
      expect(prompt).not.toContain("Wrap guidance by cut:");
    });

    it("does not contain stall-based wrap guidance prose", async () => {
      const prompt = await postAndCapture();
      // The full wrap block describes *when* and *how* to wrap using stall
      // temperature triggers (e.g. "around the stall (~160-170°F)").
      // Those specific phrases must not appear for all-direct-heat sessions.
      // Note: "do not use stall-based wrapping" IS present in the suppression
      // message — that's correct and intentional, so we don't test for its absence.
      expect(prompt).not.toMatch(/around the stall/i);
      // Stall temperature trigger language unique to the detailed guidance block:
      expect(prompt).not.toMatch(/stall \(~\d+/i);
    });

    it("does not instruct the AI to choose foil or butcher_paper wrap methods", async () => {
      const prompt = await postAndCapture();
      // The full smoker block lists '"foil" (Texas Crutch' and '"butcher_paper"'
      // as selectable options.  Neither should appear in an all-direct prompt.
      expect(prompt).not.toMatch(/"foil" \(Texas Crutch/i);
      expect(prompt).not.toMatch(/"butcher_paper" \(breathable/i);
    });

    it("includes the short direct-heat wrap suppression instruction instead", async () => {
      const prompt = await postAndCapture();
      // The condensed form that replaces the full block for direct-heat sessions.
      expect(prompt).toContain("direct-heat / grilling cooks do not use stall-based wrapping");
      expect(prompt).toContain('set wrapMethod to "none"');
    });
  });

  /**
   * Mixed session (one smoker item + one direct-heat item):
   * The full wrap guidance block is emitted, but must include the per-item
   * direct-heat caveat so the AI knows to suppress wrap for the grilling item.
   */
  describe("mixed session (smoker + direct-heat items)", () => {
    const SERVE_AT = new Date(Date.now() + 8 * 60 * 60_000).toISOString();
    const items = [
      bodyItem("Pork Shoulder", "Low and Slow"),
      bodyItem("Corn on the Cob", "Direct Heat"),
    ];

    async function postAndCapture() {
      mockCreate.mockResolvedValue({
        choices: [
          {
            message: {
              content: JSON.stringify(
                makeAiPayload(["Pork Shoulder", "Corn on the Cob"], SERVE_AT),
              ),
            },
          },
        ],
      });
      const res = await request(app)
        .post("/ai/multi-cook")
        .send({ serveAt: SERVE_AT, items, outdoorTempF: null, outdoorTempIsForecast: false, notes: null });
      expect(res.status).toBe(200);
      return capturedSystemPrompt();
    }

    it("includes the full smoker wrap guidance block (foil / butcher_paper options)", async () => {
      const prompt = await postAndCapture();
      // The full block should still be present for the smoker item.
      expect(prompt).toMatch(/"foil"|"butcher_paper"/);
    });

    it("includes the per-item direct-heat caveat for the grilling item", async () => {
      const prompt = await postAndCapture();
      // This IMPORTANT note tells the AI which individual items must use none.
      expect(prompt).toContain(
        'Any item with a direct-heat or grilling cooking method must use wrapMethod: "none"',
      );
    });

    it("still contains Texas Crutch guidance for the smoker item", async () => {
      const prompt = await postAndCapture();
      // Texas Crutch is valid advice for the pork shoulder, so it must be present.
      expect(prompt).toMatch(/Texas Crutch/i);
    });
  });
});
