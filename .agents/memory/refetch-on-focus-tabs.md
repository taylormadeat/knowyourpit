---
name: Query staleness across Expo Router tabs
description: Why invalidateQueries() right before navigation can leave a destination tab showing stale data, and the fix pattern used in this app.
---

React Navigation / Expo Router tab screens stay mounted-but-inactive when
not focused (no unmount-on-blur by default here). A `qc.invalidateQueries()`
fired on one screen right before `router.push()` to another tab races the
focus transition — the destination screen's query may already be "active"
from a prior visit, but timing isn't guaranteed, so the UI can render with
stale data until the user manually pulls to refresh.

**Why:** invalidateQueries only guarantees an immediate refetch for
observers react-query considers "active" at that exact moment; it does not
account for React Navigation's focus lifecycle.

**How to apply:** Don't rely solely on invalidateQueries from the origin
screen. Add an explicit focus-triggered refetch on the destination screen
instead — see `artifacts/knowyourpit/hooks/useRefetchOnFocus.ts` (wraps
`useFocusEffect`, skips the very first focus to avoid double-fetching
alongside the query's own initial load). Apply this on every tab whose data
can be mutated from elsewhere in the app right before navigating back to it.
