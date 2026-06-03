export function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#F59E0B";
  return "#E84820";
}

export function letterGrade(score: number): string {
  if (score >= 97) return "A+";
  if (score >= 93) return "A";
  if (score >= 90) return "A-";
  if (score >= 87) return "B+";
  if (score >= 83) return "B";
  if (score >= 80) return "B-";
  if (score >= 77) return "C+";
  if (score >= 73) return "C";
  if (score >= 70) return "C-";
  if (score >= 67) return "D+";
  if (score >= 63) return "D";
  if (score >= 60) return "D-";
  return "F";
}

export const VERDICT_SCORE: Record<string, number> = {
  perfect: 100,
  good: 75,
  needs_work: 50,
  overcooked: 25,
  undercooked: 25,
};

const GRADE_LETTER_COLORS: Record<string, { color: string; bgColor: string }> = {
  A: { color: "#22c55e", bgColor: "#22c55e22" },
  B: { color: "#84cc16", bgColor: "#84cc1622" },
  C: { color: "#F59E0B", bgColor: "#F59E0B22" },
  D: { color: "#F97316", bgColor: "#F9731622" },
  F: { color: "#EF4444", bgColor: "#EF444422" },
};

export function gradeChipColors(grade: string): { color: string; bgColor: string } {
  const baseLetter = grade.charAt(0).toUpperCase();
  return GRADE_LETTER_COLORS[baseLetter] ?? { color: "#F59E0B", bgColor: "#F59E0B22" };
}

// Maps a stored health letter grade to its representative numeric score.
// The server stores simple A/B/C/D/F grades; +/- variants are supported for
// grades derived from letterGrade() so the function is forward-compatible.
const HEALTH_GRADE_SCORE: Record<string, number> = {
  "A+": 98, A: 95, "A-": 91,
  "B+": 88, B: 82, "B-": 81,
  "C+": 78, C: 73, "C-": 71,
  "D+": 68, D: 64, "D-": 61,
  F: 20,
};

/**
 * Compute the overall cook grade by blending the process health score (30%)
 * with the user's star rating (70%).  Either signal can be absent — the grade
 * falls back to whichever is available.  Returns null when neither exists.
 *
 * @param healthGrade  Stored letter grade (A–F, optional +/-) or null
 * @param rating       Star rating 1–5 or null
 */
export function computeOverallGrade(
  healthGrade: string | null | undefined,
  rating: number | null | undefined,
): string | null {
  const healthScore =
    healthGrade != null
      ? (HEALTH_GRADE_SCORE[healthGrade] ?? HEALTH_GRADE_SCORE[healthGrade.charAt(0).toUpperCase()] ?? null)
      : null;

  // 1 star = 20, 2 = 40, … 5 = 100
  const ratingScore =
    rating != null && rating > 0
      ? Math.min(100, Math.max(0, Math.round(rating * 20)))
      : null;

  if (healthScore === null && ratingScore === null) return null;

  let blended: number;
  if (healthScore !== null && ratingScore !== null) {
    blended = 0.3 * healthScore + 0.7 * ratingScore;
  } else if (healthScore !== null) {
    blended = healthScore;
  } else {
    blended = ratingScore!;
  }

  return letterGrade(Math.round(blended));
}
