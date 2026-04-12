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
  const { grillId, foodType, weightLbs, cookTempF, targetTempF, desiredFinishAt } = parsed.data;

  let grillContext = "";
  if (grillId) {
    const [grill] = await db.select().from(grillsTable).where(eq(grillsTable.id, grillId));
    if (grill) grillContext = `Grill: ${grill.name} (${grill.type}, ${grill.brand || "unknown brand"})`;
  }

  const pastCooks = await db.select().from(cooksTable).where(
    and(eq(cooksTable.status, "completed"))
  ).limit(10);

  const similarCooks = pastCooks.filter(c => c.foodType.toLowerCase().includes(foodType.toLowerCase().split(" ")[0]));

  const systemPrompt = `You are PitMaster AI. Analyze this cook request and provide an accurate time prediction. Return ONLY valid JSON with this exact structure:
{
  "estimatedDurationMinutes": number,
  "confidence": "low" | "medium" | "high",
  "rationale": "string",
  "tips": ["string", "string", "string"]
}`;

  const userPrompt = `Predict cook time for:
Food: ${foodType}
Weight: ${weightLbs ? `${weightLbs} lbs` : "unknown"}
Cook temperature: ${cookTempF ? `${cookTempF}°F` : "unknown"}
Target internal temp: ${targetTempF ? `${targetTempF}°F` : "unknown"}
${grillContext}
${similarCooks.length > 0 ? `Past similar cooks: ${similarCooks.length} cooks on record` : "No past similar cooks"}
${desiredFinishAt ? `Desired finish time: ${desiredFinishAt}` : ""}`;

  const response = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 512,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  let prediction: { estimatedDurationMinutes: number; confidence: string; rationale: string; tips: string[] };
  try {
    prediction = JSON.parse(content);
  } catch {
    prediction = {
      estimatedDurationMinutes: 240,
      confidence: "low",
      rationale: "Could not parse prediction, using default estimate.",
      tips: ["Monitor internal temperature closely", "Use a reliable meat thermometer", "Rest meat after cooking"],
    };
  }

  const now = new Date();
  const estimatedFinishAt = new Date(now.getTime() + prediction.estimatedDurationMinutes * 60000);
  const suggestedStartAt = desiredFinishAt
    ? new Date(new Date(desiredFinishAt).getTime() - prediction.estimatedDurationMinutes * 60000)
    : now;

  res.json({
    estimatedDurationMinutes: prediction.estimatedDurationMinutes,
    suggestedStartAt: suggestedStartAt.toISOString(),
    estimatedFinishAt: estimatedFinishAt.toISOString(),
    confidence: prediction.confidence || "medium",
    rationale: prediction.rationale || "Based on food type and weight.",
    tips: prediction.tips || [],
  });
});

export default router;
