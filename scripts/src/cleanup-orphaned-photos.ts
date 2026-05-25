/**
 * cleanup-orphaned-photos.ts
 *
 * Sweeps cook_photos rows that are marked pending_delete=true and deletes their
 * object-storage files plus the DB rows. This handles the gap where the server
 * crashed between the DB transaction commit (which marks rows pending_delete)
 * and the in-request storage + row deletion.
 *
 * A row must have been marked pending_delete for at least GRACE_MINUTES before
 * this script touches it, to avoid racing with a request that is still in
 * flight doing the same cleanup.
 *
 * Usage (dry-run — lists pending rows, deletes nothing):
 *   DATABASE_URL=<url> DEFAULT_OBJECT_STORAGE_BUCKET_ID=<id> \
 *     pnpm --filter @workspace/scripts run cleanup-orphaned-photos
 *
 * Usage (live — actually deletes storage files and DB rows):
 *   DATABASE_URL=<url> DEFAULT_OBJECT_STORAGE_BUCKET_ID=<id> \
 *     pnpm --filter @workspace/scripts run cleanup-orphaned-photos -- --confirm
 *
 * Safety: without --confirm the script runs in dry-run mode and exits 0.
 */

import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { eq, and, lt } from "drizzle-orm";
import { cookPhotosTable } from "@workspace/db";

const CONFIRM_FLAG = "--confirm";
const GRACE_MINUTES = 5;
const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

const isConfirmed = process.argv.includes(CONFIRM_FLAG);

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL is not set.");
  process.exit(1);
}

const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID ?? "";
if (!BUCKET_ID) {
  console.error("ERROR: DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set.");
  process.exit(1);
}

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function deleteStorageFile(storageKey: string): Promise<void> {
  const signResp = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bucket_name: BUCKET_ID,
        object_name: storageKey,
        method: "DELETE",
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      }),
      signal: AbortSignal.timeout(10_000),
    }
  );
  if (!signResp.ok) {
    throw new Error(`Sidecar sign failed: ${signResp.status}`);
  }
  const { signed_url } = await signResp.json() as { signed_url: string };
  const delResp = await fetch(signed_url, {
    method: "DELETE",
    signal: AbortSignal.timeout(10_000),
  });
  if (!delResp.ok && delResp.status !== 404) {
    throw new Error(`Storage delete failed: ${delResp.status}`);
  }
}

async function main() {
  const cutoff = new Date(Date.now() - GRACE_MINUTES * 60 * 1000);

  const pendingRows = await db
    .select({
      id: cookPhotosTable.id,
      storageKey: cookPhotosTable.storageKey,
      createdAt: cookPhotosTable.createdAt,
    })
    .from(cookPhotosTable)
    .where(
      and(
        eq(cookPhotosTable.pendingDelete, true),
        lt(cookPhotosTable.createdAt, cutoff),
      )
    );

  if (pendingRows.length === 0) {
    console.log("No orphaned photo rows found. Nothing to clean up.");
    await pool.end();
    return;
  }

  console.log(
    `\nFound ${pendingRows.length} orphaned photo row(s)` +
    ` (pending_delete=true, older than ${GRACE_MINUTES} min):\n`
  );
  for (const row of pendingRows) {
    console.log(`  id=${row.id}  key=${row.storageKey}  created=${row.createdAt?.toISOString()}`);
  }

  if (!isConfirmed) {
    console.log(
      [
        "",
        "  DRY-RUN: no files or rows were deleted.",
        "  Re-run with --confirm to actually delete the storage files and DB rows.",
        "",
        "  Example:",
        "    DATABASE_URL=<url> DEFAULT_OBJECT_STORAGE_BUCKET_ID=<id> \\",
        "      pnpm --filter @workspace/scripts run cleanup-orphaned-photos -- --confirm",
        "",
      ].join("\n")
    );
    await pool.end();
    return;
  }

  console.log("\n  *** LIVE MODE — deleting orphaned storage files and DB rows ***\n");

  let deleted = 0;
  let errors = 0;

  for (const row of pendingRows) {
    try {
      await deleteStorageFile(row.storageKey);
      await db.delete(cookPhotosTable).where(eq(cookPhotosTable.id, row.id));
      console.log(`  Deleted: id=${row.id}  key=${row.storageKey}`);
      deleted++;
    } catch (err: any) {
      console.error(`  ERROR: id=${row.id}  key=${row.storageKey}  reason=${err?.message}`);
      errors++;
    }
  }

  await pool.end();
  console.log(`\nCleanup complete. Deleted: ${deleted}, Errors: ${errors}`);
  if (errors > 0) process.exit(1);
}

main().catch((err) => {
  console.error("cleanup-orphaned-photos failed:", err);
  process.exit(1);
});
