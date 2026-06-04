import { Router, type IRouter } from "express";
import { AiMultiCookBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";
import { respondPaywall, userBypassesPaywall } from "../../lib/paywall";
import { aiRateLimit, buildUserCookHistory } from "./shared";

const router: IRouter = Router();

router.post("/ai/multi-cook", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "multi_cook",
      message: "Multi-Cook Sequencer is a Pro feature. Upgrade to plan multiple items together.",
    });
    return;
  }

  const parsed = AiMultiCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items, serveAt, outdoorTempF, outdoorTempIsForecast, notes } = parsed.data;

  if (items.length < 2 || items.length > 5) {
    res.status(400).json({ error: "Provide between 2 and 5 items." });
    return;
  }

  const serveAtDate = new Date(serveAt);

  const itemLines = items.map((item: typeof items[number], i: number) => {
    const preheat = item.preheatMinutes ?? 25;
    const parts: string[] = [
      `${i + 1}. ${item.foodType}`,
      item.weightLbs ? `${item.weightLbs} lbs` : "weight unknown",
      item.cookTempF ? `cook at ${item.cookTempF}°F` : "cook temp unknown",
      item.targetTempF ? `target internal ${item.targetTempF}°F` : "",
      `preheat ${preheat} min`,
      item.cookingMethod ? `cooking method: ${item.cookingMethod}` : "",
      item.cookingStylePreset ? `style preset: "${item.cookingStylePreset}"` : "",
      item.fromFrozen ? `starting from frozen · thaw method: ${
        item.thawMethod === "cold_water" ? "cold water (~1h per lb)" :
        item.thawMethod === "fridge" ? "refrigerator (~24h / 4–5 lbs)" :
        item.thawMethod === "microwave" ? "microwave (cook immediately after)" :
        item.thawMethod === "counter" ? "counter thaw (cook immediately after)" :
        item.thawMethod === "cook_from_frozen" ? "cook from frozen (no thaw, +50% time)" :
        "not specified"
      }` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }).join("\n");

  const [cookHistory, smokerInsights] = await Promise.all([
    buildUserCookHistory(req.userId),
    computeSmokerInsights(req.userId),
  ]);
  const smokerProfile = formatSmokerProfile(smokerInsights);

  const outdoorLine = outdoorTempF != null
    ? `\nOutdoor ambient temperature: ${outdoorTempF}°F (${outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor this into all estimates. Cold weather increases cook times; hot weather may reduce them.\n`
    : "";

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master. You are sequencing a multi-cook session where everything must be ready to serve at the same time.

For each item, calculate working BACKWARDS from the serveAt time:
- restMinutes: how long the meat should rest after leaving the grill
- estimatedDurationMinutes: active cook time only (meat on grill to off grill), NOT including preheat or rest
- preheatMinutes: use the value provided per item
- estimatedFinishAt = serveAt - restMinutes
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes
All times must be ISO 8601 strings. All items finish resting at or just before serveAt.

For each item, also determine wrap guidance:
- wrapMethod: "foil" (Texas Crutch — faster, steams), "butcher_paper" (breathable, retains bark), or "none"
- wrapAtMinutes: minutes from meatOnAt when to wrap. REQUIRED whenever wrapMethod is "foil" or "butcher_paper" — never null in that case. Null only when wrapMethod is "none".
- wrapTempF: internal meat temperature to trigger wrap in °F (null if not applicable)
- wrapReason: one sentence explaining the wrap strategy for this item

IMPORTANT: When wrapMethod is "foil" or "butcher_paper", wrap details MUST go in the wrap fields above (wrapAtMinutes, wrapTempF, wrapReason). DO NOT mention wrapping in the "notes" field — the UI renders the wrap step as its own row in the schedule using the wrap fields, and duplicating it in notes will confuse the user.

Wrap guidance by cut:
- Brisket (whole packer, flat): butcher_paper around the stall (~160-170°F internal, ~50-60% into cook)
- Pork shoulder / butt: foil around the stall (~160-165°F internal, ~50-60% into cook)
- Spare ribs / St. Louis: foil (3-2-1 method: 3h smoke, 2h foil, 1h unwrapped) or butcher_paper, wrap at 2-3h in
- Baby back ribs: foil (2-2-1 method: 2h smoke, 2h foil, 1h unwrapped), wrap at 2h in
- Chicken / turkey: none (wrapping steams poultry, ruins skin)
- Salmon / fish: none
- Sausage / hot dogs: none
- Other lean cuts (tri-tip, flat iron): none or butcher_paper briefly if stalling

Return ONLY valid JSON, no markdown:
{
  "schedule": [
    {
      "foodType": "string",
      "estimatedDurationMinutes": number,
      "preheatMinutes": number,
      "restMinutes": number,
      "grillLightAt": "ISO string",
      "meatOnAt": "ISO string",
      "estimatedFinishAt": "ISO string",
      "wrapMethod": "foil|butcher_paper|none",
      "wrapAtMinutes": number_or_null,
      "wrapTempF": number_or_null,
      "wrapReason": "string",
      "notes": "one additional specific tip for this item beyond wrap"
    }
  ],
  "serveAt": "ISO string",
  "summary": "One sentence summary of the full sequencing plan"
}`;

  const sessionNotesSection = notes && notes.trim()
    ? `\nCook Notes (user-provided — factor these into your rationale and tips for all items):\n${notes.trim()}\n`
    : "";

  const userPrompt = `Multi-cook session. Everything must be ready to serve at: ${serveAtDate.toLocaleString()}
${outdoorLine}${sessionNotesSection}
Items to cook:
${itemLines}

${smokerProfile ? smokerProfile + "\n" : ""}${cookHistory}`;

  try {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 50_000);
    let response: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null;
    try {
      response = await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",
          max_completion_tokens: 2048,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        },
        { signal: abortController.signal },
      );
    } catch (aiErr: any) {
      req.log.warn({ err: aiErr }, "multi-cook AI timeout or error");
      res.status(504).json({ error: "AI sequencer timed out. Please try again." });
      return;
    } finally {
      clearTimeout(timeoutId);
    }

    const content = response?.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let result: { schedule: any[]; serveAt: string; summary: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Could not parse AI response. Please try again." });
      return;
    }

    const normalizeWrapMethod = (m: any): "foil" | "butcher_paper" | "none" | null => {
      if (m === "foil" || m === "butcher_paper" || m === "none") return m;
      return null;
    };
    const inputByFoodType = new Map<string, (typeof items)[number]>();
    for (const it of items) {
      if (!inputByFoodType.has(it.foodType)) inputByFoodType.set(it.foodType, it);
    }
    const schedule = (result.schedule ?? [])
      .map((item: any) => {
        const wrapMethod = normalizeWrapMethod(item.wrapMethod);
        const isNoWrap = wrapMethod == null || wrapMethod === "none";
        const cookMin = typeof item.estimatedDurationMinutes === "number"
          ? item.estimatedDurationMinutes
          : 0;
        const explicitWrapAt = typeof item.wrapAtMinutes === "number" && item.wrapAtMinutes > 0
          ? Math.round(item.wrapAtMinutes)
          : null;
        const inferredWrapAt = cookMin > 0 ? Math.max(30, Math.round(cookMin * 0.55)) : null;
        const wrapAtMinutes = isNoWrap
          ? null
          : (explicitWrapAt ?? inferredWrapAt);
        const wrapTempF = isNoWrap
          ? null
          : (typeof item.wrapTempF === "number" ? Math.round(item.wrapTempF) : null);
        const wrapReason = isNoWrap
          ? null
          : (typeof item.wrapReason === "string" && item.wrapReason.trim().length > 0 ? item.wrapReason : null);

        return {
          ...item,
          wrapMethod,
          wrapAtMinutes,
          wrapTempF,
          wrapReason,
        };
      })
      .sort(
        (a: any, b: any) => new Date(a.grillLightAt).getTime() - new Date(b.grillLightAt).getTime()
      );

    const firstItem = schedule[0];
    const lastItem = schedule[schedule.length - 1];
    let deterministicSummary = "";
    if (schedule.length >= 2) {
      deterministicSummary = `Start ${firstItem.foodType} first, then ${lastItem.foodType} last.`;
    }

    res.json({
      schedule,
      serveAt: serveAtDate.toISOString(),
      summary: deterministicSummary,
    });
  } catch (err: any) {
    req.log.error({ err }, "multi-cook error");
    res.status(500).json({ error: "AI request failed. Please try again." });
  }
});

export default router;
