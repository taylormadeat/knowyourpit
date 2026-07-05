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
- **Schedule Step Confirmation (Session Schedule timeline)**: Confirming the *next* upcoming step (Light Grill / Meat On / clock-mode Wrap) shows a "Mark as done?" confirmation alert, so it can be confirmed early without an accidental tap; past-due steps still confirm with a single tap. Every confirm (on any step) surfaces a 5-second undo toast — tapping "Undo" reverts the confirmed-steps state, the rippled schedule, and any note created for that step (e.g. stall/probe-tender events). Confirmed rows show the actual confirmed time as the headline (not just the originally planned time), with a signed drift annotation next to it (e.g. "12 min late", "8 min early", "on time") color-coded green/gray/amber. Pull Off and Serve also show their actual confirmed time and drift once logged.
- **AI Coaching with Step Drift**: Cook analysis requests now include a per-step drift summary (planned vs. actual time for grill light, meat on, wrap, pull off, serve). The AI coaching prompt is instructed to call out steps that ran ≥10 minutes early/late by name and acknowledge steps that landed within 2 minutes, so feedback is tied to how the cook actually ran rather than generic advice.
- **Live Cook Screen Layout**: While a cook is active, the top status-badge row (dot/status text/weight/rating chips) and the "no temperatures logged yet" nudge are hidden to reduce clutter; the Cook Health score card now renders directly above the live progress bar instead of lower on the screen. Completed cooks keep the status badge row and a compact Cook Health card in the analysis section.
- **Check-in Milestone Matching**: A manual check-in (FAB, "Log at Check-In" button, or the next-milestone card) opened within ±20 minutes of a scheduled milestone is automatically associated with that milestone's `phaseKey`/`phaseLabel`, even if the milestone time already passed, instead of being recorded as an unrelated manual entry. Already-logged milestones are excluded from matching.

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

- **2026-07-05 — Fixed multi-probe meat/pit temp resolution on `/dashboard/recent-cooks`**: The live meat-temp chip resolved via `probeNumber = 0` specifically; any additional meat probe reporting under a different probeNumber (2nd meat probe, CSV import, etc.) was invisible and the chip silently fell back to the planned target temp even with a live reading present. Changed the meat-role query to `probeNumber != 1` (anything not the pit probe) so any non-pit probe's latest reading is picked up; pit stays a strict `probeNumber = 1` match. Added 3 integration tests (`artifacts/api-server/src/routes/__tests__/dashboard.recentCooks.test.ts`) against the real dev DB. Full api-server suite (110 tests) + workspace typecheck pass. No DB schema changes.

- **2026-07-05 — Build #132 / v1.0.17 finished, TestFlight submission BLOCKED (Expo-side bug)**: EAS build id `ccf8c673-f6fb-481d-b0e3-2e7543d45f12`. iOS production build, buildNumber 126→127, version stays 1.0.17. Build itself succeeded cleanly. Every `eas submit` attempt (3x) fails identically with `invalid curve name (OpenSSL::PKey::ECError)` thrown inside fastlane/spaceship on EAS's own macOS submit runner (not local). Confirmed not a project/key issue: the ASC_API_KEY_P8 secret parses as a valid P-256 key locally, and re-wrapping the key as SEC1 (`BEGIN EC PRIVATE KEY`) before upload — the standard fix for this fastlane bug — made no difference, meaning EAS re-derives the key server-side. See `.agents/memory/eas-submit-invalid-curve-name.md`. User opted to wait and retry later rather than submit manually via Transporter. Contains this session's Cook Log refetch-on-focus fix plus all changes since Build #131 (2026-06-28 batch: schedule step confirmation UX, drift coaching, live cook layout, check-in matching).

- **2026-06-28 — Schedule step confirmation UX + drift coaching + live cook layout + check-in matching**: Batch of merged features. Session Schedule timeline: the NEXT upcoming step (Light Grill/Meat On/clock-mode Wrap) now requires a "Mark as done?" confirm before it counts as done, every step confirm shows a 5-second undo toast, and confirmed steps (including Pull Off/Serve) display their actual confirmed time plus a signed drift annotation (early/on-time/late, color-coded). Per-step drift now flows into the AI cook-analysis prompt so coaching feedback calls out specific steps that ran early or late. Live cook screen: status badge row and "no temps logged" nudge hidden while active, Cook Health card moved above the progress bar. Check-ins: a manual check-in opened within ±20 minutes of a scheduled milestone is matched to that milestone's phase instead of recorded as an orphan entry. No DB schema changes across this batch.

- **2026-06-27 — WiFi & ThermoWorks probe detection — code review complete, hardware test PENDING**: All LAN probe discovery code reviewed and confirmed ready for device testing. `useLanProbes` (two-layer mDNS + .local fallback, consecutive-fail IP-change eviction after 3 failures), `useZeroconfDiscovery` (dual browser: `_http._tcp` + `_meater._tcp`, 8 s scan window, 24 h TTL persistence, `mdnsScanEmpty` proxy for iOS Local Network permission denial), `zeroconf.ts` (classifier covers all RFX aliases), `thermoworksSignals.ts` (community `/status` adapter, 3 s timeout, 5 hostname aliases), and `LiveCookSection.tsx` (all five no-probe UX states: linkedButEmpty, lanScanEndedEmpty, noLinkedAccounts, anyProbeScanning, noneSelected) — all in good shape. **Hardware test matrix still needs a human to run on a real iOS/Android build** with physical ThermoWorks Signals/RFX, Fireboard, and MEATER Block devices. Required cases: (1) unlinked ThermoWorks → "Connect a device" card → /devices link flow; (2) linked TW with live probes → readings in Live Cook; (3) linked TW with zero probes → "linked but empty" card; (4) iOS Local Network permission denied → troubleshooting card + "Open Settings"; (5) Fireboard / MEATER Block on same Wi-Fi → mDNS auto-discover. Record pass/fail per case in this Ops Log when complete.

- **2026-06-15 — Android Build #2 / v1.0.17 queued**: EAS build id `1cc1bec4-1669-4ff3-b4ed-e1c88261c94f`. Android production AAB, versionCode 4. Fix: replaced deprecated AGP 7 `packagingOptions { pickFirst }` DSL with new config plugin `plugins/with-android-packaging/index.js` that injects AGP 8 `packaging { resources { pickFirsts += [...] } }` block via `withAppBuildGradle`. Also added `node_modules/` to `.easignore` — workspace root node_modules is 1.1 GB uncompressed and was the dominant archive contributor; EAS reinstalls from pnpm-lock.yaml. Cache key v34→v35. Build #1 (32e661e0) errored: AGP 8 rejected the old packagingOptions DSL after 6m 42s of Gradle execution. Manual upload to Play Console required (Google Cloud org policy blocks service account JSON key creation). Logs: https://expo.dev/accounts/taylormadeat/projects/knowyourpit/builds/1cc1bec4-1669-4ff3-b4ed-e1c88261c94f

- **2026-06-15 — Android Build #1 / v1.0.17 errored**: EAS build id `32e661e0-37df-4c2c-9272-b089735bf328`. Android production AAB, versionCode 4. Failed after 6m 42s with "Gradle build failed with unknown error" — root cause was `packagingOptions { pickFirst }` (AGP 7 DSL) rejected by AGP 8 bundled with Expo SDK 54. Logs: https://expo.dev/accounts/taylormadeat/projects/knowyourpit/builds/32e661e0-37df-4c2c-9272-b089735bf328.

- **2026-06-14 — Build #131 / v1.0.17 submitted to TestFlight**: EAS build id `7be57ba9-be26-4496-ad63-1e89d32359da`. Submission id `650eb93c-113b-46d1-a3e6-97dacf85e3ac`. App version 1.0.17 / build 125. Fix: `USE_FRAMEWORKS=static` in production env activates `use_frameworks! :linkage => :static` — static frameworks have native module maps, bypassing AppCheckCore's validation. RevenueCat pin also kept (8 fewer transitive pods). Processing at https://appstoreconnect.apple.com/apps/6763445064/testflight/ios

- **2026-06-14 — Build #130 / v1.0.17 errored**: EAS build id `5d4114bd-8d56-4443-bcef-556bb702006f`. Fix: `pod 'RevenueCat', '< 5.55.3'` added inside `target 'knowyourpit'` in `ios/Podfile`. Root cause confirmed from comparing two EAS build logs (165d924c vs dd0dc5eb): explicit `:modular_headers => true` declarations produced identical pod install output, confirming they were completely ignored. Source chain identified: `react-native-purchases 9.7.2` → `PurchasesHybridCommon 17.29.0` (exact pin in RNPurchases.podspec) → `RevenueCat 5.55.3` (added AppCheckCore as a dep in this version) → `AppCheckCore`. Build #122 (June 8) succeeded — it used a pre-5.55.3 RevenueCat. Pinning below 5.55.3 avoids AppCheckCore entirely. Config plugin updated to inject the pin on fresh prebuilds. Cache key v32→v33. buildNumber 123→124. Note: must use `EXPO_NO_TELEMETRY=1` when queuing builds from Replit — without it the EAS CLI hangs indefinitely before the upload step.

- **2026-06-14 — Build #124 / v1.0.17 queued**: EAS build id `b54eeddb-a39a-4772-9e11-18c3a483079f`. Fix: `use_modular_headers!` added inside `target 'knowyourpit' do` block in `ios/Podfile` (right after `use_expo_modules!`). Previous attempts (top-level pod declarations, `DEFINES_MODULE=YES` in `post_install`) failed because pod-resolution validation fires during `pod install` — `post_install` runs too late to affect it. `use_modular_headers!` inside the target block tells CocoaPods to generate module maps before installation runs. Cache key v29→v30. Config plugin updated to inject `use_modular_headers!` after `use_expo_modules!` for future prebuilds.

- **2026-06-14 — Build #123 / v1.0.17 errored**: EAS build id `165d924c-1638-4711-bf36-fc78588eebe9`. Cache key v29-xcode-26, image `macos-sequoia-15.6-xcode-26.2` (must use Xcode 26+ — Apple mandated since April 28 2026). Root cause of 6 prior failures identified: `AppCheckCore` (Swift pod from `@react-native-google-signin`) started requiring `GoogleUtilities` and `RecaptchaInterop` to expose module maps; fixed by setting `DEFINES_MODULE = YES` on those targets in the `post_install` block in `ios/Podfile` (also added to `plugins/with-pod-bundle-signing/index.js` for future prebuilds). Top-level `pod X, :modular_headers => true` declarations were tried first but are scoped to an abstract target and silently ignored by the concrete `knowyourpit` target. `ios/` directory included in archive (not excluded from `.easignore`). buildNumber 122→123, version stays 1.0.17. Features: AI Plan modal hang fixed (pre-save modal removed, background AI via `fireBgAiRefine` with Promise.race timeout); spurious Activity spinner on planned cooks removed; Overall Grade promoted to 72×72 hero badge on completed cook screen (tappable breakdown sheet, 50/50 plan-accuracy/cook-health formula, score driver summary line); multi-cook reliability overhaul — shared-grill smarts (skip duplicate light step, per-grill AI coaching), grill grouping in schedule modal, inline failure cards with red styling + per-item retry, progress counter ("Saving N of M…"), auto-clear badges on full retry success; robustness fixes (`getTokenSafe` 1s→8s timeout, 30s `customFetch` AbortController, parallel `Promise.allSettled` saves). No DB schema changes. Built with `EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1`.

- **2026-06-08 — Build #122 / v1.0.17**: EAS `ed7d0972`. Fixes: iOS SecureStore token-read timeout 3s→8s + null tokens no longer cached (prevents phantom sign-out); "Stay signed in" toggle above SSO divider on sign-in screen (defaults ON; OFF = memory-only session).

- **2026-06-08 — Build #121 / v1.0.17**: EAS `f0584778`. Hotfix: removed `@sentry/react-native` v8 — incompatible with Expo SDK 54 / RN 0.81.5 new arch, caused `SIGABRT` crash before any app code ran.

- **2026-06-07 — Builds #117–#120 / v1.0.17**: UI tap-freeze fixes (cached `getToken()` on critical path); streaming reverted to non-streaming (RN fetch polyfill drops chunked responses); brand asset refresh (new icon: flame + grill + chart motif); Sentry removed after crash; cache key bumped v24→v25 to bust contaminated EAS cache.

- **2026-06-06 — Builds #113–#116 / v1.0.17**: ThermoWorks in-app password reset; inline MEATER/ThermoWorks error feedback; nav freeze fix (dismiss AI modal before router.push); probe empty-state layout fix.

- **2026-05-10 to 2026-06-05 — Builds #80–#112 (archived)**: Covered v1.0.1–v1.0.16. Key milestones: Apple Sign-In fix (nonce + transfer strategy); IAP paywall live ($4.99/mo, $29.99/yr); email OTP verification; onboarding flow; cook photos; spritz/mop scheduling; size mode selector; BLE Inkbird overhaul; vegetables/fruit categories; DB indexes; AI predict timeouts; frozen cook planning; check-in milestones; multi-cook sequencer.