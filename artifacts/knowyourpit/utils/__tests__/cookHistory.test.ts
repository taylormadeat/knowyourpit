import {
  cookHistoryTimestamp,
  isExplicitMultiCookSession,
} from "@/utils/cookHistory";

describe("cook history visibility", () => {
  it("uses creation time before a planned date so a newly completed cook stays recent", () => {
    expect(cookHistoryTimestamp({
      createdAt: "2030-07-04T17:00:00.000Z",
      plannedStartAt: "2030-06-01T12:00:00.000Z",
    })).toBe(new Date("2030-07-04T17:00:00.000Z").getTime());
  });

  it("falls back to the cook's actual or planned time when creation time is unavailable", () => {
    expect(cookHistoryTimestamp({
      status: "completed",
      actualEndAt: "2030-07-04T17:00:00.000Z",
      plannedStartAt: "2030-06-01T12:00:00.000Z",
    })).toBe(new Date("2030-07-04T17:00:00.000Z").getTime());
  });

  it("uses completion time for an older cook that has just finished", () => {
    expect(cookHistoryTimestamp({
      status: "completed",
      createdAt: "2030-06-01T12:00:00.000Z",
      actualEndAt: "2030-07-04T17:00:00.000Z",
    })).toBe(new Date("2030-07-04T17:00:00.000Z").getTime());
  });

  it("does not hide two ordinary cooks that share an idempotency session ID", () => {
    expect(isExplicitMultiCookSession([
      { sequenceData: { schedule: [{ foodType: "Chicken Breast" }] } },
      { sequenceData: { schedule: [{ foodType: "Chicken Breast" }] } },
    ])).toBe(false);
  });

  it("keeps genuine multi-cook sessions grouped", () => {
    expect(isExplicitMultiCookSession([
      { sequenceData: { type: "multi_cook", schedule: [{ foodType: "Chicken Breast" }] } },
      { sequenceData: { type: "multi_cook", schedule: [{ foodType: "Ribs" }] } },
    ])).toBe(true);
  });
});