#!/usr/bin/env bash
# Submit an iOS build to TestFlight via EAS.
#
# Usage (run from artifacts/knowyourpit/):
#   ./scripts/submit-ios.sh                    # submits the latest finished build
#   ./scripts/submit-ios.sh <EAS_BUILD_ID>     # submits a specific build by ID
#
# Required secret (set in Replit Secrets):
#   ASC_API_KEY_P8 — full contents of AuthKey_XXXXXXXXXX.p8 downloaded
#                    from App Store Connect (Users and Access →
#                    Integrations → App Store Connect API)
#   (ASC_API_KEY_P8_CONTENT is also accepted for backwards compatibility)
#
# Key ID and Issuer ID are hardcoded in eas.json submit.production.ios.
# Update them there if you rotate the ASC API key.

set -euo pipefail

KEY_FILE="/tmp/eas_submit_key.p8"

python3 - "$KEY_FILE" <<'EOF'
import os, re, sys

key_file = sys.argv[1]

# Accept either secret name (ASC_API_KEY_P8 is preferred; ASC_API_KEY_P8_CONTENT for backwards compat)
content = os.environ.get("ASC_API_KEY_P8") or os.environ.get("ASC_API_KEY_P8_CONTENT", "")

if not content:
    print("ERROR: ASC_API_KEY_P8 secret is not set (also accepts ASC_API_KEY_P8_CONTENT)", file=sys.stderr)
    sys.exit(1)

# Some secret stores persist newlines as literal \n — normalise them first
content = content.replace("\\n", "\n")

match = re.search(r"-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----", content, re.DOTALL)
if not match:
    print("ERROR: ASC_API_KEY_P8 does not look like a valid PEM key", file=sys.stderr)
    sys.exit(1)

b64 = re.sub(r"\s+", "", match.group(1))
chunks = [b64[i:i+64] for i in range(0, len(b64), 64)]
pem = "-----BEGIN PRIVATE KEY-----\n" + "\n".join(chunks) + "\n-----END PRIVATE KEY-----\n"

with open(key_file, "w") as f:
    f.write(pem)

print(f"Key written to {key_file}")
EOF

BUILD_ARG=""
if [ -n "${1:-}" ]; then
    BUILD_ARG="--id $1"
    echo "Submitting build $1 ..."
else
    echo "Submitting latest finished build ..."
fi

npx eas submit --platform ios $BUILD_ARG --non-interactive
