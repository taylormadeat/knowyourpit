---
name: Local cook persistence
description: Rules for keeping cook creation responsive and durable when native AsyncStorage is delayed or fails.
---

Local cooks must commit to the in-memory outbox, notify subscribers, clear the CTA, and initiate routing before any native bridge or network operation. This includes cold AsyncStorage hydration/writes, native UUID generation, haptics, notifications, and sync; persistence is background retry work, never a navigation dependency.

**Why:** On iOS, a native bridge operation can stall while the app is otherwise responsive. Letting a storage read/write or other native call get ahead of the route transition leaves Start Cooking Now spinning until the app changes lifecycle state; late hydration can also overwrite a new in-memory cook or restore old cooks only transiently.

**How to apply:** Any interaction-path local create should return a record synchronously and defer hydration plus persistence until the next event-loop turn; use a pure-JavaScript opaque idempotency key for that path. If hydration completes after local work, merge stored and in-memory records/operations by their local identities, preserve in-memory state on corrupt stored data, and route the merged repair snapshot through the same retry queue. Server-only detail queries and writes must remain disabled while a cook has its negative device-local ID.