---
name: EAS iOS submit "invalid curve name" blocker
description: TestFlight submission via `eas submit` fails server-side with OpenSSL::PKey::ECError even though the ASC API key is a valid, unrotated P-256 key.
---

`eas submit --platform ios` can fail every attempt with:

```
spaceship/lib/spaceship/connect_api/token.rb:71:in `initialize':
  [!] invalid curve name (OpenSSL::PKey::ECError)
```

This happens inside fastlane's `pilot` step on EAS's own macOS submit runner
(fastlane 2.226.0 seen in the wild), not in our repo. Confirmed via direct
testing (2026-07-05, knowyourpit) that this is **not fixable from our side**:

- The local `.p8` key parsed cleanly with `openssl pkey -text` as a valid
  prime256v1/P-256 key (i.e. the ASC_API_KEY_P8 secret itself is fine).
- Converting the key we upload from PKCS#8 (`BEGIN PRIVATE KEY`) to SEC1
  (`BEGIN EC PRIVATE KEY`) — the fix suggested for the equivalent local-
  fastlane bug — made **no difference**: the exact same stack trace recurred.
  This means EAS's submit runner re-derives/re-wraps the key server-side
  before invoking fastlane, so client-side key reformatting can't route
  around it.

**Why:** the failure lives in EAS's hosted submit infrastructure (fastlane +
Ruby OpenSSL 3.x version pairing on their runner image), which we don't
control and can't patch from the repo.

**How to apply:** don't burn more submission attempts trying key-format
workarounds once this exact stack trace is confirmed. Options, in order of
effort: (1) retry later — this is the kind of thing Expo patches on their
runner image; (2) download the build's `.ipa` (`applicationArchiveUrl` from
`eas build:view --json`) and upload manually via Apple's Transporter app on
a Mac; (3) check Expo's status page / EAS Build changelog for a related
regression before assuming it's project-specific.
