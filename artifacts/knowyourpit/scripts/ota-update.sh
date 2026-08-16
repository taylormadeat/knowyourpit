#!/usr/bin/env bash
# ota-update.sh — Publish an OTA (JS-only) update from the Replit build environment.
#
# WHY THIS SCRIPT EXISTS
# ----------------------
# Running `eas update` directly on Replit fails for two reasons:
#
#   1. babel-preset-expo was missing from devDependencies (now fixed), and
#   2. The Linux hermesc binary bundled with react-native 0.81.x is Hermes 0.12.0,
#      which rejects private class fields (#x, #y) used in RN's own source
#      (e.g. DOMRectReadOnly.js).  macOS EAS cloud builds use a newer hermesc
#      that supports them natively.
#
# The workaround is a two-step flow:
#   Step 1 — expo export --no-bytecode   (Babel transforms private fields; hermesc
#             is never invoked so the incompatibility is bypassed)
#   Step 2 — eas update --skip-bundler   (upload the pre-built bundle; no re-bundle)
#
# babel.config.js also applies @babel/plugin-transform-class-properties +
# @babel/plugin-transform-private-methods + @babel/plugin-transform-private-property-in-object
# (all with loose:true) so that any private-field syntax is down-compiled before
# the export step.
#
# USAGE
# -----
#   cd artifacts/knowyourpit
#   bash scripts/ota-update.sh [--channel <channel>] [--message "<msg>"] [--platform <ios|android|all>]
#
# Defaults:
#   --channel   production
#   --message   (auto-generated timestamp, e.g. "OTA update 2026-08-16T03:20:00Z")
#   --platform  all
#
# The script exports one platform at a time to avoid OOM errors in the Replit
# container.  Pass --platform ios or --platform android to publish a single
# platform if needed.
#
# NON-INTERACTIVE MODE NOTE
# -------------------------
# `eas update` requires --message in non-interactive environments (Replit,
# CI).  When the caller omits --message, the script falls back to a UTC
# timestamp message so the command never stalls waiting for terminal input.
#
# REQUIREMENTS
# ------------
#   • Run from the workspace root OR from artifacts/knowyourpit/ (the script
#     detects its own location and cds to the package root automatically).
#   • EXPO_TOKEN must be set (available as a Replit secret).
#   • eas-cli must be installed (it is listed in devDependencies).

set -euo pipefail

# ---------------------------------------------------------------------------
# Resolve package root (works regardless of cwd)
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PKG_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PKG_ROOT"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
CHANNEL="production"
MESSAGE=""
PLATFORM="all"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --channel)
      CHANNEL="$2"; shift 2 ;;
    --message)
      MESSAGE="$2"; shift 2 ;;
    --platform)
      PLATFORM="$2"; shift 2 ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: $0 [--channel <channel>] [--message \"<msg>\"] [--platform <ios|android|all>]" >&2
      exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Helper: export + publish one platform
# ---------------------------------------------------------------------------
publish_platform() {
  local plat="$1"
  echo ""
  echo "=== Exporting bundle for platform: $plat ==="
  pnpm exec expo export \
    --no-bytecode \
    --platform "$plat" \
    --output-dir dist

  echo ""
  echo "=== Publishing OTA update for platform: $plat (channel: $CHANNEL) ==="
  # eas update requires --message in non-interactive mode.
  # Fall back to a timestamp-based message when the caller didn't supply one.
  local effective_msg="$MESSAGE"
  if [[ -z "$effective_msg" ]]; then
    effective_msg="OTA update $(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  fi

  local update_args=(
    --skip-bundler
    --channel "$CHANNEL"
    --platform "$plat"
    --input-dir dist
    --message "$effective_msg"
  )
  pnpm exec eas update "${update_args[@]}"

  echo ""
  echo "✓  $plat update published successfully."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
echo "OTA update — channel: $CHANNEL  platform: $PLATFORM"
echo "Package root: $PKG_ROOT"
echo ""

if [[ "$PLATFORM" == "all" ]]; then
  # Export one platform at a time to avoid OOM in the Replit container.
  publish_platform ios
  publish_platform android
else
  publish_platform "$PLATFORM"
fi

echo ""
echo "=== OTA update complete ==="
