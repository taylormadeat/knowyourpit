/**
 * with-privacy-manifest
 *
 * Expo config plugin that embeds Apple's required PrivacyInfo.xcprivacy into
 * the iOS app target during `expo prebuild` / EAS build.
 *
 * The manifest source lives at:
 *   plugins/with-privacy-manifest/PrivacyInfo.xcprivacy
 * which IS tracked by git (unlike ios/ which is .gitignored).
 *
 * On every prebuild this plugin:
 *   1. Copies PrivacyInfo.xcprivacy into ios/<appName>/PrivacyInfo.xcprivacy
 *   2. Adds a PBXFileReference and PBXBuildFile to the Xcode project so Xcode
 *      includes it in the Resources build phase of the app target.
 *
 * Required by Apple since iOS 17 for any app using NSUserDefaults,
 * file timestamp APIs, system boot time, or disk space APIs — all of which
 * are accessed by AsyncStorage, expo-file-system, RevenueCat, and React Native.
 */

const fs = require("fs");
const path = require("path");
const { withXcodeProject, withDangerousMod, IOSConfig } = require("@expo/config-plugins");

const MANIFEST_FILENAME = "PrivacyInfo.xcprivacy";
const MARKER = "// PIT_PRIVACY_MANIFEST_ADDED";

/**
 * Step 1 — Copy PrivacyInfo.xcprivacy into the ios/<AppName>/ directory.
 * withDangerousMod gives us access to the filesystem at prebuild time.
 */
function withCopyPrivacyManifest(config) {
  return withDangerousMod(config, [
    "ios",
    (cfg) => {
      const srcPath = path.join(__dirname, MANIFEST_FILENAME);
      if (!fs.existsSync(srcPath)) {
        console.warn(
          `[with-privacy-manifest] Source not found at ${srcPath} — skipping copy.`,
        );
        return cfg;
      }

      const appName = cfg.modRequest.projectName ?? "knowyourpit";
      const destDir = path.join(cfg.modRequest.platformProjectRoot, appName);
      const destPath = path.join(destDir, MANIFEST_FILENAME);

      if (!fs.existsSync(destDir)) {
        console.warn(
          `[with-privacy-manifest] iOS target dir not found at ${destDir} — skipping.`,
        );
        return cfg;
      }

      fs.copyFileSync(srcPath, destPath);
      console.log(`[with-privacy-manifest] Copied PrivacyInfo.xcprivacy → ${destPath}`);
      return cfg;
    },
  ]);
}

/**
 * Step 2 — Register the file in the Xcode project (.pbxproj) so that Xcode
 * includes it in the app target's Resources build phase.
 *
 * Uses @expo/config-plugins IOSConfig.XcodeUtils helpers which are available
 * in all Expo SDK versions from 46 onward.
 */
function withRegisterPrivacyManifest(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const appName = cfg.modRequest.projectName ?? "knowyourpit";

    // Guard: skip if already added (idempotent across multiple prebuild runs).
    // We detect this by checking if the filename already exists in PBXFileReference.
    const fileReferences = project.hash.project.objects["PBXFileReference"] ?? {};
    const alreadyAdded = Object.values(fileReferences).some(
      (ref) => typeof ref === "object" && ref.name === MANIFEST_FILENAME,
    );
    if (alreadyAdded) {
      console.log("[with-privacy-manifest] PrivacyInfo.xcprivacy already in Xcode project — skipping.");
      return cfg;
    }

    // Locate the app target group (the group named after the app, typically the
    // root source group that contains AppDelegate, Info.plist, etc.).
    const groups = project.hash.project.objects["PBXGroup"] ?? {};
    let appGroupKey = null;
    for (const [key, group] of Object.entries(groups)) {
      if (typeof group === "object" && group.name === appName) {
        appGroupKey = key;
        break;
      }
    }

    if (!appGroupKey) {
      // Fallback: use the first group whose path matches the appName directory.
      for (const [key, group] of Object.entries(groups)) {
        if (typeof group === "object" && group.path === appName) {
          appGroupKey = key;
          break;
        }
      }
    }

    if (!appGroupKey) {
      console.warn(
        "[with-privacy-manifest] Could not locate Xcode app group — PrivacyInfo.xcprivacy not registered in project.",
      );
      return cfg;
    }

    // Add PBXFileReference, then add to group and Resources build phase.
    // project.addResourceFile returns the build file key.
    const appGroup = project.hash.project.objects["PBXGroup"][appGroupKey];
    const filePath = `${appName}/${MANIFEST_FILENAME}`;

    project.addResourceFile(filePath, {
      target: project.getFirstTarget().uuid,
      lastKnownFileType: "text.xml",
      sourceTree: "<group>",
    });

    console.log("[with-privacy-manifest] Registered PrivacyInfo.xcprivacy in Xcode project.");
    return cfg;
  });
}

/**
 * Compose both steps. Export as a single config plugin function so
 * app.config.js can reference it as:
 *
 *   "./plugins/with-privacy-manifest"
 */
const withPrivacyManifest = (config) => {
  config = withCopyPrivacyManifest(config);
  config = withRegisterPrivacyManifest(config);
  return config;
};

module.exports = withPrivacyManifest;
