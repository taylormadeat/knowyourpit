import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cooksTable, grillsTable, temperatureReadingsTable } from "@workspace/db";
import { AiChatBody, AiPredictBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

const PIT_PROBE_NAMES = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
const isPitProbe = (name: string | null) =>
  name ? PIT_PROBE_NAMES.some(k => name.toLowerCase().includes(k)) : false;

async function buildUserCookHistory(userId: string): Promise<string> {
  const cooks = await db.select().from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .orderBy(desc(cooksTable.createdAt))
    .limit(50);

  if (cooks.length === 0) {
    return "This user has no cook logs yet.";
  }

  // Fetch grill names in one pass
  const grillIds = [...new Set(cooks.map(c => c.grillId).filter(Boolean))] as number[];
  const grills: Record<number, string> = {};
  if (grillIds.length > 0) {
    for (const id of grillIds) {
      const [g] = await db.select({ id: grillsTable.id, name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, id));
      if (g) grills[g.id] = g.name;
    }
  }

  const lines = cooks.map(c => {
    const parts: string[] = [];
    parts.push(c.foodType);
    if (c.weightLbs) parts.push(`${c.weightLbs} lbs`);
    if (c.grillId && grills[c.grillId]) parts.push(`on ${grills[c.grillId]}`);
    if (c.status) parts.push(`[${c.status}]`);
    if (c.cookTempF) parts.push(`cook temp: ${c.cookTempF}°F`);
    if (c.targetTempF) parts.push(`target: ${c.targetTempF}°F`);
    if (c.actualStartAt && c.actualEndAt) {
      const mins = Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000);
      parts.push(`duration: ${mins} min`);
    }
    if (c.rating) parts.push(`rated ${c.rating}/5`);
    if (c.ratingTenderness) parts.push(`tenderness ${c.ratingTenderness}/5`);
    if (c.ratingBark) parts.push(`bark ${c.ratingBark}/5`);
    if (c.ratingFlavor) parts.push(`flavor ${c.ratingFlavor}/5`);
    if (c.wrapMethod && c.wrapMethod !== "none") parts.push(`wrapped: ${c.wrapMethod}`);
    if (c.notes) parts.push(`notes: "${c.notes}"`);
    const date = c.actualStartAt ? new Date(c.actualStartAt).toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : null);
    if (date) parts.push(`date: ${date}`);
    return `- ${parts.join(" · ")}`;
  });

  const total = cooks.length;
  const completed = cooks.filter(c => c.status === "completed").length;
  const rated = cooks.filter(c => c.rating != null);
  const avgRating = rated.length > 0 ? (rated.reduce((s, c) => s + c.rating!, 0) / rated.length).toFixed(1) : null;

  const summary = [
    `User's cook history (${total} total, ${completed} completed${avgRating ? `, avg rating ${avgRating}/5` : ""}):`,
    ...lines,
  ].join("\n");

  return summary;
}

router.post("/ai/chat", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context } = parsed.data;

  const cookHistory = await buildUserCookHistory(req.userId);

  const systemPrompt = `You are PitMaster AI, an expert BBQ assistant and personal pit coach. You help users with BBQ cooking, grilling techniques, temperature guidance, timing predictions, and recipe suggestions. You are knowledgeable about all BBQ styles including Texas BBQ, Carolina BBQ, Kansas City style, and more. Provide practical, specific advice.

You have full access to this user's personal cook logs. Use this data to give personalized advice, reference their past cooks, and help them improve. When relevant, refer to their actual cook history by name and date.

${cookHistory}${context ? `\n\nAdditional context: ${context}` : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message },
    ],
  });

  const reply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't process that request.";

  const suggestions = [
    "How long did my last brisket take?",
    "What's my highest-rated cook?",
    "What should I cook next based on my history?",
    "Which grill do I use most?",
    "How can I improve my bark score?",
    "What temperature should I cook brisket to?",
    "How do I push through the stall?",
    "What wood pairs best with pork ribs?",
  ].sort(() => Math.random() - 0.5).slice(0, 3);

  res.json({ reply, suggestions });
});

router.post("/ai/predict", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = AiPredictBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { grillId, foodType, weightLbs, cookTempF, targetTempF, desiredFinishAt, preheatMinutes: clientPreheatMinutes } = parsed.data;

  let grillContext = "";
  let grillType = "";
  let grillTempContext = "";

  if (grillId) {
    const [grill] = await db.select().from(grillsTable)
      .where(and(eq(grillsTable.id, grillId), eq(grillsTable.userId, req.userId)));
    if (grill) {
      grillContext = `Grill: ${grill.name} (${grill.type}, ${grill.brand || "unknown brand"})`;
      grillType = grill.type;
    }

    const grillReadings = await db.select().from(temperatureReadingsTable)
      .where(eq(temperatureReadingsTable.grillId, grillId));

    if (grillReadings.length > 0) {
      const pitReadings = grillReadings.filter(r => isPitProbe(r.probeName));

      if (pitReadings.length > 0) {
        const avgPit = pitReadings.reduce((s, r) => s + r.tempF, 0) / pitReadings.length;
        const maxPit = Math.max(...pitReadings.map(r => r.tempF));
        const minPit = Math.min(...pitReadings.map(r => r.tempF));

        const byCook: Record<number, number[]> = {};
        for (const r of pitReadings) {
          if (!byCook[r.cookId]) byCook[r.cookId] = [];
          byCook[r.cookId].push(r.tempF);
        }
        const variances = Object.values(byCook).map(t => Math.max(...t) - Math.min(...t));
        const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;

        grillTempContext = `
Grill historical temperature performance (${grillReadings.length} readings across ${Object.keys(byCook).length} cooks):
- Average pit/ambient temperature achieved: ${avgPit.toFixed(1)}°F
- Pit temp range: ${minPit.toFixed(1)}°F – ${maxPit.toFixed(1)}°F
- Average per-cook temperature swing: ±${(avgVariance / 2).toFixed(1)}°F
Note: Factor this grill's real-world temperature behavior into your estimate.`;
      }
    }

    const recentCooksOnGrill = await db.select().from(cooksTable)
      .where(and(
        eq(cooksTable.grillId, grillId),
        eq(cooksTable.status, "completed"),
        eq(cooksTable.userId, req.userId),
      ))
      .orderBy(desc(cooksTable.actualEndAt))
      .limit(10);

    if (recentCooksOnGrill.length > 0) {
      const recentCookIds = recentCooksOnGrill.map(c => c.id);
      const recentReadings = await db.select().from(temperatureReadingsTable)
        .where(eq(temperatureReadingsTable.grillId, grillId));

      const peakProbeByCook: Record<number, number> = {};
      for (const r of recentReadings) {
        if (!recentCookIds.includes(r.cookId)) continue;
        if (isPitProbe(r.probeName)) continue;
        if (peakProbeByCook[r.cookId] == null || r.tempF > peakProbeByCook[r.cookId]) {
          peakProbeByCook[r.cookId] = r.tempF;
        }
      }

      const allCookSummaries = recentCooksOnGrill.map(c => {
        const durationMins = c.actualStartAt && c.actualEndAt
          ? Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000)
          : null;
        const peakTemp = peakProbeByCook[c.id] != null ? ` · peak ${peakProbeByCook[c.id]}°F` : "";
        return `${c.foodType}${c.weightLbs ? ` (${c.weightLbs} lbs)` : ""}${durationMins ? ` → ${durationMins} min` : ""}${peakTemp}${c.rating ? ` · rated ${c.rating}/5` : ""}`;
      });

      const firstWord = foodType.toLowerCase().split(" ")[0];
      const similarCooks = recentCooksOnGrill.filter(c =>
        c.foodType.toLowerCase().includes(firstWord)
      );
      const similarSummaries = similarCooks.map(c => {
        const durationMins = c.actualStartAt && c.actualEndAt
          ? Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000)
          : null;
        const peakTemp = peakProbeByCook[c.id] != null ? ` · peak ${peakProbeByCook[c.id]}°F` : "";
        return `${c.foodType}${c.weightLbs ? ` (${c.weightLbs} lbs)` : ""}${durationMins ? ` → ${durationMins} min` : ""}${peakTemp}${c.rating ? ` · rated ${c.rating}/5` : ""}`;
      });

      if (similarSummaries.length > 0) {
        grillTempContext += `\n\nSimilar past cooks on this grill:\n${similarSummaries.join("\n")}`;
      }
      grillTempContext += `\n\nAll recent cooks on this grill (last ${recentCooksOnGrill.length}):\n${allCookSummaries.join("\n")}`;
    }
  }

  const preheatDefaults: Record<string, number> = {
    offset_smoker: 60,
    charcoal: 30,
    kamado: 45,
    pellet: 20,
    gas: 15,
    electric: 20,
    other: 30,
  };
  const normalizeType = (t: string) => t.toLowerCase().replace(/[\s-]+/g, "_");
  const preheatMinutes = clientPreheatMinutes ?? (grillType ? (preheatDefaults[normalizeType(grillType)] ?? 30) : 30);

  // Fallback: user's own past similar cooks across all grills
  const allUserCooks = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.status, "completed"), eq(cooksTable.userId, req.userId)))
    .limit(20);
  const allSimilarCooks = allUserCooks.filter(c =>
    c.foodType.toLowerCase().includes(foodType.toLowerCase().split(" ")[0])
  );

  const systemPrompt = `You are PitMaster AI. Analyze this cook and return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "estimatedDurationMinutes": number,
  "confidence": "low" | "medium" | "high",
  "rationale": "string",
  "tips": ["string", "string", "string"],
  "wrap": {
    "wrapAtMinutes": number,
    "method": "foil" | "butcher_paper" | "none",
    "wrapTempF": number | null,
    "reason": "string",
    "restMinutes": number
  }
}

Rules:
- estimatedDurationMinutes = ONLY active cook time (food on grill to done, NOT including preheat or rest)
- wrap.wrapAtMinutes = how many minutes into the cook to wrap (0 if method is "none")
- wrap.method: use "foil" (Texas crutch) for speed and moisture, "butcher_paper" for bark preservation (brisket), "none" for shorter cooks like chicken/steak/ribs that don't need wrapping
- wrap.wrapTempF: the internal meat temp at which to wrap, or null if wrapping by time only
- wrap.reason: practical advice — what temp to wrap at, what to add (tallow, butter, juice), how tight to wrap, what to expect
- wrap.restMinutes: recommend realistic rest time (brisket 60-120m, pork butt 45-60m, ribs 15-30m, chicken 10-15m, steak 5-10m)
- If grill historical data shows temperature swings, adjust your estimate for potential stalls or temp drops accordingly`;

  const userPrompt = `Predict cook time for:
Food: ${foodType}
Weight: ${weightLbs ? `${weightLbs} lbs` : "unknown"}
Cook temperature: ${cookTempF ? `${cookTempF}°F` : "unknown"}
Target internal temp: ${targetTempF ? `${targetTempF}°F` : "unknown"}
${grillContext}
${grillTempContext}
${allSimilarCooks.length > 0 && !grillTempContext ? `User's past similar cooks (all grills): ${allSimilarCooks.length} on record` : ""}
${desiredFinishAt ? `Desired finish time: ${desiredFinishAt}` : ""}
Note: Preheat of ${preheatMinutes} min is tracked separately.`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 768,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  type WrapRec = { wrapAtMinutes: number; method: string; wrapTempF: number | null; reason: string; restMinutes: number };
  let prediction: { estimatedDurationMinutes: number; confidence: string; rationale: string; tips: string[]; wrap: WrapRec };

  try {
    prediction = JSON.parse(cleaned);
  } catch {
    prediction = {
      estimatedDurationMinutes: 240,
      confidence: "low",
      rationale: "Could not parse prediction, using default estimate.",
      tips: ["Monitor internal temperature closely", "Use a reliable meat thermometer", "Rest meat after cooking"],
      wrap: {
        wrapAtMinutes: 180,
        method: "foil",
        wrapTempF: 165,
        reason: "Wrap in foil at around 165°F internal temp to push through the stall faster and keep moisture in. Add a splash of apple juice or beef tallow before sealing.",
        restMinutes: 60,
      },
    };
  }

  const wrap = prediction.wrap ?? {
    wrapAtMinutes: 0,
    method: "none",
    wrapTempF: null,
    reason: "No wrap needed for this cook.",
    restMinutes: 15,
  };

  const now = new Date();
  const cookMs = prediction.estimatedDurationMinutes * 60000;
  const preheatMs = preheatMinutes * 60000;
  const restMs = (wrap.restMinutes ?? 0) * 60000;

  let suggestedStartAt: Date;
  let estimatedFinishAt: Date;
  let grillLightAt: Date;
  let serveAt: Date;

  if (desiredFinishAt) {
    const serveTime = new Date(desiredFinishAt);
    serveAt = serveTime;
    estimatedFinishAt = new Date(serveTime.getTime() - restMs);
    suggestedStartAt = new Date(estimatedFinishAt.getTime() - cookMs);
    grillLightAt = new Date(suggestedStartAt.getTime() - preheatMs);
  } else {
    grillLightAt = now;
    suggestedStartAt = new Date(now.getTime() + preheatMs);
    estimatedFinishAt = new Date(suggestedStartAt.getTime() + cookMs);
    serveAt = new Date(estimatedFinishAt.getTime() + restMs);
  }

  res.json({
    estimatedDurationMinutes: prediction.estimatedDurationMinutes,
    preheatMinutes,
    grillLightAt: grillLightAt.toISOString(),
    suggestedStartAt: suggestedStartAt.toISOString(),
    estimatedFinishAt: estimatedFinishAt.toISOString(),
    serveAt: serveAt.toISOString(),
    wrap: {
      wrapAtMinutes: wrap.wrapAtMinutes ?? 0,
      method: wrap.method ?? "none",
      wrapTempF: wrap.wrapTempF ?? null,
      reason: wrap.reason ?? "",
      restMinutes: wrap.restMinutes ?? 0,
    },
    confidence: prediction.confidence || "medium",
    rationale: prediction.rationale || "Based on food type and weight.",
    tips: prediction.tips || [],
  });
});

export default router;
