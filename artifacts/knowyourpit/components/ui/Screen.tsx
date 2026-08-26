import React from "react";
import { View, StyleSheet, ScrollView, Platform, type ViewProps, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { WEB_PREVIEW_BOTTOM_OFFSET, WEB_PREVIEW_TOP_OFFSET } from "@/constants/layout";
import { spacing } from "@/constants/theme";

interface ScreenProps extends ViewProps {
  scroll?: boolean;
  scrollViewProps?: ScrollViewProps;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  preset?: "default" | "centered" | "form";
  withBottomNav?: boolean;
}

export function Screen({
  scroll = false,
  scrollViewProps,
  style,
  contentContainerStyle,
  edges = ["top", "bottom", "left", "right"],
  preset = "default",
  withBottomNav = false,
  children,
  ...props
}: ScreenProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const isWeb = Platform.OS === "web";
  const webTop = isWeb ? WEB_PREVIEW_TOP_OFFSET : 0;
  const webBottom = isWeb ? WEB_PREVIEW_BOTTOM_OFFSET : 0;
  
  const paddingTop = edges.includes("top") ? insets.top + webTop : 0;
  const paddingBottom = edges.includes("bottom") 
    ? insets.bottom + webBottom + (withBottomNav && isWeb ? 84 : 0) + (withBottomNav && !isWeb ? 60 : 0)
    : 0;
  const paddingLeft = edges.includes("left") ? insets.left : 0;
  const paddingRight = edges.includes("right") ? insets.right : 0;

  const baseStyle = {
    flex: 1,
    backgroundColor: colors.background,
    paddingTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
  };

  const getPresetStyles = () => {
    switch (preset) {
      case "centered":
        return {
          justifyContent: "center" as const,
          alignItems: "center" as const,
          padding: spacing.xxl,
        };
      case "form":
        return {
          paddingHorizontal: spacing.xl,
          paddingTop: paddingTop + spacing.lg,
        };
      case "default":
      default:
        return {};
    }
  };

  if (scroll) {
    return (
      <View style={[baseStyle, style]} {...props}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.scrollContent,
            getPresetStyles(),
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[baseStyle, getPresetStyles(), style]} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
  },
});
