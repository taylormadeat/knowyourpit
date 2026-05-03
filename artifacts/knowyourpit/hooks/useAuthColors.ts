import colors from "@/constants/colors";

/**
 * Auth screens are always rendered with the dark palette regardless of
 * the device's color scheme. This keeps sign-in / sign-up / reset-password
 * visually consistent with the rest of the (dark-only) app and matches
 * the App Store screenshots, so reviewers don't see a light screen that
 * looks unfinished or off-brand.
 */
export function useAuthColors() {
  return { ...colors.dark, radius: colors.radius };
}
