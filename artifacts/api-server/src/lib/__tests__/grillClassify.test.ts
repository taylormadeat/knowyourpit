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
import { grillClassCoachingNote, type GrillClass } from "../grillClassify";

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
