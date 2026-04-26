/**
 * Revoke a previously-granted `pro` entitlement from a Clerk user.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run revoke-pro -- <clerkUserId>
 *
 * Required env:
 *   REVENUECAT_PROJECT_ID  — printed by `seed-revenuecat`
 *
 * Note: this only revokes entitlements granted via the API (i.e. via
 * `grant-pro`). Real subscriptions purchased through App Store / Play Store
 * cannot be revoked here — refunds happen through the store.
 *
 * The v2 active-entitlements endpoint returns items shaped like
 * `{ object: "customer.active_entitlement", entitlement_id, expires_at }` —
 * it does NOT echo the entitlement's lookup_key. So we resolve our `pro`
 * lookup_key to a project entitlement id via `listEntitlements` first, then
 * verify the customer actually holds that id before revoking.
 */

import {
  listCustomerActiveEntitlements,
  listEntitlements,
  revokeCustomerGrantedEntitlement,
} from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const ENTITLEMENT_LOOKUP_KEY = "pro";

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
    console.error("Usage: pnpm --filter @workspace/scripts run revoke-pro -- <clerkUserId>");
    process.exit(2);
  }

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    console.error("REVENUECAT_PROJECT_ID is not set. Run `seed-revenuecat` first.");
    process.exit(2);
  }

  const client = await getRevenueCatClient();
  const proEntitlementId = await resolveEntitlementId(client, projectId);

  // Verify the customer actually has the `pro` entitlement active before
  // attempting revoke — otherwise the API returns a confusing 404.
  const list = await listCustomerActiveEntitlements({
    client,
    path: { project_id: projectId, customer_id: userId },
  });
  if (list.error) {
    throw describeApiError(`listCustomerActiveEntitlements(${userId}) failed`, list.error);
  }

  const matching = asListItems<{ entitlement_id: string }>(list.data).find(
    (e) => e.entitlement_id === proEntitlementId,
  );

  if (!matching) {
    console.log(`✓ User ${userId} has no active "${ENTITLEMENT_LOOKUP_KEY}" entitlement to revoke.`);
    return;
  }

  const result = await revokeCustomerGrantedEntitlement({
    client,
    path: { project_id: projectId, customer_id: userId },
    body: { entitlement_id: proEntitlementId },
  });

  if (result.error) {
    throw describeApiError(`revokeCustomerGrantedEntitlement(${userId}) failed`, result.error);
  }

  console.log(`✓ Revoked "${ENTITLEMENT_LOOKUP_KEY}" entitlement from ${userId}`);
  console.log("  The user will see Pro features lock on the next customerInfo refresh.");
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
