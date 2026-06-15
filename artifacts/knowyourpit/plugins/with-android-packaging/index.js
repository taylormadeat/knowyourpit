const { withAppBuildGradle } = require("@expo/config-plugins");

const MARKER = "// PIT_ANDROID_PACKAGING_FIX";

const withAndroidPackaging = (config) => {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes(MARKER)) {
      return cfg;
    }

    const packagingBlock = `
    ${MARKER}
    // META-INF/versions/9/OSGI-INF/MANIFEST.MF is duplicated by several
    // JVM libraries (e.g. jackson-databind, okhttp). AGP 8 removed the old
    // packagingOptions { pickFirst } DSL; use the new packaging block instead.
    packaging {
        resources {
            pickFirsts += ['META-INF/versions/9/OSGI-INF/MANIFEST.MF']
        }
    }`;

    cfg.modResults.contents = cfg.modResults.contents.replace(
      /^(android\s*\{)/m,
      `$1${packagingBlock}`
    );

    return cfg;
  });
};

module.exports = withAndroidPackaging;
