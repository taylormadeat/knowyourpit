---
name: Mutation 401 retry & per-user token refresh
description: Why react-query mutations need a fetch-layer 401 retry, and why the force-refresh single-flight must be keyed per user.
---

# Mutation 401 retry must live in the fetch layer, not the global guard

The app's global `SessionExpiredGuard` (in `app/_layout.tsx`) watches the react-query
query+mutation caches for 401s, force-refreshes the Clerk token, and on success calls
`client.invalidateQueries()`. `invalidateQueries()` only re-runs **queries** — it never
re-fires **mutations**. The QueryClient is also configured to never retry 401s.

**Consequence:** a POST mutation (e.g. cook creation, check-ins) that 401s on a stale or
null cached JWT is never retried — it just fails. The user-visible symptom was the
"Start Cooking Now" freeze / "Connection Timeout".

**Rule:** recover mutation 401s at the shared fetch layer (`customFetch` in
`lib/api-client-react`), not by leaning on the guard. The pattern: use the cached token
first; if it's null, force one refresh before firing; on a 401 (when not already
refreshed) force-refresh and retry the request exactly once. The guard remains the
last line for genuine expiry → sign-out, and composes cleanly (if the fetch-layer retry
succeeds the guard never sees an error).

**Why:** the guard's refresh→invalidate model is query-shaped; mutations fall through it.

# Force-refresh single-flight MUST be keyed to the active user

The `setAuthTokenGetter` wrapper coalesces concurrent force-refreshes onto one in-flight
promise (a refresh storm on return-from-background otherwise). That single-flight promise
**must be keyed to the `getToken` function that started it** (`_currentGetToken` is
re-pointed to the new user's `getToken` on account switch).

**Why:** if the in-flight promise is module-global and unkeyed, a refresh started by user
A can be awaited by user B after an account switch, attaching A's bearer token to B's
request → cross-user data access (broken access control). Found in code review.

**How to apply:** capture `const getter = _currentGetToken` at call entry; only reuse the
in-flight promise when its stored owner === the captured getter; clear it in `.finally`
only if a newer refresh hasn't replaced it.

# Idempotent create lets a timeout retry be safe

Cook creation attaches a synthetic `Crypto.randomUUID()` `sessionId` (now-mode only) so the
server's `(userId, sessionId, plannedStartAt)` dedup guard returns the existing row (200)
on retry. That guard must run **before** the free-tier paywall caps, or a retry of an
already-succeeded create trips the active/planned cap with a false 402. iOS does not
reliably honour `fetch` aborts, so a timed-out first attempt may still reach the server —
idempotency is what makes the client-side timeout retry duplicate-safe.
