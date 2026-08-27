export type ClerkKeySelectionOptions = {
  productionKey: string;
  developmentKey: string;
  isDev: boolean;
  isPreview: boolean;
};

/**
 * Select the Clerk instance without allowing a browser preview to accidentally
 * use the production instance. Release builds retain the existing fallback so
 * a missing production key remains visible through the release diagnostic.
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