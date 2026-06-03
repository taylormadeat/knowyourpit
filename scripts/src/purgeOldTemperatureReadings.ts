/**
 * purgeOldTemperatureReadings.ts
 *
 * Hard-deletes temperature_readings rows recorded before 2026-05-24 (the
 * build-#100 cutoff).  Before that build, probe polling ran every 15 seconds,
 * producing up to 4,800 rows per 10-hour cook.  No real users were active
 * before 2026-05-24 so the data can be safely removed.
 *
 * Usage (dry-run — prints row count, deletes nothing):
 *   pnpm --filter @workspace/scripts run db:purge-temp-readings
 *
 * Usage (live delete — actually removes the rows):
 *   pnpm --filter @workspace/scripts run db:purge-temp-readings -- --confirm
 *
 * Safety gate: --confirm must be passed explicitly.
 * Without it the script runs in dry-run mode and exits 0.
 */

import { lt, sql } from "drizzle-orm";
import { db, temperatureReadingsTable } from "@workspace/db";

const CUTOFF_ISO = "2026-05-24T00:00:00Z";
const CUTOFF = new Date(CUTOFF_ISO);
const CONFIRM_FLAG = "--confirm";
const isConfirmed = process.argv.includes(CONFIRM_FLAG);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

console.log(`\n  purgeOldTemperatureReadings`);
console.log(`  Cutoff: recorded_at < ${CUTOFF_ISO}`);
console.log(`  Mode:   ${isConfirmed ? "LIVE DELETE" : "dry-run (pass --confirm to delete)"}\n`);

const [beforeRow] = await db
  .select({ total: sql<number>`COUNT(*)::int` })
  .from(temperatureReadingsTable);

const [staleRow] = await db
  .select({ stale: sql<number>`COUNT(*)::int` })
  .from(temperatureReadingsTable)
  .where(lt(temperatureReadingsTable.recordedAt, CUTOFF));

const total = beforeRow?.total ?? 0;
const stale = staleRow?.stale ?? 0;

console.log(`  Total rows in table : ${total.toLocaleString()}`);
console.log(`  Rows to be deleted  : ${stale.toLocaleString()} (before ${CUTOFF_ISO})`);
console.log(`  Rows to be kept     : ${(total - stale).toLocaleString()}\n`);

if (!isConfirmed) {
  console.log("  Dry-run complete — nothing deleted.  Pass --confirm to execute.\n");
  process.exit(0);
}

if (stale === 0) {
  console.log("  Nothing to delete — exiting.\n");
  process.exit(0);
}

console.log("  Deleting stale rows …");
await db
  .delete(temperatureReadingsTable)
  .where(lt(temperatureReadingsTable.recordedAt, CUTOFF));

const [afterRow] = await db
  .select({ total: sql<number>`COUNT(*)::int` })
  .from(temperatureReadingsTable);

const after = afterRow?.total ?? 0;

console.log(`  Done.  Rows before: ${total.toLocaleString()}  →  after: ${after.toLocaleString()}  (deleted ${(total - after).toLocaleString()})\n`);
