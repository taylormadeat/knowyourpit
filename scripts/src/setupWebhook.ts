/**
 * Sets up the RevenueCat webhook integration for the production API server.
 *
 * Usage:
 *   REVENUECAT_WEBHOOK_SECRET=<secret> pnpm --filter @workspace/scripts exec tsx src/setupWebhook.ts
 *
 * Optional env vars:
 *   REVENUECAT_PROJECT_ID  — defaults to "proj9fae344f"
 *   REVENUECAT_WEBHOOK_URL — defaults to "https://pitking.replit.app/api/webhooks/revenuecat"
 *
 * REVENUECAT_WEBHOOK_SECRET is required. If it is absent the script exits with
 * instructions so the secret is never generated and registered in a mismatched
 * state between RevenueCat and the production server.
 */
import { getRevenueCatClient, asListItems, describeApiError } from "./lib/revenuecat";
import type {
  CreateWebhookIntegrationInput,
  UpdateWebhookIntegrationInput,
  WebhookIntegration,
} from "@replit/revenuecat-sdk";
import {
  listWebhookIntegrations,
  createWebhookIntegration,
  updateWebhookIntegration,
} from "@replit/revenuecat-sdk";

const PROJECT_ID = process.env.REVENUECAT_PROJECT_ID ?? "proj9fae344f";
const WEBHOOK_URL =
  process.env.REVENUECAT_WEBHOOK_URL ??
  "https://pitking.replit.app/api/webhooks/revenuecat";

async function main() {
  const secret = process.env.REVENUECAT_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error(
      "Error: REVENUECAT_WEBHOOK_SECRET is not set.\n\n" +
        "Generate a random secret and save it FIRST as a Replit secret, then re-run:\n\n" +
        "  node -e \"process.stdout.write(require('crypto').randomBytes(32).toString('hex'))\"\n\n" +
        "Add the output as REVENUECAT_WEBHOOK_SECRET in Replit Secrets, then run this\n" +
        "script again so RevenueCat and the API server share the same value.",
    );
    process.exit(1);
  }

  const client = await getRevenueCatClient();

  console.log(`Checking existing webhooks for project ${PROJECT_ID}...`);
  const { data: listData, error: listError } = await listWebhookIntegrations({
    client,
    path: { project_id: PROJECT_ID },
  });

  if (listError) {
    throw describeApiError("Failed to list webhook integrations", listError);
  }

  const existing = asListItems<WebhookIntegration>(listData);
  console.log(`Found ${existing.length} existing webhook(s).`);

  const match = existing.find((w) => w.url === WEBHOOK_URL);

  if (match) {
    console.log(
      `Updating existing webhook (id=${match.id}) at ${WEBHOOK_URL}...`,
    );
    const updateBody: UpdateWebhookIntegrationInput = {
      url: WEBHOOK_URL,
      authorization_header: secret,
    };
    const { error: updateError } = await updateWebhookIntegration({
      client,
      path: {
        project_id: PROJECT_ID,
        webhook_integration_id: match.id,
      },
      body: updateBody,
    });
    if (updateError) {
      throw describeApiError("Failed to update webhook integration", updateError);
    }
    console.log("Webhook updated successfully.");
  } else {
    console.log(`Creating new webhook at ${WEBHOOK_URL}...`);
    const createBody: CreateWebhookIntegrationInput = {
      name: "Replit API Server",
      url: WEBHOOK_URL,
      authorization_header: secret,
    };
    const { data: createData, error: createError } =
      await createWebhookIntegration({
        client,
        path: { project_id: PROJECT_ID },
        body: createBody,
      });
    if (createError) {
      throw describeApiError("Failed to create webhook integration", createError);
    }
    const created = createData as WebhookIntegration | undefined;
    console.log(
      `Webhook created successfully (id=${created?.id ?? "unknown"}).`,
    );
  }

  console.log(
    "\nAll done! The webhook is registered and the secret matches REVENUECAT_WEBHOOK_SECRET.",
  );
}

main().catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
