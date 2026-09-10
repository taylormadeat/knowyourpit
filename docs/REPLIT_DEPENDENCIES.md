# Replit dependencies

This document identifies where knowyourpit relies on Replit-specific
infrastructure and what would be required to run elsewhere.

## Artifact routing and workflows

Replit manages the development workflows and path-based artifact previews for
the API, Expo app, marketing site, and component sandbox. The Expo workflow
uses Replit-provided domains and proxy variables to serve platform-aware
manifests.

Outside Replit:

- Run each service with its standard package command.
- Provide a reverse proxy or separate hostnames.
- Set explicit public API and canonical website URLs.
- Use `expo start` directly rather than the Replit preview command.

## Domains and deployments

Development domains are supplied by Replit and are not production canonical
URLs. Production domain configuration must be recreated at the destination
host, including DNS, TLS, API routing, CORS, legal-page URLs, webhook URLs, and
mobile public API configuration.

## PostgreSQL

The app uses standard PostgreSQL through `DATABASE_URL`, with Drizzle ORM.
This is portable to another PostgreSQL provider, but migration requires:

1. A verified database backup.
2. A secure restore into the destination.
3. Updated secrets.
4. Connectivity and TLS validation.
5. Application and webhook smoke checks.

Do not replace the current database without explicit owner approval.

## Object storage

The API uses Replit object-storage configuration and path variables. A move
requires exporting objects, preserving identifiers and access rules, importing
them into the new provider, and replacing the storage adapter/configuration.
Database records and stored objects must be migrated as one coordinated
operation.

## AI integrations

The API uses Replit AI Integrations through an OpenAI-compatible base URL and
credential. To move:

- Select a compatible provider.
- Update server-only base URL and credential configuration.
- Validate model names, streaming behavior, limits, and error handling.
- Re-run AI planning and coaching tests.

## RevenueCat connector

Server entitlement operations use the Replit RevenueCat connector and
`@replit/revenuecat-sdk`. The native app also uses RevenueCat's public iOS and
Android SDK keys.

Outside Replit, replace the server connector path with RevenueCat's supported
server API or SDK, preserve webhook verification, and test entitlement reads,
grants, revocations, purchases, and restores. Do not change products,
entitlements, or store applications during a hosting migration.

## Secrets and environment variables

Replit Secrets currently supplies server credentials, public build variables,
App Store credentials, and operational configuration. Another host requires a
secret manager with separate development and production values.

Use `.env.example` only as an inventory. Never copy actual values into the
repository, documentation, logs, or chat.

## Expo preview

Replit's Expo preview uses:

- `REPLIT_EXPO_DEV_DOMAIN`
- `REPLIT_DEV_DOMAIN`
- `EXPO_PACKAGER_PROXY_URL`
- `REACT_NATIVE_PACKAGER_HOSTNAME`
- a path base for the mobile artifact

These are development-preview concerns, not native production requirements.
Standard Expo development can use local/LAN/tunnel hosting outside Replit.

## Replit-specific developer tooling

The repository includes Replit Vite plugins, artifact configuration,
workflows, checkpoints, and preview routing. These improve development on
Replit but should not contain core business logic. If moving:

- Remove or conditionally disable Replit-only Vite plugins.
- Recreate process management in the destination CI/hosting platform.
- Preserve standard pnpm scripts as the portable entry points.
- Replace checkpoint recovery with Git tags/releases and provider backups.

## Migration principle

Prefer adapters and environment-based configuration for infrastructure
dependencies. Do not perform a migration merely to reduce Replit coupling when
the current service is working. Any production migration requires owner
approval, a tested backup, a staged cutover, and a rollback plan.