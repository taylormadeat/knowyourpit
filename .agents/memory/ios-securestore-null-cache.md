---
name: iOS SecureStore null-cache sign-out bug
description: Root cause and fix for random sign-outs caused by SecureStore timeout caching null into Clerk's token cache.
---

# iOS SecureStore null-cache sign-out bug

## The rule
In `tokenCache.ts`, never write `null` into `memCache` on a SecureStore timeout or error. Return null for the current call but leave `memCache` empty so the next `getToken()` retries SecureStore from scratch.

**Why:** iOS SecureStore can stall 1–4 s after backgrounding (Secure Enclave settling on `kSecAttrAccessibleAfterFirstUnlock` items). The old code cached `null` on timeout, poisoning the in-process cache for the entire session — Clerk saw "no session" even though the token was fine in the keychain.

**How to apply:** The `catch` block in `readWithCache` must NOT call `memCache.set(key, null)`. Only successful reads and deliberate `clearToken` calls may write null into `memCache`. The `inflightReads` Map already collapses concurrent calls so not caching the error doesn't cause read storms.

## Timeout value
Increased from 3 000 ms to 8 000 ms to cover the Enclave settling window.

## "Stay signed in" preference-at-write-time pattern
The preference ("knowyourpit:staySignedIn" in AsyncStorage, default true) is checked inside `saveToken`, not at ClerkProvider mount time. When OFF, the token stays in memCache only — cold relaunch requires sign-in. When ON, it's written to SecureStore as normal. This avoids a boot-time race where the preference must be known before the first React render.
