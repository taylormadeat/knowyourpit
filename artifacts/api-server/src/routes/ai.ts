import { Router, type IRouter, type Request } from "express";
import { eq, and, desc, asc } from "drizzle-orm";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { db, cooksTable, grillsTable, temperatureReadingsTable, conversations, messages } from "@workspace/db";
import { AiChatBody, AiPredictBody, AiMultiCookBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";
import { computeSmokerInsights, formatSmokerProfile, simplifyFoodType } from "../lib/smokerCalibration";
import {
  FREE_AI_CHAT_DAILY_LIMIT,
  respondPaywall,
  countAiChatMessagesToday,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../lib/paywall";

interface AuthedRequest extends Request {
  userId: string;
}

const aiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req as AuthedRequest).userId,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many AI requests. Please wait a moment before trying again." },
});

const router: IRouter = Router();

const PIT_PROBE_NAMES = ["pit", "ambient", "grill", "chamber", "dome", "lid"];
const isPitProbe = (name: string | null) =>
  name ? PIT_PROBE_NAMES.some(k => name.toLowerCase().includes(k)) : false;

interface StoredAssessment {
  verdict?: string;
  summary?: string;
  whatWentWell?: string[];
  suggestions?: string[];
}

interface StoredAnalysisResult {
  assessment?: StoredAssessment | null;
}

function getAssessment(analysisResult: unknown): StoredAssessment | null {
  if (!analysisResult || typeof analysisResult !== "object") return null;
  const result = analysisResult as StoredAnalysisResult;
  return result.assessment ?? null;
}

async function buildUserCookHistory(userId: string): Promise<string> {
  const cooks = await db.select().from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .orderBy(desc(cooksTable.createdAt))
    .limit(50);

  if (cooks.length === 0) {
    return "This user has no cook logs yet.";
  }

  // Fetch grill names in one pass
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

async function buildPerGrillFingerprintSection(userId: string): Promise<string> {
  // Inject a compact fingerprint summary for each of the user's grills so
  // the AI can answer comparison questions like "how does my Huntsman
  // compare to normal?" without needing the user to specify a grillId.
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

async function buildChatSystemPrompt(userId: string, context: string | null | undefined): Promise<string> {
  const [cookHistory, smokerInsights, grillFingerprints] = await Promise.all([
    buildUserCookHistory(userId),
    computeSmokerInsights(userId),
    buildPerGrillFingerprintSection(userId),
  ]);
  const smokerProfile = formatSmokerProfile(smokerInsights);

  return `You are knowyourpit AI, an expert BBQ assistant and personal pit coach. You help users with BBQ cooking, grilling techniques, temperature guidance, timing predictions, and recipe suggestions. You are knowledgeable about all BBQ styles including Texas BBQ, Carolina BBQ, Kansas City style, and more. Provide practical, specific advice.

You have full access to this user's personal cook logs. Use this data to give personalized advice, reference their past cooks, and help them improve. When relevant, refer to their actual cook history by name and date.

${cookHistory}${smokerProfile ? `\n\n${smokerProfile}` : ""}${grillFingerprints ? `\n\n${grillFingerprints}` : ""}${context ? `\n\nAdditional context: ${context}` : ""}`;
}

function pickChatSuggestions(): string[] {
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

// ─── Chat session endpoints ────────────────────────────────────────────────

router.get("/ai/chats", requireAuth, async (req: any, res): Promise<void> => {
  const convs = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, req.userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(100);
  res.json({ conversations: convs });
});

router.get("/ai/chats/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [conv] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)));
  if (!conv) { res.status(404).json({ error: "Not found" }); return; }
  const msgs = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json({ conversation: conv, messages: msgs });
});

router.patch("/ai/chats/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title } = req.body;
  if (typeof title !== "string" || !title.trim()) {
    res.status(400).json({ error: "title is required" }); return;
  }
  const [updated] = await db
    .update(conversations)
    .set({ title: title.trim().slice(0, 200) })
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)))
    .returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ conversation: updated });
});

router.delete("/ai/chats/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db
    .delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)));
  res.status(204).end();
});

// ─── Extended body schema with optional sessionId ─────────────────────────
const AiChatBodyWithSession = AiChatBody.extend({
  sessionId: z.number().int().optional(),
});

// ─── Helper: ensure session exists and return its id ──────────────────────
async function ensureSession(
  userId: string,
  userMessage: string,
  sessionId?: number,
): Promise<{ id: number; isNew: boolean }> {
  if (sessionId != null) {
    const [existing] = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.id, sessionId), eq(conversations.userId, userId)));
    if (existing) return { id: existing.id, isNew: false };
  }
  const title = userMessage.trim().slice(0, 80) || "New chat";
  const [created] = await db
    .insert(conversations)
    .values({ userId, title })
    .returning({ id: conversations.id });
  return { id: created.id, isNew: true };
}

// ─── Helper: generate a short AI title for a conversation ─────────────────
async function generateChatTitle(userMessage: string, assistantReply: string): Promise<string | null> {
  try {
    const preview = assistantReply.slice(0, 200);
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      max_completion_tokens: 20,
      messages: [
        {
          role: "system",
          content: "You are a title generator. Given a user's BBQ question and the start of the assistant's reply, produce a concise 3–5 word title that captures the topic. Respond with ONLY the title — no quotes, no punctuation at the end, no explanation.",
        },
        {
          role: "user",
          content: `User asked: ${userMessage}\nAssistant started: ${preview}`,
        },
      ],
    });
    const raw = response.choices[0]?.message?.content?.trim() ?? "";
    if (!raw) return null;
    return raw.slice(0, 200);
  } catch {
    return null;
  }
}

// ─── Original non-streaming endpoint ──────────────────────────────────────
router.post("/ai/chat", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiChatBodyWithSession.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context, sessionId: requestedSessionId } = parsed.data;

  // Free-tier daily AI chat cap.
  if (!(await userBypassesPaywall(req))) {
    const used = await countAiChatMessagesToday(req.userId);
    if (used >= FREE_AI_CHAT_DAILY_LIMIT) {
      respondPaywall(res, {
        code: "ai_message_limit_reached",
        limit: FREE_AI_CHAT_DAILY_LIMIT,
        used,
        resetsAt: startOfNextUtcDay().toISOString(),
        message: `Free plan is capped at ${FREE_AI_CHAT_DAILY_LIMIT} AI chat messages per day. Upgrade to Pro for unlimited.`,
      });
      return;
    }
  }

  const { id: resolvedSessionId, isNew } = await ensureSession(req.userId, message, requestedSessionId);
  await db.insert(messages).values({
    conversationId: resolvedSessionId,
    role: "user",
    content: message,
  });

  const systemPrompt = await buildChatSystemPrompt(req.userId, context);

  const HISTORY_LIMIT = 20;
  const priorMessages = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, resolvedSessionId))
    .orderBy(desc(messages.createdAt))
    .limit(HISTORY_LIMIT);

  const historyTurns = priorMessages
    .reverse()
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_completion_tokens: 1024,
    messages: [
      { role: "system", content: systemPrompt },
      ...historyTurns,
    ],
  });

  const reply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't process that request.";

  await db.insert(messages).values({
    conversationId: resolvedSessionId,
    role: "assistant",
    content: reply,
  });

  let generatedTitle: string | undefined;
  if (isNew) {
    const aiTitle = await generateChatTitle(message, reply);
    if (aiTitle) {
      generatedTitle = aiTitle;
      await db
        .update(conversations)
        .set({ title: aiTitle, updatedAt: new Date() })
        .where(eq(conversations.id, resolvedSessionId));
    } else {
      await db
        .update(conversations)
        .set({ updatedAt: new Date() })
        .where(eq(conversations.id, resolvedSessionId));
    }
  } else {
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, resolvedSessionId));
  }

  const suggestions = pickChatSuggestions();

  res.json({ reply, suggestions, sessionId: resolvedSessionId, ...(generatedTitle ? { title: generatedTitle } : {}) });
});

router.post("/ai/chat/stream", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiChatBodyWithSession.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context, sessionId: requestedSessionId } = parsed.data;

  // Free-tier daily AI chat cap. Check BEFORE setting NDJSON headers so the
  // mobile client can read a normal JSON 402 response.
  if (!(await userBypassesPaywall(req))) {
    const used = await countAiChatMessagesToday(req.userId);
    if (used >= FREE_AI_CHAT_DAILY_LIMIT) {
      respondPaywall(res, {
        code: "ai_message_limit_reached",
        limit: FREE_AI_CHAT_DAILY_LIMIT,
        used,
        resetsAt: startOfNextUtcDay().toISOString(),
        message: `Free plan is capped at ${FREE_AI_CHAT_DAILY_LIMIT} AI chat messages per day. Upgrade to Pro for unlimited.`,
      });
      return;
    }
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (event: Record<string, unknown>): void => {
    if (res.writableEnded) return;
    res.write(JSON.stringify(event) + "\n");
  };

  const heartbeat = setInterval(() => {
    if (res.writableEnded) return;
    res.write("\n");
  }, 15000);

  let aborted = false;
  req.on("close", () => {
    aborted = true;
  });

  let resolvedSessionId: number | null = null;
  let isNewSession = false;

  try {
    // Create or resolve the session, then persist the user message.
    const sessionResult = await ensureSession(req.userId, message, requestedSessionId);
    resolvedSessionId = sessionResult.id;
    isNewSession = sessionResult.isNew;
    await db.insert(messages).values({
      conversationId: resolvedSessionId,
      role: "user",
      content: message,
    });
    // Tell the client which session this belongs to (important when a new session was created).
    writeEvent({ type: "session", sessionId: resolvedSessionId });

    const systemPrompt = await buildChatSystemPrompt(req.userId, context);

    const HISTORY_LIMIT = 20;
    const priorMessages = await db
      .select({ role: messages.role, content: messages.content })
      .from(messages)
      .where(eq(messages.conversationId, resolvedSessionId))
      .orderBy(desc(messages.createdAt))
      .limit(HISTORY_LIMIT);

    const historyTurns = priorMessages
      .reverse()
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    const stream = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_completion_tokens: 1024,
      messages: [
        { role: "system", content: systemPrompt },
        ...historyTurns,
      ],
      stream: true,
    });

    let fullReply = "";
    let anyContent = false;
    for await (const chunk of stream) {
      if (aborted) break;
      const delta = chunk.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta.length > 0) {
        anyContent = true;
        fullReply += delta;
        writeEvent({ type: "delta", text: delta });
      }
    }

    if (!aborted) {
      if (!anyContent) {
        const fallback = "I'm sorry, I couldn't process that request.";
        fullReply = fallback;
        writeEvent({ type: "delta", text: fallback });
      }
      // Persist the assistant's full reply.
      await db.insert(messages).values({
        conversationId: resolvedSessionId,
        role: "assistant",
        content: fullReply,
      });

      // Generate a smart title for new sessions.
      let generatedTitle: string | undefined;
      if (isNewSession) {
        const aiTitle = await generateChatTitle(message, fullReply);
        if (aiTitle) {
          generatedTitle = aiTitle;
          await db
            .update(conversations)
            .set({ title: aiTitle, updatedAt: new Date() })
            .where(eq(conversations.id, resolvedSessionId));
        } else {
          await db
            .update(conversations)
            .set({ updatedAt: new Date() })
            .where(eq(conversations.id, resolvedSessionId));
        }
      } else {
        // Touch updatedAt on the conversation.
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, resolvedSessionId));
      }

      const doneEvent: Record<string, unknown> = { type: "done", suggestions: pickChatSuggestions() };
      if (generatedTitle) doneEvent.title = generatedTitle;
      writeEvent(doneEvent);
    }
  } catch (err: any) {
    writeEvent({
      type: "error",
      message: err?.message || "PitMaster ran into a problem mid-reply.",
    });
  } finally {
    clearInterval(heartbeat);
    if (!res.writableEnded) res.end();
  }
});

// ─── Meat knowledge baseline (server-side, independent of client catalog) ─────
// Keywords → { minsPerLb, cookTempF, targetTempF, restMins, wrapRec }
interface MeatBaseline {
  minsPerLb: number;
  cookTempF: number;
  targetTempF: number;
  restMins: number;
  wrapRec: "foil" | "butcher_paper" | "none";
  wrapAtMins?: number;    // minutes into cook
  wrapTempF?: number;     // internal temp at which to wrap
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

  // Cook-time prediction during planning is intentionally NOT counted
  // against the free-tier daily AI analyze cap. The cap exists for the
  // explicit "AI cook analyzer" feature (POST /temperature/analyze-cook)
  // and shouldn't lock a user out of planning new cooks. Cost is bounded
  // by aiRateLimit (20/min/user) above.

  const { grillId, foodType, weightLbs, cookTempF, targetTempF, desiredFinishAt, preheatMinutes: clientPreheatMinutes, outdoorTempF, outdoorTempIsForecast } = parsed.data;

  // ── Meat knowledge baseline ──────────────────────────────────────────
  const baseline = getMeatBaseline(foodType);

  // ── Grill context ────────────────────────────────────────────────────
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

  // ── Preheat time ─────────────────────────────────────────────────────
  const preheatDefaults: Record<string, number> = {
    offset_smoker: 60, charcoal: 30, kamado: 45, pellet: 20, gas: 15, electric: 20, other: 30,
  };
  const normalizeType = (t: string) => t.toLowerCase().replace(/[\s-]+/g, "_");
  const preheatMinutes = clientPreheatMinutes ?? (grillType ? (preheatDefaults[normalizeType(grillType)] ?? 30) : 30);

  // ── User's full cook history (all grills) — always included ──────────
  const allUserCooks = await db.select().from(cooksTable)
    .where(and(eq(cooksTable.status, "completed"), eq(cooksTable.userId, req.userId)))
    .orderBy(desc(cooksTable.createdAt))
    .limit(30);

  const firstWord = foodType.toLowerCase().split(" ")[0];
  const similarCooksAllGrills = allUserCooks.filter(c =>
    c.foodType.toLowerCase().includes(firstWord)
  );

  // Fetch grill names for the similar cooks
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

  // Boost confidence to "high" if user has 2+ similar cooks that BOTH have ratings AND have assessments
  const similarWithFeedback = similarCooksAllGrills.filter(c => {
    const hasRating = !!(c.ratingTenderness || c.ratingBark || c.ratingFlavor);
    const hasAssessment = !!getAssessment(c.analysisResult)?.verdict;
    return hasRating && hasAssessment;
  });
  const hasRichHistory = similarWithFeedback.length >= 2;

  // ── Build prompts ─────────────────────────────────────────────────────
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

  // ── Fingerprint calibration (deterministic) ─────────────────────────
  // Build a single `calibratedMinsPerLb` from learned data with this
  // priority: per-grill+meat (≥2 cooks) → user-wide+meat (≥2 cooks) → null.
  // When weight is known, this drives the estimate directly.
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

  // Pit bias note (only meaningful when we have per-grill data)
  const pitBiasF = grillInsights?.pitBiasF ?? null;
  const significantBias = pitBiasF != null && Math.abs(pitBiasF) >= 3;

  // Prompt guidance (always describes what we're enforcing server-side)
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

  // Apply fingerprint deterministically: when we have a learned pace and
  // a known weight, ALWAYS derive the estimate from `calibratedMinsPerLb
  // × weightLbs`. The LLM is instructed to align its rationale to this.
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
  // The fingerprint materially influenced the response whenever we built
  // a deterministic note for the user — whether that's a learned-pace
  // override (with or without a known weight) or a pit-bias adjustment
  // note. The UI uses this flag to decide whether to render the chip.
  const fingerprintApplied = fingerprintNote != null;
  // Distinguish how the fingerprint was applied so the UI can pick chip
  // text accurately (per-grill learned pace, user-wide learned pace
  // fallback, or pit-bias-only adjustment).
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

  // Note: /ai/predict (cook-time planning) is intentionally NOT recorded
  // against the daily AI analyze cap — that counter is reserved for the
  // explicit "AI cook analyzer" feature on POST /temperature/analyze-cook.

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

// ── KCBS Competition coaching context ─────────────────────────────────────────
const KCBS_COMPETITION_TIPS: Record<"chicken" | "ribs" | "pork" | "brisket", string> = {
  chicken:
    "CHICKEN — judges score appearance (bite-through skin, mahogany glossy color), taste (layered salt+sweet+heat from brine + glaze), texture (tender at 175–180°F internal in the thigh, never mushy). Pulled/shredded chicken is a DQ.",
  ribs:
    "RIBS — judges score appearance (uniform mahogany bark, light glaze, six clean bones same direction), taste (sweet-forward with brown sugar/honey/butter wrap), texture (clean bite-through, ~¼\" pull-back, NEVER fall-off-the-bone which scores as overcooked). Boneless ribs and pulled rib meat are DQs.",
  pork:
    "PORK — judges expect three presentations: money muscle medallions (¼\" sliced, fanned), 1.5\" chunks, and pulled. Inject (apple juice + phosphate or commercial), bark seasoning, light finishing glaze. Money muscle slices firm; chunks tender but hold shape; pulled has visible bark mixed in.",
  brisket:
    "BRISKET — judges expect pencil-thick (¼\") slices from the FLAT, perfect smoke ring, glossy bark; burnt ends as ½–¾\" cubes glazed/caramelized from the point. Beefy + salt + pepper foundation, butcher paper wrap, hot-hold rest 1–2 hours. The pull/bend test: bend without breaking, tear with gentle pull. Chopped brisket is a DQ.",
};

function buildCompetitionContextForPrompt(
  competitionName: string | null,
  items: ReadonlyArray<{ category?: string | null }>,
): string {
  const cats = new Set<string>();
  for (const it of items) {
    if (it.category && KCBS_COMPETITION_TIPS[it.category as keyof typeof KCBS_COMPETITION_TIPS]) {
      cats.add(it.category);
    }
  }
  const lines: string[] = ["", "=== KCBS COMPETITION COACHING ==="];
  if (competitionName) lines.push(`Competition: ${competitionName}`);
  lines.push(
    "Judging: 6 judges score Appearance + Taste + Texture (1–9 each). Lowest score is dropped. Coach for COMPETITION standards, not backyard.",
  );
  for (const c of cats) {
    lines.push(`- ${KCBS_COMPETITION_TIPS[c as keyof typeof KCBS_COMPETITION_TIPS]}`);
  }
  lines.push(
    "Box packing reminders: garnish base only (parsley/curly parsley/leaf lettuce/cilantro — no kale, no orange/yellow lettuce — instant DQ). Never mark or initial the box. Pack at 165°F+ to hold heat through judging. Build a 30–60 min hot-hold buffer for brisket and pork; chicken and ribs are tighter.",
  );
  lines.push(
    "Within EACH item's notes field, give one COMPETITION-specific tip (e.g., 'flip-and-render thigh skin at the wrap step for bite-through', 'cut a clean half-moon test rib at home before turn-in') — not generic backyard advice.",
  );
  return lines.join("\n");
}

router.post("/ai/multi-cook", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  // Multi-Cook Sequencer is a Pro-only feature.
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "multi_cook",
      message: "Multi-Cook Sequencer is a Pro feature. Upgrade to plan multiple items together.",
    });
    return;
  }

  const parsed = AiMultiCookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { items, serveAt, outdoorTempF, outdoorTempIsForecast, competition } = parsed.data;

  const isCompetitionMode = competition?.isCompetition === true;

  if (items.length < 1 || items.length > 5) {
    res.status(400).json({ error: "Provide between 1 and 5 items." });
    return;
  }
  if (!isCompetitionMode && items.length < 2) {
    res.status(400).json({ error: "Provide at least 2 items for the multi-cook sequencer." });
    return;
  }

  const serveAtDate = new Date(serveAt);

  // Build item lines for the prompt
  const itemLines = items.map((item, i) => {
    const preheat = item.preheatMinutes ?? 25;
    const parts: string[] = [
      `${i + 1}. ${item.foodType}`,
      item.weightLbs ? `${item.weightLbs} lbs` : "weight unknown",
      item.cookTempF ? `cook at ${item.cookTempF}°F` : "cook temp unknown",
      item.targetTempF ? `target internal ${item.targetTempF}°F` : "",
      `preheat ${preheat} min`,
      item.category ? `KCBS category: ${item.category}` : "",
      item.turnInAt ? `turn-in: ${new Date(item.turnInAt).toLocaleString()}` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  }).join("\n");

  // Fetch user context
  const [cookHistory, smokerInsights] = await Promise.all([
    buildUserCookHistory(req.userId),
    computeSmokerInsights(req.userId),
  ]);
  const smokerProfile = formatSmokerProfile(smokerInsights);

  const outdoorLine = outdoorTempF != null
    ? `\nOutdoor ambient temperature: ${outdoorTempF}°F (${outdoorTempIsForecast ? "forecast for cook day" : "current"}) — factor this into all estimates. Cold weather increases cook times; hot weather may reduce them.\n`
    : "";

  const competitionContext = isCompetitionMode
    ? buildCompetitionContextForPrompt(competition?.name ?? null, items)
    : "";

  const systemPrompt = `You are knowyourpit AI, a world-class BBQ pit master${isCompetitionMode ? " coaching a competitor in a sanctioned KCBS BBQ competition" : ""}. You are sequencing a multi-cook session${isCompetitionMode ? " where each item has its OWN competition turn-in time" : " where everything must be ready to serve at the same time"}.

For each item, calculate working BACKWARDS from ${isCompetitionMode ? "that item's individual turnInAt (each category has its own turn-in time — backwards-plan each independently)" : "the serveAt time"}:
- restMinutes: how long the meat should rest after leaving the grill
- estimatedDurationMinutes: active cook time only (meat on grill to off grill), NOT including preheat or rest
- preheatMinutes: use the value provided per item
- estimatedFinishAt = ${isCompetitionMode ? "turnInAt - boxPackLeadMinutes(15) - restMinutes" : "serveAt - restMinutes"}
- meatOnAt = estimatedFinishAt - estimatedDurationMinutes
- grillLightAt = meatOnAt - preheatMinutes
${isCompetitionMode ? "- boxPackAt = turnInAt - 15 minutes (when slicing/portioning + box presentation must begin)\n" : ""}
All times must be ISO 8601 strings.${isCompetitionMode ? " Each item finishes its rest just before its boxPackAt." : " All items finish resting at or just before serveAt."}

For each item, also determine wrap guidance:
- wrapMethod: "foil" (Texas Crutch — faster, steams), "butcher_paper" (breathable, retains bark), or "none"
- wrapAtMinutes: minutes from meatOnAt when to wrap. REQUIRED whenever wrapMethod is "foil" or "butcher_paper" — never null in that case. Null only when wrapMethod is "none".
- wrapTempF: internal meat temperature to trigger wrap in °F (null if not applicable)
- wrapReason: one sentence explaining the wrap strategy for this item

IMPORTANT: When wrapMethod is "foil" or "butcher_paper", wrap details MUST go in the wrap fields above (wrapAtMinutes, wrapTempF, wrapReason). DO NOT mention wrapping in the "notes" field — the UI renders the wrap step as its own row in the schedule using the wrap fields, and duplicating it in notes will confuse the user.

Wrap guidance by cut:
- Brisket (whole packer, flat): butcher_paper around the stall (~160-170°F internal, ~50-60% into cook)
- Pork shoulder / butt: foil around the stall (~160-165°F internal, ~50-60% into cook)
- Spare ribs / St. Louis: foil (3-2-1 method: 3h smoke, 2h foil, 1h unwrapped) or butcher_paper, wrap at 2-3h in
- Baby back ribs: foil (2-2-1 method: 2h smoke, 2h foil, 1h unwrapped), wrap at 2h in
- Chicken / turkey: none (wrapping steams poultry, ruins skin)
- Salmon / fish: none
- Sausage / hot dogs: none
- Other lean cuts (tri-tip, flat iron): none or butcher_paper briefly if stalling

Return ONLY valid JSON, no markdown:
{
  "schedule": [
    {
      "foodType": "string",
      "estimatedDurationMinutes": number,
      "preheatMinutes": number,
      "restMinutes": number,
      "grillLightAt": "ISO string",
      "meatOnAt": "ISO string",
      "estimatedFinishAt": "ISO string",
      "wrapMethod": "foil|butcher_paper|none",
      "wrapAtMinutes": number_or_null,
      "wrapTempF": number_or_null,
      "wrapReason": "string",
      "notes": "one additional specific tip for this item beyond wrap${isCompetitionMode ? " — focus on KCBS judging criteria" : ""}"${isCompetitionMode ? ',\n      "category": "chicken|ribs|pork|brisket",\n      "turnInAt": "ISO string (echoed from input)",\n      "boxPackAt": "ISO string (turnInAt - 15 minutes)"' : ""}
    }
  ],
  "serveAt": "ISO string",
  "summary": "One sentence summary of the full sequencing plan${isCompetitionMode ? " (mention competition pacing)" : ""}"
}${isCompetitionMode ? `\n\n${competitionContext}` : ""}`;

  const userPrompt = `${isCompetitionMode ? `KCBS Competition session${competition?.name ? ` — ${competition.name}` : ""}. Each item has its own turn-in time below.` : `Multi-cook session. Everything must be ready to serve at: ${serveAtDate.toLocaleString()}`}
${outdoorLine}
Items to cook:
${itemLines}

${smokerProfile ? smokerProfile + "\n" : ""}${cookHistory}`;

  try {
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

    let result: { schedule: any[]; serveAt: string; summary: string };
    try {
      result = JSON.parse(cleaned);
    } catch {
      res.status(500).json({ error: "Could not parse AI response. Please try again." });
      return;
    }

    // Normalize wrap fields and sort schedule by grillLightAt ascending.
    // When the model picks a wrap method but forgets the timing, infer
    // wrapAtMinutes ≈ 55% of the active cook so the wrap row always has
    // a usable time to render against in the schedule UI.
    const normalizeWrapMethod = (m: any): "foil" | "butcher_paper" | "none" | null => {
      if (m === "foil" || m === "butcher_paper" || m === "none") return m;
      return null;
    };
    const normalizeCategory = (c: any): "chicken" | "ribs" | "pork" | "brisket" | null => {
      if (c === "chicken" || c === "ribs" || c === "pork" || c === "brisket") return c;
      return null;
    };
    // Build a lookup of input items by foodType so we can backfill
    // category / turnInAt that the model might forget to echo back.
    const inputByFoodType = new Map<string, (typeof items)[number]>();
    for (const it of items) {
      if (!inputByFoodType.has(it.foodType)) inputByFoodType.set(it.foodType, it);
    }
    const BOX_PACK_LEAD_MS = 15 * 60_000;
    const schedule = (result.schedule ?? [])
      .map((item: any) => {
        const wrapMethod = normalizeWrapMethod(item.wrapMethod);
        const isNoWrap = wrapMethod == null || wrapMethod === "none";
        const cookMin = typeof item.estimatedDurationMinutes === "number"
          ? item.estimatedDurationMinutes
          : 0;
        const explicitWrapAt = typeof item.wrapAtMinutes === "number" && item.wrapAtMinutes > 0
          ? Math.round(item.wrapAtMinutes)
          : null;
        const inferredWrapAt = cookMin > 0 ? Math.max(30, Math.round(cookMin * 0.55)) : null;
        const wrapAtMinutes = isNoWrap
          ? null
          : (explicitWrapAt ?? inferredWrapAt);
        const wrapTempF = isNoWrap
          ? null
          : (typeof item.wrapTempF === "number" ? Math.round(item.wrapTempF) : null);
        const wrapReason = isNoWrap
          ? null
          : (typeof item.wrapReason === "string" && item.wrapReason.trim().length > 0 ? item.wrapReason : null);

        const inputMatch = inputByFoodType.get(item.foodType);
        const category = normalizeCategory(item.category) ?? normalizeCategory(inputMatch?.category) ?? null;
        const turnInAtSource = item.turnInAt ?? inputMatch?.turnInAt ?? null;
        let turnInAt: string | null = null;
        if (turnInAtSource) {
          const parsed = new Date(turnInAtSource);
          if (!Number.isNaN(parsed.getTime())) {
            turnInAt = parsed.toISOString();
          } else if (inputMatch?.turnInAt) {
            // Fall back to the input turnInAt if the model returned garbage
            const fallback = new Date(inputMatch.turnInAt);
            if (!Number.isNaN(fallback.getTime())) {
              turnInAt = fallback.toISOString();
            }
          }
        }
        const boxPackAt = isCompetitionMode && turnInAt
          ? new Date(new Date(turnInAt).getTime() - BOX_PACK_LEAD_MS).toISOString()
          : null;

        return {
          ...item,
          wrapMethod,
          wrapAtMinutes,
          wrapTempF,
          wrapReason,
          category,
          turnInAt,
          boxPackAt,
        };
      })
      .sort(
        (a: any, b: any) => new Date(a.grillLightAt).getTime() - new Date(b.grillLightAt).getTime()
      );

    // Build a deterministic summary describing sequence order only.
    // Times are intentionally omitted here — the server runs in UTC so any
    // time formatted here would reflect UTC, not the user's local timezone.
    // The client already shows "Everything ready by X" in the modal header
    // using the device's local timezone, so no need to repeat it.
    const firstItem = schedule[0];
    const lastItem = schedule[schedule.length - 1];
    let deterministicSummary = "";
    if (isCompetitionMode) {
      const cats = schedule
        .map((it: any) => it.category)
        .filter((c: any) => typeof c === "string");
      deterministicSummary = cats.length > 0
        ? `KCBS competition day — ${cats.join(", ")}. First fire: ${firstItem?.foodType ?? "—"}.`
        : `KCBS competition day plan ready.`;
    } else if (schedule.length >= 2) {
      deterministicSummary = `Start ${firstItem.foodType} first, then ${lastItem.foodType} last.`;
    }

    res.json({
      schedule,
      serveAt: serveAtDate.toISOString(),
      summary: deterministicSummary,
    });
  } catch (err: any) {
    req.log.error({ err }, "multi-cook error");
    res.status(500).json({ error: "AI request failed. Please try again." });
  }
});

router.get("/ai/smoker-profile", requireAuth, async (req: any, res): Promise<void> => {
  try {
    const insights = await computeSmokerInsights(req.userId);
    res.json(insights);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute smoker profile" });
  }
});

// ── Home Insights (PitMaster score + AI tips) ─────────────────────────────────
interface HomeInsights {
  pitMasterScore: number;
  scoreLabel: string;
  scoreBreakdown: {
    avgRating: number | null;
    planAccuracy: number | null;
    aiAssessmentScore: number | null;
    cookCount: number;
  };
  tips: string[];
  tipsGeneratedAt: string;
}

const homeInsightsCache = new Map<string, { data: HomeInsights; expiresAt: number }>();

export function clearHomeInsightsCache(userId: string): void {
  homeInsightsCache.delete(userId);
}

function getPitMasterLabel(score: number): string {
  if (score >= 95) return "The BBQ Deity";
  if (score >= 85) return "Grand Poobah of the Pit";
  if (score >= 70) return "The Smoke Whisperer";
  if (score >= 55) return "Lord of the Questionable Bark";
  if (score >= 40) return "Chief Charcoal Excuse Officer";
  if (score >= 25) return "Warden of the Wayward Flame";
  return "The Anointed Fire Hazard";
}

router.get("/ai/home-insights", requireAuth, async (req: any, res): Promise<void> => {
  // Home insights (PitMaster Score breakdown + AI tips) are Pro-only.
  // Free users see a locked card on the home screen instead of real data.
  if (!(await userBypassesPaywall(req))) {
    respondPaywall(res, {
      code: "pro_required",
      feature: "home_insights",
      message: "AI Home Insights are a Pro feature. Upgrade to see your PitMaster Score and personalized tips.",
    });
    return;
  }

  try {
    const cached = homeInsightsCache.get(req.userId);
    if (cached && cached.expiresAt > Date.now()) {
      res.json(cached.data);
      return;
    }

    const cooks = await db
      .select()
      .from(cooksTable)
      .where(and(eq(cooksTable.userId, req.userId), eq(cooksTable.status, "completed")))
      .orderBy(desc(cooksTable.createdAt))
      .limit(50);

    const cookCount = cooks.length;

    // Average rating score (1–5 → 0–100)
    const rated = cooks.filter((c) => c.rating != null);
    const avgRating =
      rated.length > 0
        ? rated.reduce((s, c) => s + c.rating!, 0) / rated.length
        : null;
    const avgRatingScore = avgRating != null ? (avgRating / 5) * 100 : null;

    // Plan accuracy from cooks that have all four timestamps
    const accuracies: number[] = [];
    for (const c of cooks) {
      if (!c.plannedStartAt || !c.plannedEndAt || !c.actualStartAt || !c.actualEndAt) continue;
      const planned =
        new Date(c.plannedEndAt).getTime() - new Date(c.plannedStartAt).getTime();
      const actual =
        new Date(c.actualEndAt).getTime() - new Date(c.actualStartAt).getTime();
      if (planned < 5 * 60 * 1000) continue;
      const deviationPct = (Math.abs(actual - planned) / planned) * 100;
      accuracies.push(Math.max(0, Math.round(100 - deviationPct)));
    }
    const planAccuracy =
      accuracies.length > 0
        ? Math.round(accuracies.reduce((s, a) => s + a, 0) / accuracies.length)
        : null;

    // AI assessment quality score — average verdict scores across cooks with analysis
    const VERDICT_SCORE: Record<string, number> = {
      perfect: 100,
      good: 75,
      needs_work: 50,
      overcooked: 25,
      undercooked: 25,
    };
    const verdictScores: number[] = [];
    for (const c of cooks) {
      const verdict = getAssessment(c.analysisResult)?.verdict;
      if (verdict && VERDICT_SCORE[verdict] !== undefined) {
        verdictScores.push(VERDICT_SCORE[verdict]);
      }
    }
    const aiAssessmentScore =
      verdictScores.length > 0
        ? Math.round(verdictScores.reduce((s, v) => s + v, 0) / verdictScores.length)
        : null;

    // Competition placement contribution — KCBS finishes are strong evidence
    // of cook quality regardless of self-rating, so we weight them heavily.
    const placementToScore = (placement: number): number => {
      if (placement === 0) return 50; // DNP
      if (placement === 1) return 100;
      if (placement === 2) return 92;
      if (placement === 3) return 85;
      if (placement <= 5) return 78;
      if (placement <= 10) return 70;
      if (placement <= 20) return 60;
      return 50;
    };
    const placementScores: number[] = [];
    for (const c of cooks) {
      if (c.isCompetition && c.competitionPlacement != null) {
        placementScores.push(placementToScore(c.competitionPlacement));
      }
    }
    const competitionScore =
      placementScores.length > 0
        ? Math.round(placementScores.reduce((s, v) => s + v, 0) / placementScores.length)
        : null;

    // Weighted composite score. When competition results exist, they replace
    // the rating weight at 0.5 (highest weight) since they're objective judging.
    let weightedSum = 0;
    let totalWeight = 0;
    if (competitionScore != null) {
      weightedSum += competitionScore * 0.5; totalWeight += 0.5;
      if (avgRatingScore != null) { weightedSum += avgRatingScore * 0.15; totalWeight += 0.15; }
      if (planAccuracy != null) { weightedSum += planAccuracy * 0.25; totalWeight += 0.25; }
      if (aiAssessmentScore != null) { weightedSum += aiAssessmentScore * 0.1; totalWeight += 0.1; }
    } else {
      if (avgRatingScore != null) { weightedSum += avgRatingScore * 0.4; totalWeight += 0.4; }
      if (planAccuracy != null) { weightedSum += planAccuracy * 0.4; totalWeight += 0.4; }
      if (aiAssessmentScore != null) { weightedSum += aiAssessmentScore * 0.2; totalWeight += 0.2; }
    }
    const pitMasterScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Generate tips via AI if enough data, else use fallbacks
    let tips: string[] = [];
    if (cookCount >= 2) {
      const summaryLines = cooks.slice(0, 12).map((c) => {
        const parts = [c.foodType || "unknown"];
        if (c.rating) parts.push(`rated ${c.rating}/5`);
        if (c.ratingTenderness) parts.push(`tenderness ${c.ratingTenderness}/5`);
        if (c.ratingBark) parts.push(`bark ${c.ratingBark}/5`);
        if (c.ratingFlavor) parts.push(`flavor ${c.ratingFlavor}/5`);
        const assessment = getAssessment(c.analysisResult);
        if (assessment?.verdict) parts.push(`verdict: "${assessment.verdict}"`);
        if (assessment?.suggestions?.[0]) parts.push(`tip given: "${assessment.suggestions[0]}"`);
        return `- ${parts.join(", ")}`;
      });

      const prompt = `You are PitMaster AI, a BBQ expert coach. Based on this pitmaster's cook history, write exactly 3 short tips to help them improve. Each tip must be 1–2 sentences, specific to their patterns — reference their actual food types, ratings, or recurring issues. No generic advice. No bullet points or numbering — just the tip text.

Cook history:
${summaryLines.join("\n")}

Respond ONLY with a JSON array of exactly 3 strings: ["tip1", "tip2", "tip3"]`;

      try {
        const aiRes = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_completion_tokens: 400,
          messages: [{ role: "user", content: prompt }],
        });
        const text = aiRes.choices[0]?.message?.content ?? "[]";
        const match = text.match(/\[[\s\S]*\]/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed) && parsed.length > 0) tips = parsed.slice(0, 3);
        }
      } catch { /* fall through to defaults */ }
    }

    if (tips.length === 0) {
      if (avgRating != null && avgRating < 3.5) {
        tips.push("Focus on nailing internal temp — it's the single biggest factor in your ratings.");
      }
      if (planAccuracy != null && planAccuracy < 70) {
        tips.push("Your cooks tend to run over plan — build in a 20% time buffer when serving guests.");
      }
      tips.push("Keep rating every cook. PitMaster gets more accurate and personal with each entry.");
      tips = tips.slice(0, 3);
    }

    const result: HomeInsights = {
      pitMasterScore,
      scoreLabel: getPitMasterLabel(pitMasterScore),
      scoreBreakdown: { avgRating, planAccuracy, aiAssessmentScore, cookCount },
      tips,
      tipsGeneratedAt: new Date().toISOString(),
    };

    homeInsightsCache.set(req.userId, {
      data: result,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute home insights" });
  }
});

export default router;
