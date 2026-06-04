import { Router, type IRouter } from "express";
import { eq, and, desc, avg, min, max, count, sql, inArray } from "drizzle-orm";
import { db, cooksTable, grillsTable, temperatureReadingsTable } from "@workspace/db";
import { AiPredictBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile, simplifyFoodType } from "../../lib/smokerCalibration";
import { aiRateLimit, isPitProbe, getAssessment } from "./shared";
import { getMeatBaseline } from "./meatBaselines";
import type { AiCheckinItem } from "@workspace/checkin-schedule";

export type { AiCheckinItem };

const router: IRouter = Router();

// ── Prediction AI-call cache ──────────────────────────────────────────────────
// The prediction AI call (gpt-4.1-mini) is the most expensive single call in
// the app. When a user opens the Plan tab multiple times without changing any
// cook parameters the inputs are identical and the AI output would be the same.
// Cache the raw AI prediction object for 30 minutes keyed by all input params +
// userId. The DB queries (fingerprint calibration, grill data) still run fresh
// on every request so calibration stays up-to-date; only the LLM call is skipped.

type PredictionAiOutput = {
  estimatedDurationMinutes: number;
  confidence: string;
  rationale: string;
  tips: string[];
  wrap: { wrapAtMinutes: number; method: string; wrapTempF: number | null; reason: string; restMinutes: number };
  checkins?: AiCheckinItem[] | null;
  recommendedServeAt: string | null;
  recommendedServeReason: string | null;
};
const predictionAiCache = new Map<string, { output: PredictionAiOutput; cachedAt: number }>();
const PREDICTION_CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function makePredictCacheKey(userId: string, p: ReturnType<typeof AiPredictBody.parse>): string {
  return JSON.stringify({
    u: userId,
    f: p.foodType,
    w: p.weightLbs ?? null,
    ct: p.cookTempF ?? null,
    tt: p.targetTempF ?? null,
    g: p.grillId ?? null,
    fr: p.fromFrozen ?? false,
    th: p.thawMethod ?? null,
    cm: p.cookingMethod ?? null,
    inj: p.injection ?? null,
    sp: p.spritzFrequency ?? null,
    wf: p.wrapFinish ?? null,
    ms: p.meatStartTemp ?? null,
    ot: p.outdoorTempF ?? null,
    n: p.notes ?? null,
    df: p.desiredFinishAt ?? null,
    pc: p.pieceCount ?? null,
    ic: p.isIndividualCook ?? null,
    sl: p.sizingLabel ?? null,
  });
}

router.post("/ai/predict", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiPredictBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { grillId, foodType, weightLbs, cookTempF, targetTempF, desiredFinishAt, preheatMinutes: clientPreheatMinutes, outdoorTempF, outdoorTempIsForecast, fromFrozen, thawMethod, cookingMethod, injection, spritzFrequency, wrapFinish, meatStartTemp, notes, pieceCount, isIndividualCook, sizingLabel } = parsed.data;

  const baseline = getMeatBaseline(foodType);

  let grillContext = "";
  let grillType = "";
  let grillTempContext = "";
  let grillLoadLevel: string | null = null;
  let grillLoadAddMins = 0;

  if (grillId) {
    const [grill] = await db.select().from(grillsTable)
      .where(and(eq(grillsTable.id, grillId), eq(grillsTable.userId, req.userId)));
    if (grill) {
      grillType = grill.type;
      const specs: string[] = [
        `${grill.name}`,
        `type: ${grill.type}`,
        grill.brand ? `brand: ${grill.brand}` : null,
        grill.model ? `model: ${grill.model}` : null,
        grill.minTempF != null && grill.maxTempF != null ? `temp range: ${grill.minTempF}°F–${grill.maxTempF}°F` : null,
        grill.cookingSurfaceSqIn != null ? `cooking surface: ${grill.cookingSurfaceSqIn} sq in` : null,
        grill.numProbes != null ? `${grill.numProbes} probe(s)` : null,
        grill.hopperSizeLbs != null ? `hopper: ${grill.hopperSizeLbs} lbs` : null,
        grill.wifiEnabled ? "WiFi-connected" : null,
        `total cooks logged: ${grill.totalCooks}`,
      ].filter(Boolean) as string[];
      grillContext = `Grill: ${specs.join(" · ")}`;

      if (grill.cookingSurfaceSqIn != null && pieceCount != null && pieceCount > 1 && isIndividualCook === false && weightLbs != null && weightLbs > 0) {
        const densityLbsPerSqIn = weightLbs / grill.cookingSurfaceSqIn;
        let loadLevel: string;
        let loadNote: string;
        if (densityLbsPerSqIn < 0.04) {
          loadLevel = "low";
          loadNote = "No significant impact on airflow or cook time.";
        } else if (densityLbsPerSqIn < 0.06) {
          loadLevel = "medium";
          loadNote = "Crowded grill — add 30–45 min to estimated cook time; rotate pieces for even cooking.";
        } else {
          loadLevel = "high";
          loadNote = "Heavily loaded grill — add 60–90 min to estimated cook time; stagger or rotate pieces to ensure even cook.";
        }
        grillContext += `\nGrill load: ${pieceCount} pieces on ${grill.cookingSurfaceSqIn} sq in (${densityLbsPerSqIn.toFixed(3)} lbs/sq in) — ${loadLevel} density. ${loadNote}`;
        if (loadLevel !== "low") {
          grillLoadLevel = loadLevel;
          grillLoadAddMins = loadLevel === "medium" ? 37 : 75;
        }
      }
    }

    // ── Pit-probe SQL filter (matches the isPitProbe keyword list) ─────────
    const pitProbeSql = sql`(${temperatureReadingsTable.probeName} ILIKE '%pit%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%ambient%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%grill%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%chamber%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%dome%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%lid%')`;

    // ── Aggregate pit stats in one SQL pass (replaces unbounded SELECT *) ──
    const [pitStats] = await db.select({
      avgPit: avg(temperatureReadingsTable.tempF),
      minPit: min(temperatureReadingsTable.tempF),
      maxPit: max(temperatureReadingsTable.tempF),
      totalReadings: count(),
    }).from(temperatureReadingsTable)
      .where(and(eq(temperatureReadingsTable.grillId, grillId), pitProbeSql));

    // Per-cook swing (MAX - MIN pit temp) grouped in SQL — used for variance.
    const perCookSwing = await db.select({
      cookId: temperatureReadingsTable.cookId,
      swing: sql<number>`MAX(${temperatureReadingsTable.tempF}) - MIN(${temperatureReadingsTable.tempF})`,
    }).from(temperatureReadingsTable)
      .where(and(eq(temperatureReadingsTable.grillId, grillId), pitProbeSql))
      .groupBy(temperatureReadingsTable.cookId);

    if (pitStats && pitStats.totalReadings > 0) {
      const avgPit = parseFloat(pitStats.avgPit ?? "0");
      const minPit = pitStats.minPit ?? 0;
      const maxPit = pitStats.maxPit ?? 0;
      const variances = perCookSwing.map(r => r.swing ?? 0);
      const avgVariance = variances.reduce((a, b) => a + b, 0) / Math.max(variances.length, 1);

      grillTempContext = `
Grill historical temperature performance (${pitStats.totalReadings} pit-probe readings across ${perCookSwing.length} cooks):
- Average pit/ambient temperature achieved: ${avgPit.toFixed(1)}°F
- Pit temp range across all readings: ${minPit.toFixed(1)}°F – ${maxPit.toFixed(1)}°F
- Average per-cook temperature swing: ±${(avgVariance / 2).toFixed(1)}°F
Note: Factor this grill's real-world temperature behavior into your estimate.`;
    }

    const recentCooksOnGrill = await db.select().from(cooksTable)
      .where(and(
        eq(cooksTable.grillId, grillId),
        eq(cooksTable.status, "completed"),
        eq(cooksTable.userId, req.userId),
      ))
      .orderBy(desc(cooksTable.actualEndAt))
      .limit(15);

    if (recentCooksOnGrill.length > 0) {
      const recentCookIds = recentCooksOnGrill.map(c => c.id);

      // ── Peak meat-probe temp: scoped to the 15 recent cook IDs only ───────
      // Replaces a second full-grill SELECT * that was filtered in JS.
      const notPitProbeSql = sql`(${temperatureReadingsTable.probeName} IS NULL
        OR (${temperatureReadingsTable.probeName} NOT ILIKE '%pit%'
        AND ${temperatureReadingsTable.probeName} NOT ILIKE '%ambient%'
        AND ${temperatureReadingsTable.probeName} NOT ILIKE '%grill%'
        AND ${temperatureReadingsTable.probeName} NOT ILIKE '%chamber%'
        AND ${temperatureReadingsTable.probeName} NOT ILIKE '%dome%'
        AND ${temperatureReadingsTable.probeName} NOT ILIKE '%lid%'))`;

      const peakProbeRows = await db.select({
        cookId: temperatureReadingsTable.cookId,
        peakTempF: max(temperatureReadingsTable.tempF),
      }).from(temperatureReadingsTable)
        .where(and(inArray(temperatureReadingsTable.cookId, recentCookIds), notPitProbeSql))
        .groupBy(temperatureReadingsTable.cookId);

      const peakProbeByCook: Record<number, number> = {};
      for (const row of peakProbeRows) {
        if (row.peakTempF != null) peakProbeByCook[row.cookId] = row.peakTempF;
      }

      const cookSummary = (c: typeof recentCooksOnGrill[0]) => {
        const durationMins = c.actualStartAt && c.actualEndAt
          ? Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000)
          : null;
        const minsPerLbActual = durationMins && c.weightLbs ? (durationMins / c.weightLbs).toFixed(0) : null;
        const peakTemp = peakProbeByCook[c.id] != null ? `, peak internal ${peakProbeByCook[c.id]}°F` : "";
        const ratings = [
          c.rating ? `overall ${c.rating}/5` : null,
          c.ratingTenderness ? `tenderness ${c.ratingTenderness}/5` : null,
          c.ratingBark ? `bark ${c.ratingBark}/5` : null,
          c.ratingFlavor ? `flavor ${c.ratingFlavor}/5` : null,
        ].filter(Boolean).join(" ");
        const wrap = c.wrapMethod && c.wrapMethod !== "none" ? `, wrapped: ${c.wrapMethod}` : "";
        const notes = c.notes ? `, notes: "${c.notes.substring(0, 80)}"` : "";
        return `  • ${c.foodType}${c.weightLbs ? ` (${c.weightLbs} lbs)` : ""}` +
          `${durationMins ? ` → ${durationMins} min total` : ""}` +
          `${minsPerLbActual ? ` (~${minsPerLbActual} min/lb)` : ""}` +
          `${c.cookTempF ? ` at ${c.cookTempF}°F` : ""}` +
          `${peakTemp}${wrap}${notes}` +
          `${ratings ? ` [${ratings}]` : ""}`;
      };

      const firstWord = foodType.toLowerCase().split(" ")[0];
      const similarCooksOnGrill = recentCooksOnGrill.filter(c =>
        c.foodType.toLowerCase().includes(firstWord)
      );

      if (similarCooksOnGrill.length > 0) {
        grillTempContext += `\n\nSimilar cooks on THIS grill (${similarCooksOnGrill.length} records — use these for precise calibration):\n` +
          similarCooksOnGrill.map(cookSummary).join("\n");
      }
      grillTempContext += `\n\nAll recent completed cooks on this grill (${recentCooksOnGrill.length} records):\n` +
        recentCooksOnGrill.map(cookSummary).join("\n");
    }
  }

  const preheatDefaults: Record<string, number> = {
    offset_smoker: 60, charcoal: 30, kamado: 45, pellet: 20, gas: 15, electric: 20, other: 30,
  };
  const normalizeType = (t: string) => t.toLowerCase().replace(/[\s-]+/g, "_");
  const preheatMinutes = clientPreheatMinutes ?? (grillType ? (preheatDefaults[normalizeType(grillType)] ?? 30) : 30);

  const allUserCooks = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.status, "completed"), eq(cooksTable.userId, req.userId)))
    .orderBy(desc(cooksTable.createdAt))
    .limit(30);

  const firstWord = foodType.toLowerCase().split(" ")[0];
  const similarCooksAllGrills = allUserCooks.filter(c =>
    c.foodType.toLowerCase().includes(firstWord)
  );

  const grillNameCache: Record<number, string> = {};
  for (const cook of similarCooksAllGrills) {
    if (cook.grillId && !grillNameCache[cook.grillId]) {
      const [g] = await db.select({ name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, cook.grillId));
      if (g) grillNameCache[cook.grillId] = g.name;
    }
  }

  const similarCookSummaries = similarCooksAllGrills.map(c => {
    const durationMins = c.actualStartAt && c.actualEndAt
      ? Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000)
      : null;
    const minsPerLbActual = durationMins && c.weightLbs ? `~${(durationMins / c.weightLbs).toFixed(0)} min/lb` : null;
    const grillName = c.grillId ? (grillNameCache[c.grillId] || "unknown grill") : "no grill";
    const ratings = [c.ratingTenderness ? `T:${c.ratingTenderness}` : null, c.ratingBark ? `B:${c.ratingBark}` : null, c.ratingFlavor ? `F:${c.ratingFlavor}` : null].filter(Boolean).join("/");
    const wrap = c.wrapMethod && c.wrapMethod !== "none" ? `, wrapped: ${c.wrapMethod}${c.wrapAtMinutes ? ` at ${c.wrapAtMinutes}min` : ""}` : "";
    const assessment = getAssessment(c.analysisResult);
    const verdict = assessment?.verdict ? ` → verdict: ${assessment.verdict}` : "";
    const tip = assessment?.suggestions?.[0] ? ` · tip: "${assessment.suggestions[0]}"` : "";
    return `  • ${c.foodType}${c.weightLbs ? ` (${c.weightLbs} lbs)` : ""}` +
      `${durationMins ? ` → ${durationMins} min` : ""}${minsPerLbActual ? ` (${minsPerLbActual})` : ""}` +
      `${c.cookTempF ? ` at ${c.cookTempF}°F` : ""} on ${grillName}${wrap}` +
      `${c.rating ? ` · rated ${c.rating}/5` : ""}${ratings ? ` [${ratings}]` : ""}${verdict}${tip}`;
  });

  const similarWithFeedback = similarCooksAllGrills.filter(c => {
    const hasRating = !!(c.ratingTenderness || c.ratingBark || c.ratingFlavor);
    const hasAssessment = !!getAssessment(c.analysisResult)?.verdict;
    return hasRating && hasAssessment;
  });
  const hasRichHistory = similarWithFeedback.length >= 2;

  const baselineSection = baseline ? `
VERIFIED BASELINE for "${foodType}" (from BBQ knowledge database):
- Standard cook time: ~${baseline.minsPerLb} min/lb at ${baseline.cookTempF}°F pit temp
- Target internal temp: ${baseline.targetTempF}°F
- Recommended rest: ${baseline.restMins} min
- Wrap recommendation: ${baseline.wrapRec}${baseline.wrapAtMins ? ` at ~${baseline.wrapAtMins} min into cook` : ""}${baseline.wrapTempF ? ` / ${baseline.wrapTempF}°F internal` : ""}
${baseline.wrapNote ? `- Wrap guidance: ${baseline.wrapNote}` : ""}
Use this as your primary baseline. Adjust based on actual user data, grill specifics, and any deviations noted.` : "";

  const userHistorySection = similarCookSummaries.length > 0
    ? `\nThis user's own history with similar cooks (${similarCookSummaries.length} records — strongest signal for personalized estimate):\n${similarCookSummaries.join("\n")}${hasRichHistory ? `\n\nIMPORTANT: This user has ${similarWithFeedback.length} prior cooks of this type with ratings and/or PitMaster assessments. You have rich feedback data — set confidence to "high" and directly incorporate the verdicts and tips from past cooks into your rationale and tips.` : ""}`
    : "\nNo similar cooks in user's history — rely on baseline knowledge and grill context.";

  const predictInsights = await computeSmokerInsights(req.userId);
  const predictSmokerProfile = formatSmokerProfile(predictInsights);

  const meatKey = simplifyFoodType(foodType);
  const grillInsights = grillId
    ? await computeSmokerInsights(req.userId, grillId)
    : null;
  const grillPattern = grillInsights?.durationByMeat?.[meatKey] ?? null;
  const userPattern = predictInsights.durationByMeat?.[meatKey] ?? null;

  let calibratedMinsPerLb: number | null = null;
  let calibrationSource: "grill" | "user" | null = null;
  let calibrationSampleSize = 0;
  let calibrationBaseline: number | null = null;
  let calibrationPctDiff: number | null = null;

  if (grillPattern && grillPattern.sampleSize >= 2) {
    calibratedMinsPerLb = grillPattern.actualMinsPerLb;
    calibrationSource = "grill";
    calibrationSampleSize = grillPattern.sampleSize;
    calibrationBaseline = grillPattern.baselineMinsPerLb;
    calibrationPctDiff = grillPattern.pctDiff;
  } else if (userPattern && userPattern.sampleSize >= 2) {
    calibratedMinsPerLb = userPattern.actualMinsPerLb;
    calibrationSource = "user";
    calibrationSampleSize = userPattern.sampleSize;
    calibrationBaseline = userPattern.baselineMinsPerLb;
    calibrationPctDiff = userPattern.pctDiff;
  }

  const pitBiasF = grillInsights?.pitBiasF ?? null;
  const significantBias = pitBiasF != null && Math.abs(pitBiasF) >= 3;

  const fingerprintGuidance = calibratedMinsPerLb != null
    ? `\n\n=== LEARNED PACE (ENFORCED SERVER-SIDE) ===\n${calibrationSource === "grill"
        ? `This grill has cooked ${meatKey.replace(/_/g, " ")} ${calibrationSampleSize} time${calibrationSampleSize === 1 ? "" : "s"} at an actual pace of ${calibratedMinsPerLb} min/lb.`
        : `Across all your grills, you've cooked ${meatKey.replace(/_/g, " ")} ${calibrationSampleSize} time${calibrationSampleSize === 1 ? "" : "s"} at an actual pace of ${calibratedMinsPerLb} min/lb.`} The final estimate will be derived from ${calibratedMinsPerLb} min/lb × weight, regardless of what you return — so calibrate your rationale and tips to match that pace and explicitly mention that this estimate uses the user's learned pace${calibrationSource === "grill" ? " on this grill" : ""}.${significantBias ? ` This grill also runs ${pitBiasF! > 0 ? "HOT" : "COLD"} by ~${Math.abs(pitBiasF!)}°F vs set point — set temp of ${cookTempF ?? 225}°F delivers ~${Math.round((cookTempF ?? 225) + pitBiasF!)}°F actual; factor that into your tips.` : ""}`
    : "";

  const systemPrompt = `You are PitMaster, the AI coach inside knowyourpit. You're a seasoned pit master — decades of low-and-slow behind you, competition wins on the wall. You're a friend standing next to the user at the pit, coaching them through the cook. Your predictions are grounded in real cook data and personal history — give the number, give the reason, trust the user to execute.

Talk like a pitmaster, not a chatbot. Use real BBQ vocabulary naturally. Sentence fragments are fine. Never hedge every answer. Never use: "I'd be happy to", "certainly", "absolutely", "great question", "as an AI", "please note", "leverage", "utilize".

Return ONLY valid JSON with this exact structure — no markdown, no extra text:
{
  "estimatedDurationMinutes": number,
  "confidence": "low" | "medium" | "high",
  "rationale": "string",
  "tips": ["string", "string", "string"],
  "wrap": {
    "wrapAtMinutes": number,
    "method": "foil" | "butcher_paper" | "none",
    "wrapTempF": number | null,
    "reason": "string",
    "restMinutes": number
  },
  "checkins": [
    {
      "offsetMinutes": number,
      "label": "string",
      "coachingNote": "string",
      "visualCues": ["string"],
      "expectedInternalTempRange": [number, number] | null
    }
  ],
  "recommendedServeAt": "ISO-8601 string" | null,
  "recommendedServeReason": "string" | null
}

CHECK-IN SCHEDULE RULES (required — generate checkins for every cook):
- checkins is an array of phase check-ins tailored to this exact cook: its meat, technique, timing, and grill.
- offsetMinutes is minutes after meatOnAt (not from start of day). Use the estimatedDurationMinutes you produced as the total cook window.
- Every coachingNote must be something the pitmaster will act on RIGHT NOW at that check-in — not general advice. Reference the specific meat, technique, or equipment.
- Every visualCues array has 2–4 items: concrete, sensory things to see/feel/smell at that moment.
- expectedInternalTempRange: the [min, max] band you expect the meat's internal temp to be in at this check-in. Set null only for check-ins where a probe reading isn't meaningful (e.g., a rest/hold check after pull).
- Number of check-ins by cook style:
  - Low & Slow (brisket, pork butt, ribs): 5–7 check-ins spanning the full cook
  - Medium cooks (chicken, turkey, lamb): 3–4 check-ins
  - Hot & Fast or short cooks (<2 hours): 2–3 check-ins, earlier in the cook
  - Rest/hold phase: add one final check-in offset past estimatedDurationMinutes (e.g., 30–60 min after)
- Wrap check-in MUST land at wrap.wrapAtMinutes (use the exact wrapAtMinutes you produced in wrap{}) if wrap.method is not "none". Label it "Wrap Check" or similar and reference the wrap method in the coachingNote.
- Spritzing cooks: cluster check-ins around the spritz window (first spritz, mid-cook spritz cadence, final check before pull). Reference the spritz in coaching notes.
- Mopping cooks: time check-ins around the mop cadence; note technique-specific bark and color cues.
- Hot & Fast: fewer check-ins, earlier (first at ~15–20% of cook), coaching language reflects fast pace — watch for rapid bark development, early color lock.
- The first check-in fires 10–20% into the cook (never less than 15 min into the cook) so the pitmaster has time to get the fire established.
- Labels must be descriptive and meat-specific: "Early Smoke", "Bark Lock", "Stall Entry", "Wrap Decision", "Money Muscle Check", "Probe Tender Check", "Rest & Hold", etc. Not generic.
- Do NOT produce generic percentage-based check-ins — every label, note, and timing must be bespoke to this cook.

CONFIDENCE RULES (apply strictly):
- "high": You have a verified baseline AND (user has similar cook history OR weight + both temps are specified). You can make a precise, calibrated estimate.
- "medium": You have a verified baseline OR grill history, but some key inputs are missing (weight unknown, no similar user history).
- "low": Unknown food type, no baseline, and no user history. Estimate is a broad guess only.

ESTIMATION RULES:
- estimatedDurationMinutes = ONLY active cook time (food on grill to reaching target temp). Does NOT include preheat or rest time.
- When baseline is available, start from baseline minsPerLb × weight, then adjust ±15% based on: actual cook temp vs baseline, grill type efficiency, user's own historical min/lb from similar cooks.
- Stall effect: for large cuts (brisket, pork butt) at 225°F, add 60–90 min for stall unless grill temp data shows consistent performance.
- wrap.wrapAtMinutes: minutes into the active cook when wrapping should happen (0 if no wrap)
- wrap.method: "butcher_paper" for bark preservation (brisket, beef ribs), "foil" for speed/moisture (pork, turkey, chicken), "none" for quick cooks (steak, wings, fish, chicken thighs)
- wrap.wrapTempF: internal meat temp at which to wrap, or null if time-based only
- wrap.reason: be specific — what method, what to add inside (tallow/butter/juice), how tight, what to expect after wrapping
- wrap.restMinutes: be realistic — brisket 60–120m (can go in cooler), pork butt 45–60m, ribs 15–30m, chicken 10–15m, steaks 5–10m, fish 3–5m
- tips: write 3 actionable, specific tips for THIS cook — not generic advice. Reference the specific food, grill type, or user's history if available.
- rationale: explain your estimate in 1–2 sentences, mentioning the baseline and any user data you used.

MEAT START TEMP RULES (apply when "Meat starting temperature" is provided):
- "Cold from Fridge": The meat goes onto the grill straight from refrigerator temperature (~38°F). For large cuts over 5 lbs (brisket, pork butt, whole birds), add 20–30 min to the estimate — the cold surface delays bark formation and extends the initial rise phase before the stall. For small cuts under 3 lbs (steaks, chops, thighs), the impact is minimal (<10 min). Mention this in rationale and note it in a tip.
- "Tempered to Room Temp": Meat has rested at room temperature 30–60 min before going on the grill (~65–70°F surface). Use baseline cook time as-is — no adjustment needed. Note in a tip that tempering gives more even cooking across the thickness.
- When meatStartTemp is provided, explicitly reference it in the rationale.

TECHNIQUE RULES (apply when technique fields are provided in the user prompt):
- Cooking method adjustments:
  - "Rotisserie": subtract ~15% from baseline cook time (constant rotation = even heat, no stall plateau as pronounced).
  - "Hot & Fast": subtract 20–30% from baseline time; bark develops faster; wrap earlier if at all.
  - "Reverse Sear": treat as two-phase — low-heat phase to ~10°F below target, then high-heat sear 2–3 min per side. estimatedDurationMinutes covers the low-heat phase only; note the sear in rationale.
  - "Braised": time is driven by collagen breakdown, not internal temp; treat a stated targetTempF as a guide but note braising typically runs 3–4 hours regardless of weight for pork/beef cuts.
  - "Sous Vide + Smoke": the sous vide phase runs before the cook; estimatedDurationMinutes covers only the smoke finish (typically 1–2 hours); note this in rationale.
  - "Direct Heat": subtract 25–40% from baseline; monitor closely — no stall expected.
  - "Indirect Heat" / "Low & Slow": use baseline as-is; apply standard stall logic.
- Injection adjustments:
  - "Injected": reduce stall duration estimate by 10–20 min (moisture in the meat reduces stall severity). Bark may be slightly less pronounced.
  - "Not Injected": no adjustment needed.
- Spritz adjustments:
  - "Every 30 min" or "Every Hour": frequent lid opens add ~5–10% to total cook time vs. no-spritz baseline; note the trade-off (better bark moisture, slightly longer cook).
  - "No Spritz": use baseline; bark will develop faster.
  - "Once at Stall" / "As Needed": negligible time impact; mention in tips.
- Mop adjustments (apply when "Mop frequency" is provided):
  - "Every 30 min" or "Every Hour": similar to spritzing — each lid open adds small time. Mopping with a thicker sauce (butter, tallow, mop sauce) can slightly slow bark formation compared to a light spritz. Add ~5% to estimate vs. no-mop baseline; note the moisture and flavor benefits.
  - "No Mop": no adjustment needed; bark forms at standard pace.
  - "Once at Stall" / "As Needed": negligible time impact.
  - Mop liquid specifics: butter/tallow-based mops add richness and promote mahogany color; vinegar-based mops tenderize and brighten; tomato-based mops can burn at high temps so note timing caution above 325°F.
- Wrap / finish adjustments:
  - "Foil at Stall (Texas Crutch)": align wrap.method to "foil". Stall is effectively eliminated — subtract 30–60 min from stall portion of estimate.
  - "Butcher Paper at Stall": align wrap.method to "butcher_paper". Stall is partially shortened (15–30 min saved vs. no-wrap).
  - "Foil Boat": align wrap.method to "foil"; bark is preserved on top. Time savings similar to foil wrap.
  - "No Wrap": align wrap.method to "none"; expect full stall duration.
  - "Braised in Foil with Liquid": align wrap.method to "foil"; moisture keeps internal temp climbing steadily — subtract up to 45 min from baseline.
  - "Pulled and Rested in Cooler" / "Sauced and Returned to Smoker": note in tips but don't change estimatedDurationMinutes.
- When technique fields are provided, explicitly reference them in rationale and at least one tip.

FROZEN-MEAT RULES (apply only when "Starting from frozen" is true in the user prompt):
- Thaw timing benchmarks: fridge thaw needs ~24 hours per 4–5 lbs (USDA-safe); cold-water thaw needs ~30 min per lb with water changed every 30 min and meat sealed in a leak-proof bag.
- Tempering: after thaw, rest the meat at room temp for 30–45 min (large cuts up to 60 min) to take the chill off the surface before going on the grill.
- Surface drying: pat the surface dry and (for cuts that benefit from bark — brisket, pork butt, ribs) apply a dry brine AFTER thaw, not while frozen. Salt while frozen pulls out excess moisture and ruins surface texture.
- Cook time: previously frozen meat that has fully thawed cooks at the same pace as fresh — do NOT add cook time for the frozen state itself. The thaw + temper happens BEFORE estimatedDurationMinutes starts.
- Tips MUST reference: thaw method timing, surface drying / pat-dry, when to apply rub or dry brine (after thaw), and any food-safety pitfalls relevant to the chosen thaw method.
- recommendedServeAt: if a desiredFinishAt is provided AND the time between "now" and desiredFinishAt is too short to fit (thaw + temper + preheat + cook + rest), return an ISO timestamp for the EARLIEST realistic serve time that fits the full schedule, plus a short recommendedServeReason. Otherwise return null for both fields.
- When NOT starting from frozen, ALWAYS return null for both recommendedServeAt and recommendedServeReason.`;

  const techniqueLines: string[] = [];
  if (cookingMethod) techniqueLines.push(`Cooking method: ${cookingMethod}`);
  if (meatStartTemp) techniqueLines.push(`Meat starting temperature: ${meatStartTemp}`);
  if (injection) techniqueLines.push(`Injection: ${injection}`);
  if (spritzFrequency) techniqueLines.push(`Spritz/Mop frequency: ${spritzFrequency}`);
  if (wrapFinish) techniqueLines.push(`Wrap / finish preference: ${wrapFinish}`);
  const techniqueSection = techniqueLines.length > 0
    ? `\nTechnique details (apply TECHNIQUE RULES from system prompt):\n${techniqueLines.join("\n")}`
    : "";

  const cookNotesSection = notes && notes.trim()
    ? `\nCook Notes (user-provided — factor these into your rationale, timing, and tips):\n${notes.trim()}`
    : "";

  const userPrompt = `Plan this cook:
Food: ${foodType}
${sizingLabel ? `Size: ${sizingLabel}` : `Weight: ${weightLbs ? `${weightLbs} lbs` : "unknown — use baseline minsPerLb with a 10 lb estimate"}`}
Cook temperature: ${cookTempF ? `${cookTempF}°F` : "unknown"}
Target internal temp: ${targetTempF ? `${targetTempF}°F` : "unknown"}
Preheat time (tracked separately, not in estimatedDurationMinutes): ${preheatMinutes} min${isIndividualCook === true ? `\nCook note: this is an individually-cooked cut — cook time is driven by piece thickness, not total quantity. Each piece cooks in the same time regardless of how many are on the grill; do NOT multiply cook time by piece count.` : isIndividualCook === false && pieceCount != null && pieceCount > 1 ? `\nCook note: this is a weight-driven cut — total effective weight determines cook time. Multiple pieces cook as a combined load.` : ""}${cookNotesSection}
${outdoorTempF != null ? `Outdoor ambient temperature: ${outdoorTempF}°F (${outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor this into your estimate. Cold weather (below 40°F) increases cook time and preheat duration; hot weather (above 90°F) may reduce time or cause temperature spikes.` : ""}
${desiredFinishAt ? `Desired serve time: ${new Date(desiredFinishAt).toLocaleString()}` : ""}
${fromFrozen ? `Starting from frozen: YES. Thaw method chosen by user: ${thawMethod === "cold_water" ? "cold-water thaw (~30 min per lb, change water every 30 min, sealed bag)" : thawMethod === "fridge" ? "refrigerator thaw (~24 hours per 4–5 lbs, USDA-safe)" : thawMethod === "microwave" ? "microwave thaw (cook immediately after — no dry-brine window)" : thawMethod === "counter" ? "counter thaw (cook immediately after — food-safety window is short)" : thawMethod === "cook_from_frozen" ? "cook from frozen (no thaw step — add ~50% to baseline cook time, internal temp still the target)" : "not specified — recommend the safest fit for their timeline"}. Current time (for thaw-feasibility math): ${new Date().toISOString()}. Apply the FROZEN-MEAT RULES from the system prompt: explicitly mention thaw + temper timing, dry-brine AFTER thaw, and surface drying in your tips and rationale. If the desired serve time leaves too little lead time for a full thaw + temper + preheat + cook + rest, populate recommendedServeAt with a realistic earliest serve timestamp and explain why in recommendedServeReason.` : "Starting from frozen: NO. Set recommendedServeAt and recommendedServeReason to null."}${techniqueSection}
${predictSmokerProfile ? `\n${predictSmokerProfile}\n` : ""}
${grillContext}
${grillTempContext}
${baselineSection}
${userHistorySection}${fingerprintGuidance}`;

  // Check prediction cache before making the expensive AI call.
  const cacheKey = makePredictCacheKey(req.userId, parsed.data);
  const cached = predictionAiCache.get(cacheKey);

  let prediction: PredictionAiOutput;

  if (cached && Date.now() - cached.cachedAt < PREDICTION_CACHE_TTL_MS) {
    prediction = cached.output as typeof prediction;
  } else {
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

    try {
      prediction = JSON.parse(cleaned);
    } catch {
      prediction = {
        estimatedDurationMinutes: 240,
        confidence: "low",
        rationale: "Could not parse prediction, using default estimate.",
        tips: ["Monitor internal temperature closely", "Use a reliable meat thermometer", "Rest meat after cooking"],
        wrap: {
          wrapAtMinutes: 180,
          method: "foil",
          wrapTempF: 165,
          reason: "Wrap in foil at around 165°F internal temp to push through the stall faster and keep moisture in. Add a splash of apple juice or beef tallow before sealing.",
          restMinutes: 60,
        },
        recommendedServeAt: null,
        recommendedServeReason: null,
      };
    }

    // Store in cache for subsequent identical requests.
    predictionAiCache.set(cacheKey, {
      output: {
        estimatedDurationMinutes: prediction.estimatedDurationMinutes,
        confidence: prediction.confidence,
        rationale: prediction.rationale,
        tips: prediction.tips,
        wrap: prediction.wrap,
        checkins: prediction.checkins ?? null,
        recommendedServeAt: prediction.recommendedServeAt ?? null,
        recommendedServeReason: prediction.recommendedServeReason ?? null,
      },
      cachedAt: Date.now(),
    });
  }

  const wrap = prediction.wrap ?? {
    wrapAtMinutes: 0,
    method: "none",
    wrapTempF: null,
    reason: "No wrap needed for this cook.",
    restMinutes: 15,
  };

  const fingerprintNoteParts: string[] = [];
  if (calibratedMinsPerLb != null) {
    if (weightLbs && weightLbs > 0) {
      prediction.estimatedDurationMinutes = Math.round(calibratedMinsPerLb * weightLbs);
    }
    const meatLabel = meatKey.replace(/_/g, " ");
    const baseMsg = calibrationSource === "grill"
      ? `Adjusted for this grill's learned pace on ${meatLabel}: ~${calibratedMinsPerLb} min/lb across ${calibrationSampleSize} cook${calibrationSampleSize === 1 ? "" : "s"}`
      : `Adjusted for your learned pace on ${meatLabel} (across all grills): ~${calibratedMinsPerLb} min/lb across ${calibrationSampleSize} cook${calibrationSampleSize === 1 ? "" : "s"}`;
    if (calibrationBaseline != null && calibrationPctDiff != null) {
      const dirText = calibrationPctDiff > 5
        ? `${calibrationPctDiff}% slower than ${calibrationBaseline} min/lb baseline`
        : calibrationPctDiff < -5
          ? `${Math.abs(calibrationPctDiff)}% faster than ${calibrationBaseline} min/lb baseline`
          : `right at the ${calibrationBaseline} min/lb baseline`;
      fingerprintNoteParts.push(`${baseMsg} (${dirText}).`);
    } else {
      fingerprintNoteParts.push(`${baseMsg}.`);
    }
  }
  if (significantBias) {
    const setTemp = cookTempF ?? 225;
    fingerprintNoteParts.push(
      `This grill runs ${pitBiasF! > 0 ? "hot" : "cold"} by ~${Math.abs(pitBiasF!)}°F — set ${setTemp}°F delivers ~${Math.round(setTemp + pitBiasF!)}°F actual, factored into the plan.`
    );
  }
  const fingerprintNote: string | null = fingerprintNoteParts.length > 0
    ? fingerprintNoteParts.join(" ")
    : null;
  const fingerprintApplied = fingerprintNote != null;
  const fingerprintSource: "grill" | "user" | "pit_bias_only" | null =
    calibrationSource === "grill"
      ? "grill"
      : calibrationSource === "user"
        ? "user"
        : significantBias
          ? "pit_bias_only"
          : null;

  // ── Cook Factors Breakdown ────────────────────────────────────────────────
  // Constructs an ordered list of time-contribution segments that explain what
  // drives the estimated cook duration. The first item is always the "base"
  // (estimate minus identified add-ons); subsequent items are named add-ons.
  // Frozen thaw+temper is appended as an additional context segment since it
  // falls outside the active cook window.
  const finalDurationMins = prediction.estimatedDurationMinutes;

  const STALL_KEYWORDS = ["brisket", "pork butt", "pork shoulder", "pulled pork", "chuck roast", "beef short rib", "beef cheek", "picnic shoulder", "whole hog"];
  const isStallCut = STALL_KEYWORDS.some(k => foodType.toLowerCase().includes(k));
  const effectiveCookTempF = cookTempF ?? 225;

  let stallMins = 0;
  if (isStallCut && effectiveCookTempF <= 275) {
    stallMins = effectiveCookTempF <= 240 ? 75 : 45;
  }

  let fingerprintAddMins = 0;
  if (calibratedMinsPerLb != null && weightLbs && weightLbs > 0 && baseline) {
    const baselineMins = Math.round(baseline.minsPerLb * weightLbs);
    const calibratedMins = Math.round(calibratedMinsPerLb * weightLbs);
    fingerprintAddMins = calibratedMins - baselineMins;
  }

  let outdoorTempAddMins = 0;
  if (outdoorTempF != null) {
    if (outdoorTempF < 32) outdoorTempAddMins = 25;
    else if (outdoorTempF < 45) outdoorTempAddMins = 15;
    else if (outdoorTempF < 55) outdoorTempAddMins = 8;
  }

  const positiveAddons = stallMins + Math.max(0, fingerprintAddMins) + grillLoadAddMins + outdoorTempAddMins;
  const baseMins = Math.max(finalDurationMins - positiveAddons, 30);

  interface FactorBreakdownItem {
    label: string;
    minutes: number;
    colorHex: string;
    description: string;
    icon: string;
  }

  const factorItems: FactorBreakdownItem[] = [];

  factorItems.push({
    label: "Base Cook Time",
    minutes: baseMins,
    colorHex: "#E84820",
    description: baseline
      ? `Core cook time from the ${baseline.minsPerLb} min/lb baseline for ${foodType}.`
      : `Core cook time estimate for ${foodType} based on technique and grill context.`,
    icon: "zap",
  });

  if (stallMins > 0) {
    factorItems.push({
      label: "Stall Allowance",
      minutes: stallMins,
      colorHex: "#8B5CF6",
      description: `Large cuts plateau around 160°F as surface moisture evaporates. Your plan builds in ${stallMins} min for the stall.`,
      icon: "pause-circle",
    });
  }

  if (grillLoadAddMins > 0 && grillLoadLevel) {
    factorItems.push({
      label: "Grill Load",
      minutes: grillLoadAddMins,
      colorHex: "#F97316",
      description: `A ${grillLoadLevel}-density grill load restricts airflow and extends cook time for even results.`,
      icon: "layers",
    });
  }

  if (outdoorTempAddMins > 0 && outdoorTempF != null) {
    factorItems.push({
      label: "Cold Weather",
      minutes: outdoorTempAddMins,
      colorHex: "#38BDF8",
      description: `${outdoorTempF}°F ambient temp means the grill works harder to hold target temperature.`,
      icon: "thermometer",
    });
  }

  // Only include a Learned Pace segment when the fingerprint ADDS time (slower
  // than baseline). A faster grill reduces the estimate directly — the base
  // already reflects the calibrated pace so there is no additive segment to
  // show; the faster-pace fact is communicated via a qualitative chip in the UI.
  if (fingerprintAddMins >= 10) {
    factorItems.push({
      label: "Learned Pace (Slower)",
      minutes: fingerprintAddMins,
      colorHex: "#F59E0B",
      description: `Your ${calibrationSource === "grill" ? "grill's" : "historical"} actual pace of ${calibratedMinsPerLb} min/lb runs slower than the ${baseline?.minsPerLb ?? "baseline"} min/lb reference — based on ${calibrationSampleSize} cook${calibrationSampleSize === 1 ? "" : "s"}.`,
      icon: "trending-up",
    });
  }

  // Frozen thaw + temper: additional time outside the active cook window
  if (fromFrozen && weightLbs && weightLbs > 0) {
    let approxThawMins = 0;
    if (thawMethod === "fridge") {
      approxThawMins = Math.max(24 * 60, Math.ceil(weightLbs / 5) * 24 * 60);
    } else {
      // cold_water or unknown: ~30 min per lb
      approxThawMins = Math.round(weightLbs * 30);
    }
    const approxTemperMins = 45;
    const thawLabel = thawMethod === "fridge" ? "Fridge thaw" : thawMethod === "cold_water" ? "Cold-water thaw" : "Thaw";
    factorItems.push({
      label: "Thaw + Temper",
      minutes: approxThawMins + approxTemperMins,
      colorHex: "#3B82F6",
      description: `${thawLabel} (~${Math.round(approxThawMins / 60)}h) + ${approxTemperMins} min counter temper. This happens before the active cook clock starts.`,
      icon: "box",
    });
  }

  // Only emit a breakdown when there's more than just the base item — a bare
  // base-only breakdown adds no insight.
  const factorBreakdown: FactorBreakdownItem[] = factorItems.length > 1 ? factorItems : [];

  const now = new Date();
  const cookMs = prediction.estimatedDurationMinutes * 60000;
  const preheatMs = preheatMinutes * 60000;
  const restMs = (wrap.restMinutes ?? 0) * 60000;

  let suggestedStartAt: Date;
  let estimatedFinishAt: Date;
  let grillLightAt: Date;
  let serveAt: Date;

  if (desiredFinishAt) {
    const serveTime = new Date(desiredFinishAt);
    serveAt = serveTime;
    estimatedFinishAt = new Date(serveTime.getTime() - restMs);
    suggestedStartAt = new Date(estimatedFinishAt.getTime() - cookMs);
    grillLightAt = new Date(suggestedStartAt.getTime() - preheatMs);
  } else {
    grillLightAt = now;
    suggestedStartAt = new Date(now.getTime() + preheatMs);
    estimatedFinishAt = new Date(suggestedStartAt.getTime() + cookMs);
    serveAt = new Date(estimatedFinishAt.getTime() + restMs);
  }

  const finalConfidence = hasRichHistory && prediction.confidence !== "high"
    ? "high"
    : (prediction.confidence || "medium");

  // Sanitise and validate AI-generated check-ins. Filter out malformed items
  // so the client always receives a well-typed array (never null/undefined).
  const rawCheckins: unknown[] = Array.isArray(prediction.checkins) ? prediction.checkins : [];
  const checkins: AiCheckinItem[] = rawCheckins
    .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
    .map((c) => ({
      offsetMinutes: typeof c.offsetMinutes === "number" ? c.offsetMinutes : 0,
      label: typeof c.label === "string" ? c.label : "Check-In",
      coachingNote: typeof c.coachingNote === "string" ? c.coachingNote : "",
      visualCues: Array.isArray(c.visualCues)
        ? (c.visualCues as unknown[]).filter((v): v is string => typeof v === "string")
        : [],
      expectedInternalTempRange:
        Array.isArray(c.expectedInternalTempRange) &&
        c.expectedInternalTempRange.length === 2 &&
        typeof (c.expectedInternalTempRange as unknown[])[0] === "number" &&
        typeof (c.expectedInternalTempRange as unknown[])[1] === "number"
          ? (c.expectedInternalTempRange as [number, number])
          : null,
    }))
    .filter((c) => c.offsetMinutes >= 0 && c.label.length > 0);

  res.json({
    estimatedDurationMinutes: prediction.estimatedDurationMinutes,
    preheatMinutes,
    grillLightAt: grillLightAt.toISOString(),
    suggestedStartAt: suggestedStartAt.toISOString(),
    estimatedFinishAt: estimatedFinishAt.toISOString(),
    serveAt: serveAt.toISOString(),
    wrap: {
      wrapAtMinutes: wrap.wrapAtMinutes ?? 0,
      method: wrap.method ?? "none",
      wrapTempF: wrap.wrapTempF ?? null,
      reason: wrap.reason ?? "",
      restMinutes: wrap.restMinutes ?? 0,
    },
    checkins,
    confidence: finalConfidence,
    rationale: prediction.rationale || "Based on food type and weight.",
    tips: prediction.tips || [],
    fingerprintApplied,
    fingerprintNote,
    fingerprintSource,
    recommendedServeAt: (() => {
      if (!fromFrozen) return null;
      const raw = prediction.recommendedServeAt;
      if (raw == null || typeof raw !== "string") return null;
      const parsedTs = Date.parse(raw);
      if (Number.isNaN(parsedTs)) return null;
      // Sanity bound: must be in the future and within 14 days from now.
      const nowMs = Date.now();
      const maxMs = nowMs + 14 * 24 * 60 * 60 * 1000;
      if (parsedTs <= nowMs || parsedTs > maxMs) return null;
      return new Date(parsedTs).toISOString();
    })(),
    recommendedServeReason: fromFrozen
      ? (typeof prediction.recommendedServeReason === "string" && prediction.recommendedServeReason.trim().length > 0
        ? prediction.recommendedServeReason.trim().slice(0, 500)
        : null)
      : null,
    ...(factorBreakdown.length > 0 ? { factorBreakdown } : {}),
  });
});

export default router;
