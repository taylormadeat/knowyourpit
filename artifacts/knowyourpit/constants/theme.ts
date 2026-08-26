import { StyleSheet, Platform } from "react-native";

export const typography = {
  fontFamily: {
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
    mono: Platform.select({ ios: "Menlo", default: "monospace" }),
  },
  fontSize: {
    xs: 11,
    sm: 13,
    base: 15,
    lg: 18,
    xl: 22,
    xxl: 28,
  },
  lineHeight: {
    xs: 16,
    sm: 18,
    base: 22,
    lg: 26,
    xl: 28,
    xxl: 34,
  }
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
};

export const border = {
  width: {
    hairline: StyleSheet.hairlineWidth,
    thin: 1,
    thick: 2,
  }
};

export const elevation = {
  none: 0,
  sm: 2,
  md: 4,
  lg: 8,
};

export const touch = {
  target: 44, // Apple's Human Interface Guidelines minimal touch target
};

export const icon = {
  sm: 14,
  md: 20,
  lg: 24,
  xl: 32,
};

export const motion = {
  fast: 150,
  normal: 250,
  slow: 350,
};

export const theme = {
  typography,
  spacing,
  radii,
  border,
  elevation,
  touch,
  icon,
  motion,
} as const;
