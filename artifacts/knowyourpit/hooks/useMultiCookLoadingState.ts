/**
 * useMultiCookLoadingState
 *
 * Manages the loading, retrying, and error states for the Multi-Cook Sequencer
 * modal on the Plan screen.
 *
 * The critical invariant:
 *   `openMultiCookModal()` MUST be called synchronously before any `await` in
 *   `handleMultiCook` so React Native can paint the loading modal on the same
 *   animation frame as the user's tap.  Regressions (e.g. inserting an async
 *   call before the state setters) would cause the button to appear to do
 *   nothing on a stalled connection.
 *
 * State machine summary:
 *
 *   Tap           → openMultiCookModal()   → open=true, streaming=true, retrying=false, error=false, result=null
 *   Success       → setMultiResult(data)   → streaming=false, retrying=false  (modal stays open to show results)
 *   First failure → startMultiCookRetry()  → retrying=true, result=null       (auto-retry in progress)
 *   Both fail     → setMultiErrorState()   → error=true, streaming=false, retrying=false (in-modal Retry button)
 *   Fatal 401/402 → closeMultiCookModal()  → open=false, streaming=false, retrying=false
 *
 * Usage in plan.tsx:
 *
 *   const {
 *     multiResult, setMultiResult,
 *     multiResultOpen, setMultiResultOpen,
 *     multiStreaming, setMultiStreaming,
 *     multiRetrying, setMultiRetrying,
 *     multiError, setMultiError,
 *     openMultiCookModal,
 *     closeMultiCookModal,
 *     startMultiCookRetry,
 *     setMultiErrorState,
 *   } = useMultiCookLoadingState();
 */

import { useState, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface MultiCookLoadingState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  multiResult: any | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setMultiResult: (v: any | null) => void;
  multiResultOpen: boolean;
  setMultiResultOpen: (v: boolean) => void;
  multiStreaming: boolean;
  setMultiStreaming: (v: boolean) => void;
  multiRetrying: boolean;
  setMultiRetrying: (v: boolean) => void;
  multiError: boolean;
  setMultiError: (v: boolean) => void;
  /**
   * Call synchronously at the very top of handleMultiCook (before any await)
   * to open the loading modal on the same frame as the user's tap.
   * Resets result, error, and retrying so the modal shows a clean loading skeleton.
   */
  openMultiCookModal: () => void;
  /**
   * Closes the modal and clears streaming/retrying flags.
   * Call on fatal 401/402, catch-all errors, or unmount cleanup.
   */
  closeMultiCookModal: () => void;
  /**
   * Call when the first fetch attempt fails and an automatic retry is about
   * to begin. Sets retrying=true and clears any partial result so the modal
   * shows the retrying skeleton instead of stale data.
   */
  startMultiCookRetry: () => void;
  /**
   * Call when both the initial attempt and the auto-retry have failed.
   * Sets error=true and clears streaming/retrying so the modal surfaces the
   * in-modal Retry button.
   */
  setMultiErrorState: () => void;
}

export function useMultiCookLoadingState(): MultiCookLoadingState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [multiResult, setMultiResult] = useState<any | null>(null);
  const [multiResultOpen, setMultiResultOpen] = useState(false);
  const [multiStreaming, setMultiStreaming] = useState(false);
  const [multiRetrying, setMultiRetrying] = useState(false);
  const [multiError, setMultiError] = useState(false);

  const openMultiCookModal = useCallback(() => {
    setMultiResult(null);
    setMultiResultOpen(true);
    setMultiStreaming(true);
    setMultiRetrying(false);
    setMultiError(false);
  }, []);

  const closeMultiCookModal = useCallback(() => {
    setMultiStreaming(false);
    setMultiRetrying(false);
    setMultiResultOpen(false);
  }, []);

  const startMultiCookRetry = useCallback(() => {
    setMultiRetrying(true);
    setMultiResult(null);
  }, []);

  const setMultiErrorState = useCallback(() => {
    setMultiStreaming(false);
    setMultiRetrying(false);
    setMultiError(true);
  }, []);

  return {
    multiResult,
    setMultiResult,
    multiResultOpen,
    setMultiResultOpen,
    multiStreaming,
    setMultiStreaming,
    multiRetrying,
    setMultiRetrying,
    multiError,
    setMultiError,
    openMultiCookModal,
    closeMultiCookModal,
    startMultiCookRetry,
    setMultiErrorState,
  };
}
