/**
 * Produce a portable PostgreSQL dump of the database referenced by
 * DATABASE_URL using `pg_dump`. The output is a standard SQL file that
 * can be opened in any Postgres client (pgAdmin, DBeaver, TablePlus) or
 * used to restore the data with `psql` / `pg_restore`.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run db:backup
 *
 * Output:
 *   backups/knowyourpit-YYYY-MM-DD.sql at the project root.
 */

import { spawn } from "node:child_process";
import { mkdir, stat } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");
const BACKUPS_DIR = resolve(PROJECT_ROOT, "backups");

function todayStamp(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Convert a DATABASE_URL into PG* environment variables. Passing the URL
 * (which contains the password) directly on the pg_dump command line
 * would expose the credentials in process listings (`ps`, `/proc`).
 * Using env vars keeps them out of argv.
 */
function pgEnvFromUrl(databaseUrl: string): Record<string, string> {
  const u = new URL(databaseUrl);
  const env: Record<string, string> = {};
  if (u.hostname) env.PGHOST = u.hostname;
  if (u.port) env.PGPORT = u.port;
  if (u.username) env.PGUSER = decodeURIComponent(u.username);
  if (u.password) env.PGPASSWORD = decodeURIComponent(u.password);
  const dbName = u.pathname.replace(/^\//, "");
  if (dbName) env.PGDATABASE = decodeURIComponent(dbName);
  // Honor sslmode if provided in the URL query (e.g. ?sslmode=require).
  const sslmode = u.searchParams.get("sslmode");
  if (sslmode) env.PGSSLMODE = sslmode;
  return env;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL is not set. Set it before running this script.");
    process.exit(2);
  }

  let pgEnv: Record<string, string>;
  try {
    pgEnv = pgEnvFromUrl(databaseUrl);
  } catch (err: any) {
    console.error(`DATABASE_URL is not a valid URL: ${err?.message ?? err}`);
    process.exit(2);
  }

  await mkdir(BACKUPS_DIR, { recursive: true });

  const outFile = resolve(BACKUPS_DIR, `knowyourpit-${todayStamp()}.sql`);
  const out = createWriteStream(outFile);

  console.log(`Dumping database to ${outFile} ...`);

  const child = spawn(
    "pg_dump",
    ["--no-owner", "--no-privileges", "--format=plain", "--encoding=UTF8"],
    {
      stdio: ["ignore", "pipe", "inherit"],
      env: { ...process.env, ...pgEnv },
    },
  );

  child.stdout.pipe(out);

  const exitCode: number = await new Promise((resolveExit, rejectExit) => {
    child.on("error", rejectExit);
    child.on("close", (code) => resolveExit(code ?? 1));
  });

  // Ensure the file stream is fully flushed before we stat() it.
  out.end();
  if (!out.closed) {
    await once(out, "close");
  }

  if (exitCode !== 0) {
    console.error(`pg_dump exited with code ${exitCode}.`);
    process.exit(exitCode);
  }

  const { size } = await stat(outFile);
  const sizeKb = (size / 1024).toFixed(1);
  console.log(`✓ Backup written: ${outFile} (${sizeKb} KB)`);
  console.log("  Open in any Postgres client, or restore with:");
  console.log(`    psql "$DATABASE_URL" < "${outFile}"`);
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
