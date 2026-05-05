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
  if (prevBytes !== null) {
    const diff = bytes - prevBytes;
    const sign = diff >= 0 ? "+" : "-";
    deltaStr = sign + humanSize(Math.abs(diff));
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
}

main();
