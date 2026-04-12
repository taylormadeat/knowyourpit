import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, temperatureReadingsTable, cooksTable } from "@workspace/db";
import {
  UploadTemperatureDataBody,
  ListTemperatureReadingsQueryParams,
} from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";

const router: IRouter = Router();

router.post("/temperature/scan-image", async (req, res): Promise<void> => {
  const { base64Image, mimeType = "image/jpeg" } = req.body as { base64Image?: string; mimeType?: string };
  if (!base64Image || typeof base64Image !== "string") {
    res.status(400).json({ error: "base64Image is required" });
    return;
  }

  const systemPrompt = `You are a precise temperature data extraction assistant. Your only job is to look at images of thermometer displays, grill controllers, temperature graphs, printed cook logs, and similar BBQ-related temperature data, and extract structured temperature readings.

Return ONLY valid JSON — no markdown, no explanation, no extra text:
{
  "readings": [
    { "probeName": "string", "tempF": number, "recordedAt": "ISO8601 string" }
  ],
  "noDataFound": boolean,
  "rawExtraction": "string describing what you saw in the image"
}

Rules:
- probeName: Use the label shown (e.g. "Probe 1", "Meat", "Pit", "Ambient", "Food"). If unlabeled, use "Probe 1", "Probe 2", etc.
- tempF: Always convert to Fahrenheit if the image shows Celsius (multiply °C by 1.8 and add 32). Round to one decimal place.
- recordedAt: Use any timestamp visible in the image. If none is visible, use the current UTC time: ${new Date().toISOString()}
- If multiple readings are shown (e.g. a graph with multiple data points), extract the most recent / most prominent set.
- noDataFound: Set to true only if the image contains NO temperature data at all (e.g. it's a photo of food, a person, etc.)
- rawExtraction: Describe what you saw — probe names, temperatures, units, any visible display text.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: systemPrompt,
            },
          ],
        },
      ],
    });

    const content = response.choices[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

    let result: { readings: Array<{ probeName: string; tempF: number; recordedAt: string }>; noDataFound: boolean; rawExtraction: string | null };

    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { readings: [], noDataFound: true, rawExtraction: content };
    }

    res.json({
      readings: result.readings ?? [],
      noDataFound: result.noDataFound ?? result.readings?.length === 0,
      rawExtraction: result.rawExtraction ?? null,
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
  const rows = readings.map(r => ({
    cookId,
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
