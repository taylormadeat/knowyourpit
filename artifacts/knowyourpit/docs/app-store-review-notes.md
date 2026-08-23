# App Store Review Notes — knowyourpit

> **Purpose:** Paste the content of each section below into the corresponding
> field in App Store Connect when submitting for review.
>
> **⚠️ Before pasting:** Replace the test account credentials placeholder with
> the actual reviewer credentials from your secure credential store (e.g.
> 1Password "ASC Reviewer Account" entry). Do NOT commit real credentials to
> this file.
>
> Last updated: August 2026

---

## Review Notes (App Store Connect → "Notes for Apple" field)

```
Thank you for reviewing knowyourpit — a BBQ cook-management app for serious pitmasters.

────────────────────────────────────────────────────────────────────────
TEST ACCOUNT
────────────────────────────────────────────────────────────────────────
Email:    [INSERT REVIEWER EMAIL — see 1Password "ASC Reviewer Account"]
Password: [INSERT REVIEWER PASSWORD — see 1Password "ASC Reviewer Account"]

This account has a pre-activated Pro subscription so you can test all Pro
features without going through a purchase flow. If you prefer to test the
paywall, sign up with a new account (Apple Sign In or email) and use the
Sandbox environment; the app auto-detects Sandbox and all purchases are free.

────────────────────────────────────────────────────────────────────────
CORE FEATURES — what you can test without hardware
────────────────────────────────────────────────────────────────────────
1. Create a cook: tap the + button on the Home tab, choose a meat type,
   set a target temp, and start the cook.

2. AI PitMaster chat: open any cook → tap "Ask PitMaster". Type a question
   such as "My brisket is at 165°F and the flat feels tight — stall or done?"
   The AI responds with coaching based on the cook's context.

3. AI photo analysis: on any cook detail screen, tap "Check In" → upload a
   photo of a thermometer readout or meat surface. PitMaster grades it.

4. Multi-Cook Sequencer (Pro): tap "Plan" tab → "New session" → add 2–3 items
   and tap "Sequence". The AI schedules them across grills to hit a serve time.

5. Frozen-to-Table Planner (Pro): create a cook and toggle "Starting from
   frozen". The app generates a full thaw-to-serve timeline.

6. Settings / subscription: More tab → tap the Pro card. Restore Purchases is
   in the same screen and in the paywall footer.

────────────────────────────────────────────────────────────────────────
CONNECTED-THERMOMETER FEATURES — hardware optional
────────────────────────────────────────────────────────────────────────
The app can connect to compatible Bluetooth temperature probes and can discover
a FireBoard Wi-Fi thermometer on the same local network. These features require
physical hardware that App Store reviewers will not have.

To review these features without hardware:
• Navigate to More → Connected Devices. With no compatible hardware nearby,
  the expected empty state is shown.
• The Bluetooth permission prompt appears only when the user begins device
  discovery or enables probe tracking for a cook.
• The Local Network permission prompt appears only when the app scans the local
  network for a compatible Wi-Fi thermometer. With no FireBoard on the network,
  no device is discovered — this is expected.
• Location permission is requested only when the user starts a live cook and
  elects to use the outdoor-weather feature.

The rest of the app—including planning, cook logs, PitMaster coaching, and
subscription flows—can be reviewed without probe hardware.

────────────────────────────────────────────────────────────────────────
IN-APP PURCHASES
────────────────────────────────────────────────────────────────────────
The app offers one subscription product with two billing periods:
  • knowyourpit Pro – Monthly
  • knowyourpit Pro – Annual (includes a 7-day free trial for new subscribers)

Both products are configured in App Store Connect under the bundle ID
com.knowyourpit.app. Purchases are managed by RevenueCat; the test account
above has Pro pre-granted so no purchase is required to review Pro features.

Restore Purchases is accessible from:
  1. The paywall modal footer (always visible, not gated by Pro status)
  2. More tab → "Restore purchases" button (below the subscription card)

────────────────────────────────────────────────────────────────────────
APPLE SIGN IN
────────────────────────────────────────────────────────────────────────
Apple Sign In is implemented via expo-apple-authentication and Clerk.
It appears as the primary sign-in option on both the Sign In and Sign Up
screens. The app requests FULL_NAME and EMAIL scopes; if Apple hides the
email on subsequent logins, the app handles the nil email gracefully.

────────────────────────────────────────────────────────────────────────
ENCRYPTION EXPORT COMPLIANCE
────────────────────────────────────────────────────────────────────────
This app uses only standard HTTPS/TLS (provided by Apple's networking stack
and the operating system). No proprietary or non-standard encryption algorithms
are implemented. The app qualifies for the standard encryption exemption;
ITSAppUsesNonExemptEncryption is set to NO in the Info.plist.

────────────────────────────────────────────────────────────────────────
CONTENT & AGE RATING
────────────────────────────────────────────────────────────────────────
Appropriate for ages 4+. No violent content, mature themes, or user-generated
public content. AI responses are scoped to BBQ cooking topics; the system
prompt explicitly restricts off-topic or inappropriate content.
```

---

## Age Rating Declaration

**Recommended rating: 4+**

| Category | Selection |
|---|---|
| Cartoon or Fantasy Violence | None |
| Realistic Violence | None |
| Prolonged Graphic or Sadistic Realistic Violence | None |
| Profanity or Crude Humor | None |
| Mature/Suggestive Themes | None |
| Horror/Fear Themes for Children | None |
| Medical/Treatment Information | None |
| Alcohol, Tobacco, or Drug Use or References | None |
| Simulated Gambling | None |
| Sexual Content or Nudity | None |
| Graphic Sexual Content and Nudity | None |
| User-Generated Content | No |
| Unrestricted Web Access | No |

---

## Export Compliance

**Q: Does this app use encryption?**
Yes — the app uses HTTPS (TLS) provided by the iOS networking stack (URLSession / fetch).

**Q: Is the encryption proprietary or non-standard?**
No.

**Q: Does the app qualify for any exemptions?**
Yes — standard encryption (HTTPS/TLS) is exempt per U.S. export regulations
(EAR 740.17(b)(4) — mass-market encryption). `ITSAppUsesNonExemptEncryption` is
set to `NO` (false) in the app's Info.plist, confirming standard encryption only.

**Answer in App Store Connect:**
- "Does your app use encryption?" → **Yes**
- "Does your app qualify for any of the exemptions provided in Category 5, Part 2?"
  → **Yes** (standard encryption only / HTTPS)

---

## External URL Accessibility

The following URLs are referenced in the app and must be reachable without authentication:

| URL | Location in app | Status |
|---|---|---|
| https://www.knowyourpit.com/privacy | More → Privacy Policy, PaywallModal footer | Must be public |
| https://www.knowyourpit.com/terms | More → Terms of Service | Must be public |
| support@knowyourpit.com | More → Contact Support, in-app support modal | Email (no auth) |

> **Action required before submission:** Verify both URLs load in a browser without
> redirecting to a login page or returning an error. If they are not yet live,
> create placeholder pages before submitting.
