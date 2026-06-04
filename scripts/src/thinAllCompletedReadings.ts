/**
 * Retroactive admin script: thin temperature readings for all already-completed
 * cooks down to 1 reading per 15-minute bucket per probe.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run db:thin-temp-readings
 *
 * Add --dry-run to print the cook ids and estimated row counts without deleting.
 *
 * Safety: reads DATABASE_URL from the environment. Point at dev by default;
 * set DATABASE_URL=<prod-url> explicitly for production runs.
 */
import { db, cooksTable, temperatureReadingsTable } from "@workspace/db";
import { sql, eq, count } from "drizzle-orm";

const BUCKET_SECONDS = 15 * 60;
const BATCH_SIZE = 50;
const DRY_RUN = process.argv.includes("--dry-run");

async function thinCook(cookId: number): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM temperature_readings
    WHERE cook_id = ${cookId}
      AND id NOT IN (
        SELECT id FROM (
          SELECT DISTINCT ON (
            probe_number,
            floor(extract(epoch from recorded_at) / ${BUCKET_SECONDS})
          )
            id
          FROM temperature_readings
          WHERE cook_id = ${cookId}
          ORDER BY
            probe_number,
            floor(extract(epoch from recorded_at) / ${BUCKET_SECONDS}),
            abs(
              extract(epoch from recorded_at)
              - (floor(extract(epoch from recorded_at) / ${BUCKET_SECONDS}) + 0.5)
                * ${BUCKET_SECONDS}
            )
        ) keepers
      )
  `);
  return (result as { rowCount?: number | null }).rowCount ?? 0;
}

async function countReadings(cookId: number): Promise<number> {
  const [row] = await db
    .select({ c: count() })
    .from(temperatureReadingsTable)
    .where(eq(temperatureReadingsTable.cookId, cookId));
  return Number(row?.c ?? 0);
}

async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no deletes)" : "LIVE"}`);

  // Fetch all completed cook ids.
  const allCompleted = await db
    .select({ id: cooksTable.id })
    .from(cooksTable)
    .where(eq(cooksTable.status, "completed"));

  const total = allCompleted.length;
  console.log(`Found ${total} completed cook(s) to process.`);

  let processed = 0;
  let totalDeleted = 0;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = allCompleted.slice(i, i + BATCH_SIZE);

    for (const { id } of batch) {
      if (DRY_RUN) {
        const count = await countReadings(id);
        console.log(`  cook ${id}: ${count} readings`);
        processed++;
        continue;
      }

      try {
        const deleted = await thinCook(id);
        if (deleted > 0) {
          console.log(`  cook ${id}: deleted ${deleted} readings`);
          totalDeleted += deleted;
        }
      } catch (err) {
        console.error(`  cook ${id}: ERROR —`, err);
      }
      processed++;
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, total)} / ${total}`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run complete. ${processed} cook(s) inspected.`);
  } else {
    console.log(`\nDone. ${processed} cook(s) processed, ${totalDeleted} row(s) deleted.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
