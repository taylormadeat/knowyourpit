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

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

router.post("/temperature/scan-image", requireAuth, async (req, res): Promise<void> => {
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

router.post("/temperature/analyze-cook", requireAuth, async (req, res): Promise<void> => {
  const { images, cookNotes } = req.body as {
    images?: Array<{ base64?: string; mimeType?: string }>;
    cookNotes?: string | null;
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

  const systemPrompt = `You are an expert BBQ cook analyst. You receive one or more photos taken at different stages of a cook (thermometer displays, grill screens, temperature app screenshots) plus optional cook notes from the pitmaster.

Your job is to synthesize all evidence into a structured cook timeline. Return ONLY valid JSON — no markdown, no explanation:
{
  "probes": [
    {
      "probeName": "string (e.g. Meat, Pit, Probe 1)",
      "finishingTempF": number,
      "minTempF": number or null,
      "maxTempF": number or null,
      "timeSeries": [
        { "timeMinutes": number, "tempF": number }
      ]
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
  "detectedFoodType": "string or null",
  "detectedCookDate": "ISO8601 UTC string or null"
}

=== PROBES ===
Extract ONE entry per physical probe. synthesize timeSeries of up to 20 data points representing the temperature curve over the cook.
- If multiple images show different timestamps for the same probe, use them as anchors for the time series.
- Fill in a realistic temperature curve between known data points based on BBQ physics (the stall, gradual rise, etc.).
- timeMinutes: minutes elapsed from the START of the cook (0 = cook start).
- finishingTempF: the highest/last recorded temperature for this probe.
- minTempF, maxTempF: from across all images.

=== EVENTS ===
Detect meaningful events and explain them in plain English:
- "wrap": sudden drop in probe temperature followed by a plateau or slower climb — pitmaster likely wrapped in foil or butcher paper.
- "stall": extended plateau (the Texas crutch stall) typically between 150–175°F on meat probes.
- "spike": brief sharp temperature increase (e.g. adding more fuel, opening lid).
- "done": probe reached target/finishing temperature.
- "note": any other notable event from the cook notes or images.
If the cook notes mention an event (e.g. "pulled to wrap at hour 6"), create a corresponding event even if not visible in images.

=== COOK DURATION ===
cookDurationMinutes: total minutes from first image's start to last image's end, or null if not determinable.

=== FOOD TYPE & DATE ===
detectedFoodType: specific meat cut ("Brisket", "Pork Butt", etc.) or null.
detectedCookDate: cook START as ISO 8601 UTC, or null.

=== GENERAL ===
noDataFound: true ONLY if there is absolutely no temperature data in any image.
rawExtraction: 1-2 sentences describing what you saw across all images.`;

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
  };

  const userText =
    cookNotes
      ? `Analyse these ${images.length} BBQ cook image${images.length > 1 ? "s" : ""}.\n\nPitmaster notes:\n${cookNotes}\n\nReturn structured JSON as instructed.`
      : `Analyse these ${images.length} BBQ cook image${images.length > 1 ? "s" : ""}. Return structured JSON as instructed.`;

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

    res.json({
      probes: safeProbes,
      events: safeEvents,
      cookDurationMinutes: typeof result.cookDurationMinutes === "number" && isFinite(result.cookDurationMinutes)
        ? result.cookDurationMinutes
        : null,
      noDataFound: result.noDataFound ?? (safeProbes.length === 0),
      rawExtraction: result.rawExtraction ?? null,
      detectedFoodType: result.detectedFoodType ?? null,
      detectedCookDate: result.detectedCookDate ?? null,
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
