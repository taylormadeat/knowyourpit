#!/usr/bin/env bash
# register-app-ids.sh
#
# Ensures all four KnowYourPit bundle IDs are registered in the Apple Developer
# Portal so that EAS can generate provisioning profiles without manual work.
#
# Run this once before a production (or preview) iOS build whenever a new
# bundle ID has been added to the project:
#
#   cd artifacts/knowyourpit
#   pnpm run register:app-ids       # via package.json script
#   bash scripts/register-app-ids.sh  # directly
#
# CI / pre-build hook usage:
#   Add the following step to your CI pipeline BEFORE `eas build`:
#
#     - name: Register Apple App IDs
#       run: |
#         cd artifacts/knowyourpit
#         EXPO_NO_DOTENV=1 bash scripts/register-app-ids.sh
#
#   For fully non-interactive CI, configure an App Store Connect API key in
#   EAS (Issuer ID, Key ID, and the .p8 file) via the EAS dashboard or
#   `eas credentials` and store the key as an EAS secret. Once configured,
#   `eas credentials` will use the API key instead of prompting for an Apple
#   ID and password.
#
# Requirements:
#   - EAS CLI installed  (npx eas-cli@latest or npm i -g eas-cli)
#   - Logged in to EAS   (eas login)
#   - Apple Developer credentials configured in EAS
#     (run `eas credentials --platform ios` interactively for first-time setup)
#
# Bundle IDs managed by this project
# (defined in plugins/with-watch-app/index.ts):
#
#   com.knowyourpit.app                     — main iPhone app
#   com.knowyourpit.app.watchkitapp         — WatchKit app shell
#   com.knowyourpit.app.watchkitextension   — WatchKit extension
#   com.knowyourpit.complications           — WidgetKit complications
#
# How auto-registration works:
#   EAS Build with credentialsSource:"remote" automatically calls the Apple
#   Developer API to register any bundle ID that does not yet exist in the
#   portal and then creates or updates the matching provisioning profile.
#   This script runs `eas credentials --platform ios` which performs the same
#   registration step up-front (outside of a build) so you can verify the
#   portal state before triggering a build.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "=== KnowYourPit: Apple App ID registration ==="
echo ""
echo "Bundle IDs that must exist in the Apple Developer Portal:"
echo "  com.knowyourpit.app"
echo "  com.knowyourpit.app.watchkitapp"
echo "  com.knowyourpit.app.watchkitextension"
echo "  com.knowyourpit.complications"
echo ""

if ! command -v eas &>/dev/null && ! npx --yes eas-cli@latest --version &>/dev/null 2>&1; then
  echo "ERROR: eas-cli not found. Install with: npm install -g eas-cli" >&2
  exit 1
fi

EAS_CMD="eas"
if ! command -v eas &>/dev/null; then
  EAS_CMD="npx --yes eas-cli@latest"
fi

echo "Running: ${EAS_CMD} credentials --platform ios"
echo "(EAS will detect all targets from the Xcode project and register any"
echo " missing App IDs and provisioning profiles in the Developer Portal.)"
echo ""

${EAS_CMD} credentials --platform ios

echo ""
echo "=== Registration complete ==="
echo ""
echo "Verify App IDs in the Apple Developer Portal:"
echo "  https://developer.apple.com/account/resources/identifiers/list"
echo ""
echo "Then run your build:"
echo "  eas build --platform ios --profile production"
