import { createHmac } from "node:crypto";
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

const { mockDbInsert, mockSendWelcomeEmail } = vi.hoisted(() => {
  const mockInsertValues = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn().mockReturnValue({ values: mockInsertValues });
  return {
    mockDbInsert: { insert: mockInsert, _insertValues: mockInsertValues },
    mockSendWelcomeEmail: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@workspace/db", () => ({
  db: { insert: mockDbInsert.insert },
  webhookEvents: {},
  upsertEntitlementCache: vi.fn(),
  invalidateProCache: vi.fn(),
  subscriptionEntitlements: {},
}));

vi.mock("../lib/email", () => ({
  sendWelcomeEmail: mockSendWelcomeEmail,
}));

import webhookRouter from "../routes/webhooks";

const WEBHOOK_SECRET = "test-secret-abc";

function buildApp() {
  const app = express();
  // Mirror the real app's request-logger middleware so route handlers can
  // safely call `req.log.{info,warn,error}`. Silenced for test output.
  app.use(pinoHttp({ level: "silent" }));
  // Mirror app.ts: raw body capture for Clerk webhook BEFORE global JSON parser.
  app.use("/api/webhooks/clerk", express.raw({ type: "application/json", limit: "1mb" }));
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

  it("returns 200 with skipped=true and skips DB write when event has no app_user_id", async () => {
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

// ---------------------------------------------------------------------------
// POST /api/webhooks/clerk
// ---------------------------------------------------------------------------

// A test Svix webhook secret in the same format Clerk issues (whsec_<base64>).
// Using a fixed short key derived from base64("test-clerk-secret-key-32bytes!!").
const CLERK_WEBHOOK_SECRET = "whsec_dGVzdC1jbGVyay1zZWNyZXQta2V5LTMyYnl0ZXMhIQ==";

/**
 * Generate a valid Svix-signed request using Node's crypto module.
 *
 * Svix signs the concatenation `${msgId}.${timestamp}.${payload}` with
 * HMAC-SHA256 using the base64-decoded secret bytes, then base64-encodes
 * the result and prefixes it with "v1,".
 */
function svixSign(
  secret: string,
  msgId: string,
  timestamp: number,
  payloadStr: string,
): { "svix-id": string; "svix-timestamp": string; "svix-signature": string } {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const toSign = `${msgId}.${timestamp}.${payloadStr}`;
  const sig = createHmac("sha256", secretBytes).update(toSign).digest("base64");
  return {
    "svix-id": msgId,
    "svix-timestamp": String(timestamp),
    "svix-signature": `v1,${sig}`,
  };
}

function makeClerkUserCreatedEvent(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    type: "user.created",
    data: {
      id: "user_test_123",
      first_name: "Smoke",
      last_name: "Pitt",
      primary_email_address_id: "idn_primary",
      email_addresses: [
        { id: "idn_primary", email_address: "smoke@example.com" },
      ],
      ...overrides,
    },
  };
}

/** Sign a payload with the test secret and return Svix headers + JSON body string. */
function signedClerkRequest(
  payload: Record<string, unknown>,
  secret = CLERK_WEBHOOK_SECRET,
  msgId = "msg_test_abc",
): { headers: Record<string, string>; body: string } {
  const bodyStr = JSON.stringify(payload);
  const ts = Math.floor(Date.now() / 1000);
  return {
    headers: svixSign(secret, msgId, ts, bodyStr),
    body: bodyStr,
  };
}

describe("POST /api/webhooks/clerk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CLERK_WEBHOOK_SECRET = CLERK_WEBHOOK_SECRET;
    // Re-establish the DB insert mock implementation after clearAllMocks.
    mockDbInsert.insert.mockReturnValue({ values: mockDbInsert._insertValues });
    mockDbInsert._insertValues.mockResolvedValue([]);
    mockSendWelcomeEmail.mockResolvedValue(undefined);
  });

  it("returns 500 when CLERK_WEBHOOK_SECRET is not set", async () => {
    delete process.env.CLERK_WEBHOOK_SECRET;
    const { headers, body } = signedClerkRequest(makeClerkUserCreatedEvent());

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(500);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when Svix headers are missing", async () => {
    const payload = makeClerkUserCreatedEvent();

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set("Content-Type", "application/json")
      .send(JSON.stringify(payload));

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Missing Svix headers" });
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 400 when Svix signature is invalid", async () => {
    const { headers, body } = signedClerkRequest(
      makeClerkUserCreatedEvent(),
      "whsec_d3JvbmdzZWNyZXQ=", // wrong secret → bad signature
    );

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: "Invalid signature" });
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 200 with skipped=true for non-user.created events without sending email", async () => {
    const payload = { type: "user.updated", data: {} };
    const { headers, body } = signedClerkRequest(payload);

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: true });
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("sends welcome email with first name and email on a valid user.created event", async () => {
    const { headers, body } = signedClerkRequest(makeClerkUserCreatedEvent());

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith({
      toEmail: "smoke@example.com",
      firstName: "Smoke",
    });
  });

  it("falls back to first email address when primary_email_address_id has no match", async () => {
    const { headers, body } = signedClerkRequest(
      makeClerkUserCreatedEvent({ primary_email_address_id: "idn_nonexistent" }),
    );

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: "smoke@example.com" }),
    );
  });

  it("returns 200 with skipped=true and no email on duplicate svix-id (PG 23505)", async () => {
    const dupError = Object.assign(new Error("duplicate key"), { code: "23505" });
    mockDbInsert._insertValues.mockRejectedValue(dupError);
    const { headers, body } = signedClerkRequest(makeClerkUserCreatedEvent());

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, skipped: true });
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 500 when DB insert fails with a non-duplicate error so Clerk retries", async () => {
    const dbError = Object.assign(new Error("connection refused"), { code: "08006" });
    mockDbInsert._insertValues.mockRejectedValue(dbError);
    const { headers, body } = signedClerkRequest(makeClerkUserCreatedEvent());

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(500);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 200 but skips email when user has no email addresses", async () => {
    const { headers, body } = signedClerkRequest(
      makeClerkUserCreatedEvent({ email_addresses: [], primary_email_address_id: undefined }),
    );

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(mockSendWelcomeEmail).not.toHaveBeenCalled();
  });

  it("returns 200 even when sendWelcomeEmail throws (email failure is non-fatal after idempotency commit)", async () => {
    mockSendWelcomeEmail.mockRejectedValue(new Error("Resend API error"));
    const { headers, body } = signedClerkRequest(makeClerkUserCreatedEvent());

    const res = await request(buildApp())
      .post("/api/webhooks/clerk")
      .set(headers)
      .set("Content-Type", "application/json")
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });
});
