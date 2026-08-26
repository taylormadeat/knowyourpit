import { trackEvent } from "@/lib/trackEvent";

/**
 * Fixed labels only: never add identifiers, addresses, relay aliases, or
 * verification codes here. The analytics endpoint timestamps these events so
 * support can correlate a future report with Clerk's auth history.
 */
export type AuthVerificationFlow =
  | "email_password_signup"
  | "password_reset"
  | "password_second_factor"
  | "apple_native_transfer";

export type AuthVerificationStage =
  | "code_requested"
  | "code_resent"
  | "transfer_started"
  | "transfer_completed"
  | "email_verification_required";

export function trackAuthVerification(
  flow: AuthVerificationFlow,
  stage: AuthVerificationStage,
): void {
  trackEvent("auth_verification_flow", { flow, stage });
}