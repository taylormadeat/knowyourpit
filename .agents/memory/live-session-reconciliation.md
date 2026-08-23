---
name: Live session reconciliation
description: Rules for synchronizing offline live-cook session revisions safely.
---

Live cook membership changes must be persisted as one local session operation and reconciled as one server transaction, rather than replaying individual cook create/PATCH requests.

**Why:** A device can restart or reconnect between individual member writes; partial synchronization leaves a visible cook session with conflicting membership or schedules.

**How to apply:** Persist the local baseline records and the operation together, recover interrupted operations as pending after hydration, hold associated records out of independent sync, and retain server-side receipt/idempotency state with a transaction lock for capacity checks. On a permanent rejection, keep the local revision visible with its server reason and an explicit discard/recovery path.