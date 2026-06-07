/**
 * Wraps a Clerk `getToken` function with a timeout so it never blocks the
 * React JS thread indefinitely on a stalled / slow network.
 *
 * If the token arrives within `timeoutMs` it is returned normally.
 * If the timeout fires first, `null` is returned so the caller can proceed
 * without an auth header; a subsequent 401 from the server triggers the
 * existing per-call refresh flow.
 */
export async function getTokenSafe(
  getToken: (opts?: { skipCache?: boolean }) => Promise<string | null>,
  timeoutMs = 1000,
): Promise<string | null> {
  return Promise.race([
    getToken().catch(() => null),
    new Promise<null>(resolve => setTimeout(() => resolve(null), timeoutMs)),
  ]);
}
