/**
 * Export each key table from the database referenced by DATABASE_URL as
 * a separate CSV file. Useful for opening data in Excel / Numbers /
 * Google Sheets without needing a Postgres client.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run db:backup:csv
 *
 * Output:
 *   backups/csv-YYYY-MM-DD/<table>.csv at the project root.
 *
 * Note: there is no `users` table in this database — user identity is
 * managed by Clerk. The `userId` columns on these tables hold the Clerk
 * user id, which is enough to correlate the data to a person via the
 * Clerk dashboard.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const BACKUPS_DIR = resolve(PROJECT_ROOT, "backups");

// Tables exported in dependency order. `cooks` depends on `grills`,
// `temperature_readings` depends on both.
const TABLES = [
  "grills",
  "cooks",
  "temperature_readings",
  "subscription_entitlements",
] as const;

function todayStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str: string;
  if (value instanceof Date) {
    str = value.toISOString();
  } else if (Array.isArray(value) || (typeof value === "object")) {
    str = JSON.stringify(value);
  } else {
    str = String(value);
  }
  // RFC 4180: wrap in quotes if it contains comma, quote, CR, or LF.
  // Escape internal quotes by doubling them.
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [];
  lines.push(columns.map(csvEscape).join(","));
  for (const row of rows) {
    lines.push(columns.map((c) => csvEscape(row[c])).join(","));
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Set it before running this script.");
    process.exit(2);
  }

  const outDir = resolve(BACKUPS_DIR, `csv-${todayStamp()}`);
  await mkdir(outDir, { recursive: true });

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    let totalRows = 0;
    for (const table of TABLES) {
      const result = await pool.query(`SELECT * FROM "${table}"`);
      const columns = result.fields.map((f) => f.name);
      const csv = rowsToCsv(columns, result.rows);
      const outFile = resolve(outDir, `${table}.csv`);
      await writeFile(outFile, csv, "utf8");
      totalRows += result.rows.length;
      console.log(`  ${table}: ${result.rows.length} row(s) → ${outFile}`);
    }
    console.log(`\n✓ Exported ${totalRows} row(s) across ${TABLES.length} table(s) to ${outDir}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
