# knowyourpit — Agent Handoff

**Last updated:** 2026-06-15  
**Current app version:** 1.0.17 (iOS build 125 / Android versionCode 4)

This document is the single-source-of-truth handoff for any agent picking up work on this project. Update the relevant sections after every build, feature, or schema change.

---

## 1. Project at a glance

| Property | Value |
|---|---|
| App name | knowyourpit |
| App Store ID | 6763445064 |
| Bundle ID (iOS) | `com.knowyourpit.app` |
| Package (Android) | `com.knowyourpit.app` |
| EAS project ID | `21f048d2-8424-41d4-9e01-6395719bdc30` |
| EAS account | `taylormadeat` |
| Production API | `https://api.knowyourpit.com` |
| Expo SDK | 54 |
| Node version | 24 |
| TypeScript | 5.9 |

An AI-powered BBQ planning and cook-management app. Users log cooks, get AI coaching from "PitMaster", schedule multi-cook sessions, monitor probe temperatures, and track cook quality over time. Monetised via RevenueCat Pro subscription ($4.99/mo · $29.99/yr).

---

## 2. Monorepo structure

```
workspace/
├── artifacts/
│   ├── knowyourpit/        Mobile app (Expo / React Native)
│   ├── api-server/         Express 5 API served at /api
│   └── marketing/          React + Vite marketing site (/, /privacy, /terms, /support)
├── lib/
│   ├── db/                 Drizzle ORM schema + migrations
│   ├── api-spec/           OpenAPI spec (source of truth for codegen)
│   ├── api-client-react/   Orval-generated React Query hooks + Zod schemas
│   └── api-zod/            Orval-generated Zod schemas (server-side)
└── scripts/                Utility scripts (build backup, RevenueCat seed, etc.)
```

Package manager: **pnpm workspaces**. All `eas` and `expo` commands must run from `artifacts/knowyourpit/` — never from the workspace root.

---

## 3. Current build state

### iOS

| Field | Value |
|---|---|
| Status | ✅ Live on TestFlight / App Store |
| EAS build ID | `7be57ba9-be26-4496-ad63-1e89d32359da` |
| Version | 1.0.17 / build 125 |
| Submission ID | `650eb93c-113b-46d1-a3e6-97dacf85e3ac` |
| TestFlight URL | https://appstoreconnect.apple.com/apps/6763445064/testflight/ios |
| ASC key ID | `3WTDG9D596` (rotated 2026-05-09, old `3J5AF7DP8R` revoked) |
| ASC issuer ID | `2548969f-a92c-4ab7-b550-342a8afa0b37` |

iOS builds require **Xcode 26+** (Apple mandated since 2026-04-28). Always use `macos-sequoia-15.6-xcode-26.2` image.

### Android

| Field | Value |
|---|---|
| Status | ⏳ Build #2 queued — awaiting EAS completion |
| EAS build ID | `1cc1bec4-1669-4ff3-b4ed-e1c88261c94f` |
| Version | 1.0.17 / versionCode 4 |
| EAS logs | https://expo.dev/accounts/taylormadeat/projects/knowyourpit/builds/1cc1bec4-1669-4ff3-b4ed-e1c88261c94f |
| Submission | Manual upload to Play Console required (see §8) |

Build #1 (`32e661e0`) errored: AGP 8 rejected the old `packagingOptions { pickFirst }` DSL — fixed in Build #2 via `plugins/with-android-packaging`.

---

## 4. EAS build commands

Always run from `artifacts/knowyourpit/`. Required flags:

```bash
EXPO_NO_TELEMETRY=1 EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 EAS_BUILD_NO_EXPO_GO_WARNING=true \
  pnpm exec eas build --platform <ios|android> --profile production --non-interactive --no-wait
```

- `EAS_NO_VCS=1` — bypasses git (Replit has no git in the EAS working dir)
- `EXPO_NO_TELEMETRY=1` — prevents EAS CLI from hanging on telemetry prompts
- `EAS_SKIP_AUTO_FINGERPRINT=1` — avoids fingerprint computation failures
- `--no-wait` — returns immediately after queuing (required; Replit bash tool max 120s)

### Current EAS production profile (eas.json)

```json
{
  "credentialsSource": "remote",
  "cache": { "key": "v35-xcode-26" },
  "ios": {
    "image": "macos-sequoia-15.6-xcode-26.2",
    "buildConfiguration": "Release",
    "resourceClass": "m-medium"
  },
  "android": { "buildType": "app-bundle" },
  "env": {
    "USE_FRAMEWORKS": "static",
    "EXPO_PUBLIC_API_URL": "https://api.knowyourpit.com",
    "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD": "pk_live_Y2xlcmsua25vd3lvdXJwaXQuY29tJA"
  }
}
```

### Bumping for a new build

1. **iOS**: increment `ios.buildNumber` in `app.config.js`
2. **Android**: increment `android.versionCode` in `app.config.js`
3. **Cache key**: bump `v35` → `v36` etc. in `eas.json` only if you need a clean EAS build cache (dependency changes, podfile changes)

---

## 5. Known build quirks and hard-won fixes

### iOS — RevenueCat pod pin

`react-native-purchases 9.7.2` resolves to `PurchasesHybridCommon 17.29.0` → `RevenueCat ≥5.55.3`, which pulls in `AppCheckCore` (a Swift pod incompatible with RN's static linking). Fix: `pod 'RevenueCat', '< 5.55.3'` pinned inside the `target 'knowyourpit'` block of `ios/Podfile`. This pin is also injected automatically by `plugins/with-pod-bundle-signing/index.js` during EAS prebuild.

### iOS — static frameworks

`USE_FRAMEWORKS=static` must be set in the EAS production env (it is). Without it, `AppCheckCore` validation fails even with the RevenueCat pin.

### iOS — Xcode 26 mandatory

Xcode 26 is required since Apple's April 2026 mandate. EAS image: `macos-sequoia-15.6-xcode-26.2`. Do not use any earlier image — builds that pass locally may fail on Apple's servers.

### iOS — resource bundle code signing

All CocoaPods resource bundles must have `CODE_SIGNING_ALLOWED=NO`. Injected by `plugins/with-pod-bundle-signing` into the `post_install` block. Do not remove this plugin.

### iOS — deployment target

All pods are forced to iOS 16.1+ minimum (required by the Live Activity extension). Set in `plugins/with-pod-bundle-signing` post_install hook.

### Android — AGP 8 packaging DSL

`packagingOptions { pickFirst }` (AGP 7 syntax) is rejected by the AGP 8 version bundled with Expo SDK 54. The correct syntax is in `plugins/with-android-packaging/index.js`:

```groovy
packaging {
    resources {
        pickFirsts += ['META-INF/versions/9/OSGI-INF/MANIFEST.MF']
    }
}
```

**Never** use `android.packagingOptions` in `app.config.js` — the Expo core plugin generates the old DSL.

### EAS archive size

`.easignore` excludes `node_modules/` (workspace root = 1.1 GB) and `.git/`. Both are reinstalled/bypassed by EAS. Without these exclusions the archive was 195 MB compressed and uploads timed out in Replit (120s tool limit). With them, uploads complete in ~10s.

---

## 6. Tech stack and key files

### Mobile app (`artifacts/knowyourpit/`)

| Area | Key files |
|---|---|
| Entry / layout | `app/_layout.tsx` |
| Auth screens | `app/(auth)/sign-in.tsx`, `sign-up.tsx`, `set-username.tsx` |
| Tab screens | `app/(tabs)/index.tsx` (Home), `cooks.tsx`, `plan.tsx`, `ai.tsx`, `more.tsx` |
| Cook detail | `app/cook/[id].tsx` |
| API hooks | `lib/api-client-react/src/` (Orval-generated — do not hand-edit) |
| Auth | Clerk (`@clerk/expo`). Email+password primary; Google SSO; Apple Sign-In (native) |
| Subscription | `contexts/SubscriptionContext.tsx`, `components/PaywallModal.tsx` |
| Token helper | `lib/getTokenSafe.ts` — 8s timeout, never caches null (prevents phantom sign-out) |
| HTTP client | `lib/customFetch.ts` — 30s AbortController timeout on every request |
| Config plugins | `plugins/with-android-packaging/`, `plugins/with-pod-bundle-signing/`, `plugins/with-live-activity/` |
| Env reference | `ENV.md` — canonical list of all `EXPO_PUBLIC_*` variables and injection paths |
| Android setup | `ANDROID_SETUP.md` — Play Store setup, WIF auth, FCM |
| App Review notes | `APP_REVIEW_NOTES.md` — paste into App Store Connect before each iOS submission |

### UI conventions

- **Keyboard-safe modals**: always use `AppKeyboardAvoidingView` (at `components/AppKeyboardAvoidingView.tsx`) instead of raw `KeyboardAvoidingView` in any modal with a `TextInput`.
- **Auth screens**: always render with dark palette via `useAuthColors()` regardless of system theme.
- **Do not delete** the Apple Watch companion app code — it is the starting point for future modernization.

### API server (`artifacts/api-server/`)

Express 5 on the `/api` path. Key areas:

| Area | Location |
|---|---|
| Entry | `src/index.ts` |
| Auth middleware | `src/middleware/requireAuth.ts` (Clerk JWT) |
| Paywall gate | `src/lib/paywall.ts` — `requirePro()` middleware; `PAYWALL_ENABLED=false` bypasses globally |
| AI routes | `src/routes/ai/` — PitMaster chat, cook predictions, multi-cook sequencer |
| 402 response | `respondPaywall(res, ...)` — uniform paywall error format |
| Logging | Use `req.log` in route handlers, `logger` singleton elsewhere. Never `console.log`. |

### Database (`lib/db/`)

PostgreSQL via Drizzle ORM. Key tables: `grills`, `cooks`, `recipes`, `temperature_readings`, `alerts`, `conversations`, `messages`, `subscription_entitlements`.

Schema lives in `lib/db/src/schema/index.ts`. Run migrations with:

```bash
pnpm --filter @workspace/db run push:force
```

Post-merge setup auto-runs `drop-orphans` + `push-force` on every task merge.

### API contract

OpenAPI spec: `lib/api-spec/src/openapi.yaml`. After any spec change:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This regenerates `lib/api-client-react/src/` and `lib/api-zod/src/`. **Never hand-edit generated files.**

---

## 7. Authentication (Clerk)

- Dev Clerk instance: `pk_test_*` key via Replit secret `CLERK_PUBLISHABLE_KEY`
- Prod Clerk instance: `pk_live_Y2xlcmsua25vd3lvdXJwaXQuY29tJA` (also in `eas.json`)
- Clerk secret keys: `CLERK_SECRET_KEY` (dev), `CLERK_SECRET_KEY_PROD` (prod) — Replit secrets
- Google SSO: works in dev; needs enabling in prod Clerk dashboard
- Apple Sign-In: shown only when `AppleAuthentication.isAvailableAsync()` returns true; uses `oauth_token_apple` strategy
- Account deletion: `DELETE /api/profile/me` — wipes all user data then deletes Clerk user in a single transaction

---

## 8. Android Play Store submission

**Service account JSON keys are blocked** by Google Cloud org policy (`iam.managed.disableServiceAccountApiKeyCreation`). Two paths:

### Path A: Manual upload (current)

1. Wait for EAS build to complete at https://expo.dev/accounts/taylormadeat/projects/knowyourpit/builds
2. Download the `.aab` file
3. Go to Play Console → knowyourpit → Production → Create new release
4. Upload the `.aab`, fill in release notes, submit for review

### Path B: Automated via WIF (pending GCP setup)

See `ANDROID_SETUP.md` §3 for full walkthrough. Short version:
1. Run `scripts/setup-wif.sh` from a machine with `gcloud` (not Replit)
2. Grant Play Console access to `play-submit-eas@PROJECT_ID.iam.gserviceaccount.com`
3. Store the credential config JSON in Replit secret `GOOGLE_PLAY_WIF_CONFIG`
4. Then `./scripts/submit-android.sh` will handle it automatically

---

## 9. iOS App Store submission

```bash
# From artifacts/knowyourpit/
./scripts/submit-ios.sh
```

Reads `ASC_API_KEY_P8`, `ASC_API_KEY_ID`, `ASC_API_ISSUER_ID` from Replit secrets. Submits the latest finished EAS build to TestFlight. After TestFlight processing, promote manually in App Store Connect.

---

## 10. Environment variables

### Replit secrets (server-side)

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing |
| `CLERK_SECRET_KEY` | Dev Clerk API secret |
| `CLERK_SECRET_KEY_PROD` | Prod Clerk API secret |
| `CLERK_PUBLISHABLE_KEY_PROD` | Prod Clerk publishable key |
| `RESEND_API_KEY` | Email via Resend (contact form) |
| `ADMIN_API_TOKEN` | Internal admin API bearer token |
| `ASC_API_KEY_P8` | Apple App Store Connect API private key |
| `ASC_API_KEY_ID` | ASC API key ID (`3WTDG9D596`) |
| `ASC_API_ISSUER_ID` | ASC API issuer ID |
| `EXPO_TOKEN` | EAS authentication token |

### EAS-managed (mobile build)

See `ENV.md` for the full reference. Key production vars:

| Variable | Value/Source |
|---|---|
| `EXPO_PUBLIC_API_URL` | `https://api.knowyourpit.com` (hardcoded in `eas.json`) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `pk_live_*` (in `eas.json` + EAS secret) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `appl_*` (EAS env, all 3 environments) |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `goog_*` (EAS env, all 3 environments) |

---

## 11. RevenueCat / paywall

- iOS product IDs: `com.knowyourpit.pro.monthly`, `com.knowyourpit.pro.annual`
- Same IDs needed in Play Console for Android (not yet created)
- Server-side gate: `src/lib/paywall.ts` in api-server — `requirePro()` middleware
- `PAYWALL_ENABLED=false` env var bypasses every gate globally (useful for testing)
- Free tier limits: 3 total cooks, 3 AI messages/day, 1 AI cook scan/day
- Pro unlocks: unlimited cooks, unlimited PitMaster chat, multi-cook sequencing, analytics

---

## 12. Ops log

| Date | Platform | Build | Status | EAS ID |
|---|---|---|---|---|
| 2026-06-15 | Android | #2 v1.0.17 vC4 | ⏳ Queued | `1cc1bec4` |
| 2026-06-15 | Android | #1 v1.0.17 vC4 | ❌ Errored (AGP 8 packagingOptions) | `32e661e0` |
| 2026-06-14 | iOS | #131 v1.0.17 b125 | ✅ TestFlight | `7be57ba9` |
| 2026-06-14 | iOS | #130 v1.0.17 | ❌ Errored (RevenueCat pod) | `5d4114bd` |
| 2026-06-14 | iOS | #124 v1.0.17 | ❌ Errored (modular headers) | `b54eeddb` |
| 2026-06-14 | iOS | #123 v1.0.17 | ❌ Errored (AppCheckCore) | `165d924c` |
| 2026-06-08 | iOS | #122 v1.0.17 b122 | ✅ TestFlight | `ed7d0972` |
| 2026-06-08 | iOS | #121 v1.0.17 | ❌ Errored (Sentry crash) | `f0584778` |

Full history: see `replit.md` Ops Log section.

---

## 13. Pending work (known gaps)

| Item | Notes |
|---|---|
| Android Play Console listing | App not yet created. Needs store listing, screenshots, content rating before first release |
| Android FCM | `google-services.json` not configured — push notifications won't work on Android |
| Android IAP products | `com.knowyourpit.pro.monthly` / `com.knowyourpit.pro.annual` not yet created in Play Console |
| WIF GCP setup | `scripts/setup-wif.sh` written but not run — needs `gcloud` outside Replit |
| Android build verification | Build #2 result unknown — check expo.dev before promoting to Play Console |
| `support@knowyourpit.com` | Email forwarding not yet configured |

---

## 14. How to update this file

Update the following sections after each action:

- **§3 Current build state**: after every EAS build (queued, errored, or succeeded)
- **§5 Known quirks**: whenever a new build workaround is discovered
- **§12 Ops log**: one row per build attempt (newest at top)
- **§13 Pending work**: check off items when resolved, add new gaps as discovered
- **§4 Build commands**: if `eas.json` cache key, image, or flags change
