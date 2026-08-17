// Desugars TypeScript constructor parameter properties
// (`constructor(private options) {}`) into a plain parameter plus
// `this.options = options`. Required because @babel/plugin-transform-classes
// below is not TS-aware: under Metro's babel pipeline it can visit a class
// BEFORE babel-preset-expo's TypeScript stripping, leaking the `private`
// modifier into the output as invalid JS (broke build 137's Metro minify
// step, 2026-08-16). Running this immediately before transform-classes in
// the same preset guarantees the ordering. No-ops when TS stripping already
// ran.
const stripTsParameterProperties = ({ types: t }) => ({
  name: "strip-ts-parameter-properties",
  visitor: {
    // Must visit the same node type as @babel/plugin-transform-classes
    // (Class), or that plugin converts the whole class first and this
    // plugin's visitor never sees the constructor.
    Class(path) {
      const ctor = path.node.body.body.find(
        (m) => m.type === "ClassMethod" && m.kind === "constructor",
      );
      if (!ctor) return;
      const assignments = [];
      ctor.params = ctor.params.map((param) => {
        if (param.type !== "TSParameterProperty") return param;
        const inner = param.parameter;
        const name =
          inner.type === "AssignmentPattern" ? inner.left.name : inner.name;
        assignments.push(
          t.expressionStatement(
            t.assignmentExpression(
              "=",
              t.memberExpression(t.thisExpression(), t.identifier(name)),
              t.identifier(name),
            ),
          ),
        );
        return inner;
      });
      if (assignments.length === 0) return;
      const stmts = ctor.body.body;
      // Insert after super(...) when present, otherwise at the top.
      const superIndex = stmts.findIndex(
        (stmt) =>
          stmt.type === "ExpressionStatement" &&
          stmt.expression.type === "CallExpression" &&
          stmt.expression.callee.type === "Super",
      );
      if (superIndex >= 0) {
        stmts.splice(superIndex + 1, 0, ...assignments);
      } else {
        stmts.unshift(...assignments);
      }
    },
  },
});

// Deletes annotation-only class fields (`state: State;` with no initializer)
// before our field-lowering plugins can see them. Flow/TS stripping normally
// removes these, but under Metro our lowering preset can visit the Class node
// first and compile the annotation into defineProperty(this, "state", void 0).
// That exact sequence shipped in build 138 and crashed every VirtualizedList:
// RN's StateSafePureComponent installs a NON-CONFIGURABLE `state` accessor in
// its constructor, and the subsequent defineProperty over it throws
// "TypeError: property is not configurable" (Cook Log endless spinner).
// Matching stock behavior: with native Hermes class fields (builds ≤136,
// no custom lowering) these annotations never produced runtime defines.
const stripAnnotationOnlyClassFields = () => ({
  name: "strip-annotation-only-class-fields",
  visitor: {
    // Visit Class (not ClassProperty) so this runs before
    // @babel/plugin-transform-class-properties, which also operates at the
    // Class level and would otherwise win the race.
    Class(path) {
      path.node.body.body = path.node.body.body.filter((member) => {
        // Only public fields: private fields (`#x: T;`) must keep their
        // declaration or later `this.#x` references become syntax errors.
        if (member.type !== "ClassProperty") return true;
        if (member.declare) return false;
        // Annotation-only: has a type annotation, no value. Keep fields with
        // initializers and plain untyped `field;` declarations (real JS
        // fields that intentionally define undefined).
        return !(member.typeAnnotation && member.value == null);
      });
    },
  },
});

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      // ── Syntax lowering for the ancient EAS hermesc ─────────────────────
      //
      // WHY: the prebuilt hermesc shipped in react-native/sdks/hermesc
      // (Hermes 0.12.0) rejects ALL ES6 class syntax, private fields, async
      // arrows, and for-await-of; EAS macOS builds were observed using it
      // for build 137 (three identical XCODE_BUILD_ERROR failures,
      // 2026-08-16). A fully lowered bundle compiles on any hermesc.
      //
      // ORDERING IS LOAD-BEARING. Babel applies presets in REVERSE order, so
      // this preset being listed FIRST means it runs AFTER babel-preset-expo
      // — i.e. after Flow/TypeScript type stripping. That matters because:
      //
      //   • Flow annotation-only class fields (`state: State;` in RN's
      //     VirtualizedList) must be DELETED by flow stripping, not compiled.
      //     When this lowering ran before stripping (build 138), it turned
      //     `state: State;` into defineProperty(this, "state", void 0),
      //     which threw "TypeError: property is not configurable" over the
      //     non-configurable `state` accessor installed by RN's
      //     StateSafePureComponent — crashing every VirtualizedList (Cook
      //     Log endless spinner + error boundary).
      //
      //   • loose MUST also stay false (the default) on the class-field
      //     plugins. loose:true compiles real fields to bare `this.x = ...`
      //     assignments; when a field shadows a read-only inherited property
      //     (e.g. Event's NONE getter from the event-target shim), that
      //     assignment throws "Cannot assign to read-only property" — this
      //     crashed build 137 on launch (every fetch died). Non-loose
      //     defineProperty semantics legally shadow read-only inherited
      //     props and are plain ES5.
      //
      // Both crash modes are covered by scripts/babel-lowering-smoke.mjs,
      // which the pre-submission review runs against this real config.
      {
        plugins: [
          stripAnnotationOnlyClassFields,
          stripTsParameterProperties,
          // Class fields / private members → ES5 (see ordering note above).
          "@babel/plugin-transform-class-properties",
          "@babel/plugin-transform-private-methods",
          "@babel/plugin-transform-private-property-in-object",
          // Classes → ES5 functions.
          "@babel/plugin-transform-classes",
          // The old hermesc also rejects async arrow functions and
          // for-await-of ("async functions are unsupported"), though it
          // supports plain async function declarations and generators.
          "@babel/plugin-transform-async-generator-functions",
          "@babel/plugin-transform-destructuring",
          "@babel/plugin-transform-async-to-generator",
        ],
      },
      ["babel-preset-expo", { unstable_transformImportMeta: true }],
    ],
  };
};
