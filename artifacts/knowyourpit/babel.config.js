module.exports = function (api) {
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
    plugins: [
      // The Linux hermesc bundled with react-native uses Hermes 0.12.0 which
      // doesn't support private class fields (#x, #y, etc.). Force Babel to
      // downcompile them before hermesc sees the bundle (macOS EAS builds use
      // a newer hermesc that supports them natively).
      ["@babel/plugin-transform-class-properties", { loose: true }],
      ["@babel/plugin-transform-private-methods", { loose: true }],
      ["@babel/plugin-transform-private-property-in-object", { loose: true }],
    ],
  };
};
