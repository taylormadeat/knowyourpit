/**
 * Sentry crash-reporting integration for knowyourpit.
 *
 * Initialise early in app/_layout.tsx (module scope, before any providers)
 * by calling `initSentry()`.  After that, call `captureWarning(message)` to
 * forward a warning to Sentry with 'warning' severity.
 *
 * Configuration is driven by a single env var:
 *   EXPO_PUBLIC_SENTRY_DSN — your Sentry project DSN.
 *   If the var is absent or empty, Sentry is silently skipped (dev / CI
 *   builds without a DSN configured will not crash or log noisy errors).
 *
 * PII policy:
 *   - We never call Sentry.setUser() with a real Clerk user ID.
 *   - beforeSend strips the Authorization header from any captured request
 *     breadcrumbs so no bearer tokens reach Sentry servers.
 *   - The only string data captured is the warning message itself; neither
 *     getTokenSafe nor customFetch include tokens or user IDs in their
 *     warning strings.
 */

import * as Sentry from "@sentry/react-native";
import { captureConsoleIntegration } from "@sentry/core";

let _initialized = false;

export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) {
    return;
  }

  if (_initialized) return;
  _initialized = true;

  Sentry.init({
    dsn,

    // Disable performance tracing — we only need error/warning capture.
    tracesSampleRate: 0,

    // Capture console.warn and console.error calls so the existing warn
    // inside customFetch (lib/api-client-react) is forwarded automatically
    // without needing a direct Sentry import in the shared library.
    integrations: [captureConsoleIntegration({ levels: ["warn", "error"] })],

    // Strip PII from every outbound event before it reaches Sentry servers.
    beforeSend(event) {
      // event.breadcrumbs is Breadcrumb[] | undefined in Sentry v8.
      if (event.breadcrumbs) {
        for (const crumb of event.breadcrumbs) {
          if (!crumb.data) continue;
          // Drop the Authorization header value from any HTTP breadcrumb
          // so bearer tokens never appear in the Sentry dashboard.
          if (crumb.data["Authorization"]) {
            crumb.data["Authorization"] = "[redacted]";
          }
          if (crumb.data["authorization"]) {
            crumb.data["authorization"] = "[redacted]";
          }
        }
      }

      // Strip request headers from the event-level request context.
      if (event.request?.headers?.["Authorization"]) {
        event.request.headers["Authorization"] = "[redacted]";
      }
      if (event.request?.headers?.["authorization"]) {
        event.request.headers["authorization"] = "[redacted]";
      }

      return event;
    },

    // In development, print Sentry events to the console instead of sending
    // them so the DSN doesn't accumulate noise from developer machines.
    debug: __DEV__,
    enabled: !__DEV__ || Boolean(process.env.EXPO_PUBLIC_SENTRY_DEV_ENABLED),
  });
}

/**
 * Capture a warning-level message in Sentry.
 *
 * Safe to call before `initSentry()` (Sentry.captureMessage is a no-op when
 * the SDK has not been initialised) and safe to call when DSN is absent
 * (the SDK was never initialised, so the call is a no-op).
 *
 * Always call `console.warn` yourself *before* this so the message is visible
 * in the Metro console during development regardless of DSN configuration.
 */
export function captureWarning(message: string): void {
  Sentry.captureMessage(message, "warning");
}

/**
 * Wrap the root React component so Sentry's error boundary and native crash
 * reporters attach correctly.  Call this in the default export of app/_layout.tsx.
 *
 * Returns the component unchanged when Sentry was not initialised (no DSN).
 */
export const wrap: typeof Sentry.wrap = Sentry.wrap;
