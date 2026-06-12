const refiningSet = new Set<number>();
const listeners: Set<() => void> = new Set();

export function markBgRefining(cookId: number): void {
  refiningSet.add(cookId);
  listeners.forEach((fn) => fn());
}

export function clearBgRefining(cookId: number): void {
  refiningSet.delete(cookId);
  listeners.forEach((fn) => fn());
}

export function isBgRefining(cookId: number): boolean {
  return refiningSet.has(cookId);
}

export function subscribeBgRefining(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

// ── Per-cook "refinement complete" signal ─────────────────────────────────────
// Fired by fireBgAiRefine (plan.tsx) after the AI predict call succeeds and the
// server has already patched the cook record. Subscribers (e.g. the cook detail
// screen) can react immediately by triggering a targeted refetch, without
// needing the user to pull-to-refresh.

const refinedListeners = new Map<number, Set<() => void>>();

export function notifyBgAiRefined(cookId: number): void {
  refinedListeners.get(cookId)?.forEach((fn) => fn());
}

export function onBgAiRefined(cookId: number, fn: () => void): () => void {
  if (!refinedListeners.has(cookId)) {
    refinedListeners.set(cookId, new Set());
  }
  refinedListeners.get(cookId)!.add(fn);
  return () => {
    refinedListeners.get(cookId)?.delete(fn);
    if (refinedListeners.get(cookId)?.size === 0) {
      refinedListeners.delete(cookId);
    }
  };
}
