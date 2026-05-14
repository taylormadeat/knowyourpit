import { createClient } from "@replit/revenuecat-sdk/client";

let cachedSettings: any = null;

function extractAccessToken(settings: any): string | undefined {
  return (
    settings?.settings?.access_token ??
    settings?.settings?.oauth?.credentials?.access_token
  );
}

async function getApiKey(): Promise<string> {
  // Prefer the secret key when available — the Replit OAuth integration token
  // lacks the customer_information:customers:read_write scope needed for
  // grantCustomerEntitlement / revokeCustomerGrantedEntitlement.
  const secretKey = process.env.REVENUECAT_SECRET_KEY;
  if (secretKey) return secretKey;

  if (
    cachedSettings &&
    cachedSettings.settings?.expires_at &&
    new Date(cachedSettings.settings.expires_at).getTime() > Date.now()
  ) {
    const cachedToken = extractAccessToken(cachedSettings);
    if (cachedToken) return cachedToken;
    // Cached envelope is missing a usable token — fall through to refresh.
  }

  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error(
      "RevenueCat connection unavailable: missing REVENUECAT_SECRET_KEY and REPLIT_CONNECTORS_HOSTNAME or REPL_IDENTITY/WEB_REPL_RENEWAL.",
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
      "RevenueCat is not connected. Set REVENUECAT_SECRET_KEY or connect the RevenueCat integration in Replit.",
    );
  }
  return accessToken;
}

/**
 * Build a fresh authenticated v2 RevenueCat client. Never cache the result —
 * tokens expire and the helper above transparently refreshes them.
 */
export async function getRevenueCatClient() {
  const apiKey = await getApiKey();
  return createClient({
    baseUrl: "https://api.revenuecat.com/v2",
    headers: { Authorization: `Bearer ${apiKey}` },
  });
}

/**
 * The SDK's response `data` is sometimes typed as `{}` because the OpenAPI
 * schema's `oneOf` union narrows poorly through generics. Use this helper to
 * read array list responses without sprinkling `as any` everywhere.
 */
export function asListItems<T = any>(data: unknown): T[] {
  if (!data || typeof data !== "object") return [];
  const items = (data as { items?: unknown }).items;
  return Array.isArray(items) ? (items as T[]) : [];
}

/**
 * Best-effort error message extraction for SDK responses returned as
 * `{ data, error }` instead of throwing.
 */
export function describeApiError(prefix: string, error: unknown): Error {
  if (!error) return new Error(prefix);
  if (typeof error === "string") return new Error(`${prefix}: ${error}`);
  if (typeof error === "object") {
    const anyErr = error as any;
    const msg = anyErr.message ?? anyErr.detail ?? anyErr.error ?? JSON.stringify(anyErr);
    return new Error(`${prefix}: ${msg}`);
  }
  return new Error(`${prefix}: ${String(error)}`);
}
