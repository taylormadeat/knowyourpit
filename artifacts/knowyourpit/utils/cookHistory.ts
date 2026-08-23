type CookHistoryItem = {
  status?: string | null;
  createdAt?: string | Date | null;
  actualStartAt?: string | Date | null;
  actualEndAt?: string | Date | null;
  plannedStartAt?: string | Date | null;
  sessionLabel?: string | null;
  sequenceData?: unknown;
};

function validTimestamp(value: unknown): number | null {
  if (!value) return null;
  const timestamp = new Date(value as string | Date).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

/**
 * Home orders its recent endpoint by creation time. Keep Cook Log's client
 * sorting aligned so a just-finished cook cannot fall to the bottom merely
 * because it has no planned start time.
 */
export function cookHistoryTimestamp(cook: CookHistoryItem): number {
  const candidates = cook.status === "completed"
    ? [cook.actualEndAt, cook.createdAt, cook.actualStartAt, cook.plannedStartAt]
    : [cook.createdAt, cook.actualStartAt, cook.plannedStartAt, cook.actualEndAt];
  for (const value of candidates) {
    const timestamp = validTimestamp(value);
    if (timestamp != null) return timestamp;
  }
  return 0;
}

/**
 * A session ID is also used as the server idempotency key for a normal
 * single-cook start. Collapse rows only when their metadata explicitly says
 * that they are a multi-cook session; an accidental duplicate session ID must
 * never hide a newly created cook inside a collapsed group.
 */
export function isExplicitMultiCookSession(cooks: CookHistoryItem[]): boolean {
  if (cooks.length < 2) return false;
  return cooks.some((cook) => {
    if (typeof cook.sessionLabel === "string" && cook.sessionLabel.trim()) return true;
    const sequenceData = cook.sequenceData as {
      type?: unknown;
      schedule?: unknown;
    } | null | undefined;
    return sequenceData?.type === "multi_cook" ||
      (Array.isArray(sequenceData?.schedule) && sequenceData.schedule.length > 1);
  });
}