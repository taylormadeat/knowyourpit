---
name: EAS build in Replit — EAS_NO_VCS=1 required
description: EAS CLI's git archive step is blocked by Replit's sandbox (even in task agents); EAS_NO_VCS=1 bypasses it.
---

# EAS build workaround: EAS_NO_VCS=1

## The rule
Always pass `EAS_NO_VCS=1` when running `eas build` in any Replit agent (main or task). Without it, EAS CLI tries to run `git archive` or similar, which is trapped by the sandbox and produces:
```
Destructive git operations are not allowed in the main agent.
```

**Why:** Replit's sandbox intercepts destructive git ops system-wide. EAS uses git to determine which files to bundle and archive for upload. `EAS_NO_VCS=1` tells EAS to use the filesystem directly instead, skipping the git step entirely.

**How to apply:** Always use this form:
```bash
cd artifacts/knowyourpit
EAS_NO_VCS=1 EAS_BUILD_NO_EXPO_GO_WARNING=true eas build --platform ios --profile production --non-interactive --no-wait
```
The `--no-wait` flag is also important — without it the CLI waits for the remote build to finish, which can exceed bash tool timeouts. Use `eas build:view <id>` to poll status instead.

## npm-package-arg broken in eas-cli
The globally-installed eas-cli has a corrupt `npm-package-arg` entry in its node_modules (empty directory). Fix:
```bash
rm -rf /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/node_modules/npm-package-arg
ln -s /home/runner/workspace/node_modules/.pnpm/npm-package-arg@11.0.3/node_modules/npm-package-arg \
  /home/runner/workspace/.config/npm/node_global/lib/node_modules/eas-cli/node_modules/npm-package-arg
```
This symlink needs to be re-applied after any `npm install -g eas-cli` upgrade.

## Submission
After queuing the build with `--no-wait`, poll with `eas build:view <id>` until status is `finished`, then submit:
```bash
cd artifacts/knowyourpit && bash scripts/submit-ios.sh
```
Check submission status via EAS GraphQL (offset 0, limit 5) to confirm FINISHED vs ERRORED.
