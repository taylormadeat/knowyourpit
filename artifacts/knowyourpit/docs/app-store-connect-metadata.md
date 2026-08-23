# App Store Connect Metadata — knowyourpit

Use these values for the current iOS draft. URLs must use the `www` host; the
apex domain does not serve all deep links.

## App Information

| Field | Value |
|---|---|
| App name | knowyourpit |
| Subtitle | BBQ plans & AI coaching |
| Primary category | Food & Drink |
| Secondary category | Utilities |
| Copyright | © 2026 Aaron Taylor |
| Privacy Policy URL | https://www.knowyourpit.com/privacy |

## Version Localization (en-US)

| Field | Value |
|---|---|
| Promotional text | Plan every cook, track live temperatures, and get PitMaster coaching when it matters. Build multi-cook schedules, manage your grills, and unlock more with Pro. |
| Keywords | bbq,smoker,grill,pitmaster,brisket,thermometer,cook planner,meat temperature,barbecue |
| Marketing URL | https://www.knowyourpit.com |
| Support URL | https://www.knowyourpit.com/support |

### Description

```text
knowyourpit is your BBQ planning and cook-management companion.

PLAN WITH CONFIDENCE
Tell knowyourpit what you are cooking, its weight, your cooking method, and when you want to serve. It builds a practical start-to-finish plan with the milestones that matter.

COORDINATE THE WHOLE SPREAD
Planning more than one item? Pro's Multi-Cook Sequencer works backwards from your serve time and organizes compatible cooks across your grills so the whole meal is ready together.

TRACK EVERY COOK
Keep your cook history in one place with temperatures, timings, notes, photos, results, and ratings. Review what worked, then use it to make the next cook better.

COACHING FROM PITMASTER
Ask PitMaster a BBQ question, request a plan, or check in during a cook. It uses the context you provide—your cook, temperatures, grills, and history—to return practical next steps.

LIVE TEMPERATURES
Connect compatible Bluetooth or local-network thermometer devices to follow live meat and pit temperatures during a cook. You can also log readings manually and set alerts for the temperatures that matter.

YOUR GRILLS, YOUR WAY
Create profiles for each cooker and build plans around the equipment you actually use. From a weeknight pork shoulder to a full weekend spread, knowyourpit keeps the details organized.

knowyourpit Pro unlocks unlimited cooks and PitMaster chat, Multi-Cook Sequencer, advanced planning, and analytics. Subscription options are monthly or annual; restore purchases is always available from the paywall.

Terms of Use: https://www.knowyourpit.com/terms
```

## App Review Notes

Use `APP_REVIEW_NOTES.md` for the reviewer walkthrough. Enter the pre-created
Pro demo account directly in App Store Connect's protected demo-account fields;
do not add its credentials to this repository.

Before submitting, run `pnpm --filter @workspace/scripts run
checkAscReleaseReadiness` to verify the live draft, attached build, categories,
listing, screenshots, reviewer access, pricing, age rating, and subscriptions.

## Privacy, Rating, and Encryption

- Enter the categories and purposes in `docs/app-privacy-nutrition-label.md`.
- Mark no collected data as tracking, analytics, advertising, or crash data.
- Use the 4+ declaration and no/none selections in
  `docs/app-store-review-notes.md`.
- Declare standard HTTPS/TLS as exempt encryption. The iOS configuration sets
  `ITSAppUsesNonExemptEncryption` to `false`.