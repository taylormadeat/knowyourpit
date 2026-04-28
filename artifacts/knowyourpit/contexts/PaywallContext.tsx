import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { PaywallModal, type PaywallTrigger } from "@/components/PaywallModal";

interface ShowOptions {
  trigger?: PaywallTrigger;
  subtitle?: string | null;
  featureName?: string | null;
}

interface PaywallContextValue {
  showPaywall: (opts?: ShowOptions) => void;
  hidePaywall: () => void;
  parseAndShowFromError: (err: unknown) => boolean;
}

const PaywallContext = createContext<PaywallContextValue | null>(null);

const ERROR_CODE_TO_TRIGGER: Record<string, PaywallTrigger> = {
  cook_limit_reached: "cook_limit_reached",
  active_cook_limit_reached: "active_cook_limit_reached",
  planned_cook_limit_reached: "planned_cook_limit_reached",
  ai_message_limit_reached: "ai_message_limit_reached",
  ai_analyze_limit_reached: "ai_analyze_limit_reached",
  pro_required: "pro_required",
};

const FEATURE_LABELS: Record<string, string> = {
  multi_cook: "Multi-Cook Sequencer",
  home_insights: "AI Home Insights",
  meater_link: "MEATER Connection",
  thermoworks_link: "ThermoWorks Connection",
  cook_quality: "Cook Quality Analytics",
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
  const [opts, setOpts] = useState<ShowOptions>({});

  const showPaywall = useCallback((next?: ShowOptions) => {
    setOpts(next ?? {});
    setVisible(true);
  }, []);

  const hidePaywall = useCallback(() => setVisible(false), []);

  const parseAndShowFromError = useCallback(
    (err: unknown): boolean => {
      const payload = extractPaywallPayload(err);
      if (!payload) return false;
      const trigger = ERROR_CODE_TO_TRIGGER[payload.code] ?? "pro_required";
      const featureName = payload.feature ? FEATURE_LABELS[payload.feature] ?? null : null;
      showPaywall({ trigger, subtitle: payload.message ?? null, featureName });
      return true;
    },
    [showPaywall],
  );

  const value = useMemo<PaywallContextValue>(
    () => ({ showPaywall, hidePaywall, parseAndShowFromError }),
    [showPaywall, hidePaywall, parseAndShowFromError],
  );

  return (
    <PaywallContext.Provider value={value}>
      {children}
      <PaywallModal
        visible={visible}
        onClose={hidePaywall}
        trigger={opts.trigger ?? null}
        subtitle={opts.subtitle ?? null}
        featureName={opts.featureName ?? null}
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
