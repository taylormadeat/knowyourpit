const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const MARKER = "# PIT_RESOURCE_BUNDLE_SIGNING_FIX";

const buildFixBlock = (i) => `${i}${MARKER}
${i}# Xcode 14+ signs every CocoaPods resource bundle target by default and
${i}# requires DEVELOPMENT_TEAM on each one. React Native's helper only
${i}# disables signing for React-Core's bundles (see
${i}# scripts/cocoapods/utils.rb:turn_off_resource_bundle_react_core),
${i}# leaving expo-image, expo-font, and other pods to fail. We disable
${i}# signing on every product-type.bundle target. Resource bundles do not
${i}# need their own signature for App Store submission - the parent app's
${i}# signature covers them. This runs AFTER react_native_post_install so
${i}# it has the final word on the build settings.
${i}Pod::UI.puts("[KnowYourPit] Disabling code signing for resource bundles") if defined?(Pod::UI)
${i}installer.pods_project.targets.each do |target|
${i}  if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
${i}    target.build_configurations.each do |config|
${i}      config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
${i}      config.build_settings["CODE_SIGN_IDENTITY"] = ""
${i}      config.build_settings["EXPANDED_CODE_SIGN_IDENTITY"] = ""
${i}    end
${i}  end
${i}end`;

const withPodBundleSigning = (config) => {
  return withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        "Podfile",
      );
      if (!fs.existsSync(podfilePath)) {
        console.warn(
          "[with-pod-bundle-signing] Podfile not found at",
          podfilePath,
        );
        return cfg;
      }

      let contents = fs.readFileSync(podfilePath, "utf8");
      if (contents.includes(MARKER)) {
        console.log(
          "[with-pod-bundle-signing] Podfile already patched (marker present), skipping",
        );
        return cfg;
      }

      // Match the entire `post_install do |installer| ... end` block (which
      // lives inside `target '...' do ... end` so we use a backreference on
      // the indent to find the matching closing `end`). Inject our fix
      // immediately before that closing `end` so it runs AFTER
      // react_native_post_install.
      const postInstallRegex =
        /^([ \t]*)post_install\s+do\s*\|installer\|([\s\S]*?)\n\1end\b/m;

      if (postInstallRegex.test(contents)) {
        contents = contents.replace(
          postInstallRegex,
          (match, indent, body) =>
            `${indent}post_install do |installer|${body}\n\n${buildFixBlock(
              indent + "  ",
            )}\n${indent}end`,
        );
        console.log(
          "[with-pod-bundle-signing] Injected resource-bundle signing fix into existing post_install block",
        );
      } else {
        contents += `\n\npost_install do |installer|\n${buildFixBlock("  ")}\nend\n`;
        console.log(
          "[with-pod-bundle-signing] No existing post_install block found, appended new one",
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};

module.exports = withPodBundleSigning;
