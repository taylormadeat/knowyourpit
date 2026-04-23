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
const WATCH_APP_TARGET = "KnowYourPitWatch";
const WATCH_EXT_TARGET = "KnowYourPitWatchExtension";
const SWIFT_SOURCES = path.join(__dirname, "WatchExtension");

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

      return mod;
    },
  ]);

const withWatchTargets: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const ios = mod.modRequest.platformProjectRoot;

    const existing = project.pbxNativeTargetSection();
    const alreadyAdded = Object.values(existing).some(
      (t: unknown) =>
        t !== null &&
        typeof t === "object" &&
        (t as Record<string, unknown>).name === WATCH_APP_TARGET
    );
    if (alreadyAdded) return mod;

    const appDest = path.join(ios, WATCH_APP_TARGET);
    const extDest = path.join(ios, WATCH_EXT_TARGET);
    const extViews = path.join(extDest, "Views");

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

    return mod;
  });

const withWatchConnectivityFramework: ConfigPlugin = (config) =>
  withXcodeProject(config, (mod) => {
    try { mod.modResults.addFramework("WatchConnectivity.framework", { weak: false }); }
    catch { /* already linked */ }
    return mod;
  });

const withWatchApp: ConfigPlugin = (config) => {
  config = withAppGroup(config);
  config = withWatchSources(config);
  config = withWatchTargets(config);
  config = withWatchConnectivityFramework(config);
  return config;
};

export default withWatchApp;
