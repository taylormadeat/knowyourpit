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
echo "[ 1/10] Running test suite …"
if pnpm test --passWithNoTests --silent 2>/dev/null; then
  log_pass "All tests pass"
else
  log_fail "Test suite has failures — do not submit"
fi

# ── 2. Typecheck ─────────────────────────────────────────────────────────────
echo ""
echo "[ 2/10] Running typecheck …"
if (cd ../.. && pnpm run typecheck 2>/dev/null); then
  log_pass "Typecheck clean"
else
  log_fail "TypeScript errors present — do not submit"
fi

# ── 3. Privacy policy URL ─────────────────────────────────────────────────────
echo ""
echo "[ 3/10] Checking public URLs …"
PRIVACY_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" https://www.knowyourpit.com/privacy)
if [ "$PRIVACY_STATUS" = "200" ]; then
  log_pass "https://www.knowyourpit.com/privacy → 200 OK"
else
  log_fail "https://www.knowyourpit.com/privacy → $PRIVACY_STATUS  (Apple will reject on 5.1.1)"
fi

TERMS_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" https://www.knowyourpit.com/terms)
if [ "$TERMS_STATUS" = "200" ]; then
  log_pass "https://www.knowyourpit.com/terms → 200 OK"
else
  log_fail "https://www.knowyourpit.com/terms → $TERMS_STATUS  (Apple requires accessible Terms link)"
fi

# ── 4. Reviewer credentials ───────────────────────────────────────────────────
echo ""
echo "[ 4/10] Checking reviewer credentials …"
# Credentials must NOT be committed to this file. Instead, paste the review
# notes template from docs/app-store-review-notes.md into App Store Connect's
# "Notes for Apple" field and fill in the credentials there at submission time.
# Source the account from 1Password "ASC Reviewer Account".
log_warn "Confirm reviewer demo credentials are entered in App Store Connect → Notes for Apple (not stored here). Source: 1Password 'ASC Reviewer Account'."

# ── 5. Privacy manifest ───────────────────────────────────────────────────────
echo ""
echo "[ 5/10] Checking PrivacyInfo.xcprivacy …"
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
echo "[ 6/10] Checking encryption declaration …"
if grep -q "ITSAppUsesNonExemptEncryption.*false" app.config.js 2>/dev/null; then
  log_pass "ITSAppUsesNonExemptEncryption = false (standard HTTPS only)"
else
  log_warn "ITSAppUsesNonExemptEncryption not found in app.config.js — verify export compliance"
fi

# ── 7. Build number sanity ────────────────────────────────────────────────────
echo ""
echo "[ 7/10] Build number …"
BUILD_NUM=$(node -e "const c=require('./app.config.js'); console.log(c.expo.ios.buildNumber);" 2>/dev/null || echo "unknown")
VERSION=$(node -e "const c=require('./app.config.js'); console.log(c.expo.version);" 2>/dev/null || echo "unknown")
echo "        Version: $VERSION   iOS build number: $BUILD_NUM"
if [ "$BUILD_NUM" = "unknown" ]; then
  log_warn "Could not read build number from app.config.js"
else
  log_pass "Build number is $BUILD_NUM — confirm this is higher than the last Apple-accepted build"
fi

# ── 8. OTA runtime version lockstep ──────────────────────────────────────────
echo ""
echo "[ 8/10 ] OTA runtime version lockstep …"
PLIST="ios/knowyourpit/Supporting/Expo.plist"
APP_VERSION=$(node -e "const c=require('./app.config.js'); console.log(c.expo.version);" 2>/dev/null || echo "unknown")
PLIST_RUNTIME=$(sed -n 's/.*<key>EXUpdatesRuntimeVersion<\/key>.*/FOUND/p' "$PLIST" >/dev/null && grep -A1 "EXUpdatesRuntimeVersion" "$PLIST" | grep -o "<string>[^<]*</string>" | sed 's/<[^>]*>//g' || echo "missing")
if [ "$PLIST_RUNTIME" = "$APP_VERSION" ]; then
  log_pass "Expo.plist EXUpdatesRuntimeVersion ($PLIST_RUNTIME) matches app version ($APP_VERSION)"
else
  log_fail "Expo.plist EXUpdatesRuntimeVersion ($PLIST_RUNTIME) ≠ app.config.js version ($APP_VERSION) — OTA will silently break on this build"
fi
if grep -A1 "EXUpdatesEnabled" "$PLIST" | grep -q "<true/>"; then
  log_pass "EXUpdatesEnabled is true"
else
  log_fail "EXUpdatesEnabled is NOT true in $PLIST — OTA updates disabled natively"
fi
if grep -q "EXUpdatesURL" "$PLIST"; then
  log_pass "EXUpdatesURL present"
else
  log_fail "EXUpdatesURL missing from $PLIST"
fi

# ── 9. Bundle smoke check (catches babel/hermesc breakage) ───────────────────
echo ""
echo "[ 9/10 ] Exporting iOS bundle and compiling with hermesc …"
# Catches two past release-breaking failures:
#   • build 137 crash: loose class-field transforms emitting bare assignments
#     over read-only inherited props ("Cannot assign to read-only property")
#   • EAS hermesc rejection: un-lowered class/async syntax reaching hermesc
SMOKE_DIR=$(mktemp -d)
if pnpm exec expo export --no-bytecode --platform ios --output-dir "$SMOKE_DIR" --clear >/dev/null 2>&1; then
  BUNDLE=$(find "$SMOKE_DIR/_expo/static/js/ios" -name "*.js" -print -quit 2>/dev/null || true)
  if [ -n "$BUNDLE" ]; then
    LOOSE_HITS=$(grep -c "this\.NONE=void 0" "$BUNDLE" 2>/dev/null || true); LOOSE_HITS=${LOOSE_HITS:-0}
    if [ "$LOOSE_HITS" -eq 0 ]; then
      log_pass "No loose class-field assignments over read-only props in bundle"
    else
      log_fail "Bundle contains loose class-field assignments (this.NONE=void 0) — will crash on launch (see build 137)"
    fi
    HERMESC="node_modules/react-native/sdks/hermesc/linux64-bin/hermesc"
    if [ -x "$HERMESC" ]; then
      if "$HERMESC" -emit-binary -out "$SMOKE_DIR/smoke.hbc" "$BUNDLE" >/dev/null 2>&1; then
        log_pass "Bundle compiles with hermesc 0.12 (strictest EAS compiler)"
      else
        log_fail "Bundle FAILS hermesc compile — EAS build will fail with XCODE_BUILD_ERROR"
      fi
    else
      log_fail "linux hermesc not found at $HERMESC — cannot verify bundle compiles; do not submit without this check"
    fi
  else
    log_fail "Export produced no iOS bundle"
  fi
else
  log_fail "expo export failed — bundle cannot be built"
fi
rm -rf "$SMOKE_DIR"

# ── 10. No placeholder / test content in shipped code ────────────────────────
echo ""
echo "[10/10] Checking for placeholder content in source …"
set +o pipefail
PLACEHOLDER_HITS=$(grep -rn "TODO\|FIXME\|PLACEHOLDER\|lorem ipsum\|test@test\|fake@" \
  --include="*.ts" --include="*.tsx" \
  --exclude-dir=node_modules --exclude-dir=__tests__ --exclude="*.test.*" --exclude="*.spec.*" \
  . 2>/dev/null | grep -v "//.*TODO\|^\s*//" | wc -l | tr -d ' ')
set -o pipefail
PLACEHOLDER_HITS=${PLACEHOLDER_HITS:-0}
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
