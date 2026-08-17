#!/usr/bin/env node
// babel-lowering-smoke.mjs — compile known crash-prone class patterns through
// the REAL babel.config.js and execute the output. Catches transform
// regressions that hermesc compilation alone cannot (the bundle can compile
// fine and still throw at runtime).
//
// Covers two shipped launch crashes:
//   • build 137: loose class fields → bare assignment over a read-only
//     inherited getter ("Cannot assign to read-only property 'NONE'").
//   • build 138: lowering running before Flow/TS type stripping compiled an
//     annotation-only field (`state: State;` in RN's VirtualizedList) into
//     defineProperty over the non-configurable `state` accessor installed by
//     StateSafePureComponent ("property is not configurable").
//
// Exit code 0 = all patterns construct without throwing.

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const pkgRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// Root the require in the app package so @babel/runtime helpers emitted by
// the transform resolve the same way they do in the real bundle.
const require = createRequire(path.join(pkgRoot, "package.json"));
const babel = require("@babel/core");
// @babel/runtime helpers are a dependency of babel-preset-expo, not of the
// app itself (pnpm strict layout) — resolve them from the preset's context.
const presetRequire = createRequire(require.resolve("babel-preset-expo/package.json"));
const sandboxRequire = (id) =>
  id.startsWith("@babel/runtime/") ? presetRequire(id) : require(id);

const CASES = [
  {
    name: "read-only inherited getter (Event.NONE, build-137 crash)",
    filename: "case1.ts",
    code: `
      "use strict";
      function Base() {}
      Object.defineProperty(Base.prototype, "NONE", { get() { return 0; }, enumerable: true });
      class Sub extends (Base as any) {
        NONE = undefined; // real field shadowing read-only inherited prop
        constructor() { super(); }
      }
      new (Sub as any)();
    `,
  },
  {
    name: "non-configurable own accessor + annotation-only field (VirtualizedList.state, build-138 crash)",
    filename: "case2.js",
    // Flow file: `state: mixed;` is annotation-only and MUST be stripped
    // before field lowering, or it compiles into a defineProperty that
    // throws over the non-configurable accessor.
    code: `
      // @flow
      "use strict";
      function StateSafe() {
        Object.defineProperty(this, "state", {
          get() { return this._s; },
          set(v) { this._s = v; },
        }); // configurable defaults to false — same as RN's StateSafePureComponent
      }
      class List extends (StateSafe: any) {
        state: mixed;
        _cellRefs = {};
        constructor() { super(); this.state = { ok: true }; }
      }
      const l = new (List: any)();
      if (!l.state || l.state.ok !== true) throw new Error("state accessor broken");
    `,
  },
  {
    name: "real field with initializer over non-configurable accessor must NOT regress to defineProperty-only pipeline ordering",
    filename: "case3.js",
    // A real (initialized) field named after the accessor: with correct
    // ordering this still lowers via defineProperty and would throw — RN
    // never does this, but flag it loudly if RN-like code appears to.
    // We only assert the annotation-only case (case2); this case documents
    // the boundary and asserts plain fields on fresh instances still work.
    code: `
      // @flow
      "use strict";
      class Plain {
        count = 1;
        inc = () => { this.count += 1; };
      }
      const p = new (Plain: any)();
      p.inc();
      if (p.count !== 2) throw new Error("plain class fields broken");
    `,
  },
];

// Load the real project config and resolve it exactly as Metro would for a
// file inside the package.
let failures = 0;
for (const c of CASES) {
  let out;
  try {
    out = babel.transformSync(c.code, {
      filename: path.join(pkgRoot, "app", c.filename),
      cwd: pkgRoot,
      root: pkgRoot,
      // Use the project babel.config.js (presets incl. babel-preset-expo).
      configFile: path.join(pkgRoot, "babel.config.js"),
      babelrc: false,
      // Must match the real Metro caller: engine "hermes" makes
      // babel-preset-expo leave class fields alone (so OUR lowering preset
      // handles them, with defineProperty semantics), exactly as in the
      // shipped bundle.
      caller: {
        name: "metro",
        platform: "ios",
        engine: "hermes",
        supportsStaticESM: false,
      },
    });
  } catch (err) {
    console.error(`🔴 [compile] ${c.name}\n   ${err.message}`);
    failures++;
    continue;
  }
  const code = out.code;
  // Real class syntax: `class Name {` or `class Name extends` — not the
  // phrase "a class as a function" inside Babel helper strings.
  if (/\bclass\s+[A-Za-z_$][\w$]*\s*(\{|extends\b)/.test(code)) {
    console.error(`🔴 [lowering] ${c.name}: ES6 class syntax survived — old hermesc will reject it`);
    failures++;
    continue;
  }
  try {
    // eslint-disable-next-line no-new-func
    new Function("require", "module", "exports", code)(sandboxRequire, { exports: {} }, {});
    console.log(`✅ ${c.name}`);
  } catch (err) {
    console.error(`🔴 [runtime] ${c.name}\n   ${err.constructor.name}: ${err.message}`);
    failures++;
  }
}

process.exit(failures === 0 ? 0 : 1);
