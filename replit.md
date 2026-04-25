# KnowYourPit

## Overview

KnowYourPit is a comprehensive BBQ planning and management app powered by AI. Users can manage grill profiles, log cook sessions, get AI-powered cook plans and time predictions, monitor temperatures, browse recipes, and get personalized pit master coaching.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Mobile app**: Expo / React Native (artifacts/knowyourpit)
- **API framework**: Express 5 (artifacts/api-server), served at `/api`
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **AI**: OpenAI via Replit AI Integrations (gpt-5.2)

## Features

- **Dashboard**: Overview stats, recent cooks, quick actions
- **Grill Profiles**: CRUD for multiple grill profiles with cook history and stats
- **Cook Logger**: Log cook sessions with food type, weight, target temps, status, notes, ratings
- **AI Assistant**: Natural language BBQ guidance using OpenAI
- **AI Predictions**: Smart cook time predictions based on food type, weight, grill, and history
- **Temperature Upload**: Upload data from MEATER, ThermoWorks, Inkbird, Govee, or CSV
- **Temperature Monitoring**: Historical temperature readings with charts per cook
- **Recipes**: Browse, search, favorite, and manage BBQ recipes
- **Community Forum**: Post, comment, and like in category-based forum
- **Cooking Tips**: Browse tips by category and difficulty
- **Alerts**: Set temperature thresholds and alert rules

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Database Tables

- `grills` — Grill profiles
- `cooks` — Cook sessions
- `recipes` — BBQ recipes
- `temperature_readings` — Temperature probe readings
- `forum_posts` — Community forum posts
- `forum_comments` — Forum post comments
- `cooking_tips` — Curated cooking tips
- `alerts` — Temperature alert rules
- `conversations` / `messages` — AI conversation history (via OpenAI integration)

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `AI_INTEGRATIONS_OPENAI_BASE_URL` — OpenAI proxy URL (auto-provisioned via Replit AI Integrations)
- `AI_INTEGRATIONS_OPENAI_API_KEY` — OpenAI API key (auto-provisioned)
- `SESSION_SECRET` — Session secret

## Apple Watch Companion App

> **TEMPORARILY DISABLED (2026-04-25).** The `./plugins/with-watch-app` entry was removed from `app.json`'s `expo.plugins` array so iOS production builds can ship without the watch app. The plugin code, all Swift files, and the `modules/watch-connectivity/` native module are still in the repo and unchanged. **Do not delete them** — they are the starting point for the watch modernization work.
>
> **Why disabled:** The plugin uses Apple's legacy WatchKit 2 architecture (separate `com.apple.product-type.application.watchapp2` + `com.apple.product-type.watchkit2-extension` targets), which Apple deprecated in Xcode 14 and **removed entirely in Xcode 15+**. The current EAS image is `macos-sequoia-15.6-xcode-16.4`, which fails the build with `unable to resolve product type 'com.apple.product-type.application.watchapp2'`.
>
> **To re-enable**, the watch architecture needs to be migrated to a single-target SwiftUI watchOS app (`com.apple.product-type.application` with `SDKROOT = watchos`, `WKApplication = true` in Info.plist) plus an optional Widget Extension for complications. The 5 Swift screens, `WatchSessionDelegate`, `WatchDataModel`, and the WCSession-based phone bridge can mostly be reused as-is — only the targets, build phases, and `@main` app structure need to change. Then re-add `"./plugins/with-watch-app"` to the `expo.plugins` array.

The Watch app is implemented as a native WatchKit Extension built via EAS Build. It cannot run in Expo Go.

### Architecture
- **Config plugin**: `artifacts/knowyourpit/plugins/with-watch-app/index.ts` — run during `expo prebuild` to inject the Watch targets into the Xcode project
- **Swift source files**: `artifacts/knowyourpit/plugins/with-watch-app/WatchExtension/` — 5 SwiftUI screens + WCSession delegate + data model
- **Native module**: `artifacts/knowyourpit/modules/watch-connectivity/` — Expo module exposing WCSession to JS (`updateApplicationContext`, `sendMessage`, events)
- **Phone bridge**: `artifacts/knowyourpit/hooks/useWatchBridge.ts` — polls API every 15 s, detects stalls, pushes data to Watch. Called in `_layout.tsx` (no-op on Android/web)

### 5 Watch Screens
1. **Active Cook** — probe temp hero, cook name, elapsed time, estimated finish
2. **Start / Stop Cook** — hold-to-stop (2 s), mark done, start planned cook
3. **PitMaster AI** — latest AI insight + Siri Dictation → /api/ai/chat
4. **Stall Alert** — amber alert when probe flatlines 30+ min; Wrap It / Ride It Out
5. **Fuel Timer** — countdown ring for wood/charcoal add reminders; one-tap reset

### Data flow
Phone polls API → `useWatchBridge` → `WatchConnectivity.updateApplicationContext` → WCSession → Watch `WatchSessionDelegate` → `WatchDataModel` → SwiftUI views

Watch actions (stop cook, ask PitMaster, etc.) → WCSession message → `onWatchMessage` event → `useWatchBridge` handler → API mutation

### Build requirements
- Apple Developer account with Watch extension bundle IDs registered:
  - `com.knowyourpit.app.watchkitapp`
  - `com.knowyourpit.app.watchkitextension`
- App Group: `group.com.knowyourpit.app` (shared keychain for auth relay)
- EAS Build: `eas build --platform ios --profile production` — **must be run from `artifacts/knowyourpit/`**, never from the repo root (see "EAS / Expo command location" below)
- Targets watchOS 7+, Apple Watch Series 4+ (41mm and 45mm)

### iOS resource bundle signing — two-part fix
EAS iOS builds under Xcode 14+ require both of these to be in place. Removing either will reintroduce the "Starting from Xcode 14, resource bundles are signed by default…" build error:

1. **`expo.ios.appleTeamId: "W8AY23XJTF"` in `artifacts/knowyourpit/app.json`.** Expo prebuild reads this to populate `DEVELOPMENT_TEAM` in the generated Xcode project. The same team ID must continue to match `eas.json`'s `submit.production.ios.appleTeamId`. (When the watch-app plugin is re-enabled, its three targets also reference `$(DEVELOPMENT_TEAM)` and rely on this same field.)
2. **`./plugins/with-pod-bundle-signing` in the `expo.plugins` array.** React Native 0.81's own `react_native_post_install` only disables signing for **React-Core's** resource bundles (see `react-native/scripts/cocoapods/utils.rb` → `turn_off_resource_bundle_react_core` → `if pod_name.to_s == 'React-Core'`). Every other pod (`expo-image`, `expo-font`, `expo-notifications`, etc.) still requires a development team on its bundle targets and fails the build under Xcode 16. This plugin injects code into the **end** of the existing `post_install` block (so it runs AFTER `react_native_post_install` and has the final word) that sets `CODE_SIGNING_ALLOWED = NO`, `CODE_SIGN_IDENTITY = ""`, and `EXPANDED_CODE_SIGN_IDENTITY = ""` on every `com.apple.product-type.bundle` target. Resource bundles do not need their own signature for App Store submission — the parent app's signature covers them. The plugin is idempotent (looks for `# PIT_RESOURCE_BUNDLE_SIGNING_FIX` before injecting) and prints `[KnowYourPit] Disabling code signing for resource bundles` during `pod install` so you can confirm in EAS build logs that it ran.

---

## EAS / Expo command location (important — read before running eas or expo commands)

**All `eas` and `expo` commands must be run from `artifacts/knowyourpit/`, never from the workspace root.** The mobile app is a self-contained pnpm workspace package: its `eas.json`, `app.json`, `plugins/`, `assets/`, `node_modules/`, and (after `expo prebuild`) `ios/`/`android/` all live inside `artifacts/knowyourpit/`. Run from there and every relative path and bare-module plugin name resolves naturally.

```bash
cd artifacts/knowyourpit
eas build --platform ios --profile production
eas submit --platform ios --latest
expo prebuild --no-install --platform ios
eas init       # if ever needed
```

**Do not run these commands from the workspace root.** Doing so used to "work" only by maintaining an elaborate mirror of symlinks at the workspace root (`/eas.json`, `/app.json`, `/plugins`, `/assets`, `/ios`, `/android`, plus a per-package `node_modules` mirror). That layer was deleted because each addition surfaced new resolution bugs:

- [Task #91](.local/tasks/task-91.md): `eas init` run from the repo root wrote standalone `eas.json`/`app.json` files that overwrote the symlinks, and EAS silently used the stale configs (wrong `image`, wrong `projectId`, no env vars).
- [Task #92](.local/tasks/task-92.md): after Task #91's symlinks were restored, Expo failed with `Failed to resolve plugin for module './plugins/with-watch-app' relative to '/home/runner/workspace'` because the relative paths inside `app.json` no longer resolved.
- A follow-up node_modules incident: bare-name plugins (`expo-router`, `expo-notifications`, etc.) failed to resolve because the workspace-root `node_modules/` did not contain them.

The clean fix — running from the artifact directory — eliminates all three failure modes at once.

The Expo dev server (`pnpm --filter @workspace/knowyourpit dev`) is unaffected; it has always run inside the artifact's package via pnpm filters.

---

## Deploying the API Server

The API server (`artifacts/api-server`) must be published via Replit's Publish feature before running a production EAS build of the mobile app.

### Steps to deploy

1. Click the **Publish** button in the Replit header (or re-publish if already deployed).
2. After publishing, your deployed URL appears in the Replit header — it follows the pattern:
   `https://<your-replit-app>.replit.app`
3. Verify the health check returns 200 from the deployed URL:
   `GET https://<your-replit-app>.replit.app/health` → `{"status":"ok"}`

The API server is currently deployed and serving traffic (confirmed via deployment logs:
`GET /api/healthz` returns 200, DB-backed routes return correct responses).

### Setting EXPO_PUBLIC_API_URL for EAS builds

`artifacts/knowyourpit/eas.json` has `EXPO_PUBLIC_API_URL` set in `build.production.env` to the confirmed live deployed URL:

```
https://6583df0b-1166-4042-a222-d49fbda4017d-00-lgd8ruzq76oq-ufrk6h68.janeway.replit.dev
```

If the project is later re-deployed under a new `.replit.app` custom domain, update this value in `eas.json` and in the comment at the top of `artifacts/knowyourpit/app/_layout.tsx`.

Alternatively, pass it as an EAS secret instead of hardcoding in eas.json:
```
eas secret:create EXPO_PUBLIC_API_URL <deployed-url>
```

The mobile app prepends this base URL to all API calls (e.g., `/api/grills`, `/api/cooks`).

### Health check endpoints

- `GET /health` — top-level health check (used by Replit deployment)
- `GET /api/healthz` — API-prefixed health check

### Privacy policy

The privacy policy is served at `GET /privacy` (no auth required).

**Important:** The URL currently hardcoded in two places is a temporary Replit dev domain that may change:

1. `artifacts/knowyourpit/eas.json` → `build.production.env.EXPO_PUBLIC_API_URL`
2. `artifacts/knowyourpit/app.json` → `expo.privacyPolicyUrl`

Both must be updated to the stable `.replit.app` domain before submitting to any app store. Do not paste the current `janeway.replit.dev` URL into App Store Connect or Google Play Console — it is not guaranteed to stay live.

**Once you have a stable domain (see task to stabilize the API URL):**
1. Update `EXPO_PUBLIC_API_URL` in `eas.json`
2. Update `privacyPolicyUrl` in `app.json` to `https://<stable-domain>/privacy`
3. Verify `GET https://<stable-domain>/privacy` returns 200 in a browser
4. Paste that URL into App Store Connect → App Information → Privacy Policy URL
5. Paste that URL into Google Play Console → Store Listing → Privacy Policy

**Contact email:** The policy currently references `privacy@knowyourpit.com` — update this to a real monitored address before submitting.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
