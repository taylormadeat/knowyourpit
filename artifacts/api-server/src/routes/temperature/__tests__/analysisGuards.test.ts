import { describe, expect, it } from "vitest";
import { buildMethodAwareAnalysisContext } from "../analyzePrompt";
import {
  applyMethodAwareAssessmentGuard,
  normalizeHotFastChickenVerdict,
} from "../analysisGuards";
import { computeHeuristics, detectPhase } from "../shared";

describe("hot-and-fast analysis guards", () => {
  it("classifies the planned method as authoritative high heat in analysis context", () => {
    const context = buildMethodAwareAnalysisContext({
      cookingMethod: "Hot & Fast",
      foodType: "Chicken Breast",
      cookTempF: 307,
      targetTempF: 165,
    }).join("\n");

    expect(context).toContain("Planned cooking method: Hot & Fast");
    expect(context).toContain("307°F");
    expect(context).toContain("165°F");
    expect(context).toMatch(/do not substitute a 225°F low-and-slow baseline/i);
    expect(context).toMatch(/carryover up to 10°F/i);
  });

  it("does not create a stall phase or stall estimate for a hot-and-fast cook", () => {
    expect(detectPhase(0.05, 150, 165, "Hot & Fast")).toBe("finishing");
    expect(computeHeuristics("finishing", 150, 0.05, 165, 1, 307, "Hot & Fast")).toEqual({
      timeToStallMinutes: null,
      stallDurationMinutes: null,
      timeToFinishMinutes: 15,
    });
  });

  it("rewrites an AI overcooked verdict when chicken is within normal carryover", () => {
    expect(normalizeHotFastChickenVerdict({
      verdict: "overcooked",
      cookingMethod: "Hot & Fast",
      foodType: "Chicken Breast",
      targetTempF: 165,
      finalTempF: 170,
    })).toBe("perfect");

    const guarded = applyMethodAwareAssessmentGuard({
      assessment: {
        verdict: "overcooked",
        summary: "Too hot.",
        whatWentWell: [],
        suggestions: ["Next time use 225°F and wrap through the stall."],
      },
      cookingMethod: "Hot & Fast",
      foodType: "Chicken Breast",
      targetTempF: 165,
      finalTempF: 170,
    });

    expect(guarded.verdict).toBe("perfect");
    expect(guarded.summary).toContain("normal carryover");
    expect(guarded.suggestions.join(" ")).not.toMatch(/225|wrap|stall/i);
  });
});