import { Router, type IRouter } from "express";
import { eq, and, desc, asc } from "drizzle-orm";
import { z } from "zod";
import { db, conversations, messages } from "@workspace/db";
import { AiChatBody } from "@workspace/api-zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../../middlewares/requireAuth";
import {
  checkAiChatDailyLimit,
  isPaywallEnabled,
  respondPaywall,
  countAiChatMessagesToday,
  startOfNextUtcDay,
  userBypassesPaywall,
  FREE_AI_CHAT_DAILY_LIMIT,
  PRO_AI_CHAT_DAILY_LIMIT,
} from "../../lib/paywall";
import { aiRateLimit, buildChatSystemPrompt, pickChatSuggestions } from "./shared";

const router: IRouter = Router();

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

const AiChatBodyWithSession = AiChatBody.extend({
  sessionId: z.number().int().optional(),
});

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

router.post("/ai/chat", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiChatBodyWithSession.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context, sessionId: requestedSessionId } = parsed.data;

  const bypasses = await userBypassesPaywall(req);
  const isPro = bypasses && isPaywallEnabled();
  const usedBeforeThisMessage = await countAiChatMessagesToday(req.userId);
  const limitPaywall = checkAiChatDailyLimit(
    /* isPro        */ isPro,
    /* paywallEnabled */ isPaywallEnabled(),
    /* used         */ usedBeforeThisMessage,
    /* resetsAt     */ startOfNextUtcDay().toISOString(),
  );
  if (limitPaywall) {
    respondPaywall(res, limitPaywall);
    return;
  }
  // Only include remaining when the paywall is actually enforced — when the
  // kill-switch is off every request passes regardless of count, so emitting a
  // "remaining" value would mislead the UI into showing a counter that has no
  // real effect. When enabled, use the tier-correct cap.
  const remainingAfterThisMessage = isPaywallEnabled()
    ? Math.max(0, (isPro ? PRO_AI_CHAT_DAILY_LIMIT : FREE_AI_CHAT_DAILY_LIMIT) - (usedBeforeThisMessage + 1))
    : null;

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

  res.json({
    reply,
    suggestions,
    sessionId: resolvedSessionId,
    remaining: remainingAfterThisMessage,
    ...(generatedTitle ? { title: generatedTitle } : {}),
  });
});

router.post("/ai/chat/stream", requireAuth, aiRateLimit, async (req: any, res): Promise<void> => {
  const parsed = AiChatBodyWithSession.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { message, context, sessionId: requestedSessionId } = parsed.data;

  const bypasses = await userBypassesPaywall(req);
  const streamIsPro = bypasses && isPaywallEnabled();
  const streamUsedBefore = await countAiChatMessagesToday(req.userId);
  const limitPaywall = checkAiChatDailyLimit(
    /* isPro        */ streamIsPro,
    /* paywallEnabled */ isPaywallEnabled(),
    /* used         */ streamUsedBefore,
    /* resetsAt     */ startOfNextUtcDay().toISOString(),
  );
  if (limitPaywall) {
    respondPaywall(res, limitPaywall);
    return;
  }
  // Omit remaining when kill-switch is off — no cap is enforced so the value
  // would mislead the UI into showing a counter that has no real effect.
  const streamRemainingAfter = isPaywallEnabled()
    ? Math.max(0, (streamIsPro ? PRO_AI_CHAT_DAILY_LIMIT : FREE_AI_CHAT_DAILY_LIMIT) - (streamUsedBefore + 1))
    : null;

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
    const sessionResult = await ensureSession(req.userId, message, requestedSessionId);
    resolvedSessionId = sessionResult.id;
    isNewSession = sessionResult.isNew;
    await db.insert(messages).values({
      conversationId: resolvedSessionId,
      role: "user",
      content: message,
    });
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
      await db.insert(messages).values({
        conversationId: resolvedSessionId,
        role: "assistant",
        content: fullReply,
      });

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
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, resolvedSessionId));
      }

      const doneEvent: Record<string, unknown> = {
        type: "done",
        suggestions: pickChatSuggestions(),
        remaining: streamRemainingAfter,
      };
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

export default router;
