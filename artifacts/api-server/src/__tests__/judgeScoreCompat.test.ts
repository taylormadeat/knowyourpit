import { describe, it, expect } from "vitest";

/**
 * Unit tests for the server-side judgeScore backward-compatibility rules.
 *
 * The core invariant (mirrored from routes/cooks.ts):
 * - If NO sub-score key is present in the update payload, judgeScore is NOT recomputed —
 *   the existing legacy total is preserved by the DB update (field not in SET clause).
 * - If ANY sub-score key is present, judgeScore is recomputed from the merged values
 *   (incoming ?? existing), so stale totals cannot diverge from sub-scores.
 * - If ALL sub-scores resolve to null after merge, judgeScore is explicitly cleared to null.
 */

function simulateJudgeScoreDerivation(
  updateData: Record<string, number | null | undefined>,
  existing: { a: number | null; t: number | null; x: number | null },
): Record<string, number | null | undefined> {
  const hasSubScoreUpdate =
    "judgeScoreAppearance" in updateData ||
    "judgeScoreTaste" in updateData ||
    "judgeScoreTexture" in updateData;

  if (!hasSubScoreUpdate) return updateData; // legacy judgeScore untouched by DB update

  const incomingApp = "judgeScoreAppearance" in updateData
    ? (updateData.judgeScoreAppearance as number | null)
    : existing.a;
  const incomingTaste = "judgeScoreTaste" in updateData
    ? (updateData.judgeScoreTaste as number | null)
    : existing.t;
  const incomingTexture = "judgeScoreTexture" in updateData
    ? (updateData.judgeScoreTexture as number | null)
    : existing.x;

  if (incomingApp != null || incomingTaste != null || incomingTexture != null) {
    return { ...updateData, judgeScore: (incomingApp ?? 0) + (incomingTaste ?? 0) + (incomingTexture ?? 0) };
  }
  return { ...updateData, judgeScore: null };
}

describe("judgeScore backward-compatibility (PATCH /cooks/:id)", () => {
  it("(a) legacy-only: no sub-score keys → judgeScore NOT recomputed", () => {
    const result = simulateJudgeScoreDerivation(
      { competitionPlacement: 3 },
      { a: null, t: null, x: null },
    );
    expect("judgeScore" in result).toBe(false);
  });

  it("(b) partial sub-score update: only appearance updated → merges with existing", () => {
    const result = simulateJudgeScoreDerivation(
      { judgeScoreAppearance: 54 },
      { a: 50, t: 138, x: 141 },
    );
    expect(result.judgeScore).toBe(54 + 138 + 141);
  });

  it("(c) explicit clearing of all sub-scores → judgeScore set to null", () => {
    const result = simulateJudgeScoreDerivation(
      { judgeScoreAppearance: null, judgeScoreTaste: null, judgeScoreTexture: null },
      { a: 50, t: 138, x: 141 },
    );
    expect(result.judgeScore).toBeNull();
  });

  it("(d) full sub-score set → canonical total computed", () => {
    const result = simulateJudgeScoreDerivation(
      { judgeScoreAppearance: 54, judgeScoreTaste: 140, judgeScoreTexture: 145 },
      { a: null, t: null, x: null },
    );
    expect(result.judgeScore).toBe(339);
  });

  it("(e) client saves with no sub-scores (legacy modal open+save) → does not overwrite judgeScore", () => {
    // Simulates the client sending only placement/teamCount — no sub-score keys at all.
    const clientPayload: Record<string, number | null | undefined> = {
      competitionPlacement: 2,
      competitionTeamCount: 45,
      judgeNotes: null,
    };
    const result = simulateJudgeScoreDerivation(clientPayload, { a: null, t: null, x: null });
    expect("judgeScore" in result).toBe(false);
  });
});
