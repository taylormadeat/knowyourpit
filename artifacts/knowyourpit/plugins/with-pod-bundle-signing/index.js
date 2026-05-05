const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const SIGNING_MARKER = "# PIT_RESOURCE_BUNDLE_SIGNING_FIX";
const DEPLOY_MARKER = "# PIT_DEPLOYMENT_TARGET_FIX";
const MIN_IOS = "16.0";

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

      const alreadyPatched =
        contents.includes(SIGNING_MARKER) && contents.includes(DEPLOY_MARKER);
      if (alreadyPatched) {
        console.log("[with-pod-bundle-signing] Podfile already patched, skipping");
        return cfg;
      }

      // Bump the top-level platform :ios line if below minimum.
      contents = contents.replace(
        /^(platform :ios,\s*['"])[^'"]+(['"])/m,
        `$1${MIN_IOS}$2`,
      );

      const patchBlock = (i) => `${i}${DEPLOY_MARKER}
${i}# Force all pods to iOS ${MIN_IOS} minimum — pods like lottie-ios require it.
${i}installer.pods_project.targets.each do |target|
${i}  target.build_configurations.each do |config|
${i}    current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
${i}    if current.nil? || current.to_f < ${MIN_IOS}
${i}      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
${i}    end
${i}  end
${i}end

${i}${SIGNING_MARKER}
${i}# Xcode 14+ signs every CocoaPods resource bundle target by default.
${i}# Disable signing on every product-type.bundle — parent app signature covers them.
${i}installer.pods_project.targets.each do |target|
${i}  if target.respond_to?(:product_type) && target.product_type == "com.apple.product-type.bundle"
${i}    target.build_configurations.each do |config|
${i}      config.build_settings["CODE_SIGNING_ALLOWED"] = "NO"
${i}      config.build_settings["CODE_SIGN_IDENTITY"] = ""
${i}      config.build_settings["EXPANDED_CODE_SIGN_IDENTITY"] = ""
${i}    end
${i}  end
${i}end`;

      const postInstallRegex =
        /^([ \t]*)post_install\s+do\s*\|installer\|([\s\S]*?)\n\1end\b/m;

      if (postInstallRegex.test(contents)) {
        contents = contents.replace(
          postInstallRegex,
          (match, indent, body) =>
            `${indent}post_install do |installer|${body}\n\n${patchBlock(
              indent + "  ",
            )}\n${indent}end`,
        );
        console.log(
          "[with-pod-bundle-signing] Injected deployment-target + signing fixes into post_install block",
        );
      } else {
        contents += `\n\npost_install do |installer|\n${patchBlock("  ")}\nend\n`;
        console.log(
          "[with-pod-bundle-signing] Appended new post_install block with fixes",
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};

module.exports = withPodBundleSigning;
