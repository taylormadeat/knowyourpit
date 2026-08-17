/**
 * jest.setup.js — runs after the react-native preset's setupFiles.
 *
 * Problem: react-native@0.81.x registers class-based mocks (via mockComponent.js)
 * for several primitive components in its jest/setup.js (a setupFiles entry).
 * Those class mocks crash under react-test-renderer@19 because the renderer
 * calls `instance.constructor` in a way the mock factory's class doesn't handle.
 *
 * Fix: override each broken mock AFTER the preset's setupFiles run by
 * registering functional-component factories for the same module paths.
 * setupFilesAfterEnv entries run after setupFiles, so our jest.mock() calls
 * supersede the preset's.
 *
 * Rule: jest's babel-plugin-jest-hoist only allows factory functions to
 * reference "mock"-prefixed variables or global objects. Each factory below is
 * self-contained (no out-of-scope references).
 *
 * Shape: react-native/index.js accesses require('…/Component').default, so
 * each factory must return { default: FunctionalComponent }.
 */

// ── Text ────────────────────────────────────────────────────────────────────

jest.mock("react-native/Libraries/Text/Text", () => {
  const mockReact = require("react");
  const MockText = mockReact.forwardRef(function MockText(props, ref) {
    const { children, style, testID, numberOfLines, ...rest } = props;
    return mockReact.createElement("View", { style, testID, ref, ...rest }, children);
  });
  MockText.displayName = "Text";
  return { default: MockText };
});

// ── ActivityIndicator ────────────────────────────────────────────────────────

jest.mock(
  "react-native/Libraries/Components/ActivityIndicator/ActivityIndicator",
  () => {
    const mockReact = require("react");
    const MockActivityIndicator = mockReact.forwardRef(
      function MockActivityIndicator(props, ref) {
        const { style, testID, color, size, ...rest } = props;
        return mockReact.createElement("View", { style, testID, ref, ...rest });
      },
    );
    MockActivityIndicator.displayName = "ActivityIndicator";
    return { default: MockActivityIndicator };
  },
);
