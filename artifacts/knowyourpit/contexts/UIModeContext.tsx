import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type UIMode = "legacy" | "preview";

interface UIModeContextValue {
  mode: UIMode;
  setMode: (mode: UIMode) => void;
  isHydrated: boolean;
}

const UIModeContext = createContext<UIModeContextValue | null>(null);

const UI_MODE_STORAGE_KEY = "knowyourpit:ui_mode";
export const UI_MODE_HYDRATION_TIMEOUT_MS = 1_500;

export function UIModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<UIMode>("legacy");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const finishHydration = (storedMode: string | null) => {
      if (cancelled || settled) return;
      settled = true;
      clearTimeout(timeoutId);
      setModeState(storedMode === "preview" ? "preview" : "legacy");
      setIsHydrated(true);
    };

    timeoutId = setTimeout(
      () => finishHydration("legacy"),
      UI_MODE_HYDRATION_TIMEOUT_MS,
    );

    AsyncStorage.getItem(UI_MODE_STORAGE_KEY)
      .then(finishHydration)
      .catch(() => finishHydration("legacy"));

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  const setMode = useCallback((newMode: UIMode) => {
    setModeState(newMode);
    AsyncStorage.setItem(UI_MODE_STORAGE_KEY, newMode).catch(() => {});
  }, []);

  const value = useMemo(() => ({ mode, setMode, isHydrated }), [mode, setMode, isHydrated]);

  if (!isHydrated) return null;

  return <UIModeContext.Provider value={value}>{children}</UIModeContext.Provider>;
}

export function useUIMode() {
  const context = useContext(UIModeContext);
  if (!context) {
    throw new Error("useUIMode must be used within a UIModeProvider");
  }
  return context;
}
