/**
 * Verifies the live App Store Connect record selected for the current iOS
 * release. It deliberately prints no demo credentials or other secrets.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run checkAscReleaseReadiness
 */

import { createSign } from "crypto";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const expoConfig = require("../../artifacts/knowyourpit/app.config.js") as {
  expo: { version: string; ios: { buildNumber: string } };
};

const KEY_P8 = process.env.ASC_API_KEY_P8;
const KEY_ID = process.env.ASC_API_KEY_ID;
const ISSUER_ID = process.env.ASC_API_ISSUER_ID;
const APP_ID = "6763445064";
const BASE = "https://api.appstoreconnect.apple.com/v1";
const EXPECTED_MARKETING_URL = "https://www.knowyourpit.com";
const EXPECTED_SUPPORT_URL = "https://www.knowyourpit.com/support";
const EXPECTED_PRIVACY_URL = "https://www.knowyourpit.com/privacy";

function normalisePem(raw: string): string {
  const match = raw.replace(/\\n/g, "\n").match(
    /-----BEGIN PRIVATE KEY-----([\s\S]*?)-----END PRIVATE KEY-----/,
  );
  if (!match) throw new Error("ASC_API_KEY_P8 is not a valid PEM private key");
  const base64 = match[1].replace(/\s+/g, "");
  return `-----BEGIN PRIVATE KEY-----\n${base64.match(/.{1,64}/g)!.join("\n")}\n-----END PRIVATE KEY-----\n`;
}

function base64Url(value: Buffer | string): string {
  const buffer = typeof value === "string" ? Buffer.from(value) : value;
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function makeJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const payload = base64Url(
    JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 1200, aud: "appstoreconnect-v1" }),
  );
  const signing = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(signing);
  const signature = signer.sign({ key: normalisePem(KEY_P8!), dsaEncoding: "ieee-p1363" });
  return `${signing}.${base64Url(signature)}`;
}

async function ascGet(path: string): Promise<any> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${makeJwt()}`, Accept: "application/json" },
  });
  const body: any = await response.json();
  if (!response.ok) {
    throw new Error(`${response.status} ${body.errors?.[0]?.detail ?? `GET ${path} failed`}`);
  }
  return body;
}

function result(ok: boolean, label: string, detail?: string): boolean {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

async function main() {
  if (!KEY_P8 || !KEY_ID || !ISSUER_ID) {
    throw new Error("Missing ASC_API_KEY_P8, ASC_API_KEY_ID, or ASC_API_ISSUER_ID");
  }

  const version = expoConfig.expo.version;
  const buildNumber = expoConfig.expo.ios.buildNumber;
  let valid = true;
  console.log(`App Store Connect release audit — v${version} (build ${buildNumber})`);
  console.log("══════════════════════════════════════════════════════════════");

  const versions = await ascGet(
    `/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&include=appStoreVersionLocalizations,appStoreReviewDetail&limit=50`,
  );
  const draft = versions.data?.find((item: any) => item.attributes?.versionString === version);
  valid &&= result(
    Boolean(draft),
    "Editable App Store version matches app.config.js",
    draft ? `${version} (${draft.attributes.appStoreState})` : `missing v${version}`,
  );
  if (!draft) process.exit(1);

  const attachedBuild = await ascGet(`/appStoreVersions/${draft.id}/build`);
  const attachedBuildId = attachedBuild.data?.id;
  const expectedBuild = await ascGet(`/apps/${APP_ID}/builds?limit=100`);
  const expectedBuildData = expectedBuild.data?.find(
    (item: any) => item.attributes?.version === buildNumber,
  );
  valid &&= result(
    attachedBuildId === expectedBuildData?.id,
    "Processed build is attached to the matching draft",
    attachedBuildId ? `build ${buildNumber}` : "no attached build",
  );

  if (expectedBuildData) {
    const preRelease = await ascGet(`/builds/${expectedBuildData.id}/preReleaseVersion`);
    valid &&= result(
      expectedBuildData.attributes?.processingState === "VALID"
        && expectedBuildData.attributes?.buildAudienceType === "APP_STORE_ELIGIBLE"
        && preRelease.data?.attributes?.version === version,
      "Build is valid, App Store eligible, and has the expected marketing version",
    );
    valid &&= result(
      expectedBuildData.attributes?.usesNonExemptEncryption === false,
      "Build uses only exempt encryption",
    );
  } else {
    valid = false;
    result(false, `Build ${buildNumber} exists in App Store Connect`);
  }

  const localization = versions.included?.find(
    (item: any) => item.type === "appStoreVersionLocalizations"
      && item.id === draft.relationships?.appStoreVersionLocalizations?.data?.[0]?.id,
  );
  valid &&= result(
    localization?.attributes?.marketingUrl === EXPECTED_MARKETING_URL
      && localization?.attributes?.supportUrl === EXPECTED_SUPPORT_URL
      && Boolean(localization?.attributes?.description)
      && Boolean(localization?.attributes?.promotionalText)
      && Boolean(localization?.attributes?.keywords),
    "Listing metadata and public URLs are complete",
  );

  const reviewDetail = versions.included?.find(
    (item: any) => item.type === "appStoreReviewDetails"
      && item.id === draft.relationships?.appStoreReviewDetail?.data?.id,
  );
  valid &&= result(
    reviewDetail?.attributes?.demoAccountRequired === true
      && Boolean(reviewDetail?.attributes?.demoAccountName)
      && Boolean(reviewDetail?.attributes?.notes),
    "Protected demo account and reviewer notes are present",
  );

  const screenshotSets = await ascGet(
    `/appStoreVersionLocalizations/${localization?.id}/appScreenshotSets`,
  );
  const screenshotSummaries = await Promise.all((screenshotSets.data ?? []).map(async (set: any) => {
    const screenshots = await ascGet(`/appScreenshotSets/${set.id}/appScreenshots?limit=100`);
    return {
      type: set.attributes?.screenshotDisplayType,
      images: screenshots.data ?? [],
    };
  }));
  const hasIphone = screenshotSummaries.some(
    (set) => set.type === "APP_IPHONE_65" && set.images.length > 0,
  );
  const hasIpad = screenshotSummaries.some(
    (set) => set.type === "APP_IPAD_PRO_3GEN_129" && set.images.length > 0,
  );
  const screenshotsComplete = screenshotSummaries.every((set) =>
    set.images.every((image: any) => image.attributes?.assetDeliveryState?.state === "COMPLETE"),
  );
  valid &&= result(
    hasIphone && hasIpad && screenshotsComplete,
    "Current iPhone and iPad screenshots are uploaded and processed",
  );

  const appInfos = await ascGet(`/apps/${APP_ID}/appInfos?include=appInfoLocalizations&limit=10`);
  const appInfo = appInfos.data?.find(
    (item: any) => item.attributes?.appStoreState === "PREPARE_FOR_SUBMISSION",
  );
  const appInfoLocalization = appInfos.included?.find(
    (item: any) => item.type === "appInfoLocalizations"
      && item.id === appInfo.relationships?.appInfoLocalizations?.data?.[0]?.id,
  );
  const [primaryCategory, secondaryCategory, ageRating] = await Promise.all([
    ascGet(`/appInfos/${appInfo.id}/primaryCategory`),
    ascGet(`/appInfos/${appInfo.id}/secondaryCategory`),
    ascGet(`/appInfos/${appInfo.id}/ageRatingDeclaration`),
  ]);
  valid &&= result(
    primaryCategory.data?.id === "FOOD_AND_DRINK" && secondaryCategory.data?.id === "UTILITIES",
    "Food & Drink and Utilities categories are selected",
  );
  valid &&= result(
    appInfoLocalization?.attributes?.privacyPolicyUrl === EXPECTED_PRIVACY_URL,
    "Privacy policy URL uses the public www host",
  );
  valid &&= result(
    appInfo.attributes?.appStoreAgeRating === "FOUR_PLUS"
      && ageRating.data?.attributes?.userGeneratedContent === false
      && ageRating.data?.attributes?.unrestrictedWebAccess === false,
    "4+ age rating declaration is complete",
  );

  const [priceSchedule, annual, monthly] = await Promise.all([
    ascGet(`/apps/${APP_ID}/appPriceSchedule`),
    ascGet("/subscriptions/6764194128"),
    ascGet("/subscriptions/6764196256"),
  ]);
  valid &&= result(Boolean(priceSchedule.data), "App price schedule is configured");
  valid &&= result(
    annual.data?.attributes?.state === "APPROVED" && monthly.data?.attributes?.state === "APPROVED",
    "Annual and monthly Pro subscriptions are approved",
  );

  console.log("══════════════════════════════════════════════════════════════");
  if (!valid) {
    console.error("ASC release audit failed — do not submit.");
    process.exit(1);
  }
  console.log("✓ Live App Store Connect release record is ready to submit.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});