# Big Pete's TestFlight rollout

The Big Pete's partner cards are controlled by two layers:

1. **Build profile default** — `EXPO_PUBLIC_PARTNER_BIG_PETES` is embedded in
   both EAS binaries and the channel-matched JavaScript bundle used by OTA
   updates.
2. **Server kill switch** — `GET /api/config` returns `partnerBigPetes`. A
   `false` response hides cards even in a preview build.

## Build behavior

| EAS profile | OTA channel | Partner cards |
| --- | --- | --- |
| `development` / `development-device` | development | Enabled |
| `preview` | preview | Enabled for TestFlight partner review |
| `production` | production | Disabled for the public App Store release |

The preview profile deliberately uses `https://api.knowyourpit.com` so
TestFlight validates the same API, authentication, and subscription services
that production users use. Its card visibility remains isolated by the
build-time flag.

## OTA channel safety

Always use `scripts/ota-update.sh` rather than calling `eas update` directly.
It maps `preview` OTA updates to the `preview` EAS profile and `production`
updates to the `production` profile, then checks the generated bundle contains
the expected partner default before it can upload.

Run this non-publishing check before an OTA release:

```bash
cd artifacts/knowyourpit
pnpm run verify:ota-profiles
```

For a TestFlight-only preview OTA, use:

```bash
bash scripts/ota-update.sh --channel preview --platform ios \
  --message "Preview Big Pete's partner cards"
```

## TestFlight partner test

1. Confirm `FEATURE_PARTNER_BIG_PETES` is not set to `false` in the production
   API environment. A false server value is an emergency kill switch and hides
   cards in every build.
2. Build the iOS preview profile:

   ```bash
   cd artifacts/knowyourpit
   EAS_NO_VCS=1 pnpm exec eas build --platform ios --profile preview --no-wait
   ```

3. Submit that build to TestFlight and install it. The Big Pete's cards should
   be visible.
4. Install or open the public App Store build on the same device. Its embedded
   production value is `false`, so the cards remain hidden.

## Public launch

To launch partner cards publicly, intentionally change the production
build-time value to `true` and publish a compatible production OTA update, or
ship a new production binary. The production API flag must also remain enabled.

Use the project OTA script rather than calling `eas update` directly:

```bash
cd artifacts/knowyourpit
bash scripts/ota-update.sh --channel production --platform ios --yes \
  --message "Enable Big Pete's partner cards"
```

## Emergency disable

Set `FEATURE_PARTNER_BIG_PETES=false` in the production API deployment
environment, then redeploy the API service. The next remote-config response
hides the cards in preview, production, and development builds.

The authenticated `POST /api/admin/config` endpoint can also flip the running
server's value immediately, but that runtime change is lost when the server
restarts.