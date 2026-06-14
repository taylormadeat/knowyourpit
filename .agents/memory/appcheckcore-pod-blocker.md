---
name: AppCheckCore pod install blocker
description: CocoaPods validation error blocking EAS builds — AppCheckCore (Swift) requires GoogleUtilities + RecaptchaInterop to define modules. Root cause and fix identified.
---

## The Error
`[!] The Swift pod AppCheckCore depends upon GoogleUtilities and RecaptchaInterop, which do not define modules.`

Fires at the END of `pod install` — after all pods are resolved and downloaded, during `generate_pods_project → validate_build_configurations`. It is a CocoaPods pre-Xcode-project validation step.

## Root Cause (Confirmed)

Chain: `react-native-purchases 9.7.2` → `PurchasesHybridCommon 17.29.0` (exact pin in RNPurchases.podspec) → `RevenueCat 5.55.3` → `AppCheckCore`

RevenueCat 5.55.3 added AppCheckCore as a dependency. Build #122 (June 8) succeeded with a pre-5.55.3 RevenueCat. CocoaPods CDN updated RevenueCat to 5.55.3 sometime between June 8 and June 14, causing the failure.

**Why `:modular_headers => true` declarations don't work:** Comparing two build logs (165d924c baseline vs dd0dc5eb with explicit declarations inside target) showed IDENTICAL pod install output at the same line numbers. React Native's `use_react_native!` macro overrides any `:modular_headers` settings declared in the Podfile for transitive deps.

## What Does NOT Work

| Approach | Build ID | Outcome |
|---|---|---|
| `DEFINES_MODULE=YES` in `post_install` | `165d924c` | Too late — validation fires before post_install |
| `use_modular_headers!` inside target `do` block | `b54eeddb` | Conflicts with `use_react_native!` — fails FASTER |
| `pod 'GoogleUtilities', :modular_headers => true` inside target | `dd0dc5eb` | Completely ignored — identical output to baseline |
| `use_modular_headers!` globally | `f0eebd4b` | Conflicts with React Native C++ pods (boost, Folly) |

## Fix Applied (Build #130)

`pod 'RevenueCat', '< 5.55.3'` added inside `target 'knowyourpit' do` in `ios/Podfile`.

This pins CocoaPods to a RevenueCat version before AppCheckCore was added as a dep. PurchasesHybridCommon 17.29.0's version constraint for RevenueCat is likely `~> 5.55` (>= 5.55.0, < 5.56.0), so 5.55.0–5.55.2 are all valid resolutions.

**Failure mode if wrong:** CocoaPods would print "Could not find compatible versions for pod 'RevenueCat'" — a clean, fast failure that tells us to adjust the constraint.

Config plugin (`plugins/with-pod-bundle-signing/index.js`) updated to inject the pin after `use_expo_modules!` on fresh prebuilds. New marker: `# PIT_REVENUECAT_PIN`.

## If Build #130 Fails with RevenueCat Conflict

PurchasesHybridCommon 17.29.0 may require RevenueCat >= 5.55.3 exactly. In that case, upgrade `react-native-purchases` to a version where PurchasesHybridCommon uses a newer version that no longer has AppCheckCore as a dep, OR try `USE_FRAMEWORKS=static` (the Podfile already has the code for this env var).
