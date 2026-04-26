# knowyourpit

## Overview

knowyourpit is a comprehensive BBQ planning and management app powered by AI. Users can manage grill profiles, log cook sessions, get AI-powered cook plans and time predictions, monitor temperatures, browse recipes, and get personalized pit master coaching.

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
2. **`./plugins/with-pod-bundle-signing` in the `expo.plugins` array.** React Native 0.81's own `react_native_post_install` only disables signing for **React-Core's** resource bundles (see `react-native/scripts/cocoapods/utils.rb` → `turn_off_resource_bundle_react_core` → `if pod_name.to_s == 'React-Core'`). Every other pod (`expo-image`, `expo-font`, `expo-notifications`, etc.) still requires a development team on its bundle targets and fails the build under Xcode 16. This plugin injects code into the **end** of the existing `post_install` block (so it runs AFTER `react_native_post_install` and has the final word) that sets `CODE_SIGNING_ALLOWED = NO`, `CODE_SIGN_IDENTITY = ""`, and `EXPANDED_CODE_SIGN_IDENTITY = ""` on every `com.apple.product-type.bundle` target. Resource bundles do not need their own signature for App Store submission — the parent app's signature covers them. The plugin is idempotent (looks for `# PIT_RESOURCE_BUNDLE_SIGNING_FIX` before injecting) and prints `[knowyourpit] Disabling code signing for resource bundles` during `pod install` so you can confirm in EAS build logs that it ran.

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

The privacy policy is served by the marketing website at `https://knowyourpit.com/privacy` (see "Marketing website" section below).

The legacy server-rendered `/privacy` and `/support` HTML routes that previously lived on the API server have been removed (along with their `privacy-policy.ts` / `support-page.ts` source modules) now that the marketing site owns those paths. The canonical legal URLs are served by the React marketing app at the apex domain.

`artifacts/knowyourpit/app.json` → `expo.privacyPolicyUrl` is set to `https://knowyourpit.com/privacy`.

**Contact email:** The marketing site (and the privacy/terms it serves) reference `support@knowyourpit.com` — set up forwarding for this address before submitting any new build that points at the new URL.

## Marketing website (artifacts/marketing)

A React + Vite presentation site for `knowyourpit.com`. Four routes:

- `/` — landing page (hero, features, App Store CTA)
- `/privacy` — privacy policy (canonical)
- `/terms` — terms of service (canonical)
- `/support` — FAQs + contact form

### Contact form backend

`POST /api/contact` on the API server (`artifacts/api-server/src/routes/contact.ts`) accepts JSON `{ name, email, subject, message, website? }`. The `website` field is a hidden honeypot — non-empty values are silently dropped. The route uses `express-rate-limit` (5 requests / 15 minutes per IP). Submissions are stored in the `contact_messages` table (`lib/db/src/schema/contact_messages.ts`).

The route is mounted at `/api/contact` and is **not** behind Clerk auth, since it's posted from the public marketing site at a different origin. CORS is already wide-open via `cors({ credentials: true, origin: true })` in `app.ts`.

**Schema rollout to production.** The api-server's `build` script runs `pnpm --filter @workspace/db run push-force` before bundling. Because Replit's autoscale deployment runs `pnpm run build` from the workspace root (which fans out to `pnpm -r --if-present run build`), the contact_messages table — and any future schema additions — are pushed to the deployment-time `DATABASE_URL` automatically as part of every publish. No manual `db push` step is needed at deploy. The push is idempotent and safe in dev as well (where it's a no-op against an already-synced local DB).

### Production routing (which artifact serves which path)

The published deployment hosts both artifacts behind the same custom domain. Path ownership at the proxy is:

- `/api/*` — api-server (all REST routes including `/api/contact`)
- `/health` — api-server (deployment health probe)
- everything else — marketing static site (`/`, `/privacy`, `/terms`, `/support`, plus any future marketing routes)

This is wired by `paths` in each artifact's `.replit-artifact/artifact.toml`. The marketing artifact runs at `BASE_PATH=/` in both dev and production (so the React routes `/`, `/privacy`, `/terms`, `/support` resolve at the apex), and api-server intentionally does **not** claim `/privacy` or `/support` — those legacy static-HTML handlers and the `privacy-policy.ts` / `support-page.ts` modules were removed when the marketing site shipped. Apple's Privacy Policy URL of `https://knowyourpit.com/privacy` is therefore served by the React marketing app, not the API server.

### Custom domain hand-off (DNS — user action required)

The user owns `knowyourpit.com` at their registrar. To wire it to the deployed Replit web artifact:

1. **Deploy the project first** (this picks up the `marketing` artifact alongside `api-server`). The default URL after publish will be `<deployment-name>.replit.app`.
2. In the Replit Publishing UI, open **Settings → Domains → Link a domain** and add **both** `knowyourpit.com` and `www.knowyourpit.com`. Replit issues the verification token at this step.
3. **Add three records at the user's DNS provider.** Replit will display the exact final values in the Publishing UI (the IP and verification token are deployment-specific and must be copied from the UI verbatim — do not guess). The records will look like this:

   | Host | Type | Value | TTL |
   | --- | --- | --- | --- |
   | `@` (apex) | `A` | (IPv4 shown in Publishing UI, e.g. `34.x.x.x`) | 3600 |
   | `www` | `CNAME` | (target shown in Publishing UI, e.g. `<deployment>.replit.app`) | 3600 |
   | `_replit-verify` | `TXT` | `replit-verify=<token>` (token shown in Publishing UI) | 3600 |

   Apex `CNAME` is not allowed at most registrars — that's why Replit uses an `A` record at `@`. If the user's registrar supports `ALIAS`/`ANAME` flattening, that also works in place of `A`.

4. Wait for verification (usually minutes; can take up to 24h for full propagation). Replit auto-provisions Let's Encrypt TLS once the records resolve.
5. Confirm in a browser: `https://knowyourpit.com/`, `https://knowyourpit.com/privacy`, `https://knowyourpit.com/terms`, `https://knowyourpit.com/support` — all should return 200 with a valid TLS certificate. Submit the support form and verify a row lands in the `contact_messages` table.
6. Only **after** all of the above is green, update the Apple Privacy Policy URL in App Store Connect to `https://knowyourpit.com/privacy` and submit the next build.

The marketing artifact's `previewPath` is `/` (set in `artifacts/marketing/.replit-artifact/artifact.toml`), and `BASE_PATH=/` in both dev and production — so the React routes (`/`, `/privacy`, `/terms`, `/support`) resolve at the apex in every environment, including the custom domain.

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
