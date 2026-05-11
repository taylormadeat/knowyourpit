/**
 * Create Auto-Renewable Subscription products in App Store Connect.
 *
 * Creates the "knowyourpit Pro" subscription group and the two subscription
 * products under it if they don't already exist.  Pricing is set via
 * basePlanPrices after creation.
 *
 * Prerequisites (all already in Replit secrets / env):
 *   ASC_API_KEY_P8    — full contents of the .p8 private key file
 *   ASC_API_KEY_ID    — the 10-char key ID (e.g. 3WTDG9D596)
 *   ASC_API_ISSUER_ID — the UUID issuer ID
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/createAscIapProducts.ts
 */

import { createSign } from "crypto";

const KEY_P8 = process.env.ASC_API_KEY_P8!;
const KEY_ID = process.env.ASC_API_KEY_ID!;
const ISSUER_ID = process.env.ASC_API_ISSUER_ID!;
const APP_ID = "6763445064";
const BASE = "https://api.appstoreconnect.apple.com/v1";

// ── JWT ──────────────────────────────────────────────────────────────────────

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

// ── ASC REST helpers ─────────────────────────────────────────────────────────

async function ascGet(path: string): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${makeJwt()}`, Accept: "application/json" },
  });
  return res.json();
}

async function ascPost(path: string, body: object): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${makeJwt()}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ── Subscription group ───────────────────────────────────────────────────────

async function findOrCreateGroup(): Promise<string> {
  // The collection GET on /subscriptionGroups is forbidden — must use the app relationship URL
  const list = await ascGet(`/apps/${APP_ID}/subscriptionGroups?limit=50`);
  const existing = list.data?.find(
    (g: any) =>
      g.attributes?.referenceName === "knowyourpit Pro" ||
      g.attributes?.referenceName?.toLowerCase().includes("knowyourpit"),
  );
  if (existing) {
    console.log(`✓ Subscription group already exists (id=${existing.id}, name="${existing.attributes?.referenceName}")`);
    return existing.id;
  }

  console.log("  Creating subscription group 'knowyourpit Pro'…");
  const result = await ascPost("/subscriptionGroups", {
    data: {
      type: "subscriptionGroups",
      attributes: { referenceName: "knowyourpit Pro" },
      relationships: {
        app: { data: { type: "apps", id: APP_ID } },
      },
    },
  });

  if (result.errors) {
    const msg = JSON.stringify(result.errors);
    if (msg.includes("409") || msg.includes("DUPLICATE") || msg.includes("already")) {
      // Group exists but wasn't in the list — try fetching directly
      console.log("  Group already exists (409) — re-fetching to locate it…");
      const all = await ascGet(`/apps/${APP_ID}/subscriptionGroups?limit=200`);
      const found = all.data?.[0];
      if (found) {
        console.log(`✓ Found existing group (id=${found.id})`);
        return found.id;
      }
    }
    throw new Error(`Failed to create group: ${msg}`);
  }
  console.log(`+ Subscription group created (id=${result.data.id})`);
  return result.data.id;
}

// ── Add group localisation ────────────────────────────────────────────────────

async function ensureGroupLocalisation(groupId: string): Promise<void> {
  const locRes = await ascGet(
    `/subscriptionGroupLocalizations?filter[subscriptionGroup]=${groupId}`,
  );
  const hasEn = locRes.data?.some((l: any) => l.attributes?.locale === "en-US");
  if (hasEn) {
    console.log("  ✓ Group localisation (en-US) already exists");
    return;
  }
  const result = await ascPost("/subscriptionGroupLocalizations", {
    data: {
      type: "subscriptionGroupLocalizations",
      attributes: { locale: "en-US", name: "knowyourpit Pro" },
      relationships: {
        subscriptionGroup: { data: { type: "subscriptionGroups", id: groupId } },
      },
    },
  });
  if (result.errors) {
    console.warn(
      `  ⚠ Could not add group localisation: ${JSON.stringify(result.errors)}`,
    );
  } else {
    console.log("  + Group localisation (en-US) created");
  }
}

// ── Individual subscriptions ─────────────────────────────────────────────────

interface SubSpec {
  productId: string;
  name: string;
  reviewNote: string;
  familySharable: boolean;
  subscriptionPeriod: "ONE_MONTH" | "ONE_YEAR";
  groupLevel: number;
}

const SUBS: SubSpec[] = [
  {
    productId: "com.knowyourpit.pro.monthly",
    name: "knowyourpit Pro — Monthly",
    reviewNote: "Full access to all Pro features, billed monthly.",
    familySharable: false,
    subscriptionPeriod: "ONE_MONTH",
    groupLevel: 2,
  },
  {
    productId: "com.knowyourpit.pro.annual",
    name: "knowyourpit Pro — Annual",
    reviewNote:
      "Full access to all Pro features, billed annually at a discounted rate. Includes a 7-day free trial.",
    familySharable: false,
    subscriptionPeriod: "ONE_YEAR",
    groupLevel: 1,
  },
];

async function findOrCreateSubscription(
  groupId: string,
  spec: SubSpec,
): Promise<string> {
  // List subscriptions via the group relationship URL
  const list = await ascGet(`/subscriptionGroups/${groupId}/subscriptions?limit=50`);
  const existing = list.data?.find(
    (s: any) => s.attributes?.productId === spec.productId,
  );
  if (existing) {
    console.log(`  ✓ Subscription "${spec.productId}" already exists (id=${existing.id})`);
    return existing.id;
  }

  console.log(`  Creating subscription "${spec.productId}"…`);
  const result = await ascPost("/subscriptions", {
    data: {
      type: "subscriptions",
      attributes: {
        productId: spec.productId,
        name: spec.name,
        reviewNote: spec.reviewNote,
        familySharable: spec.familySharable,
        subscriptionPeriod: spec.subscriptionPeriod,
        groupLevel: spec.groupLevel,
      },
      relationships: {
        // ASC v1 uses "group" not "subscriptionGroup"
        group: { data: { type: "subscriptionGroups", id: groupId } },
      },
    },
  });
  if (result.errors) {
    const msg = JSON.stringify(result.errors);
    if (msg.includes("DUPLICATE") || msg.includes("already") || msg.includes("conflict") || msg.includes("409")) {
      console.log(`  ✓ Subscription "${spec.productId}" already exists (conflict)`);
      const all = await ascGet(`/subscriptionGroups/${groupId}/subscriptions?limit=50`);
      const match = all.data?.find((s: any) => s.attributes?.productId === spec.productId);
      if (match) return match.id;
    }
    throw new Error(`Failed to create subscription ${spec.productId}: ${msg}`);
  }
  console.log(`  + Subscription "${spec.productId}" created (id=${result.data.id})`);
  return result.data.id;
}

async function ensureSubLocalisation(subId: string, spec: SubSpec): Promise<void> {
  const locRes = await ascGet(
    `/subscriptionLocalizations?filter[subscription]=${subId}`,
  );
  const hasEn = locRes.data?.some((l: any) => l.attributes?.locale === "en-US");
  if (hasEn) {
    console.log(`    ✓ Localisation (en-US) for "${spec.productId}" already exists`);
    return;
  }
  const result = await ascPost("/subscriptionLocalizations", {
    data: {
      type: "subscriptionLocalizations",
      attributes: {
        locale: "en-US",
        name: spec.name,
        description: spec.reviewNote,
      },
      relationships: {
        subscription: { data: { type: "subscriptions", id: subId } },
      },
    },
  });
  if (result.errors) {
    console.warn(
      `    ⚠ Could not add localisation: ${JSON.stringify(result.errors)}`,
    );
  } else {
    console.log(`    + Localisation (en-US) added`);
  }
}

// ── Prices ───────────────────────────────────────────────────────────────────

/**
 * Get the App Store price point ID for a given USD amount.
 * ASC price points are enumerated; we look for the right one by amount.
 */
async function findPricePointId(
  subId: string,
  usdAmount: number,
): Promise<string | null> {
  const res = await ascGet(
    `/subscriptions/${subId}/pricePoints?filter[territory]=USA&limit=200`,
  );
  const points = res.data ?? [];
  const match = points.find(
    (p: any) =>
      Math.abs(p.attributes?.customerPrice - usdAmount) < 0.01,
  );
  return match?.id ?? null;
}

async function ensurePrice(subId: string, spec: SubSpec): Promise<void> {
  const usd = spec.subscriptionPeriod === "ONE_MONTH" ? 4.99 : 29.99;

  const existingPrices = await ascGet(
    `/subscriptionPrices?filter[subscription]=${subId}`,
  );
  if (existingPrices.data?.length > 0) {
    console.log(`    ✓ Price already set for "${spec.productId}"`);
    return;
  }

  const pricePointId = await findPricePointId(subId, usd);
  if (!pricePointId) {
    console.warn(
      `    ⚠ Could not find $${usd} price point for "${spec.productId}" — set price manually in ASC`,
    );
    return;
  }

  const result = await ascPost("/subscriptionPrices", {
    data: {
      type: "subscriptionPrices",
      attributes: { preserveCurrentPrice: false, recurring: "RECURRING" },
      relationships: {
        subscription: { data: { type: "subscriptions", id: subId } },
        subscriptionPricePoint: {
          data: { type: "subscriptionPricePoints", id: pricePointId },
        },
      },
    },
  });
  if (result.errors) {
    console.warn(`    ⚠ Could not set price: ${JSON.stringify(result.errors)}`);
    console.warn(`    → Set the $${usd} price manually in App Store Connect`);
  } else {
    console.log(`    + Price $${usd} set for "${spec.productId}"`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!KEY_P8 || !KEY_ID || !ISSUER_ID) {
    throw new Error(
      "Missing required env vars: ASC_API_KEY_P8, ASC_API_KEY_ID, ASC_API_ISSUER_ID",
    );
  }

  console.log("App Store Connect — IAP Product Setup");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`App ID: ${APP_ID}`);
  console.log("");

  console.log("── Step 1: Subscription group ──────────────────────────────");
  const groupId = await findOrCreateGroup();
  await ensureGroupLocalisation(groupId);

  console.log("\n── Step 2: Subscriptions ───────────────────────────────────");
  for (const spec of SUBS) {
    console.log(`\n  ${spec.productId}  (${spec.subscriptionPeriod})`);
    const subId = await findOrCreateSubscription(groupId, spec);
    await ensureSubLocalisation(subId, spec);
    await ensurePrice(subId, spec);
  }

  console.log("\n══════════════════════════════════════════════════════════════");
  console.log(" Done!");
  console.log("══════════════════════════════════════════════════════════════");
  console.log("");
  console.log("  Next manual steps in App Store Connect:");
  console.log("  1. Monetization → Subscriptions → 'knowyourpit Pro' group:");
  console.log("     - Verify 'com.knowyourpit.pro.monthly'  is present at $4.99/month");
  console.log("     - Verify 'com.knowyourpit.pro.annual'   is present at $29.99/year");
  console.log("  2. For the annual plan: add a 7-day free trial introductory offer.");
  console.log("  3. Submit both subscriptions for review (or they auto-approve in");
  console.log("     some accounts when the app is already approved).");
  console.log("  4. Return here and run setupProductionPricing.ts again so RevenueCat");
  console.log("     can sync the products from the App Store.");
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
