/**
 * Configure production pricing tiers for knowyourpit in RevenueCat.
 *
 * 1. Creates Apple App Store and Google Play Store app entries in RevenueCat.
 * 2. Creates the production IAP products and attaches them to the `pro`
 *    entitlement and `default` offering alongside the existing test-store
 *    products.
 * 3. Calls `createProductInStore` to push the iOS products to App Store
 *    Connect (requires Apple credentials in RevenueCat; if not yet connected
 *    the step is skipped with a warning).
 *
 * Product identifiers:
 *   com.knowyourpit.pro.monthly  — $4.99/month
 *   com.knowyourpit.pro.annual   — $29.99/year  (7-day free trial configured
 *                                                 in App Store Connect & Play
 *                                                 Console — RC reads automatically)
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/setupProductionPricing.ts
 */

import {
  listApps,
  createApp,
  createProductInStore,
  listProducts,
  createProduct,
  listEntitlements,
  attachProductsToEntitlement,
  listOfferings,
  listPackages,
  attachProductsToPackage,
  type AppStoreAppCreate,
  type PlayStoreAppCreate,
  type Product,
  type CreateAppStoreConnectSubscriptionInput,
} from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;

/** Bundle ID / package name used by both iOS and Android builds. */
const BUNDLE_ID = "com.knowyourpit.app";

const ENTITLEMENT_LOOKUP_KEY = "pro";
const OFFERING_LOOKUP_KEY = "default";

/** Subscription group name as it will appear in App Store Connect. */
const IOS_SUBSCRIPTION_GROUP = "knowyourpit Pro";

interface ProductSpec {
  storeIdentifier: string;
  title: string;
  packageLookupKey: string;
  /**
   * Duration used only by `createProductInStore` when pushing to App Store
   * Connect. NOT passed to `createProduct`: the RC API rejects `subscription`
   * fields for non-test-store apps ("Subscription parameters are only
   * supported for simulated store products").
   */
  iosStoreDuration: CreateAppStoreConnectSubscriptionInput["duration"];
}

/** iOS product specs. Identifier = plain App Store product ID. */
const IOS_PRODUCTS: ProductSpec[] = [
  {
    storeIdentifier: "com.knowyourpit.pro.monthly",
    title: "knowyourpit Pro — Monthly",
    packageLookupKey: "$rc_monthly",
    iosStoreDuration: "ONE_MONTH",
  },
  {
    storeIdentifier: "com.knowyourpit.pro.annual",
    title: "knowyourpit Pro — Annual",
    packageLookupKey: "$rc_annual",
    iosStoreDuration: "ONE_YEAR",
  },
];

/**
 * Android product specs.
 * Identifier must follow Play Store format `subscriptionId:basePlanId`.
 */
const ANDROID_PRODUCTS: ProductSpec[] = [
  {
    storeIdentifier: "com.knowyourpit.pro.monthly:monthly",
    title: "knowyourpit Pro — Monthly",
    packageLookupKey: "$rc_monthly",
    iosStoreDuration: "ONE_MONTH", // unused for Android, kept for interface parity
  },
  {
    storeIdentifier: "com.knowyourpit.pro.annual:annual",
    title: "knowyourpit Pro — Annual",
    packageLookupKey: "$rc_annual",
    iosStoreDuration: "ONE_YEAR", // unused for Android
  },
];

type RcClient = Awaited<ReturnType<typeof getRevenueCatClient>>;

// ── App helpers ──────────────────────────────────────────────────────────────

async function findOrCreateIosApp(client: RcClient): Promise<string> {
  const list = await listApps({ client, path: { project_id: PROJECT_ID! } });
  if (list.error) throw describeApiError("listApps", list.error);
  const apps = asListItems<{ id: string; name: string; type: string }>(list.data);

  const existing = apps.find((a) => a.type === "app_store");
  if (existing) {
    console.log(`✓ Apple App Store app already exists: "${existing.name}" (id=${existing.id})`);
    return existing.id;
  }

  const body: AppStoreAppCreate = {
    name: "knowyourpit iOS",
    type: "app_store",
    app_store: { bundle_id: BUNDLE_ID },
  };
  const result = await createApp({ client, path: { project_id: PROJECT_ID! }, body });
  if (result.error || !result.data) throw describeApiError("createApp(iOS)", result.error);
  const app = result.data as { id: string };
  console.log(`+ Created Apple App Store app "knowyourpit iOS" (id=${app.id})`);
  return app.id;
}

async function findOrCreateAndroidApp(client: RcClient): Promise<string> {
  const list = await listApps({ client, path: { project_id: PROJECT_ID! } });
  if (list.error) throw describeApiError("listApps", list.error);
  const apps = asListItems<{ id: string; name: string; type: string }>(list.data);

  const existing = apps.find((a) => a.type === "play_store");
  if (existing) {
    console.log(`✓ Google Play Store app already exists: "${existing.name}" (id=${existing.id})`);
    return existing.id;
  }

  const body: PlayStoreAppCreate = {
    name: "knowyourpit Android",
    type: "play_store",
    play_store: { package_name: BUNDLE_ID },
  };
  const result = await createApp({ client, path: { project_id: PROJECT_ID! }, body });
  if (result.error || !result.data) throw describeApiError("createApp(Android)", result.error);
  const app = result.data as { id: string };
  console.log(`+ Created Google Play Store app "knowyourpit Android" (id=${app.id})`);
  return app.id;
}

// ── Product helpers ──────────────────────────────────────────────────────────

async function findOrCreateProduct(
  client: RcClient,
  appId: string,
  appLabel: string,
  spec: ProductSpec,
): Promise<string> {
  const list = await listProducts({
    client,
    path: { project_id: PROJECT_ID! },
    query: { limit: 100 },
  });
  if (list.error) throw describeApiError("listProducts", list.error);
  const products = asListItems<Pick<Product, "id" | "store_identifier"> & { app_id: string }>(
    list.data,
  );

  const existing = products.find(
    (p) => p.store_identifier === spec.storeIdentifier && p.app_id === appId,
  );
  if (existing) {
    console.log(
      `✓ [${appLabel}] Product "${spec.storeIdentifier}" already exists (id=${existing.id})`,
    );
    return existing.id;
  }

  // NOTE: the `subscription` field (duration etc.) is intentionally omitted.
  // RevenueCat's API rejects it for App Store / Play Store apps with:
  //   "Subscription parameters are only supported for simulated store products."
  // Subscription metadata for production products is sourced directly from the
  // respective store after credentials are connected.
  const result = await createProduct({
    client,
    path: { project_id: PROJECT_ID! },
    body: {
      store_identifier: spec.storeIdentifier,
      app_id: appId,
      type: "subscription",
      display_name: `${spec.title} (${appLabel})`,
    },
  });
  if (result.error || !result.data) {
    throw describeApiError(
      `createProduct(${spec.storeIdentifier}, ${appLabel})`,
      result.error,
    );
  }
  const product = result.data as Pick<Product, "id">;
  console.log(`+ [${appLabel}] Created product "${spec.storeIdentifier}" (id=${product.id})`);
  return product.id;
}

/**
 * Attempt to push an iOS product to App Store Connect via RevenueCat.
 * Requires an Apple Shared Secret (or In-App Purchase Key) to be configured
 * on the iOS app in the RevenueCat dashboard.  If credentials are missing the
 * API will return an error — we log a warning and continue rather than
 * aborting the whole run.
 */
async function tryPushToAppStore(
  client: RcClient,
  productId: string,
  spec: ProductSpec,
): Promise<void> {
  const storeInfo: CreateAppStoreConnectSubscriptionInput = {
    duration: spec.iosStoreDuration,
    subscription_group_name: IOS_SUBSCRIPTION_GROUP,
  };

  const result = await createProductInStore({
    client,
    path: { project_id: PROJECT_ID!, product_id: productId },
    body: { store_information: storeInfo },
  });

  if (result.error) {
    const msg = JSON.stringify(result.error);
    if (
      msg.includes("conflict") ||
      msg.includes("already") ||
      msg.includes("409")
    ) {
      console.log(
        `  ✓ "${spec.storeIdentifier}" already exists in App Store Connect`,
      );
      return;
    }
    // Credentials not yet connected — surface as a warning, not a fatal error.
    console.warn(
      `  ⚠ Could not push "${spec.storeIdentifier}" to App Store Connect: ${msg}`,
    );
    console.warn(
      `    → Connect your Apple Shared Secret in the RevenueCat dashboard first,`,
    );
    console.warn(
      `      then re-run this script or use the Publishing pane sync.`,
    );
    return;
  }
  console.log(
    `+ Pushed "${spec.storeIdentifier}" to App Store Connect successfully`,
  );
}

// ── Entitlement & offering helpers ──────────────────────────────────────────

async function attachToEntitlement(client: RcClient, productIds: string[]) {
  const list = await listEntitlements({ client, path: { project_id: PROJECT_ID! } });
  if (list.error) throw describeApiError("listEntitlements", list.error);
  const ents = asListItems<{ id: string; lookup_key: string }>(list.data);
  const ent = ents.find((e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY);
  if (!ent) {
    throw new Error(
      `Entitlement "${ENTITLEMENT_LOOKUP_KEY}" not found. Run the seed script first.`,
    );
  }

  const result = await attachProductsToEntitlement({
    client,
    path: { project_id: PROJECT_ID!, entitlement_id: ent.id },
    body: { product_ids: productIds },
  });
  if (result.error) {
    const msg = JSON.stringify(result.error);
    if (msg.includes("already") || msg.includes("conflict") || msg.includes("409")) {
      console.log(`✓ Products already attached to entitlement "${ENTITLEMENT_LOOKUP_KEY}"`);
      return;
    }
    throw describeApiError("attachProductsToEntitlement", result.error);
  }
  console.log(
    `+ Attached ${productIds.length} product(s) to entitlement "${ENTITLEMENT_LOOKUP_KEY}"`,
  );
}

/**
 * Attach products to packages in the `default` offering.
 * @param packageProductMap  { [packageLookupKey]: productId[] }
 */
async function attachToPackages(
  client: RcClient,
  packageProductMap: Record<string, string[]>,
) {
  const offsRes = await listOfferings({ client, path: { project_id: PROJECT_ID! } });
  if (offsRes.error) throw describeApiError("listOfferings", offsRes.error);
  const offerings = asListItems<{ id: string; lookup_key: string }>(offsRes.data);
  const offering = offerings.find((o) => o.lookup_key === OFFERING_LOOKUP_KEY);
  if (!offering) {
    throw new Error(`Offering "${OFFERING_LOOKUP_KEY}" not found. Run the seed script first.`);
  }

  const pkgsRes = await listPackages({
    client,
    path: { project_id: PROJECT_ID!, offering_id: offering.id },
  });
  if (pkgsRes.error) throw describeApiError("listPackages", pkgsRes.error);
  const packages = asListItems<{ id: string; lookup_key: string }>(pkgsRes.data);

  for (const [pkgLookupKey, productIds] of Object.entries(packageProductMap)) {
    if (productIds.length === 0) continue;

    const pkg = packages.find((p) => p.lookup_key === pkgLookupKey);
    if (!pkg) {
      console.log(`  ⚠ Package "${pkgLookupKey}" not found in offering — skipping`);
      continue;
    }

    const result = await attachProductsToPackage({
      client,
      path: { project_id: PROJECT_ID!, package_id: pkg.id },
      body: {
        products: productIds.map((id) => ({
          product_id: id,
          eligibility_criteria: "all" as const,
        })),
      },
    });
    if (result.error) {
      const msg = JSON.stringify(result.error);
      if (msg.includes("already") || msg.includes("conflict") || msg.includes("409")) {
        console.log(`✓ Products already attached to package "${pkgLookupKey}"`);
        continue;
      }
      throw describeApiError(`attachProductsToPackage(${pkgLookupKey})`, result.error);
    }
    console.log(`+ Attached ${productIds.length} product(s) to package "${pkgLookupKey}"`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!PROJECT_ID) {
    throw new Error(
      "REVENUECAT_PROJECT_ID is not set. Run the seed script first and store the project ID.",
    );
  }

  const client = await getRevenueCatClient();

  console.log("\n── Step 1: Create iOS App Store app ────────────────────────────────────────");
  const iosAppId = await findOrCreateIosApp(client);

  console.log("\n── Step 2: Create Google Play Store app ────────────────────────────────────");
  const androidAppId = await findOrCreateAndroidApp(client);

  console.log("\n── Step 3: Create iOS products in RevenueCat ───────────────────────────────");
  // Maps packageLookupKey → iOS product RC id
  const iosByPackage: Record<string, string> = {};
  const iosProductIds: string[] = [];
  for (const spec of IOS_PRODUCTS) {
    const id = await findOrCreateProduct(client, iosAppId, "iOS", spec);
    iosByPackage[spec.packageLookupKey] = id;
    iosProductIds.push(id);
  }

  console.log("\n── Step 4: Create Android products in RevenueCat ──────────────────────────");
  // Maps packageLookupKey → Android product RC id
  const androidByPackage: Record<string, string> = {};
  for (const spec of ANDROID_PRODUCTS) {
    const id = await findOrCreateProduct(client, androidAppId, "Android", spec);
    androidByPackage[spec.packageLookupKey] = id;
  }

  console.log("\n── Step 5: Attach all production products to `pro` entitlement ─────────────");
  const allProductIds = [
    ...Object.values(iosByPackage),
    ...Object.values(androidByPackage),
  ];
  await attachToEntitlement(client, allProductIds);

  console.log("\n── Step 6: Attach products to `default` offering packages ──────────────────");
  const packageProductMap: Record<string, string[]> = {};
  for (const key of new Set([
    ...Object.keys(iosByPackage),
    ...Object.keys(androidByPackage),
  ])) {
    const ids: string[] = [];
    if (iosByPackage[key]) ids.push(iosByPackage[key]);
    if (androidByPackage[key]) ids.push(androidByPackage[key]);
    packageProductMap[key] = ids;
  }
  await attachToPackages(client, packageProductMap);

  console.log("\n── Step 7: Push iOS products to App Store Connect ──────────────────────────");
  console.log("  (requires Apple Shared Secret connected in RevenueCat dashboard)");
  for (let i = 0; i < IOS_PRODUCTS.length; i++) {
    await tryPushToAppStore(client, iosProductIds[i], IOS_PRODUCTS[i]);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n════════════════════════════════════════════════════════════════════════════");
  console.log(" Production pricing setup complete!");
  console.log("════════════════════════════════════════════════════════════════════════════");
  console.log(`  project_id : ${PROJECT_ID}`);
  console.log(`  iOS app    : ${iosAppId}`);
  console.log(`  Android app: ${androidAppId}`);
  console.log("");
  console.log("  iOS products (RevenueCat → App Store Connect):");
  for (const spec of IOS_PRODUCTS) {
    const price = spec.packageLookupKey === "$rc_monthly" ? "$4.99/month" : "$29.99/year";
    const note = spec.packageLookupKey === "$rc_annual"
      ? "  ← add 7-day free trial in App Store Connect"
      : "";
    console.log(`    ${spec.storeIdentifier}  ${price}${note}`);
  }
  console.log("");
  console.log("  Android products (RevenueCat → Play Console):");
  for (const spec of ANDROID_PRODUCTS) {
    const price = spec.packageLookupKey === "$rc_monthly" ? "$4.99/month" : "$29.99/year";
    const note = spec.packageLookupKey === "$rc_annual"
      ? "  ← add 7-day free trial offer in Play Console"
      : "";
    console.log(`    ${spec.storeIdentifier}  ${price}${note}`);
  }
  console.log("");
  console.log("  Remaining manual steps:");
  console.log("  1. App Store Connect: create 'Auto-Renewable Subscription' products:");
  console.log("       com.knowyourpit.pro.monthly  →  $4.99/month");
  console.log("       com.knowyourpit.pro.annual   →  $29.99/year + 7-day free trial");
  console.log("  2. Google Play Console: create subscriptions with base plans:");
  console.log("       com.knowyourpit.pro.monthly (base plan: monthly)  →  $4.99/month");
  console.log(
    "       com.knowyourpit.pro.annual  (base plan: annual)   →  $29.99/year + 7-day free trial",
  );
  console.log("  3. RevenueCat dashboard → Apps:");
  console.log("       knowyourpit iOS     → add Apple Shared Secret");
  console.log("       knowyourpit Android → add Google Play service account");
  console.log("  4. Re-run this script (or use Publishing pane sync) to push products");
  console.log("     to App Store Connect once credentials are connected.");
  console.log("");
  console.log("  Replit env vars (set):");
  console.log(`    REVENUECAT_APPLE_APP_STORE_APP_ID   = ${iosAppId}`);
  console.log(`    REVENUECAT_GOOGLE_PLAY_STORE_APP_ID = ${androidAppId}`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
