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
      model: "gpt-5.2",
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
    console.error("scan-image error:", err);
    res.status(500).json({ error: "Failed to scan image" });
  }
});

router.post("/temperature/analyze-cook", requireAuth, aiRateLimit, async (req, res): Promise<void> => {
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
    } | null;
  };

  if (!images || !Array.isArray(images) || images.length === 0) {
    res.status(400).json({ error: "images array is required and must be non-empty" });
    return;
  }
  if (images.length > 10) {
    res.status(400).json({ error: "Maximum 10 images allowed" });
    return;
  }
  for (const img of images) {
    if (!img.base64 || typeof img.base64 !== "string") {
      res.status(400).json({ error: "Each image must have a base64 field" });
      return;
    }
  }

  const imageContentParts = images.map((img) => {
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
  if (cookContext?.preheatMinutes) contextLines.push(`Preheat time: ${cookContext.preheatMinutes} min`);
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
  const contextBlock = contextLines.length > 0
    ? `\n\nCook plan & context provided by pitmaster:\n${contextLines.join("\n")}\n\nWhen the pitmaster followed an AI plan, compare what actually happened to the plan in your assessment — did they follow the wrap timing? Did the meat hit the planned target? Mention any deviations in your suggestions.`
    : "";

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
  }
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
- "perfect": meat hit target temp within ±5°F, stable pit, no major issues
- "overcooked": meat exceeded target by 10°F+ or cook noticeably longer than typical
- "undercooked": meat did not reach safe/target temp
- "good": minor deviations but overall a solid cook
- "needs_work": significant temp swings, missed target, or other notable problems

whatWentWell: 2-3 specific things that went right (e.g. "Pit held steady at 225°F throughout")
suggestions: 3-5 specific, actionable improvements. Reference actual temperatures and timing. Coach like a seasoned pit master.

If cook context is provided, use those values to fill any gaps and assess against stated targets.
If noDataFound is true, still assess and suggest based on cook notes alone.`;

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
  };

  const notesBlock = cookNotes ? `\n\nPitmaster notes about this cook:\n${cookNotes}` : "";
  const userText = `Analyse these ${images.length} BBQ cook image${images.length > 1 ? "s" : ""}.${contextBlock}${notesBlock}\n\nReturn structured JSON as instructed.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 3000,
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
    });
  } catch (err) {
    console.error("analyze-cook error:", err);
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
