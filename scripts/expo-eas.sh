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

# Mirror every package from the artifact's node_modules into the repo-root
# node_modules so Node module resolution succeeds when Expo/EAS reads the
# symlinked app.json from the repo root. app.json references node-modules
# plugins by bare name (e.g. "expo-router", "expo-notifications"), and Node
# resolves those starting from the file that loaded them — i.e. starting
# from /home/runner/workspace/node_modules/. In a pnpm monorepo the artifact's
# deps live at artifacts/knowyourpit/node_modules/, so without this mirror
# Expo errors with:
#   "Failed to resolve plugin for module 'expo-router' relative to
#    '/home/runner/workspace'"
# We never overwrite a real entry already present at the repo root (e.g.
# workspace-level dev tools like prettier, typescript). The symlinks are
# leaf-level — pnpm's internal .pnpm/ tree is reached through the symlink
# target, so transitive deps resolve correctly.
mkdir -p "$REPO_ROOT/node_modules"
# Unscoped packages: walk the artifact's top-level entries. Skip dotfiles and
# scoped (@*) entries — those are handled separately below to avoid creating
# a directory symlink at the root (which would cause subsequent writes to
# tunnel back into the artifact's pnpm-managed tree and corrupt symlinks
# there). See the post-mortem on the "@clerk/expo self-symlink" incident.
for entry in "$REPO_ROOT/artifacts/knowyourpit/node_modules"/*; do
  [ -e "$entry" ] || continue
  name="$(basename "$entry")"
  case "$name" in
    .*) continue ;;  # skip dotfiles like .bin, .modules.yaml
    @*) continue ;;  # scoped pkgs handled by the loop below
  esac
  dst="$REPO_ROOT/node_modules/$name"
  # Only create when nothing is there. We never overwrite an existing entry
  # (symlink or otherwise) — pnpm may have linked it to a workspace-resolved
  # version (e.g. typescript hoisted at the root).
  if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then
    ln -sfn "$entry" "$dst" 2>/dev/null || true
  fi
done
# Scoped packages (@scope/pkg): always materialize the @scope dir at the root
# as a real directory (never a symlink) so that the per-package symlinks we
# create inside it cannot tunnel back into the artifact's node_modules.
for scope_dir in "$REPO_ROOT/artifacts/knowyourpit/node_modules"/@*; do
  [ -d "$scope_dir" ] || continue
  scope_name="$(basename "$scope_dir")"
  scope_dst="$REPO_ROOT/node_modules/$scope_name"
  if [ -L "$scope_dst" ]; then
    # If a previous (buggy) run created a symlink here, replace it with a
    # real directory. Removing the symlink does not touch its target.
    rm "$scope_dst"
  fi
  mkdir -p "$scope_dst"
  for entry in "$scope_dir"/*; do
    [ -e "$entry" ] || continue
    pkg_name="$(basename "$entry")"
    dst="$scope_dst/$pkg_name"
    if [ ! -e "$dst" ] && [ ! -L "$dst" ]; then
      ln -sfn "$entry" "$dst" 2>/dev/null || true
    fi
  done
done

# Sanity check: confirm every node-modules plugin referenced by app.json
# resolves from the repo root. Fail fast with a clear remediation so the next
# failure mode (cryptic "Failed to resolve plugin..." from Expo deep in the
# build) becomes deterministic. The plugin list is extracted dynamically from
# app.json so this check stays in sync as plugins are added/removed.
REQUIRED_PLUGINS="$(node -e '
  const cfg = require("./artifacts/knowyourpit/app.json");
  const plugins = (cfg.expo && cfg.expo.plugins) || [];
  const names = plugins
    .map(p => Array.isArray(p) ? p[0] : p)
    .filter(name => typeof name === "string" && !name.startsWith("./") && !name.startsWith("../"));
  console.log(names.join(" "));
' 2>/dev/null || echo "")"
MISSING_PLUGINS=""
for plugin in $REQUIRED_PLUGINS; do
  if [ ! -e "$REPO_ROOT/node_modules/$plugin/package.json" ]; then
    MISSING_PLUGINS="$MISSING_PLUGINS $plugin"
  fi
done
if [ -n "$MISSING_PLUGINS" ]; then
  echo "ERROR: required Expo plugins not resolvable from the repo root:" >&2
  for p in $MISSING_PLUGINS; do
    echo "  - $p (expected at $REPO_ROOT/node_modules/$p)" >&2
  done
  echo "" >&2
  echo "This usually means artifacts/knowyourpit/node_modules is missing or" >&2
  echo "incomplete. Restore with:" >&2
  echo "  pnpm install --filter @workspace/knowyourpit" >&2
  echo "Then re-run this script." >&2
  exit 1
fi

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
  # Mirror the prebuild-generated native dirs at the repo root so EAS finds
  # them next to the symlinked config files. Same clobber-guard pattern as
  # the plugins/assets block at the top of this script.
  for dir in ios android; do
    src="$REPO_ROOT/artifacts/knowyourpit/$dir"
    dst="$REPO_ROOT/$dir"
    if [ -e "$dst" ] && [ ! -L "$dst" ]; then
      echo "ERROR: $dir at the repo root must be a symlink to artifacts/knowyourpit/$dir." >&2
      echo "       Found a regular file/directory instead. EAS would build against the" >&2
      echo "       wrong native project. Restore with:" >&2
      echo "         rm -rf $dir && ln -s artifacts/knowyourpit/$dir $dir" >&2
      exit 1
    fi
    [ -d "$src" ] && ln -sfn "$src" "$dst" 2>/dev/null || true
  done
fi
