const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# PIT_RESOURCE_BUNDLE_SIGNING_FIX";

const SIGN_FIX_BLOCK = `    ${MARKER}
    # Xcode 14+ signs every CocoaPods resource bundle target by default and
    # requires DEVELOPMENT_TEAM on each one. Resource bundles do not need
    # their own code signing for App Store submission - the parent app's
    # signature covers them. Disable signing on every product-type.bundle
    # target so EAS iOS builds succeed under Xcode 16.
    installer.pods_project.targets.each do |target|
      if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
        target.build_configurations.each do |config|
          config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
          config.build_settings["CODE_SIGN_IDENTITY"] = ""
        end
      end
    end`;

const withPodBundleSigning = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, "utf8");
      if (contents.includes(MARKER)) {
        return cfg;
      }

      const postInstallRegex = /(post_install\s+do\s*\|installer\|)/;
      if (postInstallRegex.test(contents)) {
        contents = contents.replace(
          postInstallRegex,
          `$1\n${SIGN_FIX_BLOCK}`,
        );
      } else {
        contents += `\n\npost_install do |installer|\n${SIGN_FIX_BLOCK}\nend\n`;
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};

module.exports = withPodBundleSigning;
