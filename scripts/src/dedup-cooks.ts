/**
 * dedup-cooks.ts
 *
 * One-time cleanup: removes duplicate cook records created by the multi-cook
 * retry bug. Duplicates are identified by (userId, sessionId, plannedStartAt)
 * tuples where more than one row exists. The oldest row (lowest id) is kept;
 * all newer rows are deleted.
 *
 * Only cooks where BOTH sessionId and plannedStartAt are non-null are
 * considered — those are the only rows that can be idempotent duplicates.
 *
 * Usage (dry-run — prints what would be deleted, changes nothing):
 *   pnpm --filter @workspace/scripts run db:dedup-cooks
 *
 * Usage (live delete):
 *   pnpm --filter @workspace/scripts run db:dedup-cooks -- --confirm
 */

import pg from "pg";

const { Client } = pg;

const CONFIRM_FLAG = "--confirm";
const isConfirmed = process.argv.includes(CONFIRM_FLAG);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

interface DuplicateGroup {
  user_id: string;
  session_id: string;
  planned_start_at: Date;
  kept_id: number;
  duplicate_ids: number[];
}

async function main() {
  await client.connect();

  console.log("Scanning for duplicate cook records …\n");

  const { rows } = await client.query<{
    user_id: string;
    session_id: string;
    planned_start_at: Date;
    all_ids: string;
    count: string;
  }>(
    `
    SELECT
      user_id,
      session_id,
      planned_start_at,
      string_agg(id::text, ',' ORDER BY id ASC) AS all_ids,
      COUNT(*) AS count
    FROM cooks
    WHERE session_id IS NOT NULL
      AND planned_start_at IS NOT NULL
      AND user_id IS NOT NULL
    GROUP BY user_id, session_id, planned_start_at
    HAVING COUNT(*) > 1
    ORDER BY user_id, session_id, planned_start_at
    `
  );

  if (rows.length === 0) {
    console.log("No duplicate cook records found. Database is clean.");
    await client.end();
    return;
  }

  const groups: DuplicateGroup[] = rows.map((r) => {
    const ids = r.all_ids.split(",").map(Number);
    const [kept_id, ...duplicate_ids] = ids;
    return {
      user_id: r.user_id,
      session_id: r.session_id,
      planned_start_at: r.planned_start_at,
      kept_id,
      duplicate_ids,
    };
  });

  const totalDuplicates = groups.reduce(
    (sum, g) => sum + g.duplicate_ids.length,
    0
  );

  console.log(
    `Found ${groups.length} duplicate group(s) — ${totalDuplicates} record(s) to delete:\n`
  );

  for (const g of groups) {
    console.log(
      `  user=${g.user_id}  session=${g.session_id}  plannedStart=${g.planned_start_at.toISOString()}`
    );
    console.log(`    keep   → id=${g.kept_id}`);
    console.log(`    delete → ids=[${g.duplicate_ids.join(", ")}]`);
  }

  if (!isConfirmed) {
    console.log(
      [
        "",
        "  DRY-RUN: no records were deleted.",
        "  Re-run with --confirm to actually delete the duplicates listed above.",
        "",
        "  Example:",
        "    pnpm --filter @workspace/scripts run db:dedup-cooks -- --confirm",
        "",
      ].join("\n")
    );
    await client.end();
    return;
  }

  console.log(
    "\n  *** LIVE MODE — deleting duplicate cook records ***\n"
  );

  let deleted = 0;
  for (const g of groups) {
    const result = await client.query(
      `DELETE FROM cooks WHERE id = ANY($1::int[])`,
      [g.duplicate_ids]
    );
    deleted += result.rowCount ?? 0;
    console.log(
      `  Deleted ${result.rowCount} duplicate(s) for session=${g.session_id} / plannedStart=${g.planned_start_at.toISOString()}`
    );
  }

  await client.end();
  console.log(
    `\nDone. Deleted ${deleted} duplicate cook record(s) across ${groups.length} group(s).`
  );
}

main().catch((err) => {
  console.error("dedup-cooks failed:", err);
  process.exit(1);
});
