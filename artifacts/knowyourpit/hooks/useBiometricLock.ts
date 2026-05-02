import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";

const ENABLED_KEY = "knowyourpit:biometricLock:enabled";
const PROMPTED_KEY = "knowyourpit:biometricLock:prompted";

export type BiometricSupport =
  | { status: "unknown" }
  | { status: "unsupported"; reason: "noHardware" | "notEnrolled" | "platform" }
  | { status: "available"; types: LocalAuthentication.AuthenticationType[] };

interface BiometricLockState {
  support: BiometricSupport;
  isEnabled: boolean;
  isLocked: boolean;
  isReady: boolean;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  lock: () => void;
  unlock: () => Promise<boolean>;
  hasPromptedFirstTime: boolean;
  markFirstTimePromptShown: () => Promise<void>;
}

async function detectSupport(): Promise<BiometricSupport> {
  if (Platform.OS !== "ios") {
    return { status: "unsupported", reason: "platform" };
  }
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return { status: "unsupported", reason: "noHardware" };
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!enrolled) return { status: "unsupported", reason: "notEnrolled" };
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { status: "available", types };
  } catch {
    return { status: "unsupported", reason: "noHardware" };
  }
}

export function useBiometricLock(): BiometricLockState {
  const [support, setSupport] = useState<BiometricSupport>({ status: "unknown" });
  const [isEnabled, setIsEnabledState] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasPromptedFirstTime, setHasPromptedFirstTime] = useState(true);
  const authInFlight = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function init() {
      const [s, enabledRaw, promptedRaw] = await Promise.all([
        detectSupport(),
        SecureStore.getItemAsync(ENABLED_KEY).catch(() => null),
        SecureStore.getItemAsync(PROMPTED_KEY).catch(() => null),
      ]);
      if (cancelled) return;
      setSupport(s);
      const enabled = enabledRaw === "1" && s.status === "available";
      setIsEnabledState(enabled);
      setHasPromptedFirstTime(promptedRaw === "1");
      // If the user had it enabled, lock immediately on cold boot so the
      // very first frame shows the lock overlay rather than cook data.
      setIsLocked(enabled);
      setIsReady(true);
    }
    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = useCallback(
    async (enabled: boolean): Promise<boolean> => {
      if (enabled && support.status !== "available") return false;
      if (enabled) {
        // Require a successful biometric check to opt in, so the user knows
        // it works on their device before we start gating the app.
        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: "Enable Face ID for knowyourpit",
            fallbackLabel: "Use Passcode",
            cancelLabel: "Cancel",
          });
          if (!result.success) return false;
        } catch {
          return false;
        }
      }
      await SecureStore.setItemAsync(ENABLED_KEY, enabled ? "1" : "0").catch(
        () => {},
      );
      setIsEnabledState(enabled);
      if (!enabled) setIsLocked(false);
      return true;
    },
    [support.status],
  );

  const lock = useCallback(() => {
    if (isEnabled) setIsLocked(true);
  }, [isEnabled]);

  const unlock = useCallback(async (): Promise<boolean> => {
    if (!isLocked) return true;
    if (authInFlight.current) return false;
    authInFlight.current = true;
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock knowyourpit",
        fallbackLabel: "Use Passcode",
        cancelLabel: "Cancel",
        disableDeviceFallback: false,
      });
      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      authInFlight.current = false;
    }
  }, [isLocked]);

  const markFirstTimePromptShown = useCallback(async () => {
    await SecureStore.setItemAsync(PROMPTED_KEY, "1").catch(() => {});
    setHasPromptedFirstTime(true);
  }, []);

  return {
    support,
    isEnabled,
    isLocked,
    isReady,
    setEnabled,
    lock,
    unlock,
    hasPromptedFirstTime,
    markFirstTimePromptShown,
  };
}
