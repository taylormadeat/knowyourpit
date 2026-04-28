# E2E Purchase + Restore Test Guide

> **Execution status:** This runbook is **pending physical-device execution**.
> It cannot be run inside the Replit cloud environment because `react-native-purchases`
> links against StoreKit natively and requires a signed IPA on a real iPhone with a
> sandbox Apple ID. Follow-up task **#185** tracks the mandatory execution.
> When each test case passes, record the result in the **Results Log** section below.

> **Why this requires a real device:** `react-native-purchases` (RevenueCat SDK v9) links
> directly against StoreKit and cannot run in Expo Go or a simulator with real purchase
> flows. You must use the `development-device` EAS profile below.

---

## Prerequisites

| Requirement | Notes |
|---|---|
| macOS machine with Xcode 16+ | For `eas build` and device registration |
| EAS CLI ≥ 14 | `npm install -g eas-cli` |
| Logged-in EAS account | `eas login` as `taylormadeat` |
| Physical iPhone (iOS 16+) | Must be registered in Apple Developer portal |
| Apple sandbox tester account | Create at [appstoreconnect.apple.com](https://appstoreconnect.apple.com) → Users → Sandbox Testers |
| RevenueCat sandbox products | Confirm "knowyourpit_pro_monthly" & "knowyourpit_pro_annual" exist in RC dashboard |
| App Store Connect test_store prices | Prices must be in "Ready to Submit" or "Approved" state in ASC |

---

## Step 1 — Register Your Device

```bash
cd artifacts/knowyourpit
eas device:create
```

Follow the prompts; EAS will email a link to install the provisioning profile on the device.

---

## Step 2 — Build the Dev Client for Device

```bash
eas build --profile development-device --platform ios
```

This produces a **signed IPA** (`developmentClient: true`) that includes the full
`react-native-purchases` native module. The build is submitted to EAS Build Cloud and
takes ~20–30 minutes on the `m-medium` runner.

When complete, install via:

```bash
eas build:run --latest   # opens the device picker and installs via `ios-deploy`
```

Or download the IPA from the EAS dashboard and install with **Apple Configurator 2**.

---

## Step 3 — Configure the Sandbox Tester

1. On the device, **sign out of your personal Apple ID** in Settings → App Store.
2. **Do not sign in** to a new Apple ID in Settings. The sandbox sign-in happens inside the
   app when the StoreKit purchase sheet appears.
3. Confirm you have a sandbox tester created in ASC with a valid email that can receive the
   verification code.

---

## Test Cases

### TC-1  Paywall lists live `test_store` prices

**Steps:**
1. Launch the dev client. Sign in with a Clerk account that is **not** Pro.
2. Trigger the paywall: start a cook and dismiss until the free-cook limit is hit (≥4 cooks),
   OR navigate to any Pro-gated feature (Multi-Cook Sequencer, PitMaster AI on the 4th+ query).
3. The `PaywallModal` opens.

**Expected:**
- The **Annual** card shows a real price string from RevenueCat (e.g. "$29.99 / year") — not
  a placeholder like "Loading…" or "N/A".
- The **Monthly** card shows a real price string (e.g. "$4.99 / mo").
- The "BEST VALUE" badge appears on the Annual card with a correct savings percentage.
- `isRevenueCatAvailable` is `true` (no "Subscriptions unavailable in this build" banner).

**Failure signals:**
- Both cards show spinner indefinitely → RevenueCat API key not set (`EXPO_PUBLIC_REVENUECAT_IOS_KEY`).
- Prices show but are $0.00 → Products not approved in ASC yet.
- Banner reads "Dev build: RevenueCat not configured" → You're either running in Expo Go (which can't load native modules) or `EXPO_PUBLIC_REVENUECAT_IOS_KEY` wasn't bundled into this build. Use a custom dev client per the **Why this requires a real device** note at the top of this guide, and confirm the variable shows up via `eas env:list --environment development`.

---

### TC-2  Sandbox purchase completes and unlocks Pro without restart

**Steps:**
1. From the open PaywallModal (TC-1 open), tap **Subscribe Annually** (or monthly).
2. The StoreKit sandbox payment sheet appears. Sign in with the sandbox tester Apple ID when
   prompted.
3. Confirm the purchase on the StoreKit sheet.

**Expected:**
- The modal closes automatically (no manual dismiss).
- The screen behind the modal is now unlocked (cook counter is gone, Pro badge visible in Profile tab).
- **No app restart required** — the `CustomerInfoUpdateListener` fires in real-time and
  `isPro` flips to `true` inside the same session.
- The API server is called: check API server logs for `POST /paywall/refresh` returning `200`.

**Failure signals:**
- StoreKit sheet never appears → Device not registered with the sandbox tester's Apple ID;
  check that the sandbox Apple ID is the same region as the storefront.
- Modal closes but UI still shows locked → `CustomerInfoUpdateListener` not wired; check
  `SubscriptionContext.tsx` lines 188–195.

---

### TC-3  Pro-gated API endpoints return 200 after purchase

**Steps:**
1. Immediately after TC-2 (still logged in, same session).
2. Navigate to the **Multi-Cook Sequencer** or **PitMaster AI** (both are Pro-gated).
3. Use the feature; it should make an API call.

**Expected:**
- API server returns `200` (or appropriate success code) on any route decorated with
  `requirePro` / `checkPaywall` middleware.
- Specifically verify that `POST /ai/chat` and `GET /cooks` (when over free limit) return
  `200`, not `402`.

**How to verify API responses:**
```bash
# Tail the API server logs in a separate terminal while testing on device:
# (Connect device to same Wi-Fi, API URL is EXPO_PUBLIC_API_URL in the dev build)
# Check API server console for incoming requests.
```

---

### TC-4  Restore Purchases re-grants access on a fresh install

**Steps:**
1. Delete the app from the device (long-press → Remove App).
2. Re-install using `eas build:run --latest` (same IPA, no rebuild needed).
3. Launch the app. Sign in with the **same Clerk account** used in TC-2.
4. Trigger the paywall again (feature is locked on fresh install).
5. Tap **Restore purchases** at the bottom of the PaywallModal.

**Expected:**
- A StoreKit restore sheet (or silent background restore) runs.
- `restorePurchases()` finds the active `pro` entitlement.
- The modal closes and Pro features unlock **without purchasing again**.
- API server logs show `POST /paywall/refresh` called with a `200` response.

**Failure signals:**
- Restore returns "No active purchases" → The sandbox purchase from TC-2 expired (sandbox
  subscriptions expire in minutes). Re-run TC-2 immediately before TC-4.
- Restore succeeds in RevenueCat (RC dashboard shows entitlement) but API still returns 402
  → `/paywall/refresh` call in `refreshServerCache()` failed silently; check network reachability.

---

## Environment Variables Required in the Dev Build

These must be set before running `eas build`:

```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=appl_xxxxxxxxxxxx   # from RC dashboard → Apps → iOS → API Key
EXPO_PUBLIC_API_URL=https://pitking.replit.app      # or your custom domain if task "Switch API URL" is done
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxxx      # production Clerk key
```

Set them with:
```bash
eas env:create --scope project --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value "appl_xxx" --environment preview
```

Or set as EAS secret if sensitive.

---

## Sandbox Subscription Timing

Apple sandbox subscriptions renew at accelerated rates:
| Real duration | Sandbox duration |
|---|---|
| 1 month | ~5 minutes |
| 1 year | ~1 hour |

Run TC-4 within 5 minutes of TC-2 to ensure the sandbox subscription is still active.

---

## RevenueCat Dashboard Verification

After TC-2 and TC-4 succeed, confirm in the [RevenueCat Dashboard](https://app.revenuecat.com):

1. **Customers** → search by the Clerk `userId` used during testing.
2. Verify the `pro` entitlement shows as **Active**.
3. Verify a **Sandbox** transaction appears in the purchase history.
4. After TC-4 restore, verify no duplicate transaction was created (restore re-uses existing).

---

## Results Log

Fill this in when each test case is executed on physical hardware.

| Test Case | Date | Build ID | Tester Apple ID | Result | Notes |
|---|---|---|---|---|---|
| TC-1 — Paywall shows live prices | — | — | — | PENDING | |
| TC-2 — Purchase unlocks Pro without restart | — | — | — | PENDING | |
| TC-3 — API returns 200 on Pro routes | — | — | — | PENDING | |
| TC-4 — Restore re-grants access on fresh install | — | — | — | PENDING | |
