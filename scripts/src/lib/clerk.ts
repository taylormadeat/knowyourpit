/**
 * Clerk REST API helpers for admin scripts.
 *
 * Requires CLERK_SECRET_KEY to be set in the environment.
 */

const CLERK_API_BASE = "https://api.clerk.com/v1";
const CLERK_LIST_PAGE_LIMIT = 500;

export interface ClerkUserSummary {
  id: string;
  email: string | null;
}

function getClerkSecretKey(): string {
  const key = process.env.CLERK_SECRET_KEY;
  if (!key) {
    throw new Error("CLERK_SECRET_KEY is not set in the environment.");
  }
  return key;
}

/**
 * Returns true if the given string looks like an email address.
 */
function isEmail(value: string): boolean {
  return value.includes("@");
}

/**
 * Resolves a Clerk user ID from either:
 *  - A Clerk user ID directly (e.g. `user_3Dh1OBH5OQBWKLXLl1gOGU8w0oL`) — returned as-is.
 *  - An email address — looked up via `GET /v1/users?email_address=<email>`.
 *
 * Throws if the email resolves to zero or more than one user.
 */
export async function resolveClerkUserId(emailOrId: string): Promise<string> {
  if (!isEmail(emailOrId)) {
    return emailOrId;
  }

  const email = emailOrId;
  const key = getClerkSecretKey();

  const url = `${CLERK_API_BASE}/users?email_address=${encodeURIComponent(email)}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Clerk API error (${response.status}) looking up "${email}": ${body}`);
  }

  const users = (await response.json()) as Array<{ id: string; email_addresses: Array<{ email_address: string }> }>;

  if (users.length === 0) {
    throw new Error(`No Clerk user found with email address "${email}".`);
  }
  if (users.length > 1) {
    const ids = users.map((u) => u.id).join(", ");
    throw new Error(
      `Multiple Clerk users found with email address "${email}": ${ids}. ` +
        `Pass a specific user ID instead.`,
    );
  }

  const userId = users[0].id;
  console.log(`  Resolved email "${email}" → Clerk user ID ${userId}`);
  return userId;
}

interface ClerkUserRaw {
  id: string;
  primary_email_address_id?: string;
  email_addresses?: Array<{ id: string; email_address: string }>;
  created_at?: number;
}

function primaryEmail(user: ClerkUserRaw): string | null {
  const match = user.email_addresses?.find(
    (e) => e.id === user.primary_email_address_id,
  );
  return match?.email_address ?? null;
}

/**
 * Returns all Clerk users whose `created_at` falls within the calendar day
 * identified by `dateStr` (YYYY-MM-DD, UTC). Pages through
 * `GET /v1/users?order_by=created_at` using `offset`-based pagination.
 *
 * Requires CLERK_SECRET_KEY.
 */
export async function listUsersBySignupDate(dateStr: string): Promise<ClerkUserSummary[]> {
  const key = getClerkSecretKey();

  const dayStart = new Date(`${dateStr}T00:00:00.000Z`);

  if (isNaN(dayStart.getTime())) {
    throw new Error(`Invalid date "${dateStr}". Expected YYYY-MM-DD.`);
  }

  // Use next-day midnight as the exclusive upper bound so that records created
  // at exactly 23:59:59.999 UTC are not missed if Clerk treats created_before
  // as a strict less-than comparison.
  const nextDay = new Date(dayStart);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);

  const createdAfterMs = dayStart.getTime();
  const createdBeforeMs = nextDay.getTime();

  const results: ClerkUserSummary[] = [];
  let offset = 0;

  while (true) {
    const params = new URLSearchParams({
      limit: String(CLERK_LIST_PAGE_LIMIT),
      offset: String(offset),
      order_by: "created_at",
      created_after: String(createdAfterMs),
      created_before: String(createdBeforeMs),
    });

    const response = await fetch(`${CLERK_API_BASE}/users?${params}`, {
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Clerk API error (${response.status}) listing users: ${body}`);
    }

    const page = (await response.json()) as ClerkUserRaw[];

    if (!Array.isArray(page) || page.length === 0) break;

    for (const user of page) {
      results.push({ id: user.id, email: primaryEmail(user) });
    }

    if (page.length < CLERK_LIST_PAGE_LIMIT) break;
    offset += page.length;
  }

  return results;
}
