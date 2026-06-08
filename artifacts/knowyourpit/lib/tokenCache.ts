import * as SecureStore from "expo-secure-store";
import { mark } from "./bootBreadcrumbs";
import { getStaySignedIn } from "./staySignedIn";

export interface TokenCache {
  getToken: (key: string) => Promise<string | null>;
  saveToken: (key: string, value: string) => Promise<void>;
  clearToken?: (key: string) => Promise<void>;
}

// Increased from 3 000 ms: iOS SecureStore can be legitimately slow for
// 1–4 seconds after the device wakes from background
// (kSecAttrAccessibleAfterFirstUnlock items need the Secure Enclave to finish
// unlocking). 8 s covers that window while still leaving headroom before the
// 12-second global escape hatch fires.
const KEYCHAIN_TIMEOUT_MS = 8000;

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

// In-memory cache for keychain reads. Concurrent reads for the same key share
// an in-flight Promise (inflightReads) so a slow keychain never causes multiple
// stacked timeouts.
//
// Memory cache semantics:
// - getToken: returns the cached value when present; otherwise reads SecureStore
//   once and caches the result. On timeout/error, null is returned for THIS call
//   but NOT written into memCache — the next getToken() call will retry
//   SecureStore from scratch. This is the key fix for "random sign-outs":
//   iOS SecureStore latency at boot is transient; caching null permanently
//   evicted valid tokens from the in-process cache for the rest of the session.
// - saveToken: updates memory immediately, then checks the "stay signed in"
//   preference at write time. If ON (default), the token is persisted to
//   SecureStore so it survives cold launches. If OFF, the token is memory-only
//   for this session — a cold relaunch requires signing in again.
// - clearToken: clears memory immediately, then deletes from SecureStore
//   best-effort.
const memCache = new Map<string, string | null>();
const inflightReads = new Map<string, Promise<string | null>>();

async function readWithCache(key: string): Promise<string | null> {
  if (memCache.has(key)) {
    return memCache.get(key) ?? null;
  }
  const existing = inflightReads.get(key);
  if (existing) return existing;

  const startedAt = Date.now();
  mark("kc.read.start", key);
  const p = (async () => {
    try {
      const v = await withTimeout("getItemAsync", key, SecureStore.getItemAsync(key));
      const result = v ?? null;
      memCache.set(key, result);
      mark("kc.read.end", `${key} → ${result ? "hit" : "miss"} (${Date.now() - startedAt}ms)`);
      return result;
    } catch (err) {
      // Do NOT cache null. Timeout/error is often transient (iOS Secure Enclave
      // settling after backgrounding). Caching null would permanently sign the
      // user out for the whole session even though their token is in the keychain.
      // The next getToken() call retries SecureStore. Concurrent retries are
      // collapsed by inflightReads above, so a slow keychain doesn't multiply.
      const msg = err instanceof Error ? err.message : String(err);
      mark("kc.read.fail", `${key} → ${msg.slice(0, 60)} (${Date.now() - startedAt}ms)`);
      return null;
    } finally {
      inflightReads.delete(key);
    }
  })();
  inflightReads.set(key, p);
  return p;
}

// The single token cache used for all sessions.
//
// getToken always reads from SecureStore so existing sessions survive a cold
// launch regardless of the "stay signed in" setting.
//
// saveToken checks the "stay signed in" preference at the moment of sign-in:
// - ON (default): token written to SecureStore → session persists across cold launches.
// - OFF: token kept in memory only → session ends when the app process is torn down.
//
// This preference-at-write-time design means the user's toggle choice on the
// sign-in screen takes effect for that sign-in regardless of when the app was
// launched or when ClerkProvider was mounted. It avoids a boot-time race where
// the preference would have to be known before the first React render.
export const safeTokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    return readWithCache(key);
  },
  async saveToken(key: string, value: string): Promise<void> {
    // Update memory first so the very next getToken() (which Clerk fires
    // immediately after a successful sign-in to attach the new bearer to
    // subsequent requests) returns the fresh token without waiting on the keychain.
    memCache.set(key, value);
    const staySignedIn = await getStaySignedIn();
    if (!staySignedIn) {
      mark("kc.write.skip", `${key} → stay-signed-in OFF, memory-only`);
      return;
    }
    const startedAt = Date.now();
    mark("kc.write.start", key);
    try {
      await withTimeout("setItemAsync", key, SecureStore.setItemAsync(key, value));
      mark("kc.write.end", `${key} (${Date.now() - startedAt}ms)`);
    } catch (err) {
      // Best-effort persistence: token lives in memory for this session and
      // will be re-issued by Clerk on the next launch if the keychain write
      // never completed.
      const msg = err instanceof Error ? err.message : String(err);
      mark("kc.write.fail", `${key} → ${msg.slice(0, 60)} (${Date.now() - startedAt}ms)`);
    }
  },
  async clearToken(key: string): Promise<void> {
    memCache.set(key, null);
    try {
      await withTimeout("deleteItemAsync", key, SecureStore.deleteItemAsync(key));
    } catch {
      // Best-effort deletion. Memory has already been cleared so any
      // in-process reads will see null even if the keychain delete stalls.
    }
  },
};
