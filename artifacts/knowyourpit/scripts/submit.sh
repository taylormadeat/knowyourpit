#!/usr/bin/env bash
# submit.sh — write the App Store Connect API key then run eas submit,
# then automatically back up the build to GitHub.
# Run from the artifacts/knowyourpit directory:
#   bash scripts/submit.sh
#
# Optional secrets for GitHub backup (set in Replit Secrets):
#   GITHUB_TOKEN  — Personal access token with repo scope (or fine-grained
#                   token with Contents: write). If unset, backup is skipped.
#   GITHUB_REPO   — Target repository, e.g. "taylormadeat/knowyourpit".
#                   If unset, backup is skipped.
#   Run:  pnpm --filter @workspace/scripts run build:backup:check
#   to verify the backup env before starting a long EAS build.

set -euo pipefail

WORKSPACE_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
APP_CONFIG="${WORKSPACE_ROOT}/artifacts/knowyourpit/app.config.js"

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

# ---------------------------------------------------------------------------
# Resolve EAS build ID before submitting with --latest so the GitHub Release
# contains the actual build ID rather than a placeholder.
# ---------------------------------------------------------------------------
echo "Looking up latest finished iOS build ..."
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

if [ "$EAS_BUILD_ID" = "unknown" ]; then
    echo "Submitting to iOS (latest build — ID could not be resolved) ..."
else
    echo "Submitting to iOS (latest build, ID: ${EAS_BUILD_ID}) ..."
fi

npx eas submit --platform ios --profile production "$@"

echo ""
echo "✅ EAS submission complete."

# ---------------------------------------------------------------------------
# GitHub backup — push a git tag and create a GitHub Release for this build.
# Runs from the workspace root. Failure prints a warning but does NOT abort.
# ---------------------------------------------------------------------------

if [ -z "${GITHUB_TOKEN:-}" ] || [ -z "${GITHUB_REPO:-}" ]; then
    echo ""
    echo "ℹ️  Skipping GitHub backup: GITHUB_TOKEN and/or GITHUB_REPO are not set."
else
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
