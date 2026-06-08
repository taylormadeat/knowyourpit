---
name: Sentry incompatibility with Expo SDK 54
description: @sentry/react-native v8.x crashes on launch with Expo SDK 54 / RN 0.81.5 new arch — do not add it without version verification.
---

## Rule
Never add `@sentry/react-native` + the `"@sentry/react-native/expo"` Expo config plugin without first verifying the SDK version is compatible with the current Expo SDK.

**Why:** `@sentry/react-native@8.13.0` + the native Expo plugin was added to `artifacts/knowyourpit` between builds #118 (working) and #119 (crash). The crash was `EXC_CRASH / SIGABRT` with `RCTInstance handleBundleLoadingError` in the stack — the Sentry native turbo module failed to bind during JS bundle execution before any app code ran, making it unrecoverable. Expo SDK 54 expects `~7.2.0`; v8.x is not compatible with RN 0.81.5 + new arch at that time.

**How to apply:** Before adding `@sentry/react-native` to an Expo project, check the Expo SDK's peer dependency expectation with `npx expo install --check @sentry/react-native` or look up the version in the Expo SDK compatibility table. The plugin and the JS package must both be version-compatible with the installed Expo SDK.

If Sentry is added without a DSN configured, the JS `initSentry()` wrapper is a safe no-op — but the **native plugin** runs regardless of DSN and will crash if incompatible.
