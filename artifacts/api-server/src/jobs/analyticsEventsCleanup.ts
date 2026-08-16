import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { logger } from "../lib/logger";

// Keep 90 days of analytics events by default — enough for quarterly reporting
// without letting the table grow indefinitely.
const DEFAULT_RETENTION_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function getRetentionDays(): number {
  const raw = process.env["ANALYTICS_EVENTS_RETENTION_DAYS"];
  if (raw === undefined || raw === "") return DEFAULT_RETENTION_DAYS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    logger.warn(
      { ANALYTICS_EVENTS_RETENTION_DAYS: raw },
      "analyticsEventsCleanup: invalid ANALYTICS_EVENTS_RETENTION_DAYS, using default",
    );
    return DEFAULT_RETENTION_DAYS;
  }
  return parsed;
}

export async function runAnalyticsEventsCleanup(): Promise<void> {
  const retentionDays = getRetentionDays();
  try {
    const result = await db.execute(sql`
      DELETE FROM analytics_events
      WHERE created_at < NOW() - (${retentionDays} || ' days')::interval
    `);
    const deleted = result.rowCount ?? 0;
    logger.info(
      { deleted, retentionDays },
      "analyticsEventsCleanup: pruned old analytics events",
    );
  } catch (err) {
    logger.error({ err }, "analyticsEventsCleanup: failed to prune analytics events");
  }
}

export function startAnalyticsEventsCleanupJob(): void {
  const intervalMs = MS_PER_DAY;

  // Run once shortly after startup (2 minute delay so the server is fully up).
  const startupDelay = setTimeout(() => {
    void runAnalyticsEventsCleanup();
  }, 2 * 60_000);

  // Then run every 24 hours.
  const interval = setInterval(() => {
    void runAnalyticsEventsCleanup();
  }, intervalMs);

  // Allow the process to exit cleanly even if the timer is pending.
  startupDelay.unref();
  interval.unref();

  logger.info(
    { retentionDays: getRetentionDays(), intervalHours: 24 },
    "analyticsEventsCleanup: scheduled daily cleanup job started",
  );
}
