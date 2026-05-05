#!/usr/bin/env node
/**
 * measure-archive-size.js
 *
 * Estimates the EAS upload archive size by walking the project tree and
 * excluding files/directories that match patterns in .gitignore and
 * .easignore — mirroring what EAS does when packaging the source archive.
 *
 * On each run the result is appended as a new row to BUILD_SIZE_LOG.md so
 * you can spot size regressions across builds at a glance. Commit
 * BUILD_SIZE_LOG.md to git after each EAS build to preserve the history.
 *
 * ─── THRESHOLD WARNING (blocking pre-build check) ────────────────────────
 *
 * Pass --warn-threshold to make the script exit non-zero when the archive
 * has grown beyond a set amount. Supported formats:
 *
 *   --warn-threshold 10%     → fail if growth > 10 % of the previous size
 *   --warn-threshold 500KB   → fail if growth > 500 KB  (case-insensitive)
 *   --warn-threshold 2MB     → fail if growth > 2 MB
 *   --warn-threshold 1GB     → fail if growth > 1 GB
 *
 * Wiring it as a blocking EAS pre-build step (eas.json):
 *
 *   "prebuildCommand": "node scripts/measure-archive-size.js --warn-threshold 10%"
 *
 * EAS aborts the build when prebuildCommand exits with a non-zero code, so
 * the team is alerted before the slow cloud build even starts.
 *
 * You can also use it in a local wrapper or CI pipeline:
 *
 *   node scripts/measure-archive-size.js --warn-threshold 500KB || exit 1
 *
 * ─── AUTOMATIC (EAS prebuildCommand) ─────────────────────────────────────
 *
 * Every build profile in eas.json sets:
 *   "prebuildCommand": "node scripts/measure-archive-size.js"
 *
 * EAS runs prebuildCommand before expo prebuild on every remote build job,
 * so the measurement is enforced automatically for every CI build. Output
 * appears in the EAS build log visible in the Expo dashboard.
 *
 * ─── LOCAL WRAPPER SCRIPTS ────────────────────────────────────────────────
 *
 * Use these wrappers locally so BUILD_SIZE_LOG.md is updated and committed
 * to git alongside your source change (git history = size history):
 *
 *   pnpm run eas:build:ios       — measure → eas build --platform ios
 *   pnpm run eas:build:android   — measure → eas build --platform android
 *   pnpm run eas:build:all       — measure → eas build --platform all
 *   pnpm run eas:build:preview   — measure → eas build --profile preview
 *
 * ─── STANDALONE ───────────────────────────────────────────────────────────
 *
 *   node scripts/measure-archive-size.js
 *   node scripts/measure-archive-size.js --warn-threshold 10%
 *   pnpm run measure-archive-size
 *
 * ──────────────────────────────────────────────────────────────────────────
 */

"use strict";

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const logPath = path.join(projectRoot, "BUILD_SIZE_LOG.md");

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse --warn-threshold <value> from process.argv.
 * Returns an object { raw, type, value } or null if not supplied.
 *
 *   type "percent"  → value is a number (e.g. 10 for 10 %)
 *   type "bytes"    → value is a number of bytes (e.g. 524288 for 512 KB)
 */
function parseWarnThreshold(argv) {
  const idx = argv.indexOf("--warn-threshold");
  if (idx === -1) return null;

  const raw = argv[idx + 1];
  if (!raw) {
    console.error("ERROR: --warn-threshold requires a value (e.g. 10% or 500KB)");
    process.exit(1);
  }

  // Percentage: ends with %
  const pctMatch = raw.match(/^(\d+(?:\.\d+)?)%$/i);
  if (pctMatch) {
    const value = parseFloat(pctMatch[1]);
    if (isNaN(value) || value <= 0) {
      console.error(`ERROR: Invalid --warn-threshold percentage: "${raw}"`);
      process.exit(1);
    }
    return { raw, type: "percent", value };
  }

  // Absolute size: number + unit (B, KB, MB, GB)
  const sizeMatch = raw.match(/^(\d+(?:\.\d+)?)(B|KB|MB|GB)$/i);
  if (sizeMatch) {
    const num = parseFloat(sizeMatch[1]);
    const unit = sizeMatch[2].toUpperCase();
    const multipliers = { B: 1, KB: 1024, MB: 1024 ** 2, GB: 1024 ** 3 };
    const value = num * multipliers[unit];
    if (isNaN(value) || value <= 0) {
      console.error(`ERROR: Invalid --warn-threshold size: "${raw}"`);
      process.exit(1);
    }
    return { raw, type: "bytes", value };
  }

  console.error(
    `ERROR: Unrecognised --warn-threshold format: "${raw}"\n` +
      `       Expected a percentage (e.g. 10%) or a size (e.g. 500KB, 2MB, 1GB)`
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Pattern parsing — gitignore / easignore syntax
// ---------------------------------------------------------------------------

/**
 * Read ignore files and return an array of raw pattern strings.
 * Skips blank lines and comment lines.
 */
function readIgnoreFile(filePath) {
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));
}

/**
 * Compile a single gitignore-style pattern into a test function.
 * Returns { test(relPath, isDir): boolean, negated: boolean }.
 *
 * Rules implemented:
 *   - Leading "!" → negation
 *   - Trailing "/" → directory-only match
 *   - Pattern contains "/" (other than trailing) → anchored to project root
 *   - "**" → match any path segment sequence
 *   - "*"  → match any chars within a single segment
 *   - "?"  → match one char within a single segment
 */
function compilePattern(raw) {
  let p = raw;
  const negated = p.startsWith("!");
  if (negated) p = p.slice(1);

  const dirOnly = p.endsWith("/");
  if (dirOnly) p = p.slice(0, -1);

  // Anchored if the pattern has an interior slash
  const anchored = p.includes("/");

  // Build regex from glob pattern
  const reStr = globToRegex(p, anchored);
  const re = new RegExp(reStr);

  return {
    negated,
    test(relPath, isDir) {
      if (dirOnly && !isDir) return false;
      const candidate = isDir ? relPath + "/" : relPath;
      return re.test(candidate) || re.test(relPath);
    },
  };
}

function globToRegex(pattern, anchored) {
  // Escape all regex special chars except our glob wildcards
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === "*" && pattern[i + 1] === "*") {
      // "**" — match any sequence including slashes
      re += ".*";
      i++; // skip second *
      // skip adjacent slash if present
      if (pattern[i + 1] === "/") i++;
    } else if (ch === "*") {
      re += "[^/]*";
    } else if (ch === "?") {
      re += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += "\\" + ch;
    } else {
      re += ch;
    }
  }

  if (anchored) {
    return "^" + re + "(/.*)?$";
  }
  // Non-anchored: match anywhere in path (full segment or root)
  return "(^|.*?/)" + re + "(/.*)?$";
}

// ---------------------------------------------------------------------------
// Directory walker
// ---------------------------------------------------------------------------

/**
 * Walk `dir` recursively, skipping anything matched by the compiled patterns.
 * Returns { bytes, files }.
 */
function walk(dir, relBase, compiled) {
  let bytes = 0;
  let files = 0;

  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return { bytes: 0, files: 0 };
  }

  for (const entry of entries) {
    const rel = relBase ? relBase + "/" + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    const isDir = entry.isDirectory();

    if (isIgnored(rel, isDir, compiled)) continue;

    if (isDir) {
      const sub = walk(full, rel, compiled);
      bytes += sub.bytes;
      files += sub.files;
    } else if (entry.isFile()) {
      try {
        bytes += fs.statSync(full).size;
        files++;
      } catch {
        // skip unreadable files
      }
    }
  }

  return { bytes, files };
}

function isIgnored(rel, isDir, compiled) {
  let ignored = false;
  for (const p of compiled) {
    if (p.test(rel, isDir)) {
      ignored = !p.negated;
    }
  }
  return ignored;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function humanSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 ** 2) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(2) + " MB";
  return (bytes / 1024 ** 3).toFixed(2) + " GB";
}

function readAppVersion() {
  try {
    const appJson = JSON.parse(
      fs.readFileSync(path.join(projectRoot, "app.json"), "utf-8")
    );
    const expo = appJson.expo || {};
    return {
      version: expo.version || "?",
      build: expo.ios?.buildNumber || expo.android?.versionCode || "?",
    };
  } catch {
    return { version: "?", build: "?" };
  }
}

function parsePreviousBytes(logContent) {
  const rows = logContent
    .split("\n")
    .filter((l) => l.startsWith("|") && !l.includes("Date") && !l.includes("---"));
  if (rows.length === 0) return null;
  const last = rows[rows.length - 1];
  const cols = last.split("|").map((c) => c.trim());
  // cols[0] is empty, cols[6] is Bytes
  const val = parseInt(cols[6], 10);
  return isNaN(val) ? null : val;
}

/**
 * Check whether the byte delta exceeds the configured threshold.
 * Returns { exceeded: boolean, message: string } when prevBytes is available,
 * or { exceeded: false, message: "" } when there is no previous measurement.
 */
function checkThreshold(threshold, diffBytes, prevBytes) {
  if (prevBytes === null || diffBytes <= 0) {
    return { exceeded: false, message: "" };
  }

  let exceeded = false;
  let limitDesc = "";

  if (threshold.type === "percent") {
    const pct = (diffBytes / prevBytes) * 100;
    exceeded = pct > threshold.value;
    limitDesc = `${threshold.value}% (${pct.toFixed(2)}% growth = +${humanSize(diffBytes)})`;
  } else {
    exceeded = diffBytes > threshold.value;
    limitDesc = `${humanSize(threshold.value)} (actual growth = +${humanSize(diffBytes)})`;
  }

  if (!exceeded) return { exceeded: false, message: "" };

  const message =
    `\n⚠️  ARCHIVE SIZE WARNING — threshold exceeded!\n` +
    `   Threshold : ${threshold.raw}\n` +
    `   Limit     : ${limitDesc}\n` +
    `   Previous  : ${humanSize(prevBytes)}\n` +
    `   Current   : ${humanSize(prevBytes + diffBytes)}\n` +
    `\n` +
    `   The archive has grown beyond the configured limit.\n` +
    `   Investigate what was added before submitting an EAS build.\n` +
    `   To override, remove --warn-threshold from your prebuildCommand.\n`;

  return { exceeded: true, message };
}

const LOG_HEADER = `# EAS Archive Size Log

Tracks the estimated EAS upload archive size before each build.
Generated by \`scripts/measure-archive-size.js\` — run \`pnpm run measure-archive-size\` before each EAS build.

| Date & Time (UTC) | App Version | Build # | Archive Size | File Count | Bytes | Delta |
|---|---|---|---|---|---|---|
`;

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const threshold = parseWarnThreshold(process.argv);

  // EAS uses .easignore when present; .gitignore is only the fallback.
  // Mirror that precedence so the size estimate matches what EAS actually uploads.
  const easIgnorePath = path.join(projectRoot, ".easignore");
  const gitIgnorePath = path.join(projectRoot, ".gitignore");

  let patterns;
  let sourceLabel;
  if (fs.existsSync(easIgnorePath)) {
    patterns = readIgnoreFile(easIgnorePath);
    sourceLabel = ".easignore";
  } else {
    patterns = readIgnoreFile(gitIgnorePath);
    sourceLabel = ".gitignore (no .easignore found)";
  }

  const compiled = patterns.map(compilePattern);

  console.log(
    `Scanning project (${patterns.length} ignore patterns from ${sourceLabel})...`
  );
  if (threshold) {
    console.log(`  Warn threshold: ${threshold.raw}`);
  }

  const { bytes, files } = walk(projectRoot, "", compiled);
  const sizeStr = humanSize(bytes);
  const { version, build } = readAppVersion();

  const now = new Date();
  const dateStr = now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");

  // Read existing log (if any) to compute delta
  let existingContent = "";
  if (fs.existsSync(logPath)) {
    existingContent = fs.readFileSync(logPath, "utf-8");
  }

  const prevBytes = parsePreviousBytes(existingContent);
  let deltaStr = "—";
  let diffBytes = 0;
  if (prevBytes !== null) {
    diffBytes = bytes - prevBytes;
    const sign = diffBytes >= 0 ? "+" : "-";
    deltaStr = sign + humanSize(Math.abs(diffBytes));
  }

  const row = `| ${dateStr} | ${version} | ${build} | ${sizeStr} | ${files} | ${bytes} | ${deltaStr} |`;

  if (!existingContent) {
    fs.writeFileSync(logPath, LOG_HEADER + row + "\n", "utf-8");
    console.log(`Created ${logPath}`);
  } else {
    fs.appendFileSync(logPath, row + "\n", "utf-8");
    console.log(`Appended entry to ${logPath}`);
  }

  console.log();
  console.log(`  Archive size : ${sizeStr}`);
  console.log(`  File count   : ${files}`);
  console.log(`  Raw bytes    : ${bytes}`);
  if (prevBytes !== null) {
    console.log(`  Delta        : ${deltaStr} vs previous entry`);
  }
  console.log(`  App version  : ${version} (build ${build})`);
  console.log();
  console.log(`Run this script again before your next EAS build to compare sizes.`);

  // Threshold check — must happen after the log is written so the entry is
  // always recorded even when the check fails.
  if (threshold && prevBytes !== null) {
    const { exceeded, message } = checkThreshold(threshold, diffBytes, prevBytes);
    if (exceeded) {
      console.error(message);
      process.exit(1);
    }
  }
}

main();
