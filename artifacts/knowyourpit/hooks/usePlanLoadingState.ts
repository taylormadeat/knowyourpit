/**
 * usePlanLoadingState
 *
 * Manages the two "immediate visual feedback" states on the Plan screen:
 *
 *   1. AI-plan modal  — aiResultOpen / aiStreaming
 *   2. Submit button  — isSubmitting
 *
 * Both setters MUST be called synchronously before any `await` in the handler
 * so React Native can paint the loading UI on the same frame as the tap.
 * Extracting them into this hook makes that contract explicit and testable.
 *
 * Usage in plan.tsx:
 *
 *   const {
 *     aiResult, setAiResult,
 *     aiResultOpen, setAiResultOpen,
 *     aiStreaming, setAiStreaming,
 *     isSubmitting, setIsSubmitting,
 *     openAiPlanModal,
 *     closeAiPlanModal,
 *     startSubmitting,
 *     stopSubmitting,
 *   } = usePlanLoadingState();
 */

import { useState, useCallback } from "react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface PlanLoadingState {
  aiResult: any | null;
  setAiResult: (v: any | null) => void;
  aiResultOpen: boolean;
  setAiResultOpen: (v: boolean) => void;
  aiStreaming: boolean;
  setAiStreaming: (v: boolean) => void;
  isSubmitting: boolean;
  setIsSubmitting: (v: boolean) => void;
  /**
   * Call this synchronously at the very top of handleAiPlan (before any
   * await) to open the loading modal on the same frame as the user's tap.
   * Resets any previous AI result so the modal shows the loading skeleton.
   */
  openAiPlanModal: () => void;
  /**
   * Dismisses the AI plan modal and clears the streaming flag.
   * Safe to call from any cleanup path (error, abort, session-expired).
   */
  closeAiPlanModal: () => void;
  /**
   * Call this synchronously at the very top of handleSubmit (before any
   * await) so the button disables and the spinner appears on the same frame
   * as the user's tap — preventing duplicate taps and giving instant feedback.
   */
  startSubmitting: () => void;
  /**
   * Clears the submitting state. Must be called in the finally block of
   * handleSubmit so the button re-enables on every exit path.
   */
  stopSubmitting: () => void;
}

export function usePlanLoadingState(): PlanLoadingState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiResultOpen, setAiResultOpen] = useState(false);
  const [aiStreaming, setAiStreaming] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openAiPlanModal = useCallback(() => {
    setAiResult(null);
    setAiResultOpen(true);
    setAiStreaming(true);
  }, []);

  const closeAiPlanModal = useCallback(() => {
    setAiStreaming(false);
    setAiResultOpen(false);
  }, []);

  const startSubmitting = useCallback(() => {
    setIsSubmitting(true);
  }, []);

  const stopSubmitting = useCallback(() => {
    setIsSubmitting(false);
  }, []);

  return {
    aiResult,
    setAiResult,
    aiResultOpen,
    setAiResultOpen,
    aiStreaming,
    setAiStreaming,
    isSubmitting,
    setIsSubmitting,
    openAiPlanModal,
    closeAiPlanModal,
    startSubmitting,
    stopSubmitting,
  };
}
