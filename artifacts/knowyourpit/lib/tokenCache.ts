import * as SecureStore from "expo-secure-store";

interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
}

const KEYCHAIN_TIMEOUT_MS = 3000;

class KeychainTimeoutError extends Error {
  constructor(op: string, key: string) {
    super(`SecureStore.${op}('${key}') timed out after ${KEYCHAIN_TIMEOUT_MS}ms`);
    this.name = "KeychainTimeoutError";
  }
}

function withTimeout<T>(op: string, key: string, p: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new KeychainTimeoutError(op, key));
    }, KEYCHAIN_TIMEOUT_MS);
    p.then(
      (v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

export const safeTokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    try {
      const v = await withTimeout("getItemAsync", key, SecureStore.getItemAsync(key));
      return v ?? null;
    } catch {
      return null;
    }
  },
  async saveToken(key: string, value: string): Promise<void> {
    try {
      await withTimeout("setItemAsync", key, SecureStore.setItemAsync(key, value));
    } catch {
      // Best-effort persistence: swallow timeout/error so a hung keychain
      // never blocks the auth flow. Token will be re-fetched on the next launch.
    }
  },
  async clearToken(key: string): Promise<void> {
    try {
      await withTimeout("deleteItemAsync", key, SecureStore.deleteItemAsync(key));
    } catch {
      // Best-effort deletion.
    }
  },
};
