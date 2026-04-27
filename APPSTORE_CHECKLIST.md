# KnowYourPit — App Store Submission Checklist

Complete these steps in order before running `eas build`.

---

## Part 1 — Infrastructure (do first)

### Step 1: Get a stable production URL for the API server

**Current status: ✅ Done.** The API server is deployed and both config files point to the stable production URL `https://pitking.replit.app`.

- `eas.json` → `EXPO_PUBLIC_API_URL: "https://pitking.replit.app"`
- `app.json` → `privacyPolicyUrl: "https://pitking.replit.app/privacy"`

If you connect a custom domain (e.g. `knowyourpit.com`), update both values to the custom domain and rebuild. You can verify the live endpoints at:
- `https://pitking.replit.app/health` → `{"status":"ok"}`
- `https://pitking.replit.app/privacy` → Privacy Policy page
- `https://pitking.replit.app/support` → Support page

---

## Part 2 — Apple Developer Account

### Step 2: Enroll in the Apple Developer Program

- Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enroll. Costs $99/year.
- Note your **Apple ID** (email) and **Team ID** (10-character string starting with letters, found in Membership Details).

### Step 3: Register bundle identifiers

In the [Apple Developer Portal → Identifiers](https://developer.apple.com/account/resources/identifiers/list), register all four bundle IDs:

| Identifier | Description | App ID registered | App Store profile created |
|---|---|---|---|
| `com.knowyourpit.app` | Main iOS app | ☐ | ☐ |
| `com.knowyourpit.app.watchkitapp` | Apple Watch app | ☐ | ☐ |
| `com.knowyourpit.app.watchkitextension` | Watch extension | ☐ | ☐ |
| `com.knowyourpit.complications` | Watch complication widget | ☐ | ☐ |

**Apple Team ID:** `W8AY23XJTF`

These identifiers are the exact values used in `artifacts/knowyourpit/plugins/with-watch-app/index.ts` (`COMPANION_BUNDLE_ID`, `WATCH_APP_BUNDLE_ID`, `WATCH_EXT_BUNDLE_ID`, `COMPLICATION_BUNDLE_ID`). They must match the portal exactly or provisioning will fail.

For **`com.knowyourpit.app`**, enable these capabilities:
- **Push Notifications**
- **App Groups** → add group: `group.com.knowyourpit.app`

For all Watch identifiers, enable **App Groups** → `group.com.knowyourpit.app`.

**EAS managed signing:** `artifacts/knowyourpit/eas.json` production profile already has `"credentialsSource": "remote"`. Once the App IDs and profiles exist in the portal, EAS will download and use them automatically — no manual certificate export needed.

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

## Part 4b — In-App Purchases (RevenueCat)

### Step 9b: Finish connecting RevenueCat to the stores

RevenueCat has been seeded with the production IAP product identifiers and they are linked to the `pro` entitlement and `default` offering. Two steps remain before subscriptions will process real payments:

**App Store Connect — create subscriptions:**
1. Go to [App Store Connect](https://appstoreconnect.apple.com) → your app → **Monetization → In-App Purchases**.
2. Create an **Auto-Renewable Subscription Group** (e.g. "Pro").
3. Add these two subscriptions inside the group:

   | Product ID | Price | Notes |
   |---|---|---|
   | `com.knowyourpit.pro.monthly` | $4.99 / month | — |
   | `com.knowyourpit.pro.annual` | $29.99 / year | Add a **7-day free trial** as an Introductory Offer |

4. Submit both products for review (they'll be approved alongside the app).

**Connect the Apple Shared Secret to RevenueCat (App ID: `app68ddd2c135`):**
1. In App Store Connect, go to **Apps → KnowYourPit → Monetization → In-App Purchases**.
2. Click **App-Specific Shared Secret** (top-right of the page).
3. Click **Generate** (or copy the existing secret if one already exists).
4. In the [RevenueCat Dashboard](https://app.revenuecat.com) → **knowyourpit project → Apps → knowyourpit iOS**.
5. Scroll to the **App Store Connect** section → paste the Shared Secret → click **Save**.

**Google Play Console — create subscriptions:**
1. Go to [Play Console](https://play.google.com/console) → your app → **Monetization → Subscriptions**.
2. Create two subscriptions:

   | Subscription ID | Base plan ID | Price | Trial |
   |---|---|---|---|
   | `com.knowyourpit.pro.monthly` | `monthly` | $4.99 / month | — |
   | `com.knowyourpit.pro.annual` | `annual` | $29.99 / year | 7-day free trial offer |

**Connect Google Play service account to RevenueCat (App ID: `app77c70323cc`):**
1. In [Google Play Console](https://play.google.com/console) → **Setup → API access** → link (or create) a Google Cloud project.
2. Click **Create new service account** → follow the Google Cloud link → create a service account, download the **JSON key** file (you can only download it once).
3. Back in Play Console → **Users & permissions** → **Invite new users** → paste the service account email → grant **Financial data viewer** + **Order management** permissions.
4. In the [RevenueCat Dashboard](https://app.revenuecat.com) → **knowyourpit project → Apps → knowyourpit Android**.
5. Scroll to **Service Credentials** → paste the entire contents of the JSON key file → click **Save**.
6. Full RevenueCat guide: https://www.revenuecat.com/docs/google-server-notifications

**Verify the connections:**
Run the verification script to confirm the iOS Shared Secret is accepted and see the next-step guide for Android:

```bash
pnpm --filter @workspace/scripts exec tsx src/verifyStoreCredentials.ts
```

A successful iOS result prints `✓ Apple Shared Secret is connected`. Android credential validation must be confirmed visually in the RevenueCat dashboard (green checkmark in **Apps → knowyourpit Android → Service Credentials**).

**RevenueCat env vars (already saved):**
```
REVENUECAT_PROJECT_ID               = proj9fae344f
REVENUECAT_TEST_STORE_APP_ID        = app05509e1658
REVENUECAT_APPLE_APP_STORE_APP_ID   = app68ddd2c135
REVENUECAT_GOOGLE_PLAY_STORE_APP_ID = app77c70323cc
```

> **Apple Small Business Program:** Before you launch, enroll at https://developer.apple.com/app-store/small-business-program/enroll/ — this reduces Apple's commission from 30% to 15%.

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

### Step 10b: Upload the App Preview video and set the poster frame

Apple allows one App Preview video per device size on the App Store listing.
The source video is: `attached_assets/1777252641952_1777253037665.mov` (the same content lives at `artifacts/marketing/public/app-demo.mp4`).

**Upload steps in App Store Connect:**
1. Go to **App Store Connect → your app → App Store → iPhone 6.9"** (or the relevant device size).
2. Under **App Previews and Screenshots**, click **+** and choose **Choose File** to upload the `.mov`.
3. After processing completes, click **Choose Poster Frame**.
4. Drag the scrubber to approximately **0:05** (5 seconds into the video).
   - This frame shows the **Cook Analysis screen** for an Oxtail cook:
     210 °F target hit · 225 °F pit temp · 84% plan accuracy · PitMaster AI insight card · temperature graph.
   - This is the most data-rich, compelling frame — it communicates the app's core value in a single glance.
5. Click **Set Poster Frame** to confirm.

> The still frame extracted at this timestamp is saved at  
> `artifacts/marketing/public/app-demo-poster.jpg`  
> for reference. It is also used as the `poster` attribute on the demo `<video>` element in the marketing website (`artifacts/marketing/src/pages/home.tsx`), so the website and the App Store listing show the same thumbnail.

### Step 11: Fill in App Store metadata in App Store Connect

- **Description** (up to 4,000 characters)
- **Keywords** (100 characters, comma-separated) — e.g. `bbq,smoker,grill,pitmaster,thermometer,cook,brisket,pork`
- **Support URL** — `https://YOUR_API_DOMAIN/support` (live once you complete Step 1 — includes a contact email and FAQ)
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
