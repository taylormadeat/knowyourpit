---
name: AsyncStorage timeout recovery
description: Safe local-outbox behavior when React Native AsyncStorage reads or full-snapshot writes stall.
---

Bounded AsyncStorage operations need two layers of recovery: do not start a
new full-snapshot write while a timed-out native write could still finish, and
treat interrupted `syncing` records as retryable during hydration.

**Why:** A late older snapshot can overwrite newer local state. Conversely, a
timed-out transition to `syncing` can leave a cook permanently stranded unless
the in-memory state rolls back and the persisted state is normalized on the
next app launch. A recovery-write failure is temporary storage trouble, not
evidence that the original local data was corrupt.

**How to apply:** When adding local outbox state transitions, make completion
contingent on a confirmed bounded write; retain the durable draft for retry,
serialize around unresolved writes, and keep parsing failures separate from
post-parse migration/persistence failures.