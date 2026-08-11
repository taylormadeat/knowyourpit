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

// ── Routing regression tests ───────────────────────────────────────────────────

/**
 * Asserts the exact guide key for every confirmed mismatch from the audit, plus
 * a representative sample of already-correct cuts to prevent regressions.
 *
 * The helper looks up the guide in PREP_GUIDE_MAP by the expected key so that
 * the test fails with a meaningful message if the guide is ever renamed.
 */
function findCut(name: string) {
  const cut = MEAT_CUTS.find((c) => c.name === name);
  if (!cut) throw new Error(`Test setup: cut "${name}" not found in MEAT_CUTS`);
  return cut;
}

describe("getMeatPrep routing regression — confirmed mismatches now fixed", () => {
  // ── Previously misrouted cuts ──────────────────────────────────────────

  it('Baby Back Ribs (Pork) → ribs (pork rib guide, NOT beef_ribs)', () => {
    const result = getMeatPrep(findCut("Baby Back Ribs"));
    expect(result).toBe(PREP_GUIDE_MAP.ribs);
    // Sanity: the ribs guide tells you to REMOVE the membrane, not leave it on
    expect(result?.steps.join(" ")).toMatch(/remove the membrane/i);
  });

  it('Pork Belly Burnt Ends → pork_belly (NOT brisket)', () => {
    expect(getMeatPrep(findCut("Pork Belly Burnt Ends"))).toBe(PREP_GUIDE_MAP.pork_belly);
  });

  it('Tuna Steak → fish_steak (NOT steak)', () => {
    expect(getMeatPrep(findCut("Tuna Steak"))).toBe(PREP_GUIDE_MAP.fish_steak);
  });

  it('Swordfish Steak → fish_steak (NOT steak)', () => {
    expect(getMeatPrep(findCut("Swordfish Steak"))).toBe(PREP_GUIDE_MAP.fish_steak);
  });

  it('Striped Bass → fish_steak (NOT steak via "strip" substring)', () => {
    expect(getMeatPrep(findCut("Striped Bass"))).toBe(PREP_GUIDE_MAP.fish_steak);
  });

  it('Chuck Eye Steak → steak (NOT chuck_roast braising guide)', () => {
    expect(getMeatPrep(findCut("Chuck Eye Steak"))).toBe(PREP_GUIDE_MAP.steak);
  });

  it('Beef Short Ribs (Chuck) → beef_ribs (NOT chuck_roast)', () => {
    expect(getMeatPrep(findCut("Beef Short Ribs (Chuck)"))).toBe(PREP_GUIDE_MAP.beef_ribs);
  });

  it('Picanha (Top Sirloin Cap) → picanha (NOT pork_loin)', () => {
    expect(getMeatPrep(findCut("Picanha (Top Sirloin Cap)"))).toBe(PREP_GUIDE_MAP.picanha);
    // Sanity: picanha guide mentions fat cap
    expect(PREP_GUIDE_MAP.picanha.steps.join(" ")).toMatch(/fat cap/i);
  });

  it('Venison Tenderloin → lean_game (NOT pork_loin)', () => {
    expect(getMeatPrep(findCut("Venison Tenderloin"))).toBe(PREP_GUIDE_MAP.lean_game);
  });

  it('Lamb Loin Chops → lamb (NOT pork_loin)', () => {
    expect(getMeatPrep(findCut("Lamb Loin Chops"))).toBe(PREP_GUIDE_MAP.lamb);
  });

  it('Pork Steaks → pork_steak (NOT beef steak guide)', () => {
    expect(getMeatPrep(findCut("Pork Steaks"))).toBe(PREP_GUIDE_MAP.pork_steak);
  });

  it('Scallops → shellfish (NOT fish_steak)', () => {
    expect(getMeatPrep(findCut("Scallops"))).toBe(PREP_GUIDE_MAP.shellfish);
  });

  it('Oysters (in Shell) → shellfish (NOT fish_steak)', () => {
    expect(getMeatPrep(findCut("Oysters (in Shell)"))).toBe(PREP_GUIDE_MAP.shellfish);
  });

  it('Crab Legs → shellfish (NOT fish_steak)', () => {
    expect(getMeatPrep(findCut("Crab Legs"))).toBe(PREP_GUIDE_MAP.shellfish);
  });

  it('Octopus → shellfish (NOT fish_steak)', () => {
    expect(getMeatPrep(findCut("Octopus"))).toBe(PREP_GUIDE_MAP.shellfish);
  });

  it('Squid / Calamari → shellfish (NOT fish_steak)', () => {
    expect(getMeatPrep(findCut("Squid / Calamari"))).toBe(PREP_GUIDE_MAP.shellfish);
  });

  it('Cold-Smoked Salmon (Lox) → lox (NOT regular salmon guide)', () => {
    expect(getMeatPrep(findCut("Cold-Smoked Salmon (Lox)"))).toBe(PREP_GUIDE_MAP.lox);
  });

  // ── Already-correct cuts — must not regress ───────────────────────────

  it('Brisket (Whole Packer) → brisket', () => {
    expect(getMeatPrep(findCut("Brisket (Whole Packer)"))).toBe(PREP_GUIDE_MAP.brisket);
  });

  it('Beef Short Ribs (Plate) → beef_ribs', () => {
    expect(getMeatPrep(findCut("Beef Short Ribs (Plate)"))).toBe(PREP_GUIDE_MAP.beef_ribs);
  });

  it('Beef Back Ribs → beef_ribs', () => {
    expect(getMeatPrep(findCut("Beef Back Ribs"))).toBe(PREP_GUIDE_MAP.beef_ribs);
  });

  it('Ribeye Steak → steak', () => {
    expect(getMeatPrep(findCut("Ribeye Steak"))).toBe(PREP_GUIDE_MAP.steak);
  });

  it('Strip Steak (NY Strip) → steak', () => {
    expect(getMeatPrep(findCut("Strip Steak (NY Strip)"))).toBe(PREP_GUIDE_MAP.steak);
  });

  it('Pork Shoulder / Boston Butt → pork_shoulder', () => {
    expect(getMeatPrep(findCut("Pork Shoulder / Boston Butt"))).toBe(PREP_GUIDE_MAP.pork_shoulder);
  });

  it('Spare Ribs (St. Louis) → ribs', () => {
    expect(getMeatPrep(findCut("Spare Ribs (St. Louis)"))).toBe(PREP_GUIDE_MAP.ribs);
  });

  it('Baby Back Ribs membrane advice is correct (remove, not leave on)', () => {
    const guide = getMeatPrep(findCut("Baby Back Ribs"));
    // beef_ribs guide says "Leave the membrane on" — this must NOT appear for pork ribs
    expect(guide?.steps.join(" ")).not.toMatch(/leave the membrane on/i);
  });

  it('Rack of Lamb → rack_of_lamb', () => {
    expect(getMeatPrep(findCut("Rack of Lamb"))).toBe(PREP_GUIDE_MAP.rack_of_lamb);
  });

  it('Lamb Chops → lamb', () => {
    expect(getMeatPrep(findCut("Lamb Chops"))).toBe(PREP_GUIDE_MAP.lamb);
  });

  it('Salmon Fillet → salmon', () => {
    expect(getMeatPrep(findCut("Salmon Fillet"))).toBe(PREP_GUIDE_MAP.salmon);
  });

  it('Shrimp (Shell-On) → shrimp', () => {
    expect(getMeatPrep(findCut("Shrimp (Shell-On)"))).toBe(PREP_GUIDE_MAP.shrimp);
  });

  it('Venison Backstrap → venison', () => {
    expect(getMeatPrep(findCut("Venison Backstrap"))).toBe(PREP_GUIDE_MAP.venison);
  });

  it('Venison Roast → venison', () => {
    expect(getMeatPrep(findCut("Venison Roast"))).toBe(PREP_GUIDE_MAP.venison);
  });

  it('Bison Brisket → brisket', () => {
    expect(getMeatPrep(findCut("Bison Brisket"))).toBe(PREP_GUIDE_MAP.brisket);
  });

  it('Wild Boar Shoulder → pork_shoulder', () => {
    expect(getMeatPrep(findCut("Wild Boar Shoulder"))).toBe(PREP_GUIDE_MAP.pork_shoulder);
  });

  it('Chuck Roast → chuck_roast', () => {
    expect(getMeatPrep(findCut("Chuck Roast"))).toBe(PREP_GUIDE_MAP.chuck_roast);
  });

  it('Pork Loin (Boneless) → pork_loin', () => {
    expect(getMeatPrep(findCut("Pork Loin (Boneless)"))).toBe(PREP_GUIDE_MAP.pork_loin);
  });

  it('Pork Tenderloin → pork_tenderloin', () => {
    expect(getMeatPrep(findCut("Pork Tenderloin"))).toBe(PREP_GUIDE_MAP.pork_tenderloin);
  });
});

// ── Poultry parts routing — previously misrouted to whole-bird guides ──────────

describe("getMeatPrep poultry parts routing — chicken and turkey parts land on the correct guide", () => {
  // Chicken parts → chicken_parts (not the whole-bird chicken guide)
  it('Chicken Thighs (Bone-In) → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Thighs (Bone-In)"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  it('Chicken Thighs (Boneless) → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Thighs (Boneless)"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  it('Chicken Drumsticks → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Drumsticks"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  it('Chicken Leg Quarters → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Leg Quarters"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  it('Chicken Breast (Bone-In) → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Breast (Bone-In)"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  it('Chicken Breast (Boneless) → chicken_parts (not whole-bird chicken guide)', () => {
    expect(getMeatPrep(findCut("Chicken Breast (Boneless)"))).toBe(PREP_GUIDE_MAP.chicken_parts);
  });

  // Turkey parts → turkey_parts (not whole-turkey guide)
  it('Turkey Legs → turkey_parts (not whole-turkey guide)', () => {
    expect(getMeatPrep(findCut("Turkey Legs"))).toBe(PREP_GUIDE_MAP.turkey_parts);
  });

  it('Turkey Thighs → turkey_parts (not whole-turkey guide)', () => {
    expect(getMeatPrep(findCut("Turkey Thighs"))).toBe(PREP_GUIDE_MAP.turkey_parts);
  });

  it('Turkey Wings → turkey_parts (not whole-turkey guide)', () => {
    expect(getMeatPrep(findCut("Turkey Wings"))).toBe(PREP_GUIDE_MAP.turkey_parts);
  });

  // Whole-bird cuts must remain unaffected
  it('Whole Chicken → chicken (whole-bird guide, unaffected)', () => {
    expect(getMeatPrep(findCut("Whole Chicken"))).toBe(PREP_GUIDE_MAP.chicken);
  });

  it('Spatchcock Chicken → chicken (whole-bird guide, unaffected)', () => {
    expect(getMeatPrep(findCut("Spatchcock Chicken"))).toBe(PREP_GUIDE_MAP.chicken);
  });

  it('Beer Can Chicken → chicken (whole-bird guide, unaffected)', () => {
    expect(getMeatPrep(findCut("Beer Can Chicken"))).toBe(PREP_GUIDE_MAP.chicken);
  });

  it('Whole Turkey → turkey (whole-turkey guide, unaffected)', () => {
    expect(getMeatPrep(findCut("Whole Turkey"))).toBe(PREP_GUIDE_MAP.turkey);
  });

  it('Spatchcock Turkey → turkey (whole-turkey guide, unaffected)', () => {
    expect(getMeatPrep(findCut("Spatchcock Turkey"))).toBe(PREP_GUIDE_MAP.turkey);
  });

  // Sanity: chicken_parts guide must NOT contain whole-bird spatchcock/cavity language
  it('chicken_parts guide steps do not mention spatchcock or cavity', () => {
    const steps = PREP_GUIDE_MAP.chicken_parts.steps.join(" ");
    expect(steps).not.toMatch(/spatchcock/i);
    expect(steps).not.toMatch(/cavity/i);
  });

  // Sanity: chicken_parts guide addresses the 175°F vs 165°F dark/white meat distinction
  it('chicken_parts guide distinguishes 175°F dark meat from 165°F breast', () => {
    const steps = PREP_GUIDE_MAP.chicken_parts.steps.join(" ");
    expect(steps).toMatch(/175/);
    expect(steps).toMatch(/165/);
  });
});
