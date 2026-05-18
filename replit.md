# knowyourpit

## Overview

knowyourpit is an AI-powered BBQ planning and management application. It offers tools for managing grill profiles, logging cook sessions, and providing AI-driven cook plans and time predictions. The app also features temperature monitoring, recipe management, and personalized pit master coaching.

## User Preferences

- All `eas` and `expo` commands must be run from `artifacts/knowyourpit/`, never from the workspace root.
- Do not delete the disabled Apple Watch companion app code; it is the starting point for future modernization work.

## System Architecture

The project uses a monorepo structure managed by pnpm workspaces. It is built with Node.js 24 and TypeScript 5.9.

**Core Technologies:**
- **Mobile App**: Expo / React Native
- **API Framework**: Express 5 (served at `/api`)
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **AI**: OpenAI via Replit AI Integrations

**UI/UX and Features:**
- **Dashboard**: Provides an overview of stats, recent cooks, and quick actions.
- **Grill Profiles**: Allows CRUD operations for managing different grills, including their history and statistics.
- **Cook Logger**: Records cook sessions with details like food type, weight, target temperatures, status, notes, and ratings.
- **AI Assistant & Predictions**: Offers natural language BBQ guidance and intelligent cook time predictions based on various parameters.
- **Temperature Monitoring**: Supports uploading data from various temperature probes (MEATER, ThermoWorks, Inkbird, Govee) and displays historical data with charts.
- **Recipes**: Enables browsing, searching, favoriting, and managing BBQ recipes.
- **Alerts**: Users can set temperature thresholds and rules for notifications.
- **Competition Mode (Pro)**: A plan type — third option in the Plan tab's three-way toggle (Single Cook / Multi-Cook / Competition). Pro-gated; selecting it opens the CompetitionSetupModal and cancelling reverts the toggle to "Single". Backwards-plans a 4-category competition (chicken, ribs, pork, brisket) to per-item turn-in times. The server deterministically recomputes `grillLightAt` / `meatOnAt` / `estimatedFinishAt` from each item's `turnInAt` and emits a per-item `warning` when a back-planned start is already in the past or unrealistically tight. The session view renders a competition badge, category chips, real-time countdowns to each turn-in (red inside the last 30 min), a 15-minute box-packing step, and a "Log Your Results" sheet. The setup modal has a per-category `walkMinutes` stepper. The session screen provides: (1) KCBS granular score entry (Appearance 0–60, Taste 0–150, Texture 0–150) with auto-computed total and progress bar; (2) team-count field + real-time percentile display (e.g. "Top 12%"); (3) Box Presentation Checklist modal per category (tap from expanded plan steps); (4) "Last Time" collapsible reference panel showing prior competition results for that category including sub-scores; (5) walk-to-turn-in push notification scheduled `walkMinutes` before each turn-in; (6) turn-in timeline shows "Leave N min early" label. Cook Log cards show percentile and sub-score totals. Competition Career screen (More → Competition Career) aggregates lifetime stats, per-category sub-score averages and trend bars. PitMaster Score blends placement and judge quality (sub-scores normalized to 0–100, fallback to total judgeScore/360). Constants: `COMPETITION_BOX_CHECKLIST`, `COMPETITION_WALK_TIME_DEFAULT_MINUTES`, `COMPETITION_SCORING`, `computePercentile`, `placementLabel` — all in `constants/competitionKnowledge.ts`. DB columns added: `judge_score_appearance`, `judge_score_taste`, `judge_score_texture` (real), `competition_team_count` (integer). All constants use the `COMPETITION_` prefix.
- **Frozen Meat Planning**: Cooks can be flagged frozen with a chosen thaw method (refrigerator / cold-water / microwave / counter / cook-from-frozen). The Plan tab + AI predict route factor thaw + temper time into estimates; notifications fire when thaw and temper windows complete. The frozen-from flag is persisted on the Cook record so the Cook detail view shows the original state, not just the planning input.
- **Authentication**: Clerk (`@clerk/expo`). Email + password is primary. Google SSO works in dev and (once enabled in the prod Clerk instance) in production. Apple Sign-In is shown only when `AppleAuthentication.isAvailableAsync()` returns true; on iOS the native Apple flow exchanges an identity token via Clerk's `oauth_token_apple` strategy. All auth screens (`sign-in`, `sign-up`, `set-username`) render with the dark palette unconditionally via `useAuthColors()` regardless of system theme. Sign-in / sign-up handlers map Clerk error codes to user-friendly messages.
- **Account Deletion (Apple compliance)**: Reachable from the More tab → "Delete account". `DELETE /api/profile/me` wipes the user's cooks, temperature readings, alerts, AI conversations, custom meat cuts, grills, MEATER/ThermoWorks credentials, subscription entitlements, and AI-analyze events in a single transaction, then deletes the Clerk user. If Clerk delete fails the data is still gone and the client signs the user out with a "contact support" message — no orphan-data state is possible.

**Technical Implementations:**
- **API Codegen**: Utilizes Orval for generating API hooks and Zod schemas from an OpenAPI specification.
- **Build System**: esbuild for CJS bundles.
- **Database Schema**: Key tables include `grills`, `cooks`, `recipes`, `temperature_readings`, `alerts`, and `conversations`/`messages`.
- **Environment Variables**: Server-side vars managed through `DATABASE_URL`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, and `SESSION_SECRET`. Mobile `EXPO_PUBLIC_*` vars are fully documented and audited in `artifacts/knowyourpit/ENV.md`.
- **Shared Brand Assets (lib/brand-assets)**: Canonical package holding three files: `app-icon.png` (the circular grill icon), `logo.png` (the brand logo — distinct from the icon for future design flexibility), and `wordmark.png`. The marketing site (`public/icon.png` → app-icon, `public/logo.png` → logo, `public/wordmark.png`), promo-video (`public/brand/app-icon.png`, `app-logo.png` → logo, `marketing-logo.png` → logo, `wordmark.png`), and mobile app (`assets/images/icon.png` → app-icon, `assets/images/logo.png` → logo) all point to these files via relative symlinks — updating a file in one place propagates everywhere.
- **Marketing Website (artifacts/marketing)**: A React + Vite application serving the landing page, privacy policy, terms of service, and support pages. It includes a contact form backend integrated with the API server.
- **Production Routing**: The deployed project hosts both the API server and the marketing static site. `/api/*` and `/health` are handled by the API server, while all other paths are served by the marketing site. Custom domain setup involves specific DNS records for `knowyourpit.com` and `www.knowyourpit.com`.

## External Dependencies

- **OpenAI**: Integrated for AI assistant and prediction functionalities through Replit AI Integrations (gpt-5.2).
- **PostgreSQL**: Used as the primary database, managed with Drizzle ORM.
- **Expo/React Native**: Framework for mobile application development.
- **MEATER, ThermoWorks, Inkbird, Govee**: External temperature probe brands supported for data upload.
- **Apple Push Notification Service (APNS)**: Implicitly used for mobile alerts and notifications via Expo.
- **Clerk**: Potentially used for authentication, though the contact form is not behind Clerk auth.
- **express-rate-limit**: Middleware used on the API server for rate limiting, specifically on the contact form endpoint.
- **Let's Encrypt**: Used for automatic TLS certificate provisioning for custom domains.
- **RevenueCat**: Subscription paywall — `pro` entitlement (monthly + annual). Mobile uses `react-native-purchases`; admin scripts in `scripts/src/{seedRevenueCatProducts,grantPro,revokePro}.ts` use `@replit/revenuecat-sdk` via the Replit RevenueCat connector. Server-side gates live in `artifacts/api-server/src/lib/paywall.ts` and emit a uniform 402 response via `respondPaywall(res, ...)`. Set `PAYWALL_ENABLED=false` to bypass every gate globally.
- **App Store Connect API Key (EAS submit)**: Used by `artifacts/knowyourpit/scripts/submit-ios.sh` to upload iOS builds to TestFlight. Current active key: ID `3WTDG9D596`, Issuer ID `2548969f-a92c-4ab7-b550-342a8afa0b37` (rotated from `3J5AF7DP8R` on 2026-05-09 — old key was revoked in App Store Connect). Key content stored in the `ASC_API_KEY_P8` Replit secret. Key ID is also set in `ASC_API_KEY_ID` secret and hardcoded in `artifacts/knowyourpit/eas.json` under `submit.production.ios.ascApiKeyId`.

## Database Schema Sync Behaviour

`drizzle-kit push --force` only creates and alters tables that exist in the Drizzle schema; it does **not** drop tables that have been removed from the schema. To prevent orphan tables accumulating in the dev database after schema removals, the post-merge setup script (`scripts/post-merge.sh`) runs two steps in order:

1. **`drop-orphans`** (`lib/db/src/drop-orphan-tables.ts`) — queries `pg_tables` for every table in the `public` schema, compares against the Drizzle schema exports, and issues `DROP TABLE … CASCADE` for any table that is absent from the schema.
2. **`push-force`** — pushes the current schema to the dev database, auto-approving any destructive column/index changes.

This means removing a table from `lib/db/src/schema/index.ts` and merging the task is sufficient to drop it from dev on the next post-merge run. No manual `DROP TABLE` step is needed.

**Safety gate**: `drop-orphan-tables.ts` requires `ALLOW_ORPHAN_DROP=true` to be set in the environment; otherwise it exits with an error. This prevents the script from running accidentally against a production database. The post-merge script sets this variable inline (`ALLOW_ORPHAN_DROP=true pnpm …`). **Never** set `ALLOW_ORPHAN_DROP=true` when `DATABASE_URL` points to the production database.

### Production orphan-table cleanup (runbook)

When a table is removed from the Drizzle schema and merged, it is automatically dropped from the **dev** database by the post-merge script. Production requires a manual step using the dedicated admin script:

```
# Step 1 — dry-run: inspect what will be dropped (no changes made)
DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \
  pnpm --filter @workspace/scripts run db:prod-drop-orphans

# Step 2 — live drop: actually remove the orphan tables
DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \
  pnpm --filter @workspace/scripts run db:prod-drop-orphans -- --confirm
```

Script: `scripts/src/drop-orphan-tables-prod.ts`

**Safety gates (both must be satisfied before any table is dropped):**

1. `ALLOW_PROD_DROPS=1` must be set — explicit acknowledgement that the target is production and drops are intentional.
2. `--confirm` must be passed as a CLI argument — without it the script runs in dry-run mode, printing the orphan list and exiting cleanly.

Always run the dry-run first to review the list before passing `--confirm`. The `drop-orphans` script (dev) is **never** run against production.

## Ops Log

- **2026-05-18 — Build #93 queued to TestFlight**: EAS build id `3afad68c-8c1c-44a5-8271-dbbe1c02c784`. Features: first-launch onboarding walkthrough (#684 — 6 slides, brand-orange palette, Skip→last slide, AsyncStorage+Clerk completion persistence, account-age gate so existing users never see it); onboarding replay from More → Help (#695); BetaWelcomeModal deleted (#696); Contact support row opens in-app support modal (#697, #700 — posts to `/api/contact` with source field); close button + back button in replay mode (#698, #701). Note: EAS_NO_VCS=1 required.

- **2026-05-11 — Build #89 queued to TestFlight (email verification fix)**: Root cause of email/password sign-up failure in prod: Clerk's production instance requires email address verification before an account can be finalized; the sign-up screen was skipping this step and trying to set the username immediately, which Clerk rejected. Fix: added a verification code step — after `signUp.create()`, if `unverifiedFields` includes `email_address`, calls `prepareEmailAddressVerification({ strategy: "email_code" })` and switches to a dedicated "Check your email" view with a large centered OTP input (number-pad, autoComplete one-time-code, auto-focus). `handleVerify` calls `attemptEmailAddressVerification`, then handles any remaining `missing_requirements` (username auto-set), then `setActive` + navigate. Resend and back button included. Sign-in flow unaffected — verification fires once at account creation only; existing users unaffected. EAS build id `4999ea3c-b4e3-46d9-a71d-bd0989a9a18d`. Note: EAS_NO_VCS=1 required.

- **2026-05-11 — IAP MISSING_METADATA fixed (task #594, no new build needed)**:
  - Root cause confirmed via build #88 diagnostics: RC error "None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect" — both `com.knowyourpit.pro.annual` and `com.knowyourpit.pro.monthly` were in MISSING_METADATA, blocking StoreKit from serving them even in sandbox.
  - Fix: discovered `subscriptionAppStoreReviewScreenshots` (type) endpoint via ASC API relationship probing. Uploaded a review screenshot (1284×2778 from existing App Store screenshot set) for both subscriptions via POST reservation → PUT upload → PATCH commit flow.
  - Annual subscription had a prior stuck AWAITING_UPLOAD reservation (from the earlier failed attempt); it was deleted via DELETE before re-uploading.
  - Both subscriptions transitioned: MISSING_METADATA → **READY_TO_SUBMIT**. StoreKit sandbox now serves both products; RC paywall should load on next app launch in TestFlight (build #88 — no new build needed, this is a server-side ASC state change).
  - App version v1.0 (6aefd377) also updated: build switched from #81 → #88 (c3de1d50) and supportUrl corrected to `https://knowyourpit.com/support`. Version is now in PREPARE_FOR_SUBMISSION.
  - App Store Review submission still pending (API FORBIDDEN — needs primary category + age rating set in ASC web UI before submitting). IAPs will be reviewed alongside the app when submitted.

- **2026-05-11 — Build #88 shipped to TestFlight (paywall diagnostics)**:
  - All diagnostic info now always visible (removed `__DEV__` guard from PaywallModal error screen).
  - Error message (`lastError`) always shown when present — will display exact RC/StoreKit error in TestFlight.
  - Added `offeringsFailureReason: "timeout" | "error" | "no_products" | null` to `SubscriptionContextValue`; wired in timer callback ("timeout"), outer catch ("error"), silent `.catch()` path ("error"), and no-current-offering paths.
  - Diagnostic footer row (offering identifier + reason + failed flag) always visible under the error message.
  - PaywallModal now shows specific text for each reason type (timeout / error / no_products).
  - `retryOfferings` captures errors into `lastError` instead of swallowing silently.
  - EAS build id `f0f4307b-31d2-4d48-95f8-1cf3dd641716`; TestFlight submission id `77958b9d-2739-48bd-9783-1ca963dcef01`. Note: EAS_NO_VCS=1 required.
  - ASC subscriptions still in MISSING_METADATA. Both localizations updated to short descriptions (≤55 chars). Apple docs confirm MISSING_METADATA does not block sandbox/TestFlight StoreKit. Build #88 diagnostics will reveal the actual RC/StoreKit error path.

- **2026-05-11 — Build #87 shipped to TestFlight (paywall fix)**: Root-cause investigation: MISSING_METADATA state on both IAP subscriptions persists but Apple docs confirm sandbox StoreKit still serves MISSING_METADATA products — not the actual blocker. Real fix: SubscriptionContext safety timer extended 8 s → 25 s so slow StoreKit/RC requests don't prematurely show "Couldn't load"; `setOfferingsLoadFailed(false)` now fires when offerings arrive after the timer (previously the error screen was sticky even on late success). PaywallModal "Couldn't load" screen now shows diagnostic info in DEV builds (offering name, failed flag, RC lastError) to aid future debugging. ASC: uploaded 1024×1024 promotional PNG to both IAP subscriptions via ASC API (UPLOAD_COMPLETE → PREPARE_FOR_SUBMISSION); subscription group + per-subscription en-US localizations confirmed; prices confirmed. EAS build id `028258a1-2a1c-46b6-b444-2fbc1e3c112b`; TestFlight submission id `04a4de81-15e3-4807-a31d-cc4d7c958896`. Note: EAS_NO_VCS=1 required.

- **2026-05-11 — Build #86 queued to TestFlight (task #590)**: Features: forced dark theme globally — `userInterfaceStyle` changed from `"automatic"` to `"dark"` in `app.json`; bare `useColorScheme()` in `app/(tabs)/_layout.tsx` replaced with `isDark = true`. ASC groundwork: confirmed RC iOS SDK key is correct (app_store key `appl_mhkVJhxDzwRmZTeUZSVShSwaimi`); both IAP products verified in ASC (`com.knowyourpit.pro.monthly` id=6764196256, `com.knowyourpit.pro.annual` id=6764194128); USD prices set ($4.99/mo, $29.99/yr); review notes patched; products in `MISSING_METADATA` state (requires promotional screenshot for App Review, does not block TestFlight sandbox). EAS build id `0ce18eab-431d-40cc-a1aa-64bcce25efd0`. Note: EAS_NO_VCS=1 required.

- **2026-05-10 — Build #84 queued to TestFlight (tasks #525–#571)**: Features: live cook progress bar (`CookProgressBar` component — color ramp orange→amber→green→red-over, phase labels, tap-to-toggle remaining/finish-time countdown, spring animation); progress bar propagated to Cook Log cards (solo + session), Dashboard active cook widget, and Plan tab active-cook banner; wrap-temp adjustment instantly reflected in progress bar and banner (`wrapAdjustedFinishMs`); no-flicker check-in update via `pendingWrapClearRef`; push notifications rescheduled when wrap temp adjusts ETA; session tag pills show animated progress dots + percentage chips + mini fill bars; `useNow` hook for real-time ticking on Cook Log and Dashboard; `AnimatedBarFill` component shared across all surfaces; `AnimatedFill` spring animation on session tag fills; `fmtRemaining` exported for reuse across Plan + Cook Log banners. EAS build id `bca35e9c-d806-44a8-af62-b490382435de`; TestFlight submission id `ebb68063-8214-45e8-96dc-19619ad4da21`. Note: EAS_NO_VCS=1 required (Replit sandbox blocks git ops during project archive).

- **2026-05-10 — Build #83 shipped to TestFlight (task #515)**: Features: live cook checklist enhancements — timeline ripple (confirming a step shifts downstream timestamps), WrapTempSheet (internal temp prompt before wrap confirmation), wrap-temp scaling formula (actual vs planned temp adjusts finish estimate), stall zone row (brisket/pork — "Wrap Now" / "Riding It Out"), probe tender row, fuel quick-log (+ Charcoal / + Wood per step), Pit Journal events for stall + probe-tender (with un-confirm DELETE), ActualVsPlannedRecap accuracy card for completed cooks. EAS build id `f5dfc6cf-f924-4213-a4dd-9c3562a9cc0b`; TestFlight submission id `c3652614-66be-4b97-a967-22fd804318c4`. Note: EAS_NO_VCS=1 required (Replit sandbox blocks git ops during project archive).

- **2026-05-10 — Build #82 shipped to TestFlight (task #500)**: Features: Plan screen progressive disclosure (task #480), Pro feature showcase screen (task #492), cook notes forwarded to PitMaster AI (task #479), post-#81 Apple Sign-In defensive improvements (narrow try/catch, signInResult branching, route new users to set-username). EAS build id `f7435d97-bbb3-4316-a952-1ef721485ac6`; TestFlight submission id `31e58ac0-3adb-4cd6-8074-394908f54eec`.

- **2026-05-10 — Apple Sign-In build #81 code verification (task #476)**: Task required human device testing on a real iPhone (TestFlight build `864929cb`, submission `24388e75`). Code was audited and confirmed correct: both `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx` generate a `Crypto.randomUUID()` nonce and pass it to `AppleAuthentication.signInAsync`, follow the correct Clerk transfer pattern (`signIn.create` → check `firstFactorVerification.status === "transferable"` → `signUp.create({ transfer: true })`), and emit `[apple-signin]`-tagged structured logs at every step. New users are routed to `/(auth)/set-username` after sign-up completes. If physical device testing reveals the nonce fix is still insufficient, the next step is to add `oauth_token_apple` (and `oauth_token_google`) to `captcha_oauth_bypass` in Clerk Dashboard → User & Authentication → Attack Protection → Bot protection → OAuth bypass, then ship build #82.
- **2026-05-09 — webhook_events cleanup (task #462)**: The cancelled welcome-email feature (task #459) had created a `webhook_events` idempotency table via `push-force`. The schema export was already removed from `lib/db/src/schema/index.ts`. On cleanup: production DB — `to_regclass('public.webhook_events')` returned `NULL` (table never reached prod); dev DB — table existed and was dropped with `DROP TABLE IF EXISTS webhook_events` (confirmed `NULL` after drop). No migration file was required; codebase had zero remaining references.
- **2026-05-10 — Apple Sign-In TestFlight fix (build #80)**: Builds #77–#79 all failed with `"you are not authorized to perform this request"` after Apple sign-in returned `missing_requirements: ["username"]` and we tried `signUp.update({ username })`. Root cause: calling `signUp.create({ strategy: "oauth_token_apple", token })` directly does NOT attach the OAuth context required to authorize subsequent `update()` calls. The correct Clerk pattern (matching their official `useSignInWithApple.ios.js` hook and clerk-js internal handling of `external_account_exists`) is: (1) call `signIn.create({ strategy: "oauth_token_apple", token })` first to register the OAuth session on the client, (2) if it completes → `setActive` (existing user), (3) otherwise call `signUp.create({ transfer: true })` — Clerk reads `clerk.client.signIn.firstFactorVerification.strategy` to transfer OAuth context, (4) then `signUp.update({ username })` works. Applied to both `app/(auth)/sign-in.tsx` and `app/(auth)/sign-up.tsx` Apple handlers. Production Clerk config (`clerk.knowyourpit.com`) was verified correct: Apple enabled+authenticatable, username required, both `oauth_apple` and `oauth_token_apple` in `identification_requirements`.
- **2026-05-10 — Apple Sign-In TestFlight fix (build #81, task #468)**: Build #80 still failed in TestFlight with the same "you are not authorized to perform this request" after `signIn.create({oauth_token_apple})` succeeded with `firstFactorVerification.status="transferable"` but `signUp.create({transfer:true})` was rejected. Root cause: missing **nonce** in `AppleAuthentication.signInAsync`. Apple embeds the nonce inside the identity token JWT, and Clerk's backend validates it to elevate the token's trust level for sensitive operations like transfer-mode sign-up. Without it, Clerk's prod tenant rejected the transfer call. Fix: generate `Crypto.randomUUID()` and pass as `nonce` to `signInAsync` (matches Clerk's official `useSignInWithApple.ios.js` line-for-line). Also switched both handlers to branch on `signIn.firstFactorVerification?.status === "transferable"` (Clerk's documented signal) instead of try/catch error sniffing, and added `[apple-signin]`-tagged structured logging at every step so future TestFlight failures can be diagnosed from device logs without rebuilding. Applied to `app/(auth)/sign-in.tsx` + `app/(auth)/sign-up.tsx`. Bumped `ios.buildNumber` 80→81. EAS build id `864929cb-3a3d-4de6-8b67-6de6c4bfc3ed`; TestFlight submission id `24388e75-3e30-4c57-b29c-b3e7ddb2b677`. Source also now wraps `signIn.create` in a narrow defensive `try/catch` that swallows `form_identifier_not_found`/`strategy_for_user_invalid`/`external_account_not_found` and proceeds to transfer-mode sign-up (belt-and-suspenders for legacy-SDK behavior on unknown users) and uses the returned `signInResult` for branching rather than the mutable hook resource — these defensive additions are in source post-#81 and will land in the next build. Additionally, after the auto-generated Clerk `username` satisfies the `missing_requirements` and `setActive` completes, the user is routed to `/(auth)/set-username` (not `/(tabs)`) so they can pick their own display handle, which is stored in `user.unsafeMetadata.username` (distinct from the Clerk `username` field). This routing change is also post-#81. **Captcha caveat**: prod Clerk has `captcha_oauth_bypass: []` — if the nonce fix alone is insufficient, the next step is to add `oauth_token_apple` (and `oauth_token_google`) to that bypass list in Clerk Dashboard → User & Authentication → Attack Protection → Bot protection → OAuth bypass, since RN cannot render Turnstile.