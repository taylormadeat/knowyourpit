---
name: iOS SecureStore null-cache sign-out bug
description: Root cause and fix for users being randomly signed out due to SecureStore timeout caching null into Clerk's token cache.
---

# iOS SecureStore null-cache sign-out bug

## The rule
In `tokenCache.ts`, never write `null` into `memCache` on a SecureStore timeout or error. Return null for the current call but leave `memCache` empty so the next `getToken()` retries SecureStore from scratch.

**Why:** iOS SecureStore (specifically `kSecAttrAccessibleAfterFirstUnlock` items) can stall for 1–4 seconds after the device wakes from background while the Secure Enclave finishes unlocking. When this happened, the old code cached `null` into `memCache` — which caused Clerk to see "no session" for the entire app lifecycle, signing the user out despite a perfectly valid token sitting in the keychain on the next read.

The `inflightReads` deduplication Map already collapses all concurrent `getToken()` calls into a single SecureStore read, so not caching the error result doesn't cause read storms.

**How to apply:** Every `catch` block in `readWithCache` in `tokenCache.ts` must NOT call `memCache.set(key, null)`. Only successful reads and deliberate `clearToken` calls may write null into `memCache`.

## Timeout value
Increased from 3 000 ms to 8 000 ms. The 8 s window comfortably covers the Secure Enclave settling window and still gives headroom before the 12-second global escape hatch fires.

## "Stay signed in" feature
Added `memoryOnlyTokenCache` in `tokenCache.ts` — same in-process `memCache` but never reads/writes SecureStore. ClerkProvider receives `safeTokenCache` (default, stays signed in) or `memoryOnlyTokenCache` (session ends on cold close), selected at boot based on `AsyncStorage.getItem("knowyourpit:staySignedIn")`. The read is kicked off at module level in `_layout.tsx` so it resolves before ClerkProvider mounts; a `staySignedInLoaded` gate in `RootLayout` blocks the render (splash stays up) until the < 5 ms AsyncStorage read completes.
