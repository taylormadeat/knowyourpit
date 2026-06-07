#!/usr/bin/env bash
# Submit an iOS build to TestFlight via EAS, then back it up to GitHub.
#
# Usage (run from artifacts/knowyourpit/):
#   ./scripts/submit-ios.sh                    # submits the latest finished build
#   ./scripts/submit-ios.sh <EAS_BUILD_ID>     # submits a specific build by ID
#
# Required secrets (set in Replit Secrets):
#   ASC_API_KEY_P8 — full contents of AuthKey_XXXXXXXXXX.p8 downloaded
#                    from App Store Connect (Users and Access →
#                    Integrations → App Store Connect API)
#
# Optional secrets for GitHub backup (set in Replit Secrets):
#   GITHUB_TOKEN  — Personal access token with repo scope (or fine-grained
#                   token with Contents: write). If unset, backup is skipped.
#   GITHUB_REPO   — Target repository, e.g. "taylormadeat/knowyourpit".
#                   If unset, backup is skipped.
#   Run:  pnpm --filter @workspace/scripts run build:backup:check
#   to verify the backup env before starting a long EAS build.
#
# Key ID and Issuer ID are hardcoded in eas.json submit.production.ios.
# Update them there if you rotate the ASC API key.

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_CONFIG="${WORKSPACE_ROOT}/artifacts/knowyourpit/app.config.js"
KEY_FILE="/tmp/eas_submit_key.p8"

# ---------------------------------------------------------------------------
# Pre-flight: warn (but do NOT block) if GitHub backup env is missing
# ---------------------------------------------------------------------------
if [ -z "${GITHUB_TOKEN:-}" ] || [ -z "${GITHUB_REPO:-}" ]; then
    echo ""
    echo "ℹ️  Note: GITHUB_TOKEN and/or GITHUB_REPO are not set."
    echo "   GitHub backup will be skipped after submission."
    echo "   To enable: set both in Replit Secrets and re-run."
    echo "   Verify config:  pnpm --filter @workspace/scripts run build:backup:check"
    echo ""
fi

# ---------------------------------------------------------------------------
# Write the App Store Connect API key from the secret
# ---------------------------------------------------------------------------

python3 - "$KEY_FILE" <<'EOF'
import os, re, sys

key_file = sys.argv[1]

content = os.environ.get("ASC_API_KEY_P8", "")

if not content:
    print("ERROR: ASC_API_KEY_P8 secret is not set", file=sys.stderr)
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

# ---------------------------------------------------------------------------
# Resolve EAS build ID
# When a specific build ID is passed as $1, use it directly.
# When using --latest, query EAS for the actual latest finished build ID
# so the GitHub Release contains accurate metadata.
# ---------------------------------------------------------------------------

if [ -n "${1:-}" ]; then
    BUILD_ARG="--id $1"
    EAS_BUILD_ID="${1}"
    echo "Submitting build $1 ..."
else
    echo "Looking up latest finished iOS build ..."
    # Query EAS for the latest finished iOS build to capture its real ID.
    # Falls back to "unknown" if the query fails (e.g. offline, auth issue).
    LATEST_BUILD_JSON=$(npx eas build:list \
        --platform ios \
        --status FINISHED \
        --limit 1 \
        --non-interactive \
        --json 2>/dev/null || echo "[]")
    EAS_BUILD_ID=$(node -e "
try {
  const builds = JSON.parse(process.argv[1]);
  console.log(builds[0]?.id ?? 'unknown');
} catch(e) {
  console.log('unknown');
}
" "$LATEST_BUILD_JSON" 2>/dev/null || echo "unknown")
    BUILD_ARG="--latest"
    if [ "$EAS_BUILD_ID" = "unknown" ]; then
        echo "Submitting latest finished build (ID could not be resolved) ..."
    else
        echo "Submitting latest finished build (ID: ${EAS_BUILD_ID}) ..."
    fi
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
EAS_BIN="${SCRIPT_DIR}/../node_modules/.bin/eas"
if [ ! -x "$EAS_BIN" ]; then
    EAS_BIN="npx eas"
fi
$EAS_BIN submit --platform ios $BUILD_ARG --non-interactive

echo ""
echo "✅ EAS submission complete."

# ---------------------------------------------------------------------------
# GitHub backup — push a git tag and create a GitHub Release for this build.
# Runs from the workspace root (two levels up from artifacts/knowyourpit/).
# A failure here prints a warning but does NOT fail the overall script.
# ---------------------------------------------------------------------------

if [ -z "${GITHUB_TOKEN:-}" ] || [ -z "${GITHUB_REPO:-}" ]; then
    echo ""
    echo "ℹ️  Skipping GitHub backup: GITHUB_TOKEN and/or GITHUB_REPO are not set."
else
    # Read version and buildNumber from app.config.js
    VERSION=$(node -e "const c = require('${APP_CONFIG}'); console.log(c.expo.version)" 2>/dev/null || echo "")
    BUILD_NUMBER=$(node -e "const c = require('${APP_CONFIG}'); console.log(c.expo.ios.buildNumber)" 2>/dev/null || echo "")

    if [ -z "$VERSION" ] || [ -z "$BUILD_NUMBER" ]; then
        echo ""
        echo "⚠️  GitHub backup skipped: could not read version/buildNumber from app.config.js."
    else
        echo ""
        echo "📦 Starting GitHub backup (v${VERSION}, build #${BUILD_NUMBER}) ..."
        (
            cd "${WORKSPACE_ROOT}"
            pnpm --filter @workspace/scripts run build:backup -- \
                --platform ios \
                --buildNumber "${BUILD_NUMBER}" \
                --version "${VERSION}" \
                --easBuildId "${EAS_BUILD_ID}"
        ) || {
            echo ""
            echo "⚠️  GitHub backup failed (see output above). The TestFlight submission"
            echo "   was still successful. You can retry the backup manually:"
            echo ""
            echo "   pnpm --filter @workspace/scripts run build:backup -- \\"
            echo "       --platform ios \\"
            echo "       --buildNumber ${BUILD_NUMBER} \\"
            echo "       --version ${VERSION} \\"
            echo "       --easBuildId ${EAS_BUILD_ID}"
            echo ""
        }
    fi
fi
