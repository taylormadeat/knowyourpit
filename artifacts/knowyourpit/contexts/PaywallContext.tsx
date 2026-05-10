import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { PaywallModal, type PaywallTrigger } from "@/components/PaywallModal";

export interface ShowOptions {
  trigger?: PaywallTrigger;
  subtitle?: string | null;
  featureName?: string | null;
  /** Optional food type (e.g. "brisket", "ribs") for personalized headlines. */
  foodType?: string | null;
  /** Optional context label (e.g. "after first scan", "cook #4") for sub-copy nudges. */
  featureContext?: string | null;
}

/** Optional overrides layered on top of error-derived paywall options. */
type ParseExtras = Pick<ShowOptions, "foodType" | "featureContext">;

interface PaywallContextValue {
  showPaywall: (opts?: ShowOptions) => void;
  hidePaywall: () => void;
  /**
   * Temporarily hide the paywall without clearing its state (e.g. while
   * navigating to the Pro showcase screen). The modal stays mounted so
   * `resumePaywall` can restore it instantly without losing the trigger context.
   */
  pausePaywall: () => void;
  /**
   * Restore the paywall after a `pausePaywall` call (e.g. when the user
   * navigates back from the showcase or taps "Unlock Pro").
   */
  resumePaywall: () => void;
  /** True while the modal is visible but temporarily hidden via `pausePaywall`. */
  isPaywallPaused: boolean;
  /**
   * Parse a paywall payload out of an HTTP error and open the modal in a single
   * call. Pass `extras` to layer foodType/featureContext personalization on top
   * of the server-derived trigger/subtitle without losing the original message.
   * Returns true when the error was recognized as a paywall payload.
   */
  parseAndShowFromError: (err: unknown, extras?: ParseExtras) => boolean;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

const ERROR_CODE_TO_TRIGGER: Record<string, PaywallTrigger> = {
  cook_limit_reached: "cook_limit_reached",
  active_cook_limit_reached: "active_cook_limit_reached",
  planned_cook_limit_reached: "planned_cook_limit_reached",
  ai_message_limit_reached: "ai_message_limit_reached",
  ai_analyze_limit_reached: "ai_analyze_limit_reached",
  frozen_timeline_limit_reached: "frozen_timeline_limit_reached",
  pro_required: "pro_required",
};

const FEATURE_LABELS: Record<string, string> = {
  multi_cook: "Multi-Cook Sequencer",
  home_insights: "AI Home Insights",
  meater_link: "MEATER Connection",
  thermoworks_link: "ThermoWorks Connection",
  cook_quality: "Cook Quality Analytics",
  frozen_timeline: "Frozen-to-Table Timeline",
};

function extractPaywallPayload(err: any): { code: string; message?: string; feature?: string } | null {
  if (!err || typeof err !== "object") return null;

  const status =
    err.status ?? err.statusCode ?? err.response?.status ?? err.cause?.status ?? null;
  const data =
    err.data ?? err.response?.data ?? err.body ?? err.cause?.data ?? null;

  if (status === 402 && data && typeof data === "object" && typeof data.error === "string") {
    return { code: data.error, message: data.message, feature: data.feature };
  }

  if (typeof err.message === "string" && err.message.includes('"error"')) {
    try {
      const parsed = JSON.parse(err.message);
      if (parsed && typeof parsed.error === "string") {
        return { code: parsed.error, message: parsed.message, feature: parsed.feature };
      }
    } catch {}
  }
  return null;
}

export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [paused, setPaused] = useState(false);
  const [opts, setOpts] = useState<ShowOptions>({});

  const showPaywall = useCallback((next?: ShowOptions) => {
    setOpts(next ?? {});
    setVisible(true);
    setPaused(false);
  }, []);

  const hidePaywall = useCallback(() => {
    setVisible(false);
    setPaused(false);
  }, []);

  const pausePaywall = useCallback(() => setPaused(true), []);
  const resumePaywall = useCallback(() => setPaused(false), []);

  const parseAndShowFromError = useCallback(
    (err: unknown, extras?: ParseExtras): boolean => {
      const payload = extractPaywallPayload(err);
      if (!payload) return false;
      const trigger = ERROR_CODE_TO_TRIGGER[payload.code] ?? "pro_required";
      const featureName = payload.feature ? FEATURE_LABELS[payload.feature] ?? null : null;
      showPaywall({
        trigger,
        subtitle: payload.message ?? null,
        featureName,
        foodType: extras?.foodType ?? null,
        featureContext: extras?.featureContext ?? null,
      });
      return true;
    },
    [showPaywall],
  );

  const value = useMemo<PaywallContextValue>(
    () => ({ showPaywall, hidePaywall, pausePaywall, resumePaywall, isPaywallPaused: paused, parseAndShowFromError }),
    [showPaywall, hidePaywall, pausePaywall, resumePaywall, paused, parseAndShowFromError],
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallModal
        visible={visible && !paused}
        onClose={hidePaywall}
        onPause={pausePaywall}
        trigger={opts.trigger ?? null}
        subtitle={opts.subtitle ?? null}
        featureName={opts.featureName ?? null}
        foodType={opts.foodType ?? null}
        featureContext={opts.featureContext ?? null}
      />
    </PaywallContext.Provider>
  );
}

export function usePaywall(): PaywallContextValue {
  const ctx = useContext(PaywallContext);
  if (!ctx) {
    throw new Error("usePaywall must be used inside <PaywallProvider>");
  }
  return ctx;
}
