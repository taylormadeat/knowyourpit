import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withXcodeProject,
} from "@expo/config-plugins";
import path from "path";
import fs from "fs";

const APP_GROUP = "group.com.knowyourpit.app";
const COMPANION_BUNDLE_ID = "com.knowyourpit.app";
const WATCH_APP_BUNDLE_ID = "com.knowyourpit.app.watchkitapp";
const WATCH_EXT_BUNDLE_ID = "com.knowyourpit.app.watchkitextension";
const COMPLICATION_BUNDLE_ID = "com.knowyourpit.complications";
const WATCH_APP_TARGET = "KnowYourPitWatch";
const WATCH_EXT_TARGET = "KnowYourPitWatchExtension";
const COMPLICATION_TARGET = "KnowYourPitComplications";
const SWIFT_SOURCES = path.join(__dirname, "WatchExtension");
const COMPLICATION_SOURCES = path.join(__dirname, "WatchComplications");

const withAppGroup: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const groups: string[] =
      (mod.modResults["com.apple.security.application-groups"] as string[]) ?? [];
    if (!groups.includes(APP_GROUP)) {
      mod.modResults["com.apple.security.application-groups"] = [...groups, APP_GROUP];
    }
    return mod;
  });

const withWatchSources: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (mod) => {
      const ios = mod.modRequest.platformProjectRoot;

      const appDest = path.join(ios, WATCH_APP_TARGET);
      fs.mkdirSync(appDest, { recursive: true });
      const appPlist = path.join(SWIFT_SOURCES, "WatchApp-Info.plist");
      if (fs.existsSync(appPlist)) {
        fs.copyFileSync(appPlist, path.join(appDest, "Info.plist"));
      }
      const appEntitlements = path.join(SWIFT_SOURCES, "WatchExtension.entitlements");
      if (fs.existsSync(appEntitlements)) {
        fs.copyFileSync(appEntitlements, path.join(appDest, "WatchApp.entitlements"));
      }

      const extDest = path.join(ios, WATCH_EXT_TARGET);
      const extViews = path.join(extDest, "Views");
      fs.mkdirSync(extDest, { recursive: true });
      fs.mkdirSync(extViews, { recursive: true });

      for (const file of fs.readdirSync(SWIFT_SOURCES)) {
        if (file.endsWith(".swift") || file === "Info.plist" || file.endsWith(".entitlements")) {
          fs.copyFileSync(path.join(SWIFT_SOURCES, file), path.join(extDest, file));
        }
      }
      const viewsSrc = path.join(SWIFT_SOURCES, "Views");
      if (fs.existsSync(viewsSrc)) {
        for (const file of fs.readdirSync(viewsSrc)) {
          if (file.endsWith(".swift")) {
            fs.copyFileSync(path.join(viewsSrc, file), path.join(extViews, file));
          }
        }
      }

      // Copy Complication Widget Extension Swift sources
      const compDest = path.join(ios, COMPLICATION_TARGET);
      fs.mkdirSync(compDest, { recursive: true });
      if (fs.existsSync(COMPLICATION_SOURCES)) {
        for (const file of fs.readdirSync(COMPLICATION_SOURCES)) {
          if (file.endsWith(".swift")) {
            fs.copyFileSync(path.join(COMPLICATION_SOURCES, file), path.join(compDest, file));
          }
        }
      }

      // Write the complication Info.plist programmatically so the
      // NSExtensionPointIdentifier registration is explicit and always
      // present — regardless of what the source file contains.
      const compInfoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>KnowYourPit Complications</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>$(MARKETING_VERSION)</string>
    <key>CFBundleVersion</key>
    <string>$(CURRENT_PROJECT_VERSION)</string>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
</dict>
</plist>`;
      fs.writeFileSync(path.join(compDest, "Info.plist"), compInfoPlist, "utf8");

      // Write the complication entitlements programmatically so the
      // App Group (shared with the Watch Extension) is always present.
      const compEntitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP}</string>
    </array>
</dict>
</plist>`;
      fs.writeFileSync(path.join(compDest, "Complication.entitlements"), compEntitlements, "utf8");

      return mod;
    },
  ]);

const withWatchTargets: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const ios = mod.modRequest.platformProjectRoot;

    const existing = project.pbxNativeTargetSection();
    const hasWatchApp = Object.values(existing).some(
      (t: unknown) =>
        t !== null &&
        typeof t === "object" &&
        (t as Record<string, unknown>).name === WATCH_APP_TARGET
    );
    const hasComplication = Object.values(existing).some(
      (t: unknown) =>
        t !== null &&
        typeof t === "object" &&
        (t as Record<string, unknown>).name === COMPLICATION_TARGET
    );
    if (hasWatchApp && hasComplication) return mod;

    const extDest = path.join(ios, WATCH_EXT_TARGET);
    const extViews = path.join(extDest, "Views");
    const compDest = path.join(ios, COMPLICATION_TARGET);

    // ------------------------------------------------------------------
    // Watch App + Watch Extension (only when not yet present)
    // ------------------------------------------------------------------
    let appTargetUuid: string | undefined;

    if (!hasWatchApp) {
      const extSources: string[] = [];
      if (fs.existsSync(extDest)) {
        for (const f of fs.readdirSync(extDest)) {
          if (f.endsWith(".swift")) extSources.push(`${WATCH_EXT_TARGET}/${f}`);
        }
      }
      if (fs.existsSync(extViews)) {
        for (const f of fs.readdirSync(extViews)) {
          if (f.endsWith(".swift")) extSources.push(`${WATCH_EXT_TARGET}/Views/${f}`);
        }
      }

      project.addPbxGroup(
        [`${WATCH_APP_TARGET}/Info.plist`],
        WATCH_APP_TARGET,
        WATCH_APP_TARGET
      );
      const appTarget = project.addTarget(
        WATCH_APP_TARGET,
        "watch2_app",
        WATCH_APP_TARGET,
        WATCH_APP_BUNDLE_ID
      );
      appTargetUuid = appTarget?.uuid;

      project.addPbxGroup(extSources, WATCH_EXT_TARGET, WATCH_EXT_TARGET);
      const extTarget = project.addTarget(
        WATCH_EXT_TARGET,
        "watch2_extension",
        WATCH_EXT_TARGET,
        WATCH_EXT_BUNDLE_ID
      );

      if (extTarget?.uuid) {
        for (const src of extSources) {
          try { project.addSourceFile(src, { target: extTarget.uuid }); } catch { /* dup */ }
        }
        try {
          project.addResourceFile(`${WATCH_EXT_TARGET}/Info.plist`, { target: extTarget.uuid });
        } catch { /* dup */ }
      }

      const mainTarget = project.getFirstTarget();
      if (mainTarget?.uuid && appTarget?.uuid) {
        try {
          const watchProduct = appTarget.pbxNativeTarget?.productReference;
          if (watchProduct) {
            project.addBuildPhase(
              [watchProduct],
              "PBXCopyFilesBuildPhase",
              "Embed Watch Content",
              mainTarget.uuid,
              "watch"
            );
          }
        } catch { /* manual step needed if this fails */ }
      }
    } else {
      // Watch App already exists — find its uuid for the embed phase below
      const targets = project.pbxNativeTargetSection();
      const entry = Object.entries(targets).find(
        ([, t]) =>
          t !== null &&
          typeof t === "object" &&
          (t as Record<string, unknown>).name === WATCH_APP_TARGET
      );
      appTargetUuid = entry?.[0];
    }

    // ------------------------------------------------------------------
    // Complication Widget Extension (only when not yet present)
    // ------------------------------------------------------------------
    if (!hasComplication) {
      const compSources: string[] = [];
      if (fs.existsSync(compDest)) {
        for (const f of fs.readdirSync(compDest)) {
          if (f.endsWith(".swift")) compSources.push(`${COMPLICATION_TARGET}/${f}`);
        }
      }

      project.addPbxGroup(compSources, COMPLICATION_TARGET, COMPLICATION_TARGET);
      const compTarget = project.addTarget(
        COMPLICATION_TARGET,
        "app_extension",
        COMPLICATION_TARGET,
        COMPLICATION_BUNDLE_ID
      );

      if (compTarget?.uuid) {
        for (const src of compSources) {
          try { project.addSourceFile(src, { target: compTarget.uuid }); } catch { /* dup */ }
        }
        try {
          project.addResourceFile(`${COMPLICATION_TARGET}/Info.plist`, { target: compTarget.uuid });
        } catch { /* dup */ }

        // Embed Widget Extension inside the Watch App
        if (appTargetUuid) {
          try {
            const compProduct = compTarget.pbxNativeTarget?.productReference;
            if (compProduct) {
              project.addBuildPhase(
                [compProduct],
                "PBXCopyFilesBuildPhase",
                "Embed App Extensions",
                appTargetUuid,
                "plugins"
              );
            }
          } catch { /* dup */ }
        }
      }
    }

    // ------------------------------------------------------------------
    // Build settings (always applied — safe because Object.assign is idempotent)
    // ------------------------------------------------------------------
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const cfg = buildConfigs[key];
      if (!cfg || typeof cfg !== "object" || !("buildSettings" in cfg)) continue;
      const bs = (cfg as Record<string, Record<string, unknown>>).buildSettings;

      if (bs?.PRODUCT_BUNDLE_IDENTIFIER === WATCH_APP_BUNDLE_ID) {
        Object.assign(bs, {
          SWIFT_VERSION: "5.0",
          WATCHOS_DEPLOYMENT_TARGET: "7.0",
          TARGETED_DEVICE_FAMILY: "4",
          APPLICATION_EXTENSION_API_ONLY: "NO",
          CODE_SIGN_STYLE: "Automatic",
          DEVELOPMENT_TEAM: "$(DEVELOPMENT_TEAM)",
          PRODUCT_NAME: "KnowYourPit Watch",
          CODE_SIGN_ENTITLEMENTS: `${WATCH_APP_TARGET}/WatchApp.entitlements`,
        });
      }

      if (bs?.PRODUCT_BUNDLE_IDENTIFIER === WATCH_EXT_BUNDLE_ID) {
        Object.assign(bs, {
          SWIFT_VERSION: "5.0",
          WATCHOS_DEPLOYMENT_TARGET: "7.0",
          TARGETED_DEVICE_FAMILY: "4",
          APPLICATION_EXTENSION_API_ONLY: "YES",
          CODE_SIGN_STYLE: "Automatic",
          DEVELOPMENT_TEAM: "$(DEVELOPMENT_TEAM)",
          PRODUCT_NAME: "KnowYourPit Watch Extension",
          WK_APP_BUNDLE_IDENTIFIER: WATCH_APP_BUNDLE_ID,
          CODE_SIGN_ENTITLEMENTS: `${WATCH_EXT_TARGET}/WatchExtension.entitlements`,
        });
      }

      if (bs?.PRODUCT_BUNDLE_IDENTIFIER === COMPLICATION_BUNDLE_ID) {
        Object.assign(bs, {
          SWIFT_VERSION: "5.0",
          WATCHOS_DEPLOYMENT_TARGET: "9.0",
          TARGETED_DEVICE_FAMILY: "4",
          APPLICATION_EXTENSION_API_ONLY: "YES",
          CODE_SIGN_STYLE: "Automatic",
          DEVELOPMENT_TEAM: "$(DEVELOPMENT_TEAM)",
          PRODUCT_NAME: "KnowYourPit Complications",
          CODE_SIGN_ENTITLEMENTS: `${COMPLICATION_TARGET}/Complication.entitlements`,
        });
      }
    }

    return mod;
  });

const withWatchConnectivityFramework: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    try { mod.modResults.addFramework("WatchConnectivity.framework", { weak: false }); }
    catch { /* already linked */ }
    return mod;
  });

/**
 * Links WidgetKit.framework to the KnowYourPitComplications target.
 * `project.addFramework()` only targets the main iPhone app, so we
 * manipulate the PBX sections directly.
 */
const withWidgetKitFramework: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;

    // Locate the complication target
    const nativeTargets = project.pbxNativeTargetSection();
    const compEntry = Object.entries(nativeTargets).find(
      ([, t]) =>
        t !== null &&
        typeof t === "object" &&
        (t as Record<string, unknown>).name === COMPLICATION_TARGET
    );
    if (!compEntry) return mod;
    const [compUuid] = compEntry;

    // Locate the target's frameworks build phase
    const frameworksPhase = project.pbxFrameworksBuildPhaseObj(compUuid);
    if (!frameworksPhase) return mod;

    // Skip if WidgetKit is already linked
    const alreadyLinked = (frameworksPhase.files ?? []).some(
      (f: Record<string, unknown>) =>
        typeof f.comment === "string" && f.comment.includes("WidgetKit")
    );
    if (alreadyLinked) return mod;

    // Add a PBXFileReference for WidgetKit (system SDK framework)
    const fileRefUuid = project.generateUuid();
    const fileRefs = project.pbxFileReferenceSection() as Record<string, unknown>;
    fileRefs[fileRefUuid] = {
      isa: "PBXFileReference",
      lastKnownFileType: "wrapper.framework",
      name: "WidgetKit.framework",
      path: "System/Library/Frameworks/WidgetKit.framework",
      sourceTree: "SDKROOT",
    };
    fileRefs[`${fileRefUuid}_comment`] = "WidgetKit.framework";

    // Add a PBXBuildFile that references the file reference
    const buildFileUuid = project.generateUuid();
    const buildFiles = project.pbxBuildFileSection() as Record<string, unknown>;
    buildFiles[buildFileUuid] = {
      isa: "PBXBuildFile",
      fileRef: fileRefUuid,
      fileRef_comment: "WidgetKit.framework",
    };
    buildFiles[`${buildFileUuid}_comment`] = "WidgetKit.framework in Frameworks";

    // Append to the complication target's frameworks phase
    frameworksPhase.files = frameworksPhase.files ?? [];
    frameworksPhase.files.push({
      value: buildFileUuid,
      comment: "WidgetKit.framework in Frameworks",
    });

    return mod;
  });

/**
 * Adds a Podfile post_install hook that sets CODE_SIGNING_ALLOWED=NO on all
 * resource bundle targets. Required for Xcode 14+ which signs resource bundles
 * by default — without this, EAS builds fail with:
 * "resource bundles are signed by default, which requires setting the
 *  development team for each resource bundle target."
 */
const RESOURCE_BUNDLE_SENTINEL = "# KnowYourPit: resource bundle signing";

/**
 * Adds a snippet inside the existing Podfile post_install block that sets
 * CODE_SIGNING_ALLOWED=NO on all resource bundle targets. Required for
 * Xcode 14+ which signs resource bundles by default — without this, EAS
 * builds fail with "resource bundles are signed by default, which requires
 * setting the development team for each resource bundle target."
 *
 * Injects INSIDE the existing post_install block (created by Expo's template)
 * rather than appending a second top-level block, which would conflict with
 * react_native_post_install and other required hooks.
 */
const withResourceBundleSigning: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (mod) => {
      const podfilePath = path.join(
        mod.modRequest.platformProjectRoot,
        "Podfile"
      );
      if (!fs.existsSync(podfilePath)) return mod;

      let podfile = fs.readFileSync(podfilePath, "utf-8");

      // Idempotency guard using a specific sentinel comment
      if (podfile.includes(RESOURCE_BUNDLE_SENTINEL)) return mod;

      const snippet = [
        "",
        `  ${RESOURCE_BUNDLE_SENTINEL}`,
        "  installer.pods_project.targets.each do |target|",
        "    if target.respond_to?(:product_type) && target.product_type == \"com.apple.product-type.bundle\"",
        "      target.build_configurations.each do |config|",
        "        config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'",
        "      end",
        "    end",
        "  end",
      ].join("\n");

      // Inject inside the existing post_install block, BEFORE its closing `end`.
      // This ensures our fix runs AFTER react_native_post_install (which can re-enable
      // signing on bundle targets) and AFTER Expo's own target_installation_results fix.
      // The post_install block is always the last block in the Expo-generated Podfile,
      // so the last occurrence of `\nend` is its closing delimiter.
      const openingPattern = /^\s*post_install do \|installer\|/m;
      const match = openingPattern.exec(podfile);
      if (match !== null) {
        const lastEndIdx = podfile.lastIndexOf("\nend");
        if (lastEndIdx !== -1) {
          // Insert before the last closing `end` (closes post_install block)
          podfile = podfile.slice(0, lastEndIdx) + snippet + podfile.slice(lastEndIdx);
        } else {
          // Fallback: insert after opening line (should not occur in practice)
          const insertAt = match.index + match[0].length;
          podfile = podfile.slice(0, insertAt) + snippet + podfile.slice(insertAt);
        }
      } else {
        // Fallback for edge cases where no post_install block exists yet
        podfile += [
          "",
          "post_install do |installer|",
          snippet,
          "end",
          "",
        ].join("\n");
      }

      fs.writeFileSync(podfilePath, podfile, "utf-8");
      return mod;
    },
  ]);

const withWatchApp: ConfigPlugin = (config) => {
  config = withAppGroup(config);
  config = withWatchSources(config);
  config = withWatchTargets(config);
  config = withWatchConnectivityFramework(config);
  config = withWidgetKitFramework(config);
  config = withResourceBundleSigning(config);
  return config;
};

export default withWatchApp;
