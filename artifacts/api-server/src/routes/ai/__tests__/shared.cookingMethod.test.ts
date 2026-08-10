/**
 * Unit tests for buildChatSystemPrompt — cookingMethod-aware persona.
 *
 * Regression guard: a caller that forgets to pass cookingMethod, or a cache-key
 * bug that serves the wrong cached prompt, would silently put grilling users on
 * a smoker persona (or vice-versa). These tests lock in the vocabulary that
 * MUST appear (and MUST NOT appear) for each method class.
 *
 * Strategy: mock all async DB / calibration dependencies so the function runs
 * synchronously against controlled data, then inspect the returned prompt string.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock heavy async dependencies ─────────────────────────────────────────────

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }),
  },
  cooksTable: {},
  grillsTable: { id: "id", userId: "userId" },
}));

vi.mock("../../../lib/smokerCalibration", () => ({
  computeSmokerInsights: vi.fn().mockResolvedValue(null),
  formatSmokerProfile: vi.fn().mockReturnValue(""),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

// Re-import after mocks are in place
let buildChatSystemPrompt: typeof import("../shared").buildChatSystemPrompt;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  ({ buildChatSystemPrompt } = await import("../shared"));
});

// ─── Direct-heat cook ─────────────────────────────────────────────────────────

describe("buildChatSystemPrompt — direct-heat cookingMethod", () => {
  const DIRECT_HEAT_METHODS = [
    "direct heat",
    "Direct Heat",
    "Sear",
    "sear",
    "Griddle",
    "griddle",
  ];

  const GRILLING_VOCAB = ["sear", "crust", "zone management"];
  const SMOKER_VOCAB = ["bark", "stall", "texas crutch"];

  for (const method of DIRECT_HEAT_METHODS) {
    describe(`cookingMethod = "${method}"`, () => {
      it("contains grilling vocabulary (sear, crust, zone management)", async () => {
        const prompt = await buildChatSystemPrompt(
          "user-1",
          null,
          undefined,
          undefined,
          method,
        );
        const lower = prompt.toLowerCase();
        for (const term of GRILLING_VOCAB) {
          expect(lower, `Expected prompt to contain grilling term "${term}"`).toContain(term);
        }
      });

      it("does NOT contain smoker vocabulary (bark, stall, Texas crutch)", async () => {
        const prompt = await buildChatSystemPrompt(
          "user-1",
          null,
          undefined,
          undefined,
          method,
        );
        const lower = prompt.toLowerCase();
        for (const term of SMOKER_VOCAB) {
          expect(lower, `Expected prompt NOT to contain smoker term "${term}"`).not.toContain(term);
        }
      });
    });
  }
});

// ─── Smoke / indirect cook ────────────────────────────────────────────────────

describe("buildChatSystemPrompt — smoke/indirect cookingMethod", () => {
  const SMOKE_METHODS = [
    "Low and Slow",
    "low and slow",
    "Smoke",
    "smoke",
    "Indirect",
    "indirect",
  ];

  const SMOKER_VOCAB = ["bark", "stall", "texas crutch"];
  // Grilling-specific terms that must NOT appear in the smoker persona
  const GRILLING_ONLY_VOCAB = ["zone management", "flare-up control"];

  for (const method of SMOKE_METHODS) {
    describe(`cookingMethod = "${method}"`, () => {
      it("contains smoker vocabulary (bark, stall, Texas crutch)", async () => {
        const prompt = await buildChatSystemPrompt(
          "user-2",
          null,
          undefined,
          undefined,
          method,
        );
        const lower = prompt.toLowerCase();
        for (const term of SMOKER_VOCAB) {
          expect(lower, `Expected prompt to contain smoker term "${term}"`).toContain(term);
        }
      });

      it("does NOT contain grilling-specific vocabulary (zone management, flare-up control)", async () => {
        const prompt = await buildChatSystemPrompt(
          "user-2",
          null,
          undefined,
          undefined,
          method,
        );
        const lower = prompt.toLowerCase();
        for (const term of GRILLING_ONLY_VOCAB) {
          expect(lower, `Expected prompt NOT to contain grilling term "${term}"`).not.toContain(term);
        }
      });
    });
  }
});

// ─── Null / undefined cookingMethod (generic BBQ coach) ──────────────────────
//
// The generic persona block intentionally mentions both grilling and smoker
// vocabulary as *examples* the AI may choose from ("bark, stall, Texas crutch
// for low-and-slow; sear, crust, zone management for direct heat"). What we
// test here is that no *specific* persona instruction is injected — i.e. the
// prompt is the generic "BBQ coach" block, not the grill-coach or pitmaster block.

describe("buildChatSystemPrompt — null cookingMethod (generic path)", () => {
  it("uses the generic BBQ coach instruction block, not the grill-coach persona", async () => {
    const prompt = await buildChatSystemPrompt("user-3", null, undefined, undefined, null);
    expect(prompt).toContain("Talk like a BBQ coach, not a chatbot");
    expect(prompt).not.toContain("Talk like a grill coach, not a chatbot");
  });

  it("does NOT use the pitmaster/smoker persona instruction", async () => {
    const prompt = await buildChatSystemPrompt("user-3", null, undefined, undefined, null);
    expect(prompt).not.toContain("Talk like a pitmaster, not a chatbot");
  });

  it("generic block references both domains so the AI can pick context-appropriate vocabulary", async () => {
    const prompt = await buildChatSystemPrompt("user-3", null, undefined, undefined, null);
    const lower = prompt.toLowerCase();
    // Generic instruction cites both smoking and grilling examples inline.
    expect(lower).toContain("bark");
    expect(lower).toContain("sear");
  });
});

describe("buildChatSystemPrompt — undefined cookingMethod (generic path)", () => {
  it("uses the generic BBQ coach instruction block", async () => {
    const prompt = await buildChatSystemPrompt("user-3", null, undefined, undefined, undefined);
    expect(prompt).toContain("Talk like a BBQ coach, not a chatbot");
    expect(prompt).not.toContain("Talk like a grill coach, not a chatbot");
    expect(prompt).not.toContain("Talk like a pitmaster, not a chatbot");
  });
});

// ─── Reverse-sear ─────────────────────────────────────────────────────────────

describe("buildChatSystemPrompt — reverse-sear cookingMethod", () => {
  it("uses the reverse-sear specialist persona instruction", async () => {
    const prompt = await buildChatSystemPrompt(
      "user-4",
      null,
      undefined,
      undefined,
      "Reverse Sear",
    );
    expect(prompt).toContain("Talk like a reverse-sear specialist, not a chatbot");
  });

  it("contains reverse-sear vocabulary (pull temp, two-stage cook)", async () => {
    const prompt = await buildChatSystemPrompt(
      "user-4",
      null,
      undefined,
      undefined,
      "Reverse Sear",
    );
    const lower = prompt.toLowerCase();
    expect(lower).toContain("pull temp");
    expect(lower).toContain("two-stage cook");
  });
});

// ─── Rotisserie ───────────────────────────────────────────────────────────────

describe("buildChatSystemPrompt — rotisserie cookingMethod", () => {
  it("uses the rotisserie persona instruction", async () => {
    const prompt = await buildChatSystemPrompt(
      "user-5",
      null,
      undefined,
      undefined,
      "Rotisserie",
    );
    expect(prompt).toContain("Talk like a rotisserie cook, not a chatbot");
  });

  it("contains rotisserie vocabulary (truss, baste, self-basting)", async () => {
    const prompt = await buildChatSystemPrompt(
      "user-5",
      null,
      undefined,
      undefined,
      "Rotisserie",
    );
    const lower = prompt.toLowerCase();
    expect(lower).toContain("truss");
    expect(lower).toContain("baste");
    expect(lower).toContain("self-basting");
  });
});
