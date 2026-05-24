#!/usr/bin/env bash
# Submit an Android build to Google Play via EAS.
#
# Usage (run from artifacts/knowyourpit/):
#   ./scripts/submit-android.sh                    # submits the latest finished build
#   ./scripts/submit-android.sh <EAS_BUILD_ID>     # submits a specific build by ID
#
# Required secret (set in Replit Secrets):
#   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON — full contents of the Google Play service
#                                      account JSON key file downloaded from
#                                      Google Cloud Console (IAM & Admin → Service Accounts)
#
# The service account must have the "Release Manager" role in Google Play Console
# (Setup → API access → link a Google Cloud project → grant access).

set -euo pipefail

SA_FILE="/tmp/google-play-sa.json"

python3 - "$SA_FILE" <<'EOF'
import os, sys, json

sa_file = sys.argv[1]

content = os.environ.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON", "")

if not content:
    print("ERROR: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON secret is not set", file=sys.stderr)
    sys.exit(1)

# Validate it looks like a service account JSON
try:
    parsed = json.loads(content)
    if parsed.get("type") != "service_account":
        print("ERROR: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON does not look like a service account key (missing type=service_account)", file=sys.stderr)
        sys.exit(1)
except json.JSONDecodeError as e:
    print(f"ERROR: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON: {e}", file=sys.stderr)
    sys.exit(1)

with open(sa_file, "w") as f:
    f.write(content)

print(f"Service account key written to {sa_file}")
EOF

BUILD_ARG=""
if [ -n "${1:-}" ]; then
    BUILD_ARG="--id $1"
    echo "Submitting build $1 ..."
else
    echo "Submitting latest finished build ..."
fi

npx eas submit --platform android --profile production \
    --android-service-account-key-path "$SA_FILE" \
    $BUILD_ARG --non-interactive
