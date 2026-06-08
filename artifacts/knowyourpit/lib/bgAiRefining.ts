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
