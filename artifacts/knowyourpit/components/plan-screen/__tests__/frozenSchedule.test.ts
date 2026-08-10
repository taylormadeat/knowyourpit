/**
 * Unit tests for calcSchedule() in frozenSchedule.ts
 *
 * Critical invariant:
 *   A wrap step is produced for stall-prone cuts EXCEPT when the user's
 *   cooking method is a direct-heat method (grilling, searing, griddle).
 *
 * The four branches under test:
 *   1. Smoking method  → stall-prone cut gets wrap
 *   2. Grilling method → stall-prone cut gets NO wrap
 *   3. Indirect method → stall-prone cut gets wrap
 *   4. Unknown / null  → stall heuristic decides (stall-prone → wrap,
 *                        non-stall → no wrap)
 *
 * No mocking needed — calcSchedule, cutHasStall, and isDirectHeat are all
 * pure functions with no side-effects.
 */

import { calcSchedule, cutHasStall, TEMPER_MINUTES, THAW_FRIDGE_MIN_HOURS } from "../frozenSchedule";
import type { MeatCut } from "@/constants/meatCuts";

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * A stall-prone cut tagged "Low & Slow" — matches both the cookMethod
 * heuristic and the minsPerLb/cookTempF heuristic in cutHasStall().
 */
const BRISKET: MeatCut = {
  name: "Brisket (Test)",
  category: "Beef",
  targetTempF: 203,
  cookTempF: 225,
  minsPerLb: 75,
  restMins: 60,
  cookMethod: "Low & Slow",
};

/**
 * A stall-prone cut identified by the minsPerLb/cookTempF heuristic only —
 * no "low & slow" tag, ensuring the numeric fallback is tested independently.
 */
const STALL_PRONE_UNTAGGED: MeatCut = {
  name: "Mystery Roast (Test)",
  category: "Beef",
  targetTempF: 200,
  cookTempF: 250,
  minsPerLb: 45, // >= 30
  restMins: 20,
  // no cookMethod → falls to numeric check
};

/**
 * A non-stall cut — short cook at high temp, no Low & Slow tag.
 * cutHasStall() must return false for this fixture.
 */
const STEAK: MeatCut = {
  name: "Steak (Test)",
  category: "Beef",
  targetTempF: 130,
  cookTempF: 450,
  minsPerLb: 10,   // < 30
  restMins: 10,
  cookMethod: "Direct Heat",
};

const SERVE_AT = new Date("2025-07-04T18:00:00.000Z");
const WEIGHT_LBS = 10;

// ── cutHasStall() correctness (precondition for the calcSchedule tests) ───────

describe("cutHasStall()", () => {
  it("returns true for a Low & Slow tagged cut", () => {
    expect(cutHasStall(BRISKET)).toBe(true);
  });

  it("returns true for a stall-prone untagged cut (minsPerLb >= 30, cookTempF <= 275)", () => {
    expect(cutHasStall(STALL_PRONE_UNTAGGED)).toBe(true);
  });

  it("returns false for a high-heat, short-cook cut", () => {
    expect(cutHasStall(STEAK)).toBe(false);
  });

  it("returns false for a cut just below the minsPerLb threshold", () => {
    const cut: MeatCut = { ...STEAK, minsPerLb: 29, cookTempF: 275, cookMethod: undefined };
    expect(cutHasStall(cut)).toBe(false);
  });

  it("returns false when minsPerLb >= 30 but cookTempF > 275", () => {
    const cut: MeatCut = { ...STEAK, minsPerLb: 30, cookTempF: 276, cookMethod: undefined };
    expect(cutHasStall(cut)).toBe(false);
  });

  it("returns true at the exact boundary: minsPerLb=30, cookTempF=275", () => {
    const cut: MeatCut = { ...STEAK, minsPerLb: 30, cookTempF: 275, cookMethod: undefined };
    expect(cutHasStall(cut)).toBe(true);
  });
});

// ── 1. Smoking method → wrap step present ────────────────────────────────────

describe("smoking method (Low & Slow / smoke) — stall-prone cut gets a wrap step", () => {
  const smokingMethods = [
    "Smoke",
    "smoke",
    "Low & Slow",
    "low and slow",
    "Low & Slow Smoke",
  ];

  for (const method of smokingMethods) {
    it(`cookingMethod="${method}" → wrap is defined`, () => {
      const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, method);
      expect(schedule.wrap).toBeDefined();
    });

    it(`cookingMethod="${method}" → wrapAt is between meatOnAt and pullAt`, () => {
      const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, method);
      expect(schedule.wrap!.wrapAt.getTime()).toBeGreaterThan(schedule.meatOnAt.getTime());
      expect(schedule.wrap!.wrapAt.getTime()).toBeLessThan(schedule.pullAt.getTime());
    });

    it(`cookingMethod="${method}" → wrapTempF is 165`, () => {
      const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, method);
      expect(schedule.wrap!.wrapTempF).toBe(165);
    });
  }

  it("wrap timing is at 60% of cook time", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "Low & Slow");
    const expectedWrapOffsetMs = Math.round(schedule.cookMins * 0.6) * 60_000;
    expect(schedule.wrap!.wrapAt.getTime()).toBe(
      schedule.meatOnAt.getTime() + expectedWrapOffsetMs,
    );
  });
});

// ── 2. Grilling method → NO wrap step ────────────────────────────────────────

describe("grilling / direct-heat method — stall-prone cut gets NO wrap step", () => {
  const grillingMethods = [
    "Direct Heat",
    "direct heat",
    "Sear",
    "sear",
    "Griddle",
    "griddle",
  ];

  for (const method of grillingMethods) {
    it(`cookingMethod="${method}" → wrap is undefined`, () => {
      const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, method);
      expect(schedule.wrap).toBeUndefined();
    });
  }

  it("a brisket grilled Direct Heat still produces correct timing without wrap", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "Direct Heat");
    expect(schedule.wrap).toBeUndefined();
    // Core schedule integrity: startAt + preheat = meatOnAt
    expect(schedule.meatOnAt.getTime()).toBe(
      schedule.startAt.getTime() + schedule.preheatMins * 60_000,
    );
    // pullAt - meatOnAt = cookMins
    expect(schedule.pullAt.getTime()).toBe(
      schedule.meatOnAt.getTime() + schedule.cookMins * 60_000,
    );
  });
});

// ── 3. Indirect method → wrap step present ───────────────────────────────────

describe("indirect method — stall-prone cut gets a wrap step", () => {
  const indirectMethods = ["Indirect", "indirect", "Indirect Heat"];

  for (const method of indirectMethods) {
    it(`cookingMethod="${method}" → wrap is defined for stall-prone cut`, () => {
      const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, method);
      expect(schedule.wrap).toBeDefined();
    });
  }

  it("indirect + non-stall cut → no wrap step", () => {
    const schedule = calcSchedule(SERVE_AT, STEAK, WEIGHT_LBS, null, undefined, undefined, "Indirect");
    expect(schedule.wrap).toBeUndefined();
  });
});

// ── 4. Unknown / null method → stall heuristic decides ───────────────────────

describe("unknown / null cookingMethod — falls back to stall heuristic", () => {
  it("null method + Low & Slow cut → wrap present", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, null);
    expect(schedule.wrap).toBeDefined();
  });

  it("undefined method + Low & Slow cut → wrap present", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, undefined);
    expect(schedule.wrap).toBeDefined();
  });

  it("omitted method argument + Low & Slow cut → wrap present", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null);
    expect(schedule.wrap).toBeDefined();
  });

  it("null method + stall-prone untagged cut (numeric heuristic) → wrap present", () => {
    const schedule = calcSchedule(SERVE_AT, STALL_PRONE_UNTAGGED, WEIGHT_LBS, null, undefined, undefined, null);
    expect(schedule.wrap).toBeDefined();
  });

  it("null method + non-stall cut → no wrap", () => {
    const schedule = calcSchedule(SERVE_AT, STEAK, WEIGHT_LBS, null, undefined, undefined, null);
    expect(schedule.wrap).toBeUndefined();
  });

  it("empty string method + Low & Slow cut → wrap present (treated as unknown)", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "");
    expect(schedule.wrap).toBeDefined();
  });

  it("completely unrecognized method string + Low & Slow cut → wrap present", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "BarbequePit Special");
    expect(schedule.wrap).toBeDefined();
  });

  it("completely unrecognized method string + non-stall cut → no wrap", () => {
    const schedule = calcSchedule(SERVE_AT, STEAK, WEIGHT_LBS, null, undefined, undefined, "BarbequePit Special");
    expect(schedule.wrap).toBeUndefined();
  });
});

// ── Core schedule integrity (sanity checks) ───────────────────────────────────

describe("schedule timing integrity", () => {
  it("serveAt equals restEndAt", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "Low & Slow");
    expect(schedule.restEndAt.getTime()).toBe(SERVE_AT.getTime());
  });

  it("totalMins = preheatMins + cookMins + restMins", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "Low & Slow");
    expect(schedule.totalMins).toBe(schedule.preheatMins + schedule.cookMins + schedule.restMins);
  });

  it("startAt is totalMins before serveAt", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "Low & Slow");
    expect(schedule.startAt.getTime()).toBe(SERVE_AT.getTime() - schedule.totalMins * 60_000);
  });

  it("meatOnAt is preheatMins after startAt", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "smoke");
    expect(schedule.meatOnAt.getTime()).toBe(
      schedule.startAt.getTime() + schedule.preheatMins * 60_000,
    );
  });

  it("pullAt is cookMins after meatOnAt", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null, undefined, undefined, "smoke");
    expect(schedule.pullAt.getTime()).toBe(
      schedule.meatOnAt.getTime() + schedule.cookMins * 60_000,
    );
  });

  it("no grill → preheat defaults to 25 min", () => {
    const schedule = calcSchedule(SERVE_AT, BRISKET, WEIGHT_LBS, null);
    expect(schedule.preheatMins).toBe(25);
  });
});

// ── Frozen schedule interaction ───────────────────────────────────────────────

describe("frozen option + cookingMethod interaction", () => {
  it("smoking + frozen → wrap present and frozen block populated", () => {
    const schedule = calcSchedule(
      SERVE_AT,
      BRISKET,
      WEIGHT_LBS,
      null,
      { enabled: true, method: "fridge" },
      undefined,
      "Low & Slow",
    );
    expect(schedule.wrap).toBeDefined();
    expect(schedule.frozen).toBeDefined();
    expect(schedule.frozen!.thawMins).toBeGreaterThan(0);
    expect(schedule.frozen!.temperMins).toBe(TEMPER_MINUTES);
  });

  it("grilling + frozen → NO wrap but frozen block still populated", () => {
    const schedule = calcSchedule(
      SERVE_AT,
      BRISKET,
      WEIGHT_LBS,
      null,
      { enabled: true, method: "cold_water" },
      undefined,
      "Direct Heat",
    );
    expect(schedule.wrap).toBeUndefined();
    expect(schedule.frozen).toBeDefined();
  });

  it("frozen disabled → frozen property absent regardless of method", () => {
    const schedule = calcSchedule(
      SERVE_AT,
      BRISKET,
      WEIGHT_LBS,
      null,
      { enabled: false, method: "fridge" },
      undefined,
      "Low & Slow",
    );
    expect(schedule.frozen).toBeUndefined();
  });

  it("frozen fridge thaw enforces 24-hour minimum for light cuts", () => {
    const schedule = calcSchedule(
      SERVE_AT,
      BRISKET,
      1, // 1 lb — formula gives sub-24h, minimum should kick in
      null,
      { enabled: true, method: "fridge" },
      undefined,
      "Low & Slow",
    );
    expect(schedule.frozen!.thawMins).toBe(THAW_FRIDGE_MIN_HOURS * 60);
  });
});
