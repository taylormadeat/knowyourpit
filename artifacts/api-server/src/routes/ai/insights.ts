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
  homeInsightsCache.delete(userId);
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
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "home_insights",
      message: "AI Home Insights are a Pro feature. Upgrade to see your PitMaster Score and personalized tips.",
    });
    return;
  }

  try {
    const cached = homeInsightsCache.get(req.userId);
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
      if (!c.plannedStartAt || !c.plannedEndAt || !c.actualStartAt || !c.actualEndAt) continue;
      const planned =
        new Date(c.plannedEndAt).getTime() - new Date(c.plannedStartAt).getTime();
      const actual =
        new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime();
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

    let weightedSum = 0;
    let totalWeight = 0;
    if (competitionScore != null) {
      weightedSum += competitionScore * 0.5; totalWeight += 0.5;
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
    if (cookCount >= 2) {
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

      const prompt = `You are PitMaster AI, a BBQ expert coach. Based on this pitmaster's cook history, write exactly 3 short tips to help them improve. Each tip must be 1–2 sentences, specific to their patterns — reference their actual food types, ratings, or recurring issues. No generic advice. No bullet points or numbering — just the tip text.

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

    homeInsightsCache.set(req.userId, {
      data: result,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute home insights" });
  }
});

export default router;
