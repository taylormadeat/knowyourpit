# KnowYourPit — App Store Submission Checklist

Complete these steps in order before running `eas build`.

---

## Part 1 — Infrastructure (do first)

### Step 1: Get a stable production URL for the API server

**Current status:** The API server is live and running. Both `eas.json` and `app.json` already point to the current server URL (`6583df0b-1166-4042-a222-d49fbda4017d-00-lgd8ruzq76oq.janeway.replit.dev`). This URL works today.

**Recommended before submitting to the App Store:** Click **Publish** on the **API Server** artifact in Replit to get a stable `*.replit.app` domain that won't change. Once you have it:

1. Open `artifacts/knowyourpit/eas.json` and update `EXPO_PUBLIC_API_URL`:
   ```json
   "EXPO_PUBLIC_API_URL": "https://your-api-domain.replit.app"
   ```
2. Open `artifacts/knowyourpit/app.json` and update `privacyPolicyUrl`:
   ```json
   "privacyPolicyUrl": "https://your-api-domain.replit.app/privacy"
   ```
3. Also update the comment in `artifacts/knowyourpit/app/_layout.tsx`.

There is also an active task to configure a custom domain (e.g. `api.knowyourpit.com`) — once that's done, update both values to the custom domain and rebuild.

> **If you don't do this step yet:** The current URL still works and EAS builds will succeed. Just update the URLs before any future rebuild after the domain changes.

---

## Part 2 — Apple Developer Account

### Step 2: Enroll in the Apple Developer Program

- Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enroll. Costs $99/year.
- Note your **Apple ID** (email) and **Team ID** (10-character string starting with letters, found in Membership Details).

### Step 3: Register bundle identifiers

In the [Apple Developer Portal → Identifiers](https://developer.apple.com/account/resources/identifiers/list), register all four bundle IDs:

| Identifier | Description |
|---|---|
| `com.knowyourpit.app` | Main iOS app |
| `com.knowyourpit.app.watchkitapp` | Apple Watch app |
| `com.knowyourpit.app.watchkitextension` | Watch extension |
| `com.knowyourpit.app.watchkitapp.complication` | Watch complication widget |

For **`com.knowyourpit.app`**, enable these capabilities:
- **Push Notifications**
- **App Groups** → add group: `group.com.knowyourpit.app`

For all Watch identifiers, enable **App Groups** → `group.com.knowyourpit.app`.

### Step 4: Create an App Store Connect record

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → **My Apps** → **+** → **New App**.
2. Platform: iOS. Name: **KnowYourPit**. Bundle ID: `com.knowyourpit.app`. SKU: `knowyourpit`.
3. Note the **Apple ID for the app** (numeric, e.g. `6740123456`) — this is `ascAppId` in `eas.json`.

### Step 5: Generate an APNs key

1. In the Apple Developer Portal → **Keys**, create a new key with **Apple Push Notifications service (APNs)** enabled.
2. Download the `.p8` file — you can only download it once.
3. Note the **Key ID** and your **Team ID**.
4. In the **Clerk Dashboard** → your production instance → **Push Notifications**, upload the `.p8` file with its Key ID and Team ID. This enables Clerk to send push notifications.

---

## Part 3 — Clerk Production Instance

### Step 6: Create a Clerk production instance

1. In the [Clerk Dashboard](https://dashboard.clerk.com), create a **new application** for production (or promote your dev instance).
2. Configure the same social providers you use in development (Apple, Google, etc.).
3. Under **API Keys**, copy the **Publishable Key** — it starts with `pk_live_`.

### Step 7: Set the Clerk production key as an EAS secret

Run this command in the `artifacts/knowyourpit` directory (or pass the full path):

```bash
eas secret:create --scope project --name EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY_PROD --value pk_live_YOUR_KEY_HERE
```

EAS will inject this at build time. Do **not** put the real key directly in `eas.json` — that file is committed to source control.

---

## Part 4 — EAS Project Setup

### Step 8: Initialize the EAS project

In the `artifacts/knowyourpit` directory, run:

```bash
eas init
```

This registers the project with Expo Application Services and prints a **Project ID** (UUID format).

Open `artifacts/knowyourpit/app.json` and replace `REPLACE_WITH_YOUR_EAS_PROJECT_ID`:

```json
"extra": {
  "eas": {
    "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
  }
}
```

### Step 9: Fill in the eas.json submit section

Open `artifacts/knowyourpit/eas.json` and fill in the iOS submit values:

```json
"ios": {
  "appleId": "your@appleid.email",
  "ascAppId": "6740123456",
  "appleTeamId": "ABCDE12345"
}
```

---

## Part 5 — App Store Listing

### Step 10: Prepare screenshots

Apple requires at least one screenshot for each of these display sizes:

| Device | Required size |
|---|---|
| iPhone 6.9" (iPhone 16 Pro Max) | 1320 × 2868 px |
| iPhone 6.5" (iPhone 14 Plus / 11 Pro Max) | 1284 × 2778 px |
| iPad Pro 13" (if supporting iPad) | 2064 × 2752 px |

Use the Simulator or a physical device to capture screenshots of:
- Home / Dashboard (active cook card)
- Plan screen (cook scheduler)
- Cook detail (temperature chart + probe readings)
- Grill inventory
- PitMaster AI chat

### Step 11: Fill in App Store metadata in App Store Connect

- **Description** (up to 4,000 characters)
- **Keywords** (100 characters, comma-separated) — e.g. `bbq,smoker,grill,pitmaster,thermometer,cook,brisket,pork`
- **Support URL** — a working URL where users can get help (you can point this to `https://YOUR_API_DOMAIN/privacy` initially or a contact page)
- **Age Rating** — answer the questionnaire (KnowYourPit rates 4+)
- **Category** — Food & Drink (primary), Utilities (secondary)
- **Privacy Policy URL** — `https://YOUR_API_DOMAIN/privacy` (already live once you complete Step 1)

---

## Part 6 — Build & Submit

### Step 12: Run the production build

From the `artifacts/knowyourpit` directory:

```bash
eas build --platform ios --profile production
```

EAS will handle certificates and provisioning profiles automatically via Managed Credentials. The build takes ~20–30 minutes on the `m-medium` resource class.

### Step 13: Submit to App Store

Once the build succeeds:

```bash
eas submit --platform ios --latest
```

This uploads the build to App Store Connect. You will then need to:
1. Open App Store Connect → your app → **TestFlight** tab to verify the build processed successfully.
2. Switch to the **App Store** tab, attach the build to your submission, fill any remaining metadata, and click **Submit for Review**.

Apple's review typically takes 24–72 hours for new apps.

---

## Quick Reference — Placeholder Values to Replace

| File | Placeholder | What to put there |
|---|---|---|
| `eas.json` | `REPLACE_WITH_DEPLOYED_API_URL` | Your deployed API domain (Step 1) |
| `eas.json` | `REPLACE_WITH_YOUR_PRODUCTION_CLERK_KEY` | Set via `eas secret:create` (Step 7) |
| `eas.json` | `REPLACE_WITH_YOUR_APPLE_ID` | Your Apple ID email (Step 2) |
| `eas.json` | `REPLACE_WITH_APP_STORE_CONNECT_APP_ID` | Numeric App Store Connect App ID (Step 4) |
| `eas.json` | `REPLACE_WITH_YOUR_TEAM_ID` | Apple Team ID (Step 2) |
| `app.json` | `REPLACE_WITH_YOUR_EAS_PROJECT_ID` | UUID from `eas init` (Step 8) |
| `app.json` | `REPLACE_WITH_DEPLOYED_API_URL` | Your deployed API domain (Step 1) |
