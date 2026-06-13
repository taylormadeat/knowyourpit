import { Router, type IRouter } from "express";
import { AiMultiCookBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";
import { respondPaywall, userBypassesPaywall } from "../../lib/paywall";
import { aiRateLimit, buildUserCookHistory } from "./shared";
import { processMultiCookResult } from "./processMultiCookResult";

const router: IRouter = Router();

// ── Shared context builder ────────────────────────────────────────────────────
// Called by both /ai/multi-cook and /ai/multi-cook/stream so the prompt
// construction logic lives in one place.
async function buildMultiCookContext(
  userId: string,
  data: ReturnType<typeof AiMultiCookBody.parse>,
) {
  const { items, serveAt, outdoorTempF, outdoorTempIsForecast, notes } = data;

  const serveAtDate = new Date(serveAt);

  // Identify unique grillIds from the request items so we can fetch
  // per-grill calibration profiles in parallel.
  const uniqueGrillIds = [...new Set(
    items
      .map((item: typeof items[number]) => item.grillId)
      .filter((id): id is number => typeof id === "number"),
  )];

  // Build item lines for the prompt, including the grill name when present.
  const itemLines = items.map((item: typeof items[number], i: number) => {
    const preheat = item.preheatMinutes ?? 25;
    const parts: string[] = [
      `${i + 1}. ${item.foodType}`,
      item.grillName ? `grill: "${item.grillName}"` : "",
      item.weightLbs ? `${item.weightLbs} lbs` : "weight unknown",
      item.cookTempF ? `cook at ${item.cookTempF}°F` : "cook temp unknown",
      item.targetTempF && item.targetTempF > 0 ? `target internal ${item.targetTempF}°F` : item.targetTempF === 0 ? "time-based / visual doneness (no internal temp target)" : "",
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

  // Detect which grill names appear more than once — used to inform the AI
  // about the shared-grill scenario.
  const grillNameCounts: Record<string, number> = {};
  for (const item of items) {
    if (item.grillName) {
      grillNameCounts[item.grillName] = (grillNameCounts[item.grillName] ?? 0) + 1;
    }
  }
  const sharedGrillNames = Object.entries(grillNameCounts)
    .filter(([, n]) => n > 1)
    .map(([name]) => name);

  // Fetch user cook history + per-grill calibration profiles in parallel.
  const [cookHistory, allGrillsInsights, ...perGrillInsights] = await Promise.all([
    buildUserCookHistory(userId),
    computeSmokerInsights(userId),
    ...uniqueGrillIds.map(gid => computeSmokerInsights(userId, gid)),
  ]);

  // Build the smoker profile section. When all items share a single grill,
  // use only that grill's profile. When multiple grills are involved, show
  // per-grill profiles (with grill names as labels) if we have them, falling
  // back to the aggregate profile otherwise.
  let smokerProfileSection = "";
  if (uniqueGrillIds.length === 1 && perGrillInsights.length === 1) {
    // All items on one grill — use that grill's specific calibration.
    const grillName = items.find((it: typeof items[number]) => it.grillId === uniqueGrillIds[0])?.grillName ?? "your grill";
    const profile = formatSmokerProfile(perGrillInsights[0]);
    if (profile) {
      smokerProfileSection = profile.replace(
        "=== YOUR SMOKER PROFILE",
        `=== SMOKER PROFILE FOR "${grillName.toUpperCase()}"`,
      );
    }
  } else if (uniqueGrillIds.length > 1) {
    // Multiple grills — show per-grill profiles labeled by grill name.
    const sections: string[] = [];
    for (let i = 0; i < uniqueGrillIds.length; i++) {
      const gid = uniqueGrillIds[i];
      const grillName = items.find((it: typeof items[number]) => it.grillId === gid)?.grillName ?? `Grill ${gid}`;
      const profile = formatSmokerProfile(perGrillInsights[i]);
      if (profile) {
        sections.push(profile.replace(
          "=== YOUR SMOKER PROFILE",
          `=== SMOKER PROFILE FOR "${grillName.toUpperCase()}"`,
        ));
      }
    }
    if (sections.length > 0) {
      smokerProfileSection = sections.join("\n\n");
    } else {
      // No per-grill data — fall back to aggregate.
      smokerProfileSection = formatSmokerProfile(allGrillsInsights);
    }
  } else {
    // No grillIds provided — use aggregate profile.
    smokerProfileSection = formatSmokerProfile(allGrillsInsights);
  }

  const outdoorLine = outdoorTempF != null
    ? `\nOutdoor ambient temperature: ${outdoorTempF}°F (${outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor this into all estimates. Cold weather increases cook times; hot weather may reduce them.\n`
    : "";

  // Build the shared-grill instruction block for the system prompt.
  const sharedGrillInstruction = sharedGrillNames.length > 0
    ? `
SHARED GRILL RULES (critical — applies to: ${sharedGrillNames.map(n => `"${n}"`).join(", ")}):
- Preheat deduction: For the FIRST item placed on each grill, grillLightAt = meatOnAt - preheatMinutes (normal). For ALL SUBSEQUENT items on the SAME grill, grillLightAt = meatOnAt (the grill is already hot — no preheat deduction).
- Shared grill tips: Since items are sharing a grill, populate "sharedGrillTips" with 2–4 concise, specific tips for managing those items together. Use the grill's calibration data from the SMOKER PROFILE above (temperature bias, run-long/short tendency, cook count) to make the advice concrete — e.g. reference the grill's known hot or cold spots, how it holds temp under load, ideal placement order when adding items mid-cook, and any timing watch-outs specific to the items sharing the space.
`
    : `
SHARED GRILL RULES: No items share a grill in this session. Set "sharedGrillTips" to null.
`;

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master. You are sequencing a multi-cook session where everything must be ready to serve at the same time.

For each item, calculate working BACKWARDS from the serveAt time:
- restMinutes: how long the meat should rest after leaving the grill
- estimatedDurationMinutes: active cook time only (meat on grill to off grill), NOT including preheat or rest
- preheatMinutes: use the value provided per item
- estimatedFinishAt = serveAt - restMinutes
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes (see SHARED GRILL RULES below for exceptions)
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
- Vegetables / fruit: almost always none; exception is foil-wrapped whole vegetables (potato, beet, corn in husk) where foil is part of the technique
${sharedGrillInstruction}
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
  "summary": "One sentence summary of the full sequencing plan",
  "sharedGrillTips": "string with 2–4 tips, or null"
}`;

  const sessionNotesSection = notes && notes.trim()
    ? `\nCook Notes (user-provided — factor these into your rationale and tips for all items):\n${notes.trim()}\n`
    : "";

  const userPrompt = `Multi-cook session. Everything must be ready to serve at: ${serveAtDate.toLocaleString()}
${outdoorLine}${sessionNotesSection}
Items to cook:
${itemLines}

${smokerProfileSection ? smokerProfileSection + "\n" : ""}${cookHistory}`;

  return { serveAtDate, systemPrompt, userPrompt, items };
}

// ── POST /ai/multi-cook (non-streaming) ──────────────────────────────────────
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

  if (parsed.data.items.length < 2 || parsed.data.items.length > 5) {
    res.status(400).json({ error: "Provide between 2 and 5 items." });
    return;
  }

  try {
    const ctx = await buildMultiCookContext(req.userId, parsed.data);

    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 50_000);
    let response: Awaited<ReturnType<typeof openai.chat.completions.create>> | null = null;
    try {
      response = await openai.chat.completions.create(
        {
          model: "gpt-4.1-mini",
          max_completion_tokens: 2048,
          messages: [
            { role: "system", content: ctx.systemPrompt },
            { role: "user", content: ctx.userPrompt },
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

    let raw: any;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Could not parse AI response. Please try again." });
      return;
    }

    res.json(processMultiCookResult(raw, ctx.serveAtDate, ctx.items));
  } catch (err: any) {
    req.log.error({ err }, "multi-cook error");
    res.status(500).json({ error: "AI request failed. Please try again." });
  }
});

// ── POST /ai/multi-cook/stream (NDJSON streaming) ────────────────────────────
// Same as /ai/multi-cook but streams raw token deltas so the client can show
// schedule items progressively as the AI generates them.
// Protocol: { type:"delta", text:"..." } per chunk, then { type:"complete", data:{...} }
router.post("/ai/multi-cook/stream", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
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

  if (parsed.data.items.length < 2 || parsed.data.items.length > 5) {
    res.status(400).json({ error: "Provide between 2 and 5 items." });
    return;
  }

  const ctx = await buildMultiCookContext(req.userId, parsed.data);

  res.setHeader("Content-Type", "application/x-ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Transfer-Encoding", "chunked");

  let clientClosed = false;
  req.on("close", () => { clientClosed = true; });

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), 55_000);

  try {
    const stream = await openai.chat.completions.create(
      {
        model: "gpt-4.1-mini",
        max_completion_tokens: 2048,
        messages: [
          { role: "system", content: ctx.systemPrompt },
          { role: "user", content: ctx.userPrompt },
        ],
        stream: true,
      },
      { signal: abortController.signal },
    );

    let accumulated = "";
    for await (const chunk of stream) {
      if (clientClosed) break;
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        accumulated += delta;
        res.write(JSON.stringify({ type: "delta", text: delta }) + "\n");
      }
    }

    clearTimeout(timeoutId);

    if (clientClosed) return;

    const cleaned = accumulated.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    let raw: any;
    try {
      raw = JSON.parse(cleaned);
    } catch {
      raw = { schedule: [], serveAt: ctx.serveAtDate.toISOString(), summary: "" };
    }

    res.write(JSON.stringify({ type: "complete", data: processMultiCookResult(raw, ctx.serveAtDate, ctx.items) }) + "\n");
    res.end();
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (!clientClosed) {
      req.log.warn({ err }, "multi-cook stream error");
      res.write(JSON.stringify({ type: "error", message: "AI sequencer timed out. Please try again." }) + "\n");
      res.end();
    }
  }
});

export default router;
