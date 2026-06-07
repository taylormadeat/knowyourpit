# Mobile App Environment Variables

Canonical reference for every `EXPO_PUBLIC_*` variable consumed by the
`artifacts/knowyourpit` package. Keep this file in sync whenever a variable is
added, renamed, or removed — it is the single source of truth for the EAS
dashboard audit.

## How variables reach the app

| Origin | Variables set |
|--------|---------------|
| `eas.json` `build.production.env` (hardcoded) | `EXPO_PUBLIC_API_URL` |
| EAS secrets / `eas env` (must be configured manually) | `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` |
| Runtime injection by `scripts/build.js` (Replit web build) | `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REPL_ID`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`, `EXPO_PUBLIC_CLERK_PROXY_URL` |
| `package.json dev` script (Replit dev session) | `EXPO_PUBLIC_DOMAIN`, `EXPO_PUBLIC_REPL_ID`, `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` |

---

## Variables

### `EXPO_PUBLIC_API_URL`
- **Purpose**: Base URL of the deployed API server.
- **Example**: `https://api.knowyourpit.com`
- **Set in**: `eas.json` `build.production.env` (hardcoded). Also set manually
  via `eas env:create` for `preview` and `development` profiles when testing
  against a real device.
- **Used in**: `app/_layout.tsx`, `hooks/usePaywallUsage.ts`,
  `hooks/useHomeInsights.ts`, `hooks/useMeaterReadings.ts`,
  `app/(tabs)/ai.tsx`, `app/(tabs)/plan.tsx`, `app/(tabs)/more.tsx`.
- **Fallback**: If unset, the app constructs the URL from `EXPO_PUBLIC_DOMAIN`.

---

### `EXPO_PUBLIC_DOMAIN`
- **Purpose**: Replit deployment/dev domain (host only, no protocol). Used as
  a fallback API URL base when `EXPO_PUBLIC_API_URL` is not set.
- **Example**: `abc123.replit.app`
- **Set in**: Injected at runtime from `$REPLIT_DEV_DOMAIN` (dev) or
  `$REPLIT_INTERNAL_APP_DOMAIN` / `$REPLIT_DEV_DOMAIN` (build script). Never
  set in EAS; Replit-only.
- **Used in**: `app/_layout.tsx`, `hooks/usePaywallUsage.ts`,
  `hooks/useHomeInsights.ts`, `hooks/useMeaterReadings.ts`,
  `hooks/useSmokerProfile.ts`, `app/(tabs)/ai.tsx`, `app/(tabs)/plan.tsx`,
  `app/(tabs)/more.tsx`, `scripts/build.js`.

---

### `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY`
- **Purpose**: Development Clerk publishable key (`pk_test_…`). Used in
  development and Replit web builds.
- **Set in**: Injected at runtime from the `CLERK_PUBLISHABLE_KEY` Replit
  secret by `package.json dev` and `scripts/build.js`. Never stored directly
  in EAS.
- **Used in**: `app/_layout.tsx`, `scripts/build.js`.

---

### `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD`
- **Purpose**: Production Clerk publishable key (`pk_live_…`). Takes priority
  over `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` in `app/_layout.tsx`.
- **Set in**: Must be created as an EAS secret before every production build:
  ```
  eas secret:create EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD pk_live_xxxx
  ```
- **EAS environments**: `production`, `preview` (if testing against prod Clerk).
- **Used in**: `app/_layout.tsx`.

---

### `EXPO_PUBLIC_CLERK_PROXY_URL`
- **Purpose**: Full URL of the Clerk proxy (used in Replit dev to route Clerk
  requests through the Replit domain).
- **Example**: `https://abc123.replit.app/api/clerk-proxy`
- **Set in**: Injected at runtime by `scripts/build.js` from
  `process.env.CLERK_PROXY_URL`. Not set in EAS; Replit-only.
- **Used in**: `app/_layout.tsx`.

---

### `EXPO_PUBLIC_REPL_ID`
- **Purpose**: Replit REPL ID, used internally by `scripts/build.js` as a
  fallback for `process.env.REPL_ID`. Not consumed by any app screen or hook —
  only by the build script.
- **Set in**: Injected at runtime from `$REPL_ID` by `package.json dev` and
  `scripts/build.js`. Not set in EAS.
- **Used in**: `scripts/build.js`.

---

### `EXPO_PUBLIC_SENTRY_DSN`
- **Purpose**: Sentry Data Source Name (DSN) for crash and warning reporting. When
  set, auth-timeout warnings (from `getTokenSafe`) and unhandled JS errors are
  sent to the Sentry dashboard. When absent, Sentry is silently skipped — the app
  works normally, warnings are only visible in the Metro console.
- **Example**: `https://abc123@o123456.ingest.sentry.io/789`
- **Set in**: EAS secret for `production` (and optionally `preview`):
  ```
  eas secret:create EXPO_PUBLIC_SENTRY_DSN https://...@....ingest.sentry.io/...
  ```
- **EAS environments**: Recommended for `production`; optional for `preview`.
  Do NOT set for `development` unless you also set `EXPO_PUBLIC_SENTRY_DEV_ENABLED=true`.
- **Used in**: `lib/sentry.ts`, `app/_layout.tsx`, `lib/getTokenSafe.ts`.
- **PII policy**: The `beforeSend` hook in `lib/sentry.ts` redacts `Authorization`
  headers from all captured breadcrumbs. Warning messages from `getTokenSafe` and
  `customFetch` contain only timing data and URL paths — never tokens or user IDs.
  `Sentry.setUser()` is intentionally never called, so no Clerk user IDs are sent.

---

### `EXPO_PUBLIC_SENTRY_DEV_ENABLED`
- **Purpose**: Optional flag to enable Sentry event transmission in `__DEV__`
  builds (development / Metro). Without this flag, Sentry initialises in debug
  mode during development (events printed to the Metro console only, not sent).
- **Example**: `true`
- **Set in**: Not needed in EAS. Only useful for local testing of the Sentry pipeline.
- **Used in**: `lib/sentry.ts`.

---

### `EXPO_PUBLIC_REVENUECAT_IOS_KEY`
- **Purpose**: RevenueCat iOS public API key (`appl_…`).
- **Set in**: Must be configured in EAS for every environment that tests or
  ships in-app purchases:
  ```
  eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY \
    --value "appl_xxx" --environment development
  eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY \
    --value "appl_xxx" --environment preview
  eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY \
    --value "appl_xxx" --environment production
  ```
- **EAS environments**: `development`, `preview`, `production`.
- **Used in**: `contexts/SubscriptionContext.tsx`, `components/PaywallModal.tsx`.

---

### `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`
- **Purpose**: RevenueCat Android public API key (`goog_…`).
- **Set in**: Same pattern as `EXPO_PUBLIC_REVENUECAT_IOS_KEY` above, for all
  EAS environments that build for Android.
- **EAS environments**: `development`, `preview`, `production`.
- **Used in**: `contexts/SubscriptionContext.tsx`, `components/PaywallModal.tsx`.

---

## EAS environment matrix

| Variable | development | preview | production | Source |
|----------|:-----------:|:-------:|:----------:|--------|
| `EXPO_PUBLIC_API_URL` | manual `eas env` | manual `eas env` | `eas.json` hardcoded | EAS |
| `EXPO_PUBLIC_DOMAIN` | — | — | — | Runtime (Replit only) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` | — | — | — | Runtime (Replit only) |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | — | optional | `eas secret` | EAS secret |
| `EXPO_PUBLIC_CLERK_PROXY_URL` | — | — | — | Runtime (Replit only) |
| `EXPO_PUBLIC_REPL_ID` | — | — | — | Runtime (Replit only) |
| `EXPO_PUBLIC_REVENUECAT_IOS_KEY` | `eas env` ✓ | `eas env` ✓ | `eas env` ✓ | EAS |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | `eas env` ✓ | `eas env` ✓ | `eas env` ✓ | EAS |
| `EXPO_PUBLIC_SENTRY_DSN` | — | optional | `eas secret` ✓ | EAS secret |
| `EXPO_PUBLIC_SENTRY_DEV_ENABLED` | — | — | — | Local dev only |

Variables marked "—" are either not needed in that EAS environment or are
injected at runtime by the Replit build system and must NOT be set in EAS.

## GitHub Build Backup secrets

These are **server-side** Replit Secrets (not `EXPO_PUBLIC_*` variables — never
exposed to the mobile bundle). Set them in the Replit Secrets panel.

### `GITHUB_TOKEN`
- **Purpose**: GitHub Personal Access Token used by `scripts/src/githubBuildBackup.ts`
  to push git tags and create GitHub Releases after each successful EAS submission.
- **Required scope**: `repo` (classic token) **or** a fine-grained token with
  **Contents: write** permission on the target repository.
- **How to create**: GitHub → Settings → Developer settings → Personal access
  tokens → Generate new token. Select the `repo` scope (or for fine-grained:
  select the target repository and grant "Contents: read and write").
- **Set in**: Replit Secrets panel as `GITHUB_TOKEN`.
- **Used in**: `scripts/src/githubBuildBackup.ts`, `artifacts/knowyourpit/scripts/submit-ios.sh`.
- **If unset**: `submit-ios.sh` prints an informational notice and skips the
  backup step. The TestFlight submission itself is not affected.

### `GITHUB_REPO`
- **Purpose**: Target GitHub repository for build backups, in `owner/repo` format.
- **Example**: `taylormadeat/knowyourpit`
- **Set in**: Replit Secrets panel as `GITHUB_REPO`.
- **Used in**: `scripts/src/githubBuildBackup.ts`, `artifacts/knowyourpit/scripts/submit-ios.sh`.
- **If unset**: Same behavior as missing `GITHUB_TOKEN` — backup is skipped with
  an informational notice.

### Pre-flight check

Before starting a long EAS build, verify the backup is configured correctly:

```bash
pnpm --filter @workspace/scripts run build:backup:check
```

Exits 0 if `GITHUB_TOKEN` and `GITHUB_REPO` are both set. Exits 2 with a
clear remediation message if either is missing. Run this check once after
setting the secrets to confirm everything is ready.

### Manual backup trigger

To back up any past build without re-running the submit script:

```bash
# From the workspace root:
pnpm --filter @workspace/scripts run build:backup -- \
    --platform ios \
    --buildNumber 106 \
    --version 1.0.11 \
    --easBuildId abc-123-def-456

# Dry-run (prints what would happen, no API calls):
pnpm --filter @workspace/scripts run build:backup:dry-run -- \
    --platform ios \
    --buildNumber 106 \
    --version 1.0.11
```

---

## Audit notes (May 2026)

- `eas.json` `build.production.env` contains exactly one variable
  (`EXPO_PUBLIC_API_URL`). No ghost variables were found.
- All 8 `EXPO_PUBLIC_*` variables referenced in source code have a documented
  injection path above.
- No `EXPO_PUBLIC_*` variables were found that exist only as EAS dashboard
  entries without a matching code reference.

### RevenueCat EAS configuration — verified May 2026

Both `EXPO_PUBLIC_REVENUECAT_IOS_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` were
created in EAS via `eas env:create` for all three environments. Verified with
`eas env:list` on 2026-05-08:

```
Environment: development
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_NhQwCEIvuqrJYSJUqLDCoPjjwIy
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_mhkVjHxDzwRmZTeuZSVShSwaimi

Environment: preview
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_NhQwCEIvuqrJYSJUqLDCoPjjwIy
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_mhkVjHxDzwRmZTeuZSVShSwaimi

Environment: production
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=goog_NhQwCEIvuqrJYSJUqLDCoPjjwIy
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_mhkVjHxDzwRmZTeuZSVShSwaimi
```

Note: `EXPO_PUBLIC_REVENUECAT_IOS_KEY` was pre-existing in EAS with the correct value
(`appl_mhkVjHxDzwRmZTeuZSVShSwaimi`) across all three environments.
`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` was newly created for all three environments.

A physical-device build is required to fully validate RevenueCat initialization at
runtime (see `E2E_PURCHASE_TEST_GUIDE.md` TC-1). That execution is tracked as
follow-up task **#415** (Run the full in-app purchase test on a real device).
