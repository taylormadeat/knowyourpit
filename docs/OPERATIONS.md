# Operations

## Safety rules

- Never expose or commit environment values, tokens, certificates, customer
  data, database dumps, or object-storage exports.
- Never force-push, rewrite history, delete branches, or delete backups without
  explicit owner approval.
- Never change the Apple bundle identifier, Expo project identity, or App Store
  listing without explicit owner approval.
- Never migrate, replace, disconnect, or delete a production service without an
  approved migration and rollback plan.
- Run every Expo and EAS command from `artifacts/knowyourpit`.
- Ask the owner before queuing an EAS build.

## Routine development

Install dependencies:

```bash
pnpm install --frozen-lockfile
```

Primary validation:

```bash
pnpm run typecheck
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/knowyourpit test
```

Review `git status --short` before committing so unrelated or sensitive files
are not included.

## GitHub synchronization

The `github` remote must use a credential-free URL. Authentication is supplied
at runtime through the workspace secret manager.

```bash
git status --short
git log -1 --oneline
pnpm run github:sync
```

The sync command pushes the current `HEAD` to `main`. Do not use it until the
intended changes are committed and the worktree has been reviewed. Never
force-push.

The mobile release backup scripts can check or archive build metadata:

```bash
pnpm --filter @workspace/scripts run build:backup:check
pnpm --filter @workspace/scripts run build:backup:dry-run
```

## Database changes

Development schema synchronization:

```bash
pnpm --filter @workspace/db run push
```

Before production:

1. Review the SQL impact and compatibility with the currently deployed API.
2. Back up the production database.
3. Prefer additive changes that work with both old and new application
   versions.
4. Document rollback steps.
5. Deploy application changes only after the schema sequence is understood.

Orphan-table cleanup is destructive. Always run the production cleanup tool in
dry-run mode first:

```bash
pnpm --filter @workspace/scripts run db:prod-drop-orphans
```

Only use its explicit confirmation mode after owner approval and a verified
backup. Never point the development `drop-orphans` command at production.

## Database backups

Create backups only in a secure environment:

```bash
pnpm --filter @workspace/scripts run db:backup
pnpm --filter @workspace/scripts run db:backup:csv
```

The local `backups/` directory is ignored by Git. Treat all exports as
sensitive, encrypt them at rest, store them outside the repository, and test
restoration periodically. A backup is not complete until restoration has been
verified.

## Object-storage backups

Database backups do not include stored images or documents. Periodically create
a separate, access-controlled export of important object-storage data and
record:

- Export date and source environment
- Object count and total size
- Encryption and retention location
- Restoration steps and verification result

Never place production object exports in GitHub.

## Replit workflows

The normal services are:

- Mobile Expo preview
- API server
- Marketing website
- Component preview sandbox

Services must bind to the provided `PORT`. After code, dependency, toolchain, or
run-command changes, restart the affected workflow once and inspect logs for
startup errors.

## EAS native builds

Before queuing a build:

1. Obtain owner approval.
2. Confirm the worktree and GitHub backup are current.
3. Run the pre-submission review.
4. Confirm the app version, build number, bundle identifier, Expo project ID,
   runtime version, signing setup, and intended EAS profile.
5. Summarize changes and rollback options.

Use the project scripts rather than bypassing their checks:

```bash
cd artifacts/knowyourpit
pnpm run eas:build:ios
```

EAS cloud build artifacts are not a replacement for source or database
backups.

## OTA updates

OTA updates are for JavaScript and compatible asset changes only. Native
modules, permissions, entitlements, native configuration, and runtime-version
changes require a new binary.

On Replit, never invoke `eas update` directly:

```bash
cd artifacts/knowyourpit
bash scripts/ota-update.sh --channel production --message "Describe the update"
```

Before publishing:

1. Confirm the target runtime matches the installed binary.
2. Run typechecks and relevant tests.
3. Verify the update profile.
4. Confirm the GitHub backup is current.
5. Record the update message and rollback approach.

Rollback by republishing the last known-good compatible bundle to the same
runtime/channel or by directing users to a known-good native build.

## App Store workflow

Run:

```bash
bash artifacts/knowyourpit/scripts/pre-submission-review.sh
```

Confirm that App Store Connect has the intended version and build attached,
listing metadata is complete, subscriptions are valid, legal URLs are public,
and the existing App Store application is being used. Submission scripts live
under `artifacts/knowyourpit/scripts/`.

## Webhooks and scheduled jobs

RevenueCat webhooks terminate at the API and must retain signature/secret
verification. Re-run webhook setup only when intentionally changing the target
or credential.

The API starts recurring cleanup jobs for old temperature readings and
analytics events. When moving hosts, ensure exactly one intended scheduler
instance is active or make the cleanup operations safe under multiple
instances.

## Recovery order

1. Stop further destructive changes.
2. Preserve logs and identify the affected environment and time window.
3. Restore source from the private GitHub repository or a Replit checkpoint.
4. Restore PostgreSQL from the latest verified backup.
5. Restore object-storage data separately.
6. Reconfigure environment variables through the target platform's secret
   manager.
7. Start the API, then the marketing site and mobile delivery services.
8. Verify authentication, core cook data, object access, subscription status,
   AI calls, webhooks, and legal pages.
9. Document data loss, remaining risks, and follow-up actions.

## Production change summary

Before any production publish, provide the owner:

- What changed
- Validation completed
- Database impact
- Environment-variable names added or removed
- App identity confirmation
- Known risks
- Exact rollback procedure