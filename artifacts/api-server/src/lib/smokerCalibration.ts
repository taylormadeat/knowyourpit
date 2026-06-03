import { and, avg, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db, cooksTable, temperatureReadingsTable } from "@workspace/db";

const PIT_PROBE_KEYWORDS = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
export const isPitProbeByName = (name: string | null) =>
  name ? PIT_PROBE_KEYWORDS.some(k => name.toLowerCase().includes(k)) : false;

interface StoredProbe {
  probeName?: string | null;
  finishingTempF?: number | null;
}
interface StoredAnalysis {
  probes?: StoredProbe[];
}
function getProbes(result: unknown): StoredProbe[] {
  if (!result || typeof result !== "object") return [];
  const r = result as StoredAnalysis;
  return Array.isArray(r.probes) ? r.probes : [];
}

export function simplifyFoodType(foodType: string): string {
  const lower = foodType.toLowerCase();
  if (lower.includes("brisket")) return "brisket";
  if (lower.includes("pork butt") || lower.includes("boston butt") || lower.includes("pork shoulder")) return "pork_butt";
  if (lower.includes("rib")) return "ribs";
  if (lower.includes("chicken")) return "chicken";
  if (lower.includes("turkey")) return "turkey";
  if (lower.includes("steak") || lower.includes("ribeye") || lower.includes("tri-tip") || lower.includes("strip")) return "steak";
  return lower.replace(/\s+/g, "_").substring(0, 20);
}

const BASELINE_MINS_PER_LB: Record<string, number> = {
  brisket: 75,
  pork_butt: 90,
  ribs: 45,
  chicken: 22,
  turkey: 20,
  steak: 20,
};

export interface DurationPattern {
  actualMinsPerLb: number;
  baselineMinsPerLb: number | null;
  sampleSize: number;
  pctDiff: number | null;
}

export type ConfidenceLevel = "none" | "building" | "developing" | "established";

export interface SmokerInsights {
  cookCount: number;
  confidenceLevel: ConfidenceLevel;
  pitBiasF: number | null;
  overshootF: number | null;
  durationByMeat: Record<string, DurationPattern>;
  runLong: boolean | null;
  runShort: boolean | null;
}

export function confidenceLevelFor(cookCount: number): ConfidenceLevel {
  if (cookCount >= 10) return "established";
  if (cookCount >= 5) return "developing";
  if (cookCount >= 2) return "building";
  return "none";
}

export async function computeSmokerInsights(userId: string, grillId?: number): Promise<SmokerInsights> {
  const baseConditions = [eq(cooksTable.userId, userId), eq(cooksTable.status, "completed")];
  if (grillId != null) baseConditions.push(eq(cooksTable.grillId, grillId));

  const completedCooks = await db
    .select()
    .from(cooksTable)
    .where(and(...baseConditions))
    .orderBy(desc(cooksTable.createdAt))
    .limit(50);

  const cookCount = completedCooks.length;

  // ── Pit calibration ──────────────────────────────────────────────────────
  const cookIdsWithPitTarget = completedCooks
    .filter(c => c.cookTempF != null)
    .map(c => c.id);

  const pitBiases: number[] = [];

  if (cookIdsWithPitTarget.length > 0) {
    // ── Aggregate pit temps in SQL (replaces unbounded SELECT cook_id, temp_f, probe_name) ──
    const pitKeywordSql = sql`(${temperatureReadingsTable.probeName} ILIKE '%pit%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%ambient%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%grill%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%chamber%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%dome%'
      OR ${temperatureReadingsTable.probeName} ILIKE '%lid%')`;

    const pitAvgRows = await db
      .select({
        cookId: temperatureReadingsTable.cookId,
        avgPitF: avg(temperatureReadingsTable.tempF),
        readingCount: count(),
      })
      .from(temperatureReadingsTable)
      .where(and(
        inArray(temperatureReadingsTable.cookId, cookIdsWithPitTarget),
        pitKeywordSql,
      ))
      .groupBy(temperatureReadingsTable.cookId);

    const pitAvgByCook: Record<number, { avgF: number; n: number }> = {};
    for (const row of pitAvgRows) {
      if (row.avgPitF != null) {
        pitAvgByCook[row.cookId] = { avgF: parseFloat(row.avgPitF), n: row.readingCount };
      }
    }

    for (const cook of completedCooks) {
      if (cook.cookTempF == null) continue;
      const data = pitAvgByCook[cook.id];
      if (!data || data.n < 5) continue;
      pitBiases.push(data.avgF - cook.cookTempF);
    }
  }

  const pitBiasF =
    pitBiases.length >= 2
      ? Math.round((pitBiases.reduce((s, v) => s + v, 0) / pitBiases.length) * 10) / 10
      : null;

  // ── Overshoot tendency ───────────────────────────────────────────────────
  const overshoots: number[] = [];
  for (const cook of completedCooks) {
    if (cook.targetTempF == null) continue;
    const probes = getProbes(cook.analysisResult);
    const meatProbes = probes.filter(p => !isPitProbeByName(p.probeName ?? null) && p.finishingTempF != null);
    if (meatProbes.length === 0) continue;
    const maxFinishing = Math.max(...meatProbes.map(p => p.finishingTempF!));
    overshoots.push(maxFinishing - cook.targetTempF);
  }

  const overshootF =
    overshoots.length >= 2
      ? Math.round((overshoots.reduce((s, v) => s + v, 0) / overshoots.length) * 10) / 10
      : null;

  // ── Duration patterns ────────────────────────────────────────────────────
  const durationData: Record<string, { total: number; count: number }> = {};
  for (const cook of completedCooks) {
    if (!cook.actualStartAt || !cook.actualEndAt || !cook.weightLbs || cook.weightLbs < 0.5) continue;
    const mins =
      (new Date(cook.actualEndAt).getTime() - new Date(cook.actualStartAt).getTime()) / 60000;
    if (mins < 10) continue;
    const key = simplifyFoodType(cook.foodType);
    if (!durationData[key]) durationData[key] = { total: 0, count: 0 };
    durationData[key].total += mins / cook.weightLbs;
    durationData[key].count += 1;
  }

  const durationByMeat: Record<string, DurationPattern> = {};
  for (const [key, { total, count }] of Object.entries(durationData)) {
    const actualMinsPerLb = Math.round(total / count);
    const baselineMinsPerLb = BASELINE_MINS_PER_LB[key] ?? null;
    durationByMeat[key] = {
      actualMinsPerLb,
      baselineMinsPerLb,
      sampleSize: count,
      pctDiff:
        baselineMinsPerLb != null
          ? Math.round(((actualMinsPerLb - baselineMinsPerLb) / baselineMinsPerLb) * 100)
          : null,
    };
  }

  // ── Run long/short signal ────────────────────────────────────────────────
  const durationDeltas: number[] = [];
  for (const { actualMinsPerLb, baselineMinsPerLb } of Object.values(durationByMeat)) {
    if (baselineMinsPerLb == null) continue;
    durationDeltas.push((actualMinsPerLb - baselineMinsPerLb) / baselineMinsPerLb);
  }
  const avgDelta =
    durationDeltas.length > 0
      ? durationDeltas.reduce((s, v) => s + v, 0) / durationDeltas.length
      : null;

  return {
    cookCount,
    confidenceLevel: confidenceLevelFor(cookCount),
    pitBiasF,
    overshootF,
    durationByMeat,
    runLong: avgDelta != null ? avgDelta > 0.1 : null,
    runShort: avgDelta != null ? avgDelta < -0.1 : null,
  };
}

export function formatSmokerProfile(insights: SmokerInsights): string {
  if (insights.cookCount < 2) return "";

  const lines: string[] = [
    "=== YOUR SMOKER PROFILE (learned from this pitmaster's cook history) ===",
  ];

  if (insights.pitBiasF != null) {
    const abs = Math.abs(insights.pitBiasF);
    if (abs >= 3) {
      const dir = insights.pitBiasF > 0 ? "HOT" : "COLD";
      lines.push(
        `• Pit calibration: Their smoker runs ${dir} by ~${abs}°F (avg actual pit is ${insights.pitBiasF > 0 ? "+" : ""}${insights.pitBiasF}°F vs set point). ` +
          `Account for this when advising on pit temperature adjustments.`,
      );
    } else {
      lines.push(`• Pit calibration: Their smoker reads accurately — only ${abs}°F off from set temp.`);
    }
  }

  if (insights.overshootF != null) {
    const abs = Math.abs(insights.overshootF);
    if (abs >= 3) {
      const dir = insights.overshootF > 0 ? "overshoots" : "undershoots";
      lines.push(
        `• Pull temp tendency: This pitmaster ${dir} their target by ~${abs}°F on average. ` +
          (insights.overshootF > 0
            ? `Advise pulling ${abs}°F below their stated target to account for carryover.`
            : `They can run slightly past their target — carryover is minimal for them.`),
      );
    } else {
      lines.push(`• Pull temp: They nail pull temps accurately (avg ${abs}°F off target).`);
    }
  }

  for (const [key, { actualMinsPerLb, baselineMinsPerLb, sampleSize }] of Object.entries(
    insights.durationByMeat,
  )) {
    if (sampleSize < 1) continue;
    const label = key.replace(/_/g, " ");
    if (baselineMinsPerLb != null) {
      const diffPct = Math.round(
        ((actualMinsPerLb - baselineMinsPerLb) / baselineMinsPerLb) * 100,
      );
      const dir = diffPct > 5 ? `${diffPct}% slower than baseline` : diffPct < -5 ? `${Math.abs(diffPct)}% faster than baseline` : "right at baseline";
      lines.push(
        `• ${label} pace: ~${actualMinsPerLb} min/lb actual (baseline ${baselineMinsPerLb} min/lb — ${dir}). ` +
          `n=${sampleSize} cook${sampleSize !== 1 ? "s" : ""}.`,
      );
    } else {
      lines.push(`• ${label} pace: ~${actualMinsPerLb} min/lb (${sampleSize} cook${sampleSize !== 1 ? "s" : ""}).`);
    }
  }

  if (lines.length === 1) return "";
  lines.push(
    "Apply this profile when making timing predictions and decisions — it reflects their actual equipment and cooking habits.",
  );
  return lines.join("\n");
}
