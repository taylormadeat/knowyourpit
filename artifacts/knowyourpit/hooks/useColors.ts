import { useColorScheme } from "react-native";
import { useUIMode } from "@/contexts/UIModeContext";
import colors from "@/constants/colors";
import { previewColors } from "@/constants/colors.preview";

/**
 * Returns the design tokens for the current color scheme.
 * Adapts to 'legacy' or 'preview' mode based on UIModeContext.
 */
export function useColors() {
  const scheme = useColorScheme();
  const { mode } = useUIMode();

  const paletteSource = mode === "preview" ? previewColors : colors;

  const palette =
    scheme === "dark" && "dark" in paletteSource
      ? (paletteSource as unknown as Record<string, typeof colors.light>).dark
      : paletteSource.light;

  return { ...palette, radius: paletteSource.radius };
}
