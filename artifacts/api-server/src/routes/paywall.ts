import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  FREE_COOK_LIMIT,
  FREE_AI_CHAT_DAILY_LIMIT,
  FREE_AI_ANALYZE_DAILY_LIMIT,
  countCooksForUser,
  countActiveCooksForUser,
  countPlannedCooksForUser,
  countGradedCooksForUser,
  countAiChatMessagesToday,
  countAiAnalyzesToday,
  isPaywallEnabled,
  startOfNextUtcDay,
  userBypassesPaywall,
  pollAndRefreshEntitlement,
} from "../lib/paywall";

const router: IRouter = Router();

// GET /api/paywall/usage — returns free-tier counters + kill-switch state.
router.get("/paywall/usage", requireAuth, async (req: any, res): Promise<void> => {
  const [cooks, activeCooks, plannedCooks, gradedCooks, aiMessagesToday, aiAnalyzesToday] = await Promise.all([
    countCooksForUser(req.userId),
    countActiveCooksForUser(req.userId),
    countPlannedCooksForUser(req.userId),
    countGradedCooksForUser(req.userId),
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
      activeCooks,
      plannedCooks,
      gradedCooks,
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

// POST /api/paywall/refresh — forces a live RevenueCat API poll for this user,
// updates the Postgres entitlement cache, and invalidates the in-process
// mem cache. The mobile client calls this right after a successful purchase or
// restore so the unlock is immediate without waiting for a webhook delivery.
router.post("/paywall/refresh", requireAuth, async (req: any, res): Promise<void> => {
  const isPro = await pollAndRefreshEntitlement(req.userId);
  res.json({ ok: true, isPro });
});

export default router;
