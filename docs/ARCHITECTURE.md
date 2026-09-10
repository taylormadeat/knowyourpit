# Architecture

## System overview

knowyourpit is a pnpm monorepo with three production-facing applications:

1. An Expo/React Native mobile app for planning, monitoring, and reviewing BBQ
   cooks.
2. An Express API that provides authenticated application data, AI features,
   subscriptions, integrations, and webhooks.
3. A React/Vite marketing site for public product and legal pages.

Shared workspace packages hold the database schema, API contracts, generated
clients, validation schemas, and reusable cook-planning logic.

## Mobile application

Location: `artifacts/knowyourpit`

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router 6
- TanStack Query for server state
- Clerk for user authentication
- RevenueCat for subscription state and purchases
- Expo Notifications for local and push notifications
- BLE integrations for supported probes
- EAS Build, Submit, and Update for native delivery

The mobile app communicates with the API over HTTPS. Public Expo variables are
compiled into the client and therefore must never contain server secrets.
Native identifiers and the Expo project identity are release-critical and must
remain unchanged unless the owner explicitly approves a migration.

## API

Location: `artifacts/api-server`

- Node.js and TypeScript
- Express 5
- Zod-backed API contracts
- Clerk server authentication
- PostgreSQL through Drizzle ORM
- OpenAI through Replit AI Integrations
- RevenueCat entitlement checks and webhook handling
- Object storage for persistent user-uploaded files
- Resend for transactional email

The API is mounted under `/api`. Its routes cover configuration, profiles,
grills, cooks, check-ins, temperature data, AI planning and coaching,
conversations, dashboard data, subscriptions, contact flows, and webhooks.

## Database

Location: `lib/db`

PostgreSQL is the source of truth for application records. Drizzle schema
definitions are shared with the API. Schema changes must be reviewed for
backward compatibility before production rollout. Destructive orphan-table
cleanup is separately gated and must not be treated as a normal migration.

## Shared packages

- `lib/api-spec` defines shared API contracts.
- `lib/api-client-react` provides generated React-facing API access.
- `lib/api-zod` provides generated validation schemas.
- `lib/checkin-schedule` contains shared cook check-in scheduling logic.
- `lib/paywall` centralizes entitlement enforcement.

Generated packages should be regenerated from their source contracts rather
than edited manually.

## Marketing website

Location: `artifacts/marketing`

The public website uses React, Vite, and static route generation. It owns
marketing content and unauthenticated legal pages. Production canonical URLs
must not point at development `.replit.dev` domains.

## Authentication

Clerk provides authentication for mobile clients and API requests. The mobile
app uses a publishable key; the API uses server credentials. Server credentials
must never be compiled into the client. Authentication changes should preserve
existing user identities and session compatibility.

## AI

AI features call OpenAI-compatible models through Replit AI Integrations.
Provider credentials and base URLs are server-only. The product must fail
explicitly when required AI configuration is unavailable rather than silently
pretending analysis succeeded.

## Storage

User files are stored through object storage; object metadata and application
records remain in PostgreSQL. Database backups alone do not back up stored
objects, so recovery procedures must account for both systems.

## Payments

RevenueCat manages subscription products and entitlement state. Native clients
use public platform keys, while the API and operational scripts use privileged
server access. Webhook verification is required before subscription events are
accepted.

## Deployment boundaries

- The API and marketing site can run on standard Node-compatible hosting.
- PostgreSQL can be moved to another managed PostgreSQL provider.
- Object storage requires an adapter or migration if moved away from Replit.
- Replit AI Integrations can be replaced with a direct compatible provider by
  changing server configuration and validating request behavior.
- Expo/EAS and App Store identities must be preserved during any hosting move.

See [REPLIT_DEPENDENCIES.md](REPLIT_DEPENDENCIES.md) for the current
Replit-specific coupling and migration considerations.