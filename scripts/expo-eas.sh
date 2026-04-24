#!/usr/bin/env bash
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Guard: the root eas.json and app.json MUST be symlinks into
# artifacts/knowyourpit/. If they were ever replaced by standalone files
# (e.g. by `eas init` run from the repo root), EAS would silently use those
# stale configs and ignore the artifact's `image` and projectId settings.
# See "EAS config layout" in replit.md and Task #91 for context.
for cfg in eas.json app.json; do
  path="$REPO_ROOT/$cfg"
  expected_target="artifacts/knowyourpit/$cfg"
  if [ ! -L "$path" ]; then
    if [ -e "$path" ]; then
      reason="Found a regular file instead of a symlink."
    else
      reason="The symlink is missing entirely."
    fi
    echo "ERROR: $cfg at the repo root must be a symlink to $expected_target." >&2
    echo "       $reason EAS would read a stale or wrong file and silently" >&2
    echo "       ignore the artifact's image/projectId/env settings. Restore with:" >&2
    echo "         rm -f $cfg && ln -s $expected_target $cfg" >&2
    exit 1
  fi
  actual_target="$(readlink "$path")"
  if [ "$actual_target" != "$expected_target" ]; then
    echo "ERROR: $cfg symlink points at '$actual_target' but must point at '$expected_target'." >&2
    echo "       Restore with:" >&2
    echo "         rm -f $cfg && ln -s $expected_target $cfg" >&2
    exit 1
  fi
done

# Mirror the artifact's plugins/ and assets/ directories at the repo root so
# the relative paths inside app.json (./plugins/with-watch-app, ./assets/...)
# resolve correctly when Expo or EAS reads app.json via the workspace-root
# symlink. Without this, expo errors with:
#   "Failed to resolve plugin for module './plugins/with-watch-app' relative
#    to '/home/runner/workspace'"
# These source dirs exist in the artifact at all times, so we recreate the
# symlinks on every invocation (idempotent). See Task #92 in replit.md.
for dir in plugins assets; do
  src="$REPO_ROOT/artifacts/knowyourpit/$dir"
  dst="$REPO_ROOT/$dir"
  if [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "ERROR: $dir at the repo root must be a symlink to artifacts/knowyourpit/$dir." >&2
    echo "       Found a regular file/directory instead. Without this symlink, paths in" >&2
    echo "       app.json like './plugins/with-watch-app' fail to resolve. Restore with:" >&2
    echo "         rm -rf $dir && ln -s artifacts/knowyourpit/$dir $dir" >&2
    exit 1
  fi
  [ -d "$src" ] && ln -sfn "$src" "$dst" 2>/dev/null || true
done

# Defense-in-depth: patch React Native's Xcode-version check so the build does
# not abort if EAS ever falls back to an older macOS image (Sonoma 14.5 + Xcode
# 15.4). With the symlinks above intact, EAS uses macos-sequoia-15.6-xcode-16.4
# and this patch is a no-op. Kept as belt-and-suspenders in case the image
# is ever overridden.
find "$REPO_ROOT/node_modules" -name "utils.rb" \
  -path "*/react-native/scripts/cocoapods/*" 2>/dev/null | \
  xargs -I{} perl -pi -e \
  's/XCODE_REQUIRED_MAJOR_VERSION = 16/XCODE_REQUIRED_MAJOR_VERSION = 15/' "{}" 2>/dev/null || true

pnpm --filter @workspace/knowyourpit exec expo "$@"

if [[ " $* " == *" prebuild "* ]]; then
  IOS_DIR="$REPO_ROOT/artifacts/knowyourpit/ios"
  AND_DIR="$REPO_ROOT/artifacts/knowyourpit/android"
  [ -d "$IOS_DIR" ] && ln -sfn "$IOS_DIR" "$REPO_ROOT/ios" 2>/dev/null || true
  [ -d "$AND_DIR" ] && ln -sfn "$AND_DIR" "$REPO_ROOT/android" 2>/dev/null || true
fi
