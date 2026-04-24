#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

pnpm --filter @workspace/knowyourpit exec expo "$@"

if [[ " $* " == *" prebuild "* ]]; then
  IOS_DIR="$REPO_ROOT/artifacts/knowyourpit/ios"
  AND_DIR="$REPO_ROOT/artifacts/knowyourpit/android"
  [ -d "$IOS_DIR" ] && ln -sfn "$IOS_DIR" "$REPO_ROOT/ios" 2>/dev/null || true
  [ -d "$AND_DIR" ] && ln -sfn "$AND_DIR" "$REPO_ROOT/android" 2>/dev/null || true
fi
