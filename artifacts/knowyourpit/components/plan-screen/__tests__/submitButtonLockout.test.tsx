/**
 * Component / UI test — Plan screen submit-button lock-out during cook creation.
 *
 * Tests the REAL PlanSubmitArea component (exported from the plan-screen
 * component layer that plan.tsx uses). The component contains the actual
 * `disabled={isSubmitting}` expressions from plan.tsx, so an unrelated
 * network mutation cannot trap the local-first CTA in a spinner.
 *
 * What is verified:
 *   1. Both CTAs are enabled on initial render.
 *   2. Pressing a CTA → handler runs (which calls startSubmitting()) → both
 *      buttons become disabled on the same render frame.
 *   3. Buttons re-enable after every exit path:
 *      – success (promise resolves)
 *      – error (promise rejects)
 *      – cancel (Cancel button in slow-submit row / stopSubmitting called)
 *   4. The secondary "Save Cook Plan" button (frozen + Cook-Now path) follows
 *      the same disable rule as the primary.
 *
 * Strategy:
 *   Render PlanSubmitArea inside a thin wrapper that wires usePlanLoadingState
 *   to the component's props. The wrapper's onSubmit mock mirrors handleSubmit's
 *   core contract: call startSubmitting() synchronously, then await async work,
 *   then call stopSubmitting() in the finally block. This lets the test control
 *   the async window via a deferred Promise while asserting on the real button
 *   disabled state.
 */

import React, { useCallback } from "react";
import { render, screen, act, fireEvent } from "@testing-library/react-native";
import { PlanSubmitArea } from "@/components/plan-screen/PlanSubmitArea";
import { usePlanLoadingState } from "@/hooks/usePlanLoadingState";

// ---------------------------------------------------------------------------
// Mocks — keep only what's needed to isolate the component
// ---------------------------------------------------------------------------

// @expo/vector-icons renders native icon fonts that are unavailable in the
// test runtime. Replace with a trivial host-component string so Pressable
// children don't throw when icons are present.
jest.mock("@expo/vector-icons", () => ({
  Feather: "Feather",
}));

// ---------------------------------------------------------------------------
// Shared colours fixture (matches PlanSubmitAreaColors shape)
// ---------------------------------------------------------------------------

const COLORS = {
  primary: "#ff6900",
  mutedForeground: "#888",
  foreground: "#111",
  radius: 8,
};

// ---------------------------------------------------------------------------
// Deferred Promise helper
// ---------------------------------------------------------------------------

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (e: Error) => void;
};

function makeDeferred(): Deferred {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

interface HarnessProps {
  showSavePlan?: boolean;
  /** Set to get the current deferred so the test can resolve / reject it. */
  getDeferredRef?: React.MutableRefObject<Deferred | null>;
  /** Use submitSlow=true in the harness (for slow-row tests). */
  slowSubmit?: boolean;
}

/**
 * Thin wrapper that owns usePlanLoadingState and builds an onSubmit handler
 * whose lifecycle mirrors handleSubmit in plan.tsx:
 *   startSubmitting() → await deferred promise → stopSubmitting() in finally
 *
 * Errors thrown by the deferred are swallowed inside the handler so they
 * don't become unhandled rejections that corrupt subsequent tests; the
 * finally-block stopSubmitting() still fires on every exit path.
 */
function PlanSubmitHarness({
  showSavePlan = false,
  getDeferredRef,
  slowSubmit = false,
}: HarnessProps) {
  const { isSubmitting, startSubmitting, stopSubmitting } = usePlanLoadingState();

  const handleSubmit = useCallback(async () => {
    startSubmitting();
    const deferred = makeDeferred();
    if (getDeferredRef) getDeferredRef.current = deferred;
    try {
      await deferred.promise;
    } catch {
      // Swallow errors — the test asserts on state, not on exception propagation.
      // The finally block below still calls stopSubmitting() on every path.
    } finally {
      stopSubmitting();
    }
  }, [startSubmitting, stopSubmitting, getDeferredRef]);

  // handleSaveFrozenPlan in plan.tsx calls handleSubmit("later") — same lifecycle.
  const handleSavePlan = useCallback(async () => {
    startSubmitting();
    const deferred = makeDeferred();
    if (getDeferredRef) getDeferredRef.current = deferred;
    try {
      await deferred.promise;
    } catch {
      // Swallow — see comment in handleSubmit above.
    } finally {
      stopSubmitting();
    }
  }, [startSubmitting, stopSubmitting, getDeferredRef]);

  return (
    <PlanSubmitArea
      isSubmitting={isSubmitting}
      onSubmit={handleSubmit}
      onSavePlan={handleSavePlan}
      onCancelSubmitWait={stopSubmitting}
      submitLabel="Start Cooking Now"
      showSavePlan={showSavePlan}
      // When slowSubmit=true, mirror how plan.tsx sets submitSlow only while
      // isSubmitting is true (the watchdog fires after ~6 s in production).
      submitSlow={slowSubmit && isSubmitting}
      colors={COLORS}
    />
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true when a Pressable is disabled (reads accessibilityState). */
function isDisabled(el: ReturnType<typeof screen.getByTestId>): boolean {
  return el.props.accessibilityState?.disabled === true;
}

// ---------------------------------------------------------------------------
// Tests — Primary "Start Cooking Now" button
// ---------------------------------------------------------------------------

describe("Primary submit button (Start Cooking Now)", () => {
  it("renders enabled before any cook creation begins", () => {
    render(<PlanSubmitHarness />);
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });

  it("becomes disabled immediately when pressed (synchronous lock on same frame)", async () => {
    render(<PlanSubmitHarness />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });

    // The button must be disabled synchronously — before the deferred promise
    // resolves — so no double-tap can enter handleSubmit mid-flight.
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);
  });

  it("shows the spinner (submit-spinner) while locked", async () => {
    render(<PlanSubmitHarness />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });

    expect(screen.queryByTestId("submit-spinner")).not.toBeNull();
  });

  it("re-enables after successful cook creation (deferred resolves)", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);

    // Simulate cook creation succeeding
    await act(async () => {
      getDeferredRef.current!.resolve();
    });

    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });

  it("re-enables after a cook-creation error (deferred rejects)", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);

    // Simulate a network/server error.
    // The harness swallows the rejection inside handleSubmit so that
    // stopSubmitting() still fires and no unhandled rejection leaks.
    await act(async () => {
      getDeferredRef.current!.reject(new Error("network error"));
    });

    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });

  it("re-enables after the user cancels via resolve (cancel path)", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);

    // In plan.tsx, cancelSubmitWait() resolves the pending request and calls
    // stopSubmitting(). Here we simulate that by resolving the deferred.
    await act(async () => {
      getDeferredRef.current!.resolve();
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });

  it("remains locked throughout the entire pending window", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });

    // Still pending — no resolve/reject — button must stay locked
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);

    // Clean up so the pending async handler doesn't leak into the next test
    await act(async () => {
      getDeferredRef.current!.resolve();
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });

  it("allows a second cook creation after the first one completes", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness getDeferredRef={getDeferredRef} />);

    // First cook
    await act(async () => { fireEvent.press(screen.getByTestId("submit-cook-btn")); });
    await act(async () => { getDeferredRef.current!.resolve(); });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);

    // Second cook — button must lock again on the next tap
    await act(async () => { fireEvent.press(screen.getByTestId("submit-cook-btn")); });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);

    await act(async () => { getDeferredRef.current!.resolve(); });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Tests — Secondary "Save Cook Plan" button (frozen + Cook-Now path)
// ---------------------------------------------------------------------------

describe("Secondary 'Save Cook Plan' button (frozen + Cook-Now path)", () => {
  it("renders enabled before any cook creation begins", () => {
    render(<PlanSubmitHarness showSavePlan />);
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(false);
  });

  it("becomes disabled when the primary CTA is pressed", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness showSavePlan getDeferredRef={getDeferredRef} />);

    // Pressing the primary button calls startSubmitting() → both buttons lock
    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });

    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(true);
    await act(async () => { getDeferredRef.current!.resolve(); });
  });

  it("becomes disabled when tapped directly", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness showSavePlan getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-cook-plan-btn"));
    });

    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(true);
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);
    await act(async () => { getDeferredRef.current!.resolve(); });
  });

  it("re-enables after successful cook creation", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness showSavePlan getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-cook-plan-btn"));
    });
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(true);

    await act(async () => { getDeferredRef.current!.resolve(); });
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(false);
  });

  it("re-enables after a cook-creation error", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness showSavePlan getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("save-cook-plan-btn"));
    });
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(true);

    await act(async () => {
      getDeferredRef.current!.reject(new Error("server error"));
    });

    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(false);
  });

  it("both buttons lock and unlock atomically from the same state", async () => {
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness showSavePlan getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });

    // Both must be locked in the same render batch
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(true);

    await act(async () => { getDeferredRef.current!.resolve(); });

    // Both must unlock in the same render batch
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);
    expect(isDisabled(screen.getByTestId("save-cook-plan-btn"))).toBe(false);
  });

});

// ---------------------------------------------------------------------------
// Tests — Slow-submit watchdog Cancel button
// ---------------------------------------------------------------------------

describe("Slow-submit watchdog row Cancel button", () => {
  it("Cancel re-enables the submit button (calls onCancelSubmitWait → stopSubmitting)", async () => {
    // slowSubmit=true makes the harness set submitSlow=isSubmitting, so the
    // watchdog row becomes visible as soon as isSubmitting becomes true.
    const getDeferredRef = { current: null as Deferred | null };
    render(<PlanSubmitHarness slowSubmit getDeferredRef={getDeferredRef} />);

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-cook-btn"));
    });
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(true);
    // Watchdog row must be visible (submitSlow && isSubmitting === true)
    expect(screen.queryByTestId("submit-slow-row")).not.toBeNull();

    // User presses Cancel — calls onCancelSubmitWait → stopSubmitting()
    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-slow-cancel"));
    });

    // Button re-enables after cancel
    expect(isDisabled(screen.getByTestId("submit-cook-btn"))).toBe(false);

    // The background deferred is still pending after cancel (mirroring how
    // plan.tsx's cancel only unlocks the UI, not the actual network request).
    // Resolve it so no unhandled-promise warning is emitted after the test.
    await act(async () => { getDeferredRef.current!.resolve(); });
  });
});
