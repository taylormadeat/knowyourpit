import React from "react";
import { View, Text, TextInput, StyleSheet, type TextInputProps, type StyleProp, type ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { border, radii, spacing, typography } from "@/constants/theme";

export interface FieldProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Field = React.forwardRef<TextInput, FieldProps>(
  ({ label, error, hint, containerStyle, leftIcon, rightIcon, style, ...props }, ref) => {
    const colors = useColors();
    const [isFocused, setIsFocused] = React.useState(false);
    
    // Fallback for accessibility linkage
    const labelText = label || props.placeholder || "Input field";
    const hintText = error || hint;

    return (
      <View style={[styles.container, containerStyle]}>
        {label && (
          <Text 
            style={[styles.label, { color: colors.foreground }]}
            accessible={false}
            importantForAccessibility="no"
          >
            {label}
          </Text>
        )}
        
        <View
          style={[
            styles.inputContainer,
            {
              backgroundColor: colors.input,
              borderColor: error ? colors.destructive : isFocused ? colors.ring : colors.border,
              borderRadius: radii.lg,
            },
          ]}
        >
          {leftIcon && <View style={styles.iconLeft}>{leftIcon}</View>}
          
          <TextInput
            ref={ref}
            accessibilityLabel={labelText}
            accessibilityHint={hintText}
            accessibilityValue={error ? { text: "Invalid input" } : undefined}
            style={[
              styles.input,
              { color: colors.foreground },
              leftIcon ? { paddingLeft: 8 } : undefined,
              rightIcon ? { paddingRight: 8 } : undefined,
              style,
            ]}
            placeholderTextColor={colors.mutedForeground}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />

          {rightIcon && <View style={styles.iconRight}>{rightIcon}</View>}
        </View>

        {error ? (
          <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>
        ) : hint ? (
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>{hint}</Text>
        ) : null}
      </View>
    );
  }
);
Field.displayName = "Field";

const styles = StyleSheet.create({
  container: {
    gap: 6,
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontFamily: typography.fontFamily.medium,
    letterSpacing: -0.1,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: border.width.thin,
    minHeight: 48,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    height: "100%",
    paddingHorizontal: spacing.lg,
    fontSize: typography.fontSize.base,
    fontFamily: typography.fontFamily.regular,
  },
  iconLeft: {
    paddingLeft: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  iconRight: {
    paddingRight: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    fontSize: 13,
    fontFamily: typography.fontFamily.medium,
    marginTop: 2,
  },
  hint: {
    fontSize: 13,
    fontFamily: typography.fontFamily.regular,
    marginTop: 2,
  },
});
