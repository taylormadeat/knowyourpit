import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db, cooksTable, grillsTable, temperatureReadingsTable } from "@workspace/db";
import { AiPredictBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile, simplifyFoodType } from "../../lib/smokerCalibration";
import { aiRateLimit, isPitProbe, getAssessment } from "./shared";

const router: IRouter = Router();

interface MeatBaseline {
  minsPerLb: number;
  cookTempF: number;
  targetTempF: number;
  restMins: number;
  wrapRec: "foil" | "butcher_paper" | "none";
  wrapAtMins?: number;
  wrapTempF?: number;
  wrapNote?: string;
}

const MEAT_KB: Array<{ keywords: string[]; baseline: MeatBaseline }> = [
  {
    keywords: ["brisket", "whole packer"],
    baseline: { minsPerLb: 75, cookTempF: 225, targetTempF: 203, restMins: 90, wrapRec: "butcher_paper", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Wrap in unwaxed butcher paper once bark is set and color is mahogany (around 165°F). Spritz with beef tallow or water before wrapping tight." },
  },
  {
    keywords: ["brisket flat"],
    baseline: { minsPerLb: 65, cookTempF: 225, targetTempF: 200, restMins: 60, wrapRec: "butcher_paper", wrapAtMins: 180, wrapTempF: 165, wrapNote: "Flats dry out faster — wrap with a splash of tallow or butter at 165°F internal. Probe should feel like warm butter through the flat at 200°F." },
  },
  {
    keywords: ["pork shoulder", "boston butt", "pork butt", "pulled pork"],
    baseline: { minsPerLb: 90, cookTempF: 225, targetTempF: 203, restMins: 60, wrapRec: "foil", wrapAtMins: 300, wrapTempF: 165, wrapNote: "Wrap tight in foil (Texas Crutch) at 165°F to push through the stall. Add 1/4 cup apple juice or cider vinegar inside the foil. Unwrap at 195°F if you want better bark." },
  },
  {
    keywords: ["baby back ribs", "back ribs"],
    baseline: { minsPerLb: 45, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 180, wrapNote: "3-2-1 method: 3hr unwrapped, 2hr in foil with butter+brown sugar+honey, 1hr back on grate to set glaze. Bones should pull back 1/4 inch." },
  },
  {
    keywords: ["spare ribs", "st. louis", "saint louis"],
    baseline: { minsPerLb: 50, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 210, wrapNote: "2-2-1 for St. Louis. Foil with butter, brown sugar, and a splash of apple juice. Bend test: ribs should crack when folded — not fall apart, not resist." },
  },
  {
    keywords: ["pork belly"],
    baseline: { minsPerLb: 60, cookTempF: 225, targetTempF: 200, restMins: 20, wrapRec: "foil", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Wrap in foil at 165°F with butter and maple syrup for finishing. Internal probe should slide like butter at 200°F." },
  },
  {
    keywords: ["chuck roast"],
    baseline: { minsPerLb: 60, cookTempF: 250, targetTempF: 205, restMins: 30, wrapRec: "foil", wrapAtMins: 180, wrapTempF: 160, wrapNote: "Wrap tight in foil at 160°F with 1/4 cup beef tallow or butter. Cook to 205°F — it should be probe-tender like brisket." },
  },
  {
    keywords: ["beef short rib", "plate rib", "dinosaur rib"],
    baseline: { minsPerLb: 55, cookTempF: 275, targetTempF: 205, restMins: 30, wrapRec: "butcher_paper", wrapAtMins: 180, wrapTempF: 170, wrapNote: "Wrap in butcher paper once bark is firm and dark. Cook at 275°F — the higher temp is fine. Pull when probe reads 205°F with no resistance through the meat." },
  },
  {
    keywords: ["tri-tip"],
    baseline: { minsPerLb: 30, cookTempF: 250, targetTempF: 135, restMins: 15, wrapRec: "none", wrapNote: "No wrap needed. Reverse-sear method: smoke to 115°F, then sear 2–3 min per side over direct high heat. Rest 15 min before slicing against grain." },
  },
  {
    keywords: ["ribeye", "rib eye", "strip steak", "ny strip", "tenderloin steak"],
    baseline: { minsPerLb: 20, cookTempF: 225, targetTempF: 130, restMins: 10, wrapRec: "none", wrapNote: "Reverse-sear: smoke to 10°F below target, then sear over screaming hot grill 60–90s per side. Rest uncovered — tenting steaks causes steam and softens the crust." },
  },
  {
    keywords: ["whole chicken"],
    baseline: { minsPerLb: 22, cookTempF: 325, targetTempF: 165, restMins: 15, wrapRec: "none", wrapNote: "No wrap needed. Spatchcocking cuts 30% off cook time. Pull at 160°F breast / 170°F thigh — carryover brings it to safe temp. Rest loosely tented." },
  },
  {
    keywords: ["spatchcock"],
    baseline: { minsPerLb: 15, cookTempF: 375, targetTempF: 165, restMins: 10, wrapRec: "none", wrapNote: "Higher temp (350–400°F) crisps the skin beautifully. No wrap needed — the flattened profile cooks evenly. Pull at 160°F breast temp." },
  },
  {
    keywords: ["chicken thigh", "chicken leg"],
    baseline: { minsPerLb: 18, cookTempF: 325, targetTempF: 175, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Thighs are forgiving — pull at 175–185°F for best texture. Skin-up for the entire cook; finish high-heat to crisp skin." },
  },
  {
    keywords: ["chicken wing"],
    baseline: { minsPerLb: 20, cookTempF: 400, targetTempF: 175, restMins: 5, wrapRec: "none", wrapNote: "High heat (375–425°F) is key for crispy wings. No wrap. Sauce in the last 10 minutes to caramelize without burning." },
  },
  {
    keywords: ["turkey breast"],
    baseline: { minsPerLb: 20, cookTempF: 325, targetTempF: 165, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 145, wrapNote: "Tent in foil once skin is golden (around 145°F internal) to prevent over-browning. Rest 20 min covered to redistribute juices." },
  },
  {
    keywords: ["whole turkey"],
    baseline: { minsPerLb: 15, cookTempF: 325, targetTempF: 165, restMins: 30, wrapRec: "foil", wrapAtMins: 150, wrapTempF: 145, wrapNote: "Tent breast with foil once it hits 145°F to avoid overcooking while dark meat catches up. Rest 30+ min before carving." },
  },
  {
    keywords: ["salmon"],
    baseline: { minsPerLb: 20, cookTempF: 275, targetTempF: 145, restMins: 5, wrapRec: "none", wrapNote: "No wrap. Smoke salmon skin-side down on cedar plank or oiled grate. Pull at 140°F — carryover brings to 145°F. Finish is when it flakes easily at the thickest point." },
  },
  {
    keywords: ["pork tenderloin"],
    baseline: { minsPerLb: 20, cookTempF: 350, targetTempF: 145, restMins: 10, wrapRec: "none", wrapNote: "No wrap needed. Tenderloin cooks fast — watch temp carefully. Pull at 140°F, rest 10 min. Slice into medallions." },
  },
  {
    keywords: ["pork loin"],
    baseline: { minsPerLb: 25, cookTempF: 250, targetTempF: 145, restMins: 15, wrapRec: "foil", wrapAtMins: 90, wrapTempF: 130, wrapNote: "Tent in foil at 130°F to keep moist. Pork loin is lean and dries quickly — don't overcook. Pull at 145°F internal." },
  },
  {
    keywords: ["lamb leg", "leg of lamb"],
    baseline: { minsPerLb: 30, cookTempF: 275, targetTempF: 145, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 130, wrapNote: "Tent foil at 130°F internal to rest and equalize. Rest 20 min loosely tented before carving." },
  },
  {
    keywords: ["lamb shoulder"],
    baseline: { minsPerLb: 60, cookTempF: 250, targetTempF: 200, restMins: 30, wrapRec: "foil", wrapAtMins: 180, wrapTempF: 165, wrapNote: "Lamb shoulder needs the full low-and-slow treatment like pork. Wrap tight in foil at 165°F with rosemary, garlic, and a splash of red wine or stock." },
  },
  {
    keywords: ["venison", "deer"],
    baseline: { minsPerLb: 40, cookTempF: 275, targetTempF: 145, restMins: 20, wrapRec: "foil", wrapAtMins: 120, wrapTempF: 130, wrapNote: "Venison dries out fast — wrap in foil at 130°F with butter to retain moisture. Very lean meat, pull early and rest well." },
  },
  {
    keywords: ["bison"],
    baseline: { minsPerLb: 70, cookTempF: 225, targetTempF: 200, restMins: 60, wrapRec: "butcher_paper", wrapAtMins: 240, wrapTempF: 165, wrapNote: "Bison brisket behaves like beef brisket but is leaner. Wrap in butcher paper at 165°F. May probe-tender slightly earlier than beef — start checking at 195°F." },
  },
];

function getMeatBaseline(foodType: string): MeatBaseline | null {
  const lower = foodType.toLowerCase();
  for (const entry of MEAT_KB) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return entry.baseline;
    }
  }
  return null;
}

router.post("/ai/predict", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiPredictBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { grillId, foodType, weightLbs, cookTempF, targetTempF, desiredFinishAt, preheatMinutes: clientPreheatMinutes, outdoorTempF, outdoorTempIsForecast } = parsed.data;

  const baseline = getMeatBaseline(foodType);

  let grillContext = "";
  let grillType = "";
  let grillTempContext = "";

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
    }

    const grillReadings = await db.select().from(temperatureReadingsTable)
      .where(eq(temperatureReadingsTable.grillId, grillId));

    if (grillReadings.length > 0) {
      const pitReadings = grillReadings.filter(r => isPitProbe(r.probeName));

      if (pitReadings.length > 0) {
        const avgPit = pitReadings.reduce((s, r) => s + r.tempF, 0) / pitReadings.length;
        const maxPit = Math.max(...pitReadings.map(r => r.tempF));
        const minPit = Math.min(...pitReadings.map(r => r.tempF));

        const byCook: Record<number, number[]> = {};
        for (const r of pitReadings) {
          if (!byCook[r.cookId]) byCook[r.cookId] = [];
          byCook[r.cookId].push(r.tempF);
        }
        const variances = Object.values(byCook).map(t => Math.max(...t) - Math.min(...t));
        const avgVariance = variances.reduce((a, b) => a + b, 0) / variances.length;

        grillTempContext = `
Grill historical temperature performance (${grillReadings.length} readings across ${Object.keys(byCook).length} cooks):
- Average pit/ambient temperature achieved: ${avgPit.toFixed(1)}°F
- Pit temp range across all readings: ${minPit.toFixed(1)}°F – ${maxPit.toFixed(1)}°F
- Average per-cook temperature swing: ±${(avgVariance / 2).toFixed(1)}°F
Note: Factor this grill's real-world temperature behavior into your estimate.`;
      }
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
      const recentReadings = await db.select().from(temperatureReadingsTable)
        .where(eq(temperatureReadingsTable.grillId, grillId));

      const peakProbeByCook: Record<number, number> = {};
      for (const r of recentReadings) {
        if (!recentCookIds.includes(r.cookId)) continue;
        if (isPitProbe(r.probeName)) continue;
        if (peakProbeByCook[r.cookId] == null || r.tempF > peakProbeByCook[r.cookId]) {
          peakProbeByCook[r.cookId] = r.tempF;
        }
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

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master assistant with deep knowledge of competition-level BBQ. You have access to verified cook data, industry baselines, and the user's personal cook history. Your predictions are trusted and actionable.

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
  }
}

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
- rationale: explain your estimate in 1–2 sentences, mentioning the baseline and any user data you used.`;

  const userPrompt = `Plan this cook:
Food: ${foodType}
Weight: ${weightLbs ? `${weightLbs} lbs` : "unknown — use baseline minsPerLb with a 10 lb estimate"}
Cook temperature: ${cookTempF ? `${cookTempF}°F` : "unknown"}
Target internal temp: ${targetTempF ? `${targetTempF}°F` : "unknown"}
Preheat time (tracked separately, not in estimatedDurationMinutes): ${preheatMinutes} min
${outdoorTempF != null ? `Outdoor ambient temperature: ${outdoorTempF}°F (${outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor this into your estimate. Cold weather (below 40°F) increases cook time and preheat duration; hot weather (above 90°F) may reduce time or cause temperature spikes.` : ""}
${desiredFinishAt ? `Desired serve time: ${new Date(desiredFinishAt).toLocaleString()}` : ""}
${predictSmokerProfile ? `\n${predictSmokerProfile}\n` : ""}
${grillContext}
${grillTempContext}
${baselineSection}
${userHistorySection}${fingerprintGuidance}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();

  type WrapRec = { wrapAtMinutes: number; method: string; wrapTempF: number | null; reason: string; restMinutes: number };
  let prediction: { estimatedDurationMinutes: number; confidence: string; rationale: string; tips: string[]; wrap: WrapRec };

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
    };
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
    confidence: finalConfidence,
    rationale: prediction.rationale || "Based on food type and weight.",
    tips: prediction.tips || [],
    fingerprintApplied,
    fingerprintNote,
    fingerprintSource,
  });
});

export default router;
