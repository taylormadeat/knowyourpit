/**
 * Grant the `pro` entitlement to a Clerk user (effectively lifetime).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run grant-pro -- <clerkUserId>
 *
 * Required env:
 *   REVENUECAT_PROJECT_ID  — printed by `seed-revenuecat`
 *
 * The user does not need to have opened the app yet. RevenueCat creates the
 * customer record on grant if one doesn't exist, and the next
 * `getCustomerInfo()` call from the device will return the active `pro`
 * entitlement so the UI unlocks automatically.
 *
 * The v2 grant endpoint requires `entitlement_id` (not lookup_key) and
 * `expires_at` (epoch ms). To approximate "lifetime" we set expires_at to
 * January 1, 9999 — far enough out to never matter in practice.
 */

import { grantCustomerEntitlement, listEntitlements } from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const ENTITLEMENT_LOOKUP_KEY = "pro";
const LIFETIME_EXPIRES_AT_MS = Date.UTC(9999, 0, 1);

async function resolveEntitlementId(client: any, projectId: string): Promise<string> {
  const list = await listEntitlements({ client, path: { project_id: projectId } });
  if (list.error) throw describeApiError("listEntitlements failed", list.error);
  const match = asListItems<{ id: string; lookup_key: string }>(list.data).find(
    (e) => e.lookup_key === ENTITLEMENT_LOOKUP_KEY,
  );
  if (!match) {
    throw new Error(
      `Entitlement "${ENTITLEMENT_LOOKUP_KEY}" not found in project ${projectId}. ` +
        `Run \`pnpm --filter @workspace/scripts run seed-revenuecat\` first.`,
    );
  }
  return match.id;
}

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error("Usage: pnpm --filter @workspace/scripts run grant-pro -- <clerkUserId>");
    process.exit(2);
  }

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    console.error("REVENUECAT_PROJECT_ID is not set. Run `seed-revenuecat` first.");
    process.exit(2);
  }

  const client = await getRevenueCatClient();
  const entitlementId = await resolveEntitlementId(client, projectId);

  const result = await grantCustomerEntitlement({
    client,
    path: { project_id: projectId, customer_id: userId },
    body: {
      entitlement_id: entitlementId,
      expires_at: LIFETIME_EXPIRES_AT_MS,
    },
  });

  if (result.error) {
    throw describeApiError(`grantCustomerEntitlement(${userId}) failed`, result.error);
  }

  console.log(
    `✓ Granted "${ENTITLEMENT_LOOKUP_KEY}" entitlement to ${userId} ` +
      `(expires ${new Date(LIFETIME_EXPIRES_AT_MS).toISOString()})`,
  );
  console.log("  The user will see Pro features unlock on the next customerInfo refresh.");
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
