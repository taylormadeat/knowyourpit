/**
 * Pre-flight check for GitHub Build Backup configuration.
 *
 * Run this before starting a long EAS build to confirm that the backup
 * will succeed after submission:
 *
 *   pnpm --filter @workspace/scripts run build:backup:check
 *
 * Exits 0 if GITHUB_TOKEN and GITHUB_REPO are both set and plausible.
 * Exits 2 if either is missing or malformed, with a clear remediation message.
 */

import { validateBackupEnv } from "./githubBuildBackup.js";

validateBackupEnv({ exitOnMissing: true });
