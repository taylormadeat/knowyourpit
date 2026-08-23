---
name: Local cook persistence
description: Rules for keeping cook creation responsive and durable when native AsyncStorage is delayed or fails.
---

Local cooks must commit to the in-memory outbox, notify subscribers, and return their local ID before any AsyncStorage operation. Snapshot persistence is background retry work, never a navigation or CTA dependency.

**Why:** On iOS, an AsyncStorage bridge write or cold-start read can stall while the app itself is responsive. Blocking on it leaves the cook visible only after an apparent spinner hang; late hydration can also overwrite a new in-memory cook or restore old cooks only transiently.

**How to apply:** Any local create, edit, delete, or session helper should queue persistence rather than await it on the interaction path. If hydration completes after local work, merge stored and in-memory records/operations by their local identities, preserve in-memory state on corrupt stored data, and route the merged repair snapshot through the same retry queue. Server-only detail queries and writes must remain disabled while a cook has its negative device-local ID.