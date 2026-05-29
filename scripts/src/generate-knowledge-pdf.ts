import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { marked } from "marked";
import puppeteer from "puppeteer-core";
import yaml from "js-yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../");

function requireFile(relPath: string): string {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath)) {
    console.error(`ERROR: Required source file missing: ${relPath}`);
    process.exit(1);
  }
  return fs.readFileSync(absPath, "utf8");
}

function requireDir(relPath: string): string {
  const absPath = path.join(ROOT, relPath);
  if (!fs.existsSync(absPath) || !fs.statSync(absPath).isDirectory()) {
    console.error(`ERROR: Required source directory missing: ${relPath}`);
    process.exit(1);
  }
  return absPath;
}

function extractSections(md: string, headings: string[]): string {
  const lines = md.split("\n");
  const result: string[] = [];
  let capturing = false;
  let capturingLevel = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const headingMatch = line.match(/^(#{1,6})\s+(.+)/);

    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      if (headings.some((h) => title.toLowerCase().includes(h.toLowerCase()))) {
        capturing = true;
        capturingLevel = level;
        result.push(line);
        continue;
      }
      if (capturing && level <= capturingLevel) {
        capturing = false;
      }
    }

    if (capturing) {
      result.push(line);
    }
  }

  return result.join("\n");
}

// ─── Database Schema ────────────────────────────────────────────────────────

interface ColumnDef {
  name: string;
  type: string;
  constraints: string;
}

/**
 * Extracts column definitions from a Drizzle ORM schema file.
 * Uses line-by-line parsing scoped to the pgTable body to robustly handle
 * multiline definitions, nested braces (jsonb defaults, index callbacks), and
 * enum columns.
 */
function parseSchemaFile(filePath: string): { tableName: string; columns: ColumnDef[] } | null {
  const content = fs.readFileSync(filePath, "utf8");

  // Find the pgTable call and its table name
  const tableNameMatch = content.match(/pgTable\(\s*["']([^"']+)["']/);
  if (!tableNameMatch) return null;
  const tableName = tableNameMatch[1];

  // Extract the column object body — scan forward from the pgTable call,
  // counting braces to find where the column definition block ends.
  const pgTableStart = content.indexOf("pgTable(");
  let depth = 0;
  let bodyStart = -1;
  let bodyEnd = -1;
  for (let i = pgTableStart; i < content.length; i++) {
    if (content[i] === "{") {
      depth++;
      if (depth === 1) bodyStart = i + 1;
    } else if (content[i] === "}") {
      depth--;
      if (depth === 0) {
        bodyEnd = i;
        break;
      }
    }
  }
  if (bodyStart === -1 || bodyEnd === -1) return null;

  const columnBlock = content.slice(bodyStart, bodyEnd);

  // Parse each line of the column block for column definitions.
  // A column definition starts with: `  colName: driverFn("sql_name", ...`
  const DRIVER_FNS = new Set([
    "serial", "text", "integer", "real", "boolean", "timestamp",
    "jsonb", "varchar", "bigint", "index", "uniqueIndex",
  ]);

  const columns: ColumnDef[] = [];
  const seen = new Set<string>();

  for (const line of columnBlock.split("\n")) {
    const trimmed = line.trim();
    // Match:  colName: driverFn( or colName: pgEnum( or colName: enumName(
    const m = trimmed.match(/^(\w+)\s*:\s*(\w+)\s*\(/);
    if (!m) continue;
    const [, jsName, driverFn] = m;
    if (seen.has(jsName)) continue;

    // Skip non-column helpers (index definitions in the third pgTable argument)
    if (driverFn === "index" || driverFn === "uniqueIndex") continue;
    seen.add(jsName);

    // Derive the SQL column name from the first string argument, fallback to jsName
    const sqlNameMatch = line.match(/\(\s*["']([^"']+)["']/);
    const sqlName = sqlNameMatch ? sqlNameMatch[1] : jsName;

    // Map driver function → human-readable type
    const typeMap: Record<string, string> = {
      serial: "serial (int, PK auto)",
      text: "text",
      integer: "integer",
      real: "real (float)",
      boolean: "boolean",
      timestamp: "timestamp (tz)",
      jsonb: "jsonb",
      varchar: "varchar",
      bigint: "bigint",
    };
    const type = DRIVER_FNS.has(driverFn) ? (typeMap[driverFn] ?? driverFn) : "enum";

    const constraints: string[] = [];
    if (line.includes(".primaryKey()")) constraints.push("PK");
    if (line.includes(".notNull()")) constraints.push("NOT NULL");
    if (line.includes(".default(") || line.includes(".defaultNow()")) constraints.push("default");
    if (line.includes(".references(")) constraints.push("FK");
    if (line.includes(".unique()")) constraints.push("unique");

    columns.push({ name: sqlName, type, constraints: constraints.join(", ") });
  }

  return { tableName, columns };
}

function buildSchemaSection(): string {
  const schemaDir = path.join(ROOT, "lib/db/src/schema");
  const indexContent = requireFile("lib/db/src/schema/index.ts");

  const exportedFiles = [...indexContent.matchAll(/from "\.\/([^"]+)"/g)].map(
    (m) => path.join(schemaDir, m[1] + ".ts")
  );

  let section = "# Database Schema\n\n";
  section +=
    "Extracted from Drizzle ORM schema files in `lib/db/src/schema/`. " +
    "Each table shows SQL column names, types, and constraints.\n\n";

  for (const filePath of exportedFiles) {
    if (!fs.existsSync(filePath)) {
      console.warn(`  WARN: schema file not found: ${filePath}`);
      continue;
    }
    const parsed = parseSchemaFile(filePath);
    if (!parsed || parsed.columns.length === 0) continue;

    section += `## Table: \`${parsed.tableName}\`\n\n`;
    section += "| Column | Type | Constraints |\n";
    section += "|--------|------|-------------|\n";
    for (const col of parsed.columns) {
      section += `| \`${col.name}\` | ${col.type} | ${col.constraints} |\n`;
    }
    section += "\n";
  }

  return section;
}

// ─── API Reference ───────────────────────────────────────────────────────────

type JsonSchema = {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  $ref?: string;
  description?: string;
  enum?: unknown[];
  items?: JsonSchema;
  additionalProperties?: JsonSchema;
  allOf?: JsonSchema[];
  oneOf?: JsonSchema[];
};

type ComponentsSchemas = Record<string, JsonSchema>;

/**
 * Resolve a $ref string like "#/components/schemas/Foo" to its schema object.
 */
function resolveRef(ref: string, schemas: ComponentsSchemas): JsonSchema | null {
  const parts = ref.replace(/^#\//, "").split("/");
  // Only handle /components/schemas/Name
  if (parts[0] !== "components" || parts[1] !== "schemas") return null;
  return schemas[parts[2]] ?? null;
}

/**
 * Dereference a schema, following one level of $ref if needed.
 */
function deref(schema: JsonSchema, schemas: ComponentsSchemas): JsonSchema {
  if (schema.$ref) {
    return resolveRef(schema.$ref, schemas) ?? schema;
  }
  return schema;
}

/**
 * Get the human-readable type string for a schema node.
 */
function schemaType(schema: JsonSchema): string {
  const t = schema.type;
  if (!t) {
    if (schema.$ref) return schema.$ref.split("/").pop() ?? "object";
    if (schema.enum) return `enum(${schema.enum.map(String).join("|")})`;
    if (schema.properties) return "object";
    if (schema.items) return "array";
    return "any";
  }
  if (Array.isArray(t)) {
    const nonNull = t.filter((x) => x !== "null");
    return nonNull.length === 1 ? `${nonNull[0]}?` : nonNull.join("|") + "?";
  }
  if (t === "array" && schema.items) {
    const items = schema.items;
    if (items.$ref) return `${items.$ref.split("/").pop()}[]`;
    return `${Array.isArray(items.type) ? items.type[0] : (items.type ?? "any")}[]`;
  }
  return String(t);
}

/**
 * Render the top-level properties of a schema as a Markdown table.
 * Follows one level of $ref for the schema itself, then lists properties.
 */
function renderSchemaTable(schema: JsonSchema, schemas: ComponentsSchemas, label: string): string {
  const resolved = deref(schema, schemas);
  const props = resolved.properties;
  if (!props || Object.keys(props).length === 0) {
    if (resolved.$ref) return `*${label}: see \`${resolved.$ref.split("/").pop()}\` schema*\n\n`;
    return "";
  }

  const required = new Set(resolved.required ?? []);
  let table = `**${label}**\n\n`;
  table += "| Field | Type | Required | Notes |\n";
  table += "|-------|------|:--------:|-------|\n";

  for (const [name, prop] of Object.entries(props)) {
    const propResolved = prop.$ref ? (deref(prop, schemas)) : prop;
    const type = schemaType(propResolved);
    const req = required.has(name) ? "✓" : "";
    const notes = propResolved.description ?? propResolved.enum ? (propResolved.description ?? `enum: ${(propResolved.enum ?? []).map(String).join(", ")}`) : "";
    table += `| \`${name}\` | ${type} | ${req} | ${notes.replace(/\|/g, "\\|")} |\n`;
  }
  return table + "\n";
}

interface OpenApiOp {
  summary?: string;
  operationId?: string;
  tags?: string[];
  description?: string;
  requestBody?: {
    content?: Record<string, { schema?: JsonSchema }>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: JsonSchema }>;
  }>;
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: { type?: string } }>;
}

interface OpenApiSpec {
  paths: Record<string, Record<string, OpenApiOp>>;
  components?: { schemas?: ComponentsSchemas };
}

function buildApiSection(): string {
  const specContent = requireFile("lib/api-spec/openapi.yaml");
  const spec = yaml.load(specContent) as OpenApiSpec;
  const schemas: ComponentsSchemas = spec.components?.schemas ?? {};

  let section = "# API Reference\n\n";
  section +=
    "All routes are prefixed with `/api`. Authenticated unless otherwise noted. " +
    "Request/response fields shown for the primary content type; `?` suffix means nullable.\n\n";

  const byTag: Record<string, string[]> = {};

  for (const [routePath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== "object" || !("summary" in op)) continue;
      const tag = op.tags?.[0] ?? "other";
      if (!byTag[tag]) byTag[tag] = [];

      let entry = `### \`${method.toUpperCase()} ${routePath}\`\n\n`;
      entry += `**${op.summary ?? op.operationId ?? ""}**\n\n`;
      if (op.description) entry += `${op.description}\n\n`;

      // Path and query parameters
      const pathParams = (op.parameters ?? []).filter((p) => p.in === "path");
      const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
      if (pathParams.length > 0) {
        entry += "**Path params:** " + pathParams.map((p) => `\`${p.name}\` (${p.schema?.type ?? "any"})`).join(", ") + "\n\n";
      }
      if (queryParams.length > 0) {
        entry += "**Query params:** " + queryParams.map((p) => `\`${p.name}\``).join(", ") + "\n\n";
      }

      // Request body — pick the first content type (usually application/json)
      const reqContent = op.requestBody?.content;
      if (reqContent) {
        const [contentType, mediaObj] = Object.entries(reqContent)[0] ?? [];
        if (mediaObj?.schema) {
          const schema = mediaObj.schema;
          const resolved = schema.$ref ? (resolveRef(schema.$ref, schemas) ?? schema) : schema;
          const name = schema.$ref ? schema.$ref.split("/").pop()! : "Request Body";
          entry += renderSchemaTable(resolved, schemas, `Request body${contentType !== "application/json" ? ` (${contentType})` : ""}: ${name}`);
        }
      }

      // Responses — show structure for 200/201; list status codes for others
      const responses = Object.entries(op.responses ?? {});
      const successResponse = responses.find(([code]) => code === "200" || code === "201");
      const otherResponses = responses.filter(([code]) => code !== "200" && code !== "201");

      if (successResponse) {
        const [code, r] = successResponse;
        const resContent = r.content;
        if (resContent) {
          const [, mediaObj] = Object.entries(resContent)[0] ?? [];
          if (mediaObj?.schema) {
            const schema = mediaObj.schema;
            // For array responses, unwrap the items schema
            let targetSchema = schema.$ref ? (resolveRef(schema.$ref, schemas) ?? schema) : schema;
            let label = `Response ${code}`;
            if (schema.type === "array" && schema.items) {
              const itemsSchema = schema.items.$ref
                ? (resolveRef(schema.items.$ref, schemas) ?? schema.items)
                : schema.items;
              label += ` (array of ${schema.items.$ref?.split("/").pop() ?? "items"})`;
              targetSchema = itemsSchema;
            } else if (schema.$ref) {
              label += `: ${schema.$ref.split("/").pop()}`;
            }
            const rendered = renderSchemaTable(targetSchema, schemas, label);
            if (rendered) entry += rendered;
            else entry += `**Response ${code}:** ${r.description ?? ""}\n\n`;
          } else {
            entry += `**Response ${code}:** ${r.description ?? ""}\n\n`;
          }
        } else {
          entry += `**Response ${code}:** ${r.description ?? ""}\n\n`;
        }
      }

      if (otherResponses.length > 0) {
        entry += "**Other responses:** " + otherResponses.map(([code, r]) => `${code} — ${r.description ?? ""}`).join(" | ") + "\n\n";
      }

      byTag[tag].push(entry);
    }
  }

  for (const [tag, entries] of Object.entries(byTag).sort()) {
    section += `## ${tag.charAt(0).toUpperCase() + tag.slice(1)}\n\n`;
    section += entries.join("");
  }

  return section;
}

// ─── Mobile Screen Map ────────────────────────────────────────────────────────

function describeScreen(filePath: string, appDir: string): string {
  const rel = path.relative(appDir, filePath);
  const parts = rel.split("/");
  const filename = parts[parts.length - 1].replace(/\.tsx$/, "");

  const routeParts = parts.map((p) => {
    if (p === "_layout.tsx" || p === "_layout") return null;
    if (p.startsWith("+")) return p.replace(/\.tsx$/, "");
    p = p.replace(/\.tsx$/, "");
    if (p.startsWith("(") && p.endsWith(")")) return `[${p.slice(1, -1)}]`;
    return p;
  });

  const routePath = "/" + routeParts.filter(Boolean).join("/");

  const descriptions: Record<string, string> = {
    "index": "Home dashboard — active cooks overview and quick actions",
    "sign-in": "Authentication — email/password and social sign-in",
    "sign-up": "Authentication — new account registration with email verification",
    "set-username": "Authentication — choose username after OAuth sign-up",
    "alerts": "Temperature alerts — list, create, and manage cook alerts",
    "ble-diagnostics": "BLE diagnostics — Bluetooth device inspection and debug info",
    "devices": "Devices — manage connected temperature probe devices (MEATER, Inkbird, etc.)",
    "grills": "Grill profiles — list, create, and manage grill configurations",
    "profile": "User profile — account details, stats, and settings",
    "pro-features": "Pro features — RevenueCat paywall and subscription management",
    "temperature": "Temperature — upload and browse historical temperature readings",
    "log": "Cook logger — create a new cook session with food type, weight, temps",
    "[id]": "Cook detail — full cook record with timeline, check-ins, events, and photos",
    "[sessionId]": "Multi-cook session — view all cooks in a session grouped together",
    "ai": "AI assistant — natural language BBQ guidance chat",
    "cooks": "Cook history — list of all past and active cook sessions",
    "more": "More tab — settings, profile, help, and account management",
    "plan": "Plan tab — frozen meat planning and cook time prediction",
    "+not-found": "404 screen — unmatched routes",
    "(onboarding)/index": "Onboarding — first-launch welcome modal",
  };

  const key = rel.replace(/\.tsx$/, "");
  const desc = descriptions[filename] ?? descriptions[key] ?? `Screen for ${filename.replace(/-/g, " ")}`;

  return `| \`${routePath}\` | \`${rel}\` | ${desc} |`;
}

function buildMobileScreenSection(): string {
  const appDir = requireDir("artifacts/knowyourpit/app");

  const screenFiles: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
      } else if (entry.name.endsWith(".tsx") && !entry.name.startsWith("_layout")) {
        screenFiles.push(path.join(dir, entry.name));
      }
    }
  }
  walk(appDir);
  screenFiles.sort();

  let section = "# Mobile Screen Map\n\n";
  section += "All screens in `artifacts/knowyourpit/app/`. Layout files are excluded.\n\n";
  section += "| Route | File | Description |\n";
  section += "|-------|------|-------------|\n";
  for (const f of screenFiles) {
    section += describeScreen(f, appDir) + "\n";
  }
  section += "\n";
  return section;
}

// ─── API Server Routes ────────────────────────────────────────────────────────

const ROUTE_DESCRIPTIONS: Record<string, string> = {
  "admin.ts": "Admin utilities and internal operations",
  "ai/bbqKnowledge.ts": "BBQ knowledge base lookup used by AI prompts",
  "ai/chat.ts": "AI chat — streaming and non-streaming message handling",
  "ai/index.ts": "AI router — mounts chat, predict, multi-cook sub-routes",
  "ai/insights.ts": "AI-generated cook insights and PitMaster analysis",
  "ai/meatBaselines.ts": "Meat baseline data and cook time reference tables",
  "ai/multiCook.ts": "Multi-cook sequencing — schedules parallel cooks for same serve time",
  "ai/predict.ts": "Cook time prediction using grill fingerprint + meat baselines",
  "ai/shared.ts": "Shared AI helpers (prompt builders, context assembly)",
  "alerts.ts": "Temperature alert CRUD — create, update, delete, trigger",
  "contact.ts": "Contact form submission (rate-limited, no auth required)",
  "conversations.ts": "AI conversation history — list, rename, delete",
  "cookCheckins.ts": "Cook check-in records, schedule, and auto-checkin support",
  "cookEvents.ts": "Quick-log cook events (spritz, mop, flare-up, fuel, etc.)",
  "cookPhotos.ts": "Cook photo upload and deletion (object storage, max 10 photos)",
  "cooks.ts": "Cook session CRUD, health scoring, and status management",
  "customMeatCuts.ts": "User-defined custom meat cut definitions",
  "dashboard.ts": "Dashboard summary, recent cooks, aggregated temperature history",
  "grills.ts": "Grill profile CRUD, fingerprint, insights, temperature history",
  "health.ts": "Health check endpoint (/api/healthz)",
  "index.ts": "Root router — mounts all sub-routers under /api",
  "liveActivities.ts": "iOS Live Activity push token registration and teardown",
  "meater.ts": "MEATER Cloud integration — link, unlink, status, live readings",
  "paywall.ts": "RevenueCat webhook receiver and subscription entitlement sync",
  "profile.ts": "User profile fetch and full account deletion (Apple compliance)",
  "temperature/analyzePrompt.ts": "AI prompt builder for temperature image analysis",
  "temperature/analyze.ts": "Analyze cook images + notes into a cook timeline",
  "temperature/index.ts": "Temperature router — mounts scan, upload, readings sub-routes",
  "temperature/manual.ts": "Manual temperature reading upload and retrieval",
  "temperature/scan.ts": "AI vision scan of thermometer screenshots for readings",
  "temperature/shared.ts": "Shared temperature helpers (parsers, validators)",
  "thermoworks.ts": "ThermoWorks Cloud integration — link, unlink, status, live readings",
  "webhooks.ts": "Inbound webhook dispatcher (RevenueCat, future integrations)",
};

function buildApiServerRoutesSection(): string {
  const routesDir = requireDir("artifacts/api-server/src/routes");

  // Recursively collect all .ts files
  const files: string[] = [];
  function walk(dir: string, base: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), rel);
      } else if (entry.name.endsWith(".ts")) {
        files.push(rel);
      }
    }
  }
  walk(routesDir, "");
  files.sort();

  let section = "# API Server Routes\n\n";
  section += "All TypeScript route modules under `artifacts/api-server/src/routes/` (recursive).\n\n";
  section += "| File | Resource / Purpose |\n";
  section += "|------|--------------------|\n";
  for (const file of files) {
    const desc = ROUTE_DESCRIPTIONS[file] ?? file.replace(/\.ts$/, "").replace(/\//g, " › ");
    section += `| \`${file}\` | ${desc} |\n`;
  }
  section += "\n";
  return section;
}

// ─── Conventions section ──────────────────────────────────────────────────────

function buildConventionsSection(replitMd: string): string {
  const sections = extractSections(replitMd, ["User Preferences", "Mobile UI Conventions"]);
  return "# Conventions & Preferences\n\nQuick-reference extracted from `replit.md`.\n\n" + sections + "\n";
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    font-size: 13px;
    line-height: 1.6;
    color: #1a1a1a;
    padding: 40px 48px;
    max-width: 960px;
    margin: 0 auto;
  }
  h1 {
    font-size: 26px;
    font-weight: 700;
    color: #111;
    border-bottom: 3px solid #e25c00;
    padding-bottom: 10px;
    margin-top: 48px;
    margin-bottom: 20px;
    page-break-before: always;
  }
  h1:first-of-type { page-break-before: avoid; }
  h2 {
    font-size: 18px;
    font-weight: 700;
    color: #222;
    margin-top: 32px;
    margin-bottom: 12px;
    border-bottom: 1px solid #ddd;
    padding-bottom: 4px;
  }
  h3 {
    font-size: 14px;
    font-weight: 700;
    color: #333;
    margin-top: 20px;
    margin-bottom: 8px;
  }
  h4 { font-size: 13px; font-weight: 700; color: #444; margin-top: 14px; margin-bottom: 6px; }
  p { margin-bottom: 10px; }
  ul, ol { margin-left: 20px; margin-bottom: 10px; }
  li { margin-bottom: 3px; }
  code {
    font-family: "SF Mono", Menlo, Consolas, "Courier New", monospace;
    font-size: 11.5px;
    background: #f5f5f5;
    border: 1px solid #e0e0e0;
    border-radius: 3px;
    padding: 1px 4px;
  }
  pre {
    background: #f8f8f8;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 12px 14px;
    overflow-x: auto;
    margin-bottom: 12px;
    font-family: "SF Mono", Menlo, Consolas, "Courier New", monospace;
    font-size: 11px;
    line-height: 1.5;
  }
  pre code { background: none; border: none; padding: 0; font-size: inherit; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
    font-size: 12px;
  }
  th {
    background: #f0f0f0;
    font-weight: 700;
    text-align: left;
    padding: 6px 10px;
    border: 1px solid #ccc;
    color: #111;
  }
  td {
    padding: 5px 10px;
    border: 1px solid #ddd;
    vertical-align: top;
  }
  tr:nth-child(even) td { background: #fafafa; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  a { color: #0066cc; text-decoration: none; }
  blockquote {
    border-left: 3px solid #e25c00;
    padding-left: 12px;
    color: #555;
    margin: 10px 0;
  }
  .toc { background: #fdf6f0; border: 1px solid #f0d8c4; border-radius: 6px; padding: 20px 24px; margin-bottom: 32px; }
  .toc h2 { border: none; margin-top: 0; font-size: 16px; color: #e25c00; }
  .toc ol { margin-left: 18px; }
  .toc li { margin-bottom: 6px; font-size: 13px; }
  .cover { text-align: center; padding: 80px 0 60px; }
  .cover h1 { font-size: 36px; border: none; page-break-before: avoid; color: #e25c00; margin-bottom: 12px; }
  .cover .subtitle { font-size: 16px; color: #666; margin-bottom: 8px; }
  .cover .date { font-size: 13px; color: #999; }
`;

function buildToc(sections: string[]): string {
  let toc = '<div class="toc"><h2>Table of Contents</h2><ol>\n';
  for (const s of sections) {
    toc += `  <li>${s}</li>\n`;
  }
  toc += "</ol></div>\n";
  return toc;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("📄 Assembling knowyourpit knowledge document…");

  const replitMd = requireFile("replit.md");
  requireFile("lib/api-spec/openapi.yaml");
  requireFile("lib/db/src/schema/index.ts");
  requireFile("artifacts/knowyourpit/ENV.md");
  requireDir("artifacts/api-server/src/routes");
  requireDir("artifacts/knowyourpit/app");

  const sectionDefs = [
    { title: "Project Overview", content: "# Project Overview\n\n" + replitMd },
    { title: "Database Schema", content: buildSchemaSection() },
    { title: "API Reference", content: buildApiSection() },
    { title: "Mobile Screen Map", content: buildMobileScreenSection() },
    { title: "API Server Routes", content: buildApiServerRoutesSection() },
    { title: "Environment Variables", content: "# Environment Variables\n\n" + requireFile("artifacts/knowyourpit/ENV.md") },
    { title: "Conventions & Preferences", content: buildConventionsSection(replitMd) },
  ];

  const fullMarkdown = sectionDefs.map((s) => s.content).join("\n---\n\n");

  console.log("🔄 Converting Markdown → HTML…");
  const bodyHtml = await marked(fullMarkdown);

  const tocHtml = buildToc(sectionDefs.map((s) => s.title));

  const coverHtml = `
<div class="cover">
  <h1>knowyourpit</h1>
  <div class="subtitle">App Knowledge Document — Agent Handoff Reference</div>
  <div class="date">Generated ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
</div>
`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>knowyourpit Knowledge Document</title>
  <style>${CSS}</style>
</head>
<body>
${coverHtml}
${tocHtml}
${bodyHtml}
</body>
</html>`;

  const outputDir = path.join(__dirname, "../output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "knowyourpit-knowledge.pdf");

  console.log("🌐 Launching headless browser…");

  // @sparticuz/chromium extracts a Lambda-compatible Chrome binary to /tmp/chromium.
  // It needs NSS/NSPR from the Nix store — only the 64-bit (x86_64) builds work.
  // These specific paths are present in the Replit workspace's Nix store.
  const sparticuzBin = "/tmp/chromium";
  const nixNssLibs = [
    "/nix/store/ir5552g7jpszyn7kdi7ik5kjdqs51akf-nss-3.53.1/lib",
    "/nix/store/1wx9nkcxavkfc01wg4qzqyd3710yvgf0-nspr-4.34/lib",
    "/nix/store/5fwzvgxz3m51ki35i6cl762nyz5fbxcf-nspr-4.35/lib",
    "/nix/store/8a651pfg6s4z27j274baqqb57pp34jkf-nspr-4.35/lib",
  ].filter(fs.existsSync);

  const CHROME_CANDIDATES = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    sparticuzBin,
    path.join(os.homedir(), ".cache/puppeteer/chrome/linux-149.0.7827.22/chrome-linux64/chrome"),
    path.join(os.homedir(), ".cache/puppeteer/chrome-headless-shell/linux-149.0.7827.22/chrome-headless-shell-linux64/chrome-headless-shell"),
    "/usr/bin/google-chrome-stable",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
  ].filter(Boolean) as string[];

  let executablePath: string | undefined;
  for (const p of CHROME_CANDIDATES) {
    if (fs.existsSync(p)) {
      executablePath = p;
      console.log(`   Using Chrome at: ${p}`);
      break;
    }
  }

  if (!executablePath) {
    console.error(
      "ERROR: No usable Chrome/Chromium binary found.\n" +
      "Import @sparticuz/chromium to extract the binary:\n" +
      "  node -e \"import('@sparticuz/chromium').then(m => m.default.executablePath()).then(console.log)\"\n" +
      "Then re-run the script."
    );
    process.exit(1);
  }

  // Set LD_LIBRARY_PATH so Chrome can find NSS/NSPR (not included in the Nix default path)
  if (nixNssLibs.length > 0) {
    const currentLd = process.env.LD_LIBRARY_PATH ?? "";
    process.env.LD_LIBRARY_PATH = [...nixNssLibs, currentLd].filter(Boolean).join(":");
    console.log(`   LD_LIBRARY_PATH set for NSS/NSPR`);
  }

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "domcontentloaded" });

    await page.pdf({
      path: outputPath,
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;padding-top:6px;">knowyourpit — App Knowledge Document</div>`,
      footerTemplate: `<div style="font-size:9px;color:#999;width:100%;text-align:center;padding-bottom:6px;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`,
    });
  } finally {
    await browser.close();
  }

  const stats = fs.statSync(outputPath);
  const sizeKb = Math.round(stats.size / 1024);
  console.log(`\n✅ PDF written to: ${outputPath}`);
  console.log(`   Size: ${sizeKb} KB`);

  if (sizeKb < 50) {
    console.warn("\n⚠️  WARNING: Output file is under 50 KB — content may be incomplete. Check the HTML assembly step.");
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
