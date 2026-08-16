/**
 * Shared AsyncStorage helpers for technique quick-pick persistence.
 *
 * Each helper persists the user's last selection for a given meat cut so the
 * choice survives app restarts.  On load, an unrecognised (stale) value is
 * discarded and null is returned — the caller must fall back to
 * getPitmasterDefaults in that case.
 *
 * Storage keys mirror the constants declared here so tests can assert against
 * the exact keys without relying on implementation details buried in component
 * files.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  QP_COOK_METHODS,
  QP_INJECTION_OPTIONS,
  QP_MEAT_START_TEMPS,
  QP_SPRITZ_FREQUENCIES,
  QP_WRAP_FINISH_OPTIONS,
  type QpCookMethod,
  type QpInjectionOption,
  type QpMeatStartTemp,
  type QpSpritzFrequency,
  type QpWrapFinishOption,
} from "@/constants/cookQuickPicks";

export const COOK_METHOD_STORAGE_PREFIX = "@knowyourpit:cookMethod:";
export const MEAT_START_TEMP_STORAGE_PREFIX = "@knowyourpit:meatStartTemp:";
export const INJECTION_STORAGE_PREFIX = "@knowyourpit:injection:";
export const SPRITZ_STORAGE_PREFIX = "@knowyourpit:spritz:";
export const WRAP_FINISH_STORAGE_PREFIX = "@knowyourpit:wrapFinish:";

// ── Cook method ───────────────────────────────────────────────────────────────

export async function loadLastCookMethod(cutName: string): Promise<QpCookMethod | null> {
  try {
    const stored = await AsyncStorage.getItem(COOK_METHOD_STORAGE_PREFIX + cutName);
    if (stored && (QP_COOK_METHODS as readonly string[]).includes(stored)) {
      return stored as QpCookMethod;
    }
  } catch {}
  return null;
}

export async function saveLastCookMethod(cutName: string, method: QpCookMethod): Promise<void> {
  try {
    await AsyncStorage.setItem(COOK_METHOD_STORAGE_PREFIX + cutName, method);
  } catch {}
}

// ── Meat start temperature ────────────────────────────────────────────────────

export async function loadLastMeatStartTemp(cutName: string): Promise<QpMeatStartTemp | null> {
  try {
    const stored = await AsyncStorage.getItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName);
    if (stored && (QP_MEAT_START_TEMPS as readonly string[]).includes(stored)) {
      return stored as QpMeatStartTemp;
    }
  } catch {}
  return null;
}

export async function saveLastMeatStartTemp(cutName: string, v: QpMeatStartTemp): Promise<void> {
  try {
    await AsyncStorage.setItem(MEAT_START_TEMP_STORAGE_PREFIX + cutName, v);
  } catch {}
}

// ── Injection ─────────────────────────────────────────────────────────────────

export async function loadLastInjection(cutName: string): Promise<QpInjectionOption | null> {
  try {
    const stored = await AsyncStorage.getItem(INJECTION_STORAGE_PREFIX + cutName);
    if (stored && (QP_INJECTION_OPTIONS as readonly string[]).includes(stored)) {
      return stored as QpInjectionOption;
    }
  } catch {}
  return null;
}

export async function saveLastInjection(cutName: string, v: QpInjectionOption): Promise<void> {
  try {
    await AsyncStorage.setItem(INJECTION_STORAGE_PREFIX + cutName, v);
  } catch {}
}

// ── Spritz frequency ──────────────────────────────────────────────────────────

export async function loadLastSpritz(cutName: string): Promise<QpSpritzFrequency | null> {
  try {
    const stored = await AsyncStorage.getItem(SPRITZ_STORAGE_PREFIX + cutName);
    if (stored && (QP_SPRITZ_FREQUENCIES as readonly string[]).includes(stored)) {
      return stored as QpSpritzFrequency;
    }
  } catch {}
  return null;
}

export async function saveLastSpritz(cutName: string, v: QpSpritzFrequency): Promise<void> {
  try {
    await AsyncStorage.setItem(SPRITZ_STORAGE_PREFIX + cutName, v);
  } catch {}
}

// ── Wrap / finish ─────────────────────────────────────────────────────────────

export async function loadLastWrapFinish(cutName: string): Promise<QpWrapFinishOption | null> {
  try {
    const stored = await AsyncStorage.getItem(WRAP_FINISH_STORAGE_PREFIX + cutName);
    if (stored && (QP_WRAP_FINISH_OPTIONS as readonly string[]).includes(stored)) {
      return stored as QpWrapFinishOption;
    }
  } catch {}
  return null;
}

export async function saveLastWrapFinish(cutName: string, v: QpWrapFinishOption): Promise<void> {
  try {
    await AsyncStorage.setItem(WRAP_FINISH_STORAGE_PREFIX + cutName, v);
  } catch {}
}
