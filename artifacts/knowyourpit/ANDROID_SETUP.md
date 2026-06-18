# Android Play Store Setup Guide

This guide covers the steps needed to build and submit knowyourpit to the Google Play Store.

## What's already done (code-complete)

- **`app.json`** — Android package name (`com.knowyourpit.app`), version code, permissions, `googleServicesFile` pointer, and adaptive icon (transparent-background foreground + `#0e0e10` background colour) are all configured.
- **`eas.json`** — Android build profiles are configured for development (APK), preview (APK), and production (AAB / App Bundle). The submit profile points to `/tmp/google-play-wif-config.json` (written at submit time from the `GOOGLE_PLAY_WIF_CONFIG` Replit secret) and targets the **internal** track (required for first-time Play Store submissions before promotion to production).
- **Adaptive icon** — `assets/images/adaptive-icon.png` is a transparent-background version of the brand mark, centred within the safe zone for correct rendering across all Android launcher shapes.
- **RevenueCat** — `SubscriptionContext` already branches on `Platform.OS` and reads `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` for Android. Both iOS and Android RC keys are configured as EAS environment variables across all three environments (`development`, `preview`, `production`).
- **Custom plugins** — `with-pod-bundle-signing` and `with-live-activity` both guard their logic with `config.platform !== "ios"` so they are silently skipped during an Android prebuild.
- **Submit script** — `scripts/submit-android.sh` uses Workload Identity Federation (WIF) — no long-lived JSON key required. Run it from `artifacts/knowyourpit/` after a successful EAS build.
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

### 3. Google Play API access via Workload Identity Federation (no JSON key needed)

This project uses **Workload Identity Federation (WIF)** instead of a long-lived service account JSON key. WIF issues short-lived tokens via the EAS OIDC issuer (`https://oidc.expo.dev`) and works even when `iam.managed.disableServiceAccountApiKeyCreation` org policy is active.

#### 3a. Run the one-time GCP setup script

You need `gcloud` installed and authenticated with an account that has Owner (or the three IAM roles listed at the top of the script).

```bash
# From any machine with gcloud, NOT from Replit
GCP_PROJECT_ID=your-gcp-project-id \
EXPO_ACCOUNT_NAME=taylormadeat \
  bash artifacts/knowyourpit/scripts/setup-wif.sh
```

The script:
1. Enables the required GCP APIs (IAM, STS, IAM Credentials, Android Publisher)
2. Creates a Workload Identity Pool (`expo-wif-pool`)
3. Creates an OIDC provider pointing at `https://oidc.expo.dev` (`expo-oidc`)
4. Creates a service account (`play-submit-eas@PROJECT_ID.iam.gserviceaccount.com`)
5. Binds the EAS account identity to impersonate the service account
6. Generates a credential config JSON (written to `/tmp/google-play-wif-config.json`) and prints it

#### 3b. Grant Play Console access

In **Play Console → Setup → API access**:
1. Link the same Google Cloud project used in step 3a.
2. Find the `play-submit-eas@PROJECT_ID.iam.gserviceaccount.com` service account.
3. Grant it the **Release Manager** role.

#### 3c. Store the credential config in Replit Secrets

The credential config JSON printed at the end of step 3a contains **no private key** — it is safe metadata telling the auth library where to find WIF tokens. Store it in a Replit secret:

```
Secret name:  GOOGLE_PLAY_WIF_CONFIG
Secret value: <paste the entire JSON printed by setup-wif.sh>
```

`scripts/submit-android.sh` reads this secret and writes it to `/tmp/google-play-wif-config.json` at submit time.

> **Credential config template:** `google-play-wif-config.json.template` in the repo shows the structure with placeholder values. The real config (with your project number, pool, provider, and SA email) comes from running setup-wif.sh.

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
EXPO_NO_TELEMETRY=1 EAS_NO_VCS=1 EAS_SKIP_AUTO_FINGERPRINT=1 \
  eas build --platform android --profile production --no-wait

# Submit the latest finished build to the internal track
./scripts/submit-android.sh

# Submit a specific build by ID
./scripts/submit-android.sh <EAS_BUILD_ID>

# Build a preview APK for sideloading / internal testing
EXPO_NO_TELEMETRY=1 EAS_NO_VCS=1 \
  eas build --platform android --profile preview --no-wait
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

## How WIF authentication works (for reference)

```
EAS Submit worker
  └─ obtains OIDC token from https://oidc.expo.dev (signed JWT, sub = EAS project ID)
  └─ writes token to /tmp/expo_oidc_subject_token
  └─ Google auth library reads credential config from /tmp/google-play-wif-config.json
       └─ POSTs token to https://sts.googleapis.com/v1/token
       └─ receives short-lived federated access token
       └─ calls iamcredentials.googleapis.com to impersonate play-submit-eas SA
       └─ receives short-lived SA access token (valid 1 hour)
  └─ uses SA token to call Google Play Developer API
```

No long-lived private key is ever stored or transmitted.

---

## Environment variable reference

| Variable | Where set | Purpose |
|---|---|---|
| `EXPO_PUBLIC_API_URL` | `eas.json` `build.production.env` | API server base URL |
| `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD` | `eas.json` `build.production.env` | Production Clerk key |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` | EAS env (all environments) | RevenueCat Android SDK key |
| `GOOGLE_PLAY_WIF_CONFIG` | Replit secret | WIF credential config JSON (no private key) used by submit script |

See `ENV.md` for the full variable reference and injection paths.
