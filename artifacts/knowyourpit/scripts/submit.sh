#!/usr/bin/env bash
# submit.sh — write the App Store Connect API key then run eas submit.
# Run from the artifacts/knowyourpit directory:
#   bash scripts/submit.sh
set -euo pipefail

if [ -z "${ASC_API_KEY_P8:-}" ]; then
  echo "ERROR: ASC_API_KEY_P8 environment variable is not set." >&2
  exit 1
fi

printf '%s' "$ASC_API_KEY_P8" > /tmp/eas_submit_key.p8
chmod 600 /tmp/eas_submit_key.p8
echo "Key written to /tmp/eas_submit_key.p8"

exec npx eas submit --platform ios --profile production "$@"
