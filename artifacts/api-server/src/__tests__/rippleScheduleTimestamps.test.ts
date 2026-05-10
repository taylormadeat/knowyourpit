import { describe, it, expect } from "vitest";
import { rippleScheduleTimestamps } from "../../../../artifacts/knowyourpit/components/cook-detail/utils";
import type { ScheduleItem } from "../../../../artifacts/knowyourpit/components/cook-detail/types";

const BASE_TIME = new Date("2024-01-01T12:00:00Z").getTime();
const HOURS = (h: number) => h * 60 * 60_000;
const MINS = (m: number) => m * 60_000;

function makeItem(overrides: Partial<ScheduleItem> = {}): ScheduleItem {
  return {
    foodType: "brisket",
    meatOnAt: new Date(BASE_TIME).toISOString(),
    wrapAtMinutes: 300,
    wrapTempF: 165,
    estimatedFinishAt: new Date(BASE_TIME + HOURS(10)).toISOString(),
    ...overrides,
  };
}

describe("rippleScheduleTimestamps — wrap step temperature scaling", () => {
  it("no-op when actualWrapTempF is null (skipped by user)", () => {
    const item = makeItem();
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300); // on time
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, null);
    expect(result[0].estimatedFinishAt).toBe(item.estimatedFinishAt);
  });

  it("no-op when actual equals target wrap temp (scale = 1)", () => {
    const item = makeItem({ wrapTempF: 165 });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 165);
    // Remaining after timing-adjusted finish should be unchanged
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(Math.abs(newFinish - origFinish)).toBeLessThan(1000);
  });

  it("actual wrap temp BELOW target → scale > 1 → finish time pushed later", () => {
    const item = makeItem({ wrapTempF: 165, targetTempF: 203 });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300); // on time
    // Actual temp (162) is 3°F below target (165) → meat needs more time
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 162);
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeGreaterThan(origFinish);
  });

  it("actual wrap temp ABOVE target → scale < 1 → finish time pulled earlier", () => {
    const item = makeItem({ wrapTempF: 165, targetTempF: 203 });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    // Actual temp (170) is 5°F above target (165) → meat needs less time
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 170);
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeLessThan(origFinish);
  });

  it("uses item.targetTempF for pull temp over food-type heuristic", () => {
    // Item with a non-brisket foodType but explicit targetTempF
    const item = makeItem({ foodType: "chicken", wrapTempF: 145, targetTempF: 165 });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    // 142°F actual vs 145°F target; pull = 165°F
    // scaleFactor = (165-142)/(165-145) = 23/20 = 1.15 → finish later
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 142);
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeGreaterThan(origFinish);
  });

  it("temp scaling applies for temp-triggered wraps (wrapAtMinutes = 0)", () => {
    // Temp-triggered wrap: user set wrapTempF but no clock-based wrapAtMinutes
    const item = makeItem({ wrapAtMinutes: 0, wrapTempF: 165, targetTempF: 203 });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    // 160°F below target → should still scale up finish time
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 160);
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeGreaterThan(origFinish);
  });

  it("scale factor is clamped to 2.0 on extreme cold wrap temp", () => {
    const item = makeItem({ wrapTempF: 165, targetTempF: 203, estimatedFinishAt: new Date(BASE_TIME + HOURS(5)).toISOString() });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    // Actual temp very low (100°F) would give scale = (203-100)/(203-165) = 103/38 ≈ 2.71 → clamped to 2.0
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 100);
    const remainingMs = new Date(item.estimatedFinishAt!).getTime() - actualWrapMs;
    const maxAllowedFinish = actualWrapMs + remainingMs * 2.0;
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeLessThanOrEqual(maxAllowedFinish + 1000);
  });

  it("scale factor is clamped to 0.5 on extreme hot wrap temp", () => {
    const item = makeItem({ wrapTempF: 165, targetTempF: 203, estimatedFinishAt: new Date(BASE_TIME + HOURS(5)).toISOString() });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    // Actual temp very high (199°F) gives scale = (203-199)/(203-165) = 4/38 ≈ 0.105 → clamped to 0.5
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 199);
    const remainingMs = new Date(item.estimatedFinishAt!).getTime() - actualWrapMs;
    const minAllowedFinish = actualWrapMs + remainingMs * 0.5;
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    expect(newFinish).toBeGreaterThanOrEqual(minAllowedFinish - 1000);
  });

  it("non-brisket/pork item without targetTempF uses 203°F fallback (conservative estimate)", () => {
    // ribs with no explicit targetTempF → fallback is 203°F, not 165°F
    // wrapTempF=165, actual=160, pullTempF=203 → scale = (203-160)/(203-165) = 43/38 ≈ 1.13 → later
    const item = makeItem({ foodType: "ribs", wrapTempF: 165, targetTempF: undefined });
    const schedule = [item];
    const actualWrapMs = BASE_TIME + MINS(300);
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 160);
    const origFinish = new Date(item.estimatedFinishAt!).getTime();
    const newFinish = new Date(result[0].estimatedFinishAt!).getTime();
    // Scale > 1 → finish is pushed later
    expect(newFinish).toBeGreaterThan(origFinish);
    // Verify the scale used was based on pull=203 not pull=165 (if 165 were used, tempRange would be 0 and no adjustment)
    const remainingMs = new Date(item.estimatedFinishAt!).getTime() - actualWrapMs;
    const expectedScale = (203 - 160) / (203 - 165); // ≈ 1.13
    const expectedFinish = actualWrapMs + remainingMs * expectedScale;
    expect(Math.abs(newFinish - expectedFinish)).toBeLessThan(1000);
  });

  it("non-matching item indexes are not mutated", () => {
    const item0 = makeItem();
    const item1 = makeItem({ foodType: "ribs" });
    const schedule = [item0, item1];
    const actualWrapMs = BASE_TIME + MINS(300);
    const result = rippleScheduleTimestamps(schedule, 0, "wrap", actualWrapMs, 160);
    // item1 should be unchanged
    expect(result[1]).toBe(item1);
  });
});
