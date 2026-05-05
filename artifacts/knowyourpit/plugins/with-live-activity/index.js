"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
let config_plugins_1;
try { config_plugins_1 = require("@expo/config-plugins"); } catch { /* unavailable during EAS local pre-validation — guarded below */ }
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));

const APP_GROUP = "group.com.knowyourpit.app";
const WIDGET_BUNDLE_ID = "com.knowyourpit.app.liveactivity";
const WIDGET_TARGET = "KnowYourPitLiveActivity";
const WIDGET_SOURCES = path_1.default.join(__dirname, "WidgetExtension");

const withLiveActivityInfoPlist = (config) =>
    (0, config_plugins_1.withInfoPlist)(config, (mod) => {
        mod.modResults.NSSupportsLiveActivities = true;
        mod.modResults.NSSupportsLiveActivitiesFrequentUpdates = true;
        return mod;
    });

const withAppGroupEntitlement = (config) =>
    (0, config_plugins_1.withEntitlementsPlist)(config, (mod) => {
        const groups = mod.modResults["com.apple.security.application-groups"] ?? [];
        if (!groups.includes(APP_GROUP)) {
            mod.modResults["com.apple.security.application-groups"] = [...groups, APP_GROUP];
        }
        return mod;
    });

const withWidgetSources = (config) =>
    (0, config_plugins_1.withDangerousMod)(config, [
        "ios",
        async (mod) => {
            const ios = mod.modRequest.platformProjectRoot;
            const dest = path_1.default.join(ios, WIDGET_TARGET);
            fs_1.default.mkdirSync(dest, { recursive: true });

            if (fs_1.default.existsSync(WIDGET_SOURCES)) {
                for (const file of fs_1.default.readdirSync(WIDGET_SOURCES)) {
                    if (file.endsWith(".swift")) {
                        fs_1.default.copyFileSync(path_1.default.join(WIDGET_SOURCES, file), path_1.default.join(dest, file));
                    }
                }
            }

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
            fs_1.default.writeFileSync(path_1.default.join(dest, "Info.plist"), infoPlist, "utf8");

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
            fs_1.default.writeFileSync(path_1.default.join(dest, "LiveActivity.entitlements"), entitlements, "utf8");

            return mod;
        },
    ]);

const withWidgetTarget = (config) =>
    (0, config_plugins_1.withXcodeProject)(config, (mod) => {
        const project = mod.modResults;
        const ios = mod.modRequest.platformProjectRoot;

        const existing = project.pbxNativeTargetSection();
        const hasTarget = Object.values(existing).some(
            (t) => t !== null && typeof t === "object" && t.name === WIDGET_TARGET
        );
        if (hasTarget) return mod;

        const dest = path_1.default.join(ios, WIDGET_TARGET);
        const sources = [];
        if (fs_1.default.existsSync(dest)) {
            for (const f of fs_1.default.readdirSync(dest)) {
                if (f.endsWith(".swift")) sources.push(`${WIDGET_TARGET}/${f}`);
            }
        }

        project.addPbxGroup(sources, WIDGET_TARGET, WIDGET_TARGET);
        const target = project.addTarget(WIDGET_TARGET, "app_extension", WIDGET_TARGET, WIDGET_BUNDLE_ID);

        if (target?.uuid) {
            for (const src of sources) {
                try { project.addSourceFile(src, { target: target.uuid }); } catch { /* dup */ }
            }
            try {
                project.addResourceFile(`${WIDGET_TARGET}/Info.plist`, { target: target.uuid });
            } catch { /* dup */ }

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
                } catch { /* manual */ }
            }
        }

        const buildConfigs = project.pbxXCBuildConfigurationSection();
        for (const key of Object.keys(buildConfigs)) {
            const cfg = buildConfigs[key];
            if (!cfg || typeof cfg !== "object" || !("buildSettings" in cfg)) continue;
            const bs = cfg.buildSettings;
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

        const linkSystemFramework = (frameworkName) => {
            const targets = project.pbxNativeTargetSection();
            const entry = Object.entries(targets).find(
                ([, t]) => t !== null && typeof t === "object" && t.name === WIDGET_TARGET
            );
            if (!entry) return;
            const [uuid] = entry;
            const phase = project.pbxFrameworksBuildPhaseObj(uuid);
            if (!phase) return;
            const already = (phase.files ?? []).some(
                (f) => typeof f.comment === "string" && f.comment.includes(frameworkName)
            );
            if (already) return;

            const fileRefUuid = project.generateUuid();
            const fileRefs = project.pbxFileReferenceSection();
            fileRefs[fileRefUuid] = {
                isa: "PBXFileReference",
                lastKnownFileType: "wrapper.framework",
                name: `${frameworkName}.framework`,
                path: `System/Library/Frameworks/${frameworkName}.framework`,
                sourceTree: "SDKROOT",
            };
            fileRefs[`${fileRefUuid}_comment`] = `${frameworkName}.framework`;

            const buildFileUuid = project.generateUuid();
            const buildFiles = project.pbxBuildFileSection();
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

const withLiveActivity = (config) => {
    if (!config_plugins_1) return config;
    config = withLiveActivityInfoPlist(config);
    config = withAppGroupEntitlement(config);
    config = withWidgetSources(config);
    config = withWidgetTarget(config);
    return config;
};

exports.default = withLiveActivity;
