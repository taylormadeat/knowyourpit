---
name: Production redeploy gap
description: New API routes added in dev only appear in prod after an explicit redeploy
---

When new routes are added to the API server (e.g. `/api/technique-presets`,
`/api/ai/predict/stream`) they are only available in the dev environment until the project is
explicitly redeployed via the Publish button.

**Why this is confusing:** The mobile app (TestFlight builds) talks to the production API URL.
If the production server runs an older build, new routes return 404 even though dev works fine.
This looks like a code bug but is actually a missing redeploy.

**Symptoms:**
- Multiple routes returning 404 in deployment logs simultaneously
- Dev server returns 200 for the same routes
- Issue appeared right after a new TestFlight build that called new endpoints

**How to apply:** After merging any task that adds new API routes, always trigger a production
redeploy before testing the new mobile build. Check deployment logs for 404s on known routes as
the first diagnostic step when users report widespread failures.
