import {
  ConfigPlugin,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} from "@expo/config-plugins";
import path from "path";
import fs from "fs";

const APP_GROUP = "group.com.knowyourpit.app";
const WIDGET_BUNDLE_ID = "com.knowyourpit.app.liveactivity";
const WIDGET_TARGET = "KnowYourPitLiveActivity";
const WIDGET_SOURCES = path.join(__dirname, "WidgetExtension");

/** Add NSSupportsLiveActivities to the main app's Info.plist. */
const withLiveActivityInfoPlist: ConfigPlugin = (config) =>
  withInfoPlist(config, (mod) => {
    mod.modResults.NSSupportsLiveActivities = true;
    mod.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
    return mod;
  });

/** Ensure the widget extension shares the App Group entitlement with the main app. */
const withAppGroupEntitlement: ConfigPlugin = (config) =>
  withEntitlementsPlist(config, (mod) => {
    const groups: string[] =
      (mod.modResults["com.apple.security.application-groups"] as string[]) ?? [];
    if (!groups.includes(APP_GROUP)) {
      mod.modResults["com.apple.security.application-groups"] = [...groups, APP_GROUP];
    }
    return mod;
  });

/** Copy the Swift sources for the widget extension into the iOS project tree. */
const withWidgetSources: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    "ios",
    async (mod) => {
      const ios = mod.modRequest.platformProjectRoot;
      const dest = path.join(ios, WIDGET_TARGET);
      fs.mkdirSync(dest, { recursive: true });

      if (fs.existsSync(WIDGET_SOURCES)) {
        for (const file of fs.readdirSync(WIDGET_SOURCES)) {
          if (file.endsWith(".swift")) {
            fs.copyFileSync(path.join(WIDGET_SOURCES, file), path.join(dest, file));
          }
        }
      }

      // Info.plist for a Widget Extension (LiveActivity-capable)
      const infoPlist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleDisplayName</key>
    <string>knowyourpit Live Activity</string>
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
      fs.writeFileSync(path.join(dest, "Info.plist"), infoPlist, "utf8");

      // Entitlements (App Group shared with main app)
      const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.application-groups</key>
    <array>
        <string>${APP_GROUP}</string>
    </array>
</dict>
</plist>`;
      fs.writeFileSync(
        path.join(dest, "LiveActivity.entitlements"),
        entitlements,
        "utf8"
      );

      return mod;
    },
  ]);

/** Add the widget extension target to the Xcode project and link WidgetKit/SwiftUI/ActivityKit. */
const withWidgetTarget: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const ios = mod.modRequest.platformProjectRoot;

    const existing = project.pbxNativeTargetSection();
    const hasTarget = Object.values(existing).some(
      (t: unknown) =>
        t !== null &&
        typeof t === "object" &&
        (t as Record<string, unknown>).name === WIDGET_TARGET
    );
    if (hasTarget) return mod;

    const dest = path.join(ios, WIDGET_TARGET);
    const sources: string[] = [];
    if (fs.existsSync(dest)) {
      for (const f of fs.readdirSync(dest)) {
        if (f.endsWith(".swift")) sources.push(`${WIDGET_TARGET}/${f}`);
      }
    }

    project.addPbxGroup(sources, WIDGET_TARGET, WIDGET_TARGET);
    const target = project.addTarget(
      WIDGET_TARGET,
      "app_extension",
      WIDGET_TARGET,
      WIDGET_BUNDLE_ID
    );

    if (target?.uuid) {
      for (const src of sources) {
        try { project.addSourceFile(src, { target: target.uuid }); } catch { /* dup */ }
      }
      try {
        project.addResourceFile(`${WIDGET_TARGET}/Info.plist`, { target: target.uuid });
      } catch { /* dup */ }

      // Embed the widget extension into the main app
      const mainTarget = project.getFirstTarget();
      if (mainTarget?.uuid) {
        try {
          const product = target.pbxNativeTarget?.productReference;
          if (product) {
            project.addBuildPhase(
              [product],
              "PBXCopyFilesBuildPhase",
              "Embed Foundation Extensions",
              mainTarget.uuid,
              "plugins"
            );
          }
        } catch { /* manual step needed if this fails */ }
      }
    }

    // Build settings for the widget extension
    const buildConfigs = project.pbxXCBuildConfigurationSection();
    for (const key of Object.keys(buildConfigs)) {
      const cfg = buildConfigs[key];
      if (!cfg || typeof cfg !== "object" || !("buildSettings" in cfg)) continue;
      const bs = (cfg as Record<string, Record<string, unknown>>).buildSettings;

      if (bs?.PRODUCT_BUNDLE_IDENTIFIER === WIDGET_BUNDLE_ID) {
        Object.assign(bs, {
          SWIFT_VERSION: "5.0",
          IPHONEOS_DEPLOYMENT_TARGET: "16.1",
          TARGETED_DEVICE_FAMILY: "1,2",
          APPLICATION_EXTENSION_API_ONLY: "YES",
          CODE_SIGN_STYLE: "Automatic",
          DEVELOPMENT_TEAM: "$(DEVELOPMENT_TEAM)",
          PRODUCT_NAME: "knowyourpit Live Activity",
          CODE_SIGN_ENTITLEMENTS: `${WIDGET_TARGET}/LiveActivity.entitlements`,
          INFOPLIST_FILE: `${WIDGET_TARGET}/Info.plist`,
        });
      }
    }

    // Link WidgetKit + SwiftUI to the widget target. Same direct-PBX approach
    // used by the watch-app plugin's withWidgetKitFramework, but applied here
    // for two frameworks.
    const linkSystemFramework = (frameworkName: string) => {
      const targets = project.pbxNativeTargetSection();
      const entry = Object.entries(targets).find(
        ([, t]) =>
          t !== null &&
          typeof t === "object" &&
          (t as Record<string, unknown>).name === WIDGET_TARGET
      );
      if (!entry) return;
      const [uuid] = entry;
      const phase = project.pbxFrameworksBuildPhaseObj(uuid);
      if (!phase) return;
      const already = (phase.files ?? []).some(
        (f: Record<string, unknown>) =>
          typeof f.comment === "string" && f.comment.includes(frameworkName)
      );
      if (already) return;

      const fileRefUuid = project.generateUuid();
      const fileRefs = project.pbxFileReferenceSection() as Record<string, unknown>;
      fileRefs[fileRefUuid] = {
        isa: "PBXFileReference",
        lastKnownFileType: "wrapper.framework",
        name: `${frameworkName}.framework`,
        path: `System/Library/Frameworks/${frameworkName}.framework`,
        sourceTree: "SDKROOT",
      };
      fileRefs[`${fileRefUuid}_comment`] = `${frameworkName}.framework`;

      const buildFileUuid = project.generateUuid();
      const buildFiles = project.pbxBuildFileSection() as Record<string, unknown>;
      buildFiles[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
        fileRef_comment: `${frameworkName}.framework`,
      };
      buildFiles[`${buildFileUuid}_comment`] = `${frameworkName}.framework in Frameworks`;

      phase.files = phase.files ?? [];
      phase.files.push({
        value: buildFileUuid,
        comment: `${frameworkName}.framework in Frameworks`,
      });
    };

    linkSystemFramework("WidgetKit");
    linkSystemFramework("SwiftUI");
    linkSystemFramework("ActivityKit");

    return mod;
  });

const withLiveActivity: ConfigPlugin = (config) => {
  if ((config as any).platform !== "ios") return config;
  config = withLiveActivityInfoPlist(config);
  config = withAppGroupEntitlement(config);
  config = withWidgetSources(config);
  config = withWidgetTarget(config);
  return config;
};

export default withLiveActivity;
