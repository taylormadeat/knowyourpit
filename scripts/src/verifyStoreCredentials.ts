/**
 * Verify that store credentials are connected in the RevenueCat dashboard.
 *
 * For iOS: attempts createProductInStore — succeeds (or returns a "conflict /
 * already exists" error) only when the Apple Shared Secret is connected.
 * For Android: confirms the Play Store app exists in RevenueCat; service-account
 * validation status is not exposed via the REST API and must be checked visually
 * in the RevenueCat dashboard.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx src/verifyStoreCredentials.ts
 */

import {
  listApps,
  listProducts,
  createProductInStore,
  type CreateAppStoreConnectSubscriptionInput,
} from "@replit/revenuecat-sdk";
import {
  asListItems,
  describeApiError,
  getRevenueCatClient,
} from "./lib/revenuecat.js";

type RcClient = Awaited<ReturnType<typeof getRevenueCatClient>>;

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID;
const IOS_APP_ID = process.env.REVENUECAT_APPLE_APP_STORE_APP_ID;
const ANDROID_APP_ID = process.env.REVENUECAT_GOOGLE_PLAY_STORE_APP_ID;

const IOS_PROBE_IDENTIFIER = "com.knowyourpit.pro.monthly";
const IOS_PROBE_GROUP = "knowyourpit Pro";

/**
 * Returns true when the Apple Shared Secret is confirmed connected,
 * false when it is confirmed missing, and throws on unexpected API errors.
 */
async function checkIosCredentials(client: RcClient): Promise<boolean> {
  console.log("\n── iOS (Apple Shared Secret) ────────────────────────────────────────────────");

  if (!IOS_APP_ID) {
    console.log("  ✗ REVENUECAT_APPLE_APP_STORE_APP_ID is not set — skipping iOS check.");
    return false;
  }

  const prodsRes = await listProducts({
    client,
    path: { project_id: PROJECT_ID! },
    query: { limit: 100 },
  });
  if (prodsRes.error) throw describeApiError("listProducts", prodsRes.error);

  const products = asListItems<{
    id: string;
    store_identifier: string;
    app_id: string;
  }>(prodsRes.data);

  const probe = products.find(
    (p) => p.store_identifier === IOS_PROBE_IDENTIFIER && p.app_id === IOS_APP_ID,
  );

  if (!probe) {
    console.log(`  ✗ Product "${IOS_PROBE_IDENTIFIER}" not found for app ${IOS_APP_ID}.`);
    console.log(`    → Run setupProductionPricing.ts first.`);
    return false;
  }

  const storeInfo: CreateAppStoreConnectSubscriptionInput = {
    duration: "ONE_MONTH",
    subscription_group_name: IOS_PROBE_GROUP,
  };

  const result = await createProductInStore({
    client,
    path: { project_id: PROJECT_ID!, product_id: probe.id },
    body: { store_information: storeInfo },
  });

  if (!result.error) {
    console.log(`  ✓ Apple Shared Secret is connected — product synced to App Store Connect.`);
    return true;
  }

  const errMsg = JSON.stringify(result.error).toLowerCase();

  if (
    errMsg.includes("conflict") ||
    errMsg.includes("already") ||
    errMsg.includes("409") ||
    errMsg.includes("has already been used")
  ) {
    console.log(
      `  ✓ Apple Shared Secret is connected — product already exists in App Store Connect.`,
    );
    return true;
  }

  if (
    errMsg.includes("unauthorized") ||
    errMsg.includes("credentials") ||
    errMsg.includes("shared secret") ||
    errMsg.includes("not connected") ||
    errMsg.includes("authentication") ||
    errMsg.includes("401")
  ) {
    console.log(`  ✗ Apple Shared Secret is NOT connected.`);
    console.log(`    RevenueCat error: ${JSON.stringify(result.error)}`);
    return false;
  }

  console.log(`  ? Unexpected response from RevenueCat: ${JSON.stringify(result.error)}`);
  console.log(
    `    Treat this as "not yet confirmed" — check the RevenueCat dashboard manually.`,
  );
  return false;
}

/**
 * Confirms the Android app exists in RevenueCat.
 * Returns "present" when the Play Store app record is found, "missing" otherwise.
 * NOTE: service-account connection status is not exposed via the REST API and
 * must be verified visually in the RevenueCat dashboard.
 */
async function checkAndroidCredentials(
  client: RcClient,
): Promise<"present" | "missing"> {
  console.log(
    "\n── Android (Google Play service account) ────────────────────────────────────",
  );

  if (!ANDROID_APP_ID) {
    console.log(
      "  ✗ REVENUECAT_GOOGLE_PLAY_STORE_APP_ID is not set — skipping Android check.",
    );
    return "missing";
  }

  const appsRes = await listApps({ client, path: { project_id: PROJECT_ID! } });
  if (appsRes.error) throw describeApiError("listApps", appsRes.error);

  const apps = asListItems<{ id: string; name: string; type: string }>(appsRes.data);
  const androidApp = apps.find((a) => a.id === ANDROID_APP_ID);

  if (!androidApp) {
    console.log(`  ✗ Android app (id=${ANDROID_APP_ID}) not found in RevenueCat project.`);
    console.log(`    → Run setupProductionPricing.ts first.`);
    return "missing";
  }

  console.log(
    `  ✓ App record found: "${androidApp.name}" (id=${androidApp.id}, type=${androidApp.type})`,
  );
  console.log(
    `  ℹ RevenueCat does not expose service-account connection status via the REST API.`,
  );
  console.log(
    `  → Check manually: RevenueCat Dashboard → Apps → knowyourpit Android → Service Credentials`,
  );
  console.log(`    A green checkmark next to the JSON field confirms it is linked and validated.`);
  return "present";
}

async function main() {
  if (!PROJECT_ID) {
    throw new Error("REVENUECAT_PROJECT_ID is not set. Run the seed script first.");
  }

  console.log("RevenueCat Store Credential Verification");
  console.log("═══════════════════════════════════════════════════════════════════════════");
  console.log(`Project: ${PROJECT_ID}`);

  const client = await getRevenueCatClient();

  const iosOk = await checkIosCredentials(client);
  const androidStatus = await checkAndroidCredentials(client);

  console.log("\n═══════════════════════════════════════════════════════════════════════════");
  console.log(" Summary");
  console.log("═══════════════════════════════════════════════════════════════════════════");
  console.log(
    `  iOS (Apple Shared Secret)         : ${iosOk ? "✓ Connected" : "✗ Not yet connected — see below"}`,
  );
  console.log(
    `  Android (Google Play service acct): ${
      androidStatus === "present"
        ? "✓ App record found (verify JSON in dashboard)"
        : "✗ App record missing — run setupProductionPricing.ts"
    }`,
  );
  console.log("");

  if (!iosOk) {
    console.log("  How to connect the Apple Shared Secret:");
    console.log(
      "  1. App Store Connect → Apps → KnowYourPit → Monetization → In-App Purchases",
    );
    console.log(
      "     → App-Specific Shared Secret (top-right) → Generate (or copy existing).",
    );
    console.log(
      "  2. RevenueCat Dashboard → knowyourpit project → Apps → 'knowyourpit iOS'",
    );
    console.log(
      "     → App Store Connect section → paste the Shared Secret → Save.",
    );
    console.log("  3. Re-run this script to confirm.");
    console.log("");
  }

  if (androidStatus === "present") {
    console.log("  How to connect the Google Play service account (if not yet done):");
    console.log(
      "  1. Google Play Console → Setup → API access → link a Google Cloud project.",
    );
    console.log(
      "  2. In Google Cloud IAM, create a service account → download the JSON key file.",
    );
    console.log(
      "  3. Play Console → Users & permissions → Invite the service account email →",
    );
    console.log("     grant 'Financial data viewer' + 'Order management' permissions.");
    console.log(
      "  4. RevenueCat Dashboard → Apps → 'knowyourpit Android' → Service Credentials",
    );
    console.log("     → paste the JSON contents → Save.");
    console.log(
      "  Full guide: https://www.revenuecat.com/docs/google-server-notifications",
    );
  }
}

main().catch((err) => {
  console.error(err?.stack ?? err?.message ?? err);
  process.exit(1);
});
