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

## What the local check cannot verify
- The script intentionally never reads or stores reviewer credentials. Confirm the protected demo-account fields directly in App Store Connect before submitting.
- It cannot verify that the processed build's marketing version matches the editable App Store version, or that the build is attached. Run a live ASC audit after the script passes.
- The direct secondary-category relationship endpoint is read-only. If a change is needed, update the parent app-info resource and still confirm the result in the ASC web UI.

## Important: knowyourpit.com hosting (corrected)
knowyourpit.com IS hosted on Replit (GoDaddy is only the registrar). The verified deployment domains are
**www.knowyourpit.com** (marketing site) and api.knowyourpit.com. The apex domain only 301-redirects at `/`;
all other apex paths return 404 — always use www URLs for deep links (privacy/terms).

**SPA routing lesson:** Replit's static artifact handler ignored the `[[services.production.rewrites]]` rules
entirely (even `/index.html` by name returned 404 — only `/` was served). Fix: marketing artifact runs
`vite preview` as a runnable production service instead of `serve = "static"`. A code review flagged vite
preview as non-production-grade; accepted as a deliberate exception because the supported static+rewrite path
was demonstrably broken on the platform. If the platform static rewrites start working, switching back is fine.

## Script location
`artifacts/knowyourpit/scripts/pre-submission-review.sh`

Also registered as a named validation step: `pre-submission-review`

## Checklist covered by the script
1. Test suite (815 tests as of August 2026)
2. Typecheck (zero TypeScript errors)
3. Privacy policy URL (https://www.knowyourpit.com/privacy) → must be 200
4. Terms URL (https://www.knowyourpit.com/terms) → must be 200
5. Reviewer credentials not placeholder in docs/app-store-review-notes.md
6. PrivacyInfo.xcprivacy present with NSPrivacyTracking + NSPrivacyAccessedAPITypes
7. ITSAppUsesNonExemptEncryption = false in app.config.js
8. Build number readable from app.config.js (manual confirm it's higher than last Apple-accepted)

## Post-URL-fix reminder
The in-app privacy/terms links were changed to www URLs after build 132 was produced — any submission
must be a NEW build (bump build number) so the binary contains the working www links.
