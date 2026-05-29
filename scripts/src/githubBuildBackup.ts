/**
 * Push a git tag and create a GitHub Release for a completed EAS build.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run build:backup -- \
 *     --platform ios \
 *     --buildNumber 106 \
 *     --version 1.0.11 \
 *     [--easBuildId abc-123] \
 *     [--dry-run]
 *
 * Required env vars:
 *   GITHUB_TOKEN  — Personal access token with repo scope (or a fine-grained
 *                   token with Contents: write permission on the target repo).
 *   GITHUB_REPO   — Target repository in "owner/repo" format, e.g.
 *                   "taylormadeat/knowyourpit".
 *
 * What it does:
 *   1. Creates a local annotated git tag `build/<buildNumber>` pointing at the
 *      current HEAD (skips if the tag already exists).
 *   2. Pushes that tag to the GitHub remote via HTTPS, using an HTTP
 *      Authorization header (token never appears in the URL or argv).
 *   3. Creates a GitHub Release on the tag with the build metadata in the body
 *      (skips if a release already exists for the tag).
 *
 * If any step fails the script prints a clear warning and exits non-zero, but
 * it is designed to be called with `||` in shell so the caller can decide
 * whether to treat the failure as fatal.
 *
 * Security note: GITHUB_TOKEN is supplied to git via an environment variable
 * (GIT_CONFIG_KEY_0 / GIT_CONFIG_VALUE_0) so it never appears in argv,
 * process listings, or error message strings.
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, "../..");

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): {
  platform: string;
  buildNumber: string;
  version: string;
  easBuildId: string;
  dryRun: boolean;
} {
  const args = argv.slice(2);
  const get = (flag: string): string | undefined => {
    const idx = args.indexOf(flag);
    return idx !== -1 ? args[idx + 1] : undefined;
  };

  const platform = get("--platform");
  const buildNumber = get("--buildNumber");
  const version = get("--version");
  const easBuildId = get("--easBuildId") ?? "unknown";
  const dryRun = args.includes("--dry-run");

  if (!platform) {
    console.error("ERROR: --platform is required (e.g. --platform ios)");
    process.exit(2);
  }
  if (!buildNumber) {
    console.error("ERROR: --buildNumber is required (e.g. --buildNumber 106)");
    process.exit(2);
  }
  if (!version) {
    console.error("ERROR: --version is required (e.g. --version 1.0.11)");
    process.exit(2);
  }

  return { platform, buildNumber, version, easBuildId, dryRun };
}

// ---------------------------------------------------------------------------
// Env validation (also used by build:backup:check)
// ---------------------------------------------------------------------------

/**
 * Validate that GITHUB_TOKEN and GITHUB_REPO are set. Prints a formatted
 * status report. Returns true if all required vars are present, false otherwise.
 * When `exitOnMissing` is true (default), calls process.exit(2) on failure.
 */
export function validateBackupEnv(opts: { exitOnMissing?: boolean } = {}): boolean {
  const { exitOnMissing = true } = opts;
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPO;

  const tokenOk = Boolean(token && token.trim());
  const repoOk = Boolean(repo && repo.trim() && repo.includes("/"));

  console.log("GitHub Build Backup — environment check");
  console.log("─".repeat(42));
  console.log(
    `  GITHUB_TOKEN  ${tokenOk ? "✓ set" : "✗ NOT SET — required (repo scope or Contents: write)"}`,
  );
  console.log(
    `  GITHUB_REPO   ${repoOk ? `✓ ${repo}` : `✗ NOT SET — required (e.g. taylormadeat/knowyourpit)`}`,
  );
  console.log("─".repeat(42));

  if (tokenOk && repoOk) {
    console.log("  ✅ Ready — backup will run after each successful submission.");
    return true;
  }

  const missing = [
    !tokenOk && "GITHUB_TOKEN",
    !repoOk && "GITHUB_REPO",
  ]
    .filter(Boolean)
    .join(", ");

  console.error(
    `\n  ✗ Missing: ${missing}\n` +
      `  Set them in the Replit Secrets panel, then re-run this check.\n`,
  );

  if (exitOnMissing) {
    process.exit(2);
  }
  return false;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    console.error(
      `ERROR: ${name} is not set. Run:\n` +
        `  pnpm --filter @workspace/scripts run build:backup:check\n` +
        `to see what needs to be configured.`,
    );
    process.exit(2);
  }
  return val;
}

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function run(cmd: string, cwd: string = PROJECT_ROOT): string {
  const result = spawnSync(cmd, { shell: true, cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Command failed (exit ${result.status}): ${cmd}\n${result.stderr}`,
    );
  }
  return (result.stdout ?? "").trim();
}

function tagExists(tag: string): boolean {
  const result = spawnSync(`git tag -l "${tag}"`, {
    shell: true,
    cwd: PROJECT_ROOT,
    encoding: "utf8",
  });
  return (result.stdout ?? "").trim() === tag;
}

function currentCommitSha(): string {
  return run("git rev-parse HEAD");
}

/**
 * Push a git ref to GitHub using HTTP header authentication.
 * The token is supplied via git's GIT_CONFIG_KEY/VALUE mechanism so it
 * never appears in argv, the URL, or any logged command string.
 */
function pushTagToGitHub(
  repo: string,
  tagName: string,
  token: string,
): { stdout: string; stderr: string; status: number | null } {
  const remoteUrl = `https://github.com/${repo}.git`;
  const refSpec = `refs/tags/${tagName}:refs/tags/${tagName}`;

  const result = spawnSync("git", ["push", remoteUrl, refSpec], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      GIT_TERMINAL_PROMPT: "0",
      // Inject auth via HTTP header — avoids token in URL or argv
      GIT_CONFIG_COUNT: "1",
      GIT_CONFIG_KEY_0: "http.extraHeader",
      GIT_CONFIG_VALUE_0: `Authorization: Bearer ${token}`,
    },
  });

  return {
    stdout: result.stdout ?? "",
    // Sanitize stderr just-in-case, even though the token should never appear there
    stderr: (result.stderr ?? "").replace(
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
      "***",
    ),
    status: result.status,
  };
}

// ---------------------------------------------------------------------------
// GitHub REST API helpers (plain fetch, no extra dependency)
// ---------------------------------------------------------------------------

interface GHRelease {
  id: number;
  html_url: string;
  tag_name: string;
}

async function ghFetch(
  path: string,
  token: string,
  options: RequestInit = {},
): Promise<{ status: number; body: unknown }> {
  const url = `https://api.github.com${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function releaseExistsForTag(
  repo: string,
  tag: string,
  token: string,
): Promise<GHRelease | null> {
  const { status, body } = await ghFetch(
    `/repos/${repo}/releases/tags/${encodeURIComponent(tag)}`,
    token,
  );
  if (status === 200) return body as GHRelease;
  if (status === 404) return null;
  throw new Error(
    `Unexpected GitHub API status ${status} when checking release for tag ${tag}`,
  );
}

async function createRelease(
  repo: string,
  tag: string,
  title: string,
  body: string,
  token: string,
): Promise<GHRelease> {
  const { status, body: responseBody } = await ghFetch(
    `/repos/${repo}/releases`,
    token,
    {
      method: "POST",
      body: JSON.stringify({
        tag_name: tag,
        name: title,
        body,
        draft: false,
        prerelease: false,
      }),
    },
  );
  if (status === 201) return responseBody as GHRelease;
  throw new Error(
    `GitHub API returned ${status} when creating release:\n${JSON.stringify(responseBody, null, 2)}`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { platform, buildNumber, version, easBuildId, dryRun } = parseArgs(
    process.argv,
  );

  const token = requireEnv("GITHUB_TOKEN");
  const repo = requireEnv("GITHUB_REPO");

  const tagName = `build/${buildNumber}`;
  const releaseTitle = `v${version} (Build #${buildNumber})`;
  const timestamp = new Date().toISOString();
  const releaseBody = [
    `## Build metadata`,
    ``,
    `| Field | Value |`,
    `|-------|-------|`,
    `| **Platform** | ${platform} |`,
    `| **Version** | ${version} |`,
    `| **Build number** | ${buildNumber} |`,
    `| **EAS Build ID** | ${easBuildId} |`,
    `| **Tagged at** | ${timestamp} |`,
    ``,
    `> Automatically created by \`build:backup\` after a successful EAS submission.`,
  ].join("\n");

  console.log(`\n📦 knowyourpit GitHub Build Backup`);
  console.log(`   Tag:      ${tagName}`);
  console.log(`   Release:  ${releaseTitle}`);
  console.log(`   Repo:     ${repo}`);
  console.log(`   Platform: ${platform}`);
  console.log(`   EAS ID:   ${easBuildId}`);
  if (dryRun) {
    console.log(
      `\n🔍 DRY RUN — no git or GitHub API operations will be performed.\n`,
    );
  }

  // Step 1: Create the local git tag
  if (tagExists(tagName)) {
    console.log(`\n✓ Git tag ${tagName} already exists — skipping tag creation.`);
  } else {
    const sha = currentCommitSha();
    console.log(`\nCreating git tag ${tagName} at ${sha} ...`);
    if (!dryRun) {
      run(
        `git tag -a "${tagName}" -m "Build ${buildNumber} — v${version} (${platform})"`,
      );
      console.log(`✓ Tag ${tagName} created.`);
    } else {
      console.log(`  [dry-run] Would run: git tag -a "${tagName}" -m "..."`);
    }
  }

  // Step 2: Push the tag to the GitHub remote
  // Auth is injected via GIT_CONFIG_KEY_0/VALUE_0 (HTTP header) —
  // the token never appears in the URL or in any logged command string.
  console.log(`\nPushing tag ${tagName} to https://github.com/${repo}.git ...`);
  if (!dryRun) {
    const { stderr, status } = pushTagToGitHub(repo, tagName, token);
    if (status !== 0) {
      if (stderr.includes("already exists")) {
        console.log(`✓ Tag already exists on remote — skipping push.`);
      } else {
        throw new Error(`git push failed (exit ${status}):\n${stderr}`);
      }
    } else {
      console.log(`✓ Tag pushed to GitHub.`);
    }
  } else {
    console.log(
      `  [dry-run] Would push refs/tags/${tagName} to https://github.com/${repo}.git`,
    );
    console.log(`  (auth injected via HTTP header — token stays in env, not in URL)`);
  }

  // Step 3: Create the GitHub Release
  console.log(`\nCreating GitHub Release "${releaseTitle}" ...`);
  if (!dryRun) {
    const existing = await releaseExistsForTag(repo, tagName, token);
    if (existing) {
      console.log(
        `✓ Release already exists for ${tagName} — skipping creation.`,
      );
      console.log(`  ${existing.html_url}`);
    } else {
      const release = await createRelease(
        repo,
        tagName,
        releaseTitle,
        releaseBody,
        token,
      );
      console.log(`✓ GitHub Release created:`);
      console.log(`  ${release.html_url}`);
    }
  } else {
    console.log(`  [dry-run] Would create release:`);
    console.log(`    Title: ${releaseTitle}`);
    console.log(`    Tag:   ${tagName}`);
    console.log(`    Body preview:`);
    releaseBody.split("\n").forEach((line) => console.log(`      ${line}`));
  }

  console.log(`\n✅ GitHub backup complete.\n`);
}

// Only execute main() when this file is run directly, not when it is imported
// as a module (e.g. by githubBuildBackupCheck.ts importing validateBackupEnv).
const isMain =
  process.argv[1]?.endsWith("githubBuildBackup.ts") ||
  process.argv[1]?.endsWith("githubBuildBackup.js");

if (isMain) {
  main().catch((err: unknown) => {
    const message = (err as Error)?.message ?? String(err);
    console.error(`\n⚠️  GitHub backup failed: ${message}`);
    process.exit(1);
  });
}
