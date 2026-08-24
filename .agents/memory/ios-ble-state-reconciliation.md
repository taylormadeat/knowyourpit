---
name: iOS BLE state reconciliation
description: Persisted Bluetooth denial flags can become stale after users change iOS Settings.
---

Treat persisted iOS Bluetooth denial state as a hint, never as current authorization. Reconcile it with the live BLE manager state on provider activation, foreground return, and scan start; distinguish Unauthorized, PoweredOff, Unsupported, and transitional states.

**Why:** iOS Settings can show Bluetooth enabled while an older app-local denial flag still renders a blocking warning, and a blocked scan can otherwise leave the retry control stuck.

**How to apply:** Only show the permission recovery action for a confirmed Unauthorized state. Clear stale denial state for every other observed state, keep Unknown/Resetting non-blocking, and release screen-owned loading state when a scan is rejected.