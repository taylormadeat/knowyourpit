/**
 * Unit tests for getCookSuggestions — the pure function that returns
 * context-aware PitMaster quick-prompt suggestions.
 *
 * Critical invariants under test:
 *   1. Direct-heat methods (Direct Heat, Sear, Griddle) NEVER return
 *      wrap / stall / bark prompts.
 *   2. Smoke / indirect methods DO return wrap / stall / bark prompts.
 *   3. The method gate takes precedence over the food-type gate — i.e. a
 *      brisket cooked "Direct Heat" gets direct-heat prompts, not the
 *      default smoke/wrap prompts.
 *
 * No mocking needed — getCookSuggestions is a pure function.
 */

import { getCookSuggestions } from "../getCookSuggestions";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect POSITIVE wrap/stall/bark recommendations in suggestion strings.
 * These are the phrases that a griller doing direct-heat cooking must never see.
 */
const WRAP_POSITIVE_PATTERNS = [
  /\bwrap\b/,   // "Should I wrap", "Is it time to wrap", "When should I wrap"
  /\bstall\b/,  // "Am I in the stall", "Temp stalled"
  /\bbark\b/,   // "How's my bark", "Get better bark"
];

function containsWrapLanguage(suggestions: string[]): boolean {
  return suggestions.some((s) =>
    WRAP_POSITIVE_PATTERNS.some((re) => re.test(s.toLowerCase())),
  );
}

// ── Direct-heat method gate ───────────────────────────────────────────────────

describe("direct-heat methods — no wrap / stall / bark language", () => {
  const directMethods = ["Direct Heat", "direct heat", "Sear", "Griddle"];

  const testFoods = [
    "Brisket",
    "Pork Butt",
    "Ribs",
    "Baby Back Ribs",
    "Chicken",
    "Salmon",
    "Steak",
    "Burger",
    "Unknown Food",
  ];

  for (const method of directMethods) {
    describe(`cookingMethod = "${method}"`, () => {
      for (const food of testFoods) {
        it(`returns no wrap/stall/bark language for ${food}`, () => {
          const suggestions = getCookSuggestions(food, method);
          expect(containsWrapLanguage(suggestions)).toBe(false);
        });
      }

      it("returns a non-empty array of suggestions", () => {
        const suggestions = getCookSuggestions("Steak", method);
        expect(suggestions.length).toBeGreaterThan(0);
      });
    });
  }
});

// ── Smoke / indirect methods return wrap prompts ──────────────────────────────

describe("smoke / indirect methods — wrap / stall / bark prompts present", () => {
  it("brisket with no method returns wrap/stall prompts", () => {
    const suggestions = getCookSuggestions("Brisket", null);
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });

  it("brisket with undefined method returns wrap/stall prompts", () => {
    const suggestions = getCookSuggestions("Brisket", undefined);
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });

  it("pork butt with no method returns wrap/stall prompts", () => {
    const suggestions = getCookSuggestions("Pork Butt", null);
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });

  it("ribs with no method returns wrap/stall prompts", () => {
    const suggestions = getCookSuggestions("Baby Back Ribs", null);
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });

  it("generic food with no method returns the default smoke prompts including wrap", () => {
    const suggestions = getCookSuggestions("Lamb Shank", null);
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });
});

// ── Direct-heat gate overrides food type ──────────────────────────────────────

describe("direct-heat method gate overrides food-type defaults", () => {
  it("brisket + Direct Heat → no wrap/stall/bark prompts", () => {
    // Brisket normally returns wrap/stall prompts, but Direct Heat suppresses them.
    const suggestions = getCookSuggestions("Brisket", "Direct Heat");
    expect(containsWrapLanguage(suggestions)).toBe(false);
  });

  it("pork butt + Direct Heat → no wrap/stall/bark prompts", () => {
    const suggestions = getCookSuggestions("Pork Butt", "Direct Heat");
    expect(containsWrapLanguage(suggestions)).toBe(false);
  });

  it("baby back ribs + Sear → no wrap/stall/bark prompts", () => {
    const suggestions = getCookSuggestions("Baby Back Ribs", "Sear");
    expect(containsWrapLanguage(suggestions)).toBe(false);
  });
});

// ── Food-type specific direct-heat prompt sets ────────────────────────────────

describe("food-type specific direct-heat prompts", () => {
  it("steak + Direct Heat → includes 'flip' or 'crust' prompts", () => {
    const suggestions = getCookSuggestions("Ribeye Steak", "Direct Heat");
    const text = suggestions.join(" ").toLowerCase();
    expect(text).toMatch(/flip|crust|rest/);
  });

  it("burger + Direct Heat → includes 'flip' prompt", () => {
    const suggestions = getCookSuggestions("Burger Patty", "Direct Heat");
    const text = suggestions.join(" ").toLowerCase();
    expect(text).toContain("flip");
  });

  it("chicken + Direct Heat → includes 'crispier skin' or 'burning' prompt", () => {
    const suggestions = getCookSuggestions("Chicken Thighs", "Direct Heat");
    const text = suggestions.join(" ").toLowerCase();
    expect(text).toMatch(/crispier skin|burning|prevent/);
  });

  it("salmon + Direct Heat → includes 'sticking' or 'fish basket' prompt", () => {
    const suggestions = getCookSuggestions("Salmon Fillet", "Direct Heat");
    const text = suggestions.join(" ").toLowerCase();
    expect(text).toMatch(/stick|basket|pull/);
  });
});

// ── Null / undefined food type handling ──────────────────────────────────────

describe("null / undefined food type", () => {
  it("null foodType + Direct Heat → still returns direct-heat fallback (no wrap language)", () => {
    const suggestions = getCookSuggestions(null, "Direct Heat");
    expect(containsWrapLanguage(suggestions)).toBe(false);
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it("undefined foodType + null method → returns smoke fallback (may include wrap)", () => {
    const suggestions = getCookSuggestions(undefined, null);
    // Smoke fallback always includes wrap language
    expect(containsWrapLanguage(suggestions)).toBe(true);
  });
});
