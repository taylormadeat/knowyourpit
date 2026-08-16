/**
 * Unit tests for the PitMaster defaults priority-ordering logic.
 *
 * Critical invariants under test:
 *   1. When a stored last-used value exists for a field, it wins — the
 *      default from getPitmasterDefaults must NOT be applied, and the field
 *      must NOT appear in recommendedFields.
 *   2. When no stored value exists (null), the PitMaster default is applied
 *      and the field IS added to recommendedFields (drives the "★ Suggested"
 *      badge in the UI).
 *   3. A field that starts as recommended (filled by default) is removed from
 *      recommendedFields as soon as the user provides their own value — i.e.
 *      calling mergeStoredWithDefaults with a non-null stored value for that
 *      field produces recommendedFields that no longer contains it.
 *
 * No mocking needed — mergeStoredWithDefaults and getPitmasterDefaults are
 * pure functions with no side effects.
 */

import { getPitmasterDefaults, mergeStoredWithDefaults } from "../pitmasterDefaults";
import type { MeatCut } from "@/constants/meatCuts";
import type {
  QpCookMethod,
  QpMeatStartTemp,
  QpInjectionOption,
  QpSpritzFrequency,
  QpWrapFinishOption,
} from "@/constants/cookQuickPicks";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Low & Slow brisket — injection and butcher-paper defaults apply. */
const BRISKET: MeatCut = {
  name: "brisket (whole packer)",
  category: "Beef",
  targetTempF: 203,
  cookTempF: 250,
  minsPerLb: 60,
  restMins: 60,
  cookMethod: "Low & Slow",
};

/** Chicken wings — no injection, sauced finish default. */
const CHICKEN_WINGS: MeatCut = {
  name: "chicken wings",
  category: "Poultry",
  targetTempF: 165,
  cookTempF: 275,
  minsPerLb: 30,
  restMins: 5,
  cookMethod: "Low & Slow",
};

const ALL_NULL = {
  cookMethod: null,
  meatStartTemp: null,
  injection: null,
  spritz: null,
  wrapFinish: null,
};

// ── 1. Stored values win — defaults must not override them ────────────────────

describe("stored last-used values win over defaults", () => {
  it("stores a non-default cookMethod and does not override it", () => {
    const storedMethod: QpCookMethod = "Hot & Fast";
    const brisketDefault = getPitmasterDefaults(BRISKET);
    // Sanity-check: the default for brisket is NOT "Hot & Fast"
    expect(brisketDefault.cookMethod).not.toBe(storedMethod);

    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      cookMethod: storedMethod,
    });

    expect(result.cookMethod).toBe(storedMethod);
    expect(result.recommendedFields.has("cookMethod")).toBe(false);
  });

  it("stores a non-default injection and does not override it", () => {
    // Brisket default is "Injected"; verify a stored "Not Injected" is kept
    const storedInjection: QpInjectionOption = "Not Injected";
    const brisketDefault = getPitmasterDefaults(BRISKET);
    expect(brisketDefault.injection).toBe("Injected");

    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      injection: storedInjection,
    });

    expect(result.injection).toBe("Not Injected");
    expect(result.recommendedFields.has("injection")).toBe(false);
  });

  it("stores a non-default meatStartTemp and does not override it", () => {
    const stored: QpMeatStartTemp = "Cold from Fridge";
    const brisketDefault = getPitmasterDefaults(BRISKET);
    expect(brisketDefault.meatStartTemp).toBe("Tempered to Room Temp");

    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      meatStartTemp: stored,
    });

    expect(result.meatStartTemp).toBe("Cold from Fridge");
    expect(result.recommendedFields.has("meatStartTemp")).toBe(false);
  });

  it("stores a non-default spritz and does not override it", () => {
    const stored: QpSpritzFrequency = "Every 30 min";
    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      spritz: stored,
    });

    expect(result.spritz).toBe("Every 30 min");
    expect(result.recommendedFields.has("spritz")).toBe(false);
  });

  it("stores a non-default wrapFinish and does not override it", () => {
    // Brisket default is "Butcher Paper at Stall"; stored overrides to foil
    const stored: QpWrapFinishOption = "Foil at Stall (Texas Crutch)";
    const brisketDefault = getPitmasterDefaults(BRISKET);
    expect(brisketDefault.wrapFinish).toBe("Butcher Paper at Stall");

    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      wrapFinish: stored,
    });

    expect(result.wrapFinish).toBe("Foil at Stall (Texas Crutch)");
    expect(result.recommendedFields.has("wrapFinish")).toBe(false);
  });

  it("all five fields stored — no field appears in recommendedFields", () => {
    const result = mergeStoredWithDefaults(BRISKET, {
      cookMethod: "Reverse Sear",
      meatStartTemp: "Cold from Fridge",
      injection: "Not Injected",
      spritz: "No Spritz",
      wrapFinish: "No Wrap",
    });

    expect(result.recommendedFields.size).toBe(0);
    expect(result.cookMethod).toBe("Reverse Sear");
    expect(result.meatStartTemp).toBe("Cold from Fridge");
    expect(result.injection).toBe("Not Injected");
    expect(result.spritz).toBe("No Spritz");
    expect(result.wrapFinish).toBe("No Wrap");
  });
});

// ── 2. No stored value → defaults applied, recommended badge shown ─────────────

describe("no stored value — defaults applied and field marked recommended", () => {
  it("all fields null → every field filled from defaults and recommended", () => {
    const result = mergeStoredWithDefaults(BRISKET, ALL_NULL);
    const defaults = getPitmasterDefaults(BRISKET);

    expect(result.cookMethod).toBe(defaults.cookMethod);
    expect(result.meatStartTemp).toBe(defaults.meatStartTemp);
    expect(result.injection).toBe(defaults.injection);
    expect(result.spritz).toBe(defaults.spritz);
    expect(result.wrapFinish).toBe(defaults.wrapFinish);

    expect(result.recommendedFields.has("cookMethod")).toBe(true);
    expect(result.recommendedFields.has("meatStartTemp")).toBe(true);
    expect(result.recommendedFields.has("injection")).toBe(true);
    expect(result.recommendedFields.has("spritz")).toBe(true);
    expect(result.recommendedFields.has("wrapFinish")).toBe(true);
  });

  it("brisket defaults match expected cut rules (injected, butcher paper)", () => {
    const result = mergeStoredWithDefaults(BRISKET, ALL_NULL);

    expect(result.injection).toBe("Injected");
    expect(result.wrapFinish).toBe("Butcher Paper at Stall");
    expect(result.cookMethod).toBe("Low & Slow");
  });

  it("chicken wings defaults match expected cut rules (sauced finish, no injection)", () => {
    const result = mergeStoredWithDefaults(CHICKEN_WINGS, ALL_NULL);

    expect(result.injection).toBe("Not Injected");
    expect(result.wrapFinish).toBe("Sauced and Returned to Smoker");
  });

  it("only the null fields are recommended — stored fields are excluded", () => {
    // cookMethod stored, rest null
    const result = mergeStoredWithDefaults(BRISKET, {
      cookMethod: "Hot & Fast",
      meatStartTemp: null,
      injection: null,
      spritz: null,
      wrapFinish: null,
    });

    expect(result.recommendedFields.has("cookMethod")).toBe(false);
    expect(result.recommendedFields.has("meatStartTemp")).toBe(true);
    expect(result.recommendedFields.has("injection")).toBe(true);
    expect(result.recommendedFields.has("spritz")).toBe(true);
    expect(result.recommendedFields.has("wrapFinish")).toBe(true);
    expect(result.recommendedFields.size).toBe(4);
  });
});

// ── 3. Manual selection removes field from recommended set ────────────────────

describe("manually selecting a value removes it from recommendedFields", () => {
  it("after picking a cookMethod, re-merging with that value removes recommended flag", () => {
    // First visit: no stored value → recommended
    const firstVisit = mergeStoredWithDefaults(BRISKET, ALL_NULL);
    expect(firstVisit.recommendedFields.has("cookMethod")).toBe(true);

    // User selects "Hot & Fast" manually → this value is now the stored value
    const userPickedMethod: QpCookMethod = "Hot & Fast";

    // Second visit (stored value now exists): recommended flag must be absent
    const secondVisit = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      cookMethod: userPickedMethod,
    });
    expect(secondVisit.recommendedFields.has("cookMethod")).toBe(false);
    expect(secondVisit.cookMethod).toBe("Hot & Fast");
  });

  it("after picking an injection option, re-merging removes recommended flag for injection only", () => {
    const firstVisit = mergeStoredWithDefaults(BRISKET, ALL_NULL);
    expect(firstVisit.recommendedFields.has("injection")).toBe(true);
    expect(firstVisit.recommendedFields.has("wrapFinish")).toBe(true);

    // User manually picks "Not Injected"
    const secondVisit = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      injection: "Not Injected",
    });

    // Only injection is de-recommended; wrapFinish is still recommended
    expect(secondVisit.recommendedFields.has("injection")).toBe(false);
    expect(secondVisit.recommendedFields.has("wrapFinish")).toBe(true);
  });

  it("after picking the same value as the default, the field is still not recommended", () => {
    // Even if the user happens to pick the same value the default would give,
    // once a value is stored it must not appear in recommendedFields — the
    // distinction matters because the user consciously made the choice.
    const brisketDefault = getPitmasterDefaults(BRISKET);
    // brisket injection default is "Injected"
    expect(brisketDefault.injection).toBe("Injected");

    const result = mergeStoredWithDefaults(BRISKET, {
      ...ALL_NULL,
      injection: "Injected", // same as default, but user explicitly stored it
    });

    expect(result.injection).toBe("Injected");
    expect(result.recommendedFields.has("injection")).toBe(false);
  });

  it("all five fields manually selected → recommendedFields is empty", () => {
    const defaults = getPitmasterDefaults(BRISKET);

    // User revisits and has stored values for every field
    const result = mergeStoredWithDefaults(BRISKET, {
      cookMethod: defaults.cookMethod,
      meatStartTemp: defaults.meatStartTemp,
      injection: defaults.injection,
      spritz: defaults.spritz,
      wrapFinish: defaults.wrapFinish,
    });

    expect(result.recommendedFields.size).toBe(0);
  });
});

// ── 4. getPitmasterDefaults — standalone defaults correctness ─────────────────

describe("getPitmasterDefaults — static rule correctness", () => {
  it("returns an object with all five fields populated", () => {
    const result = getPitmasterDefaults(BRISKET);
    expect(result.cookMethod).toBeTruthy();
    expect(result.meatStartTemp).toBeTruthy();
    expect(result.injection).toBeTruthy();
    expect(result.spritz).toBeTruthy();
    expect(result.wrapFinish).toBeTruthy();
  });

  it("unknown cookMethod falls back to Low & Slow", () => {
    const cut: MeatCut = {
      ...BRISKET,
      cookMethod: "mystery method",
    };
    expect(getPitmasterDefaults(cut).cookMethod).toBe("Low & Slow");
  });

  it("cut with no cookMethod falls back to Low & Slow", () => {
    const cut: MeatCut = { ...BRISKET, cookMethod: undefined };
    expect(getPitmasterDefaults(cut).cookMethod).toBe("Low & Slow");
  });
});
