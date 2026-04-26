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
  invalidateProCache,
} from "../lib/paywall";

const router: IRouter = Router();

// GET /api/paywall/usage — returns free-tier counters + kill-switch state.
// Documented deviation from spec's GET /ai/analyze-usage: broadened to
// three counters (cooks lifetime, AI chats/day, AI analyzes/day) so the
// client makes one round-trip per screen render instead of three.
router.get("/paywall/usage", requireAuth, async (req: any, res): Promise<void> => {
  const [cooks, aiMessagesToday, aiAnalyzesToday] = await Promise.all([
    countCooksForUser(req.userId),
    countAiChatMessagesToday(req.userId),
    countAiAnalyzesToday(req.userId),
  ]);

  const bypass = await userBypassesPaywall(req);
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

// POST /api/paywall/refresh — invalidate the cached Pro entitlement for this
// user. The mobile client calls this right after a successful purchase or
// restore so the next gated request hits RevenueCat fresh instead of seeing
// a stale negative cache entry from the user's free-tier era.
router.post("/paywall/refresh", requireAuth, async (req: any, res): Promise<void> => {
  invalidateProCache(req.userId);
  res.json({ ok: true });
});

export default router;
