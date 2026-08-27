---
name: Clerk preview build detection
description: How to distinguish Replit's no-dev browser preview from a genuine native release when validating Clerk keys.
---

Treat `EXPO_PUBLIC_BROWSER_PREVIEW_MODE` plus the web platform check as the
authoritative Replit preview signal; `__DEV__` is not sufficient there.

**Why:** The preview workflow deliberately starts Metro with `--no-dev`, which
makes `__DEV__` false even though the intended Clerk instance uses a
development (`pk_test_`) key. A real TestFlight or App Store build with that
key must still emit the release warning.

**How to apply:** Keep the explicit preview signal in Clerk key selection and
diagnostics. Suppress only the development-key-in-release diagnostic for that
preview path; continue surfacing a missing Clerk key and all real release
misconfiguration diagnostics.