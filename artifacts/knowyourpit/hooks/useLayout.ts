import { Platform, useWindowDimensions } from "react-native";

export const TABLET_BREAKPOINT = 740;

export function useLayout() {
  const { width } = useWindowDimensions();
  const isIPad = Platform.OS === "ios" && Platform.isPad === true;
  const isTablet = isIPad || width >= TABLET_BREAKPOINT;

  const horizontalPadding = isTablet
    ? Math.min(48, Math.max(24, Math.round(width * 0.04)))
    : 16;

  const usable = Math.max(0, width - horizontalPadding * 2);
  const contentMaxWidth = isTablet ? Math.min(usable, 720) : width;
  const detailMaxWidth = isTablet ? Math.min(usable, 880) : width;
  const authMaxWidth = isTablet ? Math.min(usable, 520) : width;

  return {
    isTablet,
    contentMaxWidth,
    detailMaxWidth,
    authMaxWidth,
    numColumns: isTablet ? 2 : 1,
    horizontalPadding,
  };
}
