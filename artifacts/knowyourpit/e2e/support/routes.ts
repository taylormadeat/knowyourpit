/**
 * Shared Playwright route-stubbing helpers for Plan screen E2E tests.
 *
 * All network calls that would hit real servers (Clerk, the API, etc.) are
 * intercepted here so tests are:
 *   - Fast — no real network round-trips
 *   - Deterministic — no flaky latency or auth state coupling
 *   - Isolated — tests never create real cooks or consume real AI tokens
 */

import type { Page } from "@playwright/test";

/** A minimal valid AI predict response that matches the shape plan.tsx expects. */
export const MOCK_AI_PREDICT_RESPONSE = {
  estimatedDurationMinutes: 480,
  confidence: "high",
  rationale: "8-hour smoke at 225°F is standard for a 10 lb brisket.",
  tips: ["Rest at least 1 hour wrapped in butcher paper."],
  checkins: [],
  factorBreakdown: [],
  grillLightAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  serveAt: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString(),
};

/** A minimal valid cook creation response. */
export const MOCK_COOK_RESPONSE = {
  id: 9999,
  userId: "user_test",
  grillId: null,
  name: "Test Brisket",
  foodType: "Brisket",
  status: "active",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/** A minimal valid grills list response. */
export const MOCK_GRILLS_RESPONSE: unknown[] = [];

/**
 * Stubs all API routes that the Plan screen touches so tests never hit a real
 * server. Call this at the start of each test's `beforeEach`.
 */
export async function stubPlanScreenRoutes(page: Page): Promise<void> {
  // ── Clerk ──────────────────────────────────────────────────────────────────
  // Intercept Clerk's JWKS / well-known endpoints and token checks so the
  // app doesn't boot into an endless auth-loading state during tests.
  await page.route("**/__clerk/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
  await page.route("**/.well-known/**", (route) =>
    route.fulfill({ status: 200, json: { keys: [] } }),
  );
  await page.route("**/v1/client**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        response: {
          sessions: [
            {
              id: "sess_test",
              status: "active",
              user: {
                id: "user_test",
                first_name: "Test",
                last_name: "User",
                email_addresses: [{ email_address: "test@example.com" }],
                username: "testuser",
              },
            },
          ],
          last_active_session_id: "sess_test",
        },
      },
    }),
  );
  await page.route("**/v1/me**", (route) =>
    route.fulfill({
      status: 200,
      json: { id: "user_test", username: "testuser" },
    }),
  );
  await page.route("**/tokens**", (route) =>
    route.fulfill({
      status: 200,
      json: { jwt: "mock.jwt.token" },
    }),
  );

  // ── API Server ─────────────────────────────────────────────────────────────
  // Grills list (empty — no grill selected by default)
  await page.route("**/api/grills**", (route) =>
    route.fulfill({ status: 200, json: MOCK_GRILLS_RESPONSE }),
  );

  // AI predict — returns instantly with a mock plan
  await page.route("**/api/ai/predict**", (route) =>
    route.fulfill({ status: 200, json: MOCK_AI_PREDICT_RESPONSE }),
  );

  // Cook creation — returns a minimal cook object
  await page.route("**/api/cooks", (route) => {
    if (route.request().method() === "POST") {
      return route.fulfill({ status: 201, json: MOCK_COOK_RESPONSE });
    }
    return route.fulfill({ status: 200, json: [] });
  });

  // Paywall usage — unlimited so paywall never blocks the tap
  await page.route("**/api/paywall/usage**", (route) =>
    route.fulfill({
      status: 200,
      json: {
        unlimited: true,
        remaining: { cooks: 999, plannedCooks: 999 },
        usage: { cooks: 0, plannedCooks: 0 },
      },
    }),
  );

  // MEATER readings — no probes connected
  await page.route("**/api/meater**", (route) =>
    route.fulfill({ status: 200, json: { linked: false, probes: [] } }),
  );

  // ThermoWorks credentials — not linked
  await page.route("**/api/thermoworks**", (route) =>
    route.fulfill({ status: 200, json: { linked: false } }),
  );

  // Profile / user techniques / custom meat cuts
  await page.route("**/api/profile**", (route) =>
    route.fulfill({ status: 200, json: { id: "user_test" } }),
  );
  await page.route("**/api/technique-presets**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );
  await page.route("**/api/user-technique-presets**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );

  // Smoker fingerprint / profile stats
  await page.route("**/api/ai/smoker-profile**", (route) =>
    route.fulfill({ status: 200, json: null }),
  );

  // Active cook (none)
  await page.route("**/api/cooks?status=active**", (route) =>
    route.fulfill({ status: 200, json: [] }),
  );

  // Catch-all for any remaining API calls
  await page.route("**/api/**", (route) =>
    route.fulfill({ status: 200, json: {} }),
  );
}
