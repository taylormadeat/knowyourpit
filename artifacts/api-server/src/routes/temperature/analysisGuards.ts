import { isDirectHeat } from "../../lib/grillClassify";

export interface AnalysisAssessment {
  verdict: string;
  summary: string;
  whatWentWell: string[];
  suggestions: string[];
}

const LOW_AND_SLOW_ADVICE = /\bstall\b|\bwrap(?:ped|ping)?\b|texas crutch|low[\s-]+(?:and|&)[\s-]+slow|\b(?:225|250)\s*(?:°|degrees)?\s*f\b/i;

export function isHighHeatAnalysisMethod(method: string | null | undefined): boolean {
  return isDirectHeat(method);
}

export function containsLowAndSlowAdvice(text: string): boolean {
  return LOW_AND_SLOW_ADVICE.test(text);
}

function isChicken(foodType: string | null | undefined): boolean {
  return /\bchicken\b/i.test(foodType ?? "");
}

/**
 * A chicken breast can carry over several degrees after it leaves a hot grill.
 * Keep a normal finish near the planned target from being rewritten as an
 * overcook by a generic model baseline.
 */
export function normalizeHotFastChickenVerdict(input: {
  verdict: string;
  cookingMethod?: string | null;
  foodType?: string | null;
  targetTempF?: number | null;
  finalTempF?: number | null;
}): string {
  if (
    input.verdict !== "overcooked" ||
    !isHighHeatAnalysisMethod(input.cookingMethod) ||
    !isChicken(input.foodType) ||
    input.finalTempF == null
  ) {
    return input.verdict;
  }

  const target = input.targetTempF ?? 165;
  const delta = input.finalTempF - target;
  // A reading from 5°F below through 10°F above target is still a normal
  // near-target chicken finish; the upper band covers carryover.
  if (delta >= -5 && delta <= 10) return delta <= 5 ? "perfect" : "good";
  return input.verdict;
}

export function applyMethodAwareAssessmentGuard(input: {
  assessment: AnalysisAssessment;
  cookingMethod?: string | null;
  foodType?: string | null;
  targetTempF?: number | null;
  finalTempF?: number | null;
}): AnalysisAssessment {
  const highHeat = isHighHeatAnalysisMethod(input.cookingMethod);
  const verdict = normalizeHotFastChickenVerdict({
    verdict: input.assessment.verdict,
    cookingMethod: input.cookingMethod,
    foodType: input.foodType,
    targetTempF: input.targetTempF,
    finalTempF: input.finalTempF,
  });
  const target = input.targetTempF ?? (isChicken(input.foodType) ? 165 : null);
  const finalTemp = input.finalTempF;

  let summary = input.assessment.summary;
  if (verdict !== input.assessment.verdict && finalTemp != null && target != null) {
    summary = `Chicken finished at ${finalTemp}°F against the planned ${target}°F target; normal carryover is expected.`;
  }

  const suggestions = highHeat
    ? input.assessment.suggestions.filter((suggestion) => !containsLowAndSlowAdvice(suggestion))
    : input.assessment.suggestions;

  if (highHeat && suggestions.length === 0) {
    const method = input.cookingMethod?.trim() || "high-heat";
    const targetText = target != null ? ` and pull at ${target}°F` : "";
    suggestions.push(`For your next cook, keep the planned ${method} method${targetText} and judge doneness by the internal reading.`);
  }

  return {
    ...input.assessment,
    verdict,
    summary,
    suggestions,
  };
}