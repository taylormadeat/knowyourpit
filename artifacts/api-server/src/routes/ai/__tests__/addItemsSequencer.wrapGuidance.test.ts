/**
 * Unit tests for callAddItemsSequencer — wrap/stall guidance scoping.
 *
 * Regression guard: the function scopes wrap/stall/Texas-Crutch language to the
 * cooking method of the new items.  A refactor that breaks the `allNewItemsDirect`
 * or `anyNewItemDirect` branch could silently re-introduce smoker wrap language
 * for pure grilling sessions (or drop the per-item direct-heat caveat for mixed
 * sessions) without any CI signal.
 *
 * Strategy: mock OpenAI so we can capture the system prompt that was actually
 * built, then assert on its text — the AI response itself is irrelevant here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mock state ────────────────────────────────────────────────────────
const { mockCreate, capturedMessages } = vi.hoisted(() => {
  const capturedMessages: { role: string; content: string }[][] = [];
  const mockCreate = vi.fn(async (params: any) => {
    capturedMessages.push(params.messages ?? []);
    // Return a minimal valid AI payload so the function can parse and return.
    const serveAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    return {
      choices: [
        {
          message: {
            content: JSON.stringify({
              schedule: [],
              serveAt,
              summary: "Stub response.",
              sharedGrillTips: null,
            }),
          },
        },
      ],
    };
  });
  return { mockCreate, capturedMessages };
});

// ── Mocks ─────────────────────────────────────────────────────────────────────

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

// Use real grillClassify so isDirectHeat behaves exactly as production.
vi.mock("../../../lib/grillClassify", async (importOriginal) => {
  return await importOriginal();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANCHOR = {
  foodType: "Brisket",
  grillName: "Offset Smoker",
  elapsedMinutes: 120,
  remainingEstimateMinutes: 360,
  currentTempF: 155,
  restMinutes: 30,
};

function directHeatItem(foodType: string) {
  return {
    foodType,
    weightLbs: 1.5,
    cookTempF: 450,
    targetTempF: 165,
    grillId: null,
    grillName: "Weber Kettle",
    preheatMinutes: 15,
    cookingMethod: "Direct Heat",
    fromFrozen: false,
    thawMethod: null,
    notes: null,
    cookingStylePreset: null,
    baselineEstimateMinutes: 30,
    restMins: 5,
  };
}

function smokeItem(foodType: string) {
  return {
    foodType,
    weightLbs: 8,
    cookTempF: 225,
    targetTempF: 205,
    grillId: null,
    grillName: null,
    preheatMinutes: 30,
    cookingMethod: "Low and Slow",
    fromFrozen: false,
    thawMethod: null,
    notes: null,
    cookingStylePreset: null,
    baselineEstimateMinutes: 480,
    restMins: 30,
  };
}

/** Extract the system prompt from the most recent mockCreate call. */
function capturedSystemPrompt(): string {
  const calls = capturedMessages;
  if (calls.length === 0) throw new Error("mockCreate was never called");
  const messages = calls[calls.length - 1];
  const system = messages.find((m) => m.role === "system");
  if (!system) throw new Error("No system message found in last call");
  return system.content;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

/**
 * Parameterised test: every documented direct-heat alias must produce a
 * no-wrap system prompt.  If the mobile app or a Zod schema change renames
 * "Direct Heat" → "direct_heat" (or similar), isDirectHeat() silently stops
 * recognising it and smoker wrap language re-enters grilling prompts.
 *
 * Aliases tested:
 *   "Direct Heat"  — primary value used by the mobile app today
 *   "Sear"         — high-temp searing sessions
 *   "Griddle"      — flat-top griddle sessions
 */
describe("callAddItemsSequencer — direct-heat alias parameterisation", () => {
  beforeEach(() => {
    capturedMessages.length = 0;
    mockCreate.mockClear();
  });

  const directHeatAliases: Array<{ label: string; cookingMethod: string }> = [
    { label: "Direct Heat", cookingMethod: "Direct Heat" },
    { label: "Sear",        cookingMethod: "Sear" },
    { label: "Griddle",     cookingMethod: "Griddle" },
  ];

  describe.each(directHeatAliases)(
    'cookingMethod="$label" → no-wrap system prompt',
    ({ cookingMethod }) => {
      it("instructs wrapMethod 'none' for all items", async () => {
        const { callAddItemsSequencer } = await import("../multiCook");

        await callAddItemsSequencer("user-alias-nowrap", ANCHOR, [
          {
            foodType: "Test Item",
            weightLbs: 1.5,
            cookTempF: 450,
            targetTempF: 165,
            grillId: null,
            grillName: "Weber Kettle",
            preheatMinutes: 15,
            cookingMethod,
            fromFrozen: false,
            thawMethod: null,
            notes: null,
            cookingStylePreset: null,
            baselineEstimateMinutes: 30,
            restMins: 5,
          },
        ]);

        const prompt = capturedSystemPrompt();
        expect(prompt).toContain('set wrapMethod to "none"');
        expect(prompt).toContain("direct-heat / grilling cooks do not use stall-based wrapping");
      });

      it("system prompt contains no affirmative stall/wrap prose", async () => {
        const { callAddItemsSequencer } = await import("../multiCook");

        await callAddItemsSequencer("user-alias-nowrapprose", ANCHOR, [
          {
            foodType: "Test Item",
            weightLbs: 1.5,
            cookTempF: 450,
            targetTempF: 165,
            grillId: null,
            grillName: "Weber Kettle",
            preheatMinutes: 15,
            cookingMethod,
            fromFrozen: false,
            thawMethod: null,
            notes: null,
            cookingStylePreset: null,
            baselineEstimateMinutes: 30,
            restMins: 5,
          },
        ]);

        const prompt = capturedSystemPrompt();
        expect(prompt).not.toMatch(/texas.?crutch/i);
        expect(prompt).not.toMatch(/butcher paper/i);
        expect(prompt).not.toMatch(/around the stall|at the stall|push through the stall/i);
      });

      it("instructs wrapAtMinutes and wrapTempF to be null", async () => {
        const { callAddItemsSequencer } = await import("../multiCook");

        await callAddItemsSequencer("user-alias-nullwrap", ANCHOR, [
          {
            foodType: "Test Item",
            weightLbs: 1.5,
            cookTempF: 450,
            targetTempF: 165,
            grillId: null,
            grillName: "Weber Kettle",
            preheatMinutes: 15,
            cookingMethod,
            fromFrozen: false,
            thawMethod: null,
            notes: null,
            cookingStylePreset: null,
            baselineEstimateMinutes: 30,
            restMins: 5,
          },
        ]);

        const prompt = capturedSystemPrompt();
        expect(prompt).toMatch(/wrapAtMinutes.*null|null.*wrapAtMinutes/i);
      });
    },
  );
});

describe("callAddItemsSequencer — wrap guidance scoping by cooking method", () => {
  beforeEach(() => {
    capturedMessages.length = 0;
    mockCreate.mockClear();
  });

  describe("all-direct-heat new items", () => {
    it("system prompt instructs wrapMethod 'none' for all items", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-1", ANCHOR, [
        directHeatItem("Chicken Thighs"),
        directHeatItem("Corn on the Cob"),
      ]);

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain('set wrapMethod to "none"');
      expect(prompt).toContain("direct-heat / grilling cooks do not use stall-based wrapping");
    });

    it("system prompt contains no affirmative stall/wrap guidance for all-direct-heat session", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-2", ANCHOR, [
        directHeatItem("Burgers"),
        directHeatItem("Hot Dogs"),
      ]);

      const prompt = capturedSystemPrompt();
      // The JSON schema template always contains "foil|butcher_paper|none" as a type
      // descriptor — that is harmless and expected in every path.
      // We assert on the ABSENCE of prose wrap guidance (instructions to the AI about
      // when/why to wrap) which only appears in the non-direct-heat branch.
      expect(prompt).not.toMatch(/texas.?crutch/i);
      // Butcher paper in prose guidance (e.g. "butcher paper at the stall", "breathable,
      // retains bark") — note "butcher_paper" (underscore) in the schema is allowed.
      expect(prompt).not.toMatch(/butcher paper/i);
      // Affirmative stall guidance phrases that only appear in the smoke/indirect path.
      expect(prompt).not.toMatch(/around the stall|at the stall|push through the stall/i);
      // Wrap-by-cut prose guide (brisket, ribs, pork shoulder entries).
      expect(prompt).not.toMatch(/Brisket.*butcher_paper|Pork shoulder.*foil|ribs.*foil/i);
    });

    it("instructs wrapAtMinutes, wrapTempF, and wrapReason to be null", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-3", ANCHOR, [
        directHeatItem("Steak"),
      ]);

      const prompt = capturedSystemPrompt();
      expect(prompt).toContain("wrapAtMinutes");
      // The direct-heat path sets all three fields to null.
      expect(prompt).toMatch(/wrapAtMinutes.*null|null.*wrapAtMinutes/i);
    });
  });

  describe("mixed session (direct-heat + smoke new items)", () => {
    it("system prompt includes general wrap guidance (Texas Crutch / butcher paper)", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-4", ANCHOR, [
        smokeItem("Pork Shoulder"),
        directHeatItem("Chicken Breast"),
      ]);

      const prompt = capturedSystemPrompt();
      // The smoke-item path includes Texas Crutch / butcher paper wrap language.
      expect(prompt).toMatch(/texas.?crutch|butcher.?paper/i);
    });

    it("system prompt includes a per-item direct-heat caveat for the mixed case", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-5", ANCHOR, [
        smokeItem("Baby Back Ribs"),
        directHeatItem("Shrimp Skewers"),
      ]);

      const prompt = capturedSystemPrompt();
      // The anyNewItemDirect branch appends a specific caveat so the AI knows
      // to apply wrapMethod "none" to the direct-heat items only.
      expect(prompt).toMatch(/direct-heat.*cooking method.*wrapMethod.*none|wrapMethod.*none.*direct-heat/i);
      expect(prompt).toContain("stall-based wrapping does not apply to direct-heat cooks");
    });

    it("does NOT instruct 'none for all items' when the session has smoke items", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-6", ANCHOR, [
        smokeItem("Pork Butt"),
        directHeatItem("Sausages"),
      ]);

      const prompt = capturedSystemPrompt();
      // All-direct sentinel phrase must NOT appear — smoke items get normal wrap guidance.
      expect(prompt).not.toContain("direct-heat / grilling cooks do not use stall-based wrapping");
    });
  });

  describe("all-smoke new items (control group)", () => {
    it("system prompt includes wrap cut guide (brisket, ribs, pork shoulder)", async () => {
      const { callAddItemsSequencer } = await import("../multiCook");

      await callAddItemsSequencer("user-test-7", ANCHOR, [
        smokeItem("Pork Shoulder"),
        smokeItem("Baby Back Ribs"),
      ]);

      const prompt = capturedSystemPrompt();
      // Standard low-and-slow session should have full wrap guidance.
      expect(prompt).toMatch(/texas.?crutch|butcher.?paper/i);
      // Per-item direct-heat caveat must NOT appear for pure smoke sessions.
      expect(prompt).not.toContain("stall-based wrapping does not apply to direct-heat cooks");
    });
  });
});
