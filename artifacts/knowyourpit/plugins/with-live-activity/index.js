"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
let config_plugins_1;
try { config_plugins_1 = require("@expo/config-plugins"); } catch { /* unavailable during EAS local pre-validation — guarded below */ }
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));

const APP_GROUP = "group.com.knowyourpit.app";
const WIDGET_BUNDLE_ID = "com.knowyourpit.app.liveactivity";
const WIDGET_TARGET = "KnowYourPitLiveActivity";
const WIDGET_SOURCES = path_1.default.join(__dirname, "WidgetExtension");
const LIVE_ACTIVITY_PROFILE_UUID = "e7196644-26e1-4e65-9dab-d5d09eefd6e7";
const LIVE_ACTIVITY_PROFILE_NAME = "KnowYourPit Live Activity Distribution";

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

            // Widget extension does NOT need com.apple.security.application-groups:
            // the Live Activity state is delivered entirely via ActivityAttributes/ContentState,
            // not via a shared UserDefaults/FileManager container. The provisioning profile
            // "KnowYourPit Live Activity Distribution" was created without App Groups, so
            // including this entitlement causes an Xcode signing error at build time.
            // The MAIN app's entitlements still include the group (via withAppGroupEntitlement).
            const entitlements = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict/>
</plist>`;
            fs_1.default.writeFileSync(path_1.default.join(dest, "LiveActivity.entitlements"), entitlements, "utf8");

            // Install the live activity provisioning profile so Xcode can sign the extension.
            // The base64 profile is stored as the LIVE_ACTIVITY_PROFILE_BASE64 EAS sensitive env var.
            try {
                const profileB64 = process.env.LIVE_ACTIVITY_PROFILE_BASE64;
                if (profileB64 && profileB64.length > 100) {
                    const profilesDir = path_1.default.join(
                        os_1.default.homedir(),
                        "Library", "MobileDevice", "Provisioning Profiles"
                    );
                    fs_1.default.mkdirSync(profilesDir, { recursive: true });
                    const profilePath = path_1.default.join(profilesDir, `${LIVE_ACTIVITY_PROFILE_UUID}.mobileprovision`);
                    fs_1.default.writeFileSync(profilePath, Buffer.from(profileB64.trim(), "base64"));
                    console.log(`[with-live-activity] Installed provisioning profile (${profileB64.length} chars) to ${profilePath}`);
                } else {
                    console.warn(`[with-live-activity] LIVE_ACTIVITY_PROFILE_BASE64 not set or too short (len=${(profileB64||'').length}) — Manual signing may fail`);
                }
            } catch (profileErr) {
                console.error(`[with-live-activity] Profile install failed: ${profileErr}`);
            }

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
            // addTarget("app_extension") creates a bare PBXNativeTarget with
            // buildPhases = [].
            //
            // addSourceFile / addPluginFile crash here because:
            //  1. addPluginFile calls correctForPluginsPath which expects a
            //     "Plugins" PBXGroup — absent in Expo projects → TypeError.
            //  2. Even if addPluginFile succeeds, addToPbxSourcesBuildPhase
            //     calls buildPhaseObject which iterates COMMENT keys in the
            //     PBXSourcesBuildPhase section.  addBuildPhase writes the UUID
            //     key but NOT the UUID_comment key, so buildPhaseObject returns
            //     null → sources.files.push() → TypeError, swallowed silently.
            //
            // Fix: bypass addSourceFile entirely.  Instead:
            //  a. Create Sources / Frameworks / Resources build phases.
            //  b. For each Swift file, locate its PBXFileReference UUID that
            //     addPbxGroup already registered, create a PBXBuildFile entry
            //     manually, and push it into the phase's files array directly.

            // ── (a) create build phases ──────────────────────────────────────
            const spResult = project.addBuildPhase([], 'PBXSourcesBuildPhase',    'Sources',    target.uuid);
            const fpResult = project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
            const rpResult = project.addBuildPhase([], 'PBXResourcesBuildPhase',  'Resources',  target.uuid);

            const sourcesPhaseUuid     = spResult?.uuid;
            const resourcesPhaseUuid   = rpResult?.uuid;

            const pbxObjs = project.hash.project.objects;
            const sourcesPhase   = sourcesPhaseUuid   && pbxObjs['PBXSourcesBuildPhase']?.[sourcesPhaseUuid];
            const resourcesPhase = resourcesPhaseUuid && pbxObjs['PBXResourcesBuildPhase']?.[resourcesPhaseUuid];

            // ── (b) helper: add a file reference to a build phase ────────────
            const addFileToBuildPhase = (fileRefUUID, fileName, phase, phaseLabel) => {
                if (!phase || !fileRefUUID) return;
                const buildFileUUID = project.generateUuid();
                pbxObjs['PBXBuildFile'][buildFileUUID] = {
                    isa: 'PBXBuildFile',
                    fileRef: fileRefUUID,
                    fileRef_comment: fileName,
                    settings: {},
                };
                pbxObjs['PBXBuildFile'][buildFileUUID + '_comment'] = `${fileName} in ${phaseLabel}`;
                phase.files.push({ value: buildFileUUID, comment: `${fileName} in ${phaseLabel}` });
            };

            // ── (c) look up PBXFileReference UUIDs created by addPbxGroup ───
            const fileRefSection = pbxObjs['PBXFileReference'];
            const findFileRef = (fileName) => {
                for (const [key, val] of Object.entries(fileRefSection)) {
                    if (key.endsWith('_comment') && val === fileName) {
                        return key.replace('_comment', '');
                    }
                }
                // fallback: match by path value
                for (const [key, val] of Object.entries(fileRefSection)) {
                    if (key.endsWith('_comment')) continue;
                    if (val && (val.path === fileName || val.path === `"${fileName}"`)) {
                        return key;
                    }
                }
                return null;
            };

            // ── (d) add Swift sources ────────────────────────────────────────
            for (const src of sources) {
                const fileName = path_1.default.basename(src);
                const fileRefUUID = findFileRef(fileName);
                addFileToBuildPhase(fileRefUUID, fileName, sourcesPhase, 'Sources');
            }

            // NOTE: do NOT add Info.plist to the Resources build phase.
            // Xcode reads it automatically from the target's build settings
            // (INFOPLIST_FILE).  Adding it to Resources creates a second
            // copy action → "Multiple commands produce ...Info.plist" error.

            // NOTE: project.addTarget("app_extension") automatically creates a
            // "Copy Files" PBXCopyFilesBuildPhase (dstSubfolderSpec=13) on the
            // main target AND adds the .appex product build file to it.
            // Do NOT call addBuildPhase again — it re-uses the same PBXBuildFile
            // UUID in a second phase, which is invalid and crashes the Xcodeproj
            // Ruby gem (used by CocoaPods) with UNKNOWN_ERROR during pod install.
        }

        // Approach 1: direct UUID path — reliable because we have the target uuid from addTarget.
        // PRODUCT_BUNDLE_IDENTIFIER string comparison is fragile (xcode pkg may quote values).
        // NOTE: The xcode npm package stores raw PBX tokens.
        // Values with commas, spaces, or hyphens MUST include embedded double-quotes
        // (e.g. '"1,2"') so they are written as "1,2" in the .pbxproj file.
        // Unquoted commas/spaces cause PBX parse errors in subsequent prebuild steps.
        //
        // CURRENT_PROJECT_VERSION / MARKETING_VERSION must be set on the extension target so
        // that $(CURRENT_PROJECT_VERSION) in Info.plist expands to the real build number.
        // Without them, CFBundleVersion resolves to null in the built product.  Xcode then
        // detects a CFBundleVersion mismatch (null vs. parent app's build number) during the
        // main-app signing step, refuses to re-sign the embedded extension binary with the
        // distribution cert, and leaves only CodeResources — producing an unsigned binary
        // that Apple always rejects.
        const buildNumber = String(mod.ios?.buildNumber ?? "1");
        const marketingVersion = String(mod.version ?? "1.0.0");
        const applyLiveActivitySettings = (bs) => {
            Object.assign(bs, {
                SWIFT_VERSION: "5.0",
                IPHONEOS_DEPLOYMENT_TARGET: "16.1",
                TARGETED_DEVICE_FAMILY: '"1,2"',
                APPLICATION_EXTENSION_API_ONLY: "YES",
                CODE_SIGN_STYLE: "Manual",
                CODE_SIGNING_REQUIRED: "YES",
                CODE_SIGN_IDENTITY: '"iPhone Distribution"',
                DEVELOPMENT_TEAM: "W8AY23XJTF",
                PROVISIONING_PROFILE: `"${LIVE_ACTIVITY_PROFILE_UUID}"`,
                PROVISIONING_PROFILE_SPECIFIER: `"${LIVE_ACTIVITY_PROFILE_NAME}"`,
                PRODUCT_NAME: '"knowyourpit Live Activity"',
                CODE_SIGN_ENTITLEMENTS: `${WIDGET_TARGET}/LiveActivity.entitlements`,
                INFOPLIST_FILE: `${WIDGET_TARGET}/Info.plist`,
                CURRENT_PROJECT_VERSION: buildNumber,
                MARKETING_VERSION: marketingVersion,
            });
        };

        // Approach 1: traverse XCConfigurationList via target UUID — most reliable.
        // Wrapped in try-catch: xcode npm package version on EAS may vary.
        let approachOneApplied = false;
        if (target?.uuid) {
            try {
                const nativeTargetEntry = project.pbxNativeTargetSection()[target.uuid];
                const configListUuid = nativeTargetEntry?.buildConfigurationList;
                if (configListUuid) {
                    // Access raw parsed objects — always present regardless of package version.
                    const allObjects = (project.hash && project.hash.project && project.hash.project.objects)
                        ? project.hash.project.objects
                        : {};
                    const configLists = allObjects["XCConfigurationList"] ?? {};
                    const configList = configLists[configListUuid];
                    const refs = configList?.buildConfigurations ?? [];
                    const buildConfigSection = project.pbxXCBuildConfigurationSection();
                    for (const ref of refs) {
                        const uuid = typeof ref === "object" ? ref.value : ref;
                        const entry = buildConfigSection[uuid];
                        if (entry?.buildSettings) {
                            applyLiveActivitySettings(entry.buildSettings);
                            approachOneApplied = true;
                        }
                    }
                }
            } catch (_e) {
                // Fall through to Approach 2
            }
        }


        // Approach 2: scan all build configs by PRODUCT_BUNDLE_IDENTIFIER (quoted + unquoted).
        // Always runs as belt-and-suspenders even if Approach 1 succeeded.
        const buildConfigs = project.pbxXCBuildConfigurationSection();
        for (const key of Object.keys(buildConfigs)) {
            const cfg = buildConfigs[key];
            if (!cfg || typeof cfg !== "object" || !("buildSettings" in cfg)) continue;
            const bs = cfg.buildSettings;
            const bundleId = String(bs?.PRODUCT_BUNDLE_IDENTIFIER ?? "").replace(/^"|"$/g, "");
            if (bundleId === WIDGET_BUNDLE_ID) {
                applyLiveActivitySettings(bs);
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
