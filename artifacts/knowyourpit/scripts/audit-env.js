#!/usr/bin/env node
/**
 * Audits EXPO_PUBLIC_* usage in source code against ENV.md.
 *
 * Exits 0 when every variable found in code is documented in ENV.md.
 * Exits 1 and prints the undocumented names when any are missing.
 *
 * Run:  node scripts/audit-env.js
 * or:   pnpm --filter @workspace/knowyourpit run audit-env
 */

const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const envMdPath = path.join(projectRoot, "ENV.md");

const SCAN_DIRS = ["app", "hooks", "contexts", "components", "scripts"];
const SCAN_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".json"]);

// Dirs to skip entirely
const SKIP_DIRS = new Set(["node_modules", ".expo", "static-build"]);

function walkFiles(dir, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, results);
    } else if (SCAN_EXTENSIONS.has(path.extname(entry.name))) {
      results.push(full);
    }
  }
  return results;
}

function collectCodeVars() {
  const found = new Set();

  // Pattern 1: actual runtime reads — process.env.EXPO_PUBLIC_FOO
  const accessPattern = /process\.env\.(EXPO_PUBLIC_[A-Z0-9_]+)/g;

  // Pattern 2: env-object key assignments used in build.js / package.json
  // e.g.  EXPO_PUBLIC_DOMAIN: value  or  "EXPO_PUBLIC_DOMAIN": value
  const keyPattern = /["']?(EXPO_PUBLIC_[A-Z0-9_]+)["']?\s*:/g;

  const selfPath = path.resolve(__filename);
  const files = SCAN_DIRS.flatMap((d) =>
    walkFiles(path.join(projectRoot, d)),
  ).filter((f) => path.resolve(f) !== selfPath);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const m of content.matchAll(accessPattern)) found.add(m[1]);
    for (const m of content.matchAll(keyPattern)) found.add(m[1]);
  }

  return found;
}

function collectDocumentedVars() {
  const envMd = fs.readFileSync(envMdPath, "utf8");
  const pattern = /`(EXPO_PUBLIC_[A-Z0-9_]+)`/g;
  const found = new Set();
  for (const match of envMd.matchAll(pattern)) {
    found.add(match[1]);
  }
  return found;
}

function main() {
  console.log("Auditing EXPO_PUBLIC_* variables…\n");

  const codeVars = collectCodeVars();
  const docVars = collectDocumentedVars();

  const undocumented = [...codeVars].filter((v) => !docVars.has(v));
  const unusedDocs = [...docVars].filter((v) => !codeVars.has(v));

  console.log(`Found in code (${codeVars.size}):  ${[...codeVars].sort().join(", ")}`);
  console.log(`Found in ENV.md (${docVars.size}): ${[...docVars].sort().join(", ")}`);
  console.log();

  let exitCode = 0;

  if (undocumented.length > 0) {
    console.error("FAIL: Variables used in code but missing from ENV.md:");
    for (const v of undocumented.sort()) {
      console.error(`  - ${v}`);
    }
    console.error("\nAdd each missing variable to artifacts/knowyourpit/ENV.md.\n");
    exitCode = 1;
  } else {
    console.log("OK: All code-referenced variables are documented in ENV.md.");
  }

  if (unusedDocs.length > 0) {
    console.warn("\nWARN: Variables documented in ENV.md but not found in code:");
    for (const v of unusedDocs.sort()) {
      console.warn(`  - ${v}`);
    }
    console.warn(
      "\nConsider removing them from ENV.md if they are truly no longer used.\n",
    );
  }

  process.exit(exitCode);
}

main();
