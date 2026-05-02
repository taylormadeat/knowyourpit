import React, { createContext, useContext } from "react";
import { useBiometricLock } from "@/hooks/useBiometricLock";

type BiometricLockContextValue = ReturnType<typeof useBiometricLock>;

const BiometricLockContext = createContext<BiometricLockContextValue | null>(null);

export function BiometricLockProvider({ children }: { children: React.ReactNode }) {
  const value = useBiometricLock();
  return (
    <BiometricLockContext.Provider value={value}>
      {children}
    </BiometricLockContext.Provider>
  );
}

export function useBiometricLockContext(): BiometricLockContextValue {
  const ctx = useContext(BiometricLockContext);
  if (!ctx) {
    throw new Error("useBiometricLockContext must be used inside BiometricLockProvider");
  }
  return ctx;
}
