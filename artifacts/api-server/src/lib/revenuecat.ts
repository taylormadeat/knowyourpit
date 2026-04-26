import { createClient } from "@replit/revenuecat-sdk/client";

let cachedSettings: any = null;

function extractAccessToken(settings: any): string | undefined {
  return (
    settings?.settings?.access_token ??
    settings?.settings?.oauth?.credentials?.access_token
  );
}

async function getApiKey(): Promise<string> {
  if (
    cachedSettings &&
    cachedSettings.settings?.expires_at &&
    new Date(cachedSettings.settings.expires_at).getTime() > Date.now()
  ) {
    const cachedToken = extractAccessToken(cachedSettings);
    if (cachedToken) return cachedToken;
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "RevenueCat connection unavailable: missing REPLIT_CONNECTORS_HOSTNAME or REPL_IDENTITY/WEB_REPL_RENEWAL.",
    );
  }

  const res = await fetch(
    `https://${hostname}/api/v2/connection?include_secrets=true&connector_names=revenuecat`,
    {
      headers: {
        Accept: "application/json",
        "X-Replit-Token": xReplitToken,
      },
    },
  );
  const body = (await res.json()) as { items?: any[] };
  cachedSettings = body?.items?.[0];

  const accessToken = extractAccessToken(cachedSettings);
  if (!accessToken) {
    throw new Error(
      "RevenueCat is not connected. Connect the RevenueCat integration in Replit before running this script.",
    );
  }
  return accessToken;
}

export async function getRevenueCatClient() {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

// RC v2 list endpoints return either `{ items: T[] }` or a bare `T[]`
// depending on the SDK shape. Unify both into a typed array.
export function asListItems<T = any>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object" && Array.isArray((data as any).items)) {
    return (data as any).items as T[];
  }
  return [];
}
