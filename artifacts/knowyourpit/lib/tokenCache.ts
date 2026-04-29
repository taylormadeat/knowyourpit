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

// In-memory cache for keychain reads. This is the critical fix for the iOS-26
// boot hang: Clerk's `__internal_onBeforeRequest` hook calls `getToken()` to
// attach an Authorization header on EVERY internal HTTP request (env, client,
// session-JWT refresh, etc.). On a healthy device each call returns in <50ms,
// but when SecureStore stalls (an iOS-26 + new-arch quirk we are chasing) each
// call hits the 3-second timeout, and three sequential stalled reads pile up
// to the exact 9-second "Clerk: not ready" we observe in the build-40
// diagnostic. By memoising the result of the first read for each key — even
// when that first read times out and yields null — every subsequent
// in-process read returns synchronously from memory. Cold-boot worst case is
// thus a single 3s stall instead of 3+ × 3s.
//
// Memory cache semantics:
// - getToken: returns the cached value (including a cached null from a prior
//   timeout) when present; otherwise reads SecureStore once and caches the
//   result. Concurrent reads for the same key share an in-flight Promise.
// - saveToken: updates memory immediately so reads-after-write never block,
//   then writes to SecureStore best-effort in the background.
// - clearToken: clears memory immediately, then deletes from SecureStore
//   best-effort.
//
// This keeps Clerk's auth-header pipeline fast for the rest of the session
// while still persisting the token across app launches via the keychain.
const memCache = new Map<string, string | null>();
const inflightReads = new Map<string, Promise<string | null>>();

async function readWithCache(key: string): Promise<string | null> {
  if (memCache.has(key)) {
    return memCache.get(key) ?? null;
  }
  const existing = inflightReads.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const v = await withTimeout("getItemAsync", key, SecureStore.getItemAsync(key));
      const result = v ?? null;
      memCache.set(key, result);
      return result;
    } catch {
      // On timeout/error, cache null so we never re-attempt the stalled read
      // during this session — Clerk will treat the user as signed out and
      // bootstrap into the unauthenticated path immediately.
      memCache.set(key, null);
      return null;
    } finally {
      inflightReads.delete(key);
    }
  })();
  inflightReads.set(key, p);
  return p;
}

export const safeTokenCache: TokenCache = {
  async getToken(key: string): Promise<string | null> {
    return readWithCache(key);
  },
  async saveToken(key: string, value: string): Promise<void> {
    // Update memory first so the very next getToken() (which Clerk fires
    // immediately after a successful sign-in to attach the new bearer to
    // subsequent requests) returns the fresh token without waiting on the
    // keychain.
    memCache.set(key, value);
    try {
      await withTimeout("setItemAsync", key, SecureStore.setItemAsync(key, value));
    } catch {
      // Best-effort persistence: token lives in memory for this session and
      // will be re-issued by Clerk on the next launch if the keychain write
      // never completed.
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
