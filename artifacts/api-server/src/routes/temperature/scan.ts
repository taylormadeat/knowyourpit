import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { aiRateLimit, ALLOWED_MIME_TYPES } from "./shared";

const router: IRouter = Router();

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

export default router;
