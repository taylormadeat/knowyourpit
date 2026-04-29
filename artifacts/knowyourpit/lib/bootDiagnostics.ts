import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Captures uncaught JavaScript errors and persists them to AsyncStorage so
 * the very next launch can display them on the boot diagnostic screen.
 *
 * Without this we would have no way to see what failed during a launch
 * sequence in production — the app would simply render the boot screen
 * forever, and `console.log` is invisible on a TestFlight build.
 *
 * Safe to call multiple times: only the first call wins. Stays a complete
 * no-op on web.
 */
const STORAGE_KEY = "knowyourpit:lastBootError";

interface PersistedBootError {
  message: string;
  stack: string;
  isFatal: boolean;
  capturedAt: number;
}

let installed = false;

interface ErrorUtilsLike {
  getGlobalHandler?: () => ((error: Error, isFatal?: boolean) => void) | undefined;
  setGlobalHandler?: (handler: (error: Error, isFatal?: boolean) => void) => void;
}

function getErrorUtils(): ErrorUtilsLike | null {
  const g = globalThis as unknown as { ErrorUtils?: ErrorUtilsLike };
  return g.ErrorUtils ?? null;
}

export function installBootErrorCapture(): void {
  if (installed) return;
  installed = true;

  const utils = getErrorUtils();
  if (!utils?.setGlobalHandler) return;

  const previous = utils.getGlobalHandler?.();

  utils.setGlobalHandler((error, isFatal) => {
    const payload: PersistedBootError = {
      message: error?.message ?? String(error),
      stack: (error?.stack ?? "").slice(0, 4000),
      isFatal: !!isFatal,
      capturedAt: Date.now(),
    };
    // Best-effort write; do not await so we never block the original handler.
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
    if (previous) {
      try {
        previous(error, isFatal);
      } catch {
        // Swallow — never crash recursively from inside the global handler.
      }
    }
  });
}

/**
 * Reads (and clears) any error persisted by a previous launch. Returns null
 * if nothing was captured. Idempotent: a second read returns null.
 */
export async function consumeLastBootError(): Promise<PersistedBootError | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(STORAGE_KEY);
    return JSON.parse(raw) as PersistedBootError;
  } catch {
    return null;
  }
}

/**
 * Manually persist an error so that the next launch can display it.
 * Use from React ErrorBoundary's onError callback, since render errors
 * caught by an ErrorBoundary are NOT re-thrown through ErrorUtils' global
 * handler — without this they would only be visible until the user
 * dismisses the fallback.
 */
export function persistBootError(error: Error, componentStack?: string): void {
  const payload: PersistedBootError = {
    message: error?.message ?? String(error),
    stack: ((error?.stack ?? "") + (componentStack ? "\n--- componentStack ---\n" + componentStack : "")).slice(0, 4000),
    isFatal: true,
    capturedAt: Date.now(),
  };
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload)).catch(() => {});
}

export function formatBootErrorForDisplay(err: PersistedBootError): string {
  const ago = Math.floor((Date.now() - err.capturedAt) / 1000);
  const head = `Last launch ${err.isFatal ? "crashed" : "errored"} ${ago}s ago:`;
  const stackLine = (err.stack || "").split("\n").slice(0, 4).join("\n");
  return `${head}\n${err.message}\n${stackLine}`;
}
