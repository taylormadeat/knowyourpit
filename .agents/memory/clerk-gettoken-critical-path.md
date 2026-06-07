---
name: Clerk getToken skipCache on critical path
description: Why getToken({skipCache:true}) before a UI render can hang RN/iOS handlers, and the cached-token-then-401-refresh pattern to use instead.
---

# Clerk `getToken({ skipCache: true })` must not gate UI on the critical path

Calling `await getToken({ skipCache: true })` at the *top* of a tap handler —
before any `setState`/modal open — forces a network round-trip to Clerk on
every tap. On a slow/stalled iOS connection that await hangs, so the handler
never reaches the code that opens the loading modal. Symptom: "tap does
nothing", and the UI only un-sticks when the app is backgrounded/foregrounded
(each foreground appears to nudge one stalled awaited network call forward).

**Rule:** use cached `getToken()` (returns synchronously from cache) on the
critical path. Only force `getToken({ skipCache: true })` *after* the server
actually rejects the cached token with a 401, then retry the request once with
the refreshed token. Track the refreshed token so any subsequent auto-retry
reuses it, not the original cached one.

**Why:** responsiveness — the modal/loader must render the instant the user
taps. A forced token refresh is a liability that can hang the whole handler;
the server's 401 is the only reliable signal that a refresh is genuinely needed.

**How to apply:** any RN handler that does `getToken(...)` then `fetch(...)`.
Pair this with an AbortController timeout on the fetch itself (RN `fetch` has
no default timeout), or a dead socket hangs the loading modal forever.
