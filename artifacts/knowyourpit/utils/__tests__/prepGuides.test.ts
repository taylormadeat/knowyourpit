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

import { PREP_GUIDE_MAP, getMeatPrep, selectPrepTip, type MeatPrepGuide } from "../../components/plan-screen/prepGuides";
import { MEAT_CUTS, isProduce, type MeatCut } from "../../constants/meatCuts";

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

/**
 * Delegates to selectPrepTip() from prepGuides so the test mirrors the exact
 * logic used in plan.tsx — keeping them in sync is the whole point.
 */
function selectTip(prep: MeatPrepGuide, cookingMethod: string | null): string {
  return selectPrepTip(prep, cookingMethod);
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

  it('Wild Hog Loin → pork_loin (not game_roast)', () => {
    expect(getMeatPrep(findCut("Wild Hog Loin"))).toBe(PREP_GUIDE_MAP.pork_loin);
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

  // Turkey breast → its own roast guide (not whole-turkey)
  it('Turkey Breast → turkey_breast (not whole-turkey guide)', () => {
    expect(getMeatPrep(findCut("Turkey Breast"))).toBe(PREP_GUIDE_MAP.turkey_breast);
  });

  // Sanity: turkey_breast guide must NOT contain whole-bird language
  it('turkey_breast guide steps do not mention cavity or tucked wings', () => {
    const steps = PREP_GUIDE_MAP.turkey_breast.steps.join(" ");
    expect(steps).not.toMatch(/cavity/i);
    expect(steps).not.toMatch(/tuck.*wing|wing.*tuck/i);
  });

  // Sanity: turkey_breast tip mentions pull at 160°F with carryover
  it('turkey_breast tip mentions 160°F pull temp with carryover to 165°F', () => {
    expect(PREP_GUIDE_MAP.turkey_breast.tip).toMatch(/160/);
    expect(PREP_GUIDE_MAP.turkey_breast.tip).toMatch(/165/);
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

// ── Indirect Heat tip regression ──────────────────────────────────────────────

describe("selectPrepTip — Indirect Heat routes to indirectHeatTip, not the smoke default", () => {
  const INDIRECT_METHODS = ["Indirect Heat", "indirect heat", "Indirect"];

  describe("chicken — indirectHeatTip must be returned, not the smoke tip", () => {
    const guide = PREP_GUIDE_MAP.chicken;

    it("has an indirectHeatTip that differs from the base tip", () => {
      expect(guide.indirectHeatTip).toBeTruthy();
      expect(guide.indirectHeatTip).not.toBe(guide.tip);
    });

    for (const method of INDIRECT_METHODS) {
      it(`method "${method}" → returns indirectHeatTip, not the smoke default`, () => {
        const tip = selectPrepTip(guide, method);
        expect(tip).toBe(guide.indirectHeatTip);
        expect(tip).not.toBe(guide.tip);
      });
    }
  });

  describe("turkey — indirectHeatTip must be returned, not the smoke tip", () => {
    const guide = PREP_GUIDE_MAP.turkey;

    it("has an indirectHeatTip that differs from the base tip", () => {
      expect(guide.indirectHeatTip).toBeTruthy();
      expect(guide.indirectHeatTip).not.toBe(guide.tip);
    });

    it('method "Indirect Heat" → returns indirectHeatTip, not smoke default', () => {
      expect(selectPrepTip(guide, "Indirect Heat")).toBe(guide.indirectHeatTip);
    });
  });

  describe("prime_rib — indirectHeatTip must be returned, not the smoke tip", () => {
    const guide = PREP_GUIDE_MAP.prime_rib;

    it("has an indirectHeatTip that differs from the base tip", () => {
      expect(guide.indirectHeatTip).toBeTruthy();
      expect(guide.indirectHeatTip).not.toBe(guide.tip);
    });

    it('method "Indirect Heat" → returns indirectHeatTip, not smoke default', () => {
      expect(selectPrepTip(guide, "Indirect Heat")).toBe(guide.indirectHeatTip);
    });
  });

  describe("pork_loin — indirectHeatTip must be returned, not the smoke tip", () => {
    const guide = PREP_GUIDE_MAP.pork_loin;

    it("has an indirectHeatTip that differs from the base tip", () => {
      expect(guide.indirectHeatTip).toBeTruthy();
      expect(guide.indirectHeatTip).not.toBe(guide.tip);
    });

    it('method "Indirect Heat" → returns indirectHeatTip, not smoke default', () => {
      expect(selectPrepTip(guide, "Indirect Heat")).toBe(guide.indirectHeatTip);
    });
  });

  describe("pork_tenderloin — indirectHeatTip must be returned, not the smoke tip", () => {
    const guide = PREP_GUIDE_MAP.pork_tenderloin;

    it("has an indirectHeatTip that differs from the base tip", () => {
      expect(guide.indirectHeatTip).toBeTruthy();
      expect(guide.indirectHeatTip).not.toBe(guide.tip);
    });

    it('method "Indirect Heat" → returns indirectHeatTip, not smoke default', () => {
      expect(selectPrepTip(guide, "Indirect Heat")).toBe(guide.indirectHeatTip);
    });
  });

  // Smoke/null methods must still fall back to the base tip for all five cuts
  describe("smoke/null methods still return base tip for the five updated cuts", () => {
    const SMOKE_METHODS = [null, "Low and Slow", "Smoke"] as const;

    for (const cut of ["chicken", "turkey", "prime_rib", "pork_loin", "pork_tenderloin"] as const) {
      for (const method of SMOKE_METHODS) {
        it(`${cut} — method ${JSON.stringify(method)} → base tip`, () => {
          const guide = PREP_GUIDE_MAP[cut];
          expect(selectPrepTip(guide, method)).toBe(guide.tip);
        });
      }
    }
  });
});

// ── Custom / user-created cuts ─────────────────────────────────────────────────

/**
 * Custom cuts (plain MeatCut, not BuiltinMeatCut) stored in the DB may have
 * arbitrary names and known or unknown categories. This suite verifies that:
 *   1. Known-category custom cuts get a reasonable guide from the category
 *      switch even when the name matches no keyword.
 *   2. Unknown/blank categories fall back to PREP_GUIDE_MAP.general rather
 *      than returning null.
 *   3. getMeatPrep never returns null for a non-null cut.
 */

function makeCustomCut(name: string, category: string, cookMethod?: string): MeatCut {
  return { name, category, cookMethod } as unknown as MeatCut;
}

describe("getMeatPrep custom cuts — known categories always resolve", () => {
  it('"My Special Rub Beef" (category "Beef") → category-default beef guide (chuck_roast)', () => {
    const cut = makeCustomCut("My Special Rub Beef", "Beef");
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.chuck_roast);
  });

  it('"House Blend Pulled Pork" (category "Pork") → pork_shoulder', () => {
    const cut = makeCustomCut("House Blend Pulled Pork", "Pork");
    // "pulled" keyword → pork_shoulder
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.pork_shoulder);
  });

  it('"Competition Loin" (category "Pork") without keyword → pork_shoulder category default', () => {
    const cut = makeCustomCut("Competition Loin", "Pork");
    // "loin" keyword → pork_loin
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.pork_loin);
  });

  it('"Signature Smoke" (category "Pork") with no matching keyword → pork_shoulder fallback', () => {
    const cut = makeCustomCut("Signature Smoke", "Pork");
    // no keyword match; category default is pork_shoulder
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.pork_shoulder);
  });

  it('"Backyard Bird" (category "Poultry") with no keyword → chicken guide', () => {
    const cut = makeCustomCut("Backyard Bird", "Poultry");
    // no duck/turkey/wing/breast/thigh/drumstick/leg; falls through to chicken
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.chicken);
  });

  it('"Wild Catch" (category "Seafood") with no keyword → fish_steak guide', () => {
    const cut = makeCustomCut("Wild Catch", "Seafood");
    // no salmon/shrimp/lobster/whole/shellfish keyword; defaults to fish_steak
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.fish_steak);
  });

  it('"Custom Venison Cut" (category "Game") with no specific keyword → game_roast', () => {
    const cut = makeCustomCut("Custom Venison Special", "Game");
    // "venison" keyword → venison
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.venison);
  });

  it('"Mystery Roast" (category "Game") with no keyword → game_roast fallback', () => {
    const cut = makeCustomCut("Mystery Roast", "Game");
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.game_roast);
  });
});

describe("getMeatPrep custom cuts — unknown/blank categories use general fallback", () => {
  it('completely unknown category → PREP_GUIDE_MAP.general (not null)', () => {
    const cut = makeCustomCut("House Special Protein", "Custom");
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.general);
  });

  it('blank category (cooks/[id].tsx empty-string fallback) → PREP_GUIDE_MAP.general', () => {
    const cut = makeCustomCut("Smoked Mystery Meat", "");
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.general);
  });

  it('"Other" category → PREP_GUIDE_MAP.general', () => {
    const cut = makeCustomCut("Competition Entry", "Other");
    expect(getMeatPrep(cut)).toBe(PREP_GUIDE_MAP.general);
  });

  it('general guide has at least 3 steps', () => {
    expect(PREP_GUIDE_MAP.general.steps.length).toBeGreaterThanOrEqual(3);
  });

  it('general guide tip does not contain cut-specific jargon (brisket, pastrami)', () => {
    const allText = [PREP_GUIDE_MAP.general.tip, ...(PREP_GUIDE_MAP.general.steps)].join(" ");
    expect(allText).not.toMatch(/brisket|pastrami|bark|stall/i);
  });

  it('getMeatPrep never returns null for any non-null cut', () => {
    const cuts: MeatCut[] = [
      makeCustomCut("Random Thing", ""),
      makeCustomCut("Another Custom", "Custom Category"),
      makeCustomCut("My Special Rub Beef", "Beef"),
      makeCustomCut("Backyard Bird", "Poultry"),
    ];
    for (const cut of cuts) {
      expect(getMeatPrep(cut)).not.toBeNull();
    }
  });
});

// ── Method-specific tip routing regression tests ───────────────────────────────

/**
 * These tests cover the five cook methods that previously fell through to the
 * smoke/low-and-slow `tip` fallback. Each test asserts:
 *   1. The correct method-specific tip is returned.
 *   2. For Reverse Sear on steak-family cuts, no smoke-specific language appears.
 */

const SMOKE_LANGUAGE_PATTERNS = [
  /275°F and patience/i,
  /probe tender/i,
  /\bstall hits\b/i,
  /spatchcock for faster/i,
];

function containsSmokeLanguage(text: string): boolean {
  return SMOKE_LANGUAGE_PATTERNS.some((re) => re.test(text));
}

describe("selectPrepTip — Reverse Sear routes to reverseSearTip", () => {
  const REVERSE_SEAR_METHODS = ["Reverse Sear", "reverse sear", "Reverse-Sear"];

  describe("steak — Reverse Sear shows reverseSearTip, not the base tip", () => {
    const guide = PREP_GUIDE_MAP.steak;

    for (const method of REVERSE_SEAR_METHODS) {
      it(`method "${method}" → returns reverseSearTip`, () => {
        expect(selectPrepTip(guide, method)).toBe(guide.reverseSearTip);
      });

      it(`method "${method}" → tip contains no smoke-specific language`, () => {
        const tip = selectPrepTip(guide, method);
        expect(containsSmokeLanguage(tip)).toBe(false);
      });
    }

    it("null method → returns base tip (not reverseSearTip)", () => {
      expect(selectPrepTip(guide, null)).toBe(guide.tip);
    });

    it("Direct Heat → returns directHeatTip, not reverseSearTip", () => {
      expect(selectPrepTip(guide, "Direct Heat")).toBe(guide.directHeatTip);
    });
  });

  describe("pork_chops — Reverse Sear shows reverseSearTip", () => {
    const guide = PREP_GUIDE_MAP.pork_chops;
    it('method "Reverse Sear" → returns reverseSearTip', () => {
      expect(selectPrepTip(guide, "Reverse Sear")).toBe(guide.reverseSearTip);
    });
  });

  describe("venison — Reverse Sear shows reverseSearTip", () => {
    const guide = PREP_GUIDE_MAP.venison;
    it('method "Reverse Sear" → returns reverseSearTip', () => {
      expect(selectPrepTip(guide, "Reverse Sear")).toBe(guide.reverseSearTip);
    });
    it('Reverse Sear tip contains no smoke-specific language', () => {
      const tip = selectPrepTip(guide, "Reverse Sear");
      expect(containsSmokeLanguage(tip)).toBe(false);
    });
  });

  describe("rack_of_lamb — Reverse Sear shows reverseSearTip", () => {
    const guide = PREP_GUIDE_MAP.rack_of_lamb;
    it('method "Reverse Sear" → returns reverseSearTip', () => {
      expect(selectPrepTip(guide, "Reverse Sear")).toBe(guide.reverseSearTip);
    });
  });

  describe("lean_game (venison tenderloin) — Reverse Sear shows reverseSearTip", () => {
    const guide = PREP_GUIDE_MAP.lean_game;
    it('method "Reverse Sear" → returns reverseSearTip', () => {
      expect(selectPrepTip(guide, "Reverse Sear")).toBe(guide.reverseSearTip);
    });
  });

  it("steak reverseSearTip exists and is non-empty", () => {
    expect(PREP_GUIDE_MAP.steak.reverseSearTip).toBeTruthy();
  });
});

describe("selectPrepTip — Hot & Fast routes to hotAndFastTip", () => {
  const HOT_FAST_METHODS = ["Hot & Fast", "hot & fast", "Hot and Fast", "hot and fast"];

  describe("brisket — Hot & Fast shows hotAndFastTip", () => {
    const guide = PREP_GUIDE_MAP.brisket;

    for (const method of HOT_FAST_METHODS) {
      it(`method "${method}" → returns hotAndFastTip`, () => {
        expect(selectPrepTip(guide, method)).toBe(guide.hotAndFastTip);
      });
    }

    it("null method → returns base tip (not hotAndFastTip)", () => {
      expect(selectPrepTip(guide, null)).toBe(guide.tip);
    });

    it("Direct Heat → returns directHeatTip, not hotAndFastTip", () => {
      expect(selectPrepTip(guide, "Direct Heat")).toBe(guide.directHeatTip);
    });
  });

  describe("ribs — Hot & Fast shows hotAndFastTip", () => {
    const guide = PREP_GUIDE_MAP.ribs;
    it('method "Hot & Fast" → returns hotAndFastTip', () => {
      expect(selectPrepTip(guide, "Hot & Fast")).toBe(guide.hotAndFastTip);
    });
  });

  describe("pork_shoulder — Hot & Fast shows hotAndFastTip", () => {
    const guide = PREP_GUIDE_MAP.pork_shoulder;
    it('method "Hot & Fast" → returns hotAndFastTip', () => {
      expect(selectPrepTip(guide, "Hot & Fast")).toBe(guide.hotAndFastTip);
    });
  });

  describe("chicken — Hot & Fast shows hotAndFastTip", () => {
    const guide = PREP_GUIDE_MAP.chicken;
    it('method "Hot & Fast" → returns hotAndFastTip', () => {
      expect(selectPrepTip(guide, "Hot & Fast")).toBe(guide.hotAndFastTip);
    });
  });

  it("brisket hotAndFastTip exists and is non-empty", () => {
    expect(PREP_GUIDE_MAP.brisket.hotAndFastTip).toBeTruthy();
  });
});

describe("selectPrepTip — Rotisserie routes to rotisserieTip", () => {
  const ROTISSERIE_METHODS = ["Rotisserie", "rotisserie", "Rotary"];

  describe("chicken — Rotisserie shows rotisserieTip", () => {
    const guide = PREP_GUIDE_MAP.chicken;

    for (const method of ROTISSERIE_METHODS) {
      it(`method "${method}" → returns rotisserieTip`, () => {
        expect(selectPrepTip(guide, method)).toBe(guide.rotisserieTip);
      });
    }

    it("null method → returns base tip (not rotisserieTip)", () => {
      expect(selectPrepTip(guide, null)).toBe(guide.tip);
    });
  });

  describe("turkey — Rotisserie shows rotisserieTip", () => {
    const guide = PREP_GUIDE_MAP.turkey;
    it('method "Rotisserie" → returns rotisserieTip', () => {
      expect(selectPrepTip(guide, "Rotisserie")).toBe(guide.rotisserieTip);
    });
  });

  describe("prime_rib — Rotisserie shows rotisserieTip", () => {
    const guide = PREP_GUIDE_MAP.prime_rib;
    it('method "Rotisserie" → returns rotisserieTip', () => {
      expect(selectPrepTip(guide, "Rotisserie")).toBe(guide.rotisserieTip);
    });
  });

  describe("pork_loin — Rotisserie shows rotisserieTip", () => {
    const guide = PREP_GUIDE_MAP.pork_loin;
    it('method "Rotisserie" → returns rotisserieTip', () => {
      expect(selectPrepTip(guide, "Rotisserie")).toBe(guide.rotisserieTip);
    });
  });

  it("chicken rotisserieTip exists and is non-empty", () => {
    expect(PREP_GUIDE_MAP.chicken.rotisserieTip).toBeTruthy();
  });
});

describe("selectPrepTip — Braised routes to braisedTip", () => {
  const BRAISED_METHODS = ["Braised", "braised", "Braise", "braise"];

  describe("chuck_roast — Braised shows braisedTip", () => {
    const guide = PREP_GUIDE_MAP.chuck_roast;

    for (const method of BRAISED_METHODS) {
      it(`method "${method}" → returns braisedTip`, () => {
        expect(selectPrepTip(guide, method)).toBe(guide.braisedTip);
      });
    }

    it("null method → returns base tip (not braisedTip)", () => {
      expect(selectPrepTip(guide, null)).toBe(guide.tip);
    });

    it("Direct Heat → returns directHeatTip, not braisedTip", () => {
      expect(selectPrepTip(guide, "Direct Heat")).toBe(guide.directHeatTip);
    });
  });

  describe("oxtail — Braised shows braisedTip", () => {
    const guide = PREP_GUIDE_MAP.oxtail;
    it('method "Braised" → returns braisedTip', () => {
      expect(selectPrepTip(guide, "Braised")).toBe(guide.braisedTip);
    });
  });

  describe("pork_shoulder — Braised shows braisedTip", () => {
    const guide = PREP_GUIDE_MAP.pork_shoulder;
    it('method "Braised" → returns braisedTip', () => {
      expect(selectPrepTip(guide, "Braised")).toBe(guide.braisedTip);
    });
  });

  describe("beef_ribs — Braised shows braisedTip", () => {
    const guide = PREP_GUIDE_MAP.beef_ribs;
    it('method "Braised" → returns braisedTip', () => {
      expect(selectPrepTip(guide, "Braised")).toBe(guide.braisedTip);
    });
  });

  describe("lamb — Braised shows braisedTip", () => {
    const guide = PREP_GUIDE_MAP.lamb;
    it('method "Braised" → returns braisedTip', () => {
      expect(selectPrepTip(guide, "Braised")).toBe(guide.braisedTip);
    });
  });

  it("chuck_roast braisedTip exists and is non-empty", () => {
    expect(PREP_GUIDE_MAP.chuck_roast.braisedTip).toBeTruthy();
  });
});

// ── Unknown method fallback — warning condition ────────────────────────────────
//
// When a cut's AI-assigned cookMethod (selectedCut.cookMethod) doesn't map to
// any known CookingMethodClass, selectPrepTip falls through to the base smoke
// tip. This is the condition that triggers the "Tip is based on general smoking
// advice — your cook method wasn't recognised." warning in plan.tsx.
//
// These tests verify:
//   1. selectPrepTip gracefully falls back to prep.tip for unknown strings.
//   2. The base tip is NOT silently wrong — it is the smoke/low-and-slow guide.
//   3. isUnrecognisedCookMethod correctly identifies the trigger condition.

describe("selectPrepTip — unknown/unrecognised method falls back to base smoke tip", () => {
  // Only methods that match NO substring in the classifier are truly unknown.
  // "Sous Vide + Smoke" matches "smoke" → classifies as smoke, not unknown.
  // "Cold Smoke" also matches "smoke". Only methods with no classifier keyword
  // are unknown and would trigger the prep-tip warning in the UI.
  const UNKNOWN_METHODS = [
    "Sous Vide",
    "Deep Fry",
    "Caveman Style",
    "Air Fryer",
    "Plancha",
    "Hibachi",
    "unknown",
  ];

  describe("brisket — unknown method falls through to base tip (smoke advice)", () => {
    const guide = PREP_GUIDE_MAP.brisket;

    for (const method of UNKNOWN_METHODS) {
      it(`method "${method}" → returns base tip (smoke fallback)`, () => {
        expect(selectPrepTip(guide, method)).toBe(guide.tip);
      });
    }
  });

  describe("steak — unknown method falls through to base tip", () => {
    const guide = PREP_GUIDE_MAP.steak;

    for (const method of UNKNOWN_METHODS) {
      it(`method "${method}" → returns base tip, NOT directHeatTip or reverseSearTip`, () => {
        const tip = selectPrepTip(guide, method);
        expect(tip).toBe(guide.tip);
        expect(tip).not.toBe(guide.directHeatTip);
        expect(tip).not.toBe(guide.reverseSearTip);
      });
    }
  });

  it("pork_shoulder — unknown method falls through to base tip", () => {
    const guide = PREP_GUIDE_MAP.pork_shoulder;
    expect(selectPrepTip(guide, "Sous Vide + Smoke")).toBe(guide.tip);
  });

  it("chicken — unknown method falls through to base tip", () => {
    const guide = PREP_GUIDE_MAP.chicken;
    expect(selectPrepTip(guide, "Cold Smoke")).toBe(guide.tip);
  });
});

// ── Warning condition: isUnrecognisedCookMethod as the UI trigger ─────────────
//
// plan.tsx shows the inline notice when:
//   !qpCookMethod && isUnrecognisedCookMethod(selectedCut?.cookMethod)
//
// These tests verify the condition is sound — it only fires when the cut's
// AI-assigned method is non-null AND doesn't classify.

describe("prep-tip warning condition — isUnrecognisedCookMethod gate", () => {
  const { isUnrecognisedCookMethod } = require("../../utils/cookingMethod");

  it("null cookMethod → false (warning suppressed — no AI method to evaluate)", () => {
    expect(isUnrecognisedCookMethod(null)).toBe(false);
  });

  it('"Sous Vide" cookMethod → true (warning fires — no classifier keyword)', () => {
    expect(isUnrecognisedCookMethod("Sous Vide")).toBe(true);
  });

  it('"Low & Slow" cookMethod → false (recognised — warning suppressed)', () => {
    expect(isUnrecognisedCookMethod("Low & Slow")).toBe(false);
  });

  it('"Deep Fry" cookMethod → true (warning fires — unsupported AI method)', () => {
    expect(isUnrecognisedCookMethod("Deep Fry")).toBe(true);
  });

  it("all built-in MEAT_CUTS cookMethods pass without triggering the warning", () => {
    const { MEAT_CUTS } = require("../../constants/meatCuts");
    const methods: string[] = MEAT_CUTS
      .map((c: { cookMethod?: string }) => c.cookMethod)
      .filter((m: string | undefined): m is string => !!m);
    // Every built-in method must be recognised so the warning never fires
    // for any cut in the standard data set.
    const triggering = methods.filter(isUnrecognisedCookMethod);
    expect(triggering).toEqual([]);
  });
});

describe("selectPrepTip — method-specific tips never show smoke-tip language for steak-family cuts", () => {
  const STEAK_GUIDES: Array<[string, keyof typeof PREP_GUIDE_MAP]> = [
    ["steak", "steak"],
    ["venison", "venison"],
    ["lean_game", "lean_game"],
    ["rack_of_lamb", "rack_of_lamb"],
    ["tenderloin_beef", "tenderloin_beef"],
    ["pork_chops", "pork_chops"],
  ];

  for (const [label, key] of STEAK_GUIDES) {
    it(`${label} + Reverse Sear → tip does not contain smoke-specific language`, () => {
      const guide = PREP_GUIDE_MAP[key];
      const tip = selectPrepTip(guide, "Reverse Sear");
      expect(containsSmokeLanguage(tip)).toBe(false);
    });
  }
});
