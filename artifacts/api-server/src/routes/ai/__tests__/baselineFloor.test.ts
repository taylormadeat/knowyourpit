/**
 * Regression tests for applyBaselineFloor — method-driven cuts (ribs) must
 * not produce impossibly short baselines at light weights, which previously
 * caused wrap steps scheduled after the pull-off time (e.g. a 1h43m baby
 * back cook with a "wrap at 2h" step).
 */
import { describe, it, expect } from "vitest";
import { applyBaselineFloor } from "../multiCook";
import { getMeatBaseline } from "../meatBaselines";

describe("applyBaselineFloor", () => {
  it("raises a light baby back rack baseline to the method floor", () => {
    // 2.3 lbs × 45 mins/lb ≈ 103m — way below any real rib cook.
    expect(applyBaselineFloor("Baby Back Ribs", 103)).toBe(240);
  });

  it("raises a light spare rib baseline to the method floor", () => {
    expect(applyBaselineFloor("Spare Ribs (St. Louis)", 150)).toBe(300);
  });

  it("leaves baselines above the floor untouched", () => {
    expect(applyBaselineFloor("Baby Back Ribs", 320)).toBe(320);
  });

  it("passes through cuts without a floor unchanged", () => {
    expect(applyBaselineFloor("Whole Chicken", 90)).toBe(90);
    expect(applyBaselineFloor("Unknown Mystery Meat", 77)).toBe(77);
  });

  it("returns the floor when no client baseline is provided", () => {
    expect(applyBaselineFloor("Baby Back Ribs", null)).toBe(240);
    expect(applyBaselineFloor("Whole Chicken", null)).toBeNull();
  });
});

describe("rib baseline method consistency", () => {
  it("baby back note cites 2-2-1 and wraps at 2h", () => {
    const b = getMeatBaseline("baby back ribs")!;
    expect(b.wrapNote).toContain("2-2-1");
    expect(b.wrapAtMins).toBe(120);
    expect(b.minCookMins).toBe(240);
  });

  it("spare rib note cites 3-2-1 and wraps at 3h", () => {
    const b = getMeatBaseline("spare ribs")!;
    expect(b.wrapNote).toContain("3-2-1");
    expect(b.wrapAtMins).toBe(180);
    expect(b.minCookMins).toBe(300);
  });
});
