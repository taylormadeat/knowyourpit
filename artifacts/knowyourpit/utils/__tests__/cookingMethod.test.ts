/**
 * Unit tests for classifyCookingMethod and related helpers.
 *
 * Critical invariants under test:
 *   1. Every cookMethod label string used in MEAT_CUTS classifies to the
 *      correct CookingMethodClass — any label rename that breaks this will
 *      immediately fail here before it silently degrades prep-tip advice.
 *   2. A canonical snapshot of the method labels used by the app lives in one
 *      place (CANONICAL_COOK_METHODS below). Renaming a label in MEAT_CUTS
 *      requires updating that snapshot, which is the point.
 *   3. Classifier edge-cases: substring ordering (indirect vs direct),
 *      case-insensitivity, null/undefined inputs, unknown strings.
 */

import { MEAT_CUTS } from "../../constants/meatCuts";
import {
  classifyCookingMethod,
  isDirectHeat,
  includesSear,
  isUnrecognisedCookMethod,
  cookMethodDisplayLabel,
  pitTempLabel,
  cookMethodContextPhrase,
  type CookingMethodClass,
} from "../cookingMethod";

// ── Canonical method label snapshot ───────────────────────────────────────────
//
// This object is the single source of truth for the label strings the app
// stores in cook records and MEAT_CUTS. Each key is the exact label string;
// the value is the expected CookingMethodClass.
//
// If MEAT_CUTS or the UI ever change a label string, the compiler won't catch
// it — but the tests below will fail at the round-trip assertion.

export const CANONICAL_COOK_METHODS: Record<string, CookingMethodClass> = {
  "Low & Slow":    "smoke",
  "Indirect":      "indirect",
  "Direct Heat":   "direct",
  "Reverse Sear":  "reverse_sear",
  // Additional labels the classifier supports (not currently in MEAT_CUTS,
  // but used in UI drop-downs and AI suggestions):
  "Hot & Fast":    "hot_fast",
  "Rotisserie":    "rotisserie",
  "Griddle":       "griddle",
};

// ── Round-trip: every MEAT_CUTS cookMethod classifies correctly ───────────────

describe("classifyCookingMethod — MEAT_CUTS labels round-trip", () => {
  // Collect the unique cookMethod values actually present in MEAT_CUTS.
  const methodsInData = [
    ...new Set(
      MEAT_CUTS.map((c) => c.cookMethod).filter((m): m is string => !!m),
    ),
  ];

  it("MEAT_CUTS contains at least one cut with a cookMethod (test is not vacuous)", () => {
    expect(methodsInData.length).toBeGreaterThan(0);
  });

  it("every cookMethod in MEAT_CUTS is present in CANONICAL_COOK_METHODS (no undocumented labels)", () => {
    const unknownLabels = methodsInData.filter(
      (m) => !(m in CANONICAL_COOK_METHODS),
    );
    expect(unknownLabels).toEqual([]);
  });

  for (const label of methodsInData) {
    const expected = CANONICAL_COOK_METHODS[label];
    it(`"${label}" → "${expected}"`, () => {
      expect(classifyCookingMethod(label)).toBe(expected);
    });
  }
});

// ── Full canonical label coverage ─────────────────────────────────────────────

describe("classifyCookingMethod — canonical label strings", () => {
  for (const [label, expected] of Object.entries(CANONICAL_COOK_METHODS)) {
    it(`"${label}" → "${expected}"`, () => {
      expect(classifyCookingMethod(label)).toBe(expected);
    });
  }
});

// ── Case-insensitivity ────────────────────────────────────────────────────────

describe("classifyCookingMethod — case-insensitive matching", () => {
  const cases: [string, CookingMethodClass][] = [
    ["low & slow",   "smoke"],
    ["LOW & SLOW",   "smoke"],
    ["indirect",     "indirect"],
    ["INDIRECT",     "indirect"],
    ["direct heat",  "direct"],
    ["DIRECT HEAT",  "direct"],
    ["reverse sear", "reverse_sear"],
    ["REVERSE SEAR", "reverse_sear"],
    ["hot & fast",   "hot_fast"],
    ["HOT & FAST",   "hot_fast"],
    ["rotisserie",   "rotisserie"],
    ["ROTISSERIE",   "rotisserie"],
    ["griddle",      "griddle"],
    ["GRIDDLE",      "griddle"],
    ["sear",         "sear"],
    ["SEAR",         "sear"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

// ── Substring-ordering correctness ───────────────────────────────────────────
//
// "indirect" contains the substring "direct"; "reverse sear" contains "sear".
// The classifier must check the more specific pattern first.

describe("classifyCookingMethod — substring ordering", () => {
  it('"indirect" is NOT mis-classified as "direct"', () => {
    expect(classifyCookingMethod("indirect")).toBe("indirect");
  });

  it('"Indirect Heat" is NOT mis-classified as "direct"', () => {
    expect(classifyCookingMethod("Indirect Heat")).toBe("indirect");
  });

  it('"reverse sear" is NOT mis-classified as plain "sear"', () => {
    expect(classifyCookingMethod("reverse sear")).toBe("reverse_sear");
  });

  it('"Reverse-Sear" (hyphen variant) is NOT mis-classified as plain "sear"', () => {
    expect(classifyCookingMethod("Reverse-Sear")).toBe("reverse_sear");
  });

  it('"hot and fast" is NOT mis-classified as "indirect" or "direct"', () => {
    expect(classifyCookingMethod("hot and fast")).toBe("hot_fast");
  });
});

// ── Null / undefined / empty inputs ──────────────────────────────────────────

describe("classifyCookingMethod — null / undefined / unknown inputs", () => {
  it("null → unknown", () => {
    expect(classifyCookingMethod(null)).toBe("unknown");
  });

  it("undefined → unknown", () => {
    expect(classifyCookingMethod(undefined)).toBe("unknown");
  });

  it('empty string → unknown', () => {
    expect(classifyCookingMethod("")).toBe("unknown");
  });

  it('completely unknown string → unknown', () => {
    expect(classifyCookingMethod("Deep Fry")).toBe("unknown");
  });

  it('"unknown" literal → unknown', () => {
    expect(classifyCookingMethod("unknown")).toBe("unknown");
  });
});

// ── Alias / variant strings used in UI or AI suggestions ─────────────────────

describe("classifyCookingMethod — variant / alias strings", () => {
  const variants: [string, CookingMethodClass][] = [
    ["Low and Slow",      "smoke"],
    ["low and slow",      "smoke"],
    ["Smoke",             "smoke"],
    ["Smoked",            "smoke"],
    ["Rotary",            "rotisserie"],
    ["rotary spit",       "rotisserie"],
    ["Braised",           "braised"],
    ["braise",            "braised"],
    ["Braising",          "braised"],
    ["Hot and Fast",      "hot_fast"],
    ["hot and fast",      "hot_fast"],
    ["Direct",            "direct"],
    ["direct",            "direct"],
    ["Sear",              "sear"],
    ["Searing",           "sear"],
  ];

  for (const [input, expected] of variants) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

// ── AI-returned variant strings — five new methods ───────────────────────────
//
// When a cook is created via Quick Plan or PitMaster suggestion the AI may
// return cook-method strings that differ from the canonical UI labels.
// These tests assert that each realistic AI variant still resolves to the
// correct CookingMethodClass so prep tips remain accurate regardless of source.

describe("classifyCookingMethod — AI-returned variant strings (Hot & Fast)", () => {
  const cases: [string, CookingMethodClass][] = [
    // Canonical and common variants the AI may echo back
    ["Hot & Fast",                "hot_fast"],
    ["hot & fast",                "hot_fast"],
    ["Hot and Fast",              "hot_fast"],
    ["hot and fast",              "hot_fast"],
    // AI may omit the connector entirely
    ["Hot Fast",                  "hot_fast"],
    ["hot fast",                  "hot_fast"],
    // AI may prefix with a popular technique name
    ["Texas Crutch Hot & Fast",   "hot_fast"],
    ["High Heat Hot & Fast Cook", "hot_fast"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

describe("classifyCookingMethod — AI-returned variant strings (Reverse Sear)", () => {
  const cases: [string, CookingMethodClass][] = [
    ["Reverse Sear",              "reverse_sear"],
    ["Reverse-Sear",              "reverse_sear"],
    ["reverse sear",              "reverse_sear"],
    // AI may use the gerund form
    ["Reverse Searing",           "reverse_sear"],
    ["Reverse-Sear Finish",       "reverse_sear"],
    ["Reverse Sear Method",       "reverse_sear"],
    ["Reverse Sear (two-stage)",  "reverse_sear"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

describe("classifyCookingMethod — AI-returned variant strings (Rotisserie)", () => {
  const cases: [string, CookingMethodClass][] = [
    ["Rotisserie",          "rotisserie"],
    ["rotisserie",          "rotisserie"],
    ["Rotary",              "rotisserie"],
    ["rotary spit",         "rotisserie"],
    // AI may use the common non-technical name
    ["Spit Roast",          "rotisserie"],
    ["spit roast",          "rotisserie"],
    ["Spit-Roasted",        "rotisserie"],
    ["Rotary Spit Roast",   "rotisserie"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

describe("classifyCookingMethod — AI-returned variant strings (Braised)", () => {
  const cases: [string, CookingMethodClass][] = [
    ["Braised",               "braised"],
    ["braised",               "braised"],
    ["Braise",                "braised"],
    ["Braising",              "braised"],
    // AI may append context that shouldn't change the class
    ["Braised Low & Slow",    "braised"],
    ["Oven Braised",          "braised"],
    ["Braised in Liquid",     "braised"],
    ["Braised in Foil",       "braised"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

describe("classifyCookingMethod — AI-returned variant strings (Indirect)", () => {
  const cases: [string, CookingMethodClass][] = [
    ["Indirect",              "indirect"],
    ["indirect",              "indirect"],
    ["Indirect Heat",         "indirect"],
    // AI may combine with "smoke" — indirect must win over the smoke check
    ["Indirect Smoke",        "indirect"],
    ["Indirect Grilling",     "indirect"],
    // AI commonly describes indirect as two-zone
    ["Two-Zone Cook",         "indirect"],
    ["two-zone indirect",     "indirect"],
    ["2-Zone Indirect",       "indirect"],
    ["2-zone cook",           "indirect"],
  ];
  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(classifyCookingMethod(input)).toBe(expected);
    });
  }
});

// ── isUnrecognisedCookMethod helper ──────────────────────────────────────────
//
// This guard is used on the prep-tip card to surface a warning when an
// AI-assigned cook method on a cut doesn't map to any known category, which
// would cause selectPrepTip to silently fall back to the smoke/low-and-slow tip.

describe("isUnrecognisedCookMethod", () => {
  // Falsy inputs — never treated as unrecognised
  it("null → false (no method = not unrecognised)", () => {
    expect(isUnrecognisedCookMethod(null)).toBe(false);
  });

  it("undefined → false", () => {
    expect(isUnrecognisedCookMethod(undefined)).toBe(false);
  });

  it('empty string → false', () => {
    expect(isUnrecognisedCookMethod("")).toBe(false);
  });

  // Recognised methods — all should return false
  const recognised = [
    "Low & Slow",
    "low & slow",
    "Indirect",
    "Indirect Heat",
    "Direct Heat",
    "direct heat",
    "Reverse Sear",
    "Reverse-Sear",
    "Hot & Fast",
    "Hot and Fast",
    "Rotisserie",
    "rotisserie",
    "Braised",
    "braise",
    "Smoke",
    "Griddle",
    "Sear",
  ];

  for (const method of recognised) {
    it(`"${method}" (recognised) → false`, () => {
      expect(isUnrecognisedCookMethod(method)).toBe(false);
    });
  }

  // Unrecognised strings — these are the AI-assigned methods that cannot
  // be routed to a specific prep tip and silently fall back to smoke advice.
  // Note: strings that contain "smoke", "direct", "sear", etc. DO classify
  // via substring matching — only methods with no matching substring are unknown.
  const unrecognised = [
    "Sous Vide",
    "sous vide",
    "Caveman Style",
    "Deep Fry",
    "Air Fryer",
    "Plancha",
    "Hibachi",
    "unknown",
  ];

  for (const method of unrecognised) {
    it(`"${method}" (unrecognised) → true`, () => {
      expect(isUnrecognisedCookMethod(method)).toBe(true);
    });
  }

  it("all MEAT_CUTS cookMethod values are recognised (warning never fires for built-in cuts)", () => {
    const { MEAT_CUTS } = require("../../constants/meatCuts");
    const methods: string[] = MEAT_CUTS
      .map((c: { cookMethod?: string }) => c.cookMethod)
      .filter((m: string | undefined): m is string => !!m);
    const unrecognisedInData = methods.filter(isUnrecognisedCookMethod);
    expect(unrecognisedInData).toEqual([]);
  });
});

// ── isDirectHeat helper ───────────────────────────────────────────────────────

describe("isDirectHeat", () => {
  const trueInputs = ["Direct Heat", "direct heat", "Sear", "sear", "Griddle", "griddle"];
  const falseInputs = [
    "Indirect", "Low & Slow", "Reverse Sear", "Hot & Fast",
    "Rotisserie", "Braised", null, undefined, "",
  ];

  for (const input of trueInputs) {
    it(`isDirectHeat("${input}") → true`, () => {
      expect(isDirectHeat(input)).toBe(true);
    });
  }

  for (const input of falseInputs) {
    it(`isDirectHeat(${JSON.stringify(input)}) → false`, () => {
      expect(isDirectHeat(input)).toBe(false);
    });
  }
});

// ── includesSear helper ───────────────────────────────────────────────────────

describe("includesSear", () => {
  const trueInputs = ["Direct Heat", "Sear", "Griddle", "Reverse Sear"];
  const falseInputs = ["Indirect", "Low & Slow", "Hot & Fast", "Rotisserie", "Braised", null, undefined];

  for (const input of trueInputs) {
    it(`includesSear("${input}") → true`, () => {
      expect(includesSear(input)).toBe(true);
    });
  }

  for (const input of falseInputs) {
    it(`includesSear(${JSON.stringify(input)}) → false`, () => {
      expect(includesSear(input)).toBe(false);
    });
  }
});

// ── cookMethodDisplayLabel helper ─────────────────────────────────────────────

describe("cookMethodDisplayLabel — canonical labels produce correct display strings", () => {
  const cases: [string | null, string][] = [
    ["Low & Slow",   "Smoking"],
    ["Indirect",     "Indirect"],
    ["Direct Heat",  "Grilling"],
    ["Reverse Sear", "Reverse Searing"],
    ["Hot & Fast",   "Cooking"],   // hot_fast falls to default
    ["Rotisserie",   "Rotisserie"],
    ["Griddle",      "Griddling"],
    ["Sear",         "Searing"],
    [null,           "Cooking"],
    ["unknown",      "Cooking"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(cookMethodDisplayLabel(input)).toBe(expected);
    });
  }
});

// ── pitTempLabel helper ───────────────────────────────────────────────────────

describe("pitTempLabel — canonical labels produce correct sensor label", () => {
  const cases: [string | null, string][] = [
    ["Direct Heat",  "Grill Temp"],
    ["Sear",         "Grill Temp"],
    ["Griddle",      "Grill Temp"],
    ["Indirect",     "Pit Temp"],
    ["Low & Slow",   "Pit Temp"],
    ["Reverse Sear", "Pit Temp"],
    ["Rotisserie",   "Pit Temp"],
    [null,           "Cook Temp"],
    ["unknown",      "Cook Temp"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(pitTempLabel(input)).toBe(expected);
    });
  }

  it('pitTempLabel with withUnit=true appends " (°F)"', () => {
    expect(pitTempLabel("Direct Heat", true)).toBe("Grill Temp (°F)");
    expect(pitTempLabel("Indirect", true)).toBe("Pit Temp (°F)");
    expect(pitTempLabel(null, true)).toBe("Cook Temp (°F)");
  });
});

// ── cookMethodContextPhrase helper ────────────────────────────────────────────

describe("cookMethodContextPhrase — canonical labels produce correct phrase", () => {
  const cases: [string | null, string][] = [
    ["Low & Slow",   "on the smoker"],
    ["Indirect",     "on the grill"],
    ["Direct Heat",  "on the grill"],
    ["Sear",         "on the grill"],
    ["Reverse Sear", "on the grill"],
    ["Rotisserie",   "on the rotisserie"],
    ["Griddle",      "on the griddle"],
    [null,           "on the grill"],
  ];

  for (const [input, expected] of cases) {
    it(`"${input}" → "${expected}"`, () => {
      expect(cookMethodContextPhrase(input)).toBe(expected);
    });
  }
});
