/**
 * User details that Clerk exposes to the parts of the app that need a safe,
 * human-readable account label. Kept structural so it works with Clerk's
 * resource type without coupling this utility to the SDK.
 */
export interface AccountIdentityUser {
  unsafeMetadata?: Record<string, unknown> | null;
  emailAddresses?: ReadonlyArray<{ emailAddress?: string | null }> | null;
  externalAccounts?: ReadonlyArray<{ provider?: string | null }> | null;
}

export const APPLE_ACCOUNT_LABEL = "Apple account";

function isAppleProvider(provider: unknown): boolean {
  const normalized = typeof provider === "string" ? provider.toLowerCase() : "";
  return normalized === "apple" || normalized === "oauth_apple";
}

function isApplePrivateRelayEmail(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith("@privaterelay.appleid.com");
}

/**
 * Detect Apple accounts across both newly-created and older Clerk users.
 *
 * New native Apple accounts carry our explicit metadata; Clerk external-account
 * data covers accounts that were linked elsewhere; and the private relay domain
 * is a reliable final signal for legacy Apple identities.
 */
export function isAppleAccount(user: AccountIdentityUser | null | undefined): boolean {
  if (!user) return false;

  if (isAppleProvider(user.unsafeMetadata?.signInProvider)) return true;
  if (user.externalAccounts?.some((account) => isAppleProvider(account.provider))) return true;

  return user.emailAddresses?.some((address) => isApplePrivateRelayEmail(address.emailAddress)) ?? false;
}

/** Returns a user-facing identity without exposing Apple's private relay address. */
export function getAccountDisplayIdentity(user: AccountIdentityUser | null | undefined): string {
  if (isAppleAccount(user)) return APPLE_ACCOUNT_LABEL;
  return user?.emailAddresses?.[0]?.emailAddress ?? "";
}