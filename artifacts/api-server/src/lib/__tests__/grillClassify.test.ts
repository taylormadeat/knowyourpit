/**
 * Unit tests for grillClassCoachingNote — the function that returns
 * AI-prompt coaching text tailored by grill class and cooking method.
 *
 * Critical invariants under test:
 *   1. For every grill class that has direct-heat-aware logic (pellet, kamado,
 *      kettle, charcoal, gas, griddle), the coaching note returned for a
 *      direct-heat cooking method must NOT contain wrap/stall/bark language.
 *   2. For indirect/smoke cooking methods (or no method), grill classes that
 *      do recommend wrapping must contain positive wrap references.
 *   3. The griddle class never mentions wrap guidance regardless of method.
 *
 * No mocking needed — grillClassCoachingNote is a pure function.
 */

import { describe, it, expect } from "vitest";
import { grillClassCoachingNote, classifyCookingMethod, type GrillClass } from "../grillClassify";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect POSITIVE wrap/stall/bark recommendations in a coaching note.
 * Suppression phrases like "no wrap guidance applies" or "no wrap needed"
 * must NOT trigger this — they are the correct signal that wrapping is
 * being withheld.  We check for affirmative phrases that tell a griller
 * TO wrap, watch for bark, or manage a stall.
 */
function containsWrapLanguage(note: string): boolean {
  const lower = note.toLowerCase();
  // Positive wrap/stall/bark recommendations
  const AFFIRMATIVE_PATTERNS = [
    /\bwrap (at|in|when|timing|recommendations)\b/,
    /\bwrap timing applies\b/,
    /\bwrap recommendations apply\b/,
    /\btime to wrap\b/,
    /\bshould wrap\b/,
    /\bbutcher paper at (the )?stall\b/,
    /\bpush through the stall\b/,
    /\b(stall|bark) (?:behavior|applies|timing|looking)\b/,
    /\bmanage (the )?stall\b/,
    /\bgood bark\b/,
    /\bget (a |better )?bark\b/,
    /\bbark formation\b/,
  ];
  return AFFIRMATIVE_PATTERNS.some((re) => re.test(lower));
}

const DIRECT_HEAT_METHODS = ["Direct Heat", "Sear", "Griddle"];
const SMOKE_METHODS = ["Low and Slow", "Smoke", null, undefined];

// All grill classes defined by the GrillClass type
const ALL_GRILL_CLASSES: GrillClass[] = [
  "pellet",
  "offset",
  "kamado",
  "cabinet",
  "kettle",
  "charcoal",
  "gas",
  "griddle",
  "combo",
  "other",
];

// ── classifyCookingMethod: full regression matrix ────────────────────────────

describe("classifyCookingMethod — nullish / empty inputs", () => {
  it("returns 'unknown' for null", () => {
    expect(classifyCookingMethod(null)).toBe("unknown");
  });
  it("returns 'unknown' for undefined", () => {
    expect(classifyCookingMethod(undefined)).toBe("unknown");
  });
  it("returns 'unknown' for empty string", () => {
    expect(classifyCookingMethod("")).toBe("unknown");
  });
  it("returns 'unknown' for unrecognised value", () => {
    expect(classifyCookingMethod("Sous Vide")).toBe("unknown");
  });
});

describe("classifyCookingMethod — smoke / low-and-slow", () => {
  it('classifies "Smoke" as "smoke"', () => {
    expect(classifyCookingMethod("Smoke")).toBe("smoke");
  });
  it('classifies "smoke" (lowercase) as "smoke"', () => {
    expect(classifyCookingMethod("smoke")).toBe("smoke");
  });
  it('classifies "Low and Slow" as "smoke"', () => {
    expect(classifyCookingMethod("Low and Slow")).toBe("smoke");
  });
  it('classifies "Low & Slow" as "smoke"', () => {
    expect(classifyCookingMethod("Low & Slow")).toBe("smoke");
  });
  it('classifies "Low and Slow with Sear Finish" as "sear" (sear check precedes smoke in chain)', () => {
    // The classifier checks "sear" before "smoke" / "low and slow", so the
    // presence of "sear" in this compound string wins. This is the documented
    // ordering contract — a test failure here means the chain order changed.
    expect(classifyCookingMethod("Low and Slow with Sear Finish")).toBe("sear");
  });
  it('classifies "Direct Smoke" as "direct" (direct check precedes smoke in chain)', () => {
    // The classifier checks "direct" before "smoke", so the presence of "direct"
    // in this compound string wins. This is the documented ordering contract —
    // a test failure here means the chain order changed.
    expect(classifyCookingMethod("Direct Smoke")).toBe("direct");
  });
});

describe("classifyCookingMethod — indirect", () => {
  it('classifies "Indirect" as "indirect", not "direct"', () => {
    expect(classifyCookingMethod("Indirect")).toBe("indirect");
  });
  it('classifies "indirect" (lowercase) as "indirect"', () => {
    expect(classifyCookingMethod("indirect")).toBe("indirect");
  });
  it('classifies "Indirect Heat" as "indirect"', () => {
    expect(classifyCookingMethod("Indirect Heat")).toBe("indirect");
  });
  it('classifies "INDIRECT" (uppercase) as "indirect"', () => {
    expect(classifyCookingMethod("INDIRECT")).toBe("indirect");
  });
});

describe("classifyCookingMethod — direct", () => {
  it('classifies "Direct Heat" as "direct"', () => {
    expect(classifyCookingMethod("Direct Heat")).toBe("direct");
  });
  it('classifies "direct" (lowercase) as "direct"', () => {
    expect(classifyCookingMethod("direct")).toBe("direct");
  });
  it('classifies "Direct Grilling" as "direct"', () => {
    expect(classifyCookingMethod("Direct Grilling")).toBe("direct");
  });
  it('does NOT classify "Indirect" as "direct"', () => {
    expect(classifyCookingMethod("Indirect")).not.toBe("direct");
  });
});

describe("classifyCookingMethod — sear (but not reverse-sear)", () => {
  it('classifies "Sear" as "sear"', () => {
    expect(classifyCookingMethod("Sear")).toBe("sear");
  });
  it('classifies "Searing" as "sear"', () => {
    expect(classifyCookingMethod("Searing")).toBe("sear");
  });
  it('classifies "Direct Sear" as "sear"', () => {
    expect(classifyCookingMethod("Direct Sear")).toBe("sear");
  });
  it('does NOT classify "Sear" as "direct"', () => {
    expect(classifyCookingMethod("Sear")).not.toBe("direct");
  });
});

describe("classifyCookingMethod — reverse_sear", () => {
  it('classifies "Reverse Sear" as "reverse_sear"', () => {
    expect(classifyCookingMethod("Reverse Sear")).toBe("reverse_sear");
  });
  it('classifies "reverse-sear" (hyphenated) as "reverse_sear"', () => {
    expect(classifyCookingMethod("reverse-sear")).toBe("reverse_sear");
  });
  it('classifies "Reverse Sear Ribeye" as "reverse_sear"', () => {
    expect(classifyCookingMethod("Reverse Sear Ribeye")).toBe("reverse_sear");
  });
  it('does NOT classify "Reverse Sear" as "sear"', () => {
    expect(classifyCookingMethod("Reverse Sear")).not.toBe("sear");
  });
  it('does NOT classify "Reverse Sear" as "direct"', () => {
    expect(classifyCookingMethod("Reverse Sear")).not.toBe("direct");
  });
});

describe("classifyCookingMethod — rotisserie", () => {
  it('classifies "Rotisserie" as "rotisserie"', () => {
    expect(classifyCookingMethod("Rotisserie")).toBe("rotisserie");
  });
  it('classifies "rotisserie" (lowercase) as "rotisserie"', () => {
    expect(classifyCookingMethod("rotisserie")).toBe("rotisserie");
  });
  it('classifies "Rotary Spit" as "rotisserie"', () => {
    expect(classifyCookingMethod("Rotary Spit")).toBe("rotisserie");
  });
  it('classifies "Rotisserie Chicken" as "rotisserie"', () => {
    expect(classifyCookingMethod("Rotisserie Chicken")).toBe("rotisserie");
  });
  it('does NOT classify "Rotisserie" as "direct"', () => {
    expect(classifyCookingMethod("Rotisserie")).not.toBe("direct");
  });
  it('does NOT classify "Rotisserie" as "sear"', () => {
    expect(classifyCookingMethod("Rotisserie")).not.toBe("sear");
  });
  it('does NOT classify "Rotisserie" as "smoke"', () => {
    expect(classifyCookingMethod("Rotisserie")).not.toBe("smoke");
  });
});

describe("classifyCookingMethod — griddle", () => {
  it('classifies "Griddle" as "griddle"', () => {
    expect(classifyCookingMethod("Griddle")).toBe("griddle");
  });
  it('classifies "Flat Top Griddle" as "griddle"', () => {
    expect(classifyCookingMethod("Flat Top Griddle")).toBe("griddle");
  });
});

// ── Ordering matrix: compound strings that trigger two branches simultaneously ─
//
// The classifier chain in grillClassify.ts runs in this fixed order:
//   1. reverse_sear  (checks "reverse sear" / "reverse-sear")
//   2. sear          (checks "sear")
//   3. rotisserie    (checks "rotisserie" / "rotary")
//   4. griddle       (checks "griddle")
//   5. indirect      (checks "indirect")  ← also matches inside "direct" strings if not careful
//   6. direct        (checks "direct")
//   7. smoke         (checks "smoke" / "low and slow" / "low & slow")
//
// Each row below is a compound string that matches two adjacent (or important
// non-adjacent) branches; the expected result encodes the required order.
// A test failure means the chain was reordered — a breaking regression.

describe("classifyCookingMethod — full precedence ordering matrix", () => {
  const ORDER_CASES: Array<{ input: string; expected: string; note: string }> = [
    // ── adjacent boundary: reverse_sear (1) > sear (2) ───────────────────────
    {
      input: "Reverse Sear",
      expected: "reverse_sear",
      note: '"reverse sear" contains "sear"; reverse_sear branch must fire first',
    },
    {
      input: "reverse-sear",
      expected: "reverse_sear",
      note: 'hyphenated form also contains "sear"',
    },

    // ── adjacent boundary: sear (2) > rotisserie (3) ─────────────────────────
    {
      input: "Rotisserie with Sear Finish",
      expected: "sear",
      note: '"sear" branch precedes "rotisserie" in chain',
    },

    // ── adjacent boundary: rotisserie (3) > griddle (4) ──────────────────────
    {
      input: "Rotisserie on Griddle",
      expected: "rotisserie",
      note: '"rotisserie" branch precedes "griddle" in chain',
    },

    // ── adjacent boundary: griddle (4) > indirect (5) ────────────────────────
    {
      input: "Indirect Griddle",
      expected: "griddle",
      note: '"griddle" branch precedes "indirect" in chain',
    },

    // ── adjacent boundary: griddle (4) > direct (6) ──────────────────────────
    {
      input: "Direct Griddle",
      expected: "griddle",
      note: '"griddle" branch precedes "direct" in chain',
    },

    // ── adjacent boundary: indirect (5) > direct (6) ─────────────────────────
    // "indirect" contains the substring "direct"; indirect must be checked first.
    {
      input: "Indirect",
      expected: "indirect",
      note: '"indirect" contains "direct"; indirect branch must fire first',
    },
    {
      input: "Indirect Heat",
      expected: "indirect",
      note: '"indirect heat" contains "direct"; indirect branch must fire first',
    },

    // ── adjacent boundary: direct (6) > smoke (7) ────────────────────────────
    {
      input: "Direct Smoke",
      expected: "direct",
      note: '"direct" branch precedes "smoke" in chain',
    },

    // ── non-adjacent: sear (2) > smoke (7) ───────────────────────────────────
    {
      input: "Low and Slow with Sear Finish",
      expected: "sear",
      note: '"sear" branch precedes "smoke"/"low and slow" in chain',
    },

    // ── non-adjacent: sear (2) > indirect (5) ────────────────────────────────
    {
      input: "Indirect Sear",
      expected: "sear",
      note: '"sear" branch precedes "indirect" in chain',
    },

    // ── non-adjacent: sear (2) > direct (6) ──────────────────────────────────
    {
      input: "Direct Sear",
      expected: "sear",
      note: '"sear" branch precedes "direct" in chain',
    },

    // ── non-adjacent: rotisserie (3) > indirect (5) ──────────────────────────
    {
      input: "Indirect Rotisserie",
      expected: "rotisserie",
      note: '"rotisserie" branch precedes "indirect" in chain',
    },

    // ── non-adjacent: rotisserie (3) > direct (6) ────────────────────────────
    {
      input: "Direct Rotisserie",
      expected: "rotisserie",
      note: '"rotisserie" branch precedes "direct" in chain',
    },

    // ── non-adjacent: rotisserie (3) > smoke (7) ─────────────────────────────
    {
      input: "Rotisserie Smoke",
      expected: "rotisserie",
      note: '"rotisserie" branch precedes "smoke" in chain',
    },

    // ── non-adjacent: griddle (4) > smoke (7) ────────────────────────────────
    {
      input: "Griddle Smoke",
      expected: "griddle",
      note: '"griddle" branch precedes "smoke" in chain',
    },

    // ── non-adjacent: reverse_sear (1) > rotisserie (3) ─────────────────────
    {
      input: "Rotisserie Reverse Sear",
      expected: "reverse_sear",
      note: '"reverse_sear" branch precedes "rotisserie" in chain',
    },

    // ── non-adjacent: reverse_sear (1) > smoke (7) ───────────────────────────
    {
      input: "Low and Slow Reverse Sear",
      expected: "reverse_sear",
      note: '"reverse_sear" branch precedes "smoke" in chain',
    },
  ];

  for (const { input, expected, note } of ORDER_CASES) {
    it(`"${input}" → "${expected}" (${note})`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

describe("classifyCookingMethod — ordering guard: reverse_sear wins over sear", () => {
  // "reverse sear" contains "sear" — the classifier must check reverse_sear first.
  it('"Reverse Sear" classified as "reverse_sear", not "sear"', () => {
    expect(classifyCookingMethod("Reverse Sear")).toBe("reverse_sear");
  });
  it('"reverse-sear" classified as "reverse_sear", not "sear"', () => {
    expect(classifyCookingMethod("reverse-sear")).toBe("reverse_sear");
  });
});

describe("classifyCookingMethod — ordering guard: indirect wins over direct", () => {
  // "indirect" contains "direct" — the classifier must check indirect first.
  it('"Indirect" classified as "indirect", not "direct"', () => {
    expect(classifyCookingMethod("Indirect")).toBe("indirect");
  });
  it('"Indirect Heat" classified as "indirect", not "direct"', () => {
    expect(classifyCookingMethod("Indirect Heat")).toBe("indirect");
  });
});

describe("classifyCookingMethod — case insensitivity", () => {
  it('"ROTISSERIE" → rotisserie', () => {
    expect(classifyCookingMethod("ROTISSERIE")).toBe("rotisserie");
  });
  it('"LOW AND SLOW" → smoke', () => {
    expect(classifyCookingMethod("LOW AND SLOW")).toBe("smoke");
  });
  it('"INDIRECT HEAT" → indirect', () => {
    expect(classifyCookingMethod("INDIRECT HEAT")).toBe("indirect");
  });
  it('"REVERSE SEAR" → reverse_sear', () => {
    expect(classifyCookingMethod("REVERSE SEAR")).toBe("reverse_sear");
  });
});

// ── Direct-heat methods suppress all wrap language ───────────────────────────

describe("direct-heat cooking methods — no wrap language in any grill note", () => {
  for (const method of DIRECT_HEAT_METHODS) {
    describe(`cookingMethod = "${method}"`, () => {
      for (const grillClass of ALL_GRILL_CLASSES) {
        it(`grillClass "${grillClass}" — coaching note contains no wrap/stall/bark language`, () => {
          const note = grillClassCoachingNote(grillClass, method);
          expect(containsWrapLanguage(note)).toBe(false);
        });
      }
    });
  }
});

// ── Indirect/smoke methods — wrap-aware grill classes include wrap guidance ───

describe("smoke / indirect methods — wrap-capable grill classes include wrap guidance", () => {
  // These grill classes explicitly say "Wrap recommendations apply" for indirect cooks.
  const WRAP_CAPABLE_CLASSES: GrillClass[] = [
    "offset",
    "kamado",
    "cabinet",
    "kettle",
    "charcoal",
    "gas",
  ];

  for (const grillClass of WRAP_CAPABLE_CLASSES) {
    it(`grillClass "${grillClass}" with no method contains wrap guidance`, () => {
      const note = grillClassCoachingNote(grillClass, null);
      expect(containsWrapLanguage(note)).toBe(true);
    });

    it(`grillClass "${grillClass}" with smoke method contains wrap guidance`, () => {
      const note = grillClassCoachingNote(grillClass, "Low and Slow");
      expect(containsWrapLanguage(note)).toBe(true);
    });
  }
});

// ── Griddle always suppresses wrap language ───────────────────────────────────

describe("griddle class — never mentions wrap guidance regardless of method", () => {
  for (const method of [...DIRECT_HEAT_METHODS, ...SMOKE_METHODS]) {
    it(`cookingMethod = ${JSON.stringify(method)} → no wrap language`, () => {
      const note = grillClassCoachingNote("griddle", method ?? undefined);
      expect(containsWrapLanguage(note)).toBe(false);
    });
  }
});

// ── Pellet grill: direct vs. indirect distinction ────────────────────────────

describe("pellet grill — direct-heat vs indirect distinction", () => {
  it("direct heat note does not contain positive wrap/stall recommendations", () => {
    const note = grillClassCoachingNote("pellet", "Direct Heat");
    expect(containsWrapLanguage(note)).toBe(false);
  });

  it("direct heat note mentions pellet-specific direct-heat tips (grates, preheat)", () => {
    const note = grillClassCoachingNote("pellet", "Direct Heat");
    const lower = note.toLowerCase();
    expect(lower).toMatch(/preheat|grates|flame broiler|sear/);
  });

  it("indirect note mentions Super Smoke or hopper (smoke-specific tips)", () => {
    const note = grillClassCoachingNote("pellet", null);
    const lower = note.toLowerCase();
    expect(lower).toMatch(/super smoke|hopper|smoke ring/);
  });
});

// ── Combo grill: wrap only for smoke chamber ─────────────────────────────────

describe("combo grill — wrap applies only to smoke chamber", () => {
  it("note mentions wrap recommendations for smoke chamber items", () => {
    const note = grillClassCoachingNote("combo", null);
    expect(note.toLowerCase()).toContain("wrap");
    expect(note.toLowerCase()).toContain("smoke chamber");
  });
});

// ── 'other' class returns empty string ───────────────────────────────────────

describe("'other' grill class returns empty string", () => {
  for (const method of [null, undefined, "Direct Heat", "Low and Slow"]) {
    it(`returns empty string for method = ${JSON.stringify(method)}`, () => {
      const note = grillClassCoachingNote("other", method ?? undefined);
      expect(note).toBe("");
    });
  }
});
