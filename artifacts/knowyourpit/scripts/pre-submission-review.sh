#!/usr/bin/env bash
# =============================================================================
# pre-submission-review.sh
#
# Runs every check Apple's reviewers run (or trigger a rejection with) before
# a build is submitted to TestFlight / App Store.
#
# Usage:  bash scripts/pre-submission-review.sh
# Exit:   0 = all checks passed   1 = one or more blockers found
# =============================================================================

set -euo pipefail
cd "$(dirname "$0")/.."

PASS="✅"
WARN="⚠️ "
FAIL="🔴"
SEP="──────────────────────────────────────────────────────"

blockers=0
warnings=0

log_pass() { echo "$PASS  $1"; }
log_warn() { echo "$WARN $1"; ((warnings++)) || true; }
log_fail() { echo "$FAIL  $1"; ((blockers++)) || true; }

echo ""
echo "$SEP"
echo "  knowyourpit — Pre-Submission Review"
echo "$SEP"

# ── 1. Tests ─────────────────────────────────────────────────────────────────
echo ""
echo "[ 1/8 ] Running test suite …"
if pnpm test --passWithNoTests --silent 2>/dev/null; then
  log_pass "All tests pass"
else
  log_fail "Test suite has failures — do not submit"
fi

# ── 2. Typecheck ─────────────────────────────────────────────────────────────
echo ""
echo "[ 2/8 ] Running typecheck …"
if (cd ../.. && pnpm run typecheck 2>/dev/null); then
  log_pass "Typecheck clean"
else
  log_fail "TypeScript errors present — do not submit"
fi

# ── 3. Privacy policy URL ─────────────────────────────────────────────────────
echo ""
echo "[ 3/8 ] Checking public URLs …"
PRIVACY_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" https://knowyourpit.com/privacy)
if [ "$PRIVACY_STATUS" = "200" ]; then
  log_pass "https://knowyourpit.com/privacy → 200 OK"
else
  log_fail "https://knowyourpit.com/privacy → $PRIVACY_STATUS  (Apple will reject on 5.1.1)"
fi

TERMS_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" https://knowyourpit.com/terms)
if [ "$TERMS_STATUS" = "200" ]; then
  log_pass "https://knowyourpit.com/terms → 200 OK"
else
  log_fail "https://knowyourpit.com/terms → $TERMS_STATUS  (Apple requires accessible Terms link)"
fi

# ── 4. Reviewer credentials ───────────────────────────────────────────────────
echo ""
echo "[ 4/8 ] Checking reviewer credentials in review notes …"
REVIEW_NOTES="docs/app-store-review-notes.md"
if grep -q "INSERT REVIEWER" "$REVIEW_NOTES" 2>/dev/null; then
  log_fail "Reviewer credentials are still placeholders in $REVIEW_NOTES — fill in before submitting"
else
  log_pass "Reviewer credentials appear to be filled in"
fi

# ── 5. Privacy manifest ───────────────────────────────────────────────────────
echo ""
echo "[ 5/8 ] Checking PrivacyInfo.xcprivacy …"
MANIFEST="plugins/with-privacy-manifest/PrivacyInfo.xcprivacy"
if [ -f "$MANIFEST" ]; then
  if grep -q "NSPrivacyTracking" "$MANIFEST" && grep -q "NSPrivacyAccessedAPITypes" "$MANIFEST"; then
    log_pass "PrivacyInfo.xcprivacy present and contains required keys"
  else
    log_fail "PrivacyInfo.xcprivacy is missing required keys (NSPrivacyTracking / NSPrivacyAccessedAPITypes)"
  fi
else
  log_fail "PrivacyInfo.xcprivacy not found at $MANIFEST"
fi

# ── 6. ITSAppUsesNonExemptEncryption ─────────────────────────────────────────
echo ""
echo "[ 6/8 ] Checking encryption declaration …"
if grep -q "ITSAppUsesNonExemptEncryption.*false" app.config.js 2>/dev/null; then
  log_pass "ITSAppUsesNonExemptEncryption = false (standard HTTPS only)"
else
  log_warn "ITSAppUsesNonExemptEncryption not found in app.config.js — verify export compliance"
fi

# ── 7. Build number sanity ────────────────────────────────────────────────────
echo ""
echo "[ 7/8 ] Build number …"
BUILD_NUM=$(node -e "const c=require('./app.config.js'); console.log(c.expo.ios.buildNumber);" 2>/dev/null || echo "unknown")
VERSION=$(node -e "const c=require('./app.config.js'); console.log(c.expo.version);" 2>/dev/null || echo "unknown")
echo "        Version: $VERSION   iOS build number: $BUILD_NUM"
if [ "$BUILD_NUM" = "unknown" ]; then
  log_warn "Could not read build number from app.config.js"
else
  log_pass "Build number is $BUILD_NUM — confirm this is higher than the last Apple-accepted build"
fi

# ── 8. No placeholder / test content in shipped code ─────────────────────────
echo ""
echo "[ 8/8 ] Checking for placeholder content in source …"
PLACEHOLDER_HITS=$(grep -rn "TODO\|FIXME\|PLACEHOLDER\|lorem ipsum\|test@test\|fake@" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=__tests__ --exclude="*.test.*" --exclude="*.spec.*" \
  . 2>/dev/null | grep -v "//.*TODO\|^\s*//" | wc -l | tr -d ' ')
if [ "$PLACEHOLDER_HITS" -eq 0 ]; then
  log_pass "No placeholder / test content found in shipped source"
else
  log_warn "$PLACEHOLDER_HITS potential placeholder hits in source — review before submitting:"
  grep -rn "TODO\|FIXME\|PLACEHOLDER\|lorem ipsum\|test@test\|fake@" \
    --include="*.ts" --include="*.tsx" \
    --exclude-dir=node_modules --exclude-dir=__tests__ --exclude="*.test.*" --exclude="*.spec.*" \
    . 2>/dev/null | grep -v "//.*TODO\|^\s*//" | head -10
fi

# ── Summary ───────────────────────────────────────────────────────────────────
echo ""
echo "$SEP"
if [ "$blockers" -eq 0 ] && [ "$warnings" -eq 0 ]; then
  echo "  ✅  ALL CHECKS PASSED — safe to submit"
elif [ "$blockers" -eq 0 ]; then
  echo "  ⚠️   $warnings warning(s), 0 blockers — review warnings before submitting"
else
  echo "  🔴  $blockers blocker(s), $warnings warning(s) — DO NOT SUBMIT until blockers are fixed"
fi
echo "$SEP"
echo ""

exit $blockers
