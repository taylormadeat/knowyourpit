import { describe, expect, it } from "vitest";
import { computeCookHealthScore, isCookHealthOutlierPendingReview } from "../cookEvents";

function checkin(overrides: Record<string, unknown> = {}) {
  return {
    internalTempF: 150,
    pitTempF: 250,
    statusFlag: null,
    phaseKey: null,
    scheduledAt: null,
    firedAt: null,
    ...overrides,
  } as any;
}

describe("computeCookHealthScore", () => {
  it("keeps a cook under review when it has no scoring evidence", () => {
    const result = computeCookHealthScore({
      checkins: [],
      events: [],
      cookTempF: null,
    });

    expect(result.grade).toBeNull();
    expect(result.reason).toContain("under review");
  });

  it("does not turn an unsupported negative AI verdict into an F", () => {
    const result = computeCookHealthScore({
      checkins: [],
      events: [],
      cookTempF: null,
      verdict: "undercooked",
    });

    expect(result.grade).toBeNull();
    expect(result.reason).toContain("may be undercooked");
    expect(result.factors.aiVerdict).toBe("undercooked");
  });

  it("keeps an AI-only positive assessment as a normal grade", () => {
    const result = computeCookHealthScore({
      checkins: [],
      events: [],
      cookTempF: null,
      verdict: "good",
    });

    expect(result.grade).toBe("B");
  });

  it("allows an F when several recorded issues corroborate a negative verdict", () => {
    const result = computeCookHealthScore({
      checkins: [checkin(), checkin()],
      events: [
        { eventType: "flare_up" },
        { eventType: "fuel_low" },
        { eventType: "flare_up" },
        { eventType: "fuel_low" },
      ] as any,
      cookTempF: 250,
      verdict: "overcooked",
    });

    expect(result.grade).toBe("F");
    expect(result.factors.issueCount).toBe(4);
  });

  it("allows an F for a major plan miss corroborating a negative verdict", () => {
    const result = computeCookHealthScore({
      checkins: [],
      events: [],
      cookTempF: null,
      verdict: "undercooked",
      planAccuracyScore: 0,
    });

    expect(result.grade).toBe("F");
    expect(result.factors.planAccuracyScore).toBe(0);
  });

  it("keeps an undismissed outlier in review and restores scoring after dismissal", () => {
    expect(isCookHealthOutlierPendingReview(true, false)).toBe(true);
    expect(isCookHealthOutlierPendingReview(true, true)).toBe(false);
    expect(isCookHealthOutlierPendingReview(false, false)).toBe(false);
  });
});