#!/usr/bin/env bash
set -euo pipefail

REPO="github.com/taylormadeat/knowyourpit"

if [ -z "${GITHUB_PAT:-}" ]; then
  echo "Error: GITHUB_PAT environment variable is not set." >&2
  exit 1
fi

ASKPASS_SCRIPT="$(mktemp)"
trap 'rm -f "$ASKPASS_SCRIPT"' EXIT

cat >"$ASKPASS_SCRIPT" <<'EOF'
#!/usr/bin/env bash
case "$1" in
  *Username*) printf '%s\n' "x-access-token" ;;
  *Password*) printf '%s\n' "${GITHUB_PAT}" ;;
  *) printf '\n' ;;
esac
EOF
chmod 700 "$ASKPASS_SCRIPT"
export GITHUB_PAT

echo "Pushing HEAD to main on ${REPO}..."
GIT_ASKPASS="$ASKPASS_SCRIPT" GIT_TERMINAL_PROMPT=0 \
  git push "https://${REPO}.git" HEAD:main
echo "Done."
