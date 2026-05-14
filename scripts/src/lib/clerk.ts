/**
 * Clerk REST API helpers for admin scripts.
 *
 * Requires CLERK_SECRET_KEY to be set in the environment.
 */

const CLERK_API_BASE = "https://api.clerk.com/v1";

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
