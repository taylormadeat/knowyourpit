import * as SecureStore from "expo-secure-store";
import { mark } from "./bootBreadcrumbs";

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
// - saveToken: updates memory immediately so reads-after-write never block,
//   then writes to SecureStore best-effort in the background.
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

// ── Persistent token cache (default — "Stay signed in" ON) ───────────────────
// Reads from / writes to SecureStore so the session survives cold launches.
export const safeTokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    return readWithCache(key);
  },
  async saveToken(key: string, value: string): Promise<void> {
    // Update memory first so the very next getToken() (which Clerk fires
    // immediately after a successful sign-in to attach the new bearer to
    // subsequent requests) returns the fresh token without waiting on the keychain.
    memCache.set(key, value);
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

// ── Memory-only token cache ("Stay signed in" OFF) ───────────────────────────
// Tokens are kept in the same in-process memCache but never written to
// SecureStore. When the user fully closes the app the JS process is torn down
// and the session is lost — signing in is required on the next cold launch.
export const memoryOnlyTokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    return memCache.get(key) ?? null;
  },
  async saveToken(key: string, value: string): Promise<void> {
    memCache.set(key, value);
  },
  async clearToken(key: string): Promise<void> {
    memCache.delete(key);
  },
};
