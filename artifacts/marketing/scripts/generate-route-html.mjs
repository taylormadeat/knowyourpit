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
  const dest = join(distDir, `${route}.html`);
  copyFileSync(src, dest);
  console.log(`  copied index.html → ${route}.html`);
}

console.log("Route HTML generation complete.");
