#!/usr/bin/env bash
set -euo pipefail

REPO="github.com/taylormadeat/knowyourpit"

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "Error: GITHUB_PAT environment variable is not set." >&2
  exit 1
fi

REMOTE_URL="https://${GITHUB_PAT}@${REPO}.git"

echo "Pushing HEAD to main on ${REPO}..."
git push "$REMOTE_URL" HEAD:main
echo "Done."
