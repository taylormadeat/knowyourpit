import { type Request } from "express";
import { eq, desc } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { db, cooksTable, grillsTable } from "@workspace/db";
import { computeSmokerInsights, formatSmokerProfile } from "../../lib/smokerCalibration";

export interface AuthedRequest extends Request {
  userId: string;
}

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment before trying again." },
});

export const PIT_PROBE_NAMES = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
export const isPitProbe = (name: string | null): boolean =>
  name ? PIT_PROBE_NAMES.some(k => name.toLowerCase().includes(k)) : false;

export interface StoredAssessment {
  verdict?: string;
  summary?: string;
  whatWentWell?: string[];
  suggestions?: string[];
}

export interface StoredAnalysisResult {
  assessment?: StoredAssessment | null;
}

export function getAssessment(analysisResult: unknown): StoredAssessment | null {
  if (!analysisResult || typeof analysisResult !== "object") return null;
  const result = analysisResult as StoredAnalysisResult;
  return result.assessment ?? null;
}

export async function buildUserCookHistory(userId: string): Promise<string> {
  const cooks = await db.select().from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .orderBy(desc(cooksTable.createdAt))
    .limit(50);

  if (cooks.length === 0) {
    return "This user has no cook logs yet.";
  }

  const grillIds = [...new Set(cooks.map(c => c.grillId).filter(Boolean))] as number[];
  const grills: Record<number, string> = {};
  if (grillIds.length > 0) {
    for (const id of grillIds) {
      const [g] = await db.select({ id: grillsTable.id, name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, id));
      if (g) grills[g.id] = g.name;
    }
  }

  const lines = cooks.map(c => {
    const parts: string[] = [];
    parts.push(c.foodType);
    if (c.weightLbs) parts.push(`${c.weightLbs} lbs`);
    if (c.grillId && grills[c.grillId]) parts.push(`on ${grills[c.grillId]}`);
    if (c.status) parts.push(`[${c.status}]`);
    if (c.cookTempF) parts.push(`cook temp: ${c.cookTempF}°F`);
    if (c.targetTempF) parts.push(`target: ${c.targetTempF}°F`);
    if (c.actualStartAt && c.actualEndAt) {
      const mins = Math.round((new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime()) / 60000);
      parts.push(`duration: ${mins} min`);
    }
    if (c.rating) parts.push(`rated ${c.rating}/5`);
    if (c.ratingTenderness) parts.push(`tenderness ${c.ratingTenderness}/5`);
    if (c.ratingBark) parts.push(`bark ${c.ratingBark}/5`);
    if (c.ratingFlavor) parts.push(`flavor ${c.ratingFlavor}/5`);
    if (c.wrapMethod && c.wrapMethod !== "none") parts.push(`wrapped: ${c.wrapMethod}`);
    if (c.notes) parts.push(`notes: "${c.notes}"`);
    const date = c.actualStartAt ? new Date(c.actualStartAt).toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : null);
    if (date) parts.push(`date: ${date}`);
    const assessment = getAssessment(c.analysisResult);
    if (assessment?.verdict) parts.push(`verdict: ${assessment.verdict}`);
    if (assessment?.suggestions?.[0]) parts.push(`tip: "${assessment.suggestions[0]}"`);
    return `- ${parts.join(" · ")}`;
  });

  const total = cooks.length;
  const completed = cooks.filter(c => c.status === "completed").length;
  const rated = cooks.filter(c => c.rating != null);
  const avgRating = rated.length > 0 ? (rated.reduce((s, c) => s + c.rating!, 0) / rated.length).toFixed(1) : null;

  const summary = [
    `User's cook history (${total} total, ${completed} completed${avgRating ? `, avg rating ${avgRating}/5` : ""}):`,
    ...lines,
  ].join("\n");

  return summary;
}

export async function buildPerGrillFingerprintSection(userId: string): Promise<string> {
  const userGrills = await db
    .select({ id: grillsTable.id, name: grillsTable.name, type: grillsTable.type, brand: grillsTable.brand })
    .from(grillsTable)
    .where(eq(grillsTable.userId, userId))
    .limit(20);
  if (userGrills.length === 0) return "";

  const sections: string[] = [];
  for (const g of userGrills) {
    const ins = await computeSmokerInsights(userId, g.id);
    if (ins.cookCount < 1) continue;
    const lines: string[] = [];
    const label = g.brand ? `${g.brand} ${g.name}` : g.name;
    lines.push(`• ${label}${g.type ? ` (${g.type})` : ""} — ${ins.cookCount} cook${ins.cookCount === 1 ? "" : "s"}, confidence: ${ins.confidenceLevel}`);
    if (ins.pitBiasF != null && Math.abs(ins.pitBiasF) >= 3) {
      lines.push(`    runs ${ins.pitBiasF > 0 ? "HOT" : "COLD"} by ~${Math.abs(ins.pitBiasF)}°F vs set point`);
    }
    if (ins.overshootF != null && Math.abs(ins.overshootF) >= 3) {
      lines.push(`    pull-temp ${ins.overshootF > 0 ? "overshoots" : "undershoots"} target by ~${Math.abs(ins.overshootF)}°F`);
    }
    for (const [meatKey, p] of Object.entries(ins.durationByMeat)) {
      if (p.sampleSize < 1) continue;
      const dir = p.pctDiff == null
        ? null
        : p.pctDiff > 5 ? `${p.pctDiff}% slower than baseline`
        : p.pctDiff < -5 ? `${Math.abs(p.pctDiff)}% faster than baseline`
        : "right at baseline";
      lines.push(`    ${meatKey.replace(/_/g, " ")}: ${p.actualMinsPerLb} min/lb (n=${p.sampleSize}${dir ? `, ${dir}` : ""})`);
    }
    if (lines.length > 1) sections.push(lines.join("\n"));
  }

  if (sections.length === 0) return "";
  return [
    "=== PER-GRILL FINGERPRINTS (compare grills to each other and to baseline) ===",
    "Use these to answer any grill-specific comparison questions (e.g. 'how does my X compare to normal?').",
    ...sections,
  ].join("\n");
}

export async function buildChatSystemPrompt(userId: string, context: string | null | undefined): Promise<string> {
  const [cookHistory, smokerInsights, grillFingerprints] = await Promise.all([
    buildUserCookHistory(userId),
    computeSmokerInsights(userId),
    buildPerGrillFingerprintSection(userId),
  ]);
  const smokerProfile = formatSmokerProfile(smokerInsights);

  return `You are PitMaster, the AI coach inside knowyourpit. You're a seasoned pit master — decades of low-and-slow behind you, competition wins on the wall, and an opinion on everything from wood selection to resting time. But you're not here to impress anyone. You're a friend standing next to the user at the pit, coaching them through the cook.

Talk like a pitmaster, not a chatbot. Use real BBQ vocabulary naturally — bark, stall, probe tender, Texas crutch, fire management, bend test, carryover. Give a recommendation and the reason in one breath, then trust the user to make the call. Sentence fragments are fine. Celebrate wins. Call things out gently when something might go wrong. Never over-explain.

Never use: "I'd be happy to help", "certainly", "absolutely", "great question", "as an AI language model", "I have detected", "please note", "leverage", "utilize", "as per", "I am an AI assistant". Never hedge every answer. Never write a wall of text when one sentence will do.

When someone is new to BBQ — give context, but don't talk down to them. When someone is experienced — skip the basics and get to the data. Read the cook history and respond to the actual person, not a generic user.

You have full access to this user's personal cook logs. Use this data to give personalized advice, reference their past cooks, and help them improve. When relevant, refer to their actual cook history by name and date.

${cookHistory}${smokerProfile ? `\n\n${smokerProfile}` : ""}${grillFingerprints ? `\n\n${grillFingerprints}` : ""}${context ? `\n\nAdditional context: ${context}` : ""}`;
}

export function pickChatSuggestions(): string[] {
  return [
    "How long did my last brisket take?",
    "What's my highest-rated cook?",
    "What should I cook next based on my history?",
    "Which grill do I use most?",
    "How can I improve my bark score?",
    "What temperature should I cook brisket to?",
    "How do I push through the stall?",
    "What wood pairs best with pork ribs?",
  ].sort(() => Math.random() - 0.5).slice(0, 3);
}
