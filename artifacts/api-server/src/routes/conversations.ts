import { Router, type IRouter } from "express";
import { eq, and, asc, desc } from "drizzle-orm";
import { db, conversations, messages, cooksTable, grillsTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { requireAuth } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function buildUserCookHistory(userId: string): Promise<string> {
  const cooks = await db.select().from(cooksTable)
    .where(eq(cooksTable.userId, userId))
    .orderBy(desc(cooksTable.createdAt))
    .limit(50);

  if (cooks.length === 0) return "This user has no cook logs yet.";

  const grillIds = [...new Set(cooks.map(c => c.grillId).filter(Boolean))] as number[];
  const grills: Record<number, string> = {};
  for (const id of grillIds) {
    const [g] = await db.select({ id: grillsTable.id, name: grillsTable.name }).from(grillsTable).where(eq(grillsTable.id, id));
    if (g) grills[g.id] = g.name;
  }

  const lines = cooks.map(c => {
    const parts: string[] = [c.foodType];
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
    if (c.ratingBark) parts.push(`bark ${c.ratingBark}/5`);
    if (c.ratingFlavor) parts.push(`flavor ${c.ratingFlavor}/5`);
    if (c.wrapMethod && c.wrapMethod !== "none") parts.push(`wrapped: ${c.wrapMethod}`);
    if (c.notes) parts.push(`notes: "${c.notes}"`);
    const date = c.actualStartAt ? new Date(c.actualStartAt).toLocaleDateString() : (c.createdAt ? new Date(c.createdAt).toLocaleDateString() : null);
    if (date) parts.push(`date: ${date}`);
    return `- ${parts.join(" · ")}`;
  });

  const total = cooks.length;
  const completed = cooks.filter(c => c.status === "completed").length;
  const rated = cooks.filter(c => c.rating != null);
  const avgRating = rated.length > 0 ? (rated.reduce((s, c) => s + c.rating!, 0) / rated.length).toFixed(1) : null;

  return [
    `User's cook history (${total} total, ${completed} completed${avgRating ? `, avg rating ${avgRating}/5` : ""}):`,
    ...lines,
  ].join("\n");
}

// GET /ai/conversations — list all conversations for this user
router.get("/ai/conversations", requireAuth, async (req: any, res): Promise<void> => {
  const convos = await db.select().from(conversations)
    .where(eq(conversations.userId, req.userId))
    .orderBy(desc(conversations.updatedAt));
  res.json(convos);
});

// POST /ai/conversations — create a new conversation
router.post("/ai/conversations", requireAuth, async (req: any, res): Promise<void> => {
  const title = typeof req.body?.title === "string" && req.body.title.trim()
    ? req.body.title.trim()
    : "New Chat";
  const [convo] = await db.insert(conversations).values({ userId: req.userId, title }).returning();
  res.status(201).json(convo);
});

// DELETE /ai/conversations/:id — delete a conversation (messages cascade)
router.delete("/ai/conversations/:id", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [deleted] = await db.delete(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Conversation not found" }); return; }
  res.sendStatus(204);
});

// GET /ai/conversations/:id/messages — get all messages for a conversation
router.get("/ai/conversations/:id/messages", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)));
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }
  const msgs = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt));
  res.json(msgs);
});

// POST /ai/conversations/:id/chat — send a message, get AI reply, persist both
router.post("/ai/conversations/:id/chat", requireAuth, async (req: any, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "");
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const userMessage = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!userMessage) { res.status(400).json({ error: "message is required" }); return; }

  const [convo] = await db.select().from(conversations)
    .where(and(eq(conversations.id, id), eq(conversations.userId, req.userId)));
  if (!convo) { res.status(404).json({ error: "Conversation not found" }); return; }

  // Load history (last 40 messages for context window)
  const history = await db.select().from(messages)
    .where(eq(messages.conversationId, id))
    .orderBy(asc(messages.createdAt))
    .limit(40);

  // Save the user's message immediately
  await db.insert(messages).values({ conversationId: id, role: "user", content: userMessage });

  // Build cook history context
  const cookHistory = await buildUserCookHistory(req.userId);

  const systemPrompt = `You are KnowYourPit AI, an expert BBQ assistant and personal pit coach. You help users with BBQ cooking, grilling techniques, temperature guidance, timing predictions, and recipe suggestions. You are knowledgeable about all BBQ styles including Texas BBQ, Carolina BBQ, Kansas City style, and more. Provide practical, specific, personalized advice.

You have full access to this user's personal cook logs. Use this data to give personalized answers and reference their actual cooks by food type, date, and grill when relevant.

${cookHistory}`;

  const aiMessages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: systemPrompt },
    ...history.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userMessage },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_completion_tokens: 1024,
    messages: aiMessages,
  });

  const reply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't process that request.";

  // Save assistant reply
  const [savedReply] = await db.insert(messages).values({ conversationId: id, role: "assistant", content: reply }).returning();

  // Auto-title: set the title from the first user message if still "New Chat"
  if (convo.title === "New Chat") {
    const autoTitle = userMessage.length > 50 ? userMessage.slice(0, 47) + "…" : userMessage;
    await db.update(conversations).set({ title: autoTitle, updatedAt: new Date() }).where(eq(conversations.id, id));
  } else {
    await db.update(conversations).set({ updatedAt: new Date() }).where(eq(conversations.id, id));
  }

  res.json({ reply, messageId: savedReply.id });
});

export default router;
