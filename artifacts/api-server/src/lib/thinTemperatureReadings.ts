import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "./logger";

const BUCKET_SECONDS = 15 * 60; // 15-minute buckets

/**
 * Thin the temperature readings for a completed cook down to (at most) one
 * reading per 15-minute bucket per probe, keeping the sample whose recordedAt
 * is closest to the bucket midpoint.
 *
 * A 12-hour cook with a polling probe can accumulate 1 000+ rows; after
 * thinning it has at most ~50 per probe — enough for smooth chart curves and
 * accurate calibration stats with no visible degradation.
 *
 * Uses a single DELETE … NOT IN (DISTINCT ON …) so the operation is atomic
 * and requires only one round-trip to the database.
 *
 * @returns the number of rows deleted
 */
export async function thinTemperatureReadings(cookId: number): Promise<number> {
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
  const deleted = (result as { rowCount?: number | null }).rowCount ?? 0;
  if (deleted > 0) {
    logger.info({ cookId, deleted }, "thinTemperatureReadings: pruned stale readings");
  }
  return deleted;
}
