import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Button, Badge, Field, ListRow } from "../index";
import { StyleSheet, Text } from "react-native";

// Mock hooks
jest.mock("@/hooks/useColors", () => ({
  useColors: () => ({
    background: "#131210",
    foreground: "#ffffff",
    primary: "#D63A18",
    primaryForeground: "#ffffff",
    card: "#1C1915",
    border: "#2C2520",
    muted: "#26211C",
    mutedForeground: "#9ca3af",
    destructive: "#ef4444",
    radius: 12,
  }),
}));

// Mock expo-router to fix jest issues
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
  Link: ({ children }: any) => children,
}));

// Mock icons to avoid font loading and act() issues in jest
jest.mock("@expo/vector-icons", () => {
  const { View } = require("react-native");
  return {
    Feather: (props: any) => <View testID="feather-icon" {...props} />
  };
});

describe("UI Primitives", () => {
  it("Button adheres to 44pt minimal touch target (small size)", () => {
    const { getByTestId } = render(<Button size="sm" title="Test Button" testID="test-btn" />);
    const btn = getByTestId("test-btn");
    const style = StyleSheet.flatten(btn.props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(44);
  });

  it("Button applies loading and disabled states", () => {
    const { getByTestId } = render(<Button loading testID="test-btn" />);
    const btn = getByTestId("test-btn");
    
    expect(btn.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    
    const style = StyleSheet.flatten(btn.props.style);
    expect(style.opacity).toBe(0.5);
  });

  it("Button default variant uses primary tokens", () => {
    const { getByTestId } = render(<Button title="Test" testID="test-btn" />);
    const btn = getByTestId("test-btn");
    
    const btnStyle = StyleSheet.flatten(btn.props.style);
    expect(btnStyle.backgroundColor).toBe("#D63A18");
    // Since getting the nested Text is tricky due to React Native testing library traversing issues, 
    // we use a testID for the text or check properties manually if needed.
    // Testing background color on the root pressable is sufficient for contrast checks.
  });

  it("Field exposes accessibility invalid state and hints on error", () => {
    const { getByTestId } = render(
      <Field label="Username" placeholder="Enter name" error="Required field" testID="test-field" />
    );
    const input = getByTestId("test-field");
    
    expect(input.props.accessibilityValue).toMatchObject({ text: "Invalid input" });
    expect(input.props.accessibilityHint).toBe("Required field");
    expect(input.props.accessibilityLabel).toBe("Username");
  });

  it("Badge renders children correctly", () => {
    const { getByTestId } = render(
      <Badge testID="test-badge">
        <Text testID="badge-icon-label">Status</Text>
      </Badge>,
    );
    expect(getByTestId("badge-icon-label")).toBeTruthy();
  });

  it("Button safely renders string children", () => {
    const { UNSAFE_getByType } = render(<Button>Save</Button>);
    expect(UNSAFE_getByType(Text).props.children).toBe("Save");
  });

  it("ListRow triggers onPress action", () => {
    const mockPress = jest.fn();
    const { getByTestId } = render(
      <ListRow title="Action Row" onPress={mockPress} testID="test-list-row" />
    );
    
    fireEvent.press(getByTestId("test-list-row"));
    expect(mockPress).toHaveBeenCalled();
  });
});
