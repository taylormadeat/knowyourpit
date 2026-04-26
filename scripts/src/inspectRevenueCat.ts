/**
 * Inspect current RevenueCat project state:
 * - Apps (test store, iOS, Android)
 * - Products
 * - Entitlements + attached products
 * - Offerings + packages + package products
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/inspectRevenueCat.ts
 */

import {
  listProjects,
  listApps,
  listProducts,
  listEntitlements,
  getProductsFromEntitlement,
  listOfferings,
  listPackages,
  getProductsFromPackage,
} from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

async function main() {
  const client = await getRevenueCatClient();

  // ── Project ──────────────────────────────────────────────────────────────────
  console.log("\n=== PROJECTS ===");
  const projectsRes = await listProjects({ client });
  if (projectsRes.error) throw describeApiError("listProjects", projectsRes.error);
  const projects = asListItems<{ id: string; name: string }>(projectsRes.data);
  for (const proj of projects) {
    console.log(`  id=${proj.id}  name="${proj.name}"`);
  }

  if (projects.length === 0) {
    console.log("  No projects found.");
    return;
  }

  const PROJECT_ID = projects[0].id;
  console.log(`\nUsing project: ${PROJECT_ID}`);

  // ── Apps ────────────────────────────────────────────────────────────────────
  console.log("\n=== APPS ===");
  const appsRes = await listApps({ client, path: { project_id: PROJECT_ID } });
  if (appsRes.error) throw describeApiError("listApps", appsRes.error);
  const apps = asListItems<{ id: string; name: string; type: string }>(appsRes.data);
  for (const app of apps) {
    console.log(`  [${app.type}] id=${app.id}  name="${app.name}"`);
  }

  // ── Products ─────────────────────────────────────────────────────────────────
  console.log("\n=== PRODUCTS ===");
  const prodsRes = await listProducts({ client, path: { project_id: PROJECT_ID }, query: { limit: 50 } });
  if (prodsRes.error) throw describeApiError("listProducts", prodsRes.error);
  const products = asListItems<{ id: string; store_identifier: string; app_id: string; display_name: string; type: string }>(prodsRes.data);
  for (const p of products) {
    const appType = apps.find((a) => a.id === p.app_id)?.type ?? "unknown";
    console.log(`  [${appType}] id=${p.id}  identifier="${p.store_identifier}"  name="${p.display_name}"`);
  }

  // ── Entitlements + attached products ─────────────────────────────────────────
  console.log("\n=== ENTITLEMENTS ===");
  const entsRes = await listEntitlements({ client, path: { project_id: PROJECT_ID } });
  if (entsRes.error) throw describeApiError("listEntitlements", entsRes.error);
  const entitlements = asListItems<{ id: string; lookup_key: string; display_name: string }>(entsRes.data);
  for (const ent of entitlements) {
    console.log(`  "${ent.lookup_key}" (id=${ent.id})`);
    const entProdsRes = await getProductsFromEntitlement({
      client,
      path: { project_id: PROJECT_ID, entitlement_id: ent.id },
    });
    if (!entProdsRes.error) {
      const entProds = asListItems<{ product_id: string; store_identifier: string }>(entProdsRes.data);
      for (const ep of entProds) {
        console.log(`    → product ${ep.product_id}  (${ep.store_identifier})`);
      }
    }
  }

  // ── Offerings + packages ──────────────────────────────────────────────────────
  console.log("\n=== OFFERINGS ===");
  const offsRes = await listOfferings({ client, path: { project_id: PROJECT_ID } });
  if (offsRes.error) throw describeApiError("listOfferings", offsRes.error);
  const offerings = asListItems<{ id: string; lookup_key: string; display_name: string }>(offsRes.data);
  for (const off of offerings) {
    console.log(`  "${off.lookup_key}" (id=${off.id})`);
    const pkgsRes = await listPackages({ client, path: { project_id: PROJECT_ID, offering_id: off.id } });
    if (pkgsRes.error) continue;
    const pkgs = asListItems<{ id: string; lookup_key: string; display_name: string }>(pkgsRes.data);
    for (const pkg of pkgs) {
      console.log(`    Package "${pkg.lookup_key}" (id=${pkg.id})`);
      const pkgProdsRes = await getProductsFromPackage({ client, path: { project_id: PROJECT_ID, package_id: pkg.id } });
      if (!pkgProdsRes.error) {
        const pkgProds = asListItems<{ product: { id: string; store_identifier: string; app_id: string } }>(pkgProdsRes.data);
        for (const pp of pkgProds) {
          const appType = apps.find((a) => a.id === pp.product.app_id)?.type ?? "unknown";
          console.log(`      → [${appType}] product ${pp.product.id}  (${pp.product.store_identifier})`);
        }
      }
    }
  }

  console.log("\n=== ENV VAR SUMMARY ===");
  console.log(`  REVENUECAT_PROJECT_ID              = ${process.env.REVENUECAT_PROJECT_ID ?? "(not set)"}`);
  console.log(`  REVENUECAT_TEST_STORE_APP_ID       = ${process.env.REVENUECAT_TEST_STORE_APP_ID ?? "(not set)"}`);
  console.log(`  REVENUECAT_APPLE_APP_STORE_APP_ID  = ${process.env.REVENUECAT_APPLE_APP_STORE_APP_ID ?? "(not set)"}`);
  console.log(`  REVENUECAT_GOOGLE_PLAY_STORE_APP_ID= ${process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID ?? "(not set)"}`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
