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
- EAS Build: `eas build --platform ios --profile production` (run from repo root — see "EAS config layout" below)
- Targets watchOS 7+, Apple Watch Series 4+ (41mm and 45mm)

---

## EAS config layout (important — read before editing eas.json or app.json)

The `eas build` command must be run from the **repo root**, because EAS expects the native dirs and asset paths alongside the config files it reads. The repo root mirrors the artifact's config files and directories via **symlinks**:

```
eas.json   -> artifacts/knowyourpit/eas.json     (canonical EAS config)
app.json   -> artifacts/knowyourpit/app.json     (canonical Expo config)
plugins    -> artifacts/knowyourpit/plugins      (resolves ./plugins/* in app.json)
assets     -> artifacts/knowyourpit/assets       (resolves ./assets/* in app.json)
ios        -> artifacts/knowyourpit/ios          (created by `expo prebuild`)
android    -> artifacts/knowyourpit/android      (created by `expo prebuild`)
```

The first two are checked in as committed symlinks. The remaining four are auto-created by `scripts/expo-eas.sh` (idempotent `ln -sfn`) and ignored by git — `plugins`/`assets` on every script invocation (the source dirs always exist), and `ios`/`android` after `expo prebuild` runs (those source dirs are prebuild-generated). Each block also runs a clobber guard that errors out with an explicit restore command if a slot is ever replaced by a regular file or directory.

**Why all six exist:** Expo and EAS resolve relative paths inside `app.json` (e.g. `"./plugins/with-watch-app"`, `"./assets/images/icon.png"`) from the *location of the file being loaded*, not from the project root. When EAS reads `app.json` via the workspace-root symlink, those relative paths resolve to `/home/runner/workspace/...` — so the directories must also exist at that location.

**Do not replace these symlinks with regular files or directories.** Two prior incidents:
- [Task #91](.local/tasks/task-91.md): `eas init` run from the repo root wrote standalone `eas.json` and `app.json`. Those stale files had no `image` field, no env vars, and a different `extra.eas.projectId`, so EAS silently ignored the artifact's `"image": "macos-sequoia-15.6-xcode-16.4"` and `appVersionSource: "local"` settings.
- [Task #92](.local/tasks/task-92.md): after Task #91's symlinks were in place, Expo failed with `"Failed to resolve plugin for module './plugins/with-watch-app' relative to '/home/runner/workspace'"` because the `plugins/` and `assets/` directories had not yet been mirrored at the repo root.

If you ever need to re-run `eas init`, do it from `artifacts/knowyourpit/` — never from the repo root.

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
