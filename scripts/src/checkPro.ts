/**
 * Inspect a user's active RevenueCat entitlements.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run check-pro -- <clerkUserId|email>
 *
 * Required env:
 *   REVENUECAT_PROJECT_ID  — printed by `seed-revenuecat`
 *   CLERK_SECRET_KEY       — required when passing an email address
 *
 * Prints all active entitlements for the customer, including expiry dates,
 * and highlights whether the `pro` entitlement is currently active.
 */

import { listCustomerActiveEntitlements, listEntitlements } from "@replit/revenuecat-sdk";
import { resolveClerkUserId } from "./lib/clerk.js";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const PRO_LOOKUP_KEY = "pro";

interface ActiveEntitlement {
  entitlement_id: string;
  expires_at?: number | null;
  granted_at?: number | null;
  product_identifier?: string;
}

/**
 * Resolve the project-level entitlement ID for the `pro` lookup key.
 * Active entitlement items only carry entitlement_id, not lookup_key,
 * so we must resolve it upfront (same pattern as grantPro / revokePro).
 */
async function resolveProEntitlementId(client: any, projectId: string): Promise<string> {
  const list = await listEntitlements({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listEntitlements failed", list.error);
  const match = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (e) => e.lookup_key === PRO_LOOKUP_KEY,
  );
  if (!match) {
    throw new Error(
      `Entitlement "${PRO_LOOKUP_KEY}" not found in project ${projectId}. ` +
        `Run \`pnpm --filter @workspace/scripts run seed-revenuecat\` first.`,
    );
  }
  return match.id;
}

async function main() {
  const emailOrId = process.argv[2];
  if (!emailOrId) {
    console.error(
      "Usage: pnpm --filter @workspace/scripts run check-pro -- <clerkUserId|email>",
    );
    process.exit(2);
  }

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    console.error("REVENUECAT_PROJECT_ID is not set. Run `seed-revenuecat` first.");
    process.exit(2);
  }

  const userId = await resolveClerkUserId(emailOrId);

  const client = await getRevenueCatClient();

  // Resolve the pro entitlement ID first — active entitlement items only
  // expose entitlement_id, not the human-readable lookup key.
  const proEntitlementId = await resolveProEntitlementId(client, projectId);

  const result = await listCustomerActiveEntitlements({
    client,
    path: { project_id: projectId, customer_id: userId },
  });

  if (result.error) {
    throw describeApiError(`listCustomerActiveEntitlements(${userId}) failed`, result.error);
  }

  const entitlements = asListItems<ActiveEntitlement>(result.data);

  if (entitlements.length === 0) {
    console.log(`\nUser ${userId} has no active entitlements.`);
    console.log(`  Pro status: NOT ACTIVE`);
    return;
  }

  console.log(`\nUser ${userId} — active entitlements (${entitlements.length}):`);
  console.log("");

  for (const ent of entitlements) {
    const isPro = ent.entitlement_id === proEntitlementId;

    const expiresAt = ent.expires_at;
    let expiryStr: string;
    if (!expiresAt) {
      expiryStr = "never (lifetime)";
    } else {
      const d = new Date(expiresAt);
      expiryStr = d.getFullYear() >= 9990 ? "never (lifetime)" : d.toISOString();
    }

    const grantedAt = ent.granted_at;
    const grantedStr = grantedAt ? new Date(grantedAt).toISOString() : "unknown";

    const proTag = isPro ? ` ← PRO (${PRO_LOOKUP_KEY})` : "";
    console.log(`  Entitlement ID : ${ent.entitlement_id}${proTag}`);
    if (ent.product_identifier) {
      console.log(`  Product        : ${ent.product_identifier}`);
    }
    console.log(`  Granted at     : ${grantedStr}`);
    console.log(`  Expires at     : ${expiryStr}`);
    console.log("");
  }

  const hasPro = entitlements.some((e) => e.entitlement_id === proEntitlementId);

  console.log(`  Pro status: ${hasPro ? "ACTIVE ✓" : "NOT ACTIVE"}`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
