# App Store Reviewer Notes — knowyourpit v1.0.2

> **How to use this file:** Copy everything from "NOTES FOR APP REVIEW" below and paste it into the
> "Notes" field in App Store Connect before submitting. Fill in the two `[FILL IN]` placeholders
> with your demo account credentials first.
>
> The demo account should be a real Clerk email account with an **active Pro subscription**
> (set up via RevenueCat sandbox or by manually granting entitlements in RevenueCat dashboard).

---

## NOTES FOR APP REVIEW

### App Overview

knowyourpit is a BBQ planning and cook-management app. Users log cook sessions, get AI coaching
from "PitMaster" (the in-app assistant), plan cook schedules by meat type, and track temperature
data from wireless probes. A free tier exists; a Pro subscription unlocks unlimited cooks,
unlimited AI chat, multi-cook sequencing, and analytics.

---

### Demo Account (pre-created, Pro subscription active)

Email:    [FILL IN — e.g. review@knowyourpit.com]
Password: [FILL IN]

This account already has a Pro subscription active so all features are accessible without
completing an in-app purchase.

---

### 1. Sign In with Apple

1. Launch the app. The Sign In screen appears automatically.
2. Tap "Continue with Apple" (black button near the bottom of the screen).
3. Use any Apple ID to authenticate. The app creates or signs in to the account and lands on
   the Home tab.

Note: "Continue with Apple" also appears on the Sign Up screen (reachable via "Sign up" link
at the bottom of the Sign In screen).

---

### 2. Terms of Service and Privacy Policy (on authentication screens)

Both the Sign In and Sign Up screens display a legal notice at the bottom of the form:

  Sign In screen:
  "By continuing, you agree to our Terms of Service and Privacy Policy."

  Sign Up screen:
  "By creating an account, you agree to our Terms of Service and Privacy Policy."

Both "Terms of Service" and "Privacy Policy" are underlined tappable links that open
https://knowyourpit.com/terms and https://knowyourpit.com/privacy respectively in the
system browser.

---

### 3. Paywall — Manage Subscription Deep Link

1. Sign in using the demo credentials above (Pro is already active) OR sign in with a free
   account and tap the "Upgrade to Pro" card at the top of the More tab.
2. The paywall sheet slides up from the bottom.
3. Scroll to the very bottom of the sheet. You will see:
   "Manage subscription in App Store"
4. Tap it. It opens the App Store subscription management page directly
   (itms-apps://apps.apple.com/account/subscriptions).

The link text and destination are visible without purchasing.

---

### 4. Account Deletion (in-app)

1. Sign in to any account.
2. Tap the "More" tab (last tab in the bottom navigation bar).
3. Scroll to the very bottom of the More screen.
4. Tap "Delete Account" (small underlined text below the "Sign Out" button).
5. A confirmation alert appears:
   "Delete account? — This will permanently delete your account and all your data…"
6. Tap "Continue" (destructive), then tap "Delete Forever" on the second confirmation.
7. The app deletes all server-side data, signs the user out, and returns to the Sign In screen.

---

### 5. Legal Section (in Settings / More)

1. Tap the "More" tab.
2. Scroll down past the Account section. A section labeled "Legal" appears.
3. It contains two tappable rows:
   - "Privacy Policy" — opens https://knowyourpit.com/privacy
   - "Terms of Service" — opens https://knowyourpit.com/terms

---

### 6. Core App Walkthrough (for general feature review)

**Home tab**
Shows a greeting, live-cook widget (if a cook is active), upcoming planned cooks, and the
PitMaster Score card (a BBQ skill rating based on past cook history, visible to Pro users).

**Plan tab**
Tap "Plan a Cook" to open the cook planning form. Select a meat type and cut, enter weight,
pick a serve time, and choose a grill. The app calculates a start time. Tap "Save Cook" to
log it or tap "Ask PitMaster" for an AI-generated time estimate and prep notes.

**Cooks tab**
Lists all past and active cooks. Tap any cook to see its detail: cook log, temperature
readings, and PitMaster AI feedback for that session.

**PitMaster tab** (flame icon)
Opens the AI chat. Type any BBQ question and PitMaster responds with coaching advice.
Free accounts get 5 messages/day; Pro is unlimited.

**More tab**
- Subscription card at top (shows plan status / opens paywall for free users)
- Profile, My Grills, Connected Devices, and Alerts rows
- Legal section (Privacy Policy, Terms of Service)
- Sign Out button
- Delete Account link

---

### 7. In-App Purchases / Subscriptions

In-app purchases are handled by RevenueCat. The demo account above has Pro status already
granted so no purchase is needed during review. If you wish to test the purchase flow:

- Use the Sandbox Apple ID environment.
- Tap the "Upgrade to Pro" card in the More tab or let the app hit a free-tier limit
  (3 total cooks, 5 AI messages/day) to trigger the paywall.
- The paywall offers an Annual plan (with a free trial if eligible) and a Monthly plan.
- Tap either plan card to initiate a Sandbox purchase.
- "Restore purchases" is also available at the bottom of the paywall sheet.

---

### Contact

If you have any questions during review, please contact:

  support@knowyourpit.com
