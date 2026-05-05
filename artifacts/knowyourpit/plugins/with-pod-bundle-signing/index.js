const fs = require("fs");
const path = require("path");
const { withDangerousMod } = require("@expo/config-plugins");

const SIGNING_MARKER = "# PIT_RESOURCE_BUNDLE_SIGNING_FIX";
const DEPLOY_MARKER = "# PIT_DEPLOYMENT_TARGET_FIX";
const MIN_IOS = "16.1";

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

      // Bump the top-level platform :ios line if present and below minimum.
      contents = contents.replace(
        /^(platform :ios,\s*['"])[^'"]+(['"])/m,
        `$1${MIN_IOS}$2`,
      );

      const patchBlock = (i) => `${i}${DEPLOY_MARKER}
${i}# Force all pods to iOS ${MIN_IOS} minimum — required by LiveActivity.podspec.
${i}installer.pods_project.targets.each do |target|
${i}  target.build_configurations.each do |config|
${i}    sdk = config.build_settings['SDKROOT'] || ''
${i}    next if sdk.start_with?('watch') || sdk.start_with?('appletvos')
${i}    current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
${i}    if current.nil? || current.to_f < ${MIN_IOS}
${i}      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_IOS}'
${i}    end
${i}  end
${i}end

${i}${SIGNING_MARKER}
${i}# Xcode 14+ (incl. Xcode 26) signs every CocoaPods resource bundle by default.
${i}# Set CODE_SIGNING_ALLOWED=NO on ALL pod targets — the parent app signature
${i}# already covers resource bundles, so they must not be signed separately.
${i}installer.pods_project.targets.each do |target|
${i}  target.build_configurations.each do |config|
${i}    config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
${i}    config.build_settings['CODE_SIGNING_REQUIRED'] = 'NO'
${i}    config.build_settings['CODE_SIGN_IDENTITY'] = ''
${i}    config.build_settings['EXPANDED_CODE_SIGN_IDENTITY'] = ''
${i}  end
${i}end`;

      // Use indexOf-based approach (more reliable than regex for nested blocks).
      // In Expo SDK 54 the post_install block is nested INSIDE target '...' do,
      // so the indent level of the closing `end` matters for correct injection.
      const openingPattern = /^([ \t]*)post_install\s+do\s*\|installer\|/m;
      const match = openingPattern.exec(contents);

      if (match) {
        const leadingSpaces = match[1];
        const searchFrom = match.index + match[0].length;
        const closingToken = `\n${leadingSpaces}end`;
        const closingIdx = contents.indexOf(closingToken, searchFrom);

        if (closingIdx !== -1) {
          const patchIndent = leadingSpaces + "  ";
          const patch = `\n\n${patchBlock(patchIndent)}`;
          contents =
            contents.slice(0, closingIdx) +
            patch +
            contents.slice(closingIdx);
          console.log(
            "[with-pod-bundle-signing] Injected deployment-target + signing fixes into post_install block",
          );
        } else {
          // Fallback: append inside block after opening line
          const patchIndent = leadingSpaces + "  ";
          contents =
            contents.slice(0, searchFrom) +
            `\n\n${patchBlock(patchIndent)}` +
            contents.slice(searchFrom);
          console.log(
            "[with-pod-bundle-signing] Appended fixes after post_install opening (no closing end found)",
          );
        }
      } else {
        // No post_install block at all — create one.
        contents += `\n\npost_install do |installer|\n${patchBlock("  ")}\nend\n`;
        console.log(
          "[with-pod-bundle-signing] Created new post_install block with fixes",
        );
      }

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};

module.exports = withPodBundleSigning;
