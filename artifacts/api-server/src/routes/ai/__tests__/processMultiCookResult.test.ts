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
