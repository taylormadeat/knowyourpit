---
name: EAS pod install blocker — root cause found
description: The 2026-08 "Install pods" failures were NOT AppCheckCore; a config plugin wrote an unquoted sourceTree = <group> into the pbxproj.
---
RESOLVED (2026-08-11). Every fresh `pod install` on EAS failed in ~80s with a CocoaPods parse error: `Data missing closing '>'` on a manually injected PBXFileReference.

**Root cause:** a custom Expo config plugin that manually registers a file in the Xcode project set `sourceTree: "<group>"` as a plain JS string. The `xcode` lib serializes values literally, so the pbxproj got `sourceTree = <group>;` (unquoted), which CocoaPods' parser cannot read. The value must be pre-quoted in JS: `sourceTree: '"<group>"'`.

**Why it was hard to find:** earlier builds passed only via the EAS pod cache (cache hit skips the parse); EAS log downloads via curl are undecodable binary — the actual error was only visible in the browser UI (asking the user to paste it broke the deadlock).

**How to apply:** when injecting entries into `project.hash.project.objects` with the `xcode` lib, embed quotes in any value containing special chars (`<group>`, paths with spaces/dashes). Verify by grepping the generated pbxproj after `expo prebuild`. AppCheckCore, react-native-purchases version, and RCT_USE_PREBUILT_RNCORE were all red herrings — reverted.
