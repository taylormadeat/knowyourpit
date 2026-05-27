import { Router, type IRouter, type Request } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { db, cookEvents, cooksTable, cookPhotosTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { objectStorageClient } from "../../lib/objectStorage";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";
import {
  FREE_AI_ANALYZE_DAILY_LIMIT,
  countAiAnalyzesToday,
  recordAiAnalyzeEvent,
  respondPaywall,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../../lib/paywall";
import {
  aiRateLimit,
  ALLOWED_MIME_TYPES,
  detectImageMime,
  type AuthedRequest,
  type LiveReading,
  type CookPhase,
  computeSlope,
  detectPhase,
  computeHeuristics,
} from "./shared";
import { buildAnalyzeSystemPrompt } from "./analyzePrompt";

const router: IRouter = Router();

router.post("/temperature/analyze-cook", requireAuth, aiRateLimit, async (req: Request, res): Promise<void> => {
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
    cookId,
    cookContext,
  } = req.body as {
    images?: Array<{ base64?: string; mimeType?: string }>;
    cookNotes?: string | null;
    cookId?: number | null;
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
      cookingMethod?: string | null;
      injection?: string | null;
      spritzFrequency?: string | null;
      wrapFinish?: string | null;
      // Frozen-meat fields
      // actualStartAt = meat-on time (already in type above)
      // actualThawStartAt = when the thaw actually started
      // thaw duration = actualStartAt - actualThawStartAt
      // active cook duration = actualEndAt - actualStartAt
      fromFrozen?: boolean | null;
      thawMethod?: string | null;
      actualThawStartAt?: string | null;
      actualEndAt?: string | null;
      // Multi-channel probe readings: all active channels from a LAN/BLE device
      // (e.g. Fireboard with 4 probes, ThermoWorks Signals, MEATER Block).
      // The first selected channel's reading is still passed as userEnteredTempF
      // for backward-compat; probeChannels gives PitMaster the full picture.
      probeChannels?: Array<{ channelLabel: string; probeTempF: number }> | null;
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
  const resolvedImages: Array<{ base64: string; resolvedMime: string }> = [];
  for (const img of imageList) {
    if (!img.base64 || typeof img.base64 !== "string") {
      res.status(400).json({ error: "Each image must have a base64 field" });
      return;
    }
    // Sniff actual bytes — client-declared mimeType can be wrong (e.g. iOS
    // photo picker returns HEIC even when quality compression is requested).
    const detected = detectImageMime(img.base64);
    if (detected === "image/heic") {
      res.status(400).json({
        error: "HEIC images are not supported. Take a screenshot of your thermometer app instead of uploading from your photo library, or save the image as JPEG or PNG before uploading.",
      });
      return;
    }
    // Use detected format when available and supported; fall back to the
    // client-declared type if detection was inconclusive (unknown format).
    const resolvedMime =
      detected && ALLOWED_MIME_TYPES.has(detected)
        ? detected
        : (typeof img.mimeType === "string" && ALLOWED_MIME_TYPES.has(img.mimeType)
          ? img.mimeType
          : "image/jpeg");
    resolvedImages.push({ base64: img.base64, resolvedMime });
  }

  const imageContentParts = resolvedImages.map(({ base64, resolvedMime }) => {
    return {
      type: "image_url" as const,
      image_url: {
        url: `data:${resolvedMime};base64,${base64}`,
        detail: "high" as const,
      },
    };
  });

  // ── Fetch cook log photos and append them to the analysis ────────────────
  // When a cookId is provided we pull the user's stored cook photos from
  // object storage (up to 5, prioritising the most recent) and send them
  // alongside any thermometer screenshots the client uploaded.  This lets
  // the AI comment on bark colour, smoke ring, moisture, probe placement,
  // char, and overall finished appearance without the user having to
  // re-upload anything.
  let cookPhotosIncluded = 0;
  const cookPhotoImageParts: Array<{ type: "image_url"; image_url: { url: string; detail: "high" } }> = [];

  if (typeof cookId === "number" && isFinite(cookId)) {
    const userId = (req as AuthedRequest).userId;
    // Leave headroom so user-uploaded images are never pushed out
    const maxCookPhotos = Math.max(0, 10 - imageContentParts.length);
    if (maxCookPhotos > 0) {
      try {
        const photos = await db
          .select()
          .from(cookPhotosTable)
          .where(and(eq(cookPhotosTable.cookId, cookId), eq(cookPhotosTable.userId, userId)))
          .orderBy(cookPhotosTable.createdAt)
          .limit(maxCookPhotos);

        const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
        if (bucketId && photos.length > 0) {
          await Promise.all(
            photos.map(async (photo) => {
              try {
                const bucket = objectStorageClient.bucket(bucketId);
                const [contents] = await bucket.file(photo.storageKey).download();
                const base64 = (contents as Buffer).toString("base64");
                const detected = detectImageMime(base64);
                const mime =
                  detected && ALLOWED_MIME_TYPES.has(detected) ? detected : "image/jpeg";
                cookPhotoImageParts.push({
                  type: "image_url" as const,
                  image_url: { url: `data:${mime};base64,${base64}`, detail: "high" as const },
                });
                cookPhotosIncluded++;
              } catch (photoErr: any) {
                req.log.warn(
                  { err: photoErr?.message, storageKey: photo.storageKey },
                  "Skipping cook photo for analysis — download failed",
                );
              }
            }),
          );
        }
      } catch (dbErr: any) {
        req.log.warn({ err: dbErr?.message }, "Failed to query cook photos for analysis");
      }
    }
  }

  // Combine: user-uploaded images first, cook log photos appended after
  const allImageParts = [...imageContentParts, ...cookPhotoImageParts];

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

  // Technique quick-picks saved when the cook was planned
  const techniqueLines: string[] = [];
  if (cookContext?.cookingMethod) techniqueLines.push(`Cooking method: ${cookContext.cookingMethod}`);
  if (cookContext?.injection) techniqueLines.push(`Injection: ${cookContext.injection}`);
  if (cookContext?.spritzFrequency) {
    techniqueLines.push(`Spritz/Mop frequency: ${cookContext.spritzFrequency}`);
  }
  if (cookContext?.wrapFinish) techniqueLines.push(`Wrap/finish method: ${cookContext.wrapFinish}`);
  if (techniqueLines.length > 0) contextLines.push(`Techniques used: ${techniqueLines.join(" · ")}`);

  // ── Multi-channel probe readings ─────────────────────────────────────────
  // When a multi-probe device (Fireboard, ThermoWorks Signals, MEATER Block)
  // is connected we receive all active channel readings, not just the selected
  // one. Surface each channel by label so PitMaster can reason about done-ness
  // and stall detection across different meat zones simultaneously.
  const probeChannels = Array.isArray(cookContext?.probeChannels) ? cookContext.probeChannels : [];
  const validProbeChannels = probeChannels.filter(
    (ch): ch is { channelLabel: string; probeTempF: number } =>
      ch != null &&
      typeof ch.channelLabel === "string" && ch.channelLabel.trim().length > 0 &&
      typeof ch.probeTempF === "number" && isFinite(ch.probeTempF),
  );
  if (validProbeChannels.length > 1) {
    const channelLines = validProbeChannels
      .map((ch) => `  • ${ch.channelLabel}: ${ch.probeTempF}°F`)
      .join("\n");
    contextLines.push(
      `All active probe channels (multi-channel device):\n${channelLines}\n` +
      `(The "Current internal meat temperature" above is the selected/primary channel. ` +
      `Use all channels together to assess overall done-ness, detect stalls per zone, ` +
      `and flag any channels that are running significantly hotter or colder than expected.)`,
    );
  } else if (validProbeChannels.length === 1) {
    const ch = validProbeChannels[0]!;
    contextLines.push(`Probe channel: ${ch.channelLabel} — ${ch.probeTempF}°F`);
  }

  // ── Frozen-meat context ──────────────────────────────────────────────────
  // For frozen cooks we pass the thaw duration and active cook duration
  // separately so PitMaster can recommend the right lead time on future cooks.
  if (cookContext?.fromFrozen) {
    const thawMethodLabel = (() => {
      switch (cookContext.thawMethod) {
        case "fridge":
        case "refrigerator": return "refrigerator (~24h per 4-5 lbs, USDA-safe)";
        case "cold_water":   return "cold-water (~30 min per lb, change water every 30 min)";
        case "microwave":    return "microwave (cook immediately after)";
        case "counter":      return "counter (not recommended for food safety)";
        case "cook_from_frozen":
        case "cook-from-frozen": return "cook-from-frozen (no thaw, add ~50% cook time)";
        default: return cookContext.thawMethod ?? "not specified";
      }
    })();

    contextLines.push(`Started from frozen: YES`);
    contextLines.push(`Thaw method: ${thawMethodLabel}`);

    // Thaw duration: from when thaw started (actualThawStartAt) to when meat
    // went on the grill (actualStartAt). Active cook duration: actualStartAt
    // to actualEndAt. Both only emitted when timestamps are available.
    const meatOnStr = cookContext.actualStartAt;   // actual meat-on time
    const thawStartStr = cookContext.actualThawStartAt; // actual thaw start
    const actualEndStr = cookContext.actualEndAt;

    const fmtDur = (ms: number): string => {
      const totalMin = Math.round(ms / 60000);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    if (meatOnStr && thawStartStr) {
      const thawDurMs = new Date(meatOnStr).getTime() - new Date(thawStartStr).getTime();
      if (thawDurMs > 0) {
        contextLines.push(`Thaw duration (thaw start → meat on grill): ${fmtDur(thawDurMs)}`);
      }
    }

    if (meatOnStr && actualEndStr) {
      const activeDurMs = new Date(actualEndStr).getTime() - new Date(meatOnStr).getTime();
      if (activeDurMs > 0) {
        contextLines.push(`Active cook duration (grill time only, excludes thaw): ${fmtDur(activeDurMs)}`);
      }
    }
  }

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

  const systemPrompt = buildAnalyzeSystemPrompt({
    isActiveCook,
    smokerProfile: tempSmokerProfile,
  });

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

  const imageDesc = (() => {
    if (allImageParts.length === 0) {
      return "No images provided — assess using the cook context and notes below.";
    }
    const userImgCount = imageContentParts.length;
    if (cookPhotosIncluded === 0) {
      return `Analyse these ${userImgCount} BBQ cook image${userImgCount > 1 ? "s" : ""}.`;
    }
    if (userImgCount === 0) {
      return `Analyse these ${cookPhotosIncluded} cook log photo${cookPhotosIncluded > 1 ? "s" : ""} taken during this cook session. Look for visual cues like bark colour and texture, smoke ring, moisture levels, probe placement, char or crust development, and overall finished appearance.`;
    }
    return `Analyse these ${allImageParts.length} BBQ images: ${userImgCount} thermometer screenshot${userImgCount > 1 ? "s" : ""} plus ${cookPhotosIncluded} cook log photo${cookPhotosIncluded > 1 ? "s" : ""} from this session. For the cook photos look for visual cues like bark colour and texture, smoke ring, moisture, probe placement, char or crust development, and overall finished appearance.`;
  })();

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
            ...allImageParts,
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
        detectedWeightLbs: null,
        detectedCookTempF: null,
        detectedTargetTempF: null,
        detectedGrillBrand: null,
        detectedWoodType: null,
        detectedRub: null,
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

    // Save analysis to the Pit Journal when a cookId is provided.
    // We verify ownership before writing so a rogue client can't post
    // journal entries to another user's cook.
    if (typeof cookId === "number" && isFinite(cookId) && safeAssessment) {
      try {
        const userId = (req as AuthedRequest).userId;
        const [ownedCook] = await db
          .select({ id: cooksTable.id })
          .from(cooksTable)
          .where(and(eq(cooksTable.id, cookId), eq(cooksTable.userId, userId)));
        if (ownedCook) {
          await db.insert(cookEvents).values({
            cookId,
            eventType: "ai_analysis",
            note: safeAssessment.summary || null,
            metadata: {
              verdict: safeAssessment.verdict,
              summary: safeAssessment.summary,
              decisions: safeDecisions.slice(0, 3).map((d) => d.instruction),
            },
          });
        }
      } catch (journalErr) {
        // Journal writes are best-effort — don't fail the whole analysis
        req.log.warn({ err: journalErr }, "Failed to write ai_analysis journal entry");
      }
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
      cookPhotosIncluded,
      decisions: safeDecisions,
    });
  } catch (err) {
    req.log.error({ err }, "analyze-cook error");
    res.status(500).json({ error: "Failed to analyze cook" });
  }
});

export default router;
