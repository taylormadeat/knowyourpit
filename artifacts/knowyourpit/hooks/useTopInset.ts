import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { WEB_PREVIEW_TOP_OFFSET } from "@/constants/layout";

/**
 * Returns the top padding screens should apply so their content
 * clears both the device safe area and the Replit web preview
 * proxy chrome.
 *
 * This wraps the common pattern:
 *   insets.top + (Platform.OS === "web" ? 67 : 0)
 * so the magic offset lives in `constants/layout.ts` only.
 */
export function useTopInset() {
  const insets = useSafeAreaInsets();
  return insets.top + (Platform.OS === "web" ? WEB_PREVIEW_TOP_OFFSET : 0);
}
