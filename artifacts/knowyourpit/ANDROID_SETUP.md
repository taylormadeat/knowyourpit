# Android Play Store Setup Guide

This guide covers the steps needed to build and submit knowyourpit to the Google Play Store.

## What's already done (code-complete)

- **`app.json`** — Android package name (`com.knowyourpit.app`), version code, permissions, `googleServicesFile` pointer, and adaptive icon (transparent-background foreground + `#0e0e10` background colour) are all configured.
- **`eas.json`** — Android build profiles are configured for development (APK), preview (APK), and production (AAB / App Bundle). The submit profile points to `./google-play-service-account.json` and targets the **internal** track (required for first-time Play Store submissions before promotion to production).
- **Adaptive icon** — `assets/images/adaptive-icon.png` is a transparent-background version of the brand mark, centred within the safe zone for correct rendering across all Android launcher shapes.
- **RevenueCat** — `SubscriptionContext` already branches on `Platform.OS` and reads `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` for Android. Both iOS and Android RC keys are configured as EAS environment variables across all three environments (`development`, `preview`, `production`).
- **Custom plugins** — `with-pod-bundle-signing` and `with-live-activity` both guard their logic with `config.platform !== "ios"` so they are silently skipped during an Android prebuild.
- **Submit script** — `scripts/submit-android.sh` mirrors the iOS submit script; run it from `artifacts/knowyourpit/` after a successful EAS build.
- **`.gitignore`** — `google-services.json` and `google-play-service-account.json` are excluded from version control.

---

## Pre-launch checklist — required user actions

### 1. Google Play Developer account + app

1. Sign up at https://play.google.com/console ($25 one-time fee).
2. Create a new app with package name `com.knowyourpit.app`.

### 2. Firebase Cloud Messaging (FCM) — push notifications

Push notifications on Android require Firebase:

1. Go to https://console.firebase.google.com and create a project.
2. Add an Android app with package name `com.knowyourpit.app`.
3. Download `google-services.json` and place it at `artifacts/knowyourpit/google-services.json`.
4. **Never commit this file** — it is already in `.gitignore`.

> **Without FCM:** The app builds and runs normally. Local (foreground) notifications still work. Only remote/background push notifications require FCM.

**EAS CI alternative** — store the file contents as a Replit secret and write it to disk in a pre-build hook, or use `eas.json` `env` to inject the path:

```bash
eas secret:create GOOGLE_SERVICES_JSON "$(cat google-services.json)"
```

Then in a pre-build script: `echo "$GOOGLE_SERVICES_JSON" > google-services.json`

### 3. Google Play service account (for `eas submit`)

EAS needs a service account to upload builds automatically:

1. In Google Play Console → **Setup → API access**, link to a Google Cloud project.
2. Create a service account and grant it the **Release Manager** role.
3. Download the JSON key and store it as a Replit secret:

```bash
# Store the full JSON content as a Replit secret
# Secret name: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
```

The submit script (`scripts/submit-android.sh`) reads this secret and writes it to `/tmp/google-play-sa.json` at submit time — no file is ever committed.

### 4. Android IAP subscriptions in Play Console

Create the same subscription products in Play Console as exist on iOS:

| Product ID | Description |
|---|---|
| `com.knowyourpit.pro.monthly` | Pro Monthly |
| `com.knowyourpit.pro.annual` | Pro Annual |

Both must be in **Active** state before a production build can be tested for billing.

### 5. RevenueCat Android app

1. In the RevenueCat dashboard, create an Android app.
2. Copy the public SDK key (`goog_…`).
3. The key is already configured as an EAS environment variable (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`) across all three build environments. Verify with:

```bash
eas env:list  # from artifacts/knowyourpit/
```

If it's missing, add it:

```bash
eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_ANDROID_KEY \
  --value "goog_your_key_here" --environment production
```

---

## Build and submit commands

Run all commands from `artifacts/knowyourpit/`:

```bash
# Build a production AAB for Google Play
eas build --platform android --profile production

# Submit the latest finished build to the internal track
./scripts/submit-android.sh

# Submit a specific build by ID
./scripts/submit-android.sh <EAS_BUILD_ID>

# Build a preview APK for sideloading / internal testing
eas build --platform android --profile preview
```

Or using the npm scripts:

```bash
pnpm run eas:build:android        # production AAB
pnpm run eas:submit:android       # submit latest build
```

---

## First submission flow

Google Play requires a new app to go through the **internal testing** track before it can be promoted to production. The `eas.json` submit config already sets `"track": "internal"`.

1. Build a production AAB: `eas build --platform android --profile production`
2. Submit to internal track: `./scripts/submit-android.sh`
3. In Play Console, promote the release: **Internal testing → Closed testing → Production**

---

## Environment variable reference

| Variable | Where set | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `eas.json` `build.production.env` | API server base URL |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `eas.json` `build.production.env` | Production Clerk key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | EAS env (all environments) | RevenueCat Android SDK key |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | Replit secret | Play Console upload credentials (used by submit script) |

See `ENV.md` for the full variable reference and injection paths.
