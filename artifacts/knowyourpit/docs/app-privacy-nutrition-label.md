# App Privacy Nutrition Label — knowyourpit

> Fill this into the App Store Connect "App Privacy" section before submitting.
> Apple's nutrition label form asks about each data category separately.
> Last updated: August 2026

---

## Does this app collect data? Yes.

---

## Data Types — Full Declaration

### 1. Contact Info

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Email Address | ✅ Yes | App Functionality (account sign-in, support contact) | Yes | No |
| Name | ✅ Yes (display name, optional) | App Functionality (personalization) | Yes | No |
| Phone Number | ❌ No | — | — | — |
| Physical Address | ❌ No | — | — | — |

**Who collects it:** Clerk (authentication provider) on sign-up/sign-in.
Our servers store the user's email to associate their cook data with their account.

---

### 2. User Content

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Photos or Videos | ✅ Yes | App Functionality (AI temperature analysis) | **Yes** (photos are stored under the authenticated user's cook record; cook records are account-owned) | No |
| Audio Data | ❌ No | — | — | — |
| Gameplay Content | ❌ No | — | — | — |
| Customer Support | ✅ Yes (support messages via in-app SupportModal) | App Functionality | Yes (submitted with user name and email) | No |
| Other User Content | ✅ Yes (cook logs, notes, AI chat) | App Functionality | Yes | No |

**Cook logs** include: food type, target temperature, cook temperature, weight, method,
timing, check-in temperatures, probe readings, and free-text notes. Stored on our servers
and linked to the user's account solely to power app functionality (history, AI coaching).

**AI chat messages** are sent to OpenAI's API with no user identifiers attached.
They are stored on our servers to maintain conversation context and are linked
to the user's account for retrieval purposes only.

---

### 3. Identifiers

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| User ID | ✅ Yes (Clerk user ID) | App Functionality | Yes | No |
| Device ID | ❌ No (not collected by app) | — | — | — |

**Note:** RevenueCat (subscription management SDK) generates its own anonymous device
identifier for purchase attribution. This identifier is linked to the Clerk user ID
after login. RevenueCat's own privacy policy covers their SDK data collection.

---

### 4. Purchases

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Purchase History | ✅ Yes (subscription status only) | App Functionality (Pro feature gating) | Yes | No |

Subscription state (active/expired, plan type, expiration date) is fetched from
RevenueCat and cached locally. Raw transaction data is held by Apple/RevenueCat,
not our servers.

---

### 5. Location

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Precise Location | ❌ No | — | — | — |
| Coarse Location | ✅ Yes (foreground only, temporary) | App Functionality (outdoor weather during cook) | No | No |

Location coordinates are sent **directly from the device to Open-Meteo's public API**
to fetch current or forecast weather conditions. Our servers never receive or store
raw location data. The app requests `NSLocationWhenInUseUsageDescription` (foreground only).

---

### 6. Diagnostics

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Crash Data | ❌ No (no crash SDK installed) | — | — | — |
| Performance Data | ❌ No | — | — | — |
| Other Diagnostic Data | ❌ No | — | — | — |

---

### 7. Usage Data

| Sub-type | Collected? | Used for | Linked to identity | Used for tracking |
|---|---|---|---|---|
| Product Interaction | ❌ No (no analytics SDK installed) | — | — | — |
| Advertising Data | ❌ No | — | — | — |
| Other Usage Data | ❌ No | — | — | — |

---

## Third-Party SDKs — Data Collection Summary

| SDK | Data collected by SDK | Privacy policy |
|---|---|---|
| Clerk (auth) | Email, name, device info for session management | https://clerk.com/privacy |
| RevenueCat | Anonymous device ID, purchase history, subscription status | https://www.revenuecat.com/privacy |
| OpenAI (via server proxy) | AI chat message content (no user identifiers sent) | https://openai.com/privacy |
| Open-Meteo (weather, direct device call) | GPS coordinates (not stored, ephemeral API call) | https://open-meteo.com/en/terms |
| Expo / React Native | No independent data collection | https://expo.dev/privacy |

---

## Summary for ASC Form

When filling in the App Store Connect privacy nutrition label, select:

- **Contact Info → Email Address** — Linked to identity, App Functionality
- **Contact Info → Name** — Linked to identity, App Functionality
- **User Content → Photos or Videos** — **Linked to identity**, App Functionality
- **User Content → Customer Support** — Linked to identity, App Functionality
- **User Content → Other User Content** — Linked to identity, App Functionality
- **Identifiers → User ID** — Linked to identity, App Functionality
- **Purchases → Purchase History** — Linked to identity, App Functionality
- **Location → Coarse Location** — Not linked to identity, App Functionality

**Do NOT select:**
- Tracking (none of the above is used for cross-app tracking)
- Analytics / Advertising (no analytics or ad SDK is installed)
- Crash data (no crash reporting SDK is installed)
