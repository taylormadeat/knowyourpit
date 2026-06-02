import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import pinoHttp from "pino-http";
import request from "supertest";

const { mockUpsertEntitlementCache, mockInvalidateProCache } = vi.hoisted(() => {
  return {
    mockUpsertEntitlementCache: vi.fn().mockResolvedValue(undefined),
    mockInvalidateProCache: vi.fn(),
  };
});

vi.mock("../lib/paywall", () => ({
  upsertEntitlementCache: mockUpsertEntitlementCache,
  invalidateProCache: mockInvalidateProCache,
}));

vi.mock("@workspace/db", () => ({
  db: {},
  subscriptionEntitlements: {},
}));

import webhookRouter from "../routes/webhooks";

const WEBHOOK_SECRET = "test-secret-abc";

function buildApp() {
  const app = express();
  app.use(pinoHttp({ level: "silent" }));
  app.use(express.json());
  app.use("/api", webhookRouter);
  return app;
}

interface WebhookEventFields {
  type?: string;
  app_user_id?: string;
  event_timestamp_ms?: number | null;
  expiration_at_ms?: number | null;
  entitlement_ids?: string[];
}

function makePayload(overrides: WebhookEventFields = {}): { event: WebhookEventFields } {
  return {
    event: {
      type: "INITIAL_PURCHASE",
      app_user_id: "user_clerk_abc",
      event_timestamp_ms: Date.now(),
      expiration_at_ms: null,
      entitlement_ids: ["pro"],
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpsertEntitlementCache.mockResolvedValue(undefined);
  process.env.REVENUECAT_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("POST /api/webhooks/revenuecat", () => {
  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(buildApp()).post("/api/webhooks/revenuecat").send(makePayload());

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ error: "Unauthorized" });
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header has the wrong secret", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", "wrong-secret")
      .send(makePayload());

    expect(res.status).toBe(401);
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });

  it("returns 401 when REVENUECAT_WEBHOOK_SECRET env var is not set", async () => {
    delete process.env.REVENUECAT_WEBHOOK_SECRET;
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload());

    expect(res.status).toBe(401);
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });

  it("upserts isPro=true and invalidates cache for an INITIAL_PURCHASE activation event", async () => {
    const eventAtMs = Date.now();
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "INITIAL_PURCHASE", event_timestamp_ms: eventAtMs }));

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(mockUpsertEntitlementCache).toHaveBeenCalledWith(
      "user_clerk_abc",
      true,
      "INITIAL_PURCHASE",
      null,
      eventAtMs,
    );
    expect(mockInvalidateProCache).toHaveBeenCalledWith("user_clerk_abc");
  });

  it("upserts isPro=true for a RENEWAL activation event", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(makePayload({ type: "RENEWAL" }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).toHaveBeenCalledWith(
      "user_clerk_abc",
      true,
      "RENEWAL",
      null,
      expect.any(Number),
    );
  });

  it("upserts isPro=false and invalidates cache for an EXPIRATION revocation event", async () => {
    const eventAtMs = Date.now();
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "EXPIRATION", event_timestamp_ms: eventAtMs }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).toHaveBeenCalledWith(
      "user_clerk_abc",
      false,
      "EXPIRATION",
      null,
      eventAtMs,
    );
    expect(mockInvalidateProCache).toHaveBeenCalledWith("user_clerk_abc");
  });

  it("upserts isPro=false for a PAUSE revocation event", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "PAUSE" }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).toHaveBeenCalledWith(
      "user_clerk_abc",
      false,
      "PAUSE",
      null,
      expect.any(Number),
    );
  });

  it("keeps isPro=true on CANCELLATION and stores the expiry date", async () => {
    const expiresMs = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const eventAtMs = Date.now();
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "CANCELLATION", expiration_at_ms: expiresMs, event_timestamp_ms: eventAtMs }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).toHaveBeenCalledWith(
      "user_clerk_abc",
      true,
      "CANCELLATION",
      new Date(expiresMs),
      eventAtMs,
    );
  });

  it("accepts a Bearer-prefixed Authorization header", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", `Bearer ${WEBHOOK_SECRET}`)
      .send(makePayload({ type: "INITIAL_PURCHASE" }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).toHaveBeenCalled();
  });

  it("returns 200 with skipped=true and skips DB write when event has no app_user_id", { timeout: 15000 }, async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send({ event: { type: "INITIAL_PURCHASE" } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: true });
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });

  it("returns 200 but skips DB write when entitlement_ids excludes 'pro'", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "INITIAL_PURCHASE", entitlement_ids: ["other_entitlement"] }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });

  it("returns 200 for an unknown event type without writing to the DB", async () => {
    const res = await request(buildApp())
      .post("/api/webhooks/revenuecat")
      .set("Authorization", WEBHOOK_SECRET)
      .send(makePayload({ type: "SOME_UNKNOWN_EVENT" }));

    expect(res.status).toBe(200);
    expect(mockUpsertEntitlementCache).not.toHaveBeenCalled();
  });
});
