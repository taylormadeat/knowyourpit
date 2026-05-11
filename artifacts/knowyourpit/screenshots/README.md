# App Store Screenshots

This directory holds the real iOS simulator captures used for App Store Connect submission.

## Generating screenshots

Run from the `artifacts/knowyourpit/` directory:

```bash
# iPhone only (builds the simulator app automatically)
SCREENSHOT_EMAIL=demo@example.com SCREENSHOT_PASSWORD=YourPassword \
  ./scripts/take-screenshots.sh

# iPhone + iPad
SCREENSHOT_EMAIL=demo@example.com SCREENSHOT_PASSWORD=YourPassword \
  ./scripts/take-screenshots.sh --ipad

# Skip the build step (reuse the last build under build/)
SCREENSHOT_EMAIL=demo@example.com SCREENSHOT_PASSWORD=YourPassword \
  ./scripts/take-screenshots.sh --no-build
```

`SCREENSHOT_EMAIL` and `SCREENSHOT_PASSWORD` must be credentials for a pre-existing Clerk account (production or staging). The Maestro auth flow signs in automatically, navigates to each screen, and captures. If the account is already signed in on the simulator, the auth step is skipped automatically.

### Prerequisites

| Tool | Install |
|------|---------|
| macOS + Xcode 15+ | App Store |
| Maestro CLI | `curl -Ls https://get.maestro.mobile.dev \| bash` |
| EAS CLI | `npm install -g eas-cli` |

> **Note:** `eas build --local` requires Xcode build tools on the host machine and is only supported on macOS.

## Output locations

| Device | Directory | Resolution |
|--------|-----------|------------|
| iPhone 15 Pro Max (6.7") | `screenshots/iphone/` | 1290 × 2796 |
| iPad Pro 13-inch M4 | `screenshots/ipad/` | 2064 × 2752 |

## Screens captured

| File | Screen |
|------|--------|
| `01-dashboard.png` | Home — live cook widget + recent activity |
| `02-cook-log.png` | Cook Log — history with status tags |
| `03-plan.png` | Plan — AI-driven cook schedule |
| `04-pitmaster.png` | PitMaster — AI assistant chat |
| `05-my-grills.png` | My Grills — grill profile management |
| `06-pro-features.png` | Go Pro — paywall / feature showcase |

## Running via EAS cloud (CI)

An EAS workflow is defined at `.eas/workflows/screenshots.yml` (relative to this artifact). Trigger it with:

```bash
eas workflow:run screenshots
```

This boots the simulator on EAS's macOS fleet, runs the Maestro flows, and stores the screenshots as build artifacts you can download from the EAS dashboard.

## Fallback: HTML/CSS composites

The original high-fidelity HTML/CSS composites are still available in the mockup sandbox at:

```
artifacts/mockup-sandbox/src/components/mockups/app-store-screenshots/AppStoreExporter.tsx
```

These remain useful for rapid design iteration and as a visual reference when the simulator workflow is not available (e.g. in the Replit cloud environment).
