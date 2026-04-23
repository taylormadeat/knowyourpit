# Android Play Store Setup Guide

This guide covers the steps needed before you can build and submit KnowYourPit to the Google Play Store.

## What's already done

- `app.json` — Android package name (`com.knowyourpit.app`), version code, adaptive icon, and permissions are all configured.
- `eas.json` — Android build profiles are configured for development (APK), preview (APK), and production (AAB/App Bundle).

## What you need to do before building

### 1. Google Play Developer Account

Sign up at https://play.google.com/console ($25 one-time fee). Create a new app with the package name `com.knowyourpit.app`.

### 2. Google Play Service Account (for `eas submit`)

To allow EAS to upload builds automatically:
1. In Google Play Console, go to **Setup → API access**
2. Link to a Google Cloud project and create a service account with the **Release Manager** role
3. Download the JSON key file for that service account
4. In `eas.json`, replace `REPLACE_WITH_PATH_TO_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` with the path to your JSON key file (e.g. `./google-play-service-account.json`)
5. **Never commit this file** — add `google-play-service-account.json` to `.gitignore`

### 3. Firebase Cloud Messaging (FCM) — for push notifications

KnowYourPit uses `expo-notifications` for temperature alerts. On Android, push notifications require Firebase:

1. Go to https://console.firebase.google.com and create a project (or use an existing one)
2. Add an Android app with package name `com.knowyourpit.app`
3. Download `google-services.json` and place it at `artifacts/knowyourpit/google-services.json`
4. Add this line to the `android` block in `app.json`:
   ```json
   "googleServicesFile": "./google-services.json"
   ```
5. **Never commit this file** — add `google-services.json` to `.gitignore`

> **Without FCM**: The app will build and run normally on Android. Local notifications (in-app alerts when the app is open) still work. Only remote/background push notifications require FCM.

### 4. Set your production environment variables

Before running `eas build --platform android --profile production`, update `eas.json` with your actual values:

```json
"env": {
  "EXPO_PUBLIC_API_URL": "https://your-deployed-api-server.replit.app",
  "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD": "pk_live_your_production_clerk_key"
}
```

Or set them as EAS secrets (recommended — keeps keys out of `eas.json`):
```bash
eas secret:create EXPO_PUBLIC_API_URL https://your-api.replit.app
eas secret:create EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD pk_live_xxxx
```

## Build and submit commands

```bash
# Build a production AAB for Google Play
eas build --platform android --profile production

# Submit to Google Play (after build completes)
eas submit --platform android --profile production

# Build a preview APK for internal testing
eas build --platform android --profile preview
```

## Adaptive icon note

The current `adaptiveIcon.foregroundImage` points to `icon.png` (1024×1024, dark background).
For the best appearance on Android (especially on launchers that apply masks), consider creating
a version of the icon with a **transparent background** and the flame/brand mark centred within
the inner 66% "safe zone". Name it `adaptive-icon.png` and update `app.json` to point to it.
