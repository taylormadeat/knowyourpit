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

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { unstable_transformImportMeta: true }],
      // Why lower classes at all: the prebuilt hermesc shipped in
      // react-native/sdks/hermesc (Hermes 0.12.0) rejects ALL ES6 class
      // syntax ("invalid statement encountered"), and EAS macOS builds were
      // observed using it for build 137 (three identical XCODE_BUILD_ERROR
      // failures, 2026-08-16). A class-free bundle compiles on any hermesc.
      {
        plugins: [
          stripTsParameterProperties,
          "@babel/plugin-transform-classes",
          // The same hermesc also rejects async arrow functions and
          // for-await-of ("async functions are unsupported"), though it
          // supports plain async function declarations and generators.
          // Lower all async syntax to generator-based helpers.
          "@babel/plugin-transform-async-generator-functions",
          "@babel/plugin-transform-destructuring",
          "@babel/plugin-transform-async-to-generator",
        ],
      },
    ],
    plugins: [
      // The same ancient hermesc also lacks private class fields (#x, #y).
      // Downcompile them before hermesc sees the bundle.
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ],
  };
};
