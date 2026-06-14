---
name: AppCheckCore pod install blocker
description: CocoaPods validation error blocking EAS builds — AppCheckCore (Swift) requires GoogleUtilities + RecaptchaInterop to define modules. All attempted pre-install fixes cause new conflicts with React Native pods.
---

## The Error
`[!] The Swift pod AppCheckCore depends upon GoogleUtilities and RecaptchaInterop, which do not define modules.`

Fires at the END of `pod install` — after all pods are resolved and downloaded, during `generate_pods_project → validate_build_configurations`. It is a CocoaPods pre-Xcode-project validation step.

## What Does NOT Work

| Approach | Build ID | Outcome |
|---|---|---|
| `DEFINES_MODULE=YES` in `post_install` | `165d924c` | Too late — validation fires before post_install |
| `use_modular_headers!` inside target `do` block | `b54eeddb` | Conflicts with `use_react_native!` — fails FASTER |
| `pod 'GoogleUtilities', :modular_headers => true` + `pod 'RecaptchaInterop', :modular_headers => true` inside target | `dd0dc5eb` | Causes earlier failure — likely resolution conflict |
| `use_modular_headers!` globally (before target block) | `f0eebd4b` | Conflicts with React Native pods (boost, Folly, etc.) — fastest failure |

**Pattern**: anything that changes pre-install dependency resolution causes a NEW, earlier failure (~1m 30-45s) vs the original error (~2m 45s on a cold cache). The original Podfile (with only `DEFINES_MODULE` in post_install) is the baseline that gets furthest.

## Unknown: Which Pod Pulls In AppCheckCore?

This project does NOT use `@react-native-google-signin`, Firebase, or Google Sign-In directly. The chain is unknown without reading `Podfile.lock` on a Mac. Likely candidates: `react-native-purchases` (RevenueCat), `@clerk/expo`, or a transitive dep.

**Why:** `AppCheckCore` became a Swift pod around v11.x. If a dependency updated to a version requiring `AppCheckCore ≥ 11.0`, this error appeared. Build #122 (June 8) succeeded; build #123 (June 14) started failing — something in `pnpm-lock.yaml` changed between those dates.

## Correct Fix (Untested Due to No Mac Access)

Run `pod install` locally on a Mac to get the interactive error + `Podfile.lock`. Then:
1. Check `Podfile.lock` for which pod depends on `AppCheckCore`
2. The fix is either `:modular_headers => true` on the SPECIFIC pods that need it (not globally), OR pinning the parent pod to a pre-Swift-AppCheckCore version
3. The exact CocoaPods syntax must be tested interactively — EAS blind retries are too slow to iterate

## Baseline State (Furthest Reaching)
`165d924c` — Podfile with ONLY `DEFINES_MODULE=YES` in `post_install`, no pre-install changes. Ran pod install to line 302-305 of ~310 (near-completion). Current `ios/Podfile` and plugin are restored to this state.
