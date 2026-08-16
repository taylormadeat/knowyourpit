/**
 * Wraps a grill-catalog add request with a best-effort AbortController (for
 * network-level cancellation) and a hard Promise.race timeout that guarantees
 * the caller's await always settles within `timeoutMs` — even when the React
 * Native fetch polyfill does not honour the abort signal.
 *
 * Returns the resolved value on success.
 * Throws on network error or timeout (with message "Request timed out…").
 * Always calls `onSettle()` regardless of outcome.
 */
export async function withCatalogAddTimeout<T>(
  requestFn: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  onSettle?: () => void,
): Promise<T> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error("Request timed out. Please try again."));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([requestFn(controller.signal), timeoutPromise]);
    return result;
  } finally {
    clearTimeout(timeoutId);
    onSettle?.();
  }
}
