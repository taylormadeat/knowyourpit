import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, grillsTable, temperatureReadingsTable } from "@workspace/db";
import { AiChatBody, AiPredictBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const PIT_PROBE_NAMES = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
const isPitProbe = (name: string | null) =>
  name ? PIT_PROBE_NAMES.some(k => name.toLowerCase().includes(k)) : false;

router.post("/ai/chat", async (req, res): Promise<void> => {
  const parsed = AiChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context } = parsed.data;

  const systemPrompt = `You are PitMaster AI, an expert BBQ assistant. You help users with BBQ cooking, grilling techniques, temperature guidance, timing predictions, and recipe suggestions. You are knowledgeable about all BBQ styles including Texas BBQ, Carolina BBQ, Kansas City style, and more. Provide practical, specific advice.${context ? `\n\nCurrent context: ${context}` : ""}`;

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
    "What temperature should I cook brisket to?",
    "How long does pulled pork take at 225°F?",
    "What wood pairs best with pork ribs?",
    "How do I know when my grill is at the right temperature?",
    "What is the stall and how do I push through it?",
  ].sort(() => Math.random() - 0.5).slice(0, 3);

  res.json({ reply, suggestions });
});

router.post("/ai/predict", async (req, res): Promise<void> => {
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
    const [grill] = await db.select().from(grillsTable).where(eq(grillsTable.id, grillId));
    if (grill) {
      grillContext = `Grill: ${grill.name} (${grill.type}, ${grill.brand || "unknown brand"})`;
      grillType = grill.type;
    }

    // Pull historical temperature data for this grill
    const grillReadings = await db.select().from(temperatureReadingsTable)
      .where(eq(temperatureReadingsTable.grillId, grillId));

    if (grillReadings.length > 0) {
      const pitReadings = grillReadings.filter(r => isPitProbe(r.probeName));

      if (pitReadings.length > 0) {
        const avgPit = pitReadings.reduce((s, r) => s + r.tempF, 0) / pitReadings.length;
        const maxPit = Math.max(...pitReadings.map(r => r.tempF));
        const minPit = Math.min(...pitReadings.map(r => r.tempF));

        // Per-cook variance
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

    // Pull similar completed cooks on this grill for context
    const pastCooksOnGrill = await db.select().from(cooksTable)
      .where(and(eq(cooksTable.grillId, grillId), eq(cooksTable.status, "completed")))
      .orderBy(cooksTable.actualEndAt);

    const similarCooks = pastCooksOnGrill.filter(c =>
      c.foodType.toLowerCase().includes(foodType.toLowerCase().split(" ")[0])
    );

    if (similarCooks.length > 0) {
      const cookSummaries = similarCooks.slice(-5).map(c => {
        const durationMins = c.actualStartAt && c.actualEndAt
          ? Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000)
          : null;
        return `${c.foodType}${c.weightLbs ? ` (${c.weightLbs} lbs)` : ""}${durationMins ? ` → ${durationMins} min cook` : ""}${c.rating ? ` · rated ${c.rating}/5` : ""}`;
      });
      grillTempContext += `\n\nSimilar past cooks on this grill:\n${cookSummaries.join("\n")}`;
    }
  }

  // Preheat defaults
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

  // All-grill similar cooks as fallback context
  const allPastCooks = await db.select().from(cooksTable).where(eq(cooksTable.status, "completed")).limit(10);
  const allSimilarCooks = allPastCooks.filter(c => c.foodType.toLowerCase().includes(foodType.toLowerCase().split(" ")[0]));

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
${allSimilarCooks.length > 0 && !grillTempContext ? `Past similar cooks (all grills): ${allSimilarCooks.length} cooks on record` : ""}
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
