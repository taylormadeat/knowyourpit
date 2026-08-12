/**
 * Post-build: copy index.html to a static file for every SPA route so the
 * Replit static server can serve them without a client-side fallback.
 *
 * e.g.  /privacy  →  dist/public/privacy.html
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist", "public");
const src = join(distDir, "index.html");

const routes = ["features", "privacy", "terms", "support"];

for (const route of routes) {
  // flat file: privacy.html (for servers that strip extensions)
  const flatDest = join(distDir, `${route}.html`);
  copyFileSync(src, flatDest);
  console.log(`  copied index.html → ${route}.html`);

  // directory index: privacy/index.html (for servers that don't)
  const dir = join(distDir, route);
  mkdirSync(dir, { recursive: true });
  const dirDest = join(dir, "index.html");
  copyFileSync(src, dirDest);
  console.log(`  copied index.html → ${route}/index.html`);
}

console.log("Route HTML generation complete.");
