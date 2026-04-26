/**
 * Seed RevenueCat with knowyourpit's project, test-store app, products,
 * entitlement, and offering. Idempotent — re-runnable without creating
 * duplicates.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run seed-revenuecat
 *
 * After it finishes the script prints the test-store public API key so you
 * can paste it into your Replit Secrets / EAS env as
 * `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
 * (the test store key works for both platforms during development).
 *
 * App Store Connect / Play Store apps are intentionally out of scope here —
 * they require additional secrets (P8 key, package name, signing cert) and
 * are configured directly in the RC dashboard once production builds exist.
 */

import {
  listProjects,
  createProject,
  listApps,
  listAppPublicApiKeys,
  listEntitlements,
  createEntitlement,
  listProducts,
  createProduct,
  attachProductsToEntitlement,
  listOfferings,
  createOffering,
  listPackages,
  createPackages,
  attachProductsToPackage,
} from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const PROJECT_NAME = "knowyourpit";
const ENTITLEMENT_LOOKUP_KEY = "pro";
const ENTITLEMENT_DISPLAY_NAME = "Pro";

const PRODUCTS = [
  {
    storeIdentifier: "com.knowyourpit.pro.annual",
    title: "knowyourpit Pro — Annual",
    duration: "P1Y" as const,
    packageLookupKey: "$rc_annual",
    packageDisplayName: "Annual",
    position: 1,
  },
  {
    storeIdentifier: "com.knowyourpit.pro.monthly",
    title: "knowyourpit Pro — Monthly",
    duration: "P1M" as const,
    packageLookupKey: "$rc_monthly",
    packageDisplayName: "Monthly",
    position: 2,
  },
];

const OFFERING_LOOKUP_KEY = "default";
const OFFERING_DISPLAY_NAME = "knowyourpit Pro";

type Client = Awaited<ReturnType<typeof getRevenueCatClient>>;

async function findOrCreateProject(client: Client): Promise<string> {
  const list = await listProjects({ client });
  if (list.error) throw describeApiError("listProjects failed", list.error);
  const existing = asListItems<{ id: string; name: string }>(list.data).find(
    (p) => p.name === PROJECT_NAME,
  );
  if (existing) {
    console.log(`✓ Project "${PROJECT_NAME}" already exists (id=${existing.id})`);
    return existing.id;
  }
  const created = await createProject({ client, body: { name: PROJECT_NAME } });
  if (created.error || !created.data) {
    throw describeApiError("createProject failed", created.error);
  }
  console.log(`+ Created project "${PROJECT_NAME}" (id=${created.data.id})`);
  return created.data.id;
}

async function findTestStoreApp(client: Client, projectId: string): Promise<string> {
  // RevenueCat automatically provisions a test-store app on every new
  // project, so we never call createApp here — there is no test_store
  // variant in the v2 AppCreate union. We just look it up. If it isn't
  // there (e.g. someone deleted it), fail loudly so the operator can
  // recreate it from the RC dashboard.
  const list = await listApps({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listApps failed", list.error);
  const existing = asListItems<{ id: string; name: string; type: string }>(list.data).find(
    (a) => a.type === "test_store",
  );
  if (existing) {
    console.log(`✓ Test-store app "${existing.name}" found (id=${existing.id})`);
    return existing.id;
  }
  throw new Error(
    `No test_store app found in project ${projectId}. Create one in the RevenueCat dashboard ` +
      `(Project Settings → Apps → Add app → Test Store) and re-run this script.`,
  );
}

async function getTestStorePublicApiKey(
  client: Client,
  projectId: string,
  appId: string,
): Promise<string> {
  const list = await listAppPublicApiKeys({
    client,
    path: { project_id: projectId, app_id: appId },
  });
  if (list.error) throw describeApiError("listAppPublicApiKeys failed", list.error);
  const key = asListItems<{ key: string }>(list.data)[0]?.key;
  if (!key) {
    throw new Error(
      `No public API key found for test-store app ${appId}. Open RC dashboard and rotate keys.`,
    );
  }
  return key;
}

async function findOrCreateEntitlement(client: Client, projectId: string): Promise<string> {
  const list = await listEntitlements({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listEntitlements failed", list.error);
  const existing = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY,
  );
  if (existing) {
    console.log(`✓ Entitlement "${ENTITLEMENT_LOOKUP_KEY}" already exists (id=${existing.id})`);
    return existing.id;
  }
  const created = await createEntitlement({
    client,
    path: { project_id: projectId },
    body: { lookup_key: ENTITLEMENT_LOOKUP_KEY, display_name: ENTITLEMENT_DISPLAY_NAME },
  });
  if (created.error || !created.data) {
    throw describeApiError("createEntitlement failed", created.error);
  }
  console.log(`+ Created entitlement "${ENTITLEMENT_LOOKUP_KEY}" (id=${created.data.id})`);
  return created.data.id;
}

async function findOrCreateProduct(
  client: Client,
  projectId: string,
  appId: string,
  spec: (typeof PRODUCTS)[number],
): Promise<string> {
  const list = await listProducts({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listProducts failed", list.error);
  const existing = asListItems<{ id: string; store_identifier: string }>(list.data).find(
    (p) => p.store_identifier === spec.storeIdentifier,
  );
  if (existing) {
    console.log(
      `✓ Product "${spec.storeIdentifier}" already exists (id=${existing.id})`,
    );
    return existing.id;
  }
  const created = await createProduct({
    client,
    path: { project_id: projectId },
    body: {
      store_identifier: spec.storeIdentifier,
      app_id: appId,
      type: "subscription",
      display_name: spec.title,
      title: spec.title,
      subscription: { duration: spec.duration },
    },
  });
  if (created.error || !created.data) {
    throw describeApiError(`createProduct(${spec.storeIdentifier}) failed`, created.error);
  }
  console.log(`+ Created product "${spec.storeIdentifier}" (id=${created.data.id})`);
  return created.data.id;
}

async function ensureProductsAttachedToEntitlement(
  client: Client,
  projectId: string,
  entitlementId: string,
  productIds: string[],
) {
  const result = await attachProductsToEntitlement({
    client,
    path: { project_id: projectId, entitlement_id: entitlementId },
    body: { product_ids: productIds },
  });
  if (result.error) {
    // RC returns 409 if any are already attached — surface but don't fail.
    const msg = JSON.stringify(result.error);
    if (msg.includes("already") || msg.includes("conflict")) {
      console.log(`✓ Entitlement already references products ${productIds.join(", ")}`);
      return;
    }
    throw describeApiError("attachProductsToEntitlement failed", result.error);
  }
  console.log(`+ Attached products [${productIds.join(", ")}] to entitlement "${ENTITLEMENT_LOOKUP_KEY}"`);
}

async function findOrCreateOffering(client: Client, projectId: string): Promise<string> {
  const list = await listOfferings({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listOfferings failed", list.error);
  const existing = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (o) => o.lookup_key === OFFERING_LOOKUP_KEY,
  );
  if (existing) {
    console.log(`✓ Offering "${OFFERING_LOOKUP_KEY}" already exists (id=${existing.id})`);
    return existing.id;
  }
  const created = await createOffering({
    client,
    path: { project_id: projectId },
    body: { lookup_key: OFFERING_LOOKUP_KEY, display_name: OFFERING_DISPLAY_NAME },
  });
  if (created.error || !created.data) {
    throw describeApiError("createOffering failed", created.error);
  }
  console.log(`+ Created offering "${OFFERING_LOOKUP_KEY}" (id=${created.data.id})`);
  return created.data.id;
}

async function findOrCreatePackageInOffering(
  client: Client,
  projectId: string,
  offeringId: string,
  spec: (typeof PRODUCTS)[number],
): Promise<string> {
  const list = await listPackages({
    client,
    path: { project_id: projectId, offering_id: offeringId },
  });
  if (list.error) throw describeApiError("listPackages failed", list.error);
  const existing = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (p) => p.lookup_key === spec.packageLookupKey,
  );
  if (existing) {
    console.log(
      `✓ Package "${spec.packageLookupKey}" already in offering (id=${existing.id})`,
    );
    return existing.id;
  }
  const created = await createPackages({
    client,
    path: { project_id: projectId, offering_id: offeringId },
    body: {
      lookup_key: spec.packageLookupKey,
      display_name: spec.packageDisplayName,
      position: spec.position,
    },
  });
  if (created.error || !created.data) {
    throw describeApiError(`createPackages(${spec.packageLookupKey}) failed`, created.error);
  }
  console.log(`+ Added package "${spec.packageLookupKey}" to offering`);
  return created.data.id;
}

async function ensureProductAttachedToPackage(
  client: Client,
  projectId: string,
  packageId: string,
  productId: string,
) {
  const result = await attachProductsToPackage({
    client,
    path: { project_id: projectId, package_id: packageId },
    body: { products: [{ product_id: productId, eligibility_criteria: "all" }] },
  });
  if (result.error) {
    const msg = JSON.stringify(result.error);
    if (msg.includes("already") || msg.includes("conflict")) {
      console.log(`✓ Package ${packageId} already references product ${productId}`);
      return;
    }
    throw describeApiError("attachProductsToPackage failed", result.error);
  }
  console.log(`+ Attached product ${productId} to package ${packageId}`);
}

async function main() {
  const client = await getRevenueCatClient();

  const projectId = await findOrCreateProject(client);
  const appId = await findTestStoreApp(client, projectId);
  const apiKey = await getTestStorePublicApiKey(client, projectId, appId);
  const entitlementId = await findOrCreateEntitlement(client, projectId);

  const productIds: string[] = [];
  for (const spec of PRODUCTS) {
    const productId = await findOrCreateProduct(client, projectId, appId, spec);
    productIds.push(productId);
  }

  await ensureProductsAttachedToEntitlement(client, projectId, entitlementId, productIds);

  const offeringId = await findOrCreateOffering(client, projectId);

  for (let i = 0; i < PRODUCTS.length; i++) {
    const spec = PRODUCTS[i];
    const packageId = await findOrCreatePackageInOffering(client, projectId, offeringId, spec);
    await ensureProductAttachedToPackage(client, projectId, packageId, productIds[i]);
  }

  console.log("\n────────────────────────────────────────────────────────");
  console.log(" knowyourpit RevenueCat seed complete");
  console.log("────────────────────────────────────────────────────────");
  console.log(` project_id      : ${projectId}`);
  console.log(` test_store_app  : ${appId}`);
  console.log(` entitlement     : ${ENTITLEMENT_LOOKUP_KEY} (${entitlementId})`);
  console.log(` offering        : ${OFFERING_LOOKUP_KEY} (${offeringId})`);
  console.log(` products        : ${PRODUCTS.map((p) => p.storeIdentifier).join(", ")}`);
  console.log("\n Next: store the test-store SDK key as both");
  console.log("   EXPO_PUBLIC_REVENUECAT_IOS_KEY");
  console.log("   EXPO_PUBLIC_REVENUECAT_ANDROID_KEY");
  console.log(" in Replit Secrets (and EAS Secrets for production builds).");
  console.log(`\n   ${apiKey}\n`);
  console.log(" Also set REVENUECAT_PROJECT_ID in your server env:");
  console.log(`   REVENUECAT_PROJECT_ID=${projectId}\n`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
