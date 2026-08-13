import { Router, type IRouter } from "express";
import { eq, inArray } from "drizzle-orm";
import { db, grillsTable } from "@workspace/db";
import { AiMultiCookBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";
import { respondPaywall, userBypassesPaywall } from "../../lib/paywall";
import { aiRateLimit, buildUserCookHistory } from "./shared";
import { classifyGrillType, grillClassCoachingNote, isDirectHeat } from "../../lib/grillClassify";
import { processMultiCookResult } from "./processMultiCookResult";
import { getMeatBaseline } from "./meatBaselines";

/**
 * Apply the per-cut minimum cook time floor to a client-provided baseline.
 * Method-driven cuts (e.g. ribs) need close to the full method duration even
 * at light weights — a pure mins/lb × weight baseline can otherwise produce
 * impossibly short schedules with wrap steps landing after the finish time.
 */
export function applyBaselineFloor(
  foodType: string,
  baselineEstimateMinutes: number | null | undefined,
): number | null {
  const floor = getMeatBaseline(foodType)?.minCookMins ?? 0;
  if (baselineEstimateMinutes == null) return floor > 0 ? floor : null;
  return Math.max(baselineEstimateMinutes, floor);
}

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
    const baselineMins = applyBaselineFloor(item.foodType, item.baselineEstimateMinutes);
    const baselineH = baselineMins != null
      ? `${Math.floor(baselineMins / 60)}h${baselineMins % 60 ? ` ${baselineMins % 60}m` : ""}`
      : null;
    const parts: string[] = [
      `${i + 1}. ${item.foodType}`,
      item.grillName ? `grill: "${item.grillName}"` : "",
      item.weightLbs ? `${item.weightLbs} lbs` : "weight unknown",
      item.cookTempF ? `cook at ${item.cookTempF}°F` : "cook temp unknown",
      item.targetTempF && item.targetTempF > 0 ? `target internal ${item.targetTempF}°F` : item.targetTempF === 0 ? "time-based / visual doneness (no internal temp target)" : "",
      `preheat ${preheat} min`,
      item.restMins != null ? `rest ${item.restMins} min` : "",
      baselineH ? `BASELINE COOK TIME: ${baselineH} (stay within ±25% of this)` : "",
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

  // Fetch user cook history, per-grill calibration profiles, and grill rows in parallel.
  const [cookHistory, allGrillsInsights, grillRows, ...perGrillInsights] = await Promise.all([
    buildUserCookHistory(userId),
    computeSmokerInsights(userId),
    uniqueGrillIds.length > 0
      ? db.select({ id: grillsTable.id, type: grillsTable.type })
          .from(grillsTable)
          .where(inArray(grillsTable.id, uniqueGrillIds))
      : Promise.resolve([] as { id: number; type: string }[]),
    ...uniqueGrillIds.map(gid => computeSmokerInsights(userId, gid)),
  ]);

  // Build grill-type coaching lines per unique (grill × method) combination.
  // If a single grill has items with different cooking methods (e.g. smoke + direct),
  // emit one coaching note per method so the AI gets accurate guidance for each.
  const grillTypeById = Object.fromEntries(grillRows.map(g => [g.id, g.type]));
  const grillCoachingLines: string[] = [];
  for (const gid of uniqueGrillIds) {
    const grillName = items.find((it: typeof items[number]) => it.grillId === gid)?.grillName;
    const grillClass = classifyGrillType(grillTypeById[gid]);
    const methodsOnGrill = [
      ...new Set(
        (items as Array<typeof items[number]>)
          .filter(it => it.grillId === gid)
          .map(it => it.cookingMethod as string | null | undefined)
          .filter((m): m is string => !!m),
      ),
    ];
    if (methodsOnGrill.length <= 1) {
      const note = grillClassCoachingNote(grillClass, methodsOnGrill[0] ?? null);
      if (note && grillName) grillCoachingLines.push(`"${grillName}": ${note}`);
    } else {
      for (const method of methodsOnGrill) {
        const note = grillClassCoachingNote(grillClass, method);
        if (note && grillName) grillCoachingLines.push(`"${grillName}" (${method}): ${note}`);
      }
    }
  }

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
        "=== YOUR COOK PROFILE",
        `=== COOK PROFILE FOR "${grillName.toUpperCase()}"`,
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
          "=== YOUR COOK PROFILE",
          `=== COOK PROFILE FOR "${grillName.toUpperCase()}"`,
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

  const currentTimeStr = new Date().toLocaleString("en-US", { timeZoneName: "short" });

  // Scope wrap guidance to cooking method — direct-heat sessions don't stall or wrap.
  const allItemsDirect = items.every((item: typeof items[number]) => isDirectHeat(item.cookingMethod ?? null));
  const anyItemDirect = !allItemsDirect && items.some((item: typeof items[number]) => isDirectHeat(item.cookingMethod ?? null));
  const wrapGuidanceSection = allItemsDirect
    ? `For each item, set wrapMethod to "none" — direct-heat / grilling cooks do not use stall-based wrapping. Set wrapAtMinutes, wrapTempF, and wrapReason all to null.`
    : `For each item, also determine wrap guidance:
- wrapMethod: "foil" (Texas Crutch — faster, steams), "butcher_paper" (breathable, retains bark), or "none"
- wrapAtMinutes: minutes from meatOnAt when to wrap. REQUIRED whenever wrapMethod is "foil" or "butcher_paper" — never null in that case. Null only when wrapMethod is "none". CRITICAL: wrapAtMinutes MUST be strictly less than that item's estimatedDurationMinutes — a wrap step can never land at or after the pull-off time. If the estimated cook is short, scale the wrap point proportionally (typically 40–60% into the cook) instead of using a fixed hour mark.
- wrapTempF: internal meat temperature to trigger wrap in °F (null if not applicable)
- wrapReason: one sentence explaining the wrap strategy for this item

IMPORTANT: When wrapMethod is "foil" or "butcher_paper", wrap details MUST go in the wrap fields above (wrapAtMinutes, wrapTempF, wrapReason). DO NOT mention wrapping in the "notes" field — the UI renders the wrap step as its own row in the schedule using the wrap fields, and duplicating it in notes will confuse the user.

Wrap guidance by cut:
- Brisket (whole packer, flat): butcher_paper around the stall (~160-170°F internal, ~50-60% into cook)
- Pork shoulder / butt: foil around the stall (~160-165°F internal, ~50-60% into cook)
- Spare ribs / St. Louis: foil or butcher_paper, wrap ~50-60% into the cook. Only cite the classic 3-2-1 method (3h smoke, 2h foil, 1h unwrapped) in notes/wrapReason when estimatedDurationMinutes is close to 6 hours — otherwise describe the stages proportionally to the actual estimate.
- Baby back ribs: foil, wrap ~40-50% into the cook. Only cite the classic 2-2-1 method (2h smoke, 2h foil, 1h unwrapped) in notes/wrapReason when estimatedDurationMinutes is close to 5 hours — otherwise describe the stages proportionally to the actual estimate.
- Chicken / turkey: none (wrapping steams poultry, ruins skin)
- Salmon / fish: none
- Sausage / hot dogs: none
- Other lean cuts (tri-tip, flat iron): none or butcher_paper briefly if stalling
- Vegetables / fruit: almost always none; exception is foil-wrapped whole vegetables (potato, beet, corn in husk) where foil is part of the technique${anyItemDirect ? '\n\nIMPORTANT: Any item with a direct-heat or grilling cooking method must use wrapMethod: "none" — stall-based wrapping does not apply to direct-heat cooks.' : ""}`;

  const grillTypeSection = grillCoachingLines.length > 0
    ? `\nGRILL-SPECIFIC NOTES (apply to all scheduling, wrap, and technique decisions for items on each grill):\n${grillCoachingLines.map(l => `- ${l}`).join("\n")}\n`
    : "";

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master. You are sequencing a multi-cook session where everything must be ready to serve at the same time.

Current time: ${currentTimeStr}

For each item, calculate working BACKWARDS from the serveAt time:
- restMinutes: use the restMins value provided per item as your default; adjust only if you have a strong culinary reason
- estimatedDurationMinutes: START from the baselineEstimateMinutes provided per item (computed from the cut's standard mins/lb × weight — it is the ground truth). Adjust by at most ±25% based on the smoker calibration profile and ambient temperature ONLY. Never exceed this range — wild deviations from the baseline produce a broken schedule.
- preheatMinutes: use the value provided per item
- estimatedFinishAt = serveAt - restMinutes
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes (see SHARED GRILL RULES below for exceptions)
All times must be ISO 8601 strings. All items finish resting at or just before serveAt.

INFEASIBILITY RULE (critical): If your backward calculation puts meatOnAt before current time + 30 minutes, the serve window is too short for this item — do NOT compress the cook time to compensate. Instead:
- Set grillLightAt = current time + 5 minutes (start as soon as possible)
- Set meatOnAt = current time + preheatMinutes + 5 minutes
- Set estimatedFinishAt = meatOnAt + estimatedDurationMinutes
- The Ready To Serve time will be later than serveAt — this is correct and honest
- Add a note: "Earliest achievable — [item] can't be ready by [serveAt time]; will be done ~[actual ready time]."

${wrapGuidanceSection}
${grillTypeSection}${sharedGrillInstruction}
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

// ── Add-items sequencer (called by POST /cooks/:id/add-items) ─────────────────
// Builds an AI prompt anchored to an already-active cook and sequences one or
// more new items around it.  Returns the same MultiCookResult shape used by
// /ai/multi-cook so the same processMultiCookResult post-processor applies.

export type AddItemsAnchor = {
  foodType: string;
  grillName?: string | null;
  elapsedMinutes: number;
  remainingEstimateMinutes: number;
  currentTempF?: number | null;
  restMinutes?: number | null;
};

export type AddItemsNewItem = {
  foodType: string;
  weightLbs?: number | null;
  cookTempF?: number | null;
  targetTempF?: number | null;
  grillId?: number | null;
  grillName?: string | null;
  preheatMinutes?: number | null;
  cookingMethod?: string | null;
  fromFrozen?: boolean | null;
  thawMethod?: string | null;
  notes?: string | null;
  cookingStylePreset?: string | null;
  baselineEstimateMinutes?: number | null;
  restMins?: number | null;
};

export async function callAddItemsSequencer(
  userId: string,
  anchor: AddItemsAnchor,
  newItems: AddItemsNewItem[],
  opts?: { outdoorTempF?: number | null; outdoorTempIsForecast?: boolean | null },
): Promise<ReturnType<typeof processMultiCookResult>> {
  const nowMs = Date.now();
  const anchorRestMin = anchor.restMinutes ?? 15;
  const anchorRemainingMin = Math.max(0, anchor.remainingEstimateMinutes);

  // serveAt = when the anchor cook will be ready to serve
  const serveAtMs = nowMs + anchorRemainingMin * 60_000 + anchorRestMin * 60_000;
  const serveAtDate = new Date(serveAtMs);

  const uniqueGrillIds = [...new Set(
    newItems
      .map(it => it.grillId)
      .filter((id): id is number => typeof id === "number"),
  )];

  const [cookHistory, allGrillsInsights, grillRows, ...perGrillInsights] = await Promise.all([
    buildUserCookHistory(userId),
    computeSmokerInsights(userId),
    uniqueGrillIds.length > 0
      ? db.select({ id: grillsTable.id, type: grillsTable.type })
          .from(grillsTable)
          .where(inArray(grillsTable.id, uniqueGrillIds))
      : Promise.resolve([] as { id: number; type: string }[]),
    ...uniqueGrillIds.map(gid => computeSmokerInsights(userId, gid)),
  ]);

  const grillTypeById = Object.fromEntries(grillRows.map(g => [g.id, g.type]));
  const grillCoachingLines: string[] = [];
  for (const gid of uniqueGrillIds) {
    const grillName = newItems.find(it => it.grillId === gid)?.grillName;
    const grillClass = classifyGrillType(grillTypeById[gid]);
    const methodsOnGrill = [
      ...new Set(
        newItems
          .filter(it => it.grillId === gid)
          .map(it => it.cookingMethod as string | null | undefined)
          .filter((m): m is string => !!m),
      ),
    ];
    if (methodsOnGrill.length <= 1) {
      const note = grillClassCoachingNote(grillClass, methodsOnGrill[0] ?? null);
      if (note && grillName) grillCoachingLines.push(`"${grillName}": ${note}`);
    } else {
      for (const method of methodsOnGrill) {
        const note = grillClassCoachingNote(grillClass, method);
        if (note && grillName) grillCoachingLines.push(`"${grillName}" (${method}): ${note}`);
      }
    }
  }
  const grillTypeSection = grillCoachingLines.length > 0
    ? `\nGRILL-SPECIFIC NOTES:\n${grillCoachingLines.map(l => `- ${l}`).join("\n")}\n`
    : "";

  let smokerProfileSection = "";
  if (uniqueGrillIds.length === 1 && perGrillInsights.length === 1) {
    const grillName = newItems.find(it => it.grillId === uniqueGrillIds[0])?.grillName ?? "your grill";
    const profile = formatSmokerProfile(perGrillInsights[0]);
    if (profile) smokerProfileSection = profile.replace("=== YOUR COOK PROFILE", `=== COOK PROFILE FOR "${grillName.toUpperCase()}"`);
  } else if (uniqueGrillIds.length > 1) {
    const sections: string[] = [];
    for (let i = 0; i < uniqueGrillIds.length; i++) {
      const gid = uniqueGrillIds[i];
      const grillName = newItems.find(it => it.grillId === gid)?.grillName ?? `Grill ${gid}`;
      const profile = formatSmokerProfile(perGrillInsights[i]);
      if (profile) sections.push(profile.replace("=== YOUR COOK PROFILE", `=== COOK PROFILE FOR "${grillName.toUpperCase()}"`));
    }
    smokerProfileSection = sections.join("\n\n") || formatSmokerProfile(allGrillsInsights);
  } else {
    smokerProfileSection = formatSmokerProfile(allGrillsInsights);
  }

  const outdoorLine = (opts?.outdoorTempF != null)
    ? `\nOutdoor ambient temperature: ${opts.outdoorTempF}°F (${opts.outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor into all estimates.\n`
    : "";

  const anchorGrillLine = anchor.grillName ? ` on grill "${anchor.grillName}"` : "";
  const anchorTempLine = anchor.currentTempF != null ? ` · current internal temp ${anchor.currentTempF}°F` : "";

  const anchorSection = `
ANCHOR COOK (ALREADY ACTIVE — treat as IMMUTABLE — do NOT schedule or include in your JSON output):
- ${anchor.foodType}${anchorGrillLine}: ${Math.round(anchor.elapsedMinutes)} min elapsed · ~${Math.round(anchorRemainingMin)} min remaining until pull${anchorTempLine}
- This cook will be ready to serve at approximately: ${serveAtDate.toLocaleString("en-US", { timeZoneName: "short" })}
- Your job is to schedule ONLY the new items listed below so they finish at or near this same serve time.
- The anchor cook's grill${anchor.grillName ? ` ("${anchor.grillName}")` : ""} is already hot — do NOT include a preheat step for new items that share this grill.
`;

  const newItemLines = newItems.map((item, i) => {
    const preheat = item.preheatMinutes ?? 25;
    const baselineMins = applyBaselineFloor(item.foodType, item.baselineEstimateMinutes);
    const baselineH = baselineMins != null
      ? `${Math.floor(baselineMins / 60)}h${baselineMins % 60 ? ` ${baselineMins % 60}m` : ""}`
      : null;
    const parts: string[] = [
      `${i + 1}. ${item.foodType}`,
      item.grillName ? `grill: "${item.grillName}"` : "",
      item.weightLbs ? `${item.weightLbs} lbs` : "weight unknown",
      item.cookTempF ? `cook at ${item.cookTempF}°F` : "cook temp unknown",
      item.targetTempF && item.targetTempF > 0 ? `target internal ${item.targetTempF}°F` : item.targetTempF === 0 ? "time-based / visual doneness" : "",
      `preheat ${preheat} min`,
      item.restMins != null ? `rest ${item.restMins} min` : "",
      baselineH ? `BASELINE COOK TIME: ${baselineH} (stay within ±25%)` : "",
      item.cookingMethod ? `cooking method: ${item.cookingMethod}` : "",
      item.cookingStylePreset ? `style preset: "${item.cookingStylePreset}"` : "",
      item.fromFrozen ? `starting from frozen · thaw method: ${item.thawMethod ?? "not specified"}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }).join("\n");

  const grillNameCounts: Record<string, number> = {};
  if (anchor.grillName) grillNameCounts[anchor.grillName] = 1;
  for (const item of newItems) {
    if (item.grillName) grillNameCounts[item.grillName] = (grillNameCounts[item.grillName] ?? 0) + 1;
  }
  const sharedGrillNames = Object.entries(grillNameCounts).filter(([, n]) => n > 1).map(([name]) => name);

  const sharedGrillInstruction = sharedGrillNames.length > 0
    ? `
SHARED GRILL RULES (applies to: ${sharedGrillNames.map(n => `"${n}"`).join(", ")}):
- The anchor cook is already running on this grill — it is hot. Set grillLightAt = meatOnAt for any new item on the same grill (no preheat needed).
- Populate "sharedGrillTips" with 2–4 concise tips for managing the new items alongside the active cook.
`
    : `SHARED GRILL RULES: No new items share a grill. Set "sharedGrillTips" to null.`;

  const currentTimeStr = new Date().toLocaleString("en-US", { timeZoneName: "short" });

  // Scope wrap guidance to the new items' cooking methods.
  const allNewItemsDirect = newItems.every(it => isDirectHeat(it.cookingMethod ?? null));
  const anyNewItemDirect = !allNewItemsDirect && newItems.some(it => isDirectHeat(it.cookingMethod ?? null));

  const addItemsWrapGuidance = allNewItemsDirect
    ? `For each item, set wrapMethod to "none" — direct-heat / grilling cooks do not use stall-based wrapping. Set wrapAtMinutes, wrapTempF, and wrapReason all to null.`
    : `For each item also determine wrap guidance (same rules as standard multi-cook — Texas Crutch / butcher paper at the stall for low-and-slow cuts; "none" for poultry, seafood, and quick-cook items). wrapAtMinutes MUST be strictly less than that item's estimatedDurationMinutes — scale the wrap point proportionally (typically 40-60% into the cook) rather than using fixed hour marks.${anyNewItemDirect ? '\n\nIMPORTANT: Any new item with a direct-heat or grilling cooking method must use wrapMethod: "none" — stall-based wrapping does not apply to direct-heat cooks.' : ""}`;

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master. You are adding new items to an already-active cook session.

Current time: ${currentTimeStr}
${anchorSection}
${grillTypeSection}${sharedGrillInstruction}

For each NEW item, calculate working BACKWARDS from the serve time (${serveAtDate.toLocaleString()}):
- estimatedDurationMinutes: START from baselineEstimateMinutes if provided. Adjust ±25% max based on smoker profile and ambient temp.
- preheatMinutes: use the value provided. If the new item shares a grill with the anchor cook, override preheat to 0 (grill is already hot).
- estimatedFinishAt = serveAt - restMinutes
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes (0 if grill is already hot from anchor cook)

INFEASIBILITY RULE: If meatOnAt is before current time + 30 minutes, set grillLightAt = now + 5 min, meatOnAt = now + preheatMinutes + 5 min, estimatedFinishAt = meatOnAt + estimatedDurationMinutes. Add a note explaining the delay.

${addItemsWrapGuidance}

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
      "notes": "one additional specific tip for this item"
    }
  ],
  "serveAt": "ISO string",
  "summary": "One sentence summary of the new items and how they fit around the active cook",
  "sharedGrillTips": "string with 2-4 tips, or null"
}`;

  const userPrompt = `Active anchor cook: ${anchor.foodType}${anchorGrillLine} — ${Math.round(anchorRemainingMin)} min left, serve at ${serveAtDate.toLocaleString()}.
${outdoorLine}
New items to sequence:
${newItemLines}

${smokerProfileSection ? smokerProfileSection + "\n" : ""}${cookHistory}`;

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
  } finally {
    clearTimeout(timeoutId);
  }

  const content = response?.choices[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  let raw: any;
  try { raw = JSON.parse(cleaned); } catch { raw = { schedule: [], serveAt: serveAtDate.toISOString(), summary: "" }; }

  return processMultiCookResult(raw, serveAtDate, newItems.map(it => ({ foodType: it.foodType, grillName: it.grillName ?? null })));
}
