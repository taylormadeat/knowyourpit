import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, temperatureReadingsTable, cooksTable } from "@workspace/db";
import {
  UploadTemperatureDataBody,
  ListTemperatureReadingsQueryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

router.post("/temperature/scan-image", async (req, res): Promise<void> => {
  const { base64Image, mimeType = "image/jpeg" } = req.body as { base64Image?: string; mimeType?: string };
  if (!base64Image || typeof base64Image !== "string") {
    res.status(400).json({ error: "base64Image is required" });
    return;
  }
  const safeMime = typeof mimeType === "string" && ALLOWED_MIME_TYPES.has(mimeType) ? mimeType : "image/jpeg";

  const nowIso = new Date().toISOString();

  const systemPrompt = `You are a precision BBQ temperature data extraction assistant. You can read thermometer displays, grill controller screens, temperature graphs/charts, printed cook logs, and screenshots from apps like MEATER, ThermoWorks, FireBoard, Inkbird, and Govee.

Return ONLY valid JSON — no markdown, no explanation, no extra text:
{
  "readings": [
    { "probeName": "string", "tempF": number, "recordedAt": "ISO8601 UTC string" }
  ],
  "noDataFound": boolean,
  "rawExtraction": "string describing what you saw in the image",
  "detectedFoodType": "string or null",
  "detectedCookDate": "ISO8601 UTC string or null"
}

=== TEMPERATURE READINGS ===
- probeName: Use the label shown (e.g. "Probe 1", "Meat", "Pit", "Ambient", "Food", "Grill"). If unlabeled use "Probe 1", "Probe 2", etc.
- tempF: Convert Celsius to Fahrenheit if needed (°C × 1.8 + 32). Round to one decimal place.
- recordedAt: Use the timestamp shown for that reading. If no timestamp is visible, use: ${nowIso}

=== READING GRAPHS AND CHARTS ===
If the image is a time-series graph (temperature over time):
- Extract ALL visible data points along the entire timeline for EACH probe/series.
- Sample at meaningful intervals: aim for one reading every 15–30 minutes across the cook. Do not skip inflection points (stalls, wraps, spikes).
- Use the X-axis timestamps for recordedAt. If only elapsed time is shown (e.g. "2h 30m"), calculate absolute UTC times by working backwards from any end time shown, or use ${nowIso} as the reference for the final point.
- Extract every visible probe/series separately (Meat probe, Pit probe, etc.).
- Do NOT just extract the start and end — capture the full shape of the curve.

=== DETECTING FOOD TYPE ===
- Look for meat/food labels anywhere in the image: app UI, graph legend, cook session title, annotation text, receipt, or log entry.
- Common examples: "Brisket", "Pork Butt", "Ribs", "Chicken Thighs", "Whole Chicken", "Salmon", etc.
- Set detectedFoodType to the specific cut name as a plain string, or null if nothing is visible.

=== DETECTING COOK DATE ===
- Look for any date or time reference: graph X-axis dates, "Cook started:", "Session:", app header timestamps, file metadata text visible in screenshot, etc.
- Prefer the cook START time. If only an end time is visible, use that.
- Return as an ISO 8601 UTC string, or null if no date is visible.

=== GENERAL ===
- noDataFound: true ONLY if the image has absolutely no temperature data.
- rawExtraction: Briefly describe what you saw — probe labels, temperature values, graph shape, any text, food/date info.`;

  type ScanReading = { probeName: string; tempF: number; recordedAt: string };
  type ScanResult = {
    readings: ScanReading[];
    noDataFound: boolean;
    rawExtraction: string | null;
    detectedFoodType: string | null;
    detectedCookDate: string | null;
  };

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 4096,
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
              text: "Analyse this BBQ temperature image. Extract all temperature readings (including every data point from graphs), detect the food type and cook date if visible, and return structured JSON as instructed.",
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
      result = { readings: [], noDataFound: true, rawExtraction: content, detectedFoodType: null, detectedCookDate: null };
    }

    res.json({
      readings: result.readings ?? [],
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

router.post("/temperature/upload", async (req, res): Promise<void> => {
  const parsed = UploadTemperatureDataBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { cookId, source, readings } = parsed.data;

  // Auto-derive grillId from the associated cook
  const [cook] = await db.select({ grillId: cooksTable.grillId }).from(cooksTable).where(eq(cooksTable.id, cookId));
  const grillId = cook?.grillId ?? null;

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

router.get("/temperature/readings", async (req, res): Promise<void> => {
  const parsed = ListTemperatureReadingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const readings = await db.select().from(temperatureReadingsTable)
    .where(eq(temperatureReadingsTable.cookId, parsed.data.cookId))
    .orderBy(temperatureReadingsTable.recordedAt);
  res.json(readings);
});

export default router;
