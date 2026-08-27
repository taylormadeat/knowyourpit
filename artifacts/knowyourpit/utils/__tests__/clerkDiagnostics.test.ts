import {
  getClerkDiagnostics,
  selectClerkPublishableKey,
} from "@/lib/clerkDiagnostics";

const developmentKey = "pk_test_development";
const productionKey = "pk_live_production";

describe("Clerk key selection", () => {
  it("uses the development key in the no-dev browser preview", () => {
    expect(
      selectClerkPublishableKey({
        productionKey,
        developmentKey,
        isDev: false,
        isPreview: true,
      }),
    ).toBe(developmentKey);
  });

  it("does not fall back to a production key when preview development config is missing", () => {
    expect(
      selectClerkPublishableKey({
        productionKey,
        developmentKey: "",
        isDev: false,
        isPreview: true,
      }),
    ).toBe("");
  });

  it("uses the development key in a normal development build", () => {
    expect(
      selectClerkPublishableKey({
        productionKey,
        developmentKey,
        isDev: true,
        isPreview: false,
      }),
    ).toBe(developmentKey);
  });

  it("uses the production key in a release build", () => {
    expect(
      selectClerkPublishableKey({
        productionKey,
        developmentKey,
        isDev: false,
        isPreview: false,
      }),
    ).toBe(productionKey);
  });

  it("retains the release fallback so a development key is diagnosed", () => {
    expect(
      selectClerkPublishableKey({
        productionKey: "",
        developmentKey,
        isDev: false,
        isPreview: false,
      }),
    ).toBe(developmentKey);
  });
});

describe("Clerk diagnostics", () => {
  it("does not flag a development key in the no-dev browser preview", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: developmentKey,
        isDev: false,
        isPreview: true,
      }),
    ).toEqual([]);
  });

  it("does not flag the development key in a normal development build", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: developmentKey,
        isDev: true,
        isPreview: false,
      }),
    ).toEqual([]);
  });

  it("flags a missing key in a real release build", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: "",
        isDev: false,
        isPreview: false,
      }),
    ).toEqual(["missing-key"]);
  });

  it("flags a development key in a real release build", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: developmentKey,
        isDev: false,
        isPreview: false,
      }),
    ).toEqual(["development-key-in-release"]);
  });

  it("does not flag a production key in a real release build", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: productionKey,
        isDev: false,
        isPreview: false,
      }),
    ).toEqual([]);
  });

  it("keeps missing-key diagnostics active in the preview", () => {
    expect(
      getClerkDiagnostics({
        clerkPubKey: "",
        isDev: false,
        isPreview: true,
      }),
    ).toEqual(["missing-key"]);
  });
});