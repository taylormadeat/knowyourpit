---
name: Big Pete's partnership — first build
description: The first build that shipped the Big Pete's Seasoning partnership feature (home card + plan card + feature flag).
---

# Big Pete's Partnership — First Build

**iOS build number: 135**
**Android versionCode: 5**
**App version: 1.0.18**

EAS build IDs:
- iOS: `b443fb6f-465e-4268-949b-bdababd2fb7c`
- Android: `8d2a829d-0ca6-40e1-9c63-1ba8e1d76e84`

Both submitted 2026-08-16.

**Why:** User wants to track which build first introduced the Big Pete's partnership so they can correlate engagement data and know which users received it.

The feature flag `partnerBigPetes` was introduced in this build. Toggle it via:
`POST /api/admin/config` with `{"key":"partnerBigPetes","value":false}` + `Authorization: Bearer <ADMIN_API_TOKEN>`
