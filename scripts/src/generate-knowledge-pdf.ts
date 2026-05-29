import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
// pdfkit ships CommonJS; tsx handles the interop
import PDFDocument from "pdfkit";

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

// ─── Database Schema ─────────────────────────────────────────────────────────

interface ColumnDef {
  name: string;
  type: string;
  constraints: string;
}

function parseSchemaFile(filePath: string): { tableName: string; columns: ColumnDef[] } | null {
  const content = fs.readFileSync(filePath, "utf8");
  const tableNameMatch = content.match(/pgTable\(\s*["']([^"']+)["']/);
  if (!tableNameMatch) return null;
  const tableName = tableNameMatch[1];

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
      if (depth === 0) { bodyEnd = i; break; }
    }
  }
  if (bodyStart === -1 || bodyEnd === -1) return null;

  const columnBlock = content.slice(bodyStart, bodyEnd);
  const DRIVER_FNS = new Set([
    "serial", "text", "integer", "real", "boolean", "timestamp",
    "jsonb", "varchar", "bigint", "index", "uniqueIndex",
  ]);

  const columns: ColumnDef[] = [];
  const seen = new Set<string>();

  for (const line of columnBlock.split("\n")) {
    const trimmed = line.trim();
    const m = trimmed.match(/^(\w+)\s*:\s*(\w+)\s*\(/);
    if (!m) continue;
    const [, jsName, driverFn] = m;
    if (seen.has(jsName)) continue;
    if (driverFn === "index" || driverFn === "uniqueIndex") continue;
    seen.add(jsName);

    const sqlNameMatch = line.match(/\(\s*["']([^"']+)["']/);
    const sqlName = sqlNameMatch ? sqlNameMatch[1] : jsName;

    const typeMap: Record<string, string> = {
      serial: "serial (int, PK auto)", text: "text", integer: "integer",
      real: "real (float)", boolean: "boolean", timestamp: "timestamp (tz)",
      jsonb: "jsonb", varchar: "varchar", bigint: "bigint",
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
  for (const filePath of exportedFiles) {
    if (!fs.existsSync(filePath)) continue;
    const parsed = parseSchemaFile(filePath);
    if (!parsed || parsed.columns.length === 0) continue;
    section += `## Table: ${parsed.tableName}\n\n`;
    section += "| Column | Type | Constraints |\n|--------|------|-------------|\n";
    for (const col of parsed.columns) {
      section += `| ${col.name} | ${col.type} | ${col.constraints} |\n`;
    }
    section += "\n";
  }
  return section;
}

// ─── API Reference ────────────────────────────────────────────────────────────

type JsonSchema = {
  type?: string | string[]; properties?: Record<string, JsonSchema>;
  required?: string[]; $ref?: string; description?: string;
  enum?: unknown[]; items?: JsonSchema; additionalProperties?: JsonSchema;
  allOf?: JsonSchema[]; oneOf?: JsonSchema[];
};
type ComponentsSchemas = Record<string, JsonSchema>;

function resolveRef(ref: string, schemas: ComponentsSchemas): JsonSchema | null {
  const parts = ref.replace(/^#\//, "").split("/");
  if (parts[0] !== "components" || parts[1] !== "schemas") return null;
  return schemas[parts[2]] ?? null;
}

function deref(schema: JsonSchema, schemas: ComponentsSchemas): JsonSchema {
  if (schema.$ref) return resolveRef(schema.$ref, schemas) ?? schema;
  return schema;
}

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

function renderSchemaTable(schema: JsonSchema, schemas: ComponentsSchemas, label: string): string {
  const resolved = deref(schema, schemas);
  const props = resolved.properties;
  if (!props || Object.keys(props).length === 0) return "";

  const required = new Set(resolved.required ?? []);
  let table = `**${label}**\n\n| Field | Type | Req | Notes |\n|-------|------|:---:|-------|\n`;
  for (const [name, prop] of Object.entries(props)) {
    const propResolved = prop.$ref ? deref(prop, schemas) : prop;
    const type = schemaType(propResolved);
    const req = required.has(name) ? "Y" : "";
    const notes = (propResolved.description ?? (propResolved.enum ? `enum: ${(propResolved.enum ?? []).map(String).join(", ")}` : "")).replace(/\|/g, "\\|");
    table += `| ${name} | ${type} | ${req} | ${notes} |\n`;
  }
  return table + "\n";
}

interface OpenApiOp {
  summary?: string; operationId?: string; tags?: string[]; description?: string;
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
  responses?: Record<string, { description?: string; content?: Record<string, { schema?: JsonSchema }> }>;
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

  let section = "# API Reference\n\nAll routes prefixed with /api.\n\n";
  const byTag: Record<string, string[]> = {};

  for (const [routePath, methods] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(methods)) {
      if (!op || typeof op !== "object" || !("summary" in op)) continue;
      const tag = op.tags?.[0] ?? "other";
      if (!byTag[tag]) byTag[tag] = [];

      let entry = `### ${method.toUpperCase()} ${routePath}\n\n`;
      entry += `${op.summary ?? op.operationId ?? ""}\n\n`;

      const pathParams = (op.parameters ?? []).filter((p) => p.in === "path");
      const queryParams = (op.parameters ?? []).filter((p) => p.in === "query");
      if (pathParams.length > 0) entry += "Path: " + pathParams.map((p) => `${p.name}`).join(", ") + "\n\n";
      if (queryParams.length > 0) entry += "Query: " + queryParams.map((p) => `${p.name}`).join(", ") + "\n\n";

      const reqContent = op.requestBody?.content;
      if (reqContent) {
        const [, mediaObj] = Object.entries(reqContent)[0] ?? [];
        if (mediaObj?.schema) {
          const schema = mediaObj.schema;
          const resolved = schema.$ref ? (resolveRef(schema.$ref, schemas) ?? schema) : schema;
          const name = schema.$ref ? schema.$ref.split("/").pop()! : "Body";
          entry += renderSchemaTable(resolved, schemas, `Request: ${name}`);
        }
      }

      const responses = Object.entries(op.responses ?? {});
      const successResponse = responses.find(([code]) => code === "200" || code === "201");
      if (successResponse) {
        const [code, r] = successResponse;
        const resContent = r.content;
        if (resContent) {
          const [, mediaObj] = Object.entries(resContent)[0] ?? [];
          if (mediaObj?.schema) {
            const schema = mediaObj.schema;
            let targetSchema = schema.$ref ? (resolveRef(schema.$ref, schemas) ?? schema) : schema;
            let label = `Response ${code}`;
            if (schema.type === "array" && schema.items) {
              const itemsSchema = schema.items.$ref ? (resolveRef(schema.items.$ref, schemas) ?? schema.items) : schema.items;
              label += ` (array)`;
              targetSchema = itemsSchema;
            }
            const rendered = renderSchemaTable(targetSchema, schemas, label);
            if (rendered) entry += rendered;
          }
        }
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
    "devices": "Devices — manage connected temperature probe devices",
    "grills": "Grill profiles — list, create, and manage grill configurations",
    "profile": "User profile — account details, stats, and settings",
    "pro-features": "Pro features — RevenueCat paywall and subscription management",
    "temperature": "Temperature — upload and browse historical temperature readings",
    "log": "Cook logger — create a new cook session",
    "[id]": "Cook detail — full cook record with timeline, check-ins, events, and photos",
    "[sessionId]": "Multi-cook session — view all cooks in a session",
    "ai": "AI assistant — natural language BBQ guidance chat",
    "cooks": "Cook history — list of all past and active cook sessions",
    "more": "More tab — settings, profile, help, and account management",
    "plan": "Plan tab — frozen meat planning and cook time prediction",
    "+not-found": "404 screen — unmatched routes",
  };

  const key = rel.replace(/\.tsx$/, "");
  const desc = descriptions[filename] ?? descriptions[key] ?? `Screen for ${filename.replace(/-/g, " ")}`;
  return `| ${routePath} | ${rel} | ${desc} |`;
}

function buildMobileScreenSection(): string {
  const appDir = requireDir("artifacts/knowyourpit/app");
  const screenFiles: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
      else if (entry.name.endsWith(".tsx") && !entry.name.startsWith("_layout")) {
        screenFiles.push(path.join(dir, entry.name));
      }
    }
  }
  walk(appDir);
  screenFiles.sort();

  let section = "# Mobile Screen Map\n\n| Route | File | Description |\n|-------|------|-------------|\n";
  for (const f of screenFiles) section += describeScreen(f, appDir) + "\n";
  return section + "\n";
}

// ─── API Server Routes ────────────────────────────────────────────────────────

const ROUTE_DESCRIPTIONS: Record<string, string> = {
  "admin.ts": "Admin utilities and internal operations",
  "ai/bbqKnowledge.ts": "BBQ knowledge base lookup used by AI prompts",
  "ai/chat.ts": "AI chat — streaming and non-streaming message handling",
  "ai/index.ts": "AI router — mounts chat, predict, multi-cook sub-routes",
  "ai/insights.ts": "AI-generated cook insights and PitMaster analysis",
  "ai/meatBaselines.ts": "Meat baseline data and cook time reference tables",
  "ai/multiCook.ts": "Multi-cook sequencing",
  "ai/predict.ts": "Cook time prediction using grill fingerprint + meat baselines",
  "ai/shared.ts": "Shared AI helpers",
  "alerts.ts": "Temperature alert CRUD",
  "contact.ts": "Contact form submission (rate-limited, no auth required)",
  "conversations.ts": "AI conversation history — list, rename, delete",
  "cookCheckins.ts": "Cook check-in records, schedule, and auto-checkin support",
  "cookEvents.ts": "Quick-log cook events (spritz, mop, flare-up, fuel, etc.)",
  "cookPhotos.ts": "Cook photo upload and deletion (object storage)",
  "cooks.ts": "Cook session CRUD, health scoring, and status management",
  "customMeatCuts.ts": "User-defined custom meat cut definitions",
  "dashboard.ts": "Dashboard summary, recent cooks, aggregated temperature history",
  "grills.ts": "Grill profile CRUD, fingerprint, insights, temperature history",
  "health.ts": "Health check endpoint (/api/healthz)",
  "index.ts": "Root router — mounts all sub-routers under /api",
  "liveActivities.ts": "iOS Live Activity push token registration and teardown",
  "meater.ts": "MEATER Cloud integration — link, unlink, status, live readings",
  "paywall.ts": "RevenueCat webhook receiver and subscription entitlement sync",
  "profile.ts": "User profile fetch and full account deletion",
  "temperature/analyzePrompt.ts": "AI prompt builder for temperature image analysis",
  "temperature/analyze.ts": "Analyze cook images + notes into a cook timeline",
  "temperature/index.ts": "Temperature router",
  "temperature/manual.ts": "Manual temperature reading upload and retrieval",
  "temperature/scan.ts": "AI vision scan of thermometer screenshots for readings",
  "temperature/shared.ts": "Shared temperature helpers",
  "thermoworks.ts": "ThermoWorks Cloud integration",
  "webhooks.ts": "Inbound webhook dispatcher",
};

function buildApiServerRoutesSection(): string {
  const routesDir = requireDir("artifacts/api-server/src/routes");
  const files: string[] = [];
  function walk(dir: string, base: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
      else if (entry.name.endsWith(".ts")) files.push(rel);
    }
  }
  walk(routesDir, "");
  files.sort();

  let section = "# API Server Routes\n\n| File | Purpose |\n|------|----------|\n";
  for (const file of files) {
    const desc = ROUTE_DESCRIPTIONS[file] ?? file.replace(/\.ts$/, "").replace(/\//g, " > ");
    section += `| ${file} | ${desc} |\n`;
  }
  return section + "\n";
}

function buildConventionsSection(replitMd: string): string {
  const sections = extractSections(replitMd, ["User Preferences", "Mobile UI Conventions"]);
  return "# Conventions & Preferences\n\nExtracted from replit.md.\n\n" + sections + "\n";
}

// ─── PDF Renderer (pdfkit) ───────────────────────────────────────────────────

const C = {
  orange: "#E25C00", dark: "#111111", mid: "#333333",
  muted: "#666666", light: "#888888", bg: "#FFFFFF",
  stripe: "#F7F7F7", headerBg: "#1A1A1A", headerFg: "#F5F5F5",
  codeBg: "#F5F5F5", border: "#DDDDDD", tableBg: "#EFEFEF",
};

const ML = 48, MR = 48, MT = 52, MB = 56;
const PW = 595.28, PH = 841.89;
const TW = PW - ML - MR;

function strip(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

function renderPdf(sections: { title: string; content: string }[], outputPath: string): void {
  const doc = new PDFDocument({ size: "A4", bufferPages: true, margins: { top: MT, bottom: MB, left: ML, right: MR } });
  const stream = fs.createWriteStream(outputPath);
  doc.pipe(stream);

  function lx() { return ML; }
  function cy() { return doc.y; }
  function gap(pts: number) { doc.y = Math.min(doc.y + pts, PH - MB - 2); }

  function ensureSpace(needed: number) {
    if (cy() + needed > PH - MB) doc.addPage();
  }

  function renderTable(rawLines: string[]) {
    const rows = rawLines
      .filter((l) => !/^\s*\|[\s|:-]+\|\s*$/.test(l))
      .map((l) =>
        l.replace(/^\s*\|/, "").replace(/\|\s*$/, "")
         .split("|").map((c) => strip(c.trim()))
      );
    if (rows.length === 0) return;

    const cols = Math.max(...rows.map((r) => r.length));
    const colW = TW / cols;
    const cellPad = 4;
    const fs8 = 8;
    const lineH = fs8 * 1.4;

    rows.forEach((cells, ri) => {
      // Estimate row height from longest cell
      let maxLines = 1;
      cells.forEach((cell) => {
        const approxCharsPerLine = Math.max(1, Math.floor((colW - cellPad * 2) / (fs8 * 0.5)));
        const lns = Math.ceil(cell.length / approxCharsPerLine);
        if (lns > maxLines) maxLines = lns;
      });
      const rowH = Math.max(16, maxLines * lineH + cellPad * 2);
      ensureSpace(rowH + 2);

      const ry = cy();
      const isHeader = ri === 0;
      const bgColor = isHeader ? C.headerBg : ri % 2 === 1 ? C.stripe : C.bg;
      doc.save().rect(lx(), ry, TW, rowH).fillColor(bgColor).fill().restore();

      cells.forEach((cell, ci) => {
        const cx = lx() + ci * colW + cellPad;
        doc.fillColor(isHeader ? C.orange : C.dark)
           .font(isHeader ? "Helvetica-Bold" : "Helvetica")
           .fontSize(fs8)
           .text(cell, cx, ry + cellPad, { width: colW - cellPad * 2, lineBreak: true });
      });

      doc.y = ry + rowH;
    });

    doc.save()
       .moveTo(lx(), cy()).lineTo(lx() + TW, cy())
       .strokeColor(C.border).lineWidth(0.5).stroke()
       .restore();
    gap(8);
  }

  // ── Cover ──────────────────────────────────────────────────────────────────
  doc.save().rect(0, 0, PW, 120).fillColor(C.headerBg).fill().restore();
  doc.save().rect(0, 118, PW, 3).fillColor(C.orange).fill().restore();

  doc.fillColor(C.orange).font("Helvetica-Bold").fontSize(30)
     .text("knowyourpit", ML, 30, { continued: true });
  doc.fillColor(C.headerFg).text(" Knowledge Document");
  doc.fillColor(C.light).font("Helvetica").fontSize(11)
     .text("App Handoff Reference · Generated " + new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), ML, 78);

  doc.y = 140;

  // ── Table of contents ──────────────────────────────────────────────────────
  gap(8);
  doc.save().rect(lx(), cy(), TW, 24).fillColor(C.stripe).fill().restore();
  doc.fillColor(C.orange).font("Helvetica-Bold").fontSize(11)
     .text("Table of Contents", lx() + 8, cy() + 6);
  doc.y += 24;
  gap(6);

  sections.forEach((s, i) => {
    doc.fillColor(C.mid).font("Helvetica").fontSize(9.5)
       .text(`${i + 1}.  ${s.title}`, lx() + 12, cy(), { width: TW - 12 });
    gap(2);
  });

  doc.addPage();

  // ── Render each section ────────────────────────────────────────────────────
  for (const section of sections) {
    const lines = section.content.split("\n");
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      // H1 — section title bar
      if (/^# /.test(line)) {
        doc.addPage();
        const label = line.slice(2).trim();
        doc.save().rect(0, 0, PW, 52).fillColor(C.headerBg).fill().restore();
        doc.save().rect(0, 50, PW, 3).fillColor(C.orange).fill().restore();
        doc.fillColor(C.orange).font("Helvetica-Bold").fontSize(18)
           .text(label, ML, 16, { width: TW });
        doc.y = 68;
        i++; continue;
      }

      // H2
      if (/^## /.test(line)) {
        ensureSpace(48);
        gap(14);
        const label = strip(line.slice(3));
        doc.save().rect(lx(), cy(), TW, 22).fillColor(C.tableBg).fill().restore();
        doc.save().rect(lx(), cy(), 3, 22).fillColor(C.orange).fill().restore();
        doc.fillColor(C.dark).font("Helvetica-Bold").fontSize(12)
           .text(label, lx() + 10, cy() + 5, { width: TW - 12 });
        doc.y += 22;
        gap(6);
        i++; continue;
      }

      // H3
      if (/^### /.test(line)) {
        ensureSpace(32);
        gap(10);
        doc.fillColor(C.orange).font("Helvetica-Bold").fontSize(10)
           .text(strip(line.slice(4)), lx(), cy(), { width: TW });
        gap(4);
        i++; continue;
      }

      // H4
      if (/^#### /.test(line)) {
        ensureSpace(24);
        gap(6);
        doc.fillColor(C.muted).font("Helvetica-Bold").fontSize(8.5)
           .text(line.slice(5).trim().toUpperCase(), lx(), cy(), { width: TW, characterSpacing: 0.5 });
        gap(3);
        i++; continue;
      }

      // HR
      if (/^---+$/.test(line)) {
        gap(6);
        doc.save().moveTo(lx(), cy()).lineTo(lx() + TW, cy())
           .strokeColor(C.border).lineWidth(0.5).stroke().restore();
        gap(6);
        i++; continue;
      }

      // Table
      if (/^\s*\|/.test(line)) {
        const tableLines: string[] = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) tableLines.push(lines[i++]);
        renderTable(tableLines);
        continue;
      }

      // Code block
      if (line.startsWith("```")) {
        i++;
        const codeLines: string[] = [];
        while (i < lines.length && !lines[i].startsWith("```")) codeLines.push(lines[i++]);
        i++;
        if (codeLines.length === 0) continue;

        const lh = 10.5;
        const blockH = codeLines.length * lh + 14;
        ensureSpace(blockH + 6);

        const by = cy();
        doc.save().rect(lx(), by, TW, blockH).fillColor(C.codeBg).fill().restore();
        doc.save().rect(lx(), by, 3, blockH).fillColor(C.orange).fill().restore();

        codeLines.forEach((cl, idx) => {
          doc.fillColor(C.mid).font("Courier").fontSize(7)
             .text(cl || " ", lx() + 10, by + 7 + idx * lh, { width: TW - 16, lineBreak: false });
        });
        doc.y = by + blockH;
        gap(8);
        continue;
      }

      // Blockquote
      if (/^> /.test(line)) {
        ensureSpace(24);
        const bqText = strip(line.slice(2));
        const bqY = cy();
        doc.save().rect(lx(), bqY, 3, 24).fillColor(C.orange).fill().restore();
        doc.fillColor(C.muted).font("Helvetica-Oblique").fontSize(8.5)
           .text(bqText, lx() + 10, bqY + 4, { width: TW - 12 });
        if (doc.y < bqY + 24) doc.y = bqY + 24;
        gap(6);
        i++; continue;
      }

      // Bullet
      if (/^[ \t]*[-*] /.test(line)) {
        const indent = Math.min((line.match(/^(\s*)/)?.[1].length ?? 0), 4) * 5;
        const text = strip(line.replace(/^[ \t]*[-*] /, ""));
        ensureSpace(16);
        const by = cy();
        doc.fillColor(C.orange).font("Helvetica-Bold").fontSize(8.5).text("•", lx() + indent, by);
        doc.fillColor(C.dark).font("Helvetica").fontSize(8.5)
           .text(text, lx() + indent + 10, by, { width: TW - indent - 10 });
        gap(2);
        i++; continue;
      }

      // Blank
      if (line.trim() === "") { gap(4); i++; continue; }

      // Paragraph
      const text = strip(line);
      if (text) {
        ensureSpace(14);
        doc.fillColor(C.dark).font("Helvetica").fontSize(9)
           .text(text, lx(), cy(), { width: TW });
        gap(3);
      }
      i++;
    }
  }

  // ── Footers ────────────────────────────────────────────────────────────────
  const total = doc.bufferedPageRange().count;
  for (let p = 0; p < total; p++) {
    doc.switchToPage(p);
    if (p === 0) continue;
    doc.save()
       .moveTo(ML, PH - MB + 10).lineTo(PW - MR, PH - MB + 10)
       .strokeColor(C.border).lineWidth(0.5).stroke()
       .restore();
    doc.fillColor(C.light).font("Helvetica").fontSize(7)
       .text(
         `knowyourpit Knowledge Document  ·  Page ${p + 1} of ${total}`,
         ML, PH - MB + 14, { width: TW, align: "center" }
       );
  }

  doc.end();

  stream.on("finish", () => {
    const kb = Math.round(fs.statSync(outputPath).size / 1024);
    console.log(`\n✅ PDF written: ${outputPath}`);
    console.log(`   ${total} pages, ${kb} KB`);
    if (kb < 50) console.warn("\n⚠️  Under 50 KB — content may be incomplete.");
  });
  stream.on("error", (e) => { console.error("FATAL:", e); process.exit(1); });
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

  const sections = [
    { title: "Project Overview", content: "# Project Overview\n\n" + replitMd },
    { title: "Database Schema", content: buildSchemaSection() },
    { title: "API Reference", content: buildApiSection() },
    { title: "Mobile Screen Map", content: buildMobileScreenSection() },
    { title: "API Server Routes", content: buildApiServerRoutesSection() },
    { title: "Environment Variables", content: "# Environment Variables\n\n" + requireFile("artifacts/knowyourpit/ENV.md") },
    { title: "Conventions & Preferences", content: buildConventionsSection(replitMd) },
  ];

  const outputDir = path.join(__dirname, "../output");
  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, "knowyourpit-knowledge.pdf");

  renderPdf(sections, outputPath);
}

main().catch((err) => { console.error("FATAL:", err); process.exit(1); });
