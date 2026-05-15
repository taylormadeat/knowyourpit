/**
 * Bulk-grant the `pro` entitlement to all Clerk users who signed up on a
 * specific calendar date (UTC).
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run bulk-grant-pro -- \
 *     --date 2026-06-14 \
 *     [--expires-days 90] \
 *     [--dry-run]
 *
 * Required env:
 *   CLERK_SECRET_KEY        — to list users by signup date
 *   REVENUECAT_PROJECT_ID   — RevenueCat project to grant entitlements in
 *
 * Options:
 *   --date           YYYY-MM-DD  (required) Calendar day (UTC) to match signup date.
 *   --expires-days   number      Days from now until the entitlement expires.
 *                                Default: 90. Pass 0 for lifetime (~year 9999).
 *   --dry-run                    Print the list of affected users without
 *                                calling RevenueCat.
 */

import {
  grantCustomerEntitlement,
  listCustomerActiveEntitlements,
  listEntitlements,
} from "@replit/revenuecat-sdk";
import { listUsersBySignupDate, type ClerkUserSummary } from "./lib/clerk.js";
import { asListItems, describeApiError, getRevenueCatClient } from "./lib/revenuecat.js";

const ENTITLEMENT_LOOKUP_KEY = "pro";
const DEFAULT_EXPIRES_DAYS = 90;
const LIFETIME_EXPIRES_AT_MS = Date.UTC(9999, 0, 1);
const ENTITLEMENT_CONCURRENCY = 5;

interface ParsedArgs {
  date: string;
  expiresDays: number;
  dryRun: boolean;
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2);
  let date: string | undefined;
  let expiresDays = DEFAULT_EXPIRES_DAYS;
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--date") {
      date = argv[++i];
    } else if (arg === "--expires-days") {
      const raw = argv[++i];
      const parsed = parseInt(raw, 10);
      if (isNaN(parsed) || parsed < 0) {
        console.error(`--expires-days must be a non-negative integer, got: "${raw}"`);
        process.exit(2);
      }
      expiresDays = parsed;
    } else if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  if (!date) {
    console.error(
      "Usage: pnpm --filter @workspace/scripts run bulk-grant-pro -- " +
        "--date YYYY-MM-DD [--expires-days 90] [--dry-run]",
    );
    process.exit(2);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    console.error(`--date must be in YYYY-MM-DD format, got: "${date}"`);
    process.exit(2);
  }

  return { date, expiresDays, dryRun };
}

function checkRequiredEnv(): { projectId: string } {
  const missing: string[] = [];

  if (!process.env.CLERK_SECRET_KEY) missing.push("CLERK_SECRET_KEY");
  const projectId = process.env.REVENUECAT_PROJECT_ID;
  if (!projectId) missing.push("REVENUECAT_PROJECT_ID");

  if (missing.length > 0) {
    console.error(`Missing required environment variable(s): ${missing.join(", ")}`);
    process.exit(2);
  }

  return { projectId: projectId! };
}

async function resolveProEntitlementId(client: any, projectId: string): Promise<string> {
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

interface ActiveEntitlement {
  entitlement_id: string;
  expires_at?: number | null;
}

type EntitlementCheckResult = "active" | "none" | "error";

async function checkProEntitlement(
  client: any,
  projectId: string,
  customerId: string,
  proEntitlementId: string,
): Promise<EntitlementCheckResult> {
  const result = await listCustomerActiveEntitlements({
    client,
    path: { project_id: projectId, customer_id: customerId },
  });
  if (result.error) {
    return "error";
  }
  const entitlements = asListItems<ActiveEntitlement>(result.data);
  return entitlements.some((e) => e.entitlement_id === proEntitlementId) ? "active" : "none";
}

function computeExpiresAt(expiresDays: number): number {
  if (expiresDays === 0) return LIFETIME_EXPIRES_AT_MS;
  return Date.now() + expiresDays * 24 * 60 * 60 * 1000;
}

function formatExpiry(expiresAtMs: number): string {
  if (expiresAtMs >= LIFETIME_EXPIRES_AT_MS) return "never (lifetime)";
  return new Date(expiresAtMs).toISOString();
}

type RowStatus = "GRANTED" | "SKIPPED (already pro)" | "FAILED";

interface ResultRow {
  clerkId: string;
  email: string;
  status: RowStatus;
  detail: string;
}

async function processBatch(
  client: any,
  projectId: string,
  proEntitlementId: string,
  users: ClerkUserSummary[],
  expiresAtMs: number,
  dryRun: boolean,
): Promise<ResultRow[]> {
  return Promise.all(
    users.map(async (user): Promise<ResultRow> => {
      const email = user.email ?? "(no email)";
      const checkResult = await checkProEntitlement(
        client,
        projectId,
        user.id,
        proEntitlementId,
      );

      if (checkResult === "error") {
        return {
          clerkId: user.id,
          email,
          status: "FAILED",
          detail: "could not verify existing entitlement — skipped to avoid duplicate grant",
        };
      }

      if (checkResult === "active") {
        return { clerkId: user.id, email, status: "SKIPPED (already pro)", detail: "" };
      }

      if (dryRun) {
        return {
          clerkId: user.id,
          email,
          status: "GRANTED",
          detail: `(dry-run — would expire ${formatExpiry(expiresAtMs)})`,
        };
      }

      const result = await grantCustomerEntitlement({
        client,
        path: { project_id: projectId, customer_id: user.id },
        body: {
          entitlement_id: proEntitlementId,
          expires_at: expiresAtMs,
        },
      });

      if (result.error) {
        const err = describeApiError("", result.error);
        return { clerkId: user.id, email, status: "FAILED", detail: err.message };
      }

      return {
        clerkId: user.id,
        email,
        status: "GRANTED",
        detail: `expires ${formatExpiry(expiresAtMs)}`,
      };
    }),
  );
}

function printTable(rows: ResultRow[]): void {
  const colId = 34;
  const colEmail = 36;
  const colStatus = 26;
  const lineWidth = colId + colEmail + colStatus + 30;
  const sep = "─".repeat(lineWidth);

  console.log(`\n${sep}`);
  const header =
    "Clerk User ID".padEnd(colId) +
    "Email".padEnd(colEmail) +
    "Status".padEnd(colStatus) +
    "Detail";
  console.log(header);
  console.log(sep);

  for (const row of rows) {
    console.log(
      row.clerkId.padEnd(colId) +
        row.email.padEnd(colEmail) +
        row.status.padEnd(colStatus) +
        row.detail,
    );
  }

  console.log(sep);

  const granted = rows.filter((r) => r.status === "GRANTED").length;
  const skipped = rows.filter((r) => r.status === "SKIPPED (already pro)").length;
  const failed = rows.filter((r) => r.status === "FAILED").length;

  console.log(`Total matched: ${rows.length} | Granted: ${granted} | Skipped: ${skipped} | Failed: ${failed}`);
}

async function main() {
  const { date, expiresDays, dryRun } = parseArgs();
  const { projectId } = checkRequiredEnv();

  console.log(`\nBulk Grant Pro`);
  console.log(`  Date:         ${date} (UTC)`);
  console.log(`  Expires days: ${expiresDays === 0 ? "0 (lifetime)" : expiresDays}`);
  console.log(`  Dry run:      ${dryRun}`);
  console.log("");

  process.stdout.write("Fetching users from Clerk…\n");
  const users = await listUsersBySignupDate(date);

  if (users.length === 0) {
    console.log(`No Clerk users found who signed up on ${date} (UTC).`);
    return;
  }

  console.log(`Found ${users.length} user(s) signed up on ${date}.`);

  const client = await getRevenueCatClient();

  process.stdout.write("Resolving pro entitlement ID…\n");
  const proEntitlementId = await resolveProEntitlementId(client, projectId);

  const expiresAtMs = computeExpiresAt(expiresDays);

  if (dryRun) {
    console.log("\n[DRY RUN] No changes will be made to RevenueCat.\n");
  }

  const allRows: ResultRow[] = [];

  for (let i = 0; i < users.length; i += ENTITLEMENT_CONCURRENCY) {
    const batch = users.slice(i, i + ENTITLEMENT_CONCURRENCY);
    process.stdout.write(
      `  Processing ${i + 1}–${Math.min(i + ENTITLEMENT_CONCURRENCY, users.length)} / ${users.length}…\r`,
    );
    const batchRows = await processBatch(
      client,
      projectId,
      proEntitlementId,
      batch,
      expiresAtMs,
      dryRun,
    );
    allRows.push(...batchRows);
  }
  process.stdout.write("\n");

  printTable(allRows);

  const failed = allRows.filter((r) => r.status === "FAILED").length;
  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
