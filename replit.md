# knowyourpit

## Overview

knowyourpit is an AI-powered BBQ planning and management application. It offers tools for managing grill profiles, logging cook sessions, and providing AI-driven cook plans and time predictions. The app also features temperature monitoring, recipe management, and personalized pit master coaching.

## User Preferences

- All `eas` and `expo` commands must be run from `artifacts/knowyourpit/`, never from the workspace root.
- Do not delete the disabled Apple Watch companion app code; it is the starting point for future modernization work.

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

- **2026-05-22 — Build #99 / v1.0.4 queued**: buildNumber 98→99. Features: thaw-start countdown on frozen cook cards (#762 — "START THAW" badge chip, countdown to thaw window open); spritz schedule sub-rows on cook timeline (#763 — teal dots between Meat On and Wrap/Pull-off showing each spritz time + live countdown); wrap finish technique displayed as italic sub-line beneath wrap step. EAS build + submit pending.

- **2026-05-22 — Build #98 / v1.0.4 submitted to TestFlight**: EAS build id `08d59c98-a58e-4427-ba6f-2bc51bc6126f`. Submission id `8ea1afb3-eb50-4ea9-8622-f0dce25bea24` — status FINISHED (confirmed via EAS GraphQL). Feature: 24-hour minimum floor for refrigerator thaw method (#760) + `frozenThawOverlapsGrill` plan warning when thaw window extends past preheat start. buildNumber 97→98. Subsequent retry submissions (318d76f9, d639e495, f9531de2, aa3b9d4b) all ERRORED — expected, Apple rejected duplicate binary uploads after first submission succeeded.

- **2026-05-21 — Build #97 / v1.0.4 queued to TestFlight**: EAS build id `aff35a29-27c0-4540-932f-eddbda382216`. Resubmit — no code changes since #96.

- **2026-05-21 — Build #96 / v1.0.4 queued to TestFlight**: EAS build id `94828d8b-8536-4917-8112-f1a7a810d92d`. Features: cook photo attachments (#710, object storage, CookPhotosSection + AI photo analysis #719); cooking method chips in multi-cook (#707); remember last method per cut (#709, #711, #712, #720); per-cut technique memory for rub/spritz/wrap/injection/meatStartTemp (#725, #728); performance stats by technique (#713); per-cook editing in multi-cook session (#715, #716); spritz reminders notifications (#732), next-spritz countdown (#733), haptic nudge (#736); carry spritz cadence into AI plan (#734); technique summary on cook detail (#737); technique chips on cook log cards (#739); spritz cadence in AI analysis (#740); spritz liquid preference + PitMaster memory (#741); "Add to planned cook" button on cook detail. Pre-build: ONBOARDING_ALWAYS_SHOW flipped false, photo permission strings updated for general attachments, versionCode 2→3. Fix: expo-image-manipulator downgraded 55.0.16→14.0.8 (SDK 54 compat — build #95 errored XCODE_BUILD_ERROR: FileSystemUtilities.isReadableFile).

- **2026-05-18 — Build #94 / v1.0.3 queued to TestFlight**: EAS build id `13328fba-323c-4974-8ce4-9d1533f26a40`. Version bumped 1.0.2 → 1.0.3 because Apple locked the 1.0.2 train (ITMS-90186 + ITMS-90062 — previously approved version cannot receive new builds). Features: first-launch onboarding walkthrough (#684 — 6 slides, brand-orange palette, Skip→last slide, AsyncStorage+Clerk completion persistence, account-age gate so existing users never see it); onboarding replay from More → Help (#695); BetaWelcomeModal deleted (#696); Contact support row opens in-app support modal (#697, #700 — posts to `/api/contact` with source field); close button + back button in replay mode (#698, #701). Note: EAS_NO_VCS=1 required. Build #93 (v1.0.2) was discarded — never reached TestFlight.

- **2026-05-10/11 — Builds #80–#89 (resolved issues, condensed)**:
  - **Apple Sign-In** (builds #80–#82): Fixed `"you are not authorized"` errors. Correct pattern: call `signIn.create({ strategy: "oauth_token_apple", token, nonce })` first, then if `firstFactorVerification.status === "transferable"` call `signUp.create({ transfer: true })`. The `nonce` (from `Crypto.randomUUID()`) is required — Clerk's prod backend validates it for transfer-mode sign-up. New Apple users are routed to `/(auth)/set-username` after sign-up.
  - **IAP paywall** (builds #86–#88 + server-side fix): Both subscriptions (`com.knowyourpit.pro.monthly` id=6764196256, `com.knowyourpit.pro.annual` id=6764194128) resolved from MISSING_METADATA → READY_TO_SUBMIT after uploading review screenshots via ASC API. SubscriptionContext safety timer extended to 25 s. RC iOS SDK key: `appl_mhkVJhxDzwRmZTeUZSVShSwaimi`. Prices: $4.99/mo, $29.99/yr.
  - **Email verification** (build #89): Sign-up now handles `unverifiedFields: ["email_address"]` — shows OTP screen, calls `prepareEmailAddressVerification` + `attemptEmailAddressVerification` before proceeding.
  - **App Store Review**: Pending — primary category + age rating must be set in ASC web UI before submitting. App version v1.0 build #88 is in PREPARE_FOR_SUBMISSION.