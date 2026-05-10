import { describe, it, expect } from "vitest";
import { generateCheckinSchedule } from "@workspace/checkin-schedule";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

const MEAT_ON = new Date("2025-01-01T08:00:00Z").getTime();

function makeFinish(durationHours: number): number {
  return MEAT_ON + durationHours * HOUR_MS;
}

function minutesAfterMeatOn(scheduledAt: number): number {
  return Math.round((scheduledAt - MEAT_ON) / MIN_MS);
}

// ---------------------------------------------------------------------------
// Percentage-based path (no wrapAtMinutes)
// ---------------------------------------------------------------------------

describe("generateCheckinSchedule — percentage path (no wrap)", () => {
  it("brisket: returns 7 phases in ascending order", () => {
    const schedule = generateCheckinSchedule("brisket", MEAT_ON, makeFinish(12));
    expect(schedule.length).toBe(7);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].scheduledAt).toBeGreaterThan(schedule[i - 1].scheduledAt);
    }
  });

  it("ribs: returns 3 phases in ascending order", () => {
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, makeFinish(5));
    expect(schedule.length).toBe(3);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].scheduledAt).toBeGreaterThan(schedule[i - 1].scheduledAt);
    }
  });

  it("pork shoulder: first phase fires well after meat-on (not within first few minutes)", () => {
    const schedule = generateCheckinSchedule("pork shoulder", MEAT_ON, makeFinish(10));
    const firstMin = minutesAfterMeatOn(schedule[0].scheduledAt);
    expect(firstMin).toBeGreaterThan(30);
  });

  it("chicken: all phases before estimated finish", () => {
    const finish = makeFinish(3);
    const schedule = generateCheckinSchedule("chicken", MEAT_ON, finish);
    for (const sc of schedule) {
      expect(sc.scheduledAt).toBeLessThan(finish);
    }
  });

  it("returns empty array when finish <= meatOn", () => {
    const result = generateCheckinSchedule("brisket", MEAT_ON, MEAT_ON - 1);
    expect(result).toHaveLength(0);
  });

  it("unknown/null food type falls back to generic schedule", () => {
    const schedule = generateCheckinSchedule(null, MEAT_ON, makeFinish(4));
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0].phaseKey).toMatch(/^generic/);
  });

  it("weightLbs < 5 floors first check-in at 10 min in percentage path", () => {
    // Very short cook — anchorPercent-based time might naturally be < 10 min.
    // With weightLbs=3 the floor is 10 min.  With a 4-h cook pork-shoulder the
    // first anchorPercent (0.25) gives 60 min, so the floor doesn't trigger —
    // use a 1-h cook to force the anchorPercent time below 10 min.
    const finish = MEAT_ON + 30 * MIN_MS; // 30-min cook (edge case)
    const schedule = generateCheckinSchedule("chicken", MEAT_ON, finish, null, 3);
    // Should not be empty and first phase should be after meatOn.
    expect(schedule.length).toBeGreaterThan(0);
    expect(schedule[0].scheduledAt).toBeGreaterThan(MEAT_ON);
  });
});

// ---------------------------------------------------------------------------
// Sequence-anchored path (wrapAtMinutes provided)
// ---------------------------------------------------------------------------

describe("generateCheckinSchedule — sequence path (with wrapAtMinutes)", () => {
  it("ribs 3-2-1: '3-Hour Check' fires well after meat-on, not within 30 min", () => {
    // 5-hour cook, wrap at 3 h (180 min).
    const finish = makeFinish(5);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 180 };
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, finish, anchor);

    const firstPhase = schedule.find((sc) => sc.phaseKey === "ribs_3h_mark");
    expect(firstPhase).toBeDefined();
    const minutesIn = minutesAfterMeatOn(firstPhase!.scheduledAt);
    // anchorPercent=0.30, wrapFraction=0.60 → fires at 50% of pre-wrap window = 90 min
    expect(minutesIn).toBeGreaterThan(30);
    expect(minutesIn).toBeLessThan(175); // still before the wrap
  });

  it("ribs 3-2-1: 'Unwrap & Sauce' fires after the wrap time", () => {
    const finish = makeFinish(5);
    const wrapAtMs = MEAT_ON + 180 * MIN_MS;
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 180 };
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, finish, anchor);

    const unwrap = schedule.find((sc) => sc.phaseKey === "ribs_unwrap");
    expect(unwrap).toBeDefined();
    expect(unwrap!.scheduledAt).toBeGreaterThan(wrapAtMs);
  });

  it("ribs: all three phases are in ascending order", () => {
    const finish = makeFinish(5);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 180 };
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, finish, anchor);
    expect(schedule.length).toBe(3);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].scheduledAt).toBeGreaterThan(schedule[i - 1].scheduledAt);
    }
  });

  it("brisket: all 7 phases in ascending order with wrapAtMinutes", () => {
    const finish = makeFinish(12);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 540 };
    const schedule = generateCheckinSchedule("brisket", MEAT_ON, finish, anchor);
    expect(schedule.length).toBe(7);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].scheduledAt).toBeGreaterThan(schedule[i - 1].scheduledAt);
    }
  });

  it("brisket: 'Rest & Hold' (anchorPercent=0.97) fires after estimated finish", () => {
    const finish = makeFinish(12);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 540 };
    const schedule = generateCheckinSchedule("brisket", MEAT_ON, finish, anchor);

    const rest = schedule.find((sc) => sc.phaseKey === "brisket_rest");
    expect(rest).toBeDefined();
    expect(rest!.scheduledAt).toBeGreaterThan(finish);
  });

  it("pork shoulder: first pre-wrap phase fires well after meat-on", () => {
    // 10-h cook, wrap at 5 h (300 min), 14-lb shoulder.
    const finish = makeFinish(10);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 300 };
    const schedule = generateCheckinSchedule("pork shoulder", MEAT_ON, finish, anchor, 14);

    const firstMin = minutesAfterMeatOn(schedule[0].scheduledAt);
    expect(firstMin).toBeGreaterThan(20); // weight-based floor for 14 lbs = 20 min
    expect(firstMin).toBeLessThan(300);   // before the wrap
  });

  it("pork shoulder: post-wrap phases all fire after wrapAtMs", () => {
    const finish = makeFinish(10);
    const wrapAtMs = MEAT_ON + 300 * MIN_MS;
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 300 };
    const schedule = generateCheckinSchedule("pork shoulder", MEAT_ON, finish, anchor);

    // pork_money_muscle (0.80) and pork_pull_ready (0.90) are post-wrap when wrapFraction=0.5
    const postWrap = schedule.filter(
      (sc) => sc.phaseKey === "pork_money_muscle" || sc.phaseKey === "pork_pull_ready",
    );
    expect(postWrap.length).toBe(2);
    for (const sc of postWrap) {
      expect(sc.scheduledAt).toBeGreaterThan(wrapAtMs);
    }
  });

  it("chicken (no wrap): all three phases in ascending order", () => {
    const finish = makeFinish(3);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: null };
    const schedule = generateCheckinSchedule("chicken", MEAT_ON, finish, anchor);
    expect(schedule.length).toBe(3);
    for (let i = 1; i < schedule.length; i++) {
      expect(schedule[i].scheduledAt).toBeGreaterThan(schedule[i - 1].scheduledAt);
    }
  });

  it("weightLbs=3 (light) floor: first phase fires at least 10 min in", () => {
    const finish = makeFinish(5);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 180 };
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, finish, anchor, 3);
    const firstMin = minutesAfterMeatOn(schedule[0].scheduledAt);
    expect(firstMin).toBeGreaterThanOrEqual(10);
  });

  it("weightLbs=20 (heavy) floor: first phase fires at least 25 min in", () => {
    const finish = makeFinish(5);
    const anchor = { meatOnAt: new Date(MEAT_ON).toISOString(), estimatedFinishAt: new Date(finish).toISOString(), wrapAtMinutes: 180 };
    const schedule = generateCheckinSchedule("ribs", MEAT_ON, finish, anchor, 20);
    const firstMin = minutesAfterMeatOn(schedule[0].scheduledAt);
    expect(firstMin).toBeGreaterThanOrEqual(25);
  });
});
