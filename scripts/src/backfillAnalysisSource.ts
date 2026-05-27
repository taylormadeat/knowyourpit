/**
 * One-off migration: tag existing `analysisResult` records that originated
 * from a thermometer image scan with `source: "image_scan"`.
 *
 * Heuristic: an analysis is from an image scan when it has at least one
 * probe entry that includes a non-empty `timeSeries` array.  Analyses run
 * without images (cook_end / active_cook) never populate time-series data.
 *
 * Records that already have a `source` field are skipped — they were saved
 * after the field was introduced and are already correct.
 */

import { db, cooksTable } from "@workspace/db";
import { isNotNull, sql } from "drizzle-orm";

async function isImageScan(analysisResult: unknown): Promise<boolean> {
  if (!analysisResult || typeof analysisResult !== "object") return false;
  const ar = analysisResult as Record<string, unknown>;
  const probes = ar["probes"];
  if (!Array.isArray(probes) || probes.length === 0) return false;
  return probes.some((p: unknown) => {
    if (!p || typeof p !== "object") return false;
    const ts = (p as Record<string, unknown>)["timeSeries"];
    return Array.isArray(ts) && ts.length > 0;
  });
}

async function main() {
  const rows = await db
    .select({ id: cooksTable.id, analysisResult: cooksTable.analysisResult })
    .from(cooksTable)
    .where(isNotNull(cooksTable.analysisResult));

  let scanned = 0;
  let skipped = 0;
  let taggedImageScan = 0;
  let taggedCookEnd = 0;

  for (const row of rows) {
    scanned += 1;
    const ar = row.analysisResult as Record<string, unknown> | null;
    if (!ar) continue;

    if (ar["source"] != null) {
      skipped += 1;
      continue;
    }

    const imageScan = await isImageScan(ar);
    const source = imageScan ? "image_scan" : "cook_end";

    await db
      .update(cooksTable)
      .set({
        analysisResult: sql`${cooksTable.analysisResult} || jsonb_build_object('source', ${source}::text)`,
      })
      .where(sql`${cooksTable.id} = ${row.id}`);

    if (imageScan) {
      taggedImageScan += 1;
      console.log(`Cook #${row.id}: tagged as image_scan`);
    } else {
      taggedCookEnd += 1;
      console.log(`Cook #${row.id}: tagged as cook_end`);
    }
  }

  console.log(`
Done.
  Scanned:        ${scanned}
  Already tagged: ${skipped}
  → image_scan:   ${taggedImageScan}
  → cook_end:     ${taggedCookEnd}
`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
