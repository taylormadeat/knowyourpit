/**
 * Unit tests for the Plan-screen prep guide method gate.
 *
 * Critical invariants under test:
 *   1. Every directHeatTip in PREP_GUIDE_MAP is genuinely direct-heat-safe —
 *      it must NOT contain wrap, stall, or bark coaching language.
 *   2. The tip selection logic in plan.tsx correctly routes to directHeatTip
 *      for direct/sear/griddle methods and to the base tip otherwise.
 *
 * No mocking needed — PREP_GUIDE_MAP is a plain data structure and the
 * selection logic is a pure expression.
 */

import { PREP_GUIDE_MAP, getMeatPrep, type MeatPrepGuide } from "../../components/plan-screen/prepGuides";
import { MEAT_CUTS, isProduce } from "../../constants/meatCuts";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Detect POSITIVE wrap/stall/bark recommendations in a tip string.
 * Phrases like "wrap in foil", "wrap in butcher paper", "push through the
 * stall", and "wrap at the stall" are the actionable signals we must exclude
 * from any tip that reaches a direct-heat cook.
 */
const POSITIVE_WRAP_PATTERNS = [
  /\bwrap in (foil|butcher paper|plastic)\b/i,
  /\bwrap (at|when|in|to)\b/i,
  /\bpush through the stall\b/i,
  /\bthe stall (still )?hits\b/i,
  /\bstall\b/i,
  /\bgood bark\b/i,
  /\bget (a |better )?bark\b/i,
];

function containsWrapOrStallLanguage(text: string): boolean {
  return POSITIVE_WRAP_PATTERNS.some((re) => re.test(text));
}

import { isDirectHeat } from "../../utils/cookingMethod";

/**
 * Mirrors the tip-selection expression from plan.tsx so we can test it in
 * isolation without rendering the full component.
 *
 * plan.tsx:
 *   prep.directHeatTip && isDirectHeat(qpCookMethod)
 *     ? prep.directHeatTip
 *     : prep.tip
 *
 * isDirectHeat() from cookingMethod.ts classifies the method first, so
 * "Reverse Sear" → reverse_sear (NOT direct heat) and does NOT receive
 * the grill-only directHeatTip.
 */
function selectTip(prep: MeatPrepGuide, cookingMethod: string | null): string {
  const direct = !!prep.directHeatTip && isDirectHeat(cookingMethod);
  return direct ? prep.directHeatTip! : prep.tip;
}

// ── Every entry in PREP_GUIDE_MAP has a directHeatTip ────────────────────────

describe("PREP_GUIDE_MAP completeness — every cut must have a directHeatTip", () => {
  const allEntries = Object.entries(PREP_GUIDE_MAP);

  for (const [key, guide] of allEntries) {
    it(`PREP_GUIDE_MAP.${key} has a non-empty directHeatTip`, () => {
      expect(guide.directHeatTip).toBeTruthy();
    });
  }
});

// ── All directHeatTip entries are free of wrap/stall/bark language ────────────

describe("directHeatTip content — no wrap/stall/bark language", () => {
  const entriesWithDirectHeatTip = Object.entries(PREP_GUIDE_MAP).filter(
    ([, guide]) => !!guide.directHeatTip,
  );

  it("at least one entry has a directHeatTip (ensures test is not vacuous)", () => {
    expect(entriesWithDirectHeatTip.length).toBeGreaterThan(0);
  });

  for (const [key, guide] of entriesWithDirectHeatTip) {
    it(`PREP_GUIDE_MAP.${key}.directHeatTip contains no wrap/stall/bark language`, () => {
      expect(containsWrapOrStallLanguage(guide.directHeatTip!)).toBe(false);
    });
  }
});

// ── Every built-in non-produce cut resolves to a prep guide ──────────────────

describe("getMeatPrep coverage — every non-produce cut in MEAT_CUTS has a guide", () => {
  const nonProduceCuts = MEAT_CUTS.filter((cut) => !isProduce(cut.category));

  it("has non-produce cuts to check (ensures test is not vacuous)", () => {
    expect(nonProduceCuts.length).toBeGreaterThan(0);
  });

  for (const cut of nonProduceCuts) {
    it(`"${cut.name}" (${cut.category}) → non-null prep guide`, () => {
      expect(getMeatPrep(cut)).not.toBeNull();
    });
  }
});

// ── Plan-screen tip selection gate ────────────────────────────────────────────

describe("plan.tsx tip selection gate — direct-heat routes to directHeatTip", () => {
  const DIRECT_METHODS = ["Direct Heat", "Sear", "Griddle", "direct heat", "sear"];
  // "Reverse Sear" must NOT trigger the direct-heat branch — it is a hybrid
  // smoke-then-sear method and smoker tips are relevant for that first phase.
  const SMOKE_METHODS = [null, "Low and Slow", "Smoke", "Indirect", "Reverse Sear"];

  describe("pork shoulder — was incorrectly showing indirect/wrap advice for direct heat", () => {
    const guide = PREP_GUIDE_MAP.pork_shoulder;

    for (const method of DIRECT_METHODS) {
      it(`method "${method}" → shows directHeatTip with no wrap/stall language`, () => {
        const tip = selectTip(guide, method);
        expect(tip).toBe(guide.directHeatTip);
        expect(containsWrapOrStallLanguage(tip)).toBe(false);
      });
    }

    for (const method of SMOKE_METHODS) {
      it(`method ${JSON.stringify(method)} → shows base tip (which may mention stall)`, () => {
        const tip = selectTip(guide, method);
        expect(tip).toBe(guide.tip);
      });
    }
  });

  describe("ribs — was incorrectly describing an indirect setup for direct heat", () => {
    const guide = PREP_GUIDE_MAP.ribs;

    for (const method of DIRECT_METHODS) {
      it(`method "${method}" → shows directHeatTip with no wrap/stall language`, () => {
        const tip = selectTip(guide, method);
        expect(tip).toBe(guide.directHeatTip);
        expect(containsWrapOrStallLanguage(tip)).toBe(false);
      });
    }

    for (const method of SMOKE_METHODS) {
      it(`method ${JSON.stringify(method)} → shows base tip (which may mention wrapping)`, () => {
        const tip = selectTip(guide, method);
        expect(tip).toBe(guide.tip);
      });
    }
  });

  describe("steak — direct-heat tip should contain high-heat searing advice", () => {
    const guide = PREP_GUIDE_MAP.steak;

    it('method "Direct Heat" → shows directHeatTip', () => {
      const tip = selectTip(guide, "Direct Heat");
      expect(tip).toBe(guide.directHeatTip);
      expect(containsWrapOrStallLanguage(tip)).toBe(false);
    });

    it("null method → shows base tip (reverse sear tip)", () => {
      const tip = selectTip(guide, null);
      expect(tip).toBe(guide.tip);
    });
  });

  describe("guides without a directHeatTip always show the base tip regardless of method", () => {
    const entriesWithoutDirectHeatTip = Object.entries(PREP_GUIDE_MAP).filter(
      ([, guide]) => !guide.directHeatTip,
    );

    for (const [key, guide] of entriesWithoutDirectHeatTip) {
      it(`PREP_GUIDE_MAP.${key} — base tip shown for Direct Heat method`, () => {
        const tip = selectTip(guide, "Direct Heat");
        expect(tip).toBe(guide.tip);
      });
    }
  });
});
