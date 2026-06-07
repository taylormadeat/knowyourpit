import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "fs";

/**
 * Playwright configuration for Plan screen E2E tests against the Expo web target.
 *
 * The Expo dev server runs at $REPLIT_EXPO_DEV_DOMAIN (set in the workflow).
 * In CI, set EXPO_BASE_URL to point at the running Expo web server.
 *
 * Run:  pnpm --filter @workspace/knowyourpit run test:e2e
 */
const expoBaseUrl =
  process.env.EXPO_BASE_URL ??
  (process.env.REPLIT_EXPO_DEV_DOMAIN
    ? `https://${process.env.REPLIT_EXPO_DEV_DOMAIN}`
    : "http://localhost:8081");

/**
 * Prefer the nix-installed system Chromium when available (NixOS / Replit dev).
 * Playwright's downloaded headless-shell binary requires glibc at FHS paths which
 * NixOS doesn't provide; the nix-built wrapper handles library paths correctly.
 * In standard CI the env var PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH or the
 * downloaded binary takes precedence instead.
 */
const NIX_CHROMIUM =
  "/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium";

const systemChromium: string | undefined =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync(NIX_CHROMIUM) ? NIX_CHROMIUM : undefined);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  expect: {
    /** Max time for an assertion to resolve — kept tight so timing tests fail fast. */
    timeout: 5_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [
    ["list"],
    ...(process.env.CI ? [["github"] as [string]] : []),
  ],
  use: {
    baseURL: expoBaseUrl,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "on-first-retry",
    /** Expo web renders the app inside a narrow viewport — use a mobile-like width. */
    viewport: { width: 390, height: 844 },
    ...(systemChromium ? { executablePath: systemChromium } : {}),
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
