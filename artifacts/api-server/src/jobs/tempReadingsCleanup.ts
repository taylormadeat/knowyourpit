import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

const DEFAULT_RETENTION_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getRetentionDays(): number {
  const raw = process.env["TEMP_READINGS_RETENTION_DAYS"];
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(
      { TEMP_READINGS_RETENTION_DAYS: raw },
      "tempReadingsCleanup: invalid TEMP_READINGS_RETENTION_DAYS, using default"
    );
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

export async function runTempReadingsCleanup(): Promise<void> {
  const retentionDays = getRetentionDays();
  try {
    const result = await db.execute(sql`
      DELETE FROM temperature_readings
      WHERE cook_id IN (
        SELECT id FROM cooks
        WHERE actual_end_at IS NOT NULL
          AND actual_end_at < NOW() - (${retentionDays} || ' days')::interval
      )
    `);
    const deleted = result.rowCount ?? 0;
    logger.info(
      { deleted, retentionDays },
      "tempReadingsCleanup: pruned old temperature readings"
    );
  } catch (err) {
    logger.error({ err }, "tempReadingsCleanup: failed to prune temperature readings");
  }
}

export function startTempReadingsCleanupJob(): void {
  const intervalMs = MS_PER_DAY;

  // Run once shortly after startup (1 minute delay so the server is fully up)
  const startupDelay = setTimeout(() => {
    void runTempReadingsCleanup();
  }, 60_000);

  // Then run every 24 hours
  const interval = setInterval(() => {
    void runTempReadingsCleanup();
  }, intervalMs);

  // Allow the process to exit cleanly even if the timer is pending
  startupDelay.unref();
  interval.unref();

  logger.info(
    { retentionDays: getRetentionDays(), intervalHours: 24 },
    "tempReadingsCleanup: scheduled daily cleanup job started"
  );
}
