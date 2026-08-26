/**
 * Minimal structural shape shared by Clerk's sign-up resources and the
 * authentication flows that need to identify an outstanding email check.
 */
export interface EmailVerificationState {
  unverifiedFields?: readonly string[] | null;
  verifications?: {
    emailAddress?: {
      status?: string | null;
    } | null;
  } | null;
}

/**
 * Clerk can expose an outstanding email requirement through either field,
 * depending on the authentication strategy and SDK version.
 */
export function requiresEmailVerification(
  state: EmailVerificationState | null | undefined,
): boolean {
  return (
    state?.unverifiedFields?.includes("email_address") === true ||
    state?.verifications?.emailAddress?.status === "unverified"
  );
}