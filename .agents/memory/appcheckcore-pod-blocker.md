---
name: EAS iOS pod blockers
description: How to distinguish Xcode-project parse failures from RevenueCat AppCheck module failures in fresh EAS builds.
---

Treat these as two separate failure classes:

1. A CocoaPods `Data missing closing '>'` parse error comes from an invalid
   generated pbxproj. Any xcode-lib value containing special syntax such as
   `<group>` must be pre-quoted before serialization.
2. An AppCheckCore error saying GoogleUtilities and RecaptchaInterop do not
   define modules is a linkage mismatch. Simulator development builds must use
   the same static-framework linkage as the proven production profile.

Do not try to solve the second failure by pinning RevenueCat below 5.55.3 while
using PurchasesHybridCommon 17.29.0. That wrapper requires RevenueCat 5.55.3
exactly, so the pin creates an unsatisfiable CocoaPods graph.

**Why:** Both failures appear during `Install pods`, but they have unrelated
causes. Conflating them led to a contradictory RevenueCat pin and repeated cloud
build failures.

**How to apply:** Read the exact pod-install message. Fix malformed pbxproj
serialization only for parser errors. For AppCheck module errors, align the
development simulator linkage with production and leave the wrapper's exact
RevenueCat dependency intact.
