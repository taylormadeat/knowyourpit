import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, cooksTable, grillsTable } from "@workspace/db";
import { AiChatBody, AiPredictBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

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
  if (grillId) {
    const [grill] = await db.select().from(grillsTable).where(eq(grillsTable.id, grillId));
    if (grill) {
      grillContext = `Grill: ${grill.name} (${grill.type}, ${grill.brand || "unknown brand"})`;
      grillType = grill.type;
    }
  }

  // Determine preheat minutes: use client value if provided, otherwise derive from grill type
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

  const pastCooks = await db.select().from(cooksTable).where(
    and(eq(cooksTable.status, "completed"))
  ).limit(10);

  const similarCooks = pastCooks.filter(c => c.foodType.toLowerCase().includes(foodType.toLowerCase().split(" ")[0]));

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
- wrap.restMinutes: recommend realistic rest time (brisket 60-120m, pork butt 45-60m, ribs 15-30m, chicken 10-15m, steak 5-10m)`;

  const userPrompt = `Predict cook time for:
Food: ${foodType}
Weight: ${weightLbs ? `${weightLbs} lbs` : "unknown"}
Cook temperature: ${cookTempF ? `${cookTempF}°F` : "unknown"}
Target internal temp: ${targetTempF ? `${targetTempF}°F` : "unknown"}
${grillContext}
${similarCooks.length > 0 ? `Past similar cooks: ${similarCooks.length} cooks on record` : "No past similar cooks"}
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

  // Strip markdown code fences if present
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
