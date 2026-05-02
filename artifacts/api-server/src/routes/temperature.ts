import { Router, type IRouter, type Request } from "express";
import { eq } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { db, temperatureReadingsTable, cooksTable } from "@workspace/db";
import {
  UploadTemperatureDataBody,
  ListTemperatureReadingsQueryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile } from "../lib/smokerCalibration";
import {
  FREE_AI_ANALYZE_DAILY_LIMIT,
  countAiAnalyzesToday,
  recordAiAnalyzeEvent,
  respondPaywall,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../lib/paywall";

interface AuthedRequest extends Request {
  userId: string;
}

const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many requests. Please wait before uploading again." },
});

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment before trying again." },
});

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// ── Live-cook analysis helpers ──────────────────────────────────────────────

interface LiveReading { timeMinutes: number; tempF: number; }

/** Least-squares linear regression slope in °F/min over the last N readings. */
function computeSlope(readings: LiveReading[], windowSize = 8): number | null {
  if (readings.length < 2) return null;
  const pts = readings.slice(-windowSize);
  const n = pts.length;
  const sumX = pts.reduce((s, r) => s + r.timeMinutes, 0);
  const sumY = pts.reduce((s, r) => s + r.tempF, 0);
  const sumXY = pts.reduce((s, r) => s + r.timeMinutes * r.tempF, 0);
  const sumX2 = pts.reduce((s, r) => s + r.timeMinutes * r.timeMinutes, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (Math.abs(denom) < 0.001) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

type CookPhase = "heat_up" | "stall" | "finishing" | "done";

/** Classify the current cook phase from slope + current temp. */
function detectPhase(
  slope: number | null,
  currentTempF: number,
  targetTempF?: number | null,
): CookPhase {
  if (targetTempF != null && currentTempF >= targetTempF - 5) return "done";
  if (currentTempF > 180) return "finishing";
  if (currentTempF < 140) return "heat_up";
  // 140–180°F zone: slope determines stall vs progress
  if (slope != null && Math.abs(slope) < 0.2) return "stall";
  return slope != null && slope > 0 ? "heat_up" : "stall";
}

/** Heuristic time-to-stall, stall duration, and time-to-finish estimates. */
function computeHeuristics(
  phase: CookPhase,
  currentTempF: number,
  slope: number | null,
  targetTempF?: number | null,
  weightLbs?: number | null,
  pitTempF?: number | null,
): { timeToStallMinutes: number | null; stallDurationMinutes: number | null; timeToFinishMinutes: number | null } {
  const STALL_ENTRY_TEMP = 158;   // °F — typical stall onset for large cuts
  const STALL_EXIT_TEMP  = 175;   // °F — stall breaks around here
  const FINISH_SLOPE     = 0.35;  // °F/min — average finishing rate at 225°F
  const pit = pitTempF && pitTempF > 150 ? pitTempF : 225;
  const pitFactor = pit / 225;    // scale stall duration and speeds by pit temp

  // Stall duration heuristic: ~10 min/lb at 225°F, adjusted for pit temp
  const stallDurationBase = weightLbs && weightLbs > 0 ? Math.round(weightLbs * 10 / pitFactor) : 90;
  const stallDuration = Math.min(Math.max(stallDurationBase, 45), 360);

  let timeToStall: number | null = null;
  let timeToFinish: number | null = null;

  if (phase === "heat_up") {
    timeToStall = slope && slope > 0.05
      ? Math.max(0, Math.round((STALL_ENTRY_TEMP - currentTempF) / slope))
      : null;
    const finishAfterStall = targetTempF
      ? Math.max(0, Math.round((targetTempF - STALL_EXIT_TEMP) / (FINISH_SLOPE * pitFactor)))
      : null;
    timeToFinish = timeToStall != null && finishAfterStall != null
      ? timeToStall + stallDuration + finishAfterStall
      : null;
  } else if (phase === "stall") {
    timeToStall = 0;
    const finishAfterStall = targetTempF
      ? Math.max(0, Math.round((targetTempF - STALL_EXIT_TEMP) / (FINISH_SLOPE * pitFactor)))
      : null;
    // Rough remaining stall: assume halfway through
    const remainingStall = Math.round(stallDuration * 0.5);
    timeToFinish = finishAfterStall != null ? remainingStall + finishAfterStall : null;
  } else if (phase === "finishing" && targetTempF) {
    timeToStall = 0;
    const s = slope && slope > 0.05 ? slope : FINISH_SLOPE * pitFactor;
    timeToFinish = Math.max(0, Math.round((targetTempF - currentTempF) / s));
  }

  return {
    timeToStallMinutes: timeToStall,
    stallDurationMinutes: phase !== "done" ? stallDuration : null,
    timeToFinishMinutes: timeToFinish,
  };
}

router.post("/temperature/scan-image", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  const { base64Image, mimeType = "image/jpeg" } = req.body as { base64Image?: string; mimeType?: string };
  if (!base64Image || typeof base64Image !== "string") {
    res.status(400).json({ error: "base64Image is required" });
    return;
  }
  const safeMime = typeof mimeType === "string" && ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : "image/jpeg";

  const systemPrompt = `You are a BBQ temperature summary extraction assistant. You can read thermometer displays, grill controller screens, temperature graphs/charts, printed cook logs, and screenshots from apps like MEATER, ThermoWorks, FireBoard, Inkbird, and Govee.

Return ONLY valid JSON — no markdown, no explanation, no extra text:
{
  "readings": [
    {
      "probeName": "string",
      "finishingTempF": number,
      "minTempF": number or null,
      "maxTempF": number or null
    }
  ],
  "cookDurationMinutes": number or null,
  "noDataFound": boolean,
  "rawExtraction": "string describing what you saw",
  "detectedFoodType": "string or null",
  "detectedCookDate": "ISO8601 UTC string or null"
}

=== PROBES ===
A probe is ONE physical temperature sensor. Extract ONE entry per probe — NOT one entry per timestamp.
- probeName: Use the label shown ("Probe 1", "Meat", "Pit", "Ambient", "Grill", "Food"). If unlabeled use "Probe 1", "Probe 2", etc.
- finishingTempF: The FINAL (last recorded) temperature for this probe. Convert °C → °F if needed (°C × 1.8 + 32). Round to one decimal.
- minTempF: The lowest temperature seen for this probe during the cook, or null if not determinable.
- maxTempF: The highest temperature seen for this probe during the cook, or null if not determinable.

CORRECT — 2 probes, one entry each with summary data:
{ "readings": [
    { "probeName": "Meat", "finishingTempF": 203.0, "minTempF": 72.0, "maxTempF": 203.0 },
    { "probeName": "Pit",  "finishingTempF": 247.0, "minTempF": 175.0, "maxTempF": 275.0 }
  ] }

WRONG — one entry per data point (DO NOT DO THIS):
{ "readings": [
    { "probeName": "Meat", "finishingTempF": 72  },
    { "probeName": "Meat", "finishingTempF": 145 },
    { "probeName": "Meat", "finishingTempF": 203 }
  ] }

=== COOK DURATION ===
- cookDurationMinutes: Total cook time in minutes (integer), or null if not determinable.
- Look for elapsed-time displays ("12h 34m"), graph X-axis span, "Cook started" / "Cook ended" timestamps, or session duration shown in the app.

=== FOOD TYPE ===
- detectedFoodType: Specific meat/food cut as a plain string ("Brisket", "Pork Butt", "Ribs", "Whole Chicken", etc.), or null.

=== COOK DATE ===
- detectedCookDate: Cook START date/time as ISO 8601 UTC, or null. Use end time if start is not visible.

=== GENERAL ===
- noDataFound: true ONLY if the image has absolutely no temperature data.
- rawExtraction: Brief description of what you saw — probe labels, temperatures, graph shape, food/date/duration info.`;

  type ScanReading = {
    probeName: string;
    finishingTempF: number;
    minTempF: number | null;
    maxTempF: number | null;
  };
  type ScanResult = {
    readings: ScanReading[];
    cookDurationMinutes: number | null;
    noDataFound: boolean;
    rawExtraction: string | null;
    detectedFoodType: string | null;
    detectedCookDate: string | null;
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${safeMime};base64,${base64Image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Analyse this BBQ temperature image. For each physical probe/sensor, extract its finishing temperature, min/max range, and overall cook duration. Return structured JSON as instructed.",
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let result: ScanResult;

    try {
      result = JSON.parse(cleaned) as ScanResult;
    } catch {
      result = { readings: [], cookDurationMinutes: null, noDataFound: true, rawExtraction: content, detectedFoodType: null, detectedCookDate: null };
    }

    res.json({
      readings: result.readings ?? [],
      cookDurationMinutes: result.cookDurationMinutes ?? null,
      noDataFound: result.noDataFound ?? (result.readings?.length === 0),
      rawExtraction: result.rawExtraction ?? null,
      detectedFoodType: result.detectedFoodType ?? null,
      detectedCookDate: result.detectedCookDate ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "scan-image error");
    res.status(500).json({ error: "Failed to scan image" });
  }
});

router.post("/temperature/analyze-cook", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
  // Free-tier daily AI analyze cap. We DO NOT increment the counter here —
  // we only block when already at the cap. The counter is recorded after a
  // successful analysis (see recordAiAnalyzeEvent below) so failed runs
  // don't burn the user's quota. This is the actual analyzer endpoint the
  // mobile UI hits via useAnalyzeCook (cooks/log.tsx + cooks/[id].tsx).
  const bypass = await userBypassesPaywall(req);
  if (!bypass) {
    const userId = (req as AuthedRequest).userId;
    const used = await countAiAnalyzesToday(userId);
    if (used >= FREE_AI_ANALYZE_DAILY_LIMIT) {
      respondPaywall(res, {
        code: "ai_analyze_limit_reached",
        limit: FREE_AI_ANALYZE_DAILY_LIMIT,
        used,
        resetsAt: startOfNextUtcDay().toISOString(),
        message: `You've used your ${FREE_AI_ANALYZE_DAILY_LIMIT} free analysis today. Upgrade to Pro for unlimited cook analyses.`,
      });
      return;
    }
  }

  const {
    images,
    cookNotes,
    cookContext,
  } = req.body as {
    images?: Array<{ base64?: string; mimeType?: string }>;
    cookNotes?: string | null;
    cookContext?: {
      foodType?: string;
      targetTempF?: number;
      cookTempF?: number;
      weightLbs?: number;
      wrapMethod?: string | null;
      wrapAtMinutes?: number | null;
      wrapTempF?: number | null;
      wrapReason?: string | null;
      restMinutes?: number | null;
      preheatMinutes?: number | null;
      actualStartAt?: string | null;
      plannedStartAt?: string | null;
      plannedEndAt?: string | null;
      userEnteredTempF?: number | null;
      liveReadings?: Array<{ timeMinutes: number; tempF: number }> | null;
      elapsedMinutes?: number | null;
      currentPitTempF?: number | null;
      outdoorTempF?: number | null;
      cookStatus?: string | null;
    } | null;
  };

  const isActiveCook = cookContext?.cookStatus === "active";

  const imageList = Array.isArray(images) ? images : [];
  if (imageList.length === 0 && !cookNotes?.trim() && !cookContext?.userEnteredTempF) {
    res.status(400).json({ error: "Provide at least one image, cook notes, or a temperature reading" });
    return;
  }
  if (imageList.length > 10) {
    res.status(400).json({ error: "Maximum 10 images allowed" });
    return;
  }
  for (const img of imageList) {
    if (!img.base64 || typeof img.base64 !== "string") {
      res.status(400).json({ error: "Each image must have a base64 field" });
      return;
    }
  }

  const imageContentParts = imageList.map((img) => {
    const safeMime =
      typeof img.mimeType === "string" && ALLOWED_MIME_TYPES.has(img.mimeType)
        ? img.mimeType
        : "image/jpeg";
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${safeMime};base64,${img.base64}`,
        detail: "high" as const,
      },
    };
  });

  // Build cook context section for the prompt
  const contextLines: string[] = [];
  if (cookContext?.foodType) contextLines.push(`Food: ${cookContext.foodType}`);
  if (cookContext?.weightLbs) contextLines.push(`Weight: ${cookContext.weightLbs} lbs`);
  if (cookContext?.cookTempF) contextLines.push(`Pit/cook temperature: ${cookContext.cookTempF}°F`);
  if (cookContext?.targetTempF) contextLines.push(`Target internal temp: ${cookContext.targetTempF}°F`);
  if (cookContext?.userEnteredTempF != null) contextLines.push(`Current internal meat temperature (probe reading — NOT the pit/grill temperature): ${cookContext.userEnteredTempF}°F`);
  if (cookContext?.outdoorTempF != null) contextLines.push(`Current outdoor/ambient air temperature: ${cookContext.outdoorTempF}°F (factor this into heat management, stall timing, and cold-weather adjustments)`);
  if (cookContext?.preheatMinutes) contextLines.push(`Preheat time: ${cookContext.preheatMinutes} min`);

  // Timing context — pass ISO strings directly so the AI interprets them correctly
  // (avoid server-side toLocaleString which would use UTC and confuse the AI)
  if (cookContext?.actualStartAt) contextLines.push(`Actual cook start time (ISO): ${cookContext.actualStartAt}`);
  if (cookContext?.plannedEndAt) contextLines.push(`Planned serve time (ISO): ${cookContext.plannedEndAt}`);

  // plannedStartAt in the DB is the GRILL LIGHT time (before preheat).
  // The planned meat-on time = plannedStartAt + preheatMinutes.
  // We compare that against actualStartAt (when meat actually went on) so the
  // deviation calculation is apples-to-apples.
  if (cookContext?.plannedStartAt) {
    const preheatMs = (cookContext?.preheatMinutes ?? 0) * 60 * 1000;
    const plannedMeatOnMs = new Date(cookContext.plannedStartAt).getTime() + preheatMs;
    contextLines.push(`Planned meat-on time (ISO): ${new Date(plannedMeatOnMs).toISOString()}`);

    if (cookContext?.actualStartAt) {
      const actualStart = new Date(cookContext.actualStartAt).getTime();
      const diffMin = Math.round((actualStart - plannedMeatOnMs) / 60000);
      if (Math.abs(diffMin) >= 5) {
        const timingNote = diffMin > 0
          ? `The cook started ${diffMin} minutes LATE vs the plan (meat went on later than planned).`
          : `The cook started ${Math.abs(diffMin)} minutes EARLY vs the plan.`;
        contextLines.push(timingNote);
      } else {
        contextLines.push("The cook started right on schedule.");
      }
    }
  }

  if (cookContext?.actualStartAt && cookContext?.plannedEndAt) {
    const actualStart = new Date(cookContext.actualStartAt).getTime();
    const serveTime = new Date(cookContext.plannedEndAt).getTime();
    const windowMin = Math.round((serveTime - actualStart) / 60000);
    if (windowMin > 0) contextLines.push(`Time window from actual cook start to planned serve time: ${windowMin} minutes`);
  }

  // AI plan data — enables plan-vs-actual grading
  if (cookContext?.wrapMethod && cookContext.wrapMethod !== "none") {
    const wrapLabel = cookContext.wrapMethod === "foil" ? "Foil (Texas Crutch)" : "Butcher Paper";
    const wrapParts = [`Planned wrap method: ${wrapLabel}`];
    if (cookContext.wrapAtMinutes) wrapParts.push(`at ${Math.floor(cookContext.wrapAtMinutes / 60)}h${cookContext.wrapAtMinutes % 60}m into cook`);
    if (cookContext.wrapTempF) wrapParts.push(`or when internal temp hits ${cookContext.wrapTempF}°F`);
    contextLines.push(wrapParts.join(" "));
    if (cookContext.wrapReason) contextLines.push(`Wrap rationale: ${cookContext.wrapReason}`);
  } else if (cookContext?.wrapMethod === "none") {
    contextLines.push("Planned wrap method: No wrap (naked cook)");
  }
  if (cookContext?.restMinutes) contextLines.push(`Planned rest time: ${cookContext.restMinutes} min`);

  // ── Live MEATER readings analysis ────────────────────────────────────────
  const rawLive = Array.isArray(cookContext?.liveReadings) ? cookContext.liveReadings : [];
  const validLive: LiveReading[] = rawLive.filter(
    (r): r is LiveReading =>
      r != null && typeof r.timeMinutes === "number" && typeof r.tempF === "number" &&
      isFinite(r.timeMinutes) && isFinite(r.tempF),
  );

  let phaseContext = "";
  let heuristicPhase: CookPhase | null = null;
  let heuristicEstimates: { timeToStallMinutes: number | null; stallDurationMinutes: number | null; timeToFinishMinutes: number | null } | null = null;

  if (validLive.length >= 2) {
    const slope = computeSlope(validLive);
    const currentTempF = cookContext?.userEnteredTempF ?? validLive[validLive.length - 1].tempF;
    heuristicPhase = detectPhase(slope, currentTempF, cookContext?.targetTempF);
    heuristicEstimates = computeHeuristics(
      heuristicPhase, currentTempF, slope,
      cookContext?.targetTempF, cookContext?.weightLbs, cookContext?.currentPitTempF ?? cookContext?.cookTempF,
    );

    const phaseLabels: Record<CookPhase, string> = {
      heat_up: "Heating Up", stall: "In the Stall", finishing: "Finishing", done: "Done",
    };
    const spanMin = validLive[validLive.length - 1].timeMinutes - validLive[0].timeMinutes;

    const hintLines: string[] = [
      `Live probe readings: ${validLive.length} data points spanning ${Math.round(spanMin)} minutes`,
      slope != null ? `Current rise rate (slope): ${slope.toFixed(2)}°F/min (smoothed over last ${Math.min(validLive.length, 8)} readings)` : "",
      `Current internal temp: ${currentTempF}°F`,
      `Detected cook phase: ${phaseLabels[heuristicPhase]}`,
    ];
    if (cookContext?.currentPitTempF) hintLines.push(`Current pit/ambient temp: ${cookContext.currentPitTempF}°F`);
    if (cookContext?.elapsedMinutes) hintLines.push(`Elapsed cook time: ${cookContext.elapsedMinutes} min`);
    if (heuristicEstimates.timeToStallMinutes != null) hintLines.push(`Heuristic estimate — time to stall: ~${heuristicEstimates.timeToStallMinutes} min`);
    if (heuristicEstimates.stallDurationMinutes != null) hintLines.push(`Heuristic estimate — stall duration: ~${heuristicEstimates.stallDurationMinutes} min`);
    if (heuristicEstimates.timeToFinishMinutes != null) hintLines.push(`Heuristic estimate — time to finish: ~${heuristicEstimates.timeToFinishMinutes} min`);

    // Include a snapshot of the readings
    const snapshot = validLive.slice(-5).map(r => `  ${r.timeMinutes.toFixed(0)}min: ${r.tempF}°F`).join("\n");
    hintLines.push(`Recent readings:\n${snapshot}`);

    phaseContext = `\n\nLIVE COOK DATA (real-time MEATER probe):\n${hintLines.filter(Boolean).join("\n")}`;
  }

  const contextBlock = contextLines.length > 0 || phaseContext
    ? `\n\nCook plan & context provided by pitmaster:\n${contextLines.join("\n")}\n\nNotes on interpreting this data:\n- All ISO timestamps above are in UTC. Convert them mentally to understand the cook timeline (e.g. "Planned serve time (ISO): 2026-04-20T23:00:00.000Z" means 6pm Eastern or 7pm Central, etc.).\n- "Planned meat-on time" is when the meat was supposed to go on the grill (after preheat). "Actual cook start time" is when the meat actually went on. These two are the correct pair to compare for timing adherence.\n- "Time window from actual cook start to planned serve time" is the total time available for the cook. Use this with the food type and weight to assess whether the pitmaster is on track.\n\nWhen assessing this cook:\n- Comment on whether the cook is on track to hit the planned serve time given the actual start and time window.\n- If started late, call out whether the serve window is at risk.\n- "Current internal meat temperature" is the MEAT's internal probe reading — this is what the pitmaster measured with their thermometer. It is NOT the pit/grill ambient temperature. Never use it as the pit temp in any decision.
- The pit/grill temperature is labeled "Pit/cook temperature" or "Current pit/ambient temp". If neither is provided, do not assume the pit temp from the meat probe reading.
- If a user-measured temperature is provided, compare it to the target internal temp: within ±5°F = on target, 6–15°F off = close, 16°F+ off = significant deviation.\n- When the pitmaster followed an AI plan, compare what actually happened to the plan — wrap timing, target temp, overall adherence.${phaseContext}`
    : phaseContext;

  const tempInsights = await computeSmokerInsights((req as AuthedRequest).userId);
  const tempSmokerProfile = formatSmokerProfile(tempInsights);

  const systemPrompt = `You are an expert BBQ pit master and cook analyst. You receive one or more photos from a cook (thermometer displays, grill screens, temperature app screenshots) plus optional notes from the pitmaster and optional cook parameters.

Your job is to:
1. Extract temperature data from the images
2. Reconstruct the cook timeline
3. Assess how the cook went and provide personalized improvement suggestions

Return ONLY valid JSON — no markdown, no explanation:
{
  "probes": [
    {
      "probeName": "string (e.g. Meat, Pit, Probe 1)",
      "finishingTempF": number,
      "minTempF": number or null,
      "maxTempF": number or null,
      "timeSeries": [{ "timeMinutes": number, "tempF": number }]
    }
  ],
  "events": [
    {
      "type": "wrap|stall|spike|done|note",
      "timeMinutes": number,
      "description": "plain-English description"
    }
  ],
  "cookDurationMinutes": number or null,
  "noDataFound": boolean,
  "rawExtraction": "brief description of what you saw",
  "detectedFoodType": "string or null — specific cut (e.g. 'Brisket', 'Pork Butt', 'Baby Back Ribs')",
  "detectedCookDate": "ISO8601 UTC string or null — when the cook started",
  "detectedWeightLbs": number or null,
  "detectedCookTempF": number or null,
  "detectedTargetTempF": number or null,
  "detectedGrillBrand": "string or null — brand/model visible in image or notes",
  "detectedWoodType": "string or null — wood/pellet type used if mentioned",
  "detectedRub": "string or null — rub or seasoning mentioned",
  "assessment": {
    "verdict": "perfect" | "overcooked" | "undercooked" | "good" | "needs_work",
    "summary": "One sentence overall assessment of how the cook went",
    "whatWentWell": ["string — something specific that went well"],
    "suggestions": [
      "Specific actionable improvement for next cook",
      "Another specific improvement",
      "Another specific improvement"
    ]
  },
  "phasePrediction": {
    "phase": "heat_up" | "stall" | "finishing" | "done",
    "phaseLabel": "Heating Up" | "In the Stall" | "Finishing" | "Done!",
    "timeToStallMinutes": number or null,
    "stallDurationMinutes": number or null,
    "timeToFinishMinutes": number or null,
    "narrative": "string — conversational pitmaster voice, e.g. 'You\\'ll hit the stall in about 42 minutes. Expect a solid 2.5 hour plateau at this weight and pit temp. Wrap in butcher paper as it enters stall to push through faster.'"
  } or null,
  "decisions": [
    {
      "action": "wrap" | "spritz" | "increase_pit" | "decrease_pit" | "pull" | "recover_schedule" | "maintain",
      "urgency": "now" | "soon" | "when_ready",
      "instruction": "string — direct command in second person, e.g. 'Wrap in butcher paper now to push through the stall'",
      "rationale": "string — specific why with actual numbers, e.g. 'At 158°F with a 0.05°F/min rise rate you\\'ve been plateaued 45 min. Foil crutch cuts remaining stall time 40-60%.'",
      "targetValue": number or null
    }
  ]
}

=== PROBES ===
Extract ONE entry per physical probe. Build a timeSeries of up to 20 data points.
- Use multiple images as time anchors; fill curves realistically between them using BBQ physics.
- timeMinutes: elapsed from cook START (0 = food hits grill).
- finishingTempF: last/highest recorded temp for this probe.
- A "Pit" or "Ambient" probe tracks grill temperature; "Meat" or numbered probes track internal temp.

=== COOK DETAILS (auto-detection) ===
detectedWeightLbs: extract from notes if mentioned (e.g. "12 lb brisket" → 12). null if not found.
detectedCookTempF: the grill/pit/ambient temperature. Use the Pit probe's most stable temperature range,
  or extract from notes ("ran at 225°F", "set to 250°F"). null if not found.
detectedTargetTempF: target internal temperature for the meat. Use the "done" event temperature,
  or the meat probe's highest reading if it plateaued there, or extract from notes ("pulled at 203°F").
  Use standard targets if clear (brisket=203, pork butt=205, chicken=165, ribs=195, steak=135). null if uncertain.
detectedGrillBrand: visible grill brand/model from images (e.g. "Traeger Ironwood 885", "Weber Kettle")
  or from notes. null if not visible or mentioned.
detectedWoodType: wood/pellet type from notes or packaging visible in images. null if not mentioned.
detectedRub: seasoning/rub name from notes. null if not mentioned.

=== EVENTS ===
- "stall": extended plateau 150–175°F on meat probe (the Texas crutch stall)
- "wrap": temp drop/plateau — pitmaster wrapped the meat in foil or butcher paper
- "spike": brief sharp temp increase (fuel added, lid opened, flare-up)
- "done": probe reached finishing/target temperature
- "note": any event from cook notes not visible in images

=== ASSESSMENT ===
verdict:
- "perfect": meat hit target temp within ±5°F, stable pit, on time, no major issues
- "overcooked": meat exceeded target by 10°F+ or cook noticeably longer than typical
- "undercooked": meat did not reach safe/target temp
- "good": minor deviations but overall a solid cook
- "needs_work": significant temp swings, missed target, started very late, or other notable problems

When a user-measured temperature is provided, compare it to the target:
- Within ±5°F of target → count as hitting target (factor positively into verdict)
- 6–15°F off target → note the gap in your assessment
- 16°F+ off target → significant deviation, factor negatively into verdict

When timing data (actual start vs planned start, planned serve time) is provided:
- Mention whether the cook is on track to hit the serve time given the start time
- If started late, factor in whether the serve window is at risk
- Acknowledge good timing discipline when on schedule

whatWentWell: 2-3 specific things that went right (e.g. "Pit held steady at 225°F throughout")
suggestions: 3-5 specific, actionable improvements. Reference actual temperatures and timing. Coach like a seasoned pit master.

If cook context is provided, use those values to fill any gaps and assess against stated targets.
If noDataFound is true, still assess and suggest based on cook notes and any provided context alone.

${isActiveCook ? `=== ACTIVE COOK MODE — LIVE LANGUAGE REQUIRED ===
This cook is IN PROGRESS RIGHT NOW. The pitmaster is checking in mid-cook for live guidance, NOT reviewing a finished cook. You MUST write the assessment in present tense as a live status report:

- "summary": ONE sentence describing what is happening RIGHT NOW. Use present tense. Reference current temp, current phase, and on-track status. Examples:
  ✅ "You're cruising through the stall at 162°F — pit is steady at 225°F and you're tracking on time for serve."
  ✅ "Internal just hit 195°F and the slope is flattening — finishing window opens in roughly 30 minutes."
  ❌ DO NOT say "The cook went well" or "You hit your target" or anything past tense.

- "whatWentWell": 2-3 things going RIGHT at this moment. Present tense, observational. Examples:
  ✅ "Pit is holding rock-steady at 224°F"
  ✅ "Stall recovery is on track — slope picked back up to 0.4°F/min"
  ❌ NOT "Pit held steady" (past tense)

- "suggestions": 2-4 things to ADJUST OR DO NOW (or in the next 30-60 minutes), NOT advice for a future cook. Present/imperative tense. Examples:
  ✅ "Spritz with apple juice in the next 15 minutes — bark is starting to firm up"
  ✅ "Crack the bottom vent another 1/4 turn — pit drifted down 8°F over the last reading window"
  ❌ NOT "Next time, try wrapping earlier" — that's for completed cooks only.

- "verdict": choose based on CURRENT trajectory, not finished outcome:
  - "perfect": cook is on track, no concerns
  - "good": minor adjustments suggested but trending well
  - "needs_work": at-risk for serve time or temp targets without intervention
  - "undercooked"/"overcooked": only if literally at finishing temp and over/under
` : ""}

=== PHASE PREDICTION ===
Only populate "phasePrediction" when LIVE COOK DATA is present in the context. Otherwise set it to null.

When live data IS present:
- "phase": use the detected phase from context. Validate against slope + current temp.
- "phaseLabel": human-readable label matching the phase.
- "timeToStallMinutes": only relevant in heat_up phase. Use heuristic estimates as a starting point, then adjust based on:
  - current slope (faster rise = sooner stall)
  - pit temp (higher pit temp = slightly earlier stall onset)
  - food type (chicken/fish don't stall; pork/beef always do)
  - null if not applicable (already in stall, finishing, or done; or food type doesn't stall)
- "stallDurationMinutes": expected total stall length. Null if phase is "finishing" or "done".
  - Scales with weight: heavier = longer stall (~8-12 min/lb at 225°F for unwrapped)
  - Foil wrap (Texas Crutch): cuts stall duration by 40-60%
  - Higher pit temp: shorter stall
  - If already IN stall, estimate the REMAINING stall duration (not total)
- "timeToFinishMinutes": estimated minutes until the cook is done. Refine the heuristic using:
  - Current slope and temp trajectory
  - Remaining stall time
  - Post-stall finishing rate (typically 0.3–0.5°F/min at 225°F)
  - Wrap method effects (Texas Crutch speeds finish, no-wrap is slower)
  - null if cook is "done"
- "narrative": 1-3 sentence pitmaster-voice prediction. Be specific with numbers (e.g. "~42 minutes", "2.5 hour plateau"). Include any action the pitmaster should take now (e.g. wrap tip, fuel check, vent adjustment). Keep it conversational and confident.

BBQ stall physics cheat sheet:
- Stall onset: typically 150–165°F internal (collagen breakdown + evaporative cooling)
- Stall duration: 12lb brisket unwrapped at 225°F = ~2.5-3.5 hours; foil wrapping cuts it to ~1-1.5 hours
- Post-stall: meat climbs again at ~0.3-0.5°F/min until target
- Brisket target: 200-205°F; Pork butt: 195-205°F; Ribs: 190-195°F (bend test); Chicken: 165°F (no stall)
- Stall can repeat briefly at 175°F on large cuts (second collagen breakdown)
- A rising pit temp will accelerate both the rate of rise and shorten the stall
- A dropping pit temp does the opposite — watch your fuel

=== DECISION ENGINE ===
The "decisions" array is the most important part of your response for ACTIVE cooks. It replaces vague status reports with specific, immediate commands. Think like a competition pitmaster coaching someone in real time.

ALWAYS return at least one decision. When everything is on track, use "maintain". For active cooks with live data, prioritize decisions over assessment. For completed-cook analysis, keep decisions brief (1-2 max), framed retrospectively ("Next cook: pull at 200°F to allow a 1h rest").

=== DECISION TRIGGERS ===

WRAP decision:
- Trigger: meat probe in stall (145–175°F, slope < 0.15°F/min) AND no wrap yet applied
- Trigger also: approaching stall (within 10°F of typical stall entry) AND behind schedule by 30+ min
- Urgency: "now" if already in stall; "soon" if within 10°F of stall
- instruction: name the wrap material — "Wrap tightly in foil (Texas Crutch)" or "Wrap in butcher paper to push through while preserving bark"
- Foil vs paper guidance: foil = fastest/most steam = tender bark; paper = slower/better bark = competition style
- targetValue: wrap temp if triggering early (e.g. 155)
- Skip if: already wrapped, chicken/fish/thin cuts, naked-cook plan where pitmaster has explicitly chosen no wrap

SPRITZ decision:
- Trigger: heat_up phase, temp > 140°F, no wrap in place, elapsed > 90 min
- Also trigger if bark looks at risk (mentioned in notes, very high pit temp, long cook time)
- Urgency: "soon" or "when_ready"
- instruction: specify liquid — apple cider vinegar, apple juice, water, or whatever is relevant
- rationale: bark building, evaporative cooling, color development
- Do NOT trigger if meat is wrapped or is chicken/fish

INCREASE_PIT decision:
- Trigger: behind schedule (time window shrinking) AND stall is dragging AND current pit ≤ 235°F
- Trigger also: pit temp reading shows actual temp has dropped from setpoint
- Urgency: "now" if serve window is at risk, "soon" if buffer exists
- targetValue: suggested new pit temp (usually 250-275°F)
- instruction: be specific — "Raise your pit to 250°F" not just "increase pit"
- rationale: quantify the time recovery — "+25°F saves roughly 20-30 min on this cook"
- Cap recommendation at 275°F to avoid overcooking the outside

DECREASE_PIT decision:
- Trigger: finishing phase, slope > 0.8°F/min (climbing fast), target within 15°F
- Trigger also: notes mention temp spike, flare-up, or accidental overshoot
- Urgency: "now" for runaway temp; "soon" for fast climb
- targetValue: suggested reduction (e.g. 215 if was at 250)
- rationale: "At this rate you'll overshoot your 203°F target by ~10°F in 20 min"

PULL decision:
- Trigger: temp within 10°F of target (active cook), or just hit/passed target
- Urgency: "now" if at/above target; "when_ready" if within 5-10°F
- instruction: specify exact pull temp + rest time + rest method
  - Brisket: "Pull at 200°F, rest 1-2h wrapped in butcher paper in a cooler"
  - Pork butt: "Pull at 200°F when it probes tender, rest 45 min tented in foil"
  - Ribs: "Pull when they pass the bend test — bones visible, slight crack, don't probe temp"
  - Chicken: "Pull at 160°F (carryover takes it to 165°F), rest 10 min tented"
- targetValue: pull temperature
- Include rest time in instruction — rest is part of the cook, not optional

RECOVER_SCHEDULE decision:
- Trigger: cook is behind schedule by 45+ min AND serve time is known AND stall/phase suggests it won't self-correct
- This is a multi-step recovery plan, not just one action
- instruction: list 2-3 concrete steps — e.g. "1) Foil wrap right now to cut stall short. 2) Raise pit to 260°F for the next 2 hours. 3) Pull slightly early at 198°F and rest 45 min in a foil-lined cooler."
- rationale: frame the math — "You're 75 min behind with 3h left. These steps can recover 60-90 min."
- urgency: "now"

MAINTAIN decision:
- Trigger: cook is on track, no actionable intervention needed
- Use when: temp climbing steadily, pit stable, on schedule, no stall issues
- urgency: "when_ready"
- instruction: reassure but with specifics — "Hold steady at 225°F — you're on pace for a perfect finish in ~2h 15m"
- Do NOT use maintain alongside urgent decisions — pick the most actionable ones

=== DECISION WRITING RULES ===
1. Instructions are commands, not questions. "Wrap now" not "Consider wrapping"
2. Use exact numbers whenever possible — temps, times, percentages
3. Lead with the action in the instruction: "Wrap in butcher paper now" not "Now would be a good time to wrap"
4. Keep instructions to 1 sentence. Put all the why in rationale.
5. Never duplicate information between instruction and rationale — instruction = WHAT, rationale = WHY
6. Maximum 3 decisions per response. Prioritize by urgency (now > soon > when_ready)
7. For completed cooks: preface instructions with "For your next cook:" to make retrospective framing clear
${tempSmokerProfile ? `\n${tempSmokerProfile}` : ""}`;

  type AnalyzeCookAIResult = {
    probes: Array<{
      probeName: string;
      finishingTempF: number;
      minTempF: number | null;
      maxTempF: number | null;
      timeSeries: Array<{ timeMinutes: number; tempF: number }>;
    }>;
    events: Array<{ type: string; timeMinutes: number; description: string }>;
    cookDurationMinutes: number | null;
    noDataFound: boolean;
    rawExtraction: string | null;
    detectedFoodType: string | null;
    detectedCookDate: string | null;
    detectedWeightLbs: number | null;
    detectedCookTempF: number | null;
    detectedTargetTempF: number | null;
    detectedGrillBrand: string | null;
    detectedWoodType: string | null;
    detectedRub: string | null;
    assessment?: {
      verdict: string;
      summary: string;
      whatWentWell: string[];
      suggestions: string[];
    };
    phasePrediction?: {
      phase: string;
      phaseLabel: string;
      timeToStallMinutes: number | null;
      stallDurationMinutes: number | null;
      timeToFinishMinutes: number | null;
      narrative: string;
    } | null;
    decisions?: Array<{
      action: string;
      urgency: string;
      instruction: string;
      rationale: string;
      targetValue: number | null;
    }>;
  };

  const notesBlock = cookNotes ? `\n\nPitmaster notes about this cook:\n${cookNotes}` : "";
  const imageDesc = imageList.length > 0
    ? `Analyse these ${imageList.length} BBQ cook image${imageList.length > 1 ? "s" : ""}.`
    : "No images provided — assess using the cook context and notes below.";
  const userText = `${imageDesc}${contextBlock}${notesBlock}\n\nReturn structured JSON as instructed.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 4000,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            ...imageContentParts,
            { type: "text" as const, text: userText },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let result: AnalyzeCookAIResult;
    try {
      result = JSON.parse(cleaned) as AnalyzeCookAIResult;
    } catch {
      result = {
        probes: [],
        events: [],
        cookDurationMinutes: null,
        noDataFound: true,
        rawExtraction: content,
        detectedFoodType: null,
        detectedCookDate: null,
      };
    }

    // ── Normalize/sanitize the AI response so downstream code never sees bad shapes ──
    const safeProbes = Array.isArray(result.probes)
      ? result.probes
          .filter((p) => p && typeof p === "object" && typeof p.probeName === "string")
          .map((p) => ({
            probeName: String(p.probeName),
            finishingTempF: typeof p.finishingTempF === "number" && isFinite(p.finishingTempF) ? p.finishingTempF : 0,
            minTempF: typeof p.minTempF === "number" && isFinite(p.minTempF) ? p.minTempF : null,
            maxTempF: typeof p.maxTempF === "number" && isFinite(p.maxTempF) ? p.maxTempF : null,
            timeSeries: Array.isArray(p.timeSeries)
              ? p.timeSeries
                  .filter(
                    (pt) =>
                      pt &&
                      typeof pt === "object" &&
                      typeof pt.timeMinutes === "number" && isFinite(pt.timeMinutes) &&
                      typeof pt.tempF === "number" && isFinite(pt.tempF)
                  )
                  .map((pt) => ({ timeMinutes: pt.timeMinutes, tempF: pt.tempF }))
                  .sort((a, b) => a.timeMinutes - b.timeMinutes)
              : [],
          }))
      : [];

    const safeEvents = Array.isArray(result.events)
      ? result.events
          .filter(
            (ev) =>
              ev &&
              typeof ev === "object" &&
              typeof ev.type === "string" &&
              typeof ev.timeMinutes === "number" && isFinite(ev.timeMinutes) &&
              typeof ev.description === "string"
          )
          .map((ev) => ({
            type: ev.type,
            timeMinutes: Math.max(0, ev.timeMinutes),
            description: String(ev.description),
          }))
      : [];

    const safeAssessment = result.assessment && typeof result.assessment === "object"
      ? {
          verdict: typeof result.assessment.verdict === "string" ? result.assessment.verdict : "needs_work",
          summary: typeof result.assessment.summary === "string" ? result.assessment.summary : "",
          whatWentWell: Array.isArray(result.assessment.whatWentWell) ? result.assessment.whatWentWell.filter((s: any) => typeof s === "string") : [],
          suggestions: Array.isArray(result.assessment.suggestions) ? result.assessment.suggestions.filter((s: any) => typeof s === "string") : [],
        }
      : null;

    const safeNum = (v: any) => (typeof v === "number" && isFinite(v) ? v : null);
    const safeStr = (v: any) => (typeof v === "string" && v.trim() ? v.trim() : null);

    // ── phasePrediction: AI result, with heuristic fallback if live data existed ──
    const VALID_PHASES = new Set(["heat_up", "stall", "finishing", "done"]);
    const PHASE_LABELS: Record<string, string> = {
      heat_up: "Heating Up", stall: "In the Stall", finishing: "Finishing", done: "Done!",
    };

    let safePhasePrediction: {
      phase: string; phaseLabel: string;
      timeToStallMinutes: number | null; stallDurationMinutes: number | null;
      timeToFinishMinutes: number | null; narrative: string;
    } | null = null;

    const aiPhase = result.phasePrediction;
    if (aiPhase && typeof aiPhase === "object" && VALID_PHASES.has(aiPhase.phase)) {
      safePhasePrediction = {
        phase: aiPhase.phase,
        phaseLabel: typeof aiPhase.phaseLabel === "string" ? aiPhase.phaseLabel : PHASE_LABELS[aiPhase.phase],
        timeToStallMinutes: safeNum(aiPhase.timeToStallMinutes),
        stallDurationMinutes: safeNum(aiPhase.stallDurationMinutes),
        timeToFinishMinutes: safeNum(aiPhase.timeToFinishMinutes),
        narrative: typeof aiPhase.narrative === "string" && aiPhase.narrative.trim() ? aiPhase.narrative.trim() : "",
      };
    } else if (heuristicPhase && heuristicEstimates) {
      // AI didn't return phasePrediction despite live data — use our heuristics
      safePhasePrediction = {
        phase: heuristicPhase,
        phaseLabel: PHASE_LABELS[heuristicPhase],
        timeToStallMinutes: heuristicEstimates.timeToStallMinutes,
        stallDurationMinutes: heuristicEstimates.stallDurationMinutes,
        timeToFinishMinutes: heuristicEstimates.timeToFinishMinutes,
        narrative: "",
      };
    }

    // ── decisions: sanitize and cap at 3 ────────────────────────────────────
    const VALID_ACTIONS = new Set(["wrap", "spritz", "increase_pit", "decrease_pit", "pull", "recover_schedule", "maintain"]);
    const VALID_URGENCY = new Set(["now", "soon", "when_ready"]);

    const safeDecisions: Array<{
      action: string; urgency: string;
      instruction: string; rationale: string; targetValue: number | null;
    }> = Array.isArray(result.decisions)
      ? result.decisions
          .filter((d: any) =>
            d && typeof d === "object" &&
            VALID_ACTIONS.has(d.action) &&
            VALID_URGENCY.has(d.urgency) &&
            typeof d.instruction === "string" && d.instruction.trim() &&
            typeof d.rationale === "string" && d.rationale.trim()
          )
          .slice(0, 3)
          .map((d: any) => ({
            action: d.action,
            urgency: d.urgency,
            instruction: d.instruction.trim(),
            rationale: d.rationale.trim(),
            targetValue: safeNum(d.targetValue),
          }))
      : [];

    // Record the analyze event AFTER a successful response so failed runs
    // (model errors, validation, etc.) don't burn a free user's daily quota.
    // We deliberately do NOT swallow the insert failure: if this throws, the
    // outer route handler returns 500 and the user is invited to retry. That
    // keeps the quota counter authoritative.
    if (!bypass) {
      await recordAiAnalyzeEvent((req as AuthedRequest).userId);
    }

    res.json({
      probes: safeProbes,
      events: safeEvents,
      cookDurationMinutes: safeNum(result.cookDurationMinutes),
      noDataFound: result.noDataFound ?? (safeProbes.length === 0),
      rawExtraction: safeStr(result.rawExtraction),
      detectedFoodType: safeStr(result.detectedFoodType),
      detectedCookDate: result.detectedCookDate ?? null,
      detectedWeightLbs: safeNum(result.detectedWeightLbs),
      detectedCookTempF: safeNum(result.detectedCookTempF),
      detectedTargetTempF: safeNum(result.detectedTargetTempF),
      detectedGrillBrand: safeStr(result.detectedGrillBrand),
      detectedWoodType: safeStr(result.detectedWoodType),
      detectedRub: safeStr(result.detectedRub),
      assessment: safeAssessment,
      phasePrediction: safePhasePrediction,
      decisions: safeDecisions,
    });
  } catch (err) {
    req.log.error({ err }, "analyze-cook error");
    res.status(500).json({ error: "Failed to analyze cook" });
  }
});

router.post("/temperature/upload", requireAuth, uploadRateLimit, async (req: any, res): Promise<void> => {
  const parsed = UploadTemperatureDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { cookId, source, readings } = parsed.data;
  const userId: string = req.userId;

  // Auto-derive grillId from the associated cook and verify ownership
  const [cook] = await db
    .select({ grillId: cooksTable.grillId, userId: cooksTable.userId })
    .from(cooksTable)
    .where(eq(cooksTable.id, cookId));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  if (cook.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const grillId = cook.grillId ?? null;

  const rows = readings.map(r => ({
    cookId,
    grillId,
    probeNumber: r.probeNumber,
    probeName: r.probeName ?? null,
    tempF: r.tempF,
    recordedAt: new Date(r.recordedAt),
    source,
  }));
  await db.insert(temperatureReadingsTable).values(rows);
  res.status(201).json({ inserted: rows.length, cookId });
});

router.get("/temperature/readings", requireAuth, async (req: any, res): Promise<void> => {
  const parsed = ListTemperatureReadingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId: string = req.userId;

  const [cook] = await db
    .select({ userId: cooksTable.userId })
    .from(cooksTable)
    .where(eq(cooksTable.id, parsed.data.cookId));

  if (!cook) {
    res.status(404).json({ error: "Cook not found" });
    return;
  }

  if (cook.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const readings = await db.select().from(temperatureReadingsTable)
    .where(eq(temperatureReadingsTable.cookId, parsed.data.cookId))
    .orderBy(temperatureReadingsTable.recordedAt);
  res.json(readings);
});

export default router;
