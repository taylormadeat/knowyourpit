import { describe, it, expect } from "vitest";
import { computePercentile } from "../../../../artifacts/knowyourpit/constants/competitionKnowledge";

describe("computePercentile (real implementation from competitionKnowledge.ts)", () => {
  it("returns null for invalid inputs", () => {
    expect(computePercentile(0, 67)).toBeNull();
    expect(computePercentile(1, 1)).toBeNull();
    expect(computePercentile(-1, 67)).toBeNull();
  });

  it("1st of 67 → Top 2%", () => {
    expect(computePercentile(1, 67)).toBe("Top 2% of 67 teams");
  });

  it("8th of 67 → Top 12% (spec example)", () => {
    expect(computePercentile(8, 67)).toBe("Top 12% of 67 teams");
  });

  it("1st of any field is always a small percentage", () => {
    const result = computePercentile(1, 100)!;
    const pct = parseInt(result.match(/Top (\d+)%/)![1]);
    expect(pct).toBeLessThanOrEqual(5);
  });

  it("last place is Top 100%", () => {
    expect(computePercentile(67, 67)).toBe("Top 100% of 67 teams");
  });

  it("mid-field placement gives expected range", () => {
    const result = computePercentile(33, 67)!;
    const pct = parseInt(result.match(/Top (\d+)%/)![1]);
    expect(pct).toBeGreaterThanOrEqual(45);
    expect(pct).toBeLessThanOrEqual(55);
  });
});
