import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cooksTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights } from "../../lib/smokerCalibration";
import { respondPaywall, userBypassesPaywall } from "../../lib/paywall";
import { getAssessment } from "./shared";

const router: IRouter = Router();

interface HomeInsights {
  pitMasterScore: number;
  scoreLabel: string;
  scoreBreakdown: {
    avgRating: number | null;
    planAccuracy: number | null;
    aiAssessmentScore: number | null;
    cookCount: number;
  };
  tips: string[];
  tipsGeneratedAt: string;
}

const homeInsightsCache = new Map<string, { data: HomeInsights; expiresAt: number }>();

export function clearHomeInsightsCache(userId: string): void {
  homeInsightsCache.delete(`${userId}:pro`);
  homeInsightsCache.delete(`${userId}:free`);
}

function getPitMasterLabel(score: number): string {
  if (score >= 95) return "The BBQ Deity";
  if (score >= 85) return "Grand Poobah of the Pit";
  if (score >= 70) return "The Smoke Whisperer";
  if (score >= 55) return "Lord of the Questionable Bark";
  if (score >= 40) return "Chief Charcoal Excuse Officer";
  if (score >= 25) return "Warden of the Wayward Flame";
  return "The Anointed Fire Hazard";
}

router.get("/ai/smoker-profile", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const insights = await computeSmokerInsights(req.userId);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute smoker profile" });
  }
});

router.get("/ai/home-insights", requireAuth, async (req: any, res): Promise<void> => {
  // Score computation is free for everyone — it's pure math from their cook data.
  // AI tips (OpenAI call) are Pro-only. isProUser gates that section below.
  const isProUser = await userBypassesPaywall(req);

  try {
    const cacheKey = `${req.userId}:${isProUser ? "pro" : "free"}`;
    const cached = homeInsightsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const cooks = await db
      .select()
      .from(cooksTable)
      .where(and(eq(cooksTable.userId, req.userId), eq(cooksTable.status, "completed")))
      .orderBy(desc(cooksTable.createdAt))
      .limit(50);

    const cookCount = cooks.length;

    const rated = cooks.filter((c) => c.rating != null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length
        : null;
    const avgRatingScore = avgRating != null ? (avgRating / 5) * 100 : null;

    const accuracies: number[] = [];
    for (const c of cooks) {
      if (!c.plannedStartAt || !c.plannedEndAt || !c.actualEndAt) continue;
      // For frozen cooks actualStartAt is the thaw start, which can be 24+ hours
      // before plannedStartAt (the grill preheat). Use meatOnAt from the sequence
      // so both anchors refer to when active cooking began.
      const frozenMeatOnAt: string | null = c.fromFrozen
        ? ((c.sequenceData as any)?.schedule?.[0]?.meatOnAt ?? null)
        : null;
      const effectiveActualStart = frozenMeatOnAt ?? c.actualStartAt;
      if (!effectiveActualStart) continue;
      const planned =
        new Date(c.plannedEndAt).getTime() - new Date(c.plannedStartAt).getTime();
      const actual =
        new Date(c.actualEndAt).getTime() - new Date(effectiveActualStart).getTime();
      if (planned < 5 * 60 * 1000) continue;
      const deviationPct = (Math.abs(actual - planned) / planned) * 100;
      accuracies.push(Math.max(0, Math.round(100 - deviationPct)));
    }
    const planAccuracy =
      accuracies.length > 0
        ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
        : null;

    const VERDICT_SCORE: Record<string, number> = {
      perfect: 100,
      good: 75,
      needs_work: 50,
      overcooked: 25,
      undercooked: 25,
    };
    const verdictScores: number[] = [];
    for (const c of cooks) {
      const verdict = getAssessment(c.analysisResult)?.verdict;
      if (verdict && VERDICT_SCORE[verdict] !== undefined) {
        verdictScores.push(VERDICT_SCORE[verdict]);
      }
    }
    const aiAssessmentScore =
      verdictScores.length > 0
        ? Math.round(verdictScores.reduce((s, v) => s + v, 0) / verdictScores.length)
        : null;

    const placementToScore = (placement: number): number => {
      if (placement === 0) return 50;
      if (placement === 1) return 100;
      if (placement === 2) return 92;
      if (placement === 3) return 85;
      if (placement <= 5) return 78;
      if (placement <= 10) return 70;
      if (placement <= 20) return 60;
      return 50;
    };
    // Judge score quality: use sub-scores if available, normalized per-dimension then averaged.
    // KCBS caps: Appearance=60, Taste=150, Texture=150. Each is normalized to 0–100 and averaged
    // so that no single dimension dominates even though their raw ranges differ.
    // Fallback: use total judgeScore/360*100 for legacy single-score cooks.
    const judgeQualityScores: number[] = [];
    for (const c of cooks) {
      if (!c.isCompetition) continue;
      const hasSubScores = c.judgeScoreAppearance != null || c.judgeScoreTaste != null || c.judgeScoreTexture != null;
      if (hasSubScores) {
        const normScores: number[] = [];
        if (c.judgeScoreAppearance != null) normScores.push(Math.min(100, (c.judgeScoreAppearance / 60) * 100));
        if (c.judgeScoreTaste != null) normScores.push(Math.min(100, (c.judgeScoreTaste / 150) * 100));
        if (c.judgeScoreTexture != null) normScores.push(Math.min(100, (c.judgeScoreTexture / 150) * 100));
        const avg = normScores.reduce((a, b) => a + b, 0) / normScores.length;
        judgeQualityScores.push(Math.round(avg));
      } else if (c.judgeScore != null) {
        judgeQualityScores.push(Math.min(100, Math.round((c.judgeScore / 360) * 100)));
      }
    }
    const judgeQualityScore = judgeQualityScores.length > 0
      ? Math.round(judgeQualityScores.reduce((s, v) => s + v, 0) / judgeQualityScores.length)
      : null;

    const placementScores: number[] = [];
    for (const c of cooks) {
      if (c.isCompetition && c.competitionPlacement != null) {
        placementScores.push(placementToScore(c.competitionPlacement));
      }
    }
    const competitionScore =
      placementScores.length > 0
        ? Math.round(placementScores.reduce((s, v) => s + v, 0) / placementScores.length)
        : null;
    // Blend placement score with judge quality score when both are available
    const blendedCompetitionScore = (() => {
      if (competitionScore == null && judgeQualityScore == null) return null;
      if (competitionScore == null) return judgeQualityScore!;
      if (judgeQualityScore == null) return competitionScore;
      return Math.round(competitionScore * 0.65 + judgeQualityScore * 0.35);
    })();

    let weightedSum = 0;
    let totalWeight = 0;
    if (blendedCompetitionScore != null) {
      weightedSum += blendedCompetitionScore * 0.5; totalWeight += 0.5;
      if (avgRatingScore != null) { weightedSum += avgRatingScore * 0.15; totalWeight += 0.15; }
      if (planAccuracy != null) { weightedSum += planAccuracy * 0.25; totalWeight += 0.25; }
      if (aiAssessmentScore != null) { weightedSum += aiAssessmentScore * 0.1; totalWeight += 0.1; }
    } else {
      if (avgRatingScore != null) { weightedSum += avgRatingScore * 0.4; totalWeight += 0.4; }
      if (planAccuracy != null) { weightedSum += planAccuracy * 0.4; totalWeight += 0.4; }
      if (aiAssessmentScore != null) { weightedSum += aiAssessmentScore * 0.2; totalWeight += 0.2; }
    }
    const pitMasterScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    let tips: string[] = [];
    if (cookCount >= 2 && isProUser) {
      const summaryLines = cooks.slice(0, 12).map((c) => {
        const parts = [c.foodType || "unknown"];
        if (c.rating) parts.push(`rated ${c.rating}/5`);
        if (c.ratingTenderness) parts.push(`tenderness ${c.ratingTenderness}/5`);
        if (c.ratingBark) parts.push(`bark ${c.ratingBark}/5`);
        if (c.ratingFlavor) parts.push(`flavor ${c.ratingFlavor}/5`);
        const assessment = getAssessment(c.analysisResult);
        if (assessment?.verdict) parts.push(`verdict: "${assessment.verdict}"`);
        if (assessment?.suggestions?.[0]) parts.push(`tip given: "${assessment.suggestions[0]}"`);
        return `- ${parts.join(", ")}`;
      });

      const prompt = `You are PitMaster, a seasoned pit master and trusted friend coaching this user. You've just looked at their cook history. Write exactly 3 short tips to help them improve — speak directly to them like you're standing at the pit together. Each tip must be 1–2 sentences, specific to their actual patterns — reference their food types, ratings, or recurring issues by name. No generic advice. No bullet points or numbering — just the tip text. Sentence fragments are fine. Never use: "great question", "certainly", "I'd be happy to", "as an AI", "please note".

Cook history:
${summaryLines.join("\n")}

Respond ONLY with a JSON array of exactly 3 strings: ["tip1", "tip2", "tip3"]`;

      try {
        const aiRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        });
        const text = aiRes.choices[0]?.message?.content ?? "[]";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) tips = parsed.slice(0, 3);
        }
      } catch { /* fall through to defaults */ }
    }

    if (tips.length === 0) {
      if (avgRating != null && avgRating < 3.5) {
        tips.push("Focus on nailing internal temp — it's the single biggest factor in your ratings.");
      }
      if (planAccuracy != null && planAccuracy < 70) {
        tips.push("Your cooks tend to run over plan — build in a 20% time buffer when serving guests.");
      }
      tips.push("Keep rating every cook. PitMaster gets more accurate and personal with each entry.");
      tips = tips.slice(0, 3);
    }

    const result: HomeInsights = {
      pitMasterScore,
      scoreLabel: getPitMasterLabel(pitMasterScore),
      scoreBreakdown: { avgRating, planAccuracy, aiAssessmentScore, cookCount },
      tips,
      tipsGeneratedAt: new Date().toISOString(),
    };

    homeInsightsCache.set(cacheKey, {
      data: result,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute home insights" });
  }
});

export default router;
