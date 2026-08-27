---
name: Clerk preview build detection
description: How to distinguish Replit's no-dev preview bundles from genuine native releases when validating Clerk keys.
---

Treat `EXPO_PUBLIC_BROWSER_PREVIEW_MODE` as the authoritative Replit preview
bundle signal, including native Expo Go. Pair it with the web platform check
only for browser-specific UI behavior; `__DEV__` is not sufficient.

**Why:** The preview workflow deliberately starts Metro with `--no-dev`, which
makes `__DEV__` false even though the intended Clerk instance uses a
development (`pk_test_`) key. Expo Go runs that same native preview bundle, so
a web-only check incorrectly shows a red production-key overlay. A real
TestFlight or App Store build with that key must still emit the release warning.

**How to apply:** Use the explicit preview bundle signal in Clerk key selection
and diagnostics across platforms. Suppress only the development-key-in-release
diagnostic for that preview path; continue surfacing a missing Clerk key and all
real release misconfiguration diagnostics.