/**
 * Unit tests for processMultiCookResult — the pure function that converts a
 * raw AI JSON response into the final multi-cook schedule shape, including
 * shared-grill follow-on detection and grillLightAt enforcement.
 *
 * Critical invariants under test:
 *   1. Two items on the same grill → second gets isSharedGrillFollowOn=true
 *      and its grillLightAt is overridden to equal meatOnAt (no preheat gap).
 *   2. Two items on different grills → neither is a follow-on.
 *   3. Three items where two share a grill and one is on a separate grill →
 *      correct flags on all three.
 *   4. sharedGrillTips is passed through from the AI response when it is a
 *      non-empty string; becomes null otherwise.
 *
 * No mocking needed — processMultiCookResult is a pure function with zero
 * side effects (no DB, no AI, no network calls).
 */

import { describe, it, expect } from "vitest";
import { processMultiCookResult } from "../processMultiCookResult";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Minimal AI-response schedule item. */
function schedItem(overrides: {
  foodType: string;
  grillLightAt: string;
  meatOnAt: string;
  estimatedFinishAt?: string;
  estimatedDurationMinutes?: number;
  wrapMethod?: string;
  [key: string]: unknown;
}) {
  return {
    estimatedDurationMinutes: 60,
    preheatMinutes: 25,
    restMinutes: 15,
    estimatedFinishAt: "2025-06-13T20:00:00Z",
    wrapMethod: "none",
    wrapAtMinutes: null,
    wrapTempF: null,
    wrapReason: null,
    notes: "No extra tips.",
    ...overrides,
  };
}

/** Minimal request item (mirrors the Zod-parsed AiMultiCookBody items shape). */
function reqItem(foodType: string, grillName: string | null = null) {
  return {
    foodType,
    grillName,
    grillId: null,
    weightLbs: 10,
    cookTempF: 225,
    targetTempF: 205,
    preheatMinutes: 25,
    cookingMethod: null,
    cookingStylePreset: null,
    fromFrozen: false,
    thawMethod: null,
  };
}

const SERVE_AT = new Date("2025-06-13T20:00:00Z");

// ── Two items on the same grill ───────────────────────────────────────────────

describe("two items on the same grill", () => {
  const BRISKET_MEAT_ON = "2025-06-13T06:00:00Z";
  const RIBS_MEAT_ON    = "2025-06-13T14:00:00Z";

  // AI gave ribs a grillLightAt 25 min before meatOnAt — server must override.
  const raw = {
    schedule: [
      schedItem({
        foodType: "Brisket",
        grillLightAt: "2025-06-13T05:35:00Z",
        meatOnAt: BRISKET_MEAT_ON,
        estimatedDurationMinutes: 840,
      }),
      schedItem({
        foodType: "Ribs",
        grillLightAt: "2025-06-13T13:35:00Z", // AI included 25-min preheat gap — should be overridden
        meatOnAt: RIBS_MEAT_ON,
        estimatedDurationMinutes: 360,
      }),
    ],
    sharedGrillTips: "Place brisket fat-side down first. Add ribs on upper rack.",
  };

  const requestItems = [
    reqItem("Brisket", "Big Green Egg"),
    reqItem("Ribs", "Big Green Egg"),
  ];

  it("first item is not a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    expect(brisket.isSharedGrillFollowOn).toBe(false);
  });

  it("second item on the same grill is marked as a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const ribs = result.schedule.find((s: any) => s.foodType === "Ribs");
    expect(ribs.isSharedGrillFollowOn).toBe(true);
  });

  it("enforces grillLightAt === meatOnAt for the follow-on item", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const ribs = result.schedule.find((s: any) => s.foodType === "Ribs");
    expect(ribs.grillLightAt).toBe(RIBS_MEAT_ON);
  });

  it("does not modify grillLightAt for the first item", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    expect(brisket.grillLightAt).toBe("2025-06-13T05:35:00Z");
  });
});

// ── Two items on different grills ─────────────────────────────────────────────

describe("two items on different grills", () => {
  const raw = {
    schedule: [
      schedItem({
        foodType: "Brisket",
        grillLightAt: "2025-06-13T05:35:00Z",
        meatOnAt: "2025-06-13T06:00:00Z",
        estimatedDurationMinutes: 840,
      }),
      schedItem({
        foodType: "Chicken",
        grillLightAt: "2025-06-13T15:35:00Z",
        meatOnAt: "2025-06-13T16:00:00Z",
        estimatedDurationMinutes: 240,
      }),
    ],
    sharedGrillTips: null,
  };

  const requestItems = [
    reqItem("Brisket", "Big Green Egg"),
    reqItem("Chicken", "Weber Kettle"),
  ];

  it("first item is not a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    expect(brisket.isSharedGrillFollowOn).toBe(false);
  });

  it("second item on a different grill is not a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const chicken = result.schedule.find((s: any) => s.foodType === "Chicken");
    expect(chicken.isSharedGrillFollowOn).toBe(false);
  });

  it("grillLightAt values are preserved unchanged for both items", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    const chicken = result.schedule.find((s: any) => s.foodType === "Chicken");
    expect(brisket.grillLightAt).toBe("2025-06-13T05:35:00Z");
    expect(chicken.grillLightAt).toBe("2025-06-13T15:35:00Z");
  });
});

// ── Three items: two on shared grill, one on a different grill ────────────────

describe("three items — two share a grill, one on separate grill", () => {
  const RIBS_MEAT_ON = "2025-06-13T14:00:00Z";

  // Sorted order (by grillLightAt): Brisket → Ribs → Chicken
  const raw = {
    schedule: [
      schedItem({
        foodType: "Brisket",
        grillLightAt: "2025-06-13T05:35:00Z",
        meatOnAt: "2025-06-13T06:00:00Z",
        estimatedDurationMinutes: 840,
      }),
      schedItem({
        foodType: "Chicken",
        grillLightAt: "2025-06-13T15:35:00Z",
        meatOnAt: "2025-06-13T16:00:00Z",
        estimatedDurationMinutes: 240,
      }),
      schedItem({
        foodType: "Ribs",
        grillLightAt: "2025-06-13T13:35:00Z", // AI's incorrect preheat-gap version
        meatOnAt: RIBS_MEAT_ON,
        estimatedDurationMinutes: 360,
      }),
    ],
    sharedGrillTips: "Manage hot spots carefully.",
  };

  const requestItems = [
    reqItem("Brisket", "Big Green Egg"),
    reqItem("Ribs", "Big Green Egg"),
    reqItem("Chicken", "Weber Kettle"),
  ];

  it("Brisket (first on shared grill) is not a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    expect(brisket.isSharedGrillFollowOn).toBe(false);
  });

  it("Ribs (second on shared grill) is a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const ribs = result.schedule.find((s: any) => s.foodType === "Ribs");
    expect(ribs.isSharedGrillFollowOn).toBe(true);
  });

  it("enforces grillLightAt === meatOnAt for the Ribs follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const ribs = result.schedule.find((s: any) => s.foodType === "Ribs");
    expect(ribs.grillLightAt).toBe(RIBS_MEAT_ON);
  });

  it("Chicken (on separate grill) is not a follow-on", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const chicken = result.schedule.find((s: any) => s.foodType === "Chicken");
    expect(chicken.isSharedGrillFollowOn).toBe(false);
  });

  it("Chicken grillLightAt is left untouched", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const chicken = result.schedule.find((s: any) => s.foodType === "Chicken");
    expect(chicken.grillLightAt).toBe("2025-06-13T15:35:00Z");
  });

  it("schedule is sorted by grillLightAt ascending", () => {
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const times = result.schedule.map((s: any) => new Date(s.grillLightAt).getTime());
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
    }
  });
});

// ── sharedGrillTips passthrough ───────────────────────────────────────────────

describe("sharedGrillTips passthrough", () => {
  const twoItemsOnSameGrill = (tips: unknown) => ({
    schedule: [
      schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
      schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: "2025-06-13T14:00:00Z" }),
    ],
    sharedGrillTips: tips,
  });

  const requestItems = [
    reqItem("Brisket", "Big Green Egg"),
    reqItem("Ribs", "Big Green Egg"),
  ];

  it("returns the tip string when AI provides a non-empty string", () => {
    const raw = twoItemsOnSameGrill("Use the deflector plate for indirect heat.");
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBe("Use the deflector plate for indirect heat.");
  });

  it("trims surrounding whitespace from the tip string", () => {
    const raw = twoItemsOnSameGrill("  Keep the lid closed.  ");
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBe("Keep the lid closed.");
  });

  it("returns null when sharedGrillTips is null", () => {
    const raw = twoItemsOnSameGrill(null);
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBeNull();
  });

  it("returns null when sharedGrillTips is an empty string", () => {
    const raw = twoItemsOnSameGrill("");
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBeNull();
  });

  it("returns null when sharedGrillTips is a whitespace-only string", () => {
    const raw = twoItemsOnSameGrill("   ");
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBeNull();
  });

  it("returns null when sharedGrillTips is a non-string (e.g. a number)", () => {
    const raw = twoItemsOnSameGrill(42);
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBeNull();
  });

  it("returns null when sharedGrillTips is absent from the AI response", () => {
    const raw = {
      schedule: [
        schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
        schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: "2025-06-13T14:00:00Z" }),
      ],
    };
    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    expect(result.sharedGrillTips).toBeNull();
  });
});

// ── Edge cases ────────────────────────────────────────────────────────────────

describe("edge cases", () => {
  it("items with no grillName are never marked as follow-ons", () => {
    const raw = {
      schedule: [
        schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
        schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: "2025-06-13T14:00:00Z" }),
      ],
      sharedGrillTips: null,
    };
    // No grillName on either request item — grill identity is unknown
    const requestItems = [
      reqItem("Brisket", null),
      reqItem("Ribs", null),
    ];

    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    for (const item of result.schedule) {
      expect(item.isSharedGrillFollowOn).toBe(false);
    }
  });

  it("foodType matching is case-insensitive", () => {
    const RIBS_MEAT_ON = "2025-06-13T14:00:00Z";
    const raw = {
      schedule: [
        schedItem({ foodType: "brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
        schedItem({ foodType: "RIBS",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: RIBS_MEAT_ON }),
      ],
      sharedGrillTips: null,
    };
    // Request items use different casing
    const requestItems = [
      reqItem("Brisket", "Big Green Egg"),
      reqItem("Ribs",    "Big Green Egg"),
    ];

    const result = processMultiCookResult(raw, SERVE_AT, requestItems);
    const ribs = result.schedule.find((s: any) => s.foodType === "RIBS");
    expect(ribs.isSharedGrillFollowOn).toBe(true);
    expect(ribs.grillLightAt).toBe(RIBS_MEAT_ON);
  });

  it("serveAt equals max(estimatedFinishAt + restMinutes) across items when self-consistent", () => {
    // Both items have self-consistent times: meatOnAt + 60 min = estimatedFinishAt
    // Ribs finishes later: 19:45Z + 15 min rest = 20:00Z = SERVE_AT
    const raw = {
      schedule: [
        schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T17:20:00Z", meatOnAt: "2025-06-13T17:45:00Z", estimatedFinishAt: "2025-06-13T18:45:00Z", estimatedDurationMinutes: 60 }),
        schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T18:20:00Z", meatOnAt: "2025-06-13T18:45:00Z", estimatedFinishAt: "2025-06-13T19:45:00Z", estimatedDurationMinutes: 60 }),
      ],
      sharedGrillTips: null,
    };
    const result = processMultiCookResult(raw, SERVE_AT, [reqItem("Brisket"), reqItem("Ribs")]);
    // Ribs: estimatedFinishAt 19:45Z + 15 min rest = 20:00Z = SERVE_AT
    expect(result.serveAt).toBe(SERVE_AT.toISOString());
  });

  it("serveAt is recomputed from actual item times when AI returns inconsistent timestamps", () => {
    // AI gives meatOnAt far earlier than estimatedFinishAt - duration would require
    // (infeasible schedule: meatOnAt + 60min ≠ estimatedFinishAt)
    // After enforcement, estimatedFinishAt = meatOnAt + 60 min.
    // Ribs: meatOnAt 14:00Z + 60min = 15:00Z finish + 15min rest = 15:15Z ready
    const raw = {
      schedule: [
        schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
        schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: "2025-06-13T14:00:00Z" }),
      ],
      sharedGrillTips: null,
    };
    const result = processMultiCookResult(raw, SERVE_AT, [reqItem("Brisket"), reqItem("Ribs")]);
    // Actual latest ready = Ribs 14:00Z + 60min + 15min = 15:15Z, not the requested 20:00Z
    expect(result.serveAt).toBe("2025-06-13T15:15:00.000Z");
  });

  it("produces the deterministic summary when there are two or more items", () => {
    // After sorting by grillLightAt: Brisket first, Ribs last
    const raw = {
      schedule: [
        schedItem({ foodType: "Brisket", grillLightAt: "2025-06-13T05:35:00Z", meatOnAt: "2025-06-13T06:00:00Z" }),
        schedItem({ foodType: "Ribs",    grillLightAt: "2025-06-13T13:35:00Z", meatOnAt: "2025-06-13T14:00:00Z" }),
      ],
      sharedGrillTips: null,
    };
    const result = processMultiCookResult(raw, SERVE_AT, [reqItem("Brisket"), reqItem("Ribs")]);
    expect(result.summary).toBe("Start Brisket first, then Ribs last.");
  });

  it("handles an empty schedule without throwing", () => {
    const raw = { schedule: [], sharedGrillTips: null };
    const result = processMultiCookResult(raw, SERVE_AT, []);
    expect(result.schedule).toHaveLength(0);
    expect(result.summary).toBe("");
  });

  it("handles a missing schedule key (raw.schedule is undefined) without throwing", () => {
    const raw = { sharedGrillTips: null };
    const result = processMultiCookResult(raw, SERVE_AT, []);
    expect(result.schedule).toHaveLength(0);
  });
});

// ── Direct-heat wrap suppression ─────────────────────────────────────────────
// Regression coverage for the method-aware coaching engine gate that forces
// wrapMethod = "none" (and clears all wrap fields) when cookingMethod is a
// direct-heat variant, regardless of what the AI JSON returns.

describe("direct-heat wrap suppression in processMultiCookResult", () => {
  const FUTURE_SERVE_AT = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10h from now

  function reqItemWithMethod(
    foodType: string,
    cookingMethod: string | null,
    grillName: string | null = null,
  ) {
    return {
      foodType,
      grillName,
      grillId: null,
      weightLbs: 5,
      cookTempF: 450,
      targetTempF: 165,
      preheatMinutes: 15,
      cookingMethod,
      cookingStylePreset: null,
      fromFrozen: false,
      thawMethod: null,
    };
  }

  const directHeatMethods = [
    "Direct Heat",
    "direct heat",
    "Sear",
    "sear",
    "Griddle",
    "griddle",
    "Direct Heat / Sear",
  ];

  // Each method variant must suppress wrap regardless of what the AI returns.
  for (const method of directHeatMethods) {
    describe(`cookingMethod = "${method}"`, () => {
      const AI_WRAP_VALUES = [
        { wrapMethod: "foil",          wrapAtMinutes: 30, wrapTempF: 165, wrapReason: "Prevents stalling" },
        { wrapMethod: "butcher_paper", wrapAtMinutes: 45, wrapTempF: 170, wrapReason: "Keeps bark crispy" },
        { wrapMethod: null,            wrapAtMinutes: null, wrapTempF: null, wrapReason: null },
      ];

      for (const aiWrap of AI_WRAP_VALUES) {
        it(`forces wrapMethod = "none" even when AI returns wrapMethod = ${JSON.stringify(aiWrap.wrapMethod)}`, () => {
          const raw = {
            schedule: [
              {
                foodType: "Chicken Thighs",
                grillLightAt: new Date(Date.now() + 30 * 60_000).toISOString(),
                meatOnAt: new Date(Date.now() + 45 * 60_000).toISOString(),
                estimatedFinishAt: new Date(Date.now() + 105 * 60_000).toISOString(),
                estimatedDurationMinutes: 60,
                preheatMinutes: 15,
                restMinutes: 5,
                ...aiWrap,
                notes: "Cook over direct heat.",
              },
            ],
            sharedGrillTips: null,
          };

          const result = processMultiCookResult(
            raw,
            FUTURE_SERVE_AT,
            [reqItemWithMethod("Chicken Thighs", method)],
          );

          const item = result.schedule[0];
          expect(item.wrapMethod).toBe("none");
        });

        it(`clears wrapAtMinutes to null when AI returns wrapAtMinutes = ${JSON.stringify(aiWrap.wrapAtMinutes)}`, () => {
          const raw = {
            schedule: [
              {
                foodType: "Steak",
                grillLightAt: new Date(Date.now() + 30 * 60_000).toISOString(),
                meatOnAt: new Date(Date.now() + 45 * 60_000).toISOString(),
                estimatedFinishAt: new Date(Date.now() + 75 * 60_000).toISOString(),
                estimatedDurationMinutes: 30,
                preheatMinutes: 15,
                restMinutes: 10,
                ...aiWrap,
                notes: "Sear over direct flame.",
              },
            ],
            sharedGrillTips: null,
          };

          const result = processMultiCookResult(
            raw,
            FUTURE_SERVE_AT,
            [reqItemWithMethod("Steak", method)],
          );

          const item = result.schedule[0];
          expect(item.wrapAtMinutes).toBeNull();
          expect(item.wrapTempF).toBeNull();
          expect(item.wrapReason).toBeNull();
        });
      }
    });
  }

  it("does NOT suppress wrap for a smoke method even when the AI returns foil wrap", () => {
    const raw = {
      schedule: [
        {
          foodType: "Brisket",
          grillLightAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          meatOnAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          estimatedFinishAt: new Date(Date.now() + 900 * 60_000).toISOString(),
          estimatedDurationMinutes: 840,
          preheatMinutes: 30,
          restMinutes: 60,
          wrapMethod: "foil",
          wrapAtMinutes: 300,
          wrapTempF: 165,
          wrapReason: "Push through the stall.",
          notes: "Long smoke.",
        },
      ],
      sharedGrillTips: null,
    };

    const result = processMultiCookResult(
      raw,
      FUTURE_SERVE_AT,
      [reqItemWithMethod("Brisket", "Low and Slow")],
    );

    const item = result.schedule[0];
    expect(item.wrapMethod).toBe("foil");
    expect(item.wrapAtMinutes).not.toBeNull();
  });

  it("correctly suppresses wrap for a direct-heat item while preserving wrap on a smoke item in the same schedule", () => {
    const raw = {
      schedule: [
        {
          foodType: "Brisket",
          grillLightAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          meatOnAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          estimatedFinishAt: new Date(Date.now() + 900 * 60_000).toISOString(),
          estimatedDurationMinutes: 840,
          preheatMinutes: 30,
          restMinutes: 60,
          wrapMethod: "foil",
          wrapAtMinutes: 300,
          wrapTempF: 165,
          wrapReason: "Push through stall.",
          notes: "Long smoke.",
        },
        {
          foodType: "Corn",
          grillLightAt: new Date(Date.now() + 31 * 60_000).toISOString(),
          meatOnAt: new Date(Date.now() + 46 * 60_000).toISOString(),
          estimatedFinishAt: new Date(Date.now() + 76 * 60_000).toISOString(),
          estimatedDurationMinutes: 30,
          preheatMinutes: 15,
          restMinutes: 0,
          wrapMethod: "foil",     // AI incorrectly suggests foil for a direct-heat item
          wrapAtMinutes: 15,
          wrapTempF: null,
          wrapReason: "Lock in moisture.",
          notes: "Quick grill.",
        },
      ],
      sharedGrillTips: null,
    };

    const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [
      reqItemWithMethod("Brisket", "Low and Slow", "Offset Smoker"),
      reqItemWithMethod("Corn", "Direct Heat", "Gas Grill"),
    ]);

    const brisket = result.schedule.find((s: any) => s.foodType === "Brisket");
    const corn = result.schedule.find((s: any) => s.foodType === "Corn");

    // Smoke item: wrap preserved
    expect(brisket.wrapMethod).toBe("foil");
    expect(brisket.wrapAtMinutes).not.toBeNull();

    // Direct-heat item: wrap suppressed
    expect(corn.wrapMethod).toBe("none");
    expect(corn.wrapAtMinutes).toBeNull();
    expect(corn.wrapTempF).toBeNull();
    expect(corn.wrapReason).toBeNull();
  });

  // ── Griddle + smoke on a combo grill ───────────────────────────────────────
  // Regression: AI hallucinates a wrapMethod on a griddle item on a combo cook.
  // The Griddle cookingMethod must suppress wrap even when paired with a
  // simultaneously-running smoke item that legitimately needs wrap guidance.

  describe("combo grill: Griddle item alongside a smoke item (mixed-method schedule)", () => {
    // AI response where the griddle item (Smash Burgers) has hallucinated wrap
    // fields and the smoke item (Pork Shoulder) has legitimate wrap fields.
    const makeRaw = (griddle_cookingMethod_in_request: string) => ({
      schedule: [
        {
          foodType: "Pork Shoulder",
          grillLightAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          meatOnAt: new Date(Date.now() + 60 * 60_000).toISOString(),
          estimatedFinishAt: new Date(Date.now() + 540 * 60_000).toISOString(),
          estimatedDurationMinutes: 480,
          preheatMinutes: 30,
          restMinutes: 30,
          wrapMethod: "butcher_paper",
          wrapAtMinutes: 240,
          wrapTempF: 165,
          wrapReason: "Push through the stall and set the bark.",
          notes: "Low and slow in the smoke chamber.",
        },
        {
          foodType: "Smash Burgers",
          grillLightAt: new Date(Date.now() + 31 * 60_000).toISOString(),
          meatOnAt: new Date(Date.now() + 46 * 60_000).toISOString(),
          estimatedFinishAt: new Date(Date.now() + 66 * 60_000).toISOString(),
          estimatedDurationMinutes: 20,
          preheatMinutes: 15,
          restMinutes: 5,
          // AI hallucinates wrap for a griddle item
          wrapMethod: "foil",
          wrapAtMinutes: 10,
          wrapTempF: 160,
          wrapReason: "Keeps the cheese melted.",
          notes: "Cook on the griddle side at high heat.",
        },
      ],
      sharedGrillTips: "Use smoke chamber for shoulder; griddle side for burgers.",
    });

    for (const griddleMethod of ["Griddle", "griddle"]) {
      describe(`griddle item with cookingMethod = "${griddleMethod}"`, () => {
        it("preserves butcher_paper wrap on the smoke item", () => {
          const raw = makeRaw(griddleMethod);
          const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [
            reqItemWithMethod("Pork Shoulder", "Low and Slow", "Pitts & Spitts Maverick Combo"),
            reqItemWithMethod("Smash Burgers", griddleMethod, "Pitts & Spitts Maverick Combo"),
          ]);
          const shoulder = result.schedule.find((s: any) => s.foodType === "Pork Shoulder");
          expect(shoulder.wrapMethod).toBe("butcher_paper");
          expect(shoulder.wrapAtMinutes).not.toBeNull();
          expect(shoulder.wrapTempF).not.toBeNull();
          expect(shoulder.wrapReason).not.toBeNull();
        });

        it("forces wrapMethod = \"none\" on the griddle item", () => {
          const raw = makeRaw(griddleMethod);
          const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [
            reqItemWithMethod("Pork Shoulder", "Low and Slow", "Pitts & Spitts Maverick Combo"),
            reqItemWithMethod("Smash Burgers", griddleMethod, "Pitts & Spitts Maverick Combo"),
          ]);
          const burgers = result.schedule.find((s: any) => s.foodType === "Smash Burgers");
          expect(burgers.wrapMethod).toBe("none");
        });

        it("clears wrapAtMinutes, wrapTempF, and wrapReason to null on the griddle item", () => {
          const raw = makeRaw(griddleMethod);
          const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [
            reqItemWithMethod("Pork Shoulder", "Low and Slow", "Pitts & Spitts Maverick Combo"),
            reqItemWithMethod("Smash Burgers", griddleMethod, "Pitts & Spitts Maverick Combo"),
          ]);
          const burgers = result.schedule.find((s: any) => s.foodType === "Smash Burgers");
          expect(burgers.wrapAtMinutes).toBeNull();
          expect(burgers.wrapTempF).toBeNull();
          expect(burgers.wrapReason).toBeNull();
        });
      });
    }
  });
});

// ── Deterministic realignment to serveAt (feasible schedules) ────────────────
// Regression coverage for the multi-cook sequencer bug where the AI's own
// backward-math timestamps landed a consistent 20 minutes after the
// requested serveAt for every item, even though grillLightAt/meatOnAt/
// estimatedFinishAt were internally self-consistent with each other.

describe("deterministic realignment to serveAt", () => {
  // Use a serveAt far enough in the future that every item's backward-computed
  // meatOnAt is comfortably after "now + 30min" (i.e. feasible).
  const FUTURE_SERVE_AT = new Date(Date.now() + 10 * 60 * 60 * 1000); // 10h from now

  function isoMinus(base: Date, minutes: number): string {
    return new Date(base.getTime() - minutes * 60_000).toISOString();
  }

  it("overrides AI timestamps that are consistently late so the item finishes exactly at serveAt", () => {
    // Mirrors the reported bug: AI's own math is 20 minutes later than
    // needed for both meatOnAt and estimatedFinishAt, while remaining
    // internally self-consistent (meatOnAt + duration = finish).
    const restMin = 30;
    const cookMin = 240; // 4h
    const preheatMin = 25;

    // AI's (buggy) values: everything shifted 20 min later than ideal.
    const aiMeatOnAt = isoMinus(FUTURE_SERVE_AT, restMin + cookMin - 20);
    const aiFinishAt = isoMinus(FUTURE_SERVE_AT, restMin - 20);
    const aiGrillLightAt = isoMinus(FUTURE_SERVE_AT, restMin + cookMin + preheatMin - 20);

    const raw = {
      schedule: [
        schedItem({
          foodType: "Chuck Roast",
          grillLightAt: aiGrillLightAt,
          meatOnAt: aiMeatOnAt,
          estimatedFinishAt: aiFinishAt,
          estimatedDurationMinutes: cookMin,
          restMinutes: restMin,
          preheatMinutes: preheatMin,
        }),
      ],
      sharedGrillTips: null,
    };

    const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [reqItem("Chuck Roast", "Spider Grills Huntsman")]);
    const item = result.schedule[0];

    // Ready-to-serve (finish + rest) must land exactly on the target, not 20 min late.
    expect(new Date(item.estimatedFinishAt).getTime() + restMin * 60_000).toBe(FUTURE_SERVE_AT.getTime());
    expect(result.serveAt).toBe(FUTURE_SERVE_AT.toISOString());
    // meatOnAt and grillLightAt are re-derived consistently from the corrected finish time.
    expect(new Date(item.meatOnAt).getTime()).toBe(new Date(item.estimatedFinishAt).getTime() - cookMin * 60_000);
    expect(new Date(item.grillLightAt).getTime()).toBe(new Date(item.meatOnAt).getTime() - preheatMin * 60_000);
  });

  it("aligns multiple items on different grills so all finish (with rest) exactly at serveAt", () => {
    const item1 = schedItem({
      foodType: "Chuck Roast",
      grillLightAt: isoMinus(FUTURE_SERVE_AT, 300), // AI's raw values are irrelevant post-override
      meatOnAt: isoMinus(FUTURE_SERVE_AT, 275),
      estimatedFinishAt: isoMinus(FUTURE_SERVE_AT, 35),
      estimatedDurationMinutes: 240,
      restMinutes: 30,
      preheatMinutes: 25,
    });
    const item2 = schedItem({
      foodType: "Tomahawk Steak",
      grillLightAt: isoMinus(FUTURE_SERVE_AT, 120),
      meatOnAt: isoMinus(FUTURE_SERVE_AT, 105),
      estimatedFinishAt: isoMinus(FUTURE_SERVE_AT, 20),
      estimatedDurationMinutes: 90,
      restMinutes: 15,
      preheatMinutes: 15,
    });

    const raw = { schedule: [item1, item2], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE_SERVE_AT, [
      reqItem("Chuck Roast", "Spider Grills Huntsman"),
      reqItem("Tomahawk Steak", "Pit Boss Champion"),
    ]);

    for (const item of result.schedule) {
      const restMin = item.restMinutes as number;
      const readyMs = new Date(item.estimatedFinishAt).getTime() + restMin * 60_000;
      expect(readyMs).toBe(FUTURE_SERVE_AT.getTime());
    }
    expect(result.serveAt).toBe(FUTURE_SERVE_AT.toISOString());
  });

  it("does not override an infeasible item (backward math would land meatOnAt in the past)", () => {
    // serveAt is only 10 minutes from now — far too soon for a 4h cook,
    // so meatOnAt would need to be in the past. The AI is expected to have
    // already applied its "earliest achievable" fallback; we must not
    // clobber it with an impossible past timestamp.
    const nearServeAt = new Date(Date.now() + 10 * 60_000);
    const aiEarliestMeatOn = new Date(Date.now() + 5 * 60_000).toISOString();
    const aiEarliestGrillLight = new Date(Date.now() + 1 * 60_000).toISOString();
    const aiEarliestFinish = new Date(new Date(aiEarliestMeatOn).getTime() + 240 * 60_000).toISOString();

    const raw = {
      schedule: [
        schedItem({
          foodType: "Chuck Roast",
          grillLightAt: aiEarliestGrillLight,
          meatOnAt: aiEarliestMeatOn,
          estimatedFinishAt: aiEarliestFinish,
          estimatedDurationMinutes: 240,
          restMinutes: 30,
          preheatMinutes: 25,
        }),
      ],
      sharedGrillTips: null,
    };

    const result = processMultiCookResult(raw, nearServeAt, [reqItem("Chuck Roast")]);
    const item = result.schedule[0];
    // Left untouched — still anchored to "earliest achievable", not serveAt.
    expect(item.meatOnAt).toBe(aiEarliestMeatOn);
    expect(item.estimatedFinishAt).toBe(aiEarliestFinish);
  });
});

// ── Wrap-time clamping ─────────────────────────────────────────────────────────

describe("wrap-time clamping (wrap must land strictly before pull-off)", () => {
  const FUTURE = new Date(Date.now() + 12 * 60 * 60_000); // 12h out — feasible

  function wrapItem(overrides: Record<string, unknown> = {}) {
    return schedItem({
      foodType: "Baby Back Ribs",
      grillLightAt: new Date(FUTURE.getTime() - 4 * 60 * 60_000).toISOString(),
      meatOnAt: new Date(FUTURE.getTime() - 3.5 * 60 * 60_000).toISOString(),
      estimatedFinishAt: new Date(FUTURE.getTime() - 20 * 60_000).toISOString(),
      wrapMethod: "foil",
      wrapAtMinutes: 120,
      wrapTempF: 165,
      wrapReason: "Push through the stall.",
      ...overrides,
    });
  }

  it("re-derives a wrap that lands at/after pull-off (fixed 2h wrap on a 103m cook)", () => {
    // Use a cut without a duration floor so the clamp itself is exercised.
    const raw = { schedule: [wrapItem({ foodType: "Chuck Roast", estimatedDurationMinutes: 103, wrapAtMinutes: 120 })], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Chuck Roast")]);
    const item = result.schedule[0];
    expect(item.wrapAtMinutes).not.toBeNull();
    expect(item.wrapAtMinutes).toBeLessThan(103);
    expect(item.wrapAtMinutes).toBe(Math.round(103 * 0.55));
  });

  it("drops the wrap timing entirely when the cook is too short for a wrap window", () => {
    const raw = { schedule: [wrapItem({ foodType: "Chuck Roast", estimatedDurationMinutes: 20, wrapAtMinutes: 120 })], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Chuck Roast")]);
    expect(result.schedule[0].wrapAtMinutes).toBeNull();
  });

  it("leaves a valid wrap untouched (2h wrap on a 5h cook)", () => {
    const raw = { schedule: [wrapItem({ estimatedDurationMinutes: 300, wrapAtMinutes: 120 })], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Baby Back Ribs")]);
    expect(result.schedule[0].wrapAtMinutes).toBe(120);
  });

  it("clamps an inferred wrap the same way (no explicit wrapAtMinutes)", () => {
    const raw = { schedule: [wrapItem({ foodType: "Chuck Roast", estimatedDurationMinutes: 150, wrapAtMinutes: null })], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Chuck Roast")]);
    const item = result.schedule[0];
    expect(item.wrapAtMinutes).toBe(Math.round(150 * 0.55));
    expect(item.wrapAtMinutes).toBeLessThan(150);
  });

  it("clamps fixed pork-butt style wrap offsets (300m wrap on a 200m cook)", () => {
    const raw = { schedule: [wrapItem({ foodType: "Pork Butt", estimatedDurationMinutes: 200, wrapAtMinutes: 300 })], sharedGrillTips: null };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Pork Butt")]);
    const item = result.schedule[0];
    expect(item.wrapAtMinutes).toBe(Math.round(200 * 0.55));
  });
});

// ── Server-side duration floor ────────────────────────────────────────────────

describe("duration floor enforcement (method-driven cuts)", () => {
  const FUTURE = new Date(Date.now() + 12 * 60 * 60_000);

  it("raises a below-floor baby back duration and realigns timestamps (feasible)", () => {
    const raw = {
      schedule: [
        schedItem({
          foodType: "Baby Back Ribs",
          grillLightAt: new Date(FUTURE.getTime() - 3 * 60 * 60_000).toISOString(),
          meatOnAt: new Date(FUTURE.getTime() - 2.5 * 60 * 60_000).toISOString(),
          estimatedFinishAt: new Date(FUTURE.getTime() - 20 * 60_000).toISOString(),
          estimatedDurationMinutes: 103, // below the 240m floor
          restMinutes: 20,
          preheatMinutes: 25,
          wrapMethod: "foil",
          wrapAtMinutes: 120,
        }),
      ],
      sharedGrillTips: null,
    };
    const result = processMultiCookResult(raw, FUTURE, [reqItem("Baby Back Ribs")]);
    const item = result.schedule[0];
    expect(item.estimatedDurationMinutes).toBe(240);
    // Wrap (120m) is now valid against the floored duration.
    expect(item.wrapAtMinutes).toBe(120);
    // Timestamps realigned: finish = serveAt - rest, meatOn = finish - 240m.
    const finishMs = new Date(item.estimatedFinishAt).getTime();
    const meatOnMs = new Date(item.meatOnAt).getTime();
    expect(finishMs).toBe(FUTURE.getTime() - 20 * 60_000);
    expect(finishMs - meatOnMs).toBe(240 * 60_000);
  });

  it("keeps finish = meatOn + floored duration when infeasible (anchored to now)", () => {
    const nearServeAt = new Date(Date.now() + 30 * 60_000);
    const meatOnAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const raw = {
      schedule: [
        schedItem({
          foodType: "Baby Back Ribs",
          grillLightAt: new Date(Date.now() + 5 * 60_000).toISOString(),
          meatOnAt,
          estimatedFinishAt: new Date(new Date(meatOnAt).getTime() + 103 * 60_000).toISOString(),
          estimatedDurationMinutes: 103,
          restMinutes: 20,
          wrapMethod: "foil",
          wrapAtMinutes: 120,
        }),
      ],
      sharedGrillTips: null,
    };
    const result = processMultiCookResult(raw, nearServeAt, [reqItem("Baby Back Ribs")]);
    const item = result.schedule[0];
    expect(item.estimatedDurationMinutes).toBe(240);
    const finishMs = new Date(item.estimatedFinishAt).getTime();
    const meatOnMs = new Date(item.meatOnAt).getTime();
    expect(finishMs - meatOnMs).toBe(240 * 60_000);
    expect(item.wrapAtMinutes).toBe(120);
  });
});
