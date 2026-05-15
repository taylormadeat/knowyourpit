/**
 * List all customers who currently hold the `pro` entitlement.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run list-pro [options]
 *
 * Options:
 *   --granted-after  <ISO date>   Only show grants made after this date (inclusive), e.g. 2026-01-01
 *   --granted-before <ISO date>   Only show grants made before this date (inclusive), e.g. 2026-12-31
 *
 * Examples:
 *   pnpm --filter @workspace/scripts run list-pro
 *   pnpm --filter @workspace/scripts run list-pro -- --granted-after 2026-05-01
 *   pnpm --filter @workspace/scripts run list-pro -- --granted-after 2026-05-01 --granted-before 2026-05-31
 *
 * Required env:
 *   REVENUECAT_PROJECT_ID  — printed by `seed-revenuecat`
 *   CLERK_SECRET_KEY       — needed to resolve email addresses
 *
 * Output columns per Pro user:
 *   Clerk User ID | Email | Granted At | Expires At | Source (subscription vs manual grant)
 *
 * The "Source" column distinguishes:
 *   - "manual grant"           — granted via grantPro / bulkGrantPro (product_identifier is null)
 *   - "subscription (<id>)"    — active paid subscription
 */

import { listCustomerActiveEntitlements, listCustomers, listEntitlements } from "@replit/revenuecat-sdk";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const CLERK_API_BASE = "https://api.clerk.com/v1";
const PRO_LOOKUP_KEY = "pro";
const PAGE_LIMIT = 100;
const ENTITLEMENT_CONCURRENCY = 10;
const CLERK_EMAIL_CONCURRENCY = 5;

interface ActiveEntitlement {
  entitlement_id: string;
  expires_at?: number | null;
  granted_at?: number | null;
  product_identifier?: string | null;
}

interface RcCustomer {
  id: string;
  [key: string]: unknown;
}

interface ProUser {
  clerkId: string;
  email: string | null;
  expiresAt: number | null;
  grantedAt: number | null;
  productIdentifier: string | null;
}

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

/**
 * Fetch all customers from RevenueCat, paginating with cursor-based pagination.
 */
async function fetchAllCustomers(client: any, projectId: string): Promise<RcCustomer[]> {
  const all: RcCustomer[] = [];
  let startingAfter: string | undefined;

  while (true) {
    const result = await listCustomers({
      client,
      path: { project_id: projectId },
      query: {
        limit: PAGE_LIMIT,
        ...(startingAfter ? { starting_after: startingAfter } : {}),
      },
    });

    if (result.error) {
      throw describeApiError("listCustomers failed", result.error);
    }

    const items = asListItems<RcCustomer>(result.data);
    all.push(...items);

    if (items.length < PAGE_LIMIT) break;
    startingAfter = items[items.length - 1].id;
  }

  return all;
}

/**
 * Check a batch of customers for the pro entitlement, returning those who have it.
 */
async function checkBatchForPro(
  client: any,
  projectId: string,
  customers: RcCustomer[],
  proEntitlementId: string,
): Promise<ProUser[]> {
  const results: Array<ProUser | null> = await Promise.all(
    customers.map(async (customer): Promise<ProUser | null> => {
      const result = await listCustomerActiveEntitlements({
        client,
        path: { project_id: projectId, customer_id: customer.id },
      });
      if (result.error) {
        process.stderr.write(
          `  Warning: could not check entitlements for ${customer.id}: ` +
            `${describeApiError("", result.error).message}\n`,
        );
        return null;
      }
      const entitlements = asListItems<ActiveEntitlement>(result.data);
      const proEnt = entitlements.find((e) => e.entitlement_id === proEntitlementId);
      if (!proEnt) return null;

      return {
        clerkId: customer.id,
        email: null,
        expiresAt: proEnt.expires_at ?? null,
        grantedAt: proEnt.granted_at ?? null,
        productIdentifier: proEnt.product_identifier ?? null,
      };
    }),
  );

  return results.filter((r): r is ProUser => r !== null);
}

/**
 * Resolve emails for a list of Clerk user IDs.
 * Returns a map of clerkId → primary email address (or null on failure).
 */
async function resolveClerkEmails(clerkIds: string[]): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  if (clerkIds.length === 0) return map;

  const clerkKey = process.env.CLERK_SECRET_KEY;
  if (!clerkKey) {
    console.warn("  CLERK_SECRET_KEY not set — emails will not be resolved.");
    for (const id of clerkIds) map.set(id, null);
    return map;
  }

  for (let i = 0; i < clerkIds.length; i += CLERK_EMAIL_CONCURRENCY) {
    const batch = clerkIds.slice(i, i + CLERK_EMAIL_CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        try {
          const res = await fetch(`${CLERK_API_BASE}/users/${encodeURIComponent(id)}`, {
            headers: {
              Authorization: `Bearer ${clerkKey}`,
              "Content-Type": "application/json",
            },
          });
          if (!res.ok) {
            map.set(id, null);
            return;
          }
          const user = (await res.json()) as {
            primary_email_address_id?: string;
            email_addresses?: Array<{ id: string; email_address: string }>;
          };
          const primary = user.email_addresses?.find(
            (e) => e.id === user.primary_email_address_id,
          );
          map.set(id, primary?.email_address ?? null);
        } catch {
          map.set(id, null);
        }
      }),
    );
  }

  return map;
}

function formatExpiry(expiresAt: number | null): string {
  if (expiresAt === null) return "never (lifetime)";
  const d = new Date(expiresAt);
  return d.getFullYear() >= 9990 ? "never (lifetime)" : d.toISOString();
}

function formatGrantedAt(grantedAt: number | null): string {
  if (grantedAt === null) return "unknown";
  return new Date(grantedAt).toISOString();
}

function formatSource(productIdentifier: string | null): string {
  if (!productIdentifier) return "manual grant";
  return `subscription (${productIdentifier})`;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

interface ParsedDate {
  ts: number;
  dateOnly: boolean;
}

/**
 * Parse --granted-after / --granted-before from argv.
 * Accepts ISO date-only strings ("2026-05-01") or full ISO timestamps.
 * Returns a ParsedDate (ts + dateOnly flag), or null if the flag is absent.
 * Exits with an error message when the value is missing or invalid.
 */
function parseDateArg(flag: string, args: string[]): ParsedDate | null {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  const raw = args[idx + 1];
  if (!raw || raw.startsWith("--")) {
    console.error(`Error: ${flag} requires a date value (e.g. 2026-05-01).`);
    process.exit(2);
  }
  const ts = Date.parse(raw);
  if (Number.isNaN(ts)) {
    console.error(`Error: ${flag} value "${raw}" is not a valid date. Use ISO format, e.g. 2026-05-01.`);
    process.exit(2);
  }
  return { ts, dateOnly: DATE_ONLY_RE.test(raw) };
}

async function main() {
  const args = process.argv.slice(2);

  const parsedAfter = parseDateArg("--granted-after", args);
  const parsedBefore = parseDateArg("--granted-before", args);

  const grantedAfterMs = parsedAfter !== null ? parsedAfter.ts : null;
  const grantedBeforeMs =
    parsedBefore !== null
      ? parsedBefore.dateOnly
        ? parsedBefore.ts + 86_400_000 - 1
        : parsedBefore.ts
      : null;

  if (grantedAfterMs !== null && grantedBeforeMs !== null && grantedAfterMs > grantedBeforeMs) {
    console.error("Error: --granted-after must not be later than --granted-before.");
    process.exit(2);
  }

  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) {
    console.error("REVENUECAT_PROJECT_ID is not set. Run `seed-revenuecat` first.");
    process.exit(2);
  }

  const client = await getRevenueCatClient();

  process.stdout.write("Resolving pro entitlement ID…\n");
  const proEntitlementId = await resolveProEntitlementId(client, projectId);

  process.stdout.write("Fetching all customers…\n");
  const allCustomers = await fetchAllCustomers(client, projectId);
  process.stdout.write(`  Found ${allCustomers.length} total customer(s).\n`);

  process.stdout.write("Checking entitlements…\n");
  let proUsers: ProUser[] = [];

  for (let i = 0; i < allCustomers.length; i += ENTITLEMENT_CONCURRENCY) {
    const batch = allCustomers.slice(i, i + ENTITLEMENT_CONCURRENCY);
    const batchResults = await checkBatchForPro(client, projectId, batch, proEntitlementId);
    proUsers.push(...batchResults);
    process.stdout.write(`  Checked ${Math.min(i + ENTITLEMENT_CONCURRENCY, allCustomers.length)} / ${allCustomers.length}…\r`);
  }
  process.stdout.write("\n");

  const totalPro = proUsers.length;

  if (grantedAfterMs !== null) {
    proUsers = proUsers.filter((u) => u.grantedAt !== null && u.grantedAt >= grantedAfterMs);
  }
  if (grantedBeforeMs !== null) {
    const endOfDay = grantedBeforeMs + 86_400_000 - 1;
    proUsers = proUsers.filter((u) => u.grantedAt !== null && u.grantedAt <= endOfDay);
  }

  const isFiltered = grantedAfterMs !== null || grantedBeforeMs !== null;

  if (totalPro === 0) {
    console.log("\nNo users currently hold the pro entitlement.");
    return;
  }

  const afterLabel = grantedAfterMs !== null ? new Date(grantedAfterMs).toISOString().slice(0, 10) : null;
  const beforeLabel = grantedBeforeMs !== null ? new Date(grantedBeforeMs).toISOString().slice(0, 10) : null;

  if (proUsers.length === 0) {
    const rangeDesc = [
      afterLabel !== null ? `after ${afterLabel}` : null,
      beforeLabel !== null ? `before ${beforeLabel}` : null,
    ]
      .filter((s): s is string => s !== null)
      .join(" and ");
    console.log(`\nNo Pro grants found ${rangeDesc} (${totalPro} total Pro user(s) outside this range).`);
    return;
  }

  process.stdout.write(`Resolving emails for ${proUsers.length} Pro user(s)…\n`);
  const emailMap = await resolveClerkEmails(proUsers.map((u) => u.clerkId));

  const colId = 32;
  const colEmail = 34;
  const colGranted = 26;
  const colExpiry = 26;
  const lineWidth = colId + colEmail + colGranted + colExpiry + 20;

  const rangeDesc = isFiltered
    ? " | filter: " +
      [afterLabel !== null ? `after ${afterLabel}` : null, beforeLabel !== null ? `before ${beforeLabel}` : null]
        .filter((s): s is string => s !== null)
        .join(", ")
    : "";

  console.log(`\n${"─".repeat(lineWidth)}`);
  console.log(`Pro users (${proUsers.length}${isFiltered ? ` of ${totalPro} total` : ""})${rangeDesc}:`);
  console.log(`${"─".repeat(lineWidth)}`);

  const header =
    "Clerk User ID".padEnd(colId) +
    "Email".padEnd(colEmail) +
    "Granted At".padEnd(colGranted) +
    "Expires At".padEnd(colExpiry) +
    "Source";
  console.log(header);
  console.log("─".repeat(lineWidth));

  for (const user of proUsers) {
    const email = emailMap.get(user.clerkId) ?? "(unknown)";
    const granted = formatGrantedAt(user.grantedAt);
    const expiry = formatExpiry(user.expiresAt);
    const source = formatSource(user.productIdentifier);

    const row =
      user.clerkId.padEnd(colId) +
      email.padEnd(colEmail) +
      granted.padEnd(colGranted) +
      expiry.padEnd(colExpiry) +
      source;
    console.log(row);
  }

  console.log("─".repeat(lineWidth));
  console.log(`Total: ${proUsers.length}${isFiltered ? ` filtered (${totalPro} total Pro users)` : " Pro users"}`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
