#!/usr/bin/env bash
# take-screenshots.sh — Capture real iOS simulator screenshots for App Store submission.
#
# Usage (from artifacts/knowyourpit/):
#   SCREENSHOT_EMAIL=demo@example.com SCREENSHOT_PASSWORD=Secret1 \
#     ./scripts/take-screenshots.sh [--ipad] [--no-build]
#
# Environment variables (required):
#   SCREENSHOT_EMAIL      Email of a pre-seeded demo/QA account in Clerk production
#   SCREENSHOT_PASSWORD   Password for that account
#
# Flags:
#   --ipad      Also capture iPad screenshots (2064×2752)
#   --no-build  Skip the EAS local build and reuse build/ from a previous run
#
# Requirements:
#   - macOS with Xcode 15+ installed
#   - Maestro CLI  (curl -Ls "https://get.maestro.mobile.dev" | bash)
#   - EAS CLI      (npm install -g eas-cli)  — only needed without --no-build
#
# Target resolutions:
#   iPhone  (6.7" display)  — 1290×2796  (iPhone 15 Pro Max / App Store 6.7" slot)
#   iPad    (13" display)   — 2064×2752  (iPad Pro 13-inch M4)
#
# Outputs land in:
#   artifacts/knowyourpit/screenshots/iphone/
#   artifacts/knowyourpit/screenshots/ipad/

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SCREENSHOTS_DIR="$APP_DIR/screenshots"
MAESTRO_FLOWS="$APP_DIR/.maestro"

BUNDLE_ID="com.knowyourpit.app"
IPHONE_DEVICE="iPhone 15 Pro Max"
IPAD_DEVICE="iPad Pro 13-inch (M4)"

BUILD_APP=true
CAPTURE_IPAD=false

# ── Parse flags ─────────────────────────────────────────────────────────────
for arg in "$@"; do
  case $arg in
    --ipad)       CAPTURE_IPAD=true ;;
    --no-build)   BUILD_APP=false ;;
  esac
done

# ── Helpers ──────────────────────────────────────────────────────────────────
require() {
  if ! command -v "$1" &>/dev/null; then
    echo "❌  '$1' not found. $2"
    exit 1
  fi
}

boot_simulator() {
  local name="$1"
  echo "🔵  Booting simulator: $name"
  local udid
  udid=$(xcrun simctl list devices available | grep "$name" | head -1 | grep -oE '[A-F0-9-]{36}')
  if [[ -z "$udid" ]]; then
    echo "❌  Simulator '$name' not found. Install it via Xcode → Platforms."
    exit 1
  fi
  xcrun simctl boot "$udid" 2>/dev/null || true
  open -a Simulator --args -CurrentDeviceUDID "$udid"
  echo "⏳  Waiting for simulator to be ready..."
  xcrun simctl bootstatus "$udid" -b
  echo "$udid"
}

install_app() {
  local udid="$1"
  local app_path="$2"
  echo "📲  Installing app on $udid"
  xcrun simctl install "$udid" "$app_path"
}

run_maestro_flows() {
  local device_label="$1"
  local out_dir="$2"
  mkdir -p "$out_dir"
  echo "📸  Running Maestro flows for $device_label → $out_dir"
  MAESTRO_DRIVER_STARTUP_TIMEOUT=120000 \
    maestro test \
      --output "$out_dir" \
      --env SCREENSHOT_EMAIL="${SCREENSHOT_EMAIL}" \
      --env SCREENSHOT_PASSWORD="${SCREENSHOT_PASSWORD}" \
      "$MAESTRO_FLOWS/screenshot-all.yaml"
  echo "✅  Maestro flows complete for $device_label"
}

resize_screenshots() {
  local dir="$1"
  local width="$2"
  local height="$3"
  echo "📐  Resizing screenshots in $dir to ${width}×${height}"
  for f in "$dir"/*.png; do
    [[ -f "$f" ]] || continue
    sips -z "$height" "$width" "$f" --out "$f" &>/dev/null
    echo "    → $(basename "$f")"
  done
}

# ── Pre-flight checks ────────────────────────────────────────────────────────
require xcrun "Install Xcode from the App Store."
require maestro "Install with: curl -Ls https://get.maestro.mobile.dev | bash"
if $BUILD_APP; then
  require eas "Install with: npm install -g eas-cli"
fi

if [[ -z "${SCREENSHOT_EMAIL:-}" || -z "${SCREENSHOT_PASSWORD:-}" ]]; then
  echo "❌  Set SCREENSHOT_EMAIL and SCREENSHOT_PASSWORD to a demo Clerk account."
  echo "    Example: SCREENSHOT_EMAIL=demo@example.com SCREENSHOT_PASSWORD=Secret1 ./scripts/take-screenshots.sh"
  exit 1
fi

# ── Build simulator .app (unless --no-build) ─────────────────────────────────
APP_PATH=""
if $BUILD_APP; then
  echo "🔨  Building simulator app with EAS (profile: development) ..."
  cd "$APP_DIR"
  EAS_NO_VCS=1 eas build \
    --profile development \
    --platform ios \
    --local \
    --non-interactive \
    --output "$APP_DIR/build/knowyourpit-sim.tar.gz"

  echo "📦  Extracting simulator build..."
  mkdir -p "$APP_DIR/build/sim"
  tar -xzf "$APP_DIR/build/knowyourpit-sim.tar.gz" -C "$APP_DIR/build/sim"
  APP_PATH=$(find "$APP_DIR/build/sim" -name "*.app" | head -1)
  if [[ -z "$APP_PATH" ]]; then
    echo "❌  Could not find .app bundle after extraction."
    exit 1
  fi
  echo "✅  Build extracted to $APP_PATH"
else
  APP_PATH=$(find "$APP_DIR/build" -name "*.app" 2>/dev/null | head -1)
  if [[ -z "$APP_PATH" ]]; then
    echo "❌  No .app bundle found under $APP_DIR/build/. Run without --no-build first."
    exit 1
  fi
  echo "🔍  Using existing build: $APP_PATH"
fi

# ── iPhone screenshots ────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════"
echo "  iPhone 15 Pro Max screenshots"
echo "═══════════════════════════════════════"
IPHONE_UDID=$(boot_simulator "$IPHONE_DEVICE")
install_app "$IPHONE_UDID" "$APP_PATH"
run_maestro_flows "iPhone" "$SCREENSHOTS_DIR/iphone"
resize_screenshots "$SCREENSHOTS_DIR/iphone" 1290 2796

# ── iPad screenshots (optional) ───────────────────────────────────────────────
if $CAPTURE_IPAD; then
  echo ""
  echo "═══════════════════════════════════════"
  echo "  iPad Pro 13-inch (M4) screenshots"
  echo "═══════════════════════════════════════"
  IPAD_UDID=$(boot_simulator "$IPAD_DEVICE")
  install_app "$IPAD_UDID" "$APP_PATH"
  run_maestro_flows "iPad" "$SCREENSHOTS_DIR/ipad"
  resize_screenshots "$SCREENSHOTS_DIR/ipad" 2064 2752
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "🎉  Done! Screenshots saved to:"
echo "    $SCREENSHOTS_DIR/iphone/"
$CAPTURE_IPAD && echo "    $SCREENSHOTS_DIR/ipad/"
echo ""
echo "Next: review the PNGs and upload them to App Store Connect"
echo "      → https://appstoreconnect.apple.com"
