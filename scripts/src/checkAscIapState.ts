/**
 * Check the current state of knowyourpit's IAP subscriptions in App Store Connect.
 *
 * Prints a summary and exits with code 1 if any subscription is NOT in a
 * StoreKit-serviceable state (READY_TO_SUBMIT, WAITING_FOR_REVIEW, or APPROVED).
 *
 * Background:
 *   Subscriptions in MISSING_METADATA are NOT served by StoreKit — not even in
 *   the TestFlight sandbox — which causes RevenueCat to fail with:
 *   "None of the products registered in the RevenueCat dashboard could be
 *   fetched from App Store Connect."
 *
 *   READY_TO_SUBMIT is the minimum state required for sandbox/TestFlight.
 *   Both subscriptions reached READY_TO_SUBMIT on 2026-05-11 after uploading
 *   review screenshots via ensureReviewScreenshot() in createAscIapProducts.ts.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run checkAscIapState
 */

import { createSign } from "crypto";

const KEY_P8 = process.env.ASC_API_KEY_P8!;
const KEY_ID = process.env.ASC_API_KEY_ID!;
const ISSUER_ID = process.env.ASC_API_ISSUER_ID!;
const BASE = "https://api.appstoreconnect.apple.com/v1";

const SUBSCRIPTION_IDS = [
  { id: "6764194128", productId: "com.knowyourpit.pro.annual" },
  { id: "6764196256", productId: "com.knowyourpit.pro.monthly" },
] as const;

const SERVICEABLE_STATES = new Set([
  "READY_TO_SUBMIT",
  "WAITING_FOR_REVIEW",
  "APPROVED",
]);

function normalisePem(raw: string): string {
  const content = raw.replace(/\\n/g, "\n");
  const match = content.match(
    /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/,
  );
  if (!match) throw new Error("ASC_API_KEY_P8 is not a valid PEM private key");
  const b64 = match[1].replace(/\s+/g, "");
  const chunks = b64.match(/.{1,64}/g)!.join("\n");
  return `-----BEGIN PRIVATE KEY-----\n${chunks}\n-----END PRIVATE KEY-----\n`;
}

function b64url(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf) : buf;
  return b.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }),
  );
  const signing = `${header}.${payload}`;
  const sign = createSign("SHA256");
  sign.update(signing);
  const sig = sign.sign({ key: normalisePem(KEY_P8), dsaEncoding: "ieee-p1363" });
  return `${signing}.${b64url(sig)}`;
}

async function ascGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${makeJwt()}`, Accept: "application/json" },
  });
  return res.json();
}

async function main() {
  if (!KEY_P8 || !KEY_ID || !ISSUER_ID) {
    throw new Error(
      "Missing required env vars: ASC_API_KEY_P8, ASC_API_KEY_ID, ASC_API_ISSUER_ID",
    );
  }

  console.log("App Store Connect — IAP State Check");
  console.log("══════════════════════════════════════════════════════════════");

  let allServiceable = true;

  for (const sub of SUBSCRIPTION_IDS) {
    const detail = await ascGet(`/subscriptions/${sub.id}`);
    const state = (detail.data?.attributes?.state as string) ?? "UNKNOWN";
    const serviceable = SERVICEABLE_STATES.has(state);
    if (!serviceable) allServiceable = false;

    const screenshotRes = await ascGet(`/subscriptions/${sub.id}/appStoreReviewScreenshot`);
    const screenshotState =
      (screenshotRes.data?.attributes?.assetDeliveryState?.state as string) ?? "NONE";

    const icon = serviceable ? "✓" : "✗";
    console.log(`  ${icon} ${sub.productId}`);
    console.log(`      ASC id:             ${sub.id}`);
    console.log(`      state:              ${state}${serviceable ? " (StoreKit-serviceable)" : " (NOT serviceable — StoreKit cannot serve this product)"}`);
    console.log(`      review screenshot:  ${screenshotState}`);
    console.log("");
  }

  console.log("══════════════════════════════════════════════════════════════");

  if (allServiceable) {
    console.log("✓ All subscriptions are in a StoreKit-serviceable state.");
    console.log("  The paywall should load correctly in TestFlight.");
  } else {
    console.log("✗ One or more subscriptions are NOT serviceable.");
    console.log("  Run createAscIapProducts.ts to fix (uploads review screenshot).");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
