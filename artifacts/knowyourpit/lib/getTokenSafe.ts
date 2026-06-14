/**
 * Wraps a Clerk `getToken` function with a timeout so it never blocks the
 * React JS thread indefinitely on a stalled / slow network.
 *
 * If the token arrives within `timeoutMs` it is returned normally.
 * If the timeout fires first, `null` is returned so the caller can proceed
 * without an auth header; a subsequent 401 from the server triggers the
 * existing per-call refresh flow.
 *
 * When the timeout path wins, a `console.warn` is emitted so the stall is
 * visible in the Metro console and any future crash reporter.
 *
 * Pass `forceRefresh = true` to forward `{ skipCache: true }` to Clerk's
 * `getToken`, bypassing the in-memory JWT cache. Use this when returning
 * from background to ensure queued API calls don't fire with an expired token.
 */
export async function getTokenSafe(
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>,
  timeoutMs = 8000,
  forceRefresh = false,
): Promise<string | null> {
  let timedOut = false;

  const timeoutPromise = new Promise<null>(resolve =>
    setTimeout(() => {
      timedOut = true;
      resolve(null);
    }, timeoutMs),
  );

  const opts = forceRefresh ? { skipCache: true } : undefined;
  const result = await Promise.race([getToken(opts).catch(() => null), timeoutPromise]);

  if (timedOut) {
    const message =
      `[getTokenSafe] Clerk getToken timed out after ${timeoutMs} ms — ` +
      "request will proceed without an Authorization header. " +
      "A 401 response from the server will trigger a token refresh.";
    console.warn(message);
  }

  return result;
}
