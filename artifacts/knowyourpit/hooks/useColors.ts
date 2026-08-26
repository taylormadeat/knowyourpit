import colors from "@/constants/colors";
import { theme } from "@/constants/theme";

/**
 * Returns the design tokens for the current color scheme.
 *
 * For KnowYourPit, the app is genuinely dark-first. We return the dark
 * palette universally to maintain the warm charcoal aesthetic regardless
 * of the device's light/dark mode preference.
 */
export function useColors() {
  return { ...colors.dark, radius: colors.radius, theme };
}
