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
