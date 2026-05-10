import { useEffect, useState } from "react";

/**
 * Returns the current timestamp in milliseconds, updated on a configurable
 * interval. When `enabled` is false the interval is not registered, so
 * completed / planned cook cards pay zero overhead.
 *
 * On transition from disabled → enabled the timestamp is refreshed immediately
 * so the first rendered frame is never stale.
 */
export function useNow(intervalMs = 1000, enabled = true): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [enabled, intervalMs]);

  return now;
}
