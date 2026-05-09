import { is, getTableName } from "drizzle-orm";
import { PgTable } from "drizzle-orm/pg-core";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Client } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

if (process.env.ALLOW_ORPHAN_DROP !== "true") {
  console.error(
    "drop-orphan-tables: refusing to run — set ALLOW_ORPHAN_DROP=true to confirm " +
      "this is a dev/staging database and orphan tables should be dropped."
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
    console.log("No orphan tables found. Dev schema is in sync.");
    await client.end();
    return;
  }

  console.log(`Found ${orphans.length} orphan table(s): ${orphans.join(", ")}`);

  for (const table of orphans) {
    const quoted = `"${table}"`;
    console.log(`Dropping orphan table: ${quoted}`);
    await client.query(`DROP TABLE IF EXISTS ${quoted} CASCADE`);
    console.log(`Dropped: ${quoted}`);
  }

  await client.end();
  console.log("Orphan table cleanup complete.");
}

main().catch((err) => {
  console.error("drop-orphan-tables failed:", err);
  process.exit(1);
});
