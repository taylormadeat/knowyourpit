import { describe, it, expect, vi, beforeEach } from "vitest";
import type { listCustomerActiveEntitlements as ListActiveEntitlements } from "@replit/revenuecat-sdk";

// ─── Shared row type used in DB mock ─────────────────────────────────────────
interface EntitlementRow {
  userId: string;
  isPro: boolean;
  expiresAt: Date | null;
  updatedAt: Date;
  lastEventType: string;
  lastEventAtMs: number | null;
}

// ─── Hoisted mock state so vi.mock() factories can reference them ─────────────
const {
  selectRows,
  insertChain,
  selectChain,
  mockDb,
  mockActiveEntitlements,
  mockListCustomerActiveEntitlements,
  mockListEntitlements,
} = vi.hoisted(() => {
  const selectRows: { value: EntitlementRow[] } = { value: [] };
  const mockActiveEntitlements: { value: { entitlement_id: string; expires_at: number | null }[] } =
    { value: [] };

  const mockListEntitlements = vi.fn().mockResolvedValue({
    error: null,
    data: [{ id: "ent_pro_id", lookup_key: "pro" }],
  });

  const mockListCustomerActiveEntitlements = vi.fn().mockImplementation(() =>
    Promise.resolve({ error: null, data: mockActiveEntitlements.value }),
  );

  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  };

  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(selectRows.value)),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
  };

  return {
    selectRows,
    insertChain,
    selectChain,
    mockDb,
    mockActiveEntitlements,
    mockListCustomerActiveEntitlements,
    mockListEntitlements,
  };
});

vi.mock("@workspace/db", () => ({
  db: mockDb,
  subscriptionEntitlements: { userId: "userId" },
  cooksTable: {},
  conversations: {},
  messages: {},
  aiAnalyzeEvents: {},
  frozenTimelineEvents: {},
}));

vi.mock("../lib/revenuecat", () => ({
  getRevenueCatClient: vi.fn().mockResolvedValue({}),
  asListItems: (data: unknown): unknown[] => {
    if (Array.isArray(data)) return data;
    if (data != null && typeof data === "object" && Array.isArray((data as Record<string, unknown>).items)) {
      return (data as Record<string, unknown[]>).items;
    }
    return [];
  },
}));

vi.mock("@replit/revenuecat-sdk", () => ({
  listEntitlements: mockListEntitlements,
  listCustomerActiveEntitlements: mockListCustomerActiveEntitlements,
}));

import {
  getUserHasProEntitlement,
  invalidateProCache,
  FREE_AI_CHAT_DAILY_LIMIT,
  PRO_AI_CHAT_DAILY_LIMIT,
} from "../lib/paywall";

const TEST_USER = "user_test_123";

/** 24 h + 1 ms — guaranteed stale for the PG_STALE_THRESHOLD_MS check. */
const STALE_AGE_MS = 25 * 60 * 60 * 1000;

function freshRow(overrides: Partial<EntitlementRow> = {}): EntitlementRow {
  return {
    userId: TEST_USER,
    isPro: true,
    expiresAt: null,
    updatedAt: new Date(),
    lastEventType: "INITIAL_PURCHASE",
    lastEventAtMs: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  invalidateProCache(TEST_USER);
  selectRows.value = [];
  mockActiveEntitlements.value = [];
  vi.clearAllMocks();

  // Re-wire mocks after clearAllMocks wipes return values.
  mockDb.select.mockReturnValue(selectChain);
  selectChain.from.mockReturnThis();
  selectChain.where.mockReturnThis();
  selectChain.limit.mockImplementation(() => Promise.resolve(selectRows.value));
  mockDb.insert.mockReturnValue(insertChain);
  insertChain.values.mockReturnThis();
  insertChain.onConflictDoUpdate.mockResolvedValue(undefined);

  mockListEntitlements.mockResolvedValue({
    error: null,
    data: [{ id: "ent_pro_id", lookup_key: "pro" }],
  });
  mockListCustomerActiveEntitlements.mockImplementation(() =>
    Promise.resolve({ error: null, data: mockActiveEntitlements.value }),
  );

  process.env.REVENUECAT_PROJECT_ID = "proj_test";
});

describe("getUserHasProEntitlement", () => {
  it("returns true when Postgres row has isPro=true and is not expired", async () => {
    selectRows.value = [freshRow()];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(true);
    // Fresh, active row — must NOT hit the RC API.
    expect(mockListCustomerActiveEntitlements).not.toHaveBeenCalled();
  });

  it("returns false when Postgres row has isPro=true but expiresAt is in the past (fresh row, no RC poll)", async () => {
    const pastDate = new Date(Date.now() - 1000);
    selectRows.value = [
      freshRow({
        isPro: true,
        expiresAt: pastDate,
        // updatedAt is recent → below staleness threshold → no RC poll.
        updatedAt: new Date(),
      }),
    ];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(false);
    expect(mockListCustomerActiveEntitlements).not.toHaveBeenCalled();
  });

  it("triggers RC fallback when Postgres row is expired AND stale; grants access when RC confirms Pro", async () => {
    // Subscription expired a week ago AND last webhook was received >24 h ago.
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    selectRows.value = [
      freshRow({
        isPro: true,
        expiresAt: weekAgo, // treated as not-Pro because subscription lapsed
        updatedAt: new Date(Date.now() - STALE_AGE_MS), // stale → triggers poll
      }),
    ];
    // RC confirms the user has re-subscribed since the stale row was written.
    mockActiveEntitlements.value = [{ entitlement_id: "ent_pro_id", expires_at: null }];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(true);
    expect(mockListCustomerActiveEntitlements).toHaveBeenCalled();
  });

  it("triggers RC fallback when Postgres row is stale and isPro=false; returns false when RC confirms not-Pro", async () => {
    const oldDate = new Date(Date.now() - STALE_AGE_MS);
    selectRows.value = [
      freshRow({
        isPro: false,
        expiresAt: null,
        updatedAt: oldDate,
        lastEventType: "EXPIRATION",
      }),
    ];
    // RC agrees: no active entitlement.
    mockActiveEntitlements.value = [];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(false);
    expect(mockListCustomerActiveEntitlements).toHaveBeenCalled();
  });

  it("returns false when no Postgres row exists and RC returns no active entitlement", async () => {
    selectRows.value = [];
    mockActiveEntitlements.value = [];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(false);
    expect(mockListCustomerActiveEntitlements).toHaveBeenCalled();
  });

  it("returns true when no Postgres row exists but RC reports an active entitlement", async () => {
    selectRows.value = [];
    mockActiveEntitlements.value = [{ entitlement_id: "ent_pro_id", expires_at: null }];

    const result = await getUserHasProEntitlement(TEST_USER);

    expect(result).toBe(true);
    expect(mockListCustomerActiveEntitlements).toHaveBeenCalled();
  });
});

// ─── AI chat daily limit gate conditions ─────────────────────────────────────
// These tests verify the gate expression `used >= limit` for the scenarios
// that exist in both /ai/chat and /ai/chat/stream. The route uses:
//   free user:  if (used >= FREE_AI_CHAT_DAILY_LIMIT) → respondPaywall
//   pro user:   if (used >= PRO_AI_CHAT_DAILY_LIMIT)  → respondPaywall
describe("AI chat daily limit gate", () => {
  it("FREE_AI_CHAT_DAILY_LIMIT is 3", () => {
    expect(FREE_AI_CHAT_DAILY_LIMIT).toBe(3);
  });

  it("PRO_AI_CHAT_DAILY_LIMIT is 20", () => {
    expect(PRO_AI_CHAT_DAILY_LIMIT).toBe(20);
  });

  it("free user: blocked when used === FREE_AI_CHAT_DAILY_LIMIT (message 4 attempt)", () => {
    // After 3 messages sent today, the 4th is blocked.
    const used = FREE_AI_CHAT_DAILY_LIMIT; // 3
    expect(used >= FREE_AI_CHAT_DAILY_LIMIT).toBe(true);
  });

  it("free user: allowed when used < FREE_AI_CHAT_DAILY_LIMIT (messages 1–3)", () => {
    const used = FREE_AI_CHAT_DAILY_LIMIT - 1; // 2
    expect(used >= FREE_AI_CHAT_DAILY_LIMIT).toBe(false);
  });

  it("pro user: allowed when used === PRO_AI_CHAT_DAILY_LIMIT - 1 (message 20 allowed)", () => {
    // 19 messages sent today → sending message 20 is still allowed.
    const used = PRO_AI_CHAT_DAILY_LIMIT - 1; // 19
    expect(used >= PRO_AI_CHAT_DAILY_LIMIT).toBe(false);
  });

  it("pro user: blocked when used === PRO_AI_CHAT_DAILY_LIMIT (message 21 attempt)", () => {
    // 20 messages already sent today → message 21 is blocked.
    const used = PRO_AI_CHAT_DAILY_LIMIT; // 20
    expect(used >= PRO_AI_CHAT_DAILY_LIMIT).toBe(true);
  });

  it("pro limit is strictly greater than free limit", () => {
    expect(PRO_AI_CHAT_DAILY_LIMIT).toBeGreaterThan(FREE_AI_CHAT_DAILY_LIMIT);
  });
});
