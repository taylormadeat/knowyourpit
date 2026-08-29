import {
  canCompleteScheduleAutoScroll,
  shouldHandleScheduleStep,
} from "../utils";

describe("live cook schedule update guards", () => {
  it("handles an active schedule step only once per identity", () => {
    expect(shouldHandleScheduleStep(null, "0:meatOn", "active")).toBe(true);
    expect(shouldHandleScheduleStep("0:meatOn", "0:meatOn", "active")).toBe(false);
    expect(shouldHandleScheduleStep("0:meatOn", "0:wrap", "active")).toBe(true);
    expect(shouldHandleScheduleStep(null, "0:meatOn", "completed")).toBe(false);
  });

  it("does not complete an automatic scroll during or just after manual scrolling", () => {
    const now = 10_000;
    expect(canCompleteScheduleAutoScroll(true, 0, now)).toBe(false);
    expect(canCompleteScheduleAutoScroll(false, now - 500, now)).toBe(false);
    expect(canCompleteScheduleAutoScroll(false, now - 1_500, now)).toBe(true);
  });
});