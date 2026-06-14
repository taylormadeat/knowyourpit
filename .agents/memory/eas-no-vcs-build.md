---
name: EAS build in Replit — EAS_NO_VCS=1 required
description: EAS CLI's git archive step is blocked by Replit's sandbox (even in task agents); EAS_NO_VCS=1 bypasses it.
---

# EAS build workaround: EAS_NO_VCS=1

## The rule
Always pass `EAS_NO_VCS=1` when running `eas build` in any Replit agent (main or task). Without it, EAS CLI tries to run `git archive` or similar, which is trapped by the sandbox and produces:
```
Destructive git operations are not allowed in the main agent.
```

**Why:** Replit's sandbox intercepts destructive git ops system-wide. EAS uses git to determine which files to bundle and archive for upload. `EAS_NO_VCS=1` tells EAS to use the filesystem directly instead, skipping the git step entirely.

**How to apply:** Always use this form:
```bash
cd artifacts/knowyourpit
EXPO_NO_TELEMETRY=1 EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 EAS_BUILD_NO_EXPO_GO_WARNING=true \
  eas build --platform ios --profile production --non-interactive --no-wait
```
`EXPO_NO_TELEMETRY=1` is **required** — without it the EAS CLI hangs indefinitely waiting for a response from `cdp.expo.dev` (the analytics/telemetry endpoint) before it can proceed to upload. With it, the archive compresses and uploads in ~10s. `EAS_SKIP_AUTO_FINGERPRINT=1` prevents a secondary fingerprint step that also blocks.
The `--no-wait` flag is also important — without it the CLI waits for the remote build to finish, which can exceed bash tool timeouts. Use `eas build:view <id>` to poll status instead.

## npm-package-arg broken in eas-cli
The globally-installed eas-cli has a corrupt `npm-package-arg` entry in its node_modules (empty directory). Fix:
```bash
rm -rf /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/node_modules/npm-package-arg
ln -s /home/runner/workspace/node_modules/.pnpm/npm-package-arg@11.0.3/node_modules/npm-package-arg \
  /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/node_modules/npm-package-arg
```
This symlink needs to be re-applied after any `npm install -g eas-cli` upgrade.

## AppCheckCore blocker — fix: pin RevenueCat (June 2026)
`react-native-purchases 9.7.2` → `PurchasesHybridCommon 17.29.0` (exact pin) → `RevenueCat 5.55.3` → `AppCheckCore` (Swift pod). AppCheckCore requires GoogleUtilities + RecaptchaInterop to define modules — a constraint that `use_react_native!` overrides, making ALL `:modular_headers` Podfile declarations ineffective (confirmed across 6 EAS builds). Fix: pin RevenueCat below the version that added AppCheckCore:
```ruby
pod 'RevenueCat', '< 5.55.3'
```
inside the `target 'knowyourpit' do` block. Marker: `# PIT_REVENUECAT_PIN`. Also injected by `plugins/with-pod-bundle-signing/index.js` for fresh prebuilds. See `.agents/memory/appcheckcore-pod-blocker.md` for full history.

## Xcode image requirement (April 2026+)
Apple requires Xcode 26+ for all App Store submissions since April 28, 2026.
Always use `macos-sequoia-15.6-xcode-26.2` (or newer) for production builds.
Xcode 16.x builds will be rejected at submission time.

## Submission
After queuing the build with `--no-wait`, poll with `eas build:view <id>` until status is `finished`, then submit:
```bash
cd artifacts/knowyourpit && bash scripts/submit-ios.sh
```
Check submission status via EAS GraphQL (offset 0, limit 5) to confirm FINISHED vs ERRORED.
