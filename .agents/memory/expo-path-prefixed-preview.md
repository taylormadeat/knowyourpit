---
name: Expo path-prefixed preview routing
description: Expo Router v6 behavior for browser previews mounted below an artifact path.
---

For an Expo Router v6 browser preview mounted below a path such as `/knowyourpit/`, pass the same canonical base path through Expo config and the Router runtime, then serve a production-mode Metro web bundle (`expo start --no-dev --web`).

**Why:** Router v6 deliberately skips `baseUrl` stripping in development bundles. A correctly configured path-prefixed proxy therefore still resolves every route as `+not-found`; the failure is not caused by the route tree.

**How to apply:** Keep the artifact service responsible for Metro's root-absolute bundle namespace, set `experiments.baseUrl` from the preview path, export matching `BASE_PATH`/`EXPO_BASE_URL` values in the preview workflow, and verify the browser's emitted Router bundle uses a non-development transform.