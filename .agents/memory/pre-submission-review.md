---
name: Pre-submission review — run before every iOS build submission
description: Checklist and script to run before every TestFlight/App Store submission to catch Apple rejection triggers.
---

# Pre-Submission Review

## The rule
**Always run `bash artifacts/knowyourpit/scripts/pre-submission-review.sh` before submitting any build to TestFlight or the App Store.** Do not submit if the script exits with blockers (exit code 1).

**Why:** Apple's reviewers check privacy policy URL, terms URL, test account credentials, privacy manifest, and encryption declaration on every submission. A 404 on the privacy page is an automatic rejection under Guideline 5.1.1.

## How to apply
Before running `eas submit` or triggering the GitHub Actions submit workflow:
1. Run the pre-submission review script — it checks 8 items and exits 0 only if all blockers are clear.
2. Fix any 🔴 blockers before submitting.
3. Review ⚠️ warnings.
4. Then submit.

## Current known blockers (as of August 2026)
- https://knowyourpit.com/privacy returns 404 — knowyourpit.com is hosted on GoDaddy (NOT the Replit marketing site); pages must be created there. Standalone HTML files exported to `artifacts/marketing/dist/standalone/privacy.html` and `terms.html` for pasting into GoDaddy's HTML block editor.
- https://knowyourpit.com/terms returns 404 — same as above.
- Reviewer credentials in `docs/app-store-review-notes.md` are still placeholder text

## Important: knowyourpit.com hosting
The live domain knowyourpit.com is served by GoDaddy, not by the Replit marketing artifact.
The Replit marketing site (artifacts/marketing) is a separate codebase that does NOT serve the live domain.
Any changes to public-facing pages (privacy, terms, support) must be made in GoDaddy's site editor.

## Script location
`artifacts/knowyourpit/scripts/pre-submission-review.sh`

Also registered as a named validation step: `pre-submission-review`

## Checklist covered by the script
1. Test suite (815 tests as of August 2026)
2. Typecheck (zero TypeScript errors)
3. Privacy policy URL (https://knowyourpit.com/privacy) → must be 200
4. Terms URL (https://knowyourpit.com/terms) → must be 200
5. Reviewer credentials not placeholder in docs/app-store-review-notes.md
6. PrivacyInfo.xcprivacy present with NSPrivacyTracking + NSPrivacyAccessedAPITypes
7. ITSAppUsesNonExemptEncryption = false in app.config.js
8. Build number readable from app.config.js (manual confirm it's higher than last Apple-accepted)
