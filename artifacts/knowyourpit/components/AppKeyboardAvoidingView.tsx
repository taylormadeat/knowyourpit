import { KeyboardAvoidingView, KeyboardAvoidingViewProps, Platform } from "react-native";

type Props = Omit<KeyboardAvoidingViewProps, "behavior">;

/**
 * Drop-in replacement for `KeyboardAvoidingView` with the correct cross-platform
 * behavior baked in: "padding" on iOS, "height" on Android. Use this inside every
 * modal or bottom sheet that contains text inputs so the keyboard never covers them.
 *
 * Usage:
 *   <AppKeyboardAvoidingView style={{ flex: 1 }}>
 *     ...modal content...
 *   </AppKeyboardAvoidingView>
 */
export function AppKeyboardAvoidingView({ children, ...props }: Props) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      {...props}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
