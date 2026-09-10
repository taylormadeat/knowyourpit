# knowyourpit

knowyourpit is an AI-assisted BBQ planning and cook-management product. This
repository contains the Expo mobile app, Express API, marketing website, shared
TypeScript libraries, database schema, and operational scripts.

## Repository layout

- `artifacts/knowyourpit` — Expo SDK 54 / React Native mobile app
- `artifacts/api-server` — Express 5 API
- `artifacts/marketing` — React and Vite marketing site
- `artifacts/mockup-sandbox` — isolated component previews
- `lib/db` — PostgreSQL schema and Drizzle ORM configuration
- `lib/api-spec` — shared API contracts
- `lib/api-client-react` and `lib/api-zod` — generated API clients and schemas
- `scripts` — backup, release, App Store, RevenueCat, and maintenance tools

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full system map.

## Requirements

- Node.js 24
- pnpm 10.26.1
- PostgreSQL
- Expo/EAS tooling for native builds
- Accounts or credentials for the external services used in the target
  environment

Use pnpm for all workspace dependency operations:

```bash
corepack enable
pnpm install --frozen-lockfile
```

## Environment configuration

Copy the root template and fill values through a secure environment manager:

```bash
cp .env.example .env
```

Never commit `.env`, credentials, private keys, database exports, or customer
data. The template documents names only. Mobile-specific environment behavior
is described in `artifacts/knowyourpit/ENV.md`.

## Run locally outside Replit

Start PostgreSQL and configure `DATABASE_URL`, then run each service in a
separate terminal.

API:

```bash
pnpm --filter @workspace/api-server run dev
```

Marketing site:

```bash
pnpm --filter @workspace/marketing run dev
```

Expo mobile app:

```bash
cd artifacts/knowyourpit
pnpm exec expo start
```

The Replit-specific `dev` command for the mobile artifact configures proxied
preview routing. Use the direct Expo command above outside Replit.

## Validate

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/knowyourpit test
pnpm run build
```

Before an App Store submission, run:

```bash
bash artifacts/knowyourpit/scripts/pre-submission-review.sh
```

## Database schema

The database uses PostgreSQL and Drizzle ORM.

```bash
pnpm --filter @workspace/db run push
```

Review schema changes before applying them. Never run forced schema cleanup
against production without the documented confirmation and rollback process in
[docs/OPERATIONS.md](docs/OPERATIONS.md).

## Mobile builds and publishing

Run all Expo and EAS commands from `artifacts/knowyourpit`.

Do not queue an EAS build without owner approval. Do not change the existing
bundle identifier, Expo project ID, or App Store listing.

JavaScript-only OTA updates must use:

```bash
cd artifacts/knowyourpit
bash scripts/ota-update.sh --channel production --message "Describe the update"
```

Do not run `eas update` directly in Replit. See
[docs/OPERATIONS.md](docs/OPERATIONS.md) for build, submission, backup, and
recovery procedures.

## GitHub backup

The credential-free `github` remote points to the private source repository.
Authentication is supplied at runtime; credentials must never be embedded in
the remote URL.

Check the worktree and commit intentionally before synchronizing:

```bash
git status --short
git add <reviewed-files>
git commit -m "Clear description of the change"
pnpm run github:sync
```

Never force-push or rewrite history without explicit owner approval.