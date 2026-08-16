/**
 * Lightweight fire-and-forget analytics helper.
 *
 * Fires a POST to /api/analytics/event and ignores the response — the server
 * always returns 204, and a failure here should never affect the user's flow.
 * No await required at call sites.
 */
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL ??
  (process.env.EXPO_PUBLIC_DOMAIN
    ? `https://${process.env.EXPO_PUBLIC_DOMAIN}`
    : "");

export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
): void {
  if (!API_BASE) return;

  fetch(`${API_BASE}/api/analytics/event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event, properties }),
  }).catch(() => {
    // Swallow — analytics failures are non-fatal.
  });
}
