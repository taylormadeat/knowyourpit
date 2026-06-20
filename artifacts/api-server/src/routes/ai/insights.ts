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
    avgHealthScore: number | null;
    cookCount: number;
  };
  unratedCount: number;
}

// Map stored letter grade to a representative numeric score (midpoint of each band)
const HEALTH_GRADE_SCORE: Record<string, number> = {
  A: 95, B: 82, C: 67, D: 52, F: 22,
};

// Score cache — pure DB math, cheap to recompute, but cache to avoid redundant
// queries on rapid tab switches. Short TTL since ratings change frequently.
const scoreCache = new Map<string, { data: HomeInsights; expiresAt: number }>();

// Tips cache — expensive (OpenAI call). 4-hour TTL per user.
const tipsCache = new Map<string, { tips: string[]; expiresAt: number }>();

export function clearHomeInsightsCache(userId: string): void {
  scoreCache.delete(userId);
  tipsCache.delete(`${userId}:pro`);
  tipsCache.delete(`${userId}:free`);
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

// ── Score endpoint — pure DB math, responds in <50ms ─────────────────────────
router.get("/ai/home-insights", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const cached = scoreCache.get(req.userId);
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
    const unratedCount = cooks.filter((c) => c.rating == null).length;

    const rated = cooks.filter((c) => c.rating != null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length
        : null;
    const avgRatingScore = avgRating != null ? (avgRating / 5) * 100 : null;

    const healthScores = cooks
      .filter((c) => c.healthScore != null)
      .map((c) => HEALTH_GRADE_SCORE[c.healthScore!])
      .filter((s): s is number => s != null);
    const avgHealthScore = healthScores.length > 0
      ? Math.round(healthScores.reduce((s, v) => s + v, 0) / healthScores.length)
      : null;

    let weightedSum = 0;
    let totalWeight = 0;
    if (avgHealthScore != null) { weightedSum += avgHealthScore  * 0.30; totalWeight += 0.30; }
    if (avgRatingScore != null) { weightedSum += avgRatingScore  * 0.70; totalWeight += 0.70; }
    const pitMasterScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    const result: HomeInsights = {
      pitMasterScore,
      scoreLabel: getPitMasterLabel(pitMasterScore),
      scoreBreakdown: { avgRating, avgHealthScore, cookCount },
      unratedCount,
    };

    // 15-minute cache — short TTL since ratings change often
    scoreCache.set(req.userId, {
      data: result,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute home insights" });
  }
});

// ── Tips endpoint — AI call, only hit when the user opens the tips panel ──────
router.get("/ai/home-insights/tips", requireAuth, async (req: any, res): Promise<void> => {
  const isProUser = await userBypassesPaywall(req);

  // Non-Pro users never get tips; return empty array immediately.
  if (!isProUser) {
    res.json({ tips: [] });
    return;
  }

  try {
    const cacheKey = `${req.userId}:pro`;
    const cached = tipsCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.json({ tips: cached.tips });
      return;
    }

    const cooks = await db
      .select()
      .from(cooksTable)
      .where(and(eq(cooksTable.userId, req.userId), eq(cooksTable.status, "completed")))
      .orderBy(desc(cooksTable.createdAt))
      .limit(50);

    const cookCount = cooks.length;

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

      const prompt = `You are PitMaster, a seasoned pit master and trusted friend coaching this user. You've just looked at their cook history. Write exactly 3 short tips to help them improve — speak directly to them like you're standing at the pit together. Each tip must be 1–2 sentences, specific to their actual patterns — reference their food types, ratings, or recurring issues by name. No generic advice. No bullet points or numbering — just the tip text. Sentence fragments are fine. Never use: "great question", "certainly", "I'd be happy to", "as an AI", "please note".

Cook history:
${summaryLines.join("\n")}

Respond ONLY with a JSON array of exactly 3 strings: ["tip1", "tip2", "tip3"]`;

      try {
        const aiRes = await openai.chat.completions.create({
          model: "gpt-5-mini",
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

    // Fallback static tips when AI fails or user has <2 cooks
    if (tips.length === 0) {
      const rated = cooks.filter((c) => c.rating != null);
      const avgRating = rated.length > 0
        ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length
        : null;
      const healthScores = cooks
        .filter((c) => c.healthScore != null)
        .map((c) => HEALTH_GRADE_SCORE[c.healthScore!])
        .filter((s): s is number => s != null);
      const avgHealthScore = healthScores.length > 0
        ? Math.round(healthScores.reduce((s, v) => s + v, 0) / healthScores.length)
        : null;

      if (avgRating != null && avgRating < 3.5) {
        tips.push("Focus on nailing internal temp — it's the single biggest factor in your ratings.");
      }
      if (avgHealthScore != null && avgHealthScore < 65) {
        tips.push("Your cook health scores suggest process issues — watch for pit drift, flare-ups, and late check-ins.");
      }
      tips.push("Keep rating every cook. PitMaster gets more accurate and personal with each entry.");
      tips = tips.slice(0, 3);
    }

    tipsCache.set(cacheKey, {
      tips,
      expiresAt: Date.now() + 4 * 60 * 60 * 1000,
    });

    res.json({ tips });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate tips" });
  }
});

export default router;
