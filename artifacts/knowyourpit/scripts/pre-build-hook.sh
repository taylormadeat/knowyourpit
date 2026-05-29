#!/usr/bin/env bash
# Pre-install EAS build hook.
# Writes GOOGLE_SERVICES_JSON secret to disk so the Android build can find it.
# Safe to run on iOS builders — exits silently if the secret is not set.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TARGET="$PROJECT_ROOT/google-services.json"

if [ -z "${GOOGLE_SERVICES_JSON:-}" ]; then
  echo "[pre-build-hook] GOOGLE_SERVICES_JSON not set — skipping (iOS build or secret not configured)."
  exit 0
fi

echo "[pre-build-hook] Writing google-services.json..."
printf '%s' "$GOOGLE_SERVICES_JSON" > "$TARGET"
echo "[pre-build-hook] Done: $TARGET"
