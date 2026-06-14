# knowyourpit

## Overview

knowyourpit is an AI-powered BBQ planning and management application. It offers tools for managing grill profiles, logging cook sessions, and providing AI-driven cook plans and time predictions. The app also features temperature monitoring, recipe management, and personalized pit master coaching.

## User Preferences

- All `eas` and `expo` commands must be run from `artifacts/knowyourpit/`, never from the workspace root.
- Do not delete the disabled Apple Watch companion app code; it is the starting point for future modernization work.
- Never auto-initiate an EAS build. Always ask the user for confirmation before queuing any build.

## Mobile UI Conventions

### Keyboard-safe modals
Every modal or bottom sheet that contains a `TextInput` **must** use `AppKeyboardAvoidingView` instead of the raw React Native `KeyboardAvoidingView`. The component lives at `artifacts/knowyourpit/components/AppKeyboardAvoidingView.tsx` and has the correct cross-platform behavior baked in (`"padding"` on iOS, `"height"` on Android).

```tsx
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";

<Modal ...>
  <AppKeyboardAvoidingView style={{ flex: 1 }}>
    {/* modal content with TextInput */}
  </AppKeyboardAvoidingView>
</Modal>
```

Do **not** write `<KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>` inline in new modals — use the wrapper so the behavior stays consistent and reviewable in one place.

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

- **2026-06-14 — Build #123 / v1.0.17 queued to TestFlight**: EAS build id `04c7a025-7312-4f1c-90cb-684ae3998c61` (cache key v25→v26 to bust contaminated pod-install cache; prior attempts `08cfd4ad` and `7eeb24cb` both errored on Install pods). buildNumber 122→123, version stays 1.0.17. Features: AI Plan modal hang fixed (pre-save modal removed, background AI via `fireBgAiRefine` with Promise.race timeout); spurious Activity spinner on planned cooks removed; Overall Grade promoted to 72×72 hero badge on completed cook screen (tappable breakdown sheet, 50/50 plan-accuracy/cook-health formula, score driver summary line); multi-cook reliability overhaul — shared-grill smarts (skip duplicate light step, per-grill AI coaching), grill grouping in schedule modal, inline failure cards with red styling + per-item retry, progress counter ("Saving N of M…"), auto-clear badges on full retry success; robustness fixes (`getTokenSafe` 1s→8s timeout, 30s `customFetch` AbortController, parallel `Promise.allSettled` saves). No DB schema changes. Cache key stays v25-xcode-26. Built with `EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1`.

- **2026-06-08 — Build #122 / v1.0.17 submitted to TestFlight**: EAS build id `ed7d0972-9140-4119-8b0f-f6f2905b50a6`. Submission id `faa79099-ba17-4908-9e2f-75eaea431350`. buildNumber 121→122, version stays 1.0.17. Fixes: random sign-outs — iOS SecureStore token-read timeout increased 3 s → 8 s and null results no longer cached into Clerk's token cache (avoids phantom sign-out on slow device boot); "Stay signed in" toggle added to sign-in screen above the "or" divider so Google/Apple SSO users see it too (defaults ON; when OFF the session is memory-only and ends when the app is fully closed). Key files: `artifacts/knowyourpit/lib/tokenCache.ts`, `artifacts/knowyourpit/lib/staySignedIn.ts`, `artifacts/knowyourpit/app/(auth)/sign-in.tsx`. No DB schema changes. Cache key stays v25-xcode-26. Built with `EAS_NO_VCS=1` to bypass Replit git-lock restriction.

- **2026-06-08 — Build #121 / v1.0.17 submitted to TestFlight**: EAS build id `f0584778-203e-4609-a7f1-6622bb07f75f`. Submission id `da51868d-66b9-465c-bd97-0a258375bfb3`. buildNumber 120→121, version stays 1.0.17. Hotfix for builds #119/#120 crash-on-open: removed `@sentry/react-native` (^8.13.0) + `@sentry/core` + `"@sentry/react-native/expo"` plugin — added in Task #1236 between builds #118 and #119. Root cause confirmed via .ips crash report: `RCTInstance handleBundleLoadingError` → `SIGABRT` — Sentry native turbo module (v8, incompatible with Expo SDK 54 / RN 0.81.5 new arch) crashed during JS bundle load before any app code ran. Build #118 had no Sentry and worked. Also removed `SENTRY_ALLOW_FAILURE=true` from eas.json. No DB schema changes. Cache key stays v25-xcode-26.

- **2026-06-08 — Build #120 / v1.0.17 submitted to TestFlight**: EAS build id `e3932b45-bb05-416d-8447-b8ae7a2676f6`. Submission id `fc52f58d-ee85-430c-b0af-760107508845` (first attempt — EAS timed out but Apple likely accepted; second attempt `ca2d8e14` errored as expected duplicate). buildNumber 119→120, version stays 1.0.17. Hotfix for build #119 crash-on-open: bumped EAS cache key v24→v25 to force a completely fresh Xcode native build, bypassing contaminated native artifacts cached by the first failed build attempt (`8543de8b`, which failed at sentry-cli upload after a successful Xcode compile, leaving the EAS cache in an inconsistent state). No code changes — all code from Tasks #1220 and #1230 is intact. No DB schema changes.

- **2026-06-07 — Build #119 / v1.0.17 submitted to TestFlight**: EAS build id `e6228fd1-fa37-492a-87fb-ab97cd30e9a4`. Submission id `37d4da0b-484a-46a3-85d8-90baa98a667e`. buildNumber 118→119, version stays 1.0.17. Fixes: UI tap freeze (Plan/Multi-Cook/Cook Now buttons open loading modal instantly); Connected Devices spinner freeze (MEATER + ThermoWorks status queries use staleTime + keepPreviousData); ThermoWorks phantom channel probes (switched isChannelLive from denylist to allowlist, collection query replaces 1-8 individual Firestore reads, freshness window tightened 15 min → 5 min). Also added SENTRY_ALLOW_FAILURE=true to eas.json production env (first attempt build `8543de8b` errored on sentry-cli upload with no SENTRY_ORG). No DB schema changes.

- **2026-06-07 — Build #118 / v1.0.17 submitted to TestFlight**: EAS build id `ca60d610-7b65-4fe3-bc53-c66bcb095fd8`. Submission id `01ffc6c2-3ed8-48cc-b90f-e6ca0ab3d41f`. buildNumber 117→118, version stays 1.0.17. Brand asset refresh — all icons and logos replaced across the app and marketing site: `app-icon.png`, `logo.png`, `logo-light.png`, `logo-transparent-light.png`, `icon-transparent-light.png`, `icon-transparent-dark.png`, `adaptive-icon.png`, `opengraph.jpg`. New icon features flame + grill + analytics chart motif; light/dark/transparent variants updated in `lib/brand-assets/` with symlinks propagating everywhere. Note: build #117 (same build ID `b421c5cc`) was uploaded to Apple via an earlier EAS submission attempt that returned an error but actually succeeded — Apple confirmed "build number already used" on retry attempts; #117 is also in TestFlight processing. No code changes, no DB schema changes.

- **2026-06-07 — Build #117 / v1.0.17 queued to TestFlight**: EAS build id `b421c5cc-ec62-4fe5-958f-434fa6b54a51`. buildNumber 116→117, version stays 1.0.17. Fix: PitMaster Plan / Multi-Cook / Start Cook stall — all three handlers now use cached `getToken()` instead of `getToken({skipCache:true})` on the critical path, so the loading modal opens instantly on tap without a forced Clerk network round-trip. On a stalled iOS connection the old `skipCache:true` blocked the handler before any UI rendered ("tap does nothing"). AI fetch timeout (AbortController, 45s) restored on `/api/ai/predict` and `/api/ai/multi-cook` — protection that was lost during the build #115 streaming revert. Multi-cook treats AbortError as a retryable error (in-modal retry/error UI). `getToken({skipCache:true})` is now only used as a single on-demand refresh after an actual 401 response. No DB schema changes.

- **2026-06-06 — Build #116 / v1.0.17 submitted to TestFlight**: EAS build id `be238ab9-1d2d-4179-b234-b551850515f2`. Submission id `21bd017b-726b-4039-a698-f16bf4ed30de`. buildNumber 115→116, version stays 1.0.17. Fixes: (1) nav freeze — AI result modal (`setAiResultOpen`/`setAiStreaming`) now dismissed before `router.push` in both `handleSubmit` paths ("Cook Now" fast-path and replan path); (2) probe empty-state layout — `LiveCookSection.tsx` no-probes placeholder restructured from flat row to column wrapper with icon+text in inner row (`flex:1`) and scan button + "Go to Connected Devices" stacked below. No DB schema changes.

- **2026-06-06 — Build #115 / v1.0.17 submitted to TestFlight**: EAS build id `0176cf5f-01df-4874-a651-8bc0e5d17870`. Submission id `b319cd26-ab75-4588-8b9a-6b42ad4e05fe`. buildNumber 114→115, version stays 1.0.17. Fix: revert AI Plan and Multi-Cook Sequencer from streaming endpoints back to non-streaming (`/api/ai/predict` and `/api/ai/multi-cook`). Root cause: React Native's production fetch polyfill drops the connection before any bytes arrive on chunked responses, causing "Network request failed" on iOS TestFlight. Non-streaming endpoints return identical JSON payloads via standard `response.json()`. Also removed ~120 lines of now-dead partial-parse streaming helpers. No DB schema changes.

- **2026-06-06 — Build #114 / v1.0.17 submitted to TestFlight**: EAS build id `56ed6594-37e8-4a7f-ad54-4b313b3c7db8`. Submission id `8ad55c0c-6992-4051-bac3-77cd16179750`. buildNumber 113→114, version stays 1.0.17. Hotfix: streaming SSE calls crashed on production iOS (TestFlight) because `response.body` is null in React Native's fetch polyfill even on 200 OK responses. All 4 streaming call sites (plan.tsx handleAiPlan, plan.tsx multi-cook runStream, ai.tsx chat, PitMasterChatModal.tsx) now fall back to `response.text()` when `response.body` is null, parsing all NDJSON lines at once instead of streaming. No DB schema changes.

- **2026-06-06 — Build #113 / v1.0.17 submitted to TestFlight**: EAS build id `89ec0213-278b-4c29-a5c8-140cbc0a926f`. Submission id `a91cd1f6-495a-4eab-bec5-102ad22bde38`. buildNumber 112→113, version 1.0.16→1.0.17. Features: ThermoWorks in-app password reset — Google/Apple ThermoWorks users can tap "Email me a reset link" inside the link form (POST /api/thermoworks/send-reset calls Firebase sendOobCode, always 204); inline error feedback on MEATER and ThermoWorks link failures (replaces Alert.alert with red in-form message); MEATER hint URL updated to app.meaterapp.com. No DB schema changes.

- **2026-06-05 — Build #112 / v1.0.16 submitted to TestFlight**: EAS build id `2c089109-2ee8-4327-85e4-1240a41b89ba`. Submission id `974c63a5-e399-49a0-9334-9e5f847aa81a`. buildNumber 111→112, version 1.0.15→1.0.16. Features: Vegetables (15 items) and Fruit (13 items) as fully supported grill categories — time-based doneness, produce-specific PitMaster coaching, unit labels, frozen section hidden; AI plan streaming token-by-token with live shimmer skeleton; multi-cook sequencer streaming with progressive item reveal + auto-retry on timeout; smoker fingerprint cached 10 min per user/grill; live cook page instant load (staleTime + list cache initialData); delete cook navigates explicitly to Cooks list + purges cache; cook detail screen refactored into hooks+components (~700 lines from ~4870); grill detail page with instant load from list cache. No DB schema changes.

- **2026-06-04 — Build #111 / v1.0.15 submitted to TestFlight**: EAS build id `3d24a5f7-c437-4ba4-9b9f-60b57792ef24`. Submission id `9e5d03eb-fac2-4421-82a9-f4adc89544d4`. buildNumber 110→111, version 1.0.14→1.0.15. Features: DB indexes on cooks (user_id, grill_id, user+status composite), grills (user_id), temperature_readings (cook_id) — fixes slow My Grills load; auto-analyze gated behind active probe connection (#1150); ai_analyze_events rows pruned at write-time (#1151); temperature readings thinned to 1/15-min bucket on cook completion (#1152); EXIF auto-fill cook date when logging past cook (#1157, #1159); AI predict timeout fix — 50s AbortController + fallback prediction (#1156); AI plan auto-retry on timeout (#1165); timeout banner on live cook screen (#1166); multi-cook sequencer timeout protection (#1161, #1162). No DB schema changes beyond indexes.

- **2026-06-02 — Build #110 / v1.0.14 submitted to TestFlight**: EAS build id `bcf52ade-fcf2-4612-bbca-8bde31159981`. Submission id `94ff80a5-f559-4c97-967a-3fe044ce49a4`. buildNumber 109→110, version 1.0.13→1.0.14. Hotfix: correct app icon — `lib/brand-assets/app-icon.png` was overwritten with a screenshot on 2026-06-02; restored to `app-icon-dark.png` (circular grill icon, dark gray background, white outline, orange bars). No code changes. No DB schema changes required.

- **2026-06-02 — Build #109 / v1.0.13 submitted to TestFlight**: EAS build id `d2dcd38b-39b9-4176-abeb-362fb25f6aa8`. Submission id `13439a3f-15e6-4188-a591-9e6b8c705e07`. buildNumber 108→109, version 1.0.12→1.0.13. Features: Activity feed consolidation — ai_analysis cook events merged into nearest check-in row (15 min window, severity+recency ranking); collapsed check-in shows colored verdict badge; header chevron replaced with "View analysis ›" affordance when analysis exists; expanded section shows "PitMaster says:" header + verdict chip + summary + decisions when historyEntry has no verdict; standalone ai_analysis rows preserved for proactive alerts with no nearby check-in; Set Alert button removed from live cook screen (AlertSheet preserved for future use). No DB schema changes required.

- **2026-06-02 — Build #108 / v1.0.12 queued to TestFlight**: EAS build id `0256eb32-8aaf-4089-be7c-2909e42e4063`. buildNumber 107→108, version 1.0.11→1.0.12. Features: Inkbird BLE overhaul fix — removed generic 0xFFF0/0xFFE0 UUID fallback and "tpms" name prefix, name-only matching hardened; Size Mode selector — replaces required weight field with S/M/L/XL/Custom flexible options, last-used size persisted per cut; Cook Factors breakdown — "What's driving this?" interactive bottom sheet on Plan and active cook screens, tappable stacked bar with per-segment labels, qualitative chips (Grill Tuned, Frozen, Injection, Wrap, Cold Weather, Grill Load), tap-to-expand factor detail rows. Pre-build: ONBOARDING_ALWAYS_SHOW flipped false. No DB schema changes required.

- **2026-05-30 — Build #107 / v1.0.11 hotfix submitted to TestFlight**: EAS build id `505bc3b2-4a89-4a2a-8c42-9bb654b87bad`. Submission id `ea0f6ee2-d9d6-41f7-a610-a151ec615a3b`. buildNumber 106→107, version stays 1.0.11. Hotfix: onboarding infinite redirect loop — when ONBOARDING_ALWAYS_SHOW=true, tapping Done/Skip/Let's Go bounced user back to page 0. Fix: added module-level _sessionOnboardingDone flag in _layout.tsx; signalOnboardingDone() called in finish() before router.replace so nav guard respects the dismissal. No DB schema changes required.

- **2026-05-30 — Build #106 / v1.0.11 submitted to TestFlight**: EAS build id `6bd7f081-1775-49d9-b86e-aeff0a32f270`. Submission id `f1f95bf0-0f6d-4593-922c-ec63b37209f8`. buildNumber 105→106, version 1.0.10→1.0.11. Features: BLE false-positive fix — removed generic 0xFFF0/0xFFE0 UUID fallback and "tpms" name prefix from Inkbird detection (name-only matching now); auto-scan button no longer flickers on page focus; BLE diagnostics shows serviceUUIDs + localName; onboarding Page 1 redesigned — 2×3 feature grid (AI Cook Plans, PitMaster Coach, Live Temperature, Cook Logger, Frozen Planning, Multi-Cook 🍢) replaces single thermometer icon; ONBOARDING_ALWAYS_SHOW=true for beta testing. No DB schema changes required.

- **2026-05-27 — Build #105 / v1.0.10 submitted to TestFlight**: EAS build id `ee0a2484-79ef-4b8d-ac18-66179cb261ee`. Submission id `34653ddc-8aef-45ca-8fe3-45a010ab5e4a`. buildNumber 104→105, version 1.0.9→1.0.10. Features: check-in checkpoint rows + preview sheets in all timeline views (#974–#997); competition mode fully removed; PitMaster Score planSampleFactor fix (single-outlier grade fix); BLE diagnostics screen, Inkbird model expansion, iOS/Android permissions hardening (#998); live Inkbird channel temps in device cards (#1001); remember BLE permission denial across app restarts (#1003). Fix: useSmokerProfile baseUrl now uses EXPO_PUBLIC_API_URL first (was silently using empty string in production builds). No DB schema changes required.

- **2026-05-26 — Build #104 / v1.0.9 queued to TestFlight**: EAS build id `a78a5b5d-319d-4316-984e-55f3885d14a5`. buildNumber 103→104, version 1.0.8→1.0.9. Features: onboarding simplified from 4-slide horizontal pager to 2-page pop-up modal — Welcome + Feedback (#962); check-in pill pulses when due within 5 minutes (#957); adaptive ETA detection now applies to AI temperature-range check-in suggestions (#954); "Tuned to your N cooks on this grill" fingerprint callout in AI results modal (#966), live cook screen (#967), planned cook timeline, and multi-cook session screen (#969); fingerprint callout survives a replan (#970). No DB schema changes required.

- **2026-05-24 — Build #100 / v1.0.5 queued to TestFlight**: buildNumber 99→100, version 1.0.4→1.0.5. Features: multi-cook Home tab shows all active cooks side-by-side (#819); edit actual thaw/meat-on times on a live cook via clock icon (#795); auto-log check-in at scheduled milestones when a probe is connected (#820); reduce probe polling from 15 s to 15 min (#822); save frozen cook plan from Cook Now mode (#827); condensed PitMaster decision section (#828); decision section resets on new analysis (#829); unified "Check In with PitMaster" sheet — merged Check-In, Quick Log, and Ask PitMaster into single bottom sheet (#832); decision rationale collapses on navigate away (#833); mopping support — mop_frequency/mop_liquid DB columns, "mop" cook event type, mop schedule in plans, mop countdown in live cook, mop chips on log cards (#837); fix Plan Accuracy grade for frozen cooks — uses meatOnAt not thaw-start as actual-start anchor (#838); active-cook duration row on frozen cook cards (#841); thaw time row on frozen cook cards (#842); visual thaw-vs-active-cook bar on frozen cook cards (#843); thaw time in AI cook analysis context + PitMaster prompt section (#844). DB schema pushed to prod required: mop_frequency/mop_liquid on cooks, "mop" in cook_event_type enum, is_automatic/probe_source on cook_checkins.

- **2026-05-22 — Build #99 / v1.0.4 submitted to TestFlight**: EAS build id `c051e755-b184-49f6-9765-428d5937ea1a`. Submission id `61559779-8c9f-4078-9628-52e528aee1b9`. buildNumber 98→99. Features: thaw-start countdown on frozen cook cards (#762 — "START THAW" badge chip, countdown to thaw window open); spritz schedule sub-rows on cook timeline (#763 — teal dots between Meat On and Wrap/Pull-off showing each spritz time + live countdown); wrap finish technique displayed as italic sub-line beneath wrap step.

- **2026-05-22 — Build #98 / v1.0.4 submitted to TestFlight**: EAS build id `08d59c98-a58e-4427-ba6f-2bc51bc6126f`. Submission id `8ea1afb3-eb50-4ea9-8622-f0dce25bea24` — status FINISHED (confirmed via EAS GraphQL). Feature: 24-hour minimum floor for refrigerator thaw method (#760) + `frozenThawOverlapsGrill` plan warning when thaw window extends past preheat start. buildNumber 97→98. Subsequent retry submissions (318d76f9, d639e495, f9531de2, aa3b9d4b) all ERRORED — expected, Apple rejected duplicate binary uploads after first submission succeeded.

- **2026-05-21 — Build #97 / v1.0.4 queued to TestFlight**: EAS build id `aff35a29-27c0-4540-932f-eddbda382216`. Resubmit — no code changes since #96.

- **2026-05-21 — Build #96 / v1.0.4 queued to TestFlight**: EAS build id `94828d8b-8536-4917-8112-f1a7a810d92d`. Features: cook photo attachments (#710, object storage, CookPhotosSection + AI photo analysis #719); cooking method chips in multi-cook (#707); remember last method per cut (#709, #711, #712, #720); per-cut technique memory for rub/spritz/wrap/injection/meatStartTemp (#725, #728); performance stats by technique (#713); per-cook editing in multi-cook session (#715, #716); spritz reminders notifications (#732), next-spritz countdown (#733), haptic nudge (#736); carry spritz cadence into AI plan (#734); technique summary on cook detail (#737); technique chips on cook log cards (#739); spritz cadence in AI analysis (#740); spritz liquid preference + PitMaster memory (#741); "Add to planned cook" button on cook detail. Pre-build: ONBOARDING_ALWAYS_SHOW flipped false, photo permission strings updated for general attachments, versionCode 2→3. Fix: expo-image-manipulator downgraded 55.0.16→14.0.8 (SDK 54 compat — build #95 errored XCODE_BUILD_ERROR: FileSystemUtilities.isReadableFile).

- **2026-05-18 — Build #94 / v1.0.3 queued to TestFlight**: EAS build id `13328fba-323c-4974-8ce4-9d1533f26a40`. Version bumped 1.0.2 → 1.0.3 because Apple locked the 1.0.2 train (ITMS-90186 + ITMS-90062 — previously approved version cannot receive new builds). Features: first-launch onboarding walkthrough (#684 — 6 slides, brand-orange palette, Skip→last slide, AsyncStorage+Clerk completion persistence, account-age gate so existing users never see it); onboarding replay from More → Help (#695); BetaWelcomeModal deleted (#696); Contact support row opens in-app support modal (#697, #700 — posts to `/api/contact` with source field); close button + back button in replay mode (#698, #701). Note: EAS_NO_VCS=1 required. Build #93 (v1.0.2) was discarded — never reached TestFlight.

- **2026-05-10/11 — Builds #80–#89 (resolved issues, condensed)**:
  - **Apple Sign-In** (builds #80–#82): Fixed `"you are not authorized"` errors. Correct pattern: call `signIn.create({ strategy: "oauth_token_apple", token, nonce })` first, then if `firstFactorVerification.status === "transferable"` call `signUp.create({ transfer: true })`. The `nonce` (from `Crypto.randomUUID()`) is required — Clerk's prod backend validates it for transfer-mode sign-up. New Apple users are routed to `/(auth)/set-username` after sign-up.
  - **IAP paywall** (builds #86–#88 + server-side fix): Both subscriptions (`com.knowyourpit.pro.monthly` id=6764196256, `com.knowyourpit.pro.annual` id=6764194128) resolved from MISSING_METADATA → READY_TO_SUBMIT after uploading review screenshots via ASC API. SubscriptionContext safety timer extended to 25 s. RC iOS SDK key: `appl_mhkVJhxDzwRmZTeUZSVShSwaimi`. Prices: $4.99/mo, $29.99/yr.
  - **Email verification** (build #89): Sign-up now handles `unverifiedFields: ["email_address"]` — shows OTP screen, calls `prepareEmailAddressVerification` + `attemptEmailAddressVerification` before proceeding.
  - **App Store Review**: Pending — primary category + age rating must be set in ASC web UI before submitting. App version v1.0 build #88 is in PREPARE_FOR_SUBMISSION.