#!/usr/bin/env bash
# submit.sh — write the App Store Connect API key then run eas submit.
# Run from the artifacts/knowyourpit directory:
#   bash scripts/submit.sh
set -euo pipefail

if [ -z "${ASC_API_KEY_P8:-}" ]; then
  echo "ERROR: ASC_API_KEY_P8 environment variable is not set." >&2
  exit 1
fi

# Normalize the PEM format. Ruby's OpenSSL (used by fastlane spaceship)
# requires the BEGIN/END markers on their own lines and base64 wrapped to
# 64 chars per line. If the secret was stored as a single line it will
# fail with "invalid curve name". Rebuild the PEM defensively.
python3 - <<'PY' > /tmp/eas_submit_key.p8
import os, re, sys, textwrap
raw = os.environ["ASC_API_KEY_P8"]
# Convert literal "\n" sequences to real newlines if any
raw = raw.replace("\\n", "\n")
# Extract base64 between markers, ignoring any whitespace
m = re.search(
    r"-----BEGIN PRIVATE KEY-----(.*?)-----END PRIVATE KEY-----",
    raw,
    re.DOTALL,
)
if not m:
    sys.stderr.write("ERROR: ASC_API_KEY_P8 is not a PEM private key\n")
    sys.exit(1)
body = re.sub(r"\s+", "", m.group(1))
wrapped = "\n".join(textwrap.wrap(body, 64))
sys.stdout.write(
    "-----BEGIN PRIVATE KEY-----\n" + wrapped + "\n-----END PRIVATE KEY-----\n"
)
PY
chmod 600 /tmp/eas_submit_key.p8
echo "Key written to /tmp/eas_submit_key.p8 ($(wc -l < /tmp/eas_submit_key.p8) lines)"

exec npx eas submit --platform ios --profile production "$@"
