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

// Maximum number of individual cook records included in the chat prompt.
// Stats are always computed from up to 50 cooks; only the most recent
// CHAT_HISTORY_DETAIL_LIMIT are listed in full to keep prompt tokens low.
const CHAT_HISTORY_DETAIL_LIMIT = 10;

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

  const total = cooks.length;
  const completed = cooks.filter(c => c.status === "completed").length;
  const rated = cooks.filter(c => c.rating != null);
  const avgRating = rated.length > 0 ? (rated.reduce((s, c) => s + c.rating!, 0) / rated.length).toFixed(1) : null;

  // Top meat types by frequency
  const meatCounts: Record<string, number> = {};
  for (const c of cooks) {
    const key = c.foodType.toLowerCase();
    meatCounts[key] = (meatCounts[key] ?? 0) + 1;
  }
  const topMeats = Object.entries(meatCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, n]) => `${m} (${n}x)`)
    .join(", ");

  // Only include detail lines for the most recent cooks — stats above give
  // the AI the big picture; the recent cooks give specific context.
  const detailCooks = cooks.slice(0, CHAT_HISTORY_DETAIL_LIMIT);
  const lines = detailCooks.map(c => {
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

  const olderNote = total > CHAT_HISTORY_DETAIL_LIMIT
    ? `\n(${total - CHAT_HISTORY_DETAIL_LIMIT} older cook${total - CHAT_HISTORY_DETAIL_LIMIT === 1 ? "" : "s"} not shown — reference stats above)`
    : "";

  const summary = [
    `User's cook history — ${total} total, ${completed} completed${avgRating ? `, avg rating ${avgRating}/5` : ""}${topMeats ? `, most cooked: ${topMeats}` : ""}.`,
    `Most recent ${detailCooks.length} cook${detailCooks.length === 1 ? "" : "s"}:`,
    ...lines,
  ].join("\n") + olderNote;

  return summary;
}

// ─── Personal-query detection ───────────────────────────────────────────────
// Returns true when the message is clearly about the user's own cook data.
// General BBQ knowledge questions return false so the AI can skip loading
// the full cook history, reducing prompt tokens and cost.
// Errs on the side of inclusion — only skips when the question is clearly
// not personal (no possessive references, no data-lookup intent).
export function needsPersonalContext(message: string): boolean {
  if (!message || message.trim().length === 0) return true;
  const lower = message.toLowerCase();
  const PERSONAL_SIGNALS = [
    /\bmy (cook|cooks|grill|grills|pit|smoker|smokers|brisket|ribs|pork|chicken|turkey|history|data|log|logs|rating|ratings|record|records|stats|performance|results?)\b/,
    /\b(my last|my previous|my recent|my best|my worst|my highest|my lowest|my average)\b/,
    /\bhow (have i|am i doing|did i|do i typically|do i usually)\b/,
    /\b(show|tell|give|list) me my\b/,
    /\bbased on my\b/,
    /\bfor my (grill|pit|smoker)\b/,
    /\b(improve|improving|improvement|pattern|trend)s? (in my|with my|across my|from my)\b/,
    /\bwhat (have i|did i|do i)\b/,
    /\b(compare|comparing) (my|to my)\b/,
  ];
  return PERSONAL_SIGNALS.some((re) => re.test(lower));
}

export async function buildPerGrillFingerprintSection(userId: string): Promise<string> {
  const userGrills = await db
    .select({ id: grillsTable.id, name: grillsTable.name, type: grillsTable.type, brand: grillsTable.brand })
    .from(grillsTable)
    .where(eq(grillsTable.userId, userId))
    .limit(20);
  if (userGrills.length === 0) return "";

  // One compact line per grill — same data, ~85% fewer tokens than the old
  // multi-line format. Example: "Weber Kettle (charcoal, 5 cooks, med) — runs
  // HOT 12°F — brisket 45min/lb n=3 +12% · pork 38min/lb n=2 ~baseline"
  const parts: string[] = [];
  for (const g of userGrills) {
    const ins = await computeSmokerInsights(userId, g.id);
    if (ins.cookCount < 1) continue;
    const label = g.brand ? `${g.brand} ${g.name}` : g.name;
    const tokens: string[] = [
      `${label}${g.type ? ` (${g.type})` : ""}, ${ins.cookCount} cook${ins.cookCount === 1 ? "" : "s"}, ${ins.confidenceLevel}`,
    ];
    if (ins.pitBiasF != null && Math.abs(ins.pitBiasF) >= 3) {
      tokens.push(`runs ${ins.pitBiasF > 0 ? "HOT" : "COLD"} ${Math.abs(ins.pitBiasF)}°F`);
    }
    if (ins.overshootF != null && Math.abs(ins.overshootF) >= 3) {
      tokens.push(`${ins.overshootF > 0 ? "overshoots" : "undershoots"} ${Math.abs(ins.overshootF)}°F`);
    }
    const meatParts: string[] = [];
    for (const [meatKey, p] of Object.entries(ins.durationByMeat)) {
      if (p.sampleSize < 1) continue;
      const dir = p.pctDiff == null ? "" : p.pctDiff > 5 ? ` +${p.pctDiff}%` : p.pctDiff < -5 ? ` ${p.pctDiff}%` : " ~base";
      meatParts.push(`${meatKey.replace(/_/g, " ")} ${p.actualMinsPerLb}min/lb n=${p.sampleSize}${dir}`);
    }
    if (meatParts.length > 0) tokens.push(meatParts.join(" · "));
    if (tokens.length > 1) parts.push(tokens.join(" — "));
  }

  if (parts.length === 0) return "";
  return `Grill fingerprints: ${parts.join(" | ")}`;
}

// Session-scoped cache for system prompts. Multi-turn conversations re-use the
// same prompt within a 5-minute window, skipping the 3 DB queries needed to
// rebuild cook history / smoker profile / grill fingerprints on every turn.
const sessionPromptCache = new Map<string, { prompt: string; expiresAt: number }>();
const SESSION_PROMPT_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function buildChatSystemPrompt(
  userId: string,
  context: string | null | undefined,
  message?: string,
  sessionId?: number,
): Promise<string> {
  // Serve from cache for known sessions — avoids rebuilding the prompt (and
  // re-querying cook history) on every turn of a multi-turn conversation.
  if (sessionId != null) {
    const cacheKey = `${userId}:${sessionId}`;
    const cached = sessionPromptCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.prompt;
    }
  }

  // For questions that clearly don't reference the user's personal data (e.g.
  // "what temp for brisket?", "how do I push through the stall?"), skip the
  // expensive cook-history fetch entirely — the AI can answer with general
  // BBQ knowledge just as well and the prompt is significantly shorter.
  const personal = !message || needsPersonalContext(message);

  const [cookHistory, smokerInsights, grillFingerprints] = await Promise.all([
    personal ? buildUserCookHistory(userId) : Promise.resolve(null),
    personal ? computeSmokerInsights(userId) : Promise.resolve(null),
    personal ? buildPerGrillFingerprintSection(userId) : Promise.resolve(""),
  ]);
  const smokerProfile = smokerInsights ? formatSmokerProfile(smokerInsights) : null;

  const dataSection = personal
    ? `You have full access to this user's personal cook logs. Use this data to give personalized advice, reference their past cooks, and help them improve. When relevant, refer to their actual cook history by name and date.\n\n${cookHistory}${smokerProfile ? `\n\n${smokerProfile}` : ""}${grillFingerprints ? `\n\n${grillFingerprints}` : ""}`
    : `This user has cook logs in their profile but this question doesn't need them — answer from general BBQ knowledge.`;

  const prompt = `You are PitMaster, the AI coach inside knowyourpit. You're a seasoned pit master — decades of low-and-slow behind you, competition wins on the wall, and an opinion on everything from wood selection to resting time. But you're not here to impress anyone. You're a friend standing next to the user at the pit, coaching them through the cook.

Talk like a pitmaster, not a chatbot. Use real BBQ vocabulary naturally — bark, stall, probe tender, Texas crutch, fire management, bend test, carryover. Give a recommendation and the reason in one breath, then trust the user to make the call. Sentence fragments are fine. Celebrate wins. Call things out gently when something might go wrong. Never over-explain.

Never use: "I'd be happy to help", "certainly", "absolutely", "great question", "as an AI language model", "I have detected", "please note", "leverage", "utilize", "as per", "I am an AI assistant". Never hedge every answer. Never write a wall of text when one sentence will do.

When someone is new to BBQ — give context, but don't talk down to them. When someone is experienced — skip the basics and get to the data. Read the cook history and respond to the actual person, not a generic user.

${dataSection}${context ? `\n\nAdditional context: ${context}` : ""}`;

  if (sessionId != null) {
    sessionPromptCache.set(`${userId}:${sessionId}`, {
      prompt,
      expiresAt: Date.now() + SESSION_PROMPT_TTL_MS,
    });
  }

  return prompt;
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
