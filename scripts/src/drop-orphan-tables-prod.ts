/**
 * drop-orphan-tables-prod.ts
 *
 * Production-safe orphan-table cleanup.
 *
 * Usage (dry-run — lists orphans, drops nothing):
 *   DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 pnpm --filter @workspace/scripts run db:prod-drop-orphans
 *
 * Usage (live drop — actually removes orphan tables):
 *   DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 pnpm --filter @workspace/scripts run db:prod-drop-orphans -- --confirm
 *
 * Safety gates (both must be satisfied to drop anything):
 *   1. ALLOW_PROD_DROPS=1 must be set in the environment.
 *   2. --confirm must be passed as a CLI argument.
 *
 * Without --confirm the script prints what it would drop and exits 0 (dry-run).
 * Without ALLOW_PROD_DROPS=1 the script refuses to connect at all.
 */

import { is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "@workspace/db/schema";

const { Client } = pg;

const CONFIRM_FLAG = "--confirm";
const isConfirmed = process.argv.includes(CONFIRM_FLAG);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

if (process.env.ALLOW_PROD_DROPS !== "1") {
  console.error(
    [
      "",
      "  drop-orphan-tables-prod: REFUSED",
      "",
      "  Set ALLOW_PROD_DROPS=1 to acknowledge that you intend to run",
      "  this script against a production database and that dropping",
      "  orphan tables is safe and intentional.",
      "",
      "  Example (dry-run):",
      "    DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \\",
      "      pnpm --filter @workspace/scripts run db:prod-drop-orphans",
      "",
      "  Example (live drop):",
      "    DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \\",
      "      pnpm --filter @workspace/scripts run db:prod-drop-orphans -- --confirm",
      "",
    ].join("\n")
  );
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const schemaTableNames = new Set<string>();
  for (const value of Object.values(schema)) {
    if (is(value as object, PgTable)) {
      schemaTableNames.add(getTableName(value as PgTable));
    }
  }

  const { rows } = await client.query<{ tablename: string }>(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`
  );

  const dbTableNames = rows.map((r) => r.tablename);
  const orphans = dbTableNames.filter((t) => !schemaTableNames.has(t));

  if (orphans.length === 0) {
    console.log("No orphan tables found. Production schema is in sync.");
    await client.end();
    return;
  }

  console.log(`\nFound ${orphans.length} orphan table(s):\n`);
  for (const table of orphans) {
    console.log(`  - ${table}`);
  }

  if (!isConfirmed) {
    console.log(
      [
        "",
        "  DRY-RUN: no tables were dropped.",
        "  Re-run with --confirm to actually drop the tables listed above.",
        "",
        "  Example:",
        "    DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \\",
        "      pnpm --filter @workspace/scripts run db:prod-drop-orphans -- --confirm",
        "",
      ].join("\n")
    );
    await client.end();
    return;
  }

  console.log("\n  *** LIVE MODE — dropping orphan tables from production ***\n");

  for (const table of orphans) {
    const quoted = `"${table}"`;
    console.log(`  Dropping: ${quoted} …`);
    await client.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
    console.log(`  Dropped:  ${quoted}`);
  }

  await client.end();
  console.log("\nOrphan table cleanup complete.");
}

main().catch((err) => {
  console.error("drop-orphan-tables-prod failed:", err);
  process.exit(1);
});
