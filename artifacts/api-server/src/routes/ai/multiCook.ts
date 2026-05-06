import { Router, type IRouter } from "express";
import { AiMultiCookBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";
import { respondPaywall, userBypassesPaywall } from "../../lib/paywall";
import { aiRateLimit, buildUserCookHistory } from "./shared";

const router: IRouter = Router();

const COMPETITION_TIPS: Record<"chicken" | "ribs" | "pork" | "brisket", string> = {
  chicken:
    "CHICKEN — judges score appearance (bite-through skin, mahogany glossy color), taste (layered salt+sweet+heat from brine + glaze), texture (tender at 175–180°F internal in the thigh, never mushy). Pulled/shredded chicken is a DQ.",
  ribs:
    "RIBS — judges score appearance (uniform mahogany bark, light glaze, six clean bones same direction), taste (sweet-forward with brown sugar/honey/butter wrap), texture (clean bite-through, ~¼\" pull-back, NEVER fall-off-the-bone which scores as overcooked). Boneless ribs and pulled rib meat are DQs.",
  pork:
    "PORK — judges expect three presentations: money muscle medallions (¼\" sliced, fanned), 1.5\" chunks, and pulled. Inject (apple juice + phosphate or commercial), bark seasoning, light finishing glaze. Money muscle slices firm; chunks tender but hold shape; pulled has visible bark mixed in.",
  brisket:
    "BRISKET — judges expect pencil-thick (¼\") slices from the FLAT, perfect smoke ring, glossy bark; burnt ends as ½–¾\" cubes glazed/caramelized from the point. Beefy + salt + pepper foundation, butcher paper wrap, hot-hold rest 1–2 hours. The pull/bend test: bend without breaking, tear with gentle pull. Chopped brisket is a DQ.",
};

function buildCompetitionContextForPrompt(
  competitionName: string | null,
  items: ReadonlyArray<{ category?: string | null }>,
  fallbackCategories?: ReadonlyArray<string> | null,
): string {
  const cats = new Set<string>();
  for (const it of items) {
    if (it.category && COMPETITION_TIPS[it.category as keyof typeof COMPETITION_TIPS]) {
      cats.add(it.category);
    }
  }
  if (cats.size === 0 && fallbackCategories) {
    for (const c of fallbackCategories) {
      if (c && COMPETITION_TIPS[c as keyof typeof COMPETITION_TIPS]) {
        cats.add(c);
      }
    }
  }
  const lines: string[] = ["", "=== COMPETITION COACHING ==="];
  if (competitionName) lines.push(`Competition: ${competitionName}`);
  lines.push(
    "Judging: 6 certified judges score each entry on Appearance (10 pts), Taste (25 pts), and Texture (25 pts) — 60 points per judge × 6 judges = 360 max per category. Coach for COMPETITION standards, not backyard.",
  );
  for (const c of cats) {
    lines.push(`- ${COMPETITION_TIPS[c as keyof typeof COMPETITION_TIPS]}`);
  }
  lines.push(
    "Box packing reminders: garnish base only (parsley/curly parsley/green leaf lettuce/kale/cilantro — no endive, no red-tipped/orange/yellow lettuce — instant DQ). Never mark or initial the box. Hold cooked meat above 145°F (USDA hot-hold safe minimum) through judging — spec floor is >145°F; pack hotter (160°F+) for brisket/pork to buy a 30–60 min buffer. Chicken and ribs are tighter.",
  );
  lines.push(
    "Within EACH item's notes field, give one COMPETITION-specific tip (e.g., 'flip-and-render thigh skin at the wrap step for bite-through', 'cut a clean half-moon test rib at home before turn-in') — not generic backyard advice.",
  );
  return lines.join("\n");
}

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
  const { items, serveAt, outdoorTempF, outdoorTempIsForecast, competition } = parsed.data;

  const isCompetitionMode = competition?.isCompetition === true;

  if (items.length < 1 || items.length > 5) {
    res.status(400).json({ error: "Provide between 1 and 5 items." });
    return;
  }
  if (!isCompetitionMode && items.length < 2) {
    res.status(400).json({ error: "Provide at least 2 items for the multi-cook sequencer." });
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
      item.category ? `Competition category: ${item.category}` : "",
      item.turnInAt ? `turn-in: ${new Date(item.turnInAt).toLocaleString()}` : "",
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

  const competitionContext = isCompetitionMode
    ? buildCompetitionContextForPrompt(competition?.name ?? null, items, competition?.categories ?? null)
    : "";

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master${isCompetitionMode ? " coaching a competitor in a sanctioned BBQ competition" : ""}. You are sequencing a multi-cook session${isCompetitionMode ? " where each item has its OWN competition turn-in time" : " where everything must be ready to serve at the same time"}.

For each item, calculate working BACKWARDS from ${isCompetitionMode ? "that item's individual turnInAt (each category has its own turn-in time — backwards-plan each independently)" : "the serveAt time"}:
- restMinutes: how long the meat should rest after leaving the grill
- estimatedDurationMinutes: active cook time only (meat on grill to off grill), NOT including preheat or rest
- preheatMinutes: use the value provided per item
- estimatedFinishAt = ${isCompetitionMode ? "turnInAt - boxPackLeadMinutes(15) - restMinutes" : "serveAt - restMinutes"}
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes
${isCompetitionMode ? "- boxPackAt = turnInAt - 15 minutes (when slicing/portioning + box presentation must begin)\n" : ""}
All times must be ISO 8601 strings.${isCompetitionMode ? " Each item finishes its rest just before its boxPackAt." : " All items finish resting at or just before serveAt."}

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
      "notes": "one additional specific tip for this item beyond wrap${isCompetitionMode ? " — focus on competition judging criteria" : ""}"${isCompetitionMode ? ',\n      "category": "chicken|ribs|pork|brisket",\n      "turnInAt": "ISO string (echoed from input)",\n      "boxPackAt": "ISO string (turnInAt - 15 minutes)"' : ""}
    }
  ],
  "serveAt": "ISO string",
  "summary": "One sentence summary of the full sequencing plan${isCompetitionMode ? " (mention competition pacing)" : ""}"
}${isCompetitionMode ? `\n\n${competitionContext}` : ""}`;

  const userPrompt = `${isCompetitionMode ? `Competition session${competition?.name ? ` — ${competition.name}` : ""}. Each item has its own turn-in time below.` : `Multi-cook session. Everything must be ready to serve at: ${serveAtDate.toLocaleString()}`}
${outdoorLine}
Items to cook:
${itemLines}

${smokerProfile ? smokerProfile + "\n" : ""}${cookHistory}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
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
    const normalizeCategory = (c: any): "chicken" | "ribs" | "pork" | "brisket" | null => {
      if (c === "chicken" || c === "ribs" || c === "pork" || c === "brisket") return c;
      return null;
    };
    const inputByFoodType = new Map<string, (typeof items)[number]>();
    for (const it of items) {
      if (!inputByFoodType.has(it.foodType)) inputByFoodType.set(it.foodType, it);
    }
    const BOX_PACK_LEAD_MS = 15 * 60_000;
    const nowMs = Date.now();
    const IMMINENT_GRACE_MS = 15 * 60_000;
    const LONG_COOK_MIN = 120;
    const formatPastTime = (ms: number): string => {
      const d = new Date(ms);
      const now = new Date(nowMs);
      const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
      const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      if (sameDay) return time + " today";
      const dayDiff = Math.round((now.setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / 86_400_000);
      if (dayDiff === 1) return time + " yesterday";
      if (dayDiff > 1) return `${time}, ${dayDiff} days ago`;
      return d.toLocaleString();
    };
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

        const inputMatch = inputByFoodType.get(item.foodType);
        const category = normalizeCategory(item.category) ?? normalizeCategory(inputMatch?.category) ?? null;
        const turnInAtSource = item.turnInAt ?? inputMatch?.turnInAt ?? null;
        let turnInAt: string | null = null;
        if (turnInAtSource) {
          const parsed = new Date(turnInAtSource);
          if (!Number.isNaN(parsed.getTime())) {
            turnInAt = parsed.toISOString();
          } else if (inputMatch?.turnInAt) {
            const fallback = new Date(inputMatch.turnInAt);
            if (!Number.isNaN(fallback.getTime())) {
              turnInAt = fallback.toISOString();
            }
          }
        }
        const boxPackAt = isCompetitionMode && turnInAt
          ? new Date(new Date(turnInAt).getTime() - BOX_PACK_LEAD_MS).toISOString()
          : null;

        let meatOnAt = item.meatOnAt;
        let grillLightAt = item.grillLightAt;
        let estimatedFinishAt = item.estimatedFinishAt;
        let warning: string | null = null;
        if (isCompetitionMode && boxPackAt) {
          const restMin = typeof item.restMinutes === "number" && item.restMinutes >= 0
            ? Math.round(item.restMinutes)
            : 0;
          const cookMinForCalc = typeof item.estimatedDurationMinutes === "number" && item.estimatedDurationMinutes > 0
            ? Math.round(item.estimatedDurationMinutes)
            : 0;
          const preheatFromAi = typeof item.preheatMinutes === "number" && item.preheatMinutes >= 0
            ? Math.round(item.preheatMinutes)
            : null;
          const preheatFromInput = typeof inputMatch?.preheatMinutes === "number" && inputMatch.preheatMinutes >= 0
            ? Math.round(inputMatch.preheatMinutes)
            : null;
          const preheatMin = preheatFromInput ?? preheatFromAi ?? 25;
          const boxMs = new Date(boxPackAt).getTime();
          if (!Number.isNaN(boxMs)) {
            const finishMs = boxMs - restMin * 60_000;
            const meatOnMs = finishMs - cookMinForCalc * 60_000;
            const lightMs = meatOnMs - preheatMin * 60_000;
            estimatedFinishAt = new Date(finishMs).toISOString();
            meatOnAt = new Date(meatOnMs).toISOString();
            grillLightAt = new Date(lightMs).toISOString();

            if (lightMs < nowMs) {
              warning = `You'd need to have started this cook at ${formatPastTime(lightMs)} to make turn-in. The schedule isn't achievable as planned — push this turn-in later or shorten the cook.`;
            } else if (
              lightMs - nowMs < IMMINENT_GRACE_MS &&
              cookMinForCalc >= LONG_COOK_MIN
            ) {
              const minsAway = Math.max(1, Math.round((lightMs - nowMs) / 60_000));
              warning = `You'd need to light the grill in just ${minsAway} min for a ${Math.round(cookMinForCalc / 60)}h cook — that's tighter than realistic.`;
            }
          }
        }

        const walkMinutes = typeof inputMatch?.walkMinutes === "number" && inputMatch.walkMinutes > 0
          ? Math.round(inputMatch.walkMinutes)
          : null;

        return {
          ...item,
          meatOnAt,
          grillLightAt,
          estimatedFinishAt,
          wrapMethod,
          wrapAtMinutes,
          wrapTempF,
          wrapReason,
          category,
          turnInAt,
          boxPackAt,
          warning,
          ...(walkMinutes != null && { walkMinutes }),
        };
      })
      .sort(
        (a: any, b: any) => new Date(a.grillLightAt).getTime() - new Date(b.grillLightAt).getTime()
      );

    const firstItem = schedule[0];
    const lastItem = schedule[schedule.length - 1];
    let deterministicSummary = "";
    if (isCompetitionMode) {
      const cats = schedule
        .map((it: any) => it.category)
        .filter((c: any) => typeof c === "string");
      deterministicSummary = cats.length > 0
        ? `Competition day — ${cats.join(", ")}. First fire: ${firstItem?.foodType ?? "—"}.`
        : `Competition day plan ready.`;
    } else if (schedule.length >= 2) {
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
