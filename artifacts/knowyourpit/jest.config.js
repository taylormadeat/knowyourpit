/** @type {import('jest').Config} */
const config = {
  preset: "jest-expo",
  testMatch: ["**/hooks/**/__tests__/**/*.test.[jt]s?(x)"],
  // pnpm stores packages in node_modules/.pnpm/<name>@<ver>/node_modules/<name>
  // so the naive `node_modules/(?!react-native...)` pattern matches the .pnpm
  // directory and excludes everything from transformation.  This pattern handles
  // both flat (npm/yarn) and pnpm-deep layouts by anchoring on the real package
  // path rather than the top-level node_modules directory.
  transformIgnorePatterns: [
    "node_modules/(?!(?:.pnpm/)?(?:react-native|@react-native(?:-community)?|expo(?:nent)?|@expo(?:nent)?|@expo-google-fonts|react-navigation|@react-navigation|react-native-zeroconf|@testing-library/react-native)[^/]*/)",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
};

module.exports = config;
