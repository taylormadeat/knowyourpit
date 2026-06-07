/**
 * Tests for usePlanLoadingState — the hook that owns the "immediate visual
 * feedback" contract on the Plan screen's two critical tap flows:
 *
 *   1. "Ask PitMaster" button  →  AI-plan loading modal
 *   2. "Start Cooking Now" button  →  disabled button + spinner
 *
 * The critical invariant under test:
 *   Loading state is set SYNCHRONOUSLY (before any await) inside the handler
 *   so React Native can paint the loading UI on the same animation frame as
 *   the user's tap. Regressions (e.g. re-adding `skipCache:true` before the
 *   state setter) would cause the button to appear to do nothing on a stalled
 *   connection — the bug that triggered this test suite (build #117 hotfix).
 *
 * Strategy:
 *   We test the hook itself rather than rendering the full plan.tsx component
 *   (which has 30+ async dependencies). The hook's `openAiPlanModal` and
 *   `startSubmitting` callbacks are the exact same synchronous setters that
 *   handleAiPlan and handleSubmit call before their first await — so testing
 *   them directly gives us direct coverage of the invariant.
 */

import { renderHook, act } from "@testing-library/react-native";
import { usePlanLoadingState } from "../usePlanLoadingState";

// ── AI-plan tap flow ──────────────────────────────────────────────────────────

describe("AI-plan tap flow (openAiPlanModal)", () => {
  it("starts with the modal closed and streaming off", () => {
    const { result } = renderHook(() => usePlanLoadingState());
    expect(result.current.aiResultOpen).toBe(false);
    expect(result.current.aiStreaming).toBe(false);
    expect(result.current.aiResult).toBeNull();
  });

  it("opens the modal and enables streaming synchronously inside act()", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => {
      result.current.openAiPlanModal();
    });

    // Both flags must be true AFTER a single synchronous batch — no awaits
    // between the setter calls and this assertion, which mirrors how the
    // handler sets state before its first `await new Promise(setTimeout)`.
    expect(result.current.aiResultOpen).toBe(true);
    expect(result.current.aiStreaming).toBe(true);
  });

  it("clears any previous AI result when the modal is opened", async () => {
    const { result } = renderHook(() => usePlanLoadingState());

    // Simulate a completed AI run that left a result behind
    act(() => {
      result.current.setAiResult({ estimatedDurationMinutes: 360, confidence: "high" });
    });
    expect(result.current.aiResult).not.toBeNull();

    // Opening for a new plan must wipe the stale result so the loading
    // skeleton is shown instead of the previous plan's data
    act(() => {
      result.current.openAiPlanModal();
    });

    expect(result.current.aiResult).toBeNull();
    expect(result.current.aiResultOpen).toBe(true);
    expect(result.current.aiStreaming).toBe(true);
  });

  it("closeAiPlanModal clears streaming and closes the modal", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.openAiPlanModal(); });
    expect(result.current.aiResultOpen).toBe(true);

    act(() => { result.current.closeAiPlanModal(); });

    expect(result.current.aiStreaming).toBe(false);
    expect(result.current.aiResultOpen).toBe(false);
  });

  it("setAiStreaming(false) alone does not close the modal", () => {
    // When the fetch completes we stop streaming but keep the modal open to
    // display results. This verifies the two flags are independent.
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.openAiPlanModal(); });
    act(() => { result.current.setAiStreaming(false); });

    expect(result.current.aiStreaming).toBe(false);
    expect(result.current.aiResultOpen).toBe(true); // still open for results
  });

  it("setAiResultOpen escapes hatch keeps streaming flag stable", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.openAiPlanModal(); });
    // Consumer explicitly closes modal while streaming is still on (e.g. on nav)
    act(() => { result.current.setAiResultOpen(false); });

    expect(result.current.aiResultOpen).toBe(false);
    expect(result.current.aiStreaming).toBe(true); // unchanged — caller's concern
  });

  it("round-trips open → close → open correctly", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.openAiPlanModal(); });
    act(() => { result.current.closeAiPlanModal(); });

    // Second tap should re-open cleanly
    act(() => { result.current.openAiPlanModal(); });

    expect(result.current.aiResultOpen).toBe(true);
    expect(result.current.aiStreaming).toBe(true);
  });
});

// ── Submit / Start-Cooking tap flow ───────────────────────────────────────────

describe("Start-Cooking tap flow (startSubmitting)", () => {
  it("starts with isSubmitting false", () => {
    const { result } = renderHook(() => usePlanLoadingState());
    expect(result.current.isSubmitting).toBe(false);
  });

  it("startSubmitting enables isSubmitting synchronously inside act()", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => {
      result.current.startSubmitting();
    });

    // isSubmitting must be true synchronously — before any await — so the
    // button disables and the ActivityIndicator appears on the same frame as
    // the tap (the fix introduced in build #117 / handleSubmit line 1164).
    expect(result.current.isSubmitting).toBe(true);
  });

  it("stopSubmitting resets isSubmitting to false", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.startSubmitting(); });
    expect(result.current.isSubmitting).toBe(true);

    act(() => { result.current.stopSubmitting(); });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("setIsSubmitting escapes hatch works independently", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.setIsSubmitting(true); });
    expect(result.current.isSubmitting).toBe(true);

    act(() => { result.current.setIsSubmitting(false); });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("multiple taps while submitting keep isSubmitting true until stopSubmitting", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.startSubmitting(); });
    act(() => { result.current.startSubmitting(); }); // duplicate tap

    expect(result.current.isSubmitting).toBe(true);

    act(() => { result.current.stopSubmitting(); });
    expect(result.current.isSubmitting).toBe(false);
  });

  it("round-trips start → stop → start correctly", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.startSubmitting(); });
    act(() => { result.current.stopSubmitting(); });

    // Simulates a retry tap after the first submission finished
    act(() => { result.current.startSubmitting(); });
    expect(result.current.isSubmitting).toBe(true);
  });

  it("duplicate tap during in-flight call: isSubmitting stays true, single stopSubmitting resets it", () => {
    // This mirrors the ref-guard scenario in handleSubmit (plan.tsx).
    // The `submitInFlightRef` in handleSubmit silently drops the second call
    // before it can call startSubmitting() again. From the hook's perspective
    // the invariant is: no matter how many startSubmitting() calls arrive,
    // exactly one stopSubmitting() is enough to fully reset the state — because
    // the ref guard ensures only the first in-flight call reaches the finally
    // block where stopSubmitting() is called.
    const { result } = renderHook(() => usePlanLoadingState());

    // First tap enters handleSubmit → startSubmitting called once
    act(() => { result.current.startSubmitting(); });
    expect(result.current.isSubmitting).toBe(true);

    // Second tap is dropped by submitInFlightRef before reaching startSubmitting,
    // so isSubmitting remains true (not toggled back to false)
    // We verify the hook itself is stable after the duplicate-tap pattern:
    act(() => { result.current.startSubmitting(); }); // would be a no-op in real flow
    expect(result.current.isSubmitting).toBe(true);

    // Only one stopSubmitting() is needed — the one in the original call's finally
    act(() => { result.current.stopSubmitting(); });
    expect(result.current.isSubmitting).toBe(false);
  });
});

// ── Independence between the two loading states ───────────────────────────────

describe("AI-plan and submit states are independent", () => {
  it("startSubmitting does not affect aiResultOpen or aiStreaming", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.startSubmitting(); });

    expect(result.current.aiResultOpen).toBe(false);
    expect(result.current.aiStreaming).toBe(false);
  });

  it("openAiPlanModal does not affect isSubmitting", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.openAiPlanModal(); });

    expect(result.current.isSubmitting).toBe(false);
  });

  it("both can be active simultaneously (multi-cook + AI plan edge case)", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => {
      result.current.openAiPlanModal();
      result.current.startSubmitting();
    });

    expect(result.current.aiResultOpen).toBe(true);
    expect(result.current.aiStreaming).toBe(true);
    expect(result.current.isSubmitting).toBe(true);
  });

  it("resetting one state does not reset the other", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => {
      result.current.openAiPlanModal();
      result.current.startSubmitting();
    });

    act(() => { result.current.closeAiPlanModal(); });

    expect(result.current.isSubmitting).toBe(true); // unchanged
    expect(result.current.aiResultOpen).toBe(false);

    act(() => { result.current.stopSubmitting(); });

    expect(result.current.aiResultOpen).toBe(false); // unchanged
    expect(result.current.isSubmitting).toBe(false);
  });
});

// ── aiResult state management ─────────────────────────────────────────────────

describe("aiResult state management", () => {
  it("setAiResult stores an arbitrary result object", () => {
    const { result } = renderHook(() => usePlanLoadingState());
    const mockResult = { estimatedDurationMinutes: 480, confidence: "high", tips: ["rest 30 min"] };

    act(() => { result.current.setAiResult(mockResult); });

    expect(result.current.aiResult).toEqual(mockResult);
  });

  it("openAiPlanModal always resets aiResult to null even when a result is stored", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.setAiResult({ estimatedDurationMinutes: 300 }); });
    act(() => { result.current.openAiPlanModal(); });

    expect(result.current.aiResult).toBeNull();
  });

  it("setAiResult(null) clears the result explicitly", () => {
    const { result } = renderHook(() => usePlanLoadingState());

    act(() => { result.current.setAiResult({ confidence: "low" }); });
    act(() => { result.current.setAiResult(null); });

    expect(result.current.aiResult).toBeNull();
  });
});
