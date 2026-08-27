export type ClerkKeySelectionOptions = {
  productionKey: string;
  developmentKey: string;
  isDev: boolean;
  isPreview: boolean;
};

/**
 * Replit's preview workflow explicitly sets this flag for every bundle it
 * serves. It applies to both the browser smoke-test preview and native Expo Go;
 * only browser-specific UI behavior should additionally check Platform.OS.
 */
export function isReplitPreviewBundle(
  previewMode: string | undefined,
): boolean {
  return previewMode === "true";
}

/**
 * Select the Clerk instance without allowing a Replit preview bundle to
 * accidentally use the production instance. Release builds retain the existing
 * fallback so a missing production key remains visible through the release
 * diagnostic.
 */
export function selectClerkPublishableKey({
  productionKey,
  developmentKey,
  isDev,
  isPreview,
}: ClerkKeySelectionOptions): string {
  if (isDev || isPreview) {
    return developmentKey;
  }

  return productionKey || developmentKey;
}

export type ClerkDiagnostic =
  | "missing-key"
  | "development-key-in-release";

export type ClerkDiagnosticOptions = {
  clerkPubKey: string;
  isDev: boolean;
  isPreview: boolean;
};

/**
 * A preview bundle can have __DEV__ === false because Metro is intentionally
 * started with --no-dev. Do not call its development key a production error,
 * but keep missing-key diagnostics and all real release safeguards intact.
 */
export function getClerkDiagnostics({
  clerkPubKey,
  isDev,
  isPreview,
}: ClerkDiagnosticOptions): ClerkDiagnostic[] {
  const diagnostics: ClerkDiagnostic[] = [];

  if (!clerkPubKey && !isDev) {
    diagnostics.push("missing-key");
  } else if (!isDev && !isPreview && clerkPubKey.startsWith("pk_test_")) {
    diagnostics.push("development-key-in-release");
  }

  return diagnostics;
}