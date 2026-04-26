import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  FREE_COOK_LIMIT,
  FREE_AI_CHAT_DAILY_LIMIT,
  FREE_AI_ANALYZE_DAILY_LIMIT,
  countCooksForUser,
  countAiChatMessagesToday,
  countAiAnalyzesToday,
  isPaywallEnabled,
  startOfNextUtcDay,
  userBypassesPaywall,
} from "../lib/paywall";

const router: IRouter = Router();

/**
 * GET /api/paywall/usage
 *
 * Returns the user's current free-tier usage so the mobile client can show
 * "X of Y left" badges on locked features without computing them itself. Pro
 * subscribers receive `unlimited: true` and the counters are returned for
 * informational display only (e.g. "You've cooked 23 times this week").
 */
router.get("/paywall/usage", requireAuth, async (req: any, res): Promise<void> => {
  const [cooks, aiMessagesToday, aiAnalyzesToday] = await Promise.all([
    countCooksForUser(req.userId),
    countAiChatMessagesToday(req.userId),
    countAiAnalyzesToday(req.userId),
  ]);

  const bypass = userBypassesPaywall(req);
  const resetsAt = startOfNextUtcDay().toISOString();

  res.json({
    paywallEnabled: isPaywallEnabled(),
    isPro: bypass && isPaywallEnabled(),
    unlimited: bypass,
    limits: {
      cooks: FREE_COOK_LIMIT,
      aiChatPerDay: FREE_AI_CHAT_DAILY_LIMIT,
      aiAnalyzePerDay: FREE_AI_ANALYZE_DAILY_LIMIT,
    },
    usage: {
      cooks,
      aiMessagesToday,
      aiAnalyzesToday,
    },
    remaining: {
      cooks: Math.max(0, FREE_COOK_LIMIT - cooks),
      aiMessagesToday: Math.max(0, FREE_AI_CHAT_DAILY_LIMIT - aiMessagesToday),
      aiAnalyzesToday: Math.max(0, FREE_AI_ANALYZE_DAILY_LIMIT - aiAnalyzesToday),
    },
    resetsAt,
  });
});

export default router;
