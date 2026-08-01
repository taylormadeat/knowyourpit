import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/**
 * Forces the given refetch function(s) to run every time the screen regains
 * focus (e.g. navigating back to a tab), skipping the very first focus so we
 * don't double-fetch alongside each query's own initial fetch.
 *
 * React Navigation keeps tab screens mounted-but-inactive while they are not
 * focused. A background `invalidateQueries()` fired by another screen right
 * before navigation can race the focus transition, leaving stale data on
 * screen until the user manually pulls to refresh. Explicitly refetching on
 * focus closes that race regardless of query "active observer" timing.
 *
 * Overloads:
 *   useRefetchOnFocus(...refetchFns)
 *   useRefetchOnFocus(enabled, ...refetchFns)
 *
 * When `enabled` is provided and false, focus-triggered refetches are skipped
 * (e.g. while the auth token is still settling on cold start).
 */
export function useRefetchOnFocus(enabled: boolean, ...refetchFns: Array<() => unknown>): void;
export function useRefetchOnFocus(...refetchFns: Array<() => unknown>): void;
export function useRefetchOnFocus(
  enabledOrFirst: boolean | (() => unknown),
  ...rest: Array<() => unknown>
): void {
  const enabled = typeof enabledOrFirst === "boolean" ? enabledOrFirst : true;
  const refetchFns: Array<() => unknown> =
    typeof enabledOrFirst === "boolean" ? rest : [enabledOrFirst, ...rest];

  const mountedRef = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (!mountedRef.current) {
        mountedRef.current = true;
        return;
      }
      if (!enabled) return;
      for (const refetch of refetchFns) {
        refetch();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, ...refetchFns]),
  );
}
