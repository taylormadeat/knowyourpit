import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/requireAuth";
import {
  FREE_COOK_LIMIT,
  FREE_AI_CHAT_DAILY_LIMIT,
  FREE_AI_ANALYZE_DAILY_LIMIT,
  FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
  countCooksForUser,
  countActiveCooksForUser,
  countPlannedCooksForUser,
  countAiChatMessagesToday,
  countAiAnalyzesToday,
  countFrozenTimelineEventsLifetime,
  recordFrozenTimelineEvent,
  isPaywallEnabled,
  startOfNextUtcDay,
  userBypassesPaywall,
  pollAndRefreshEntitlement,
  respondPaywall,
} from "../lib/paywall";

const router: IRouter = Router();

// GET /api/paywall/usage — returns free-tier counters + kill-switch state.
router.get("/paywall/usage", requireAuth, async (req: any, res): Promise<void> => {
  const [
    cooks,
    activeCooks,
    plannedCooks,
    aiMessagesToday,
    aiAnalyzesToday,
    frozenTimelineLifetime,
  ] = await Promise.all([
    countCooksForUser(req.userId),
    countActiveCooksForUser(req.userId),
    countPlannedCooksForUser(req.userId),
    countAiChatMessagesToday(req.userId),
    countAiAnalyzesToday(req.userId),
    countFrozenTimelineEventsLifetime(req.userId),
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
      frozenTimelineLifetime: FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
    },
    usage: {
      cooks,
      activeCooks,
      plannedCooks,
      aiMessagesToday,
      aiAnalyzesToday,
      frozenTimelineLifetime,
    },
    remaining: {
      cooks: Math.max(0, FREE_COOK_LIMIT - cooks),
      activeCooks: Math.max(0, 1 - activeCooks),
      plannedCooks: Math.max(0, 1 - plannedCooks),
      aiMessagesToday: Math.max(0, FREE_AI_CHAT_DAILY_LIMIT - aiMessagesToday),
      aiAnalyzesToday: Math.max(0, FREE_AI_ANALYZE_DAILY_LIMIT - aiAnalyzesToday),
      frozenTimelineLifetime: Math.max(
        0,
        FREE_FROZEN_TIMELINE_LIFETIME_LIMIT - frozenTimelineLifetime,
      ),
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

// POST /api/paywall/frozen-timeline/consume — gates the frozen-to-table feature
// at 1 use per lifetime for free users. Pro users always pass through (no
// record). Free users at the cap receive 402 with `frozen_timeline_limit_reached`
// so the client can surface the upgrade paywall.
router.post(
  "/paywall/frozen-timeline/consume",
  requireAuth,
  async (req: any, res): Promise<void> => {
    const bypass = await userBypassesPaywall(req);
    if (bypass) {
      res.json({ ok: true, consumed: false, isPro: true });
      return;
    }
    // Atomic record: the DB unique index on user_id guarantees only the FIRST
    // concurrent request inserts a row; all subsequent ones return false. This
    // closes the check-then-insert race that would otherwise let parallel
    // requests both observe used=0 and bypass the lifetime cap.
    const justInserted = await recordFrozenTimelineEvent(req.userId);
    if (!justInserted) {
      respondPaywall(res, {
        code: "frozen_timeline_limit_reached",
        feature: "frozen_timeline",
        message:
          "You've used your free Frozen-to-Table plan. Upgrade to Pro for unlimited frozen cook timelines.",
        limit: FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
        used: FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
      });
      return;
    }
    res.json({
      ok: true,
      consumed: true,
      isPro: false,
      used: FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
      limit: FREE_FROZEN_TIMELINE_LIFETIME_LIMIT,
      remaining: 0,
    });
  },
);

export default router;
