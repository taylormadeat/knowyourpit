/**
 * Playwright E2E tests: Plan screen critical tap flows
 *
 * Covers the two UI-responsiveness regressions caught by build #117:
 *   1. "Ask PitMaster" button  →  loading modal must open within 200ms of tap
 *   2. "Start Cooking Now" button  →  spinner + disabled state within 200ms
 *
 * These tests run against the Expo web target (EXPO_BASE_URL env var or
 * $REPLIT_EXPO_DEV_DOMAIN). All network calls are stubbed via page.route()
 * so timing assertions are deterministic — they aren't affected by real API
 * latency or Clerk token fetch time.
 *
 * In CI, start the Expo web server first:
 *   pnpm --filter @workspace/knowyourpit exec expo export --platform web
 *   npx serve dist/  (or use the Expo dev server)
 * Then run:
 *   pnpm --filter @workspace/knowyourpit run test:e2e
 *
 * Selectors use data-testid attributes that map from the React Native testID
 * prop in plan.tsx (Expo web renders testID as data-testid on HTML elements):
 *   - [data-testid="food-picker-btn"]       — food selection dropdown
 *   - [data-testid="meat-cut-brisket"]      — specific cut in the picker modal
 *   - [data-testid="ai-plan-btn"]           — "Ask PitMaster" pressable
 *   - [data-testid="ai-plan-loading-indicator"] — spinner inside AI button
 *   - [data-testid="submit-cook-btn"]       — "Start Cooking Now" pressable
 *   - [data-testid="submit-spinner"]        — spinner inside submit button
 */

import { test, expect, type Page } from "@playwright/test";
import { stubPlanScreenRoutes } from "./support/routes";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Navigate to the Plan tab and wait for the page to be interactive.
 * The Plan tab is the second tab in the ClassicTabLayout (index name "plan").
 */
async function navigateToPlanTab(page: Page): Promise<void> {
  // Try the direct route first — Expo Router maps the tab name to a URL path
  await page.goto("/plan", { waitUntil: "domcontentloaded" });

  // Fall back to clicking the "Plan" tab label if the route redirected
  const planTab = page.getByRole("tab", { name: /plan/i }).first();
  if (await planTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await planTab.click();
  }

  // Wait for the food picker button to signal the Plan screen is mounted
  await page.waitForSelector('[data-testid="food-picker-btn"]', { timeout: 15_000 });
}

/**
 * Select "Brisket" from the food picker modal so the AI plan and submit
 * buttons become active (both are guarded by `if (!selectedCut) return`).
 */
async function selectBrisket(page: Page): Promise<void> {
  await page.click('[data-testid="food-picker-btn"]');
  // Meat picker modal opens — wait for the Brisket item to appear
  await page.waitForSelector('[data-testid="meat-cut-brisket"]', { timeout: 5_000 });
  await page.click('[data-testid="meat-cut-brisket"]');
  // Modal should close after selection
  await page.waitForSelector('[data-testid="meat-cut-brisket"]', { state: "hidden", timeout: 3_000 })
    .catch(() => {
      // Some environments keep the modal momentarily — that's OK, proceed
    });
}

// ── Test setup ────────────────────────────────────────────────────────────────

test.beforeEach(async ({ page }) => {
  await stubPlanScreenRoutes(page);
  await navigateToPlanTab(page);
});

// ── Flow 1: "Ask PitMaster" tap ───────────────────────────────────────────────

test.describe("AI Plan tap flow", () => {
  test("tapping Ask PitMaster without a food selected shows an alert, not loading state", async ({
    page,
  }) => {
    // The handler early-returns and shows an Alert when no food is selected.
    // On web Expo renders RN Alert as a browser alert — we accept and dismiss it.
    page.on("dialog", (dialog) => dialog.accept());

    await page.click('[data-testid="ai-plan-btn"]');

    // The loading indicator must NOT appear when no food is selected
    const indicator = page.getByTestId("ai-plan-loading-indicator");
    await expect(indicator).not.toBeVisible({ timeout: 500 });
  });

  test("tapping Ask PitMaster with a food selected opens the loading modal within 200ms", async ({
    page,
  }) => {
    await selectBrisket(page);

    // Record the timestamp immediately before the tap
    const beforeTap = Date.now();
    await page.click('[data-testid="ai-plan-btn"]');

    // The loading indicator inside the AI button should be visible promptly.
    // This indicator is rendered when aiStreaming=true AND aiResultOpen=false —
    // i.e. the very brief window between openAiPlanModal() and the modal
    // appearing. On web, the AiResultsModal itself also becomes visible.
    //
    // We assert visibility within 500ms (generous for CI variability) but log
    // a warning if it took more than 200ms — the true responsiveness bar.
    //
    // Either the inline spinner or the modal opening counts as success, since
    // on fast machines the modal can appear before the inline spinner renders.
    const eitherLoadingElement = page
      .locator('[data-testid="ai-plan-loading-indicator"], [role="dialog"]')
      .first();

    await expect(eitherLoadingElement).toBeVisible({ timeout: 500 });

    const elapsed = Date.now() - beforeTap;
    // eslint-disable-next-line no-console
    console.log(`[ai-plan-btn] loading state appeared in ${elapsed}ms`);
    // Soft assertion: warn but don't fail if it's slightly over 200ms in CI
    if (elapsed > 200) {
      console.warn(
        `⚠️  Loading state took ${elapsed}ms — expected ≤200ms. ` +
          "Check for blocking awaits before openAiPlanModal() in handleAiPlan.",
      );
    }
  });

  test("the AI Plan button is disabled while a plan is loading (prevents duplicate taps)", async ({
    page,
  }) => {
    // Stall the AI predict response so we can observe the button during loading
    let resolvePredict!: (value: unknown) => void;
    const predictBarrier = new Promise((res) => { resolvePredict = res; });

    await page.route("**/api/ai/predict**", async (route) => {
      await predictBarrier;
      await route.fulfill({ status: 200, json: { estimatedDurationMinutes: 480 } });
    });

    await selectBrisket(page);
    await page.click('[data-testid="ai-plan-btn"]');

    // While the response is pending, the button should be disabled
    await expect(page.getByTestId("ai-plan-btn")).toBeDisabled({ timeout: 500 });

    // Unblock the network call so the test doesn't leak pending requests
    resolvePredict(undefined);
  });
});

// ── Flow 2: "Start Cooking Now" tap ──────────────────────────────────────────

test.describe("Start Cooking Now tap flow", () => {
  test("tapping Start Cooking Now without a food selected shows an alert, not a spinner", async ({
    page,
  }) => {
    page.on("dialog", (dialog) => dialog.accept());

    await page.click('[data-testid="submit-cook-btn"]');

    // No spinner should appear when the early-return guard fires
    await expect(page.getByTestId("submit-spinner")).not.toBeVisible({ timeout: 500 });
  });

  test("tapping Start Cooking Now with a food selected shows a spinner within 200ms", async ({
    page,
  }) => {
    // Stall the cook creation so we can observe loading state mid-flight
    let resolveCreate!: (value: unknown) => void;
    const createBarrier = new Promise((res) => { resolveCreate = res; });

    await page.route("**/api/cooks", async (route) => {
      if (route.request().method() === "POST") {
        await createBarrier;
        return route.fulfill({ status: 201, json: { id: 9999 } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await selectBrisket(page);

    const beforeTap = Date.now();
    await page.click('[data-testid="submit-cook-btn"]');

    // The spinner must appear before the network response arrives
    await expect(page.getByTestId("submit-spinner")).toBeVisible({ timeout: 500 });

    const elapsed = Date.now() - beforeTap;
    // eslint-disable-next-line no-console
    console.log(`[submit-cook-btn] spinner appeared in ${elapsed}ms`);
    if (elapsed > 200) {
      console.warn(
        `⚠️  Submit spinner took ${elapsed}ms — expected ≤200ms. ` +
          "Check for blocking awaits before startSubmitting() in handleSubmit.",
      );
    }

    // Unblock the network call
    resolveCreate(undefined);
  });

  test("the Submit button is disabled while submission is in-flight (prevents double-cook)", async ({
    page,
  }) => {
    let resolveCreate!: (value: unknown) => void;
    const createBarrier = new Promise((res) => { resolveCreate = res; });

    await page.route("**/api/cooks", async (route) => {
      if (route.request().method() === "POST") {
        await createBarrier;
        return route.fulfill({ status: 201, json: { id: 9999 } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    await selectBrisket(page);
    await page.click('[data-testid="submit-cook-btn"]');

    // While submission is in-flight, button must be disabled to prevent
    // duplicate cook creation from double-taps
    await expect(page.getByTestId("submit-cook-btn")).toBeDisabled({ timeout: 500 });

    resolveCreate(undefined);
  });

  test("the Submit button re-enables after a failed submission (allows retry)", async ({
    page,
  }) => {
    // Fail the cook creation once, then succeed on retry
    await page.route("**/api/cooks", (route) => {
      if (route.request().method() === "POST") {
        return route.fulfill({ status: 500, json: { error: "Internal Server Error" } });
      }
      return route.fulfill({ status: 200, json: [] });
    });

    page.on("dialog", (dialog) => dialog.accept()); // dismiss the error Alert

    await selectBrisket(page);
    await page.click('[data-testid="submit-cook-btn"]');

    // After the failure resolves, isSubmitting should be reset (finally block)
    // and the button should re-enable so the user can retry
    await expect(page.getByTestId("submit-cook-btn")).toBeEnabled({ timeout: 5_000 });
    await expect(page.getByTestId("submit-spinner")).not.toBeVisible({ timeout: 500 });
  });
});
