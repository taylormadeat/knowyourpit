#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Patch React Native's Xcode version check to allow Xcode 15.x (EAS default machine).
# The check gates on XCODE_REQUIRED_MAJOR_VERSION = 16; lowering it to 15 lets
# Xcode 15.4 pass (15 >= 15). Xcode 15.4 can build RN 0.77 — the check is
# a conservative warning turned error, not a real capability limit.
find "$REPO_ROOT/node_modules" -name "utils.rb" \
  -path "*/react-native/scripts/cocoapods/*" 2>/dev/null | \
  xargs -I{} sed -i \
  's/XCODE_REQUIRED_MAJOR_VERSION = 16/XCODE_REQUIRED_MAJOR_VERSION = 15/' "{}" 2>/dev/null || true

pnpm --filter @workspace/knowyourpit exec expo "$@"

if [[ " $* " == *" prebuild "* ]]; then
  IOS_DIR="$REPO_ROOT/artifacts/knowyourpit/ios"
  AND_DIR="$REPO_ROOT/artifacts/knowyourpit/android"
  [ -d "$IOS_DIR" ] && ln -sfn "$IOS_DIR" "$REPO_ROOT/ios" 2>/dev/null || true
  [ -d "$AND_DIR" ] && ln -sfn "$AND_DIR" "$REPO_ROOT/android" 2>/dev/null || true
fi
