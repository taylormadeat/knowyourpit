/**
 * Tests for useMultiCookLoadingState — the hook that owns the
 * "immediate visual feedback" contract on the Plan screen's multi-cook
 * sequencer tap flow.
 *
 * The critical invariant under test:
 *   `openMultiCookModal()` sets modal open + streaming ON synchronously
 *   (before any await) inside the handler so React Native can paint the
 *   loading skeleton on the same animation frame as the user's tap.
 *   Regressions (e.g. re-inserting an async call before the state setters)
 *   would cause the button to appear to do nothing on a stalled connection —
 *   the same class of bug that triggered the build #117 hotfix.
 *
 * State machine covered:
 *   Tap           → openMultiCookModal()   → open=true, streaming=true,
 *                                            retrying=false, error=false, result=null
 *   Success       → setMultiResult(data)   → streaming=false, retrying=false
 *                                            (modal stays open for results)
 *   First failure → startMultiCookRetry()  → retrying=true, result=null
 *   Both fail     → setMultiErrorState()   → error=true, streaming=false,
 *                                            retrying=false (in-modal Retry button)
 *   Fatal 401/402 → closeMultiCookModal()  → open=false, streaming=false,
 *                                            retrying=false
 *
 * Strategy:
 *   We test the hook in isolation rather than rendering the full plan.tsx
 *   component (which has 30+ async dependencies). The semantic helpers
 *   (`openMultiCookModal`, `closeMultiCookModal`, `startMultiCookRetry`,
 *   `setMultiErrorState`) are the exact same setters the handler calls —
 *   so testing them directly gives precise coverage of the invariant.
 */

import { renderHook, act } from "@testing-library/react-native";
import { useMultiCookLoadingState } from "../useMultiCookLoadingState";

// ── Initial state ─────────────────────────────────────────────────────────────

describe("initial state", () => {
  it("starts with the modal closed and all flags off", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());
    expect(result.current.multiResultOpen).toBe(false);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiError).toBe(false);
    expect(result.current.multiResult).toBeNull();
  });
});

// ── openMultiCookModal (tap flow) ─────────────────────────────────────────────

describe("openMultiCookModal — synchronous tap flow", () => {
  it("opens the modal and enables streaming synchronously inside act()", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => {
      result.current.openMultiCookModal();
    });

    // Both flags must be true AFTER a single synchronous batch — no awaits
    // between the setter calls and this assertion, which mirrors how the
    // handler sets state before its first `await new Promise(setTimeout)`.
    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
  });

  it("clears retrying and error flags when the modal is opened", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    // Simulate a previous run that left stale error/retrying state
    act(() => { result.current.setMultiRetrying(true); });
    act(() => { result.current.setMultiError(true); });

    act(() => {
      result.current.openMultiCookModal();
    });

    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiError).toBe(false);
  });

  it("clears any previous result when the modal is opened", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => {
      result.current.setMultiResult({ schedule: [], serveAt: "2025-01-01T18:00:00Z", summary: "Done" });
    });
    expect(result.current.multiResult).not.toBeNull();

    act(() => {
      result.current.openMultiCookModal();
    });

    // Stale result must be wiped so the loading skeleton is shown instead of
    // the previous run's data during the new fetch.
    expect(result.current.multiResult).toBeNull();
    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
  });

  it("sets all five state values atomically in a single act()", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    // Pre-populate stale state
    act(() => {
      result.current.setMultiResult({ schedule: [], serveAt: "", summary: "" });
      result.current.setMultiRetrying(true);
      result.current.setMultiError(true);
    });

    act(() => {
      result.current.openMultiCookModal();
    });

    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiError).toBe(false);
    expect(result.current.multiResult).toBeNull();
  });

  it("round-trips open → close → open correctly (retry tap pattern)", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.closeMultiCookModal(); });

    // Second tap (handleRetryMultiCook) must re-open cleanly
    act(() => { result.current.openMultiCookModal(); });

    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
  });
});

// ── closeMultiCookModal (fatal 401/402 and catch-all) ────────────────────────

describe("closeMultiCookModal — fatal-error and catch paths", () => {
  it("closes the modal and clears streaming and retrying", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    expect(result.current.multiResultOpen).toBe(true);

    act(() => { result.current.closeMultiCookModal(); });

    expect(result.current.multiResultOpen).toBe(false);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
  });

  it("leaves error flag unchanged — caller is responsible for clearing it", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.setMultiError(true); });
    act(() => { result.current.closeMultiCookModal(); });

    // closeMultiCookModal is used for fatal 401/402 and catch-all paths;
    // error state is separate and should not be reset here.
    expect(result.current.multiError).toBe(true);
  });

  it("leaves multiResult unchanged — caller decides whether to keep or wipe it", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());
    const mockResult = { schedule: [], serveAt: "", summary: "partial" };

    act(() => { result.current.setMultiResult(mockResult); });
    act(() => { result.current.closeMultiCookModal(); });

    expect(result.current.multiResult).toEqual(mockResult);
  });
});

// ── startMultiCookRetry (auto-retry path) ─────────────────────────────────────

describe("startMultiCookRetry — first failure, auto-retry in progress", () => {
  it("sets retrying=true and clears multiResult", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => {
      result.current.openMultiCookModal();
    });
    act(() => {
      result.current.setMultiResult({ schedule: [], serveAt: "", summary: "partial" });
    });

    act(() => {
      result.current.startMultiCookRetry();
    });

    expect(result.current.multiRetrying).toBe(true);
    expect(result.current.multiResult).toBeNull();
  });

  it("does not change the modal open or streaming flag", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.startMultiCookRetry(); });

    // Modal must stay visible and streaming must stay on while the retry runs
    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
  });

  it("does not set error when starting a retry", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.startMultiCookRetry(); });

    expect(result.current.multiError).toBe(false);
  });
});

// ── setMultiErrorState (both attempts failed) ─────────────────────────────────

describe("setMultiErrorState — both attempts failed, show in-modal Retry button", () => {
  it("sets error=true and clears streaming and retrying", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.startMultiCookRetry(); });

    act(() => {
      result.current.setMultiErrorState();
    });

    expect(result.current.multiError).toBe(true);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
  });

  it("keeps the modal open so the user can tap the in-modal Retry button", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.setMultiErrorState(); });

    expect(result.current.multiResultOpen).toBe(true);
  });

  it("full flow: open → retry → error state transitions", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    // Tap
    act(() => { result.current.openMultiCookModal(); });
    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiError).toBe(false);

    // First fetch failed → auto-retry
    act(() => { result.current.startMultiCookRetry(); });
    expect(result.current.multiRetrying).toBe(true);
    expect(result.current.multiStreaming).toBe(true); // still "loading" during retry
    expect(result.current.multiError).toBe(false);

    // Retry also failed → surface error UI
    act(() => { result.current.setMultiErrorState(); });
    expect(result.current.multiError).toBe(true);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiResultOpen).toBe(true); // modal stays open
  });
});

// ── Successful fetch path ─────────────────────────────────────────────────────

describe("successful fetch path", () => {
  it("stores result and stops streaming while keeping the modal open", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());
    const mockResult = {
      schedule: [{ foodType: "Brisket", startAt: "2025-01-01T14:00:00Z" }],
      serveAt: "2025-01-01T20:00:00Z",
      summary: "Brisket ready at 8 PM",
    };

    act(() => { result.current.openMultiCookModal(); });
    act(() => {
      // Handler calls these after a successful fetch
      result.current.setMultiResult(mockResult);
      result.current.setMultiStreaming(false);
      result.current.setMultiRetrying(false);
    });

    expect(result.current.multiResult).toEqual(mockResult);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiResultOpen).toBe(true); // stays open to show results
    expect(result.current.multiError).toBe(false);
  });

  it("setMultiResult(null) clears the result explicitly", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => {
      result.current.setMultiResult({ schedule: [], serveAt: "", summary: "old" });
    });
    act(() => { result.current.setMultiResult(null); });

    expect(result.current.multiResult).toBeNull();
  });
});

// ── Escape-hatch raw setters ──────────────────────────────────────────────────

describe("raw escape-hatch setters", () => {
  it("setMultiResultOpen can close modal without touching streaming", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.setMultiResultOpen(false); });

    expect(result.current.multiResultOpen).toBe(false);
    expect(result.current.multiStreaming).toBe(true); // unchanged
  });

  it("setMultiStreaming(false) alone does not close the modal", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.setMultiStreaming(false); });

    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiResultOpen).toBe(true); // still open
  });

  it("setMultiError escapes hatch works independently", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.setMultiError(true); });
    expect(result.current.multiError).toBe(true);

    act(() => { result.current.setMultiError(false); });
    expect(result.current.multiError).toBe(false);
  });
});

// ── Double-tap guard (multiCookRunningRef pattern) ───────────────────────────
//
// The guard in handleMultiCook uses a `useRef<boolean>` (multiCookRunningRef)
// to block re-entrant calls between the tap and the first React render pass
// (where `disabled` would normally prevent the second tap).  These tests
// verify the guard logic in isolation — the same pattern the handler uses —
// without mounting the full plan.tsx component.

describe("double-tap ref guard — multiCookRunningRef pattern", () => {
  it("a second call while the first is in-flight is a no-op", async () => {
    const running = { current: false };
    const calls: string[] = [];

    const handler = async () => {
      if (running.current) return;
      running.current = true;
      try {
        calls.push("start");
        // Simulate an async fetch (e.g. AI request)
        await new Promise<void>(resolve => setTimeout(resolve, 10));
        calls.push("end");
      } finally {
        running.current = false;
      }
    };

    // Fire two calls in the same tick — second must be blocked
    const first = handler();
    const second = handler(); // should return immediately

    await Promise.all([first, second]);

    expect(calls).toEqual(["start", "end"]); // only one run
  });

  it("a second call after the first completes is allowed", async () => {
    const running = { current: false };
    const calls: string[] = [];

    const handler = async () => {
      if (running.current) return;
      running.current = true;
      try {
        calls.push("start");
        await new Promise<void>(resolve => setTimeout(resolve, 5));
        calls.push("end");
      } finally {
        running.current = false;
      }
    };

    await handler(); // first run completes
    await handler(); // second run should proceed normally

    expect(calls).toEqual(["start", "end", "start", "end"]);
  });

  it("ref is cleared even when the handler throws", async () => {
    const running = { current: false };

    const handler = async () => {
      if (running.current) return;
      running.current = true;
      try {
        throw new Error("network failure");
      } finally {
        running.current = false;
      }
    };

    await handler().catch(() => {});
    expect(running.current).toBe(false); // must be cleared so next tap works
  });
});

// ── Independence — multi-cook state does not bleed into usePlanLoadingState ───

describe("multi-cook state is self-contained", () => {
  it("all flags start independent (no cross-contamination from other state)", () => {
    const { result } = renderHook(() => useMultiCookLoadingState());

    // Verify every flag starts at the expected zero value
    expect(result.current.multiResultOpen).toBe(false);
    expect(result.current.multiStreaming).toBe(false);
    expect(result.current.multiRetrying).toBe(false);
    expect(result.current.multiError).toBe(false);
    expect(result.current.multiResult).toBeNull();
  });

  it("closeMultiCookModal after an error does not reset multiError", () => {
    // This covers the case where handleRetryMultiCook calls openMultiCookModal
    // which DOES reset error — but closeMultiCookModal (fatal path) should not.
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.setMultiErrorState(); });
    act(() => { result.current.closeMultiCookModal(); }); // fatal 401 during retry

    // modal is gone but the error flag is still up — caller decides what to show
    expect(result.current.multiResultOpen).toBe(false);
    expect(result.current.multiError).toBe(true);
  });

  it("openMultiCookModal after an error resets error so the loading skeleton shows", () => {
    // This is the handleRetryMultiCook path: user taps Retry → openMultiCookModal()
    const { result } = renderHook(() => useMultiCookLoadingState());

    act(() => { result.current.openMultiCookModal(); });
    act(() => { result.current.setMultiErrorState(); });

    // User taps the in-modal Retry button
    act(() => { result.current.openMultiCookModal(); });

    expect(result.current.multiError).toBe(false);
    expect(result.current.multiResultOpen).toBe(true);
    expect(result.current.multiStreaming).toBe(true);
  });
});
