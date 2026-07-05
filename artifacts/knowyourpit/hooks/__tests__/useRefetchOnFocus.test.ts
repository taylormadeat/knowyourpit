/**
 * Regression coverage for the "saving a planned cook doesn't show up until a
 * manual pull-to-refresh" bug.
 *
 * Root cause: React Navigation keeps tab screens (Cook Log, Home dashboard)
 * mounted-but-inactive while they aren't focused. A background
 * `invalidateQueries()` fired by the Plan screen right before `router.push()`
 * can race the focus transition, so the destination screen can render with
 * stale data until the user manually pulls to refresh.
 *
 * The fix: `useRefetchOnFocus` forces every subscribed query to refetch each
 * time its screen regains focus, independent of invalidateQueries timing.
 * This test verifies the two invariants that make the fix correct:
 *   1. The very first focus (initial mount) does NOT trigger an extra
 *      refetch — the query's own initial fetch already covers it.
 *   2. Every focus after that DOES trigger a refetch of every provided
 *      function, which is what makes newly-saved cooks appear immediately.
 */

let focusCallback: (() => void) | undefined;

jest.mock("expo-router", () => ({
  useFocusEffect: (cb: () => void) => {
    focusCallback = cb;
  },
}));

import { renderHook } from "@testing-library/react-native";
import { useRefetchOnFocus } from "../useRefetchOnFocus";

describe("useRefetchOnFocus", () => {
  beforeEach(() => {
    focusCallback = undefined;
  });

  it("skips the initial focus so it doesn't double-fetch alongside the query's own initial load", () => {
    const refetch = jest.fn();
    renderHook(() => useRefetchOnFocus(refetch));

    focusCallback?.();

    expect(refetch).not.toHaveBeenCalled();
  });

  it("refetches on every focus after the initial one — e.g. navigating back to Cook Log after saving a planned cook", () => {
    const refetch = jest.fn();
    renderHook(() => useRefetchOnFocus(refetch));

    focusCallback?.(); // initial mount focus — skipped
    focusCallback?.(); // navigated back to this screen — must refetch
    expect(refetch).toHaveBeenCalledTimes(1);

    focusCallback?.(); // navigated back again — must refetch again
    expect(refetch).toHaveBeenCalledTimes(2);
  });

  it("refetches every provided function, so dashboard/recent-cooks/home-insights widgets all stay in sync", () => {
    const refetchSummary = jest.fn();
    const refetchRecentCooks = jest.fn();
    const refetchInsights = jest.fn();
    renderHook(() =>
      useRefetchOnFocus(refetchSummary, refetchRecentCooks, refetchInsights),
    );

    focusCallback?.(); // initial mount — skipped
    focusCallback?.(); // regains focus

    expect(refetchSummary).toHaveBeenCalledTimes(1);
    expect(refetchRecentCooks).toHaveBeenCalledTimes(1);
    expect(refetchInsights).toHaveBeenCalledTimes(1);
  });
});
