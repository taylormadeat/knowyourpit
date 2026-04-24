import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WEB_PREVIEW_BOTTOM_OFFSET } from "@/constants/layout";

/**
 * Returns the bottom padding screens should apply so their content
 * clears both the device safe area and the Replit web preview
 * proxy chrome at the bottom of the viewport.
 *
 * This wraps the common pattern:
 *   insets.bottom + (Platform.OS === "web" ? 34 : 0)
 * so the magic offset lives in `constants/layout.ts` only.
 */
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  return insets.bottom + (Platform.OS === "web" ? WEB_PREVIEW_BOTTOM_OFFSET : 0);
}
