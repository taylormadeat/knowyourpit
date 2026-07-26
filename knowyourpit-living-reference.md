# knowyourpit — Living Reference Document

> **Generated:** 2026-07-25  
> **App version:** 1.0.17 · Build 127  
> **Expo SDK:** 54.0.0 · React Native 0.81.5  
> **Node.js:** 24 · TypeScript: ~5.9.2

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Monorepo Structure](#2-monorepo-structure)
3. [Mobile App (knowyourpit)](#3-mobile-app-knowyourpit)
4. [API Server](#4-api-server)
5. [Database Schema](#5-database-schema)
6. [Paywall & Subscription](#6-paywall--subscription)
7. [Authentication](#7-authentication)
8. [Temperature Probe Integrations](#8-temperature-probe-integrations)
9. [AI Features](#9-ai-features)
10. [Marketing Website](#10-marketing-website)
11. [Shared Libraries](#11-shared-libraries)
12. [Environment Variables & Secrets](#12-environment-variables--secrets)
13. [Build & Release Process](#13-build--release-process)
14. [Database Migrations & Ops](#14-database-migrations--ops)
15. [UI Conventions & Design System](#15-ui-conventions--design-system)
16. [Feature Detail: Cook Lifecycle](#16-feature-detail-cook-lifecycle)
17. [Feature Detail: Session Schedule & Step Confirmation](#17-feature-detail-session-schedule--step-confirmation)
18. [Feature Detail: Frozen Cook Planning](#18-feature-detail-frozen-cook-planning)
19. [Feature Detail: Check-in System](#19-feature-detail-check-in-system)
20. [Feature Detail: PitMaster AI Coaching](#20-feature-detail-pitmaster-ai-coaching)
21. [Feature Detail: Multi-Cook Sequencer](#21-feature-detail-multi-cook-sequencer)
22. [Ops Log](#22-ops-log)
23. [Known Issues & Pending Work](#23-known-issues--pending-work)

---

## 1. Product Overview

**knowyourpit** is an AI-powered BBQ planning and cook management app for serious pitmasters. It covers the full cook lifecycle — from planning (what meat, which grill, when to start) through live monitoring (probe temperatures, check-ins, fuel timing) to post-cook analysis (AI coaching, health scores, historical trends).

### Core value pillars

| Pillar | What it delivers |
|---|---|
| **Plan** | AI-generated cook timelines with thaw, temper, preheat, cook, wrap, rest, serve stages |
| **Monitor** | Live temperature feeds from BLE (Inkbird), WiFi (MEATER, ThermoWorks, Fireboard), and manual entry |
| **Coach** | PitMaster AI chat, per-cook analysis with drift feedback, health scores, technique insights |
| **Log** | Rich cook records — photos, check-ins, events, ratings, notes — searchable history |
| **Improve** | Technique stats by meat type, overall grade system, outlier flagging, historical charts |

### Platforms

- **iOS** — primary. App Store bundle `com.knowyourpit.app`. Supports iPhone + iPad.
- **Android** — secondary. Play Store package `com.knowyourpit.app`, versionCode 4.
- **Web (Marketing)** — `knowyourpit.com` landing page + privacy/ToS/support/contact.

---

## 2. Monorepo Structure

```
artifacts-monorepo/
├── artifacts/
│   ├── api-server/          # Express 5 API (served at /api)
│   ├── knowyourpit/         # Expo / React Native mobile app
│   ├── marketing/           # React + Vite marketing website
│   └── mockup-sandbox/      # Design exploration / component previews
├── lib/
│   ├── api-spec/            # OpenAPI 3 spec (source of truth for contracts)
│   ├── api-client-react/    # Generated React Query hooks (from Orval codegen)
│   ├── api-zod/             # Generated Zod schemas (from Orval codegen)
│   ├── brand-assets/        # Canonical app icons, logos, wordmarks (symlinked everywhere)
│   ├── checkin-schedule/    # Shared check-in interval calculation logic
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── integrations-openai-ai-react/   # OpenAI AI Integrations client helpers
│   └── integrations-openai-ai-server/  # OpenAI AI Integrations server helpers
├── scripts/                 # Admin & ops scripts (grant-pro, db-backup, etc.)
├── plugins/                 # Expo Config Plugins (Android packaging, pod signing)
├── pnpm-workspace.yaml      # Catalog pins and workspace config
├── tsconfig.json            # Root TS solution (composite libs only)
└── tsconfig.base.json       # Shared strict TS defaults
```

### Package manager

- **pnpm 10.26.1** (enforced via `preinstall` guard — npm/yarn rejected)
- Workspace packages use `@workspace/` prefix
- Catalog entries in `pnpm-workspace.yaml` pin shared deps (React, Zod, TanStack Query, Vite, etc.)

### TypeScript strategy

- `lib/*` packages are **composite** — emit declarations via `tsc --build`
- `artifacts/*` and `scripts` are **leaf** packages — checked with `tsc --noEmit`
- Root `tsconfig.json` is a solution file for libs only
- Full check: `pnpm run typecheck` (builds libs, then checks all leaf packages)

### Code generation

API contracts are defined in `lib/api-spec/openapi.yaml` and generated into React Query hooks + Zod schemas via Orval:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Generated output locations:
- `lib/api-client-react/src/generated/` — React Query hooks
- `lib/api-zod/src/generated/` — Zod validation schemas

---

## 3. Mobile App (knowyourpit)

### App configuration (`app.config.js`)

| Setting | Value |
|---|---|
| Name | knowyourpit |
| Slug | knowyourpit |
| Version | 1.0.17 |
| Build number (iOS) | 127 |
| Version code (Android) | 4 |
| iOS Bundle ID | `com.knowyourpit.app` |
| Android Package | `com.knowyourpit.app` |
| Apple Team ID | W8AY23XJTF |
| Scheme | `knowyourpit` |
| UI Style | dark (forced, always) |
| New Architecture | enabled |
| Expo SDK | 54.0.0 |
| React Native | 0.81.5 |

### iOS permissions declared

| Permission | Reason |
|---|---|
| `NSLocationWhenInUse` | Outdoor temp during live cook sessions |
| `NSPhotoLibrary` | Attach photos to cooks; AI temp scan from image |
| `NSCamera` | Cook photos; AI temp scan |
| `NSUserNotification` | Probe target alerts; fuel reminders |
| `NSBluetoothAlways` | BLE read from Inkbird thermometer |
| `NSLocalNetwork` | WiFi thermometer mDNS discovery (MEATER Block, ThermoWorks, Fireboard) |
| Bonjour services | `_http._tcp`, `_meater._tcp` |
| `NSAppTransportSecurity` | Local networking allowed |
| `ITSAppUsesNonExemptEncryption` | false |

### Android permissions declared

- `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` — WiFi thermometer discovery
- `CAMERA`, `READ_MEDIA_IMAGES` — Cook photos + AI scan
- `BLUETOOTH`, `BLUETOOTH_ADMIN`, `BLUETOOTH_CONNECT`, `BLUETOOTH_SCAN` — Inkbird BLE

### Screen structure (Expo Router)

```
app/
├── (auth)/
│   ├── sign-in.tsx           # Email+password primary; Google SSO; Apple Sign-In (iOS only)
│   ├── sign-up.tsx           # Registration
│   └── set-username.tsx      # Post-signup username setup
├── (onboarding)/
│   └── index.tsx             # Onboarding flow (two pages)
├── (tabs)/
│   ├── _layout.tsx           # Tab navigator
│   ├── index.tsx             # Home / Dashboard tab
│   ├── cooks.tsx             # Cook history list
│   ├── plan.tsx              # Planning tab (live cook banner + sequencer)
│   ├── ai.tsx                # PitMaster AI chat tab
│   └── more.tsx              # Settings, devices, profile, etc.
├── cooks/
│   ├── [id].tsx              # Cook detail screen
│   └── log.tsx               # Log a new cook
├── grills/
│   ├── [id].tsx              # Grill detail screen
│   └── grills.tsx            # Grill list
├── sessions/
│   └── [sessionId].tsx       # Multi-cook session schedule view
├── devices.tsx               # Device management (MEATER, ThermoWorks, BLE)
├── pro-features.tsx          # Pro feature showcase
├── profile.tsx               # User profile
├── temperature.tsx           # Temperature scan / upload
└── ble-diagnostics.tsx       # BLE debug screen
```

### Key component library

| Component | Purpose |
|---|---|
| `AppHeader` | Unified header with back button + title |
| `AppKeyboardAvoidingView` | Cross-platform keyboard-safe wrapper (required in all modals with TextInput) |
| `BlurredProSection` | Blurred paywall overlay for locked features |
| `ConnectionBanner` | Offline / API error banner |
| `PaywallModal` | Full-screen Pro upgrade prompt |
| `PitMasterChatModal` | AI chat bottom sheet |
| `TempGraph` | Temperature over time chart |
| `GrillFingerprint` | Grill identity visualization |
| `NextUpBanner` | Live cook "next step" callout |
| `SignalBars` | WiFi/BLE signal quality indicator |
| `LockedFeatureCard` | Individual gated feature card |
| `SupportModal` | In-app support flow |

**cook-detail/ sub-components** (rendered on the cook detail screen):
`ActualVsPlannedRecap`, `AskPitMaster`, `BleWizardSheet`, `CheckinModal`, `CheckinPreviewSheet`, `CookActivityTimeline`, `CookAnalysisSection`, `CookHealthScoreCard`, `CookModals`, `CookProgressBar`, `CookShareCard`, `CookStatusSection`, `CookSummaryCard`, `CookTimelineSection`, `DecisionsSection`, `EditCookModal`, `EditCookTimesSheet`, `FingerprintCallout`, `FrozenTimeline`, `LiveCookSection`, `LiveProbeSection`, `PlannedCookTimeline`, `QuickLogSheet`, `RateCookSheet`, `RateThisCook`

### Key dependencies

**Runtime / dependencies:**

| Package | Purpose |
|---|---|
| `react-native-purchases 9.7.2` | RevenueCat subscription paywall |
| `react-native-ble-plx ^3.5.1` | Inkbird BLE thermometer |
| `react-native-zeroconf ^0.14.0` | mDNS discovery for WiFi probes |
| `expo-apple-authentication ~7.2.4` | Apple Sign-In |
| `expo-notifications ~0.32.16` | Push + local notifications |
| `expo-location ~19.0.8` | Outdoor temp via location |
| `expo-image-picker ~17.0.9` | Cook photos |
| `expo-secure-store ~15.0.8` | Auth token secure storage |
| `live-activity` | iOS Live Activities (local module) |
| `@tanstack/react-query-persist-client` | Offline query persistence |

**Dev / build:**

| Package | Purpose |
|---|---|
| `@clerk/expo ^3.1.12` | Authentication |
| `expo-router ~6.0.17` | File-based navigation |
| `react-native-reanimated ~4.1.1` | Animations |
| `react-native-gesture-handler ~2.28.0` | Gestures |
| `react-native-keyboard-controller 1.18.5` | Keyboard handling |
| `@workspace/api-client-react` | Generated API hooks |
| `@workspace/checkin-schedule` | Checkin interval logic |
| `eas-cli 18.11.0` | Build + submit |

---

## 4. API Server

**Framework:** Express 5  
**Mount path:** `/api`  
**Build:** esbuild → CJS bundle  
**Auth middleware:** Clerk JWT via `requireAuth`

### Route overview

| Route group | Endpoints |
|---|---|
| **Health** | `GET /health` |
| **Grills** | `GET /grills`, `POST /grills`, `GET /grills/:id`, `PATCH /grills/:id`, `DELETE /grills/:id`, `GET /grills/:id/stats`, `GET /grills/:id/insights`, `GET /grills/:id/fingerprint`, `GET /grills/:id/temperature-history` |
| **Cooks** | `GET /cooks/technique-stats`, `GET /cooks`, `POST /cooks`, `GET /cooks/:id`, `PATCH /cooks/:id`, `POST /cooks/:id/add-items`, `POST /cooks/:id/outlier-dismiss`, `DELETE /cooks/:id` |
| **Sessions** | `GET /sessions/:sessionId`, `PATCH /sessions/:sessionId`, `DELETE /sessions/:sessionId` |
| **Temperature** | `POST /temperature/upload`, `POST /temperature/scan` (AI image scan), `POST /temperature/analyze`, `GET /temperature/manual`, `POST /temperature/manual` |
| **AI** | `POST /ai/chat`, `POST /ai/predict`, `POST /ai/multi-cook`, `GET /ai/insights`, `GET /ai/knowledge`, `GET /ai/meat-baselines` |
| **Dashboard** | `GET /dashboard/recent-cooks`, `GET /dashboard/summary` |
| **Profile** | `GET /profile/me`, `PATCH /profile/me`, `DELETE /profile/me` (account deletion — full data wipe + Clerk delete) |
| **Conversations** | `GET /conversations`, `POST /conversations`, `GET /conversations/:id`, `DELETE /conversations/:id`, `GET /conversations/:id/messages`, `POST /conversations/:id/messages` |
| **MEATER** | `GET /meater/link`, `POST /meater/link`, `DELETE /meater/unlink`, `GET /meater/readings` |
| **ThermoWorks** | `GET /thermoworks/link`, `POST /thermoworks/link`, `DELETE /thermoworks/unlink`, `GET /thermoworks/readings`, `POST /thermoworks/send-reset` |
| **Contact** | `POST /contact` (rate-limited, no auth required) |
| **Paywall** | `GET /paywall/status` |
| **Webhooks** | `POST /webhooks/revenuecat` (RevenueCat subscription events) |
| **Custom Meat Cuts** | `GET /custom-meat-cuts`, `POST /custom-meat-cuts`, `PATCH /custom-meat-cuts/:id`, `DELETE /custom-meat-cuts/:id` |
| **Admin** | Admin-only endpoints (ADMIN_API_TOKEN required) |
| **Live Activities** | iOS Live Activity push token management |
| **Cook Checkins** | `GET /cooks/:id/checkins`, `POST /cooks/:id/checkins`, `PATCH /cooks/:id/checkins/:checkinId` |
| **Cook Events** | `GET /cooks/:id/events`, `POST /cooks/:id/events` |
| **Technique Presets** | `GET /technique-presets`, `GET /technique-presets/:cutName` |
| **User Technique Presets** | `GET /user-technique-presets`, `POST /user-technique-presets`, `PATCH /user-technique-presets/:id`, `DELETE /user-technique-presets/:id` |

### Key middleware

- **`requireAuth`** — Clerk JWT validation. Attaches `userId` to request.
- **`clerkProxyMiddleware`** — Forwards Clerk API calls through the server for RN compatibility.
- **`express-rate-limit`** — Applied to `/contact` endpoint.
- **Logging** — `req.log` in route handlers; singleton `logger` (pino) elsewhere. Never `console.log`.

### Dashboard: multi-probe meat/pit resolution

`/dashboard/recent-cooks` resolves live probe temps by:
- **Meat probe:** any reading where `probeNumber != 1` (not the pit) — picks up any non-pit probe
- **Pit probe:** strict `probeNumber = 1` match

This ensures secondary meat probes and CSV-imported readings are not silently ignored.

---

## 5. Database Schema

**ORM:** Drizzle ORM  
**Database:** PostgreSQL  
**Validation:** drizzle-zod (auto-generates Zod insert schemas from table definitions)

### Tables

#### `cooks`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `userId` | text | Clerk user ID |
| `grillId` | integer | FK → grills |
| `foodType` | text | e.g. "brisket", "pork shoulder" |
| `weightLbs` | real | |
| `targetTempF` | real | Doneness target |
| `cookTempF` | real | Pit temperature |
| `status` | text | `planned`, `active`, `completed` |
| `plannedStartAt` / `actualStartAt` | timestamp tz | |
| `plannedEndAt` / `actualEndAt` | timestamp tz | |
| `preheatMinutes` | integer | |
| `wrapAtMinutes` | integer | |
| `wrapMethod` | text | `butcher_paper`, `foil`, `none` |
| `wrapTempF` | integer | Temp trigger for wrap |
| `wrapReason` | text | |
| `restMinutes` | integer | |
| `ratingTenderness` / `ratingBark` / `ratingFlavor` / `rating` | integer | 1–5 |
| `sessionId` | text | Multi-cook session grouping |
| `sessionLabel` | text | |
| `sessionNotes` | text | |
| `sequenceData` | jsonb | AI-generated timeline steps |
| `confirmedSteps` | jsonb | Map of step key → confirmed timestamp |
| `analysisResult` | jsonb | Latest AI coaching result |
| `analysisHistory` | jsonb | Array of prior analyses |
| `fromFrozen` | boolean | Was meat frozen at planning time? |
| `thawMethod` | text | `refrigerator`, `cold_water`, `microwave`, `counter`, `cook_from_frozen` |
| `actualThawStartAt` | timestamp tz | |
| `cookingMethod` | text | |
| `injection` | text | |
| `spritzFrequency` | text | |
| `wrapFinish` | text | |
| `finishTimeRangeLower` / `Upper` | timestamp tz | AI-predicted window |
| `healthScore` | text | A–F grade |
| `healthScoreReason` | text | |
| `probeAssignments` | jsonb | `{ meatProbes: [{id, label}], pitProbeId, labels }` |
| `sizingLabel` | text | e.g. "competition-size", "backyard" |
| `isOutlier` / `outlierDismissed` | boolean | Outlier flagging |
| `createdAt` / `updatedAt` | timestamp tz | |

**Indexes:** `cooks_user_id_idx`, `cooks_grill_id_idx`, `cooks_user_status_idx`, unique `cooks_session_dedup_idx` (userId + sessionId + plannedStartAt, only when both non-null)

---

#### `grills`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `userId` | text | |
| `name` | text | |
| `type` | text | e.g. `offset`, `pellet`, `kamado` |
| `fuelType` | text | |
| `brand` / `model` | text | |
| `cookingSurfaceSqIn` | real | |
| `minTempF` / `maxTempF` | real | |
| `numProbes` | integer | |
| `heatZones` | integer | |
| `wifiEnabled` | boolean | |
| `hopperSizeLbs` | real | Pellet hopper |
| `tempRange` | text | |
| `features` | text[] | Array of feature strings |
| `notes` | text | |
| `imageUrl` | text | |
| `totalCooks` | integer | Running counter |
| `createdAt` / `updatedAt` | timestamp tz | |

---

#### `temperature_readings`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `cookId` | integer | |
| `grillId` | integer | |
| `probeNumber` | integer | **0 = meat, 1 = pit** (authoritative role convention) |
| `probeName` | text | |
| `tempF` | real | |
| `recordedAt` | timestamp tz | |
| `source` | text | `manual`, `meater`, `thermoworks`, `inkbird`, `csv`, `govee` |

**Probe role convention:** `probeNumber` is authoritative. `probeName` heuristics and `probeAssignments` IDs are not reliable for role detection.

---

#### `cook_checkins`

| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `cookId` | integer | |
| `scheduledAt` | timestamp tz | |
| `firedAt` | timestamp tz | When notification fired |
| `internalTempF` / `pitTempF` | real | Temps logged at check-in |
| `statusFlag` | enum | `all_good`, `running_behind`, `flare_up`, `low_fuel` |
| `userNote` | text | |
| `photoKey` | text | Object storage key |
| `aiGuidanceShown` | text | AI tip shown at check-in |
| `autoDismissed` | boolean | |
| `isAutomatic` | boolean | Auto-filled from probe |
| `probeSource` | text | Which probe source auto-filled |
| `phaseLabel` | text | Matched milestone label |
| `phaseKey` | text | Matched milestone key |
| `createdAt` / `updatedAt` | timestamp tz | |

**Milestone matching:** A check-in opened within ±20 minutes of a scheduled milestone is automatically matched to that milestone's `phaseKey`/`phaseLabel`. Already-logged milestones are excluded.

---

#### `cook_events`

Event types (enum): `lid_open`, `flare_up`, `spritz`, `mop`, `charcoal_add`, `wood_add`, `fuel_low`, `vent_adjust`, `user_note`, `proactive_alert`, `voice_note`, `ai_analysis`

| Column | Type |
|---|---|
| `id` | serial PK |
| `cookId` | integer |
| `occurredAt` | timestamp tz |
| `eventType` | cook_event_type enum |
| `note` | text |
| `metadata` | jsonb |
| `createdAt` | timestamp tz |

---

#### `conversations` + `messages`

| Column (conversations) | Type |
|---|---|
| `id` | serial PK |
| `userId` | text |
| `title` | text |
| `createdAt` / `updatedAt` | timestamp tz |

Messages reference conversation ID and store role + content for AI chat history.

---

#### `subscription_entitlements`

| Column | Type | Notes |
|---|---|---|
| `userId` | text PK | Clerk user ID |
| `isPro` | boolean | Active Pro status |
| `expiresAt` | timestamp tz | |
| `lastEventType` | text | Last RevenueCat webhook event type |
| `lastEventAtMs` | bigint | Millisecond timestamp — used to reject stale/out-of-order deliveries |
| `updatedAt` | timestamp tz | |

---

#### `technique_presets`

System-seeded presets per meat cut. Columns: `cutName`, `label`, `cookMethod`, `wrapFinish`, `spritzFrequency`, `injection`, `cookTempF`, `targetTempF`, `sortOrder`.

#### `user_technique_presets`

Per-user overrides of technique presets, same shape as system presets.

#### Other tables

| Table | Purpose |
|---|---|
| `meater_credentials` | Stored MEATER account credentials per user |
| `thermoworks_credentials` | Stored ThermoWorks account credentials per user |
| `contact_messages` | Contact form submissions |
| `ai_analyze_events` | Tracks per-user AI image analysis calls (for rate limiting) |
| `frozen_timeline_events` | Events in the frozen cook planning timeline |
| `live_activities` | iOS Live Activity push tokens per user/cook |
| `custom_meat_cuts` | User-defined meat cut records |

---

## 6. Paywall & Subscription

**Provider:** RevenueCat  
**Mobile SDK:** `react-native-purchases 9.7.2`  
**Server SDK:** `@replit/revenuecat-sdk` (via Replit RevenueCat connector)  
**Entitlement key:** `pro`  
**Kill switch:** `PAYWALL_ENABLED=false` bypasses all gates globally

### Pricing

- Monthly: $4.99/month
- Annual: $29.99/year

### Free tier limits

| Feature | Free limit |
|---|---|
| Total cooks | 3 cooks |
| AI chat messages | 3 / day |
| AI image analysis (temp scan) | 1 / day |
| Frozen-to-Table planning | 1 lifetime free trial |

### Pro tier limits

| Feature | Pro limit |
|---|---|
| Cooks | Unlimited |
| AI chat messages | 20 / day |
| AI image analysis | Unlimited |
| Frozen-to-Table planning | Unlimited |

### Gate response

A blocked request returns HTTP 402 with a uniform JSON body via `respondPaywall(res, ...)`.

### Webhook flow

RevenueCat POSTs subscription events to `POST /webhooks/revenuecat`. The handler:
1. Validates the `REVENUECAT_WEBHOOK_SECRET` signature
2. Extracts Clerk user ID from the event
3. Upserts `subscription_entitlements` row
4. Uses `lastEventAtMs` to reject out-of-order deliveries

### Admin grant / revoke

```bash
# From scripts/ directory
cd scripts && npx tsx ./src/grantPro.ts <email_or_clerkUserId>
cd scripts && npx tsx ./src/revokePro.ts <email_or_clerkUserId>
cd scripts && npx tsx ./src/listPro.ts
```

---

## 7. Authentication

**Provider:** Clerk  
**Mobile package:** `@clerk/expo ^3.1.12`

### Sign-in methods

| Method | Notes |
|---|---|
| Email + Password | Primary. OTP verification on sign-up. |
| Google SSO | Works in dev; requires Prod Clerk instance to enable for production. |
| Apple Sign-In | iOS only. Shown only when `AppleAuthentication.isAvailableAsync()` returns true. Uses native Apple flow + Clerk `oauth_token_apple` strategy with nonce. |

### Auth screen design

All auth screens (`sign-in`, `sign-up`, `set-username`) render with the **dark palette unconditionally** via `useAuthColors()`, regardless of system theme setting.

### Error handling

Sign-in/sign-up handlers map Clerk error codes to user-friendly messages.

### Token handling

- **Never** use `getToken({ skipCache: true })` on the critical render path — use cached token, refresh only on 401.
- `getToken` has an 8-second timeout (up from 3s — iOS Enclave settling on cold launch).
- **Never** cache a `null` result from a `getToken` timeout — iOS Enclave settling can cause transient stalls, and caching null permanently evicts a valid token for the session.
- `customFetch` includes a 30-second `AbortController` timeout on all API calls.

### Account deletion

`DELETE /profile/me` — Apple App Store compliance requirement. Steps:
1. Wipes all user data in a single DB transaction: cooks, temperature readings, conversations, messages, AI analyze events, custom meat cuts, grills, MEATER/ThermoWorks credentials, subscription entitlements, live activities.
2. Deletes the Clerk user account.
3. If Clerk delete fails, data is already gone; client is signed out with a "contact support" message. No orphan-data state is possible.

Accessible from: More tab → "Delete account"

---

## 8. Temperature Probe Integrations

### Inkbird (BLE)

- Package: `react-native-ble-plx ^3.5.1`
- Requires: `NSBluetoothAlways` (iOS), Bluetooth permissions (Android)
- Discovery: BLE scan with device name/service UUID filtering
- Debug screen: `app/ble-diagnostics.tsx`

### MEATER

- Integration: Account-link via `/api/meater/link` (stores credentials in `meater_credentials`)
- Discovery: mDNS (`_meater._tcp`) + WiFi LAN scan via `react-native-zeroconf`
- Local network: `NSLocalNetworkUsageDescription` + `NSBonjourServices` declared

### ThermoWorks Signals / RFX

- Integration: Cloud (account-link via `/api/thermoworks/link` → `/devices`)
- Community `/status` adapter: 3-second timeout, 5 hostname aliases
- LAN discovery: mDNS dual browser (`_http._tcp` + `_meater._tcp`), 8-second scan window, 24-hour TTL persistence
- mDNS empty scan ≠ definitive permission denial on iOS (use `mdnsScanEmpty` proxy)

### Fireboard

- Discovery: mDNS on same WiFi (auto-discovered via `useLanProbes`)
- No account link required

### Govee / CSV

- Manual CSV import via temperature upload endpoint

### Live probe display states (LiveCookSection)

1. `linkedButEmpty` — Account linked, no active probes detected
2. `lanScanEndedEmpty` — mDNS scan completed, nothing found
3. `noLinkedAccounts` — No probe accounts connected → "Connect a device" CTA
4. `anyProbeScanning` — Scan in progress
5. `noneSelected` — Probes available but none assigned to this cook

### Probe assignment conventions

```json
{
  "meatProbes": [{ "id": "probe-key", "label": "Internal" }],
  "meatProbeId": "probe-key",  // legacy v1 — migrate on read if meatProbes absent
  "pitProbeId": "pit-probe-key",
  "labels": { "probe-key": "Display Label" }
}
```

---

## 9. AI Features

**Model:** OpenAI gpt-5.2 (via Replit AI Integrations proxy — no direct API key needed)  
**Streaming:** Disabled for React Native (RN fetch polyfill drops chunked responses). Non-streaming endpoint used.

### PitMaster Chat

- Route: `POST /ai/chat`
- Per-conversation message history
- Daily message limits enforced (free: 3/day, Pro: 20/day)
- Context includes: current cook state, grill profile, confirmed steps, weather if available
- Accessible: AI tab (full conversations), cook detail screen (quick "Ask PitMaster"), PitMasterChatModal

### Cook Time Prediction

- Route: `POST /ai/predict`
- Inputs: meat type, weight, target temp, cook temp, wrap method, frozen state, thaw method
- Output: estimated timeline with all stages (thaw, temper, preheat, cook, wrap, rest, serve)
- Factors thaw + temper time into estimates for frozen cooks

### Cook Analysis & Coaching

- Route: `POST /temperature/analyze` (fires in background via `fireBgAiRefine`)
- Per-step drift summary included in prompt (planned vs. actual time for each confirmed step)
- AI called out to mention steps ≥10 minutes early/late by name
- Steps within ≤2 minutes acknowledged as "on time"
- Results stored in `cooks.analysisResult` + `cooks.analysisHistory`

### Health Score

- Letter grade A–F
- 50/50 formula: plan accuracy + cook health
- Displayed as 72×72 hero badge on completed cook screen
- Tappable → breakdown sheet with score driver summary

### Multi-Cook Sequencer

- Route: `POST /ai/multi-cook`
- Input: array of cook items with meat type, weight, target temp, serve time
- AI generates a grouped schedule with shared-grill smarts:
  - Skips duplicate "light grill" steps for items sharing a grill
  - Per-grill AI coaching
  - Inline failure cards with per-item retry
  - Progress counter ("Saving N of M…")
- Results grouped by grill in session schedule view

### Home Insights

- Route: `GET /ai/insights`
- Dashboard-level personalized tips based on recent cook history
- Cached server-side (cache cleared on cook events)

### AI Image Temperature Scan

- Route: `POST /temperature/scan`
- Upload a photo of a probe display, another app's temperature graph, or an analog gauge; AI extracts the temperature reading and logs it
- Daily limit: 1/day free, unlimited Pro

### BBQ Knowledge Base

- Route: `GET /ai/knowledge` — general BBQ reference
- Route: `GET /ai/meat-baselines` — baseline temps/times by cut

---

## 10. Marketing Website

**Framework:** React + Vite  
**Path:** `/` (root, served at `knowyourpit.com`)  
**Package:** `@workspace/marketing`

### Pages

| Route | Content |
|---|---|
| `/` | Landing page |
| `/privacy` | Privacy Policy |
| `/terms` | Terms of Service |
| `/support` | Support page |
| `/contact` | Contact form (submits to `POST /api/contact`) |

### Dependencies

- TailwindCSS + `@tailwindcss/typography`
- Radix UI (`accordion`, `label`, `slot`, `tooltip`)
- Framer Motion (animations)
- React Hook Form + Zod (contact form)
- Wouter (routing)
- TanStack Query
- Lucide React (icons)
- `qrcode.react`, `html2canvas`

### Contact form

- Backend: `POST /api/contact`
- Rate-limited via `express-rate-limit`
- No authentication required
- Submissions stored in `contact_messages` table
- Email sent via Resend (`RESEND_API_KEY`)

---

## 11. Shared Libraries

### `lib/brand-assets`

Canonical source for all brand imagery. Other packages reference via relative symlinks.

| File | Used as |
|---|---|
| `app-icon.png` | App Store icon, marketing site favicon |
| `logo.png` | Brand logo (distinct from icon) |
| `wordmark.png` | Text wordmark |
| `icon-transparent-dark.png` / `icon-transparent-light.png` | Theme-variant icons |
| `logo-transparent-light.png` | Light-background logo |

Updating a file in `lib/brand-assets/` propagates to: marketing site (`public/`), mobile app (`assets/images/`), and promo video (`public/brand/`) via symlinks.

### `lib/checkin-schedule`

Pure function library for computing scheduled check-in intervals based on cook duration and stage. Shared between API server and mobile app.

### `lib/db`

Drizzle schema definitions + migrations. All server-side DB access goes through this package.

### `lib/api-spec`

OpenAPI 3 YAML spec — single source of truth for all API contracts. Orval reads this and generates `lib/api-client-react` and `lib/api-zod`.

### `lib/api-client-react`

Generated React Query hooks. Import via `@workspace/api-client-react`. Do not import from relative paths.

Hook usage pattern:
```typescript
useGetThing(id, { query: { enabled: !!id, queryKey: getGetThingQueryKey(id) } })
```

### `lib/api-zod`

Generated Zod schemas for request/response validation. Used server-side for input validation.

---

## 12. Environment Variables & Secrets

### Server-side secrets (set in Replit)

| Secret | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | Replit AI Integrations proxy URL |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | Replit AI Integrations API key |
| `SESSION_SECRET` | Express session signing |
| `CLERK_PUBLISHABLE_KEY` | Clerk public key (dev) |
| `CLERK_SECRET_KEY` | Clerk secret key (dev) |
| `CLERK_SECRET_KEY_PROD` | Clerk secret key (production) |
| `REVENUECAT_SECRET_KEY` | RevenueCat API secret |
| `REVENUECAT_WEBHOOK_SECRET` | Webhook signature verification |
| `RESEND_API_KEY` | Email sending for contact form |
| `ADMIN_API_TOKEN` | Admin route authentication |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Object storage (cook photos) |
| `PRIVATE_OBJECT_DIR` | Private object storage path |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public object search paths |

### Mobile (`EXPO_PUBLIC_*`)

| Secret | Purpose |
|---|---|
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat iOS public key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | RevenueCat Android public key |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (web) |

### EAS / Build secrets

| Secret | Purpose |
|---|---|
| `ASC_API_KEY_P8` | App Store Connect API key content (P-256) |
| `ASC_API_KEY_ID` | ASC API Key ID (`3WTDG9D596`) |
| `ASC_API_ISSUER_ID` | ASC Issuer ID (`2548969f-a92c-4ab7-b550-342a8afa0b37`) |
| `EXPO_TOKEN` | Expo account token for EAS builds |
| `GITHUB_PAT` | GitHub personal access token (for backup/sync) |

### Environment flags

| Variable | Effect |
|---|---|
| `PAYWALL_ENABLED=false` | Bypasses all paywall gates globally |
| `ALLOW_ORPHAN_DROP=true` | Required to run dev orphan-table cleanup (never set on prod) |
| `ALLOW_PROD_DROPS=1` | Required to run production orphan-table cleanup |
| `EAS_NO_VCS=1` | Required for EAS builds from Replit (bypasses git lock) |
| `EAS_SKIP_AUTO_FINGERPRINT=1` | Skip auto-fingerprint on EAS builds |
| `EXPO_NO_TELEMETRY=1` | Prevents EAS CLI from hanging before upload |

---

## 13. Build & Release Process

### EAS configuration

- Config: `artifacts/knowyourpit/eas.json`
- All EAS / expo commands **must** be run from `artifacts/knowyourpit/`, never workspace root
- Never auto-initiate a build — always confirm with the user first

### iOS build

```bash
cd artifacts/knowyourpit
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 EXPO_NO_TELEMETRY=1 \
  npx eas build --platform ios --profile production --no-wait
```

**Submit to TestFlight:**
```bash
bash scripts/submit-ios.sh
```

**Active ASC API Key:** ID `3WTDG9D596`, Issuer `2548969f-a92c-4ab7-b550-342a8afa0b37`  
(Rotated 2026-05-09 — old key `3J5AF7DP8R` was revoked in App Store Connect)

### Android build

```bash
cd artifacts/knowyourpit
EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 EXPO_NO_TELEMETRY=1 \
  npx eas build --platform android --profile production --no-wait
```

Manual upload to Play Console required (Google Cloud org policy blocks service-account JSON key creation).

### Known EAS build quirks

| Issue | Fix |
|---|---|
| `invalid curve name` on TestFlight submit | EAS-side fastlane/OpenSSL bug; not fixable from project. Wait and retry. |
| AGP 8 rejects old `packagingOptions` DSL | Use config plugin `plugins/with-android-packaging/index.js` |
| AppCheckCore pod install blocker | Requires `USE_FRAMEWORKS=static` in prod env + RevenueCat pin `< 5.55.3` |
| Sentry `@sentry/react-native v8` crash | Incompatible with Expo SDK 54. Do not add. Use v7.2.x if Sentry is needed. |
| EAS CLI hangs before upload | Set `EXPO_NO_TELEMETRY=1` |

### iOS static frameworks

Production builds use `USE_FRAMEWORKS=static` in EAS env → activates `use_frameworks! :linkage => :static` in Podfile. This provides native module maps, bypassing AppCheckCore's pre-install validation.

### RevenueCat pod pin

`pod 'RevenueCat', '< 5.55.3'` pinned inside the `knowyourpit` CocoaPods target. RevenueCat 5.55.3+ introduced AppCheckCore as a dependency which causes build failures. Injected via config plugin for fresh prebuilds.

### EAS cache key

Current cache key: **v35** (bump whenever native config changes to force a clean EAS cache)

---

## 14. Database Migrations & Ops

### Schema changes — development

Migrations are in `lib/db/migrations/`. Apply with:

```bash
pnpm --filter @workspace/db run push:force
```

(`drizzle-kit push --force` — creates/alters, does NOT drop removed tables)

### Post-merge automation

`scripts/post-merge.sh` runs two steps automatically after any task merge:

1. **`drop-orphans`** — queries `pg_tables`, compares against Drizzle schema, drops tables absent from schema  
   - Requires: `ALLOW_ORPHAN_DROP=true` (set inline in post-merge script, never manually on prod)
2. **`push-force`** — applies current schema to dev database

### Production orphan-table cleanup (runbook)

```bash
# Step 1 — dry-run (inspect, no changes)
DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \
  pnpm --filter @workspace/scripts run db:prod-drop-orphans

# Step 2 — live drop
DATABASE_URL=<prod-url> ALLOW_PROD_DROPS=1 \
  pnpm --filter @workspace/scripts run db:prod-drop-orphans -- --confirm
```

Script: `scripts/src/drop-orphan-tables-prod.ts`  
Both `ALLOW_PROD_DROPS=1` AND `--confirm` flag must be present to execute. Without `--confirm`, runs in dry-run mode.

### Migration history

| Migration | Description |
|---|---|
| 0001 | Competition columns on cooks |
| 0002 | Technique columns on cooks |
| 0003 | `cook_checkins` table |
| 0004 | `cook_events` table + health score columns |
| 0005 | Spritz liquid column |
| 0006 | `actual_thaw_start_at` on cooks |
| 0007 | Auto probe columns on cook_checkins |
| 0008 | Cook photos / pending delete |
| 0009 | Drop mop columns |
| 0010 | `sizing_label` on cooks |

### Admin scripts (scripts/src/)

| Script | Command | Purpose |
|---|---|---|
| `grantPro.ts` | `grant-pro` | Grant Pro entitlement to user by email or Clerk ID |
| `revokePro.ts` | `revoke-pro` | Revoke Pro from user |
| `listPro.ts` | `list-pro` | List all Pro users |
| `checkPro.ts` | `check-pro` | Check Pro status for a user |
| `inspectRevenueCat.ts` | `inspect-rc` | Inspect RevenueCat customer data |
| `db-backup.ts` | `db:backup` | Manual DB backup |
| `db-export-csv.ts` | `db:export-csv` | Export tables to CSV |
| `bulkGrantPro.ts` | `bulk-grant-pro` | Grant Pro to list of users |
| `seedTechniquePresets.ts` | `seed-technique-presets` | Seed technique preset data |
| `seedRevenueCatProducts.ts` | `seed-rc-products` | Seed RevenueCat IAP products |
| `purgeOldTemperatureReadings.ts` | `purge-old-temps` | Purge old temperature data |
| `dedup-cooks.ts` | `dedup-cooks` | Remove duplicate cook records |

---

## 15. UI Conventions & Design System

### Theme

- **Always dark.** Auth screens, main app, and all modals render in dark palette unconditionally. System light/dark mode preference is overridden.
- Background: `#0e0e10` (splash screen background color)
- Colors accessed via `useColors()` hook

### Keyboard-safe modals (REQUIRED)

Every modal or bottom sheet containing a `TextInput` **must** use `AppKeyboardAvoidingView`:

```tsx
import { AppKeyboardAvoidingView } from "@/components/AppKeyboardAvoidingView";

<Modal ...>
  <AppKeyboardAvoidingView style={{ flex: 1 }}>
    {/* TextInput content */}
  </AppKeyboardAvoidingView>
</Modal>
```

**Never** use raw `KeyboardAvoidingView` inline in new modals. The wrapper has correct cross-platform behavior (`"padding"` on iOS, `"height"` on Android).

### Paywall gating pattern

Locked features use `BlurredProSection` overlay or `LockedFeatureCard`. Upgrade flow triggered by `PaywallModal`.

### Query staleness across Expo Router tabs

`invalidateQueries()` before navigation can race a tab's focus transition. Use explicit `refetch` on focus instead of relying on invalidation.

### Token refresh

- Mutation 401 errors should retry via `customFetch` (react-query's guard only re-runs queries, not mutations)
- Per-user force-refresh is single-flight
- Idempotent creates make timeout-retry safe

---

## 16. Feature Detail: Cook Lifecycle

### Statuses

`planned` → `active` → `completed`

### Live cook screen layout

While a cook is active:
- Status badge row (dot/status/weight/rating chips) — **hidden** to reduce clutter
- "No temperatures logged yet" nudge — **hidden**
- Cook Health score card — rendered **above** the live progress bar
- Live probe section, timeline, check-in prompt all visible

Completed cooks:
- Status badge row restored
- Compact Cook Health card in analysis section

### Cook rating system

Three separate 1–5 ratings: Tenderness, Bark, Flavor  
Plus overall `rating` field (separate, overall impression)

### Outlier flagging

The system can flag a cook as an outlier (`isOutlier = true`). Users can dismiss with `POST /cooks/:id/outlier-dismiss`. Outlier status excluded from technique stats calculations when dismissed.

### Cook photos

Stored in object storage. Photo key referenced in check-in records. Managed via `DEFAULT_OBJECT_STORAGE_BUCKET_ID`.

---

## 17. Feature Detail: Session Schedule & Step Confirmation

### Steps tracked

- Light Grill
- Meat On
- Wrap (clock-mode)
- Pull Off
- Serve

### Confirmation flow

- The **next upcoming step** requires a "Mark as done?" confirmation alert before recording — prevents accidental taps
- Past-due steps confirm with a single tap
- Every confirm (any step) shows a **5-second undo toast** — tapping "Undo" reverts confirmed-steps state, rippled schedule, and any note created for that step

### Confirmed step display

Once confirmed, a step row shows:
- **Actual confirmed time** as the headline (not the originally planned time)
- Signed drift annotation: `"12 min late"`, `"8 min early"`, `"on time"`
- Color coding: green (early/on time), amber (late)

### Drift coaching

Per-step drift is included in AI cook analysis requests. The coaching prompt calls out steps running ≥10 minutes early/late by name, and acknowledges steps within ≤2 minutes as on time.

---

## 18. Feature Detail: Frozen Cook Planning

Cooks can be flagged as frozen at planning time (`fromFrozen = true`).

### Thaw methods

`refrigerator` | `cold_water` | `microwave` | `counter` | `cook_from_frozen`

### Planning flow

- AI predict route factors thaw + temper time into the full timeline estimate
- Plan tab + AI predict account for thaw + temper windows
- Notifications fire when thaw and temper windows complete
- `fromFrozen` is persisted so cook detail view always shows the original frozen state (not just the planning input)

### Free trial gate

Free users get **1 lifetime** frozen-cook plan. Further attempts require Pro upgrade.

---

## 19. Feature Detail: Check-in System

### Scheduled check-ins

Intervals computed by `lib/checkin-schedule` based on cook duration and current stage. Notifications fire at scheduled times.

### Milestone matching

A manual check-in (via FAB, "Log at Check-In" button, or next-milestone card) opened within **±20 minutes** of a scheduled milestone is automatically associated with that milestone's `phaseKey`/`phaseLabel`, even if the milestone time has already passed.

Already-logged milestones are excluded from matching — a check-in after a logged milestone gets no phase association.

### Auto-fill from probes

When `isAutomatic = true`, the check-in's `internalTempF`/`pitTempF` were filled from a connected probe. `probeSource` records which probe type provided the reading.

### Status flags

`all_good` | `running_behind` | `flare_up` | `low_fuel`

### Highlight on notification

The Check In button is highlighted when a scheduled notification arrives.

---

## 20. Feature Detail: PitMaster AI Coaching

### Chat

- Full conversation history per user
- Multiple named conversations
- Context: cook state, grill info, confirmed step drift, recent events
- Streaming: disabled (RN fetch polyfill limitation)

### Rate limits

- Free: 3 messages / day
- Pro: 20 messages / day

### Cook-specific "Ask PitMaster"

Available inline on the cook detail screen via `AskPitMaster` component. Opens `PitMasterChatModal` with cook context pre-loaded.

### Coaching on analysis

Triggered post-cook (or mid-cook on demand). Analysis stored in `cooks.analysisResult`. History accumulates in `cooks.analysisHistory`.

---

## 21. Feature Detail: Multi-Cook Sequencer

Allows planning multiple cooks that share a grill or span multiple cookers, all timed to finish together at a target serve time.

### Flow

1. User adds items to the sequencer (meat type, weight, target temp, grill)
2. `POST /ai/multi-cook` generates a grouped schedule
3. Shared-grill smarts: skips duplicate "light grill" step for same-grill items
4. Results shown as session schedule view grouped by grill
5. User confirms → all cook records created with shared `sessionId`

### Session schedule

- Accessible at `app/sessions/[sessionId].tsx`
- Shows all cooks in session with unified timeline
- Session name shown on individual cook detail screens

### Reliability features

- Parallel `Promise.allSettled` saves (independent cook records don't block each other)
- Inline failure cards with red styling and per-item retry
- Progress counter ("Saving 2 of 5…")
- Auto-clear failure badges on full retry success
- AI plan: background via `fireBgAiRefine` with `Promise.race` timeout (no blocking pre-save modal)

---

## 22. Ops Log

### 2026-07-25 — Pro grants

- `shawnnguthrie@gmail.com` → Pro (lifetime, expires 9999-01-01)
- `dh7158@gmail.com` → Pro (lifetime)
- `jakedsomers@gmail.com` → Pro (lifetime)

### 2026-07-05 — Multi-probe meat/pit temp fix on `/dashboard/recent-cooks`

Live meat-temp chip previously resolved via `probeNumber = 0` only. Changed to `probeNumber != 1` (anything not the pit probe) so any non-pit probe's latest reading is picked up. Added 3 integration tests. Full 110-test suite + workspace typecheck pass. No DB schema changes.

### 2026-07-05 — Build #132 / v1.0.17 — TestFlight submit BLOCKED

EAS build `ccf8c673` succeeded. All `eas submit` attempts fail with `invalid curve name (OpenSSL::PKey::ECError)` on EAS's macOS submit runner (EAS-side fastlane bug, not fixable from the project). User opted to wait and retry later.

### 2026-06-28 — Feature batch

Schedule step confirmation UX (confirm prompt for next step, undo toast, confirmed-time display with drift), drift coaching in AI analysis, live cook screen layout (status badge hidden, Health card above progress bar), check-in milestone matching (±20 min). No DB schema changes.

### 2026-06-15 — Android Build #2 / v1.0.17

EAS build `1cc1bec4`. Fixed: AGP 7 → AGP 8 packagingOptions DSL via config plugin `plugins/with-android-packaging/index.js`. Added `node_modules/` to `.easignore`. Manual Play Console upload required.

### 2026-06-14 — Build #131 / v1.0.17 — submitted to TestFlight

EAS build `7be57ba9`. Fix: `USE_FRAMEWORKS=static` in production EAS env to bypass AppCheckCore validation. RevenueCat pinned `< 5.55.3`.

### 2026-06-08 — Build #122 / v1.0.17

iOS SecureStore token-read timeout 3s→8s. Null tokens no longer cached after timeout. "Stay signed in" toggle on sign-in screen (defaults ON).

### 2026-06-08 — Build #121 / v1.0.17

Removed `@sentry/react-native v8` — incompatible with Expo SDK 54 / RN 0.81.5 new arch (caused SIGABRT crash on launch before any app code ran).

---

## 23. Known Issues & Pending Work

### Active blockers

| Issue | Status |
|---|---|
| TestFlight submit via `eas submit` fails with `invalid curve name` | EAS-side bug; wait and retry or use Transporter manually |
| GitHub backup not yet connected | Secrets `GITHUB_BACKUP_REPO` and `GITHUB_BACKUP_TOKEN` needed from user |

### Hardware test matrix (pending human testing)

ThermoWorks / Fireboard / MEATER Block probe detection requires physical device testing:

1. Unlinked ThermoWorks → "Connect a device" card → /devices link flow
2. Linked TW with live probes → readings appear in Live Cook
3. Linked TW with zero active probes → "linked but empty" card displayed
4. iOS Local Network permission denied → troubleshooting card + "Open Settings" shown
5. Fireboard / MEATER Block on same WiFi → mDNS auto-discover succeeds

### Apple Watch companion app

Code is present but disabled. Do not delete. Marked as starting point for future modernization.

### Production routing

Custom domain `knowyourpit.com` requires specific DNS records. Production:
- `/api/*` and `/health` → API server
- All other paths → marketing static site

---

*This document is auto-generated from codebase inspection. Update after each significant feature or build.*
