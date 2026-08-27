import {
  resolveActivePartner,
  resolvePartnerVisibility,
} from "../useRemoteConfig";

describe("partner-card build separation", () => {
  const serverEnabled = { partnerBigPetes: true };
  const serverDisabled = { partnerBigPetes: false };

  it("shows partner cards in a preview/TestFlight build when the server allows them", () => {
    expect(resolvePartnerVisibility(true, serverEnabled)).toBe(true);
  });

  it("keeps partner cards hidden in a production/App Store build even when the server is enabled", () => {
    expect(resolvePartnerVisibility(false, serverEnabled)).toBe(false);
  });

  it("honors the server kill switch in every build", () => {
    expect(resolvePartnerVisibility(true, serverDisabled)).toBe(false);
    expect(resolvePartnerVisibility(false, serverDisabled)).toBe(false);
  });

  it("uses the build-specific value until remote config is available", () => {
    expect(resolvePartnerVisibility(true, null)).toBe(true);
    expect(resolvePartnerVisibility(false, null)).toBe(false);
  });

  it("uses the configured alternate partner when the server selects it", () => {
    expect(
      resolveActivePartner("bigPetes", true, {
        partnerBigPetes: true,
        activePartner: "barbecueLab",
      }),
    ).toBe("barbecueLab");
  });

  it("keeps the build partner when older server versions omit activePartner", () => {
    expect(resolveActivePartner("bigPetes", true, { partnerBigPetes: true })).toBe("bigPetes");
  });

  it("fails closed when the partner identity is invalid or the feature is off", () => {
    expect(
      resolveActivePartner("bigPetes", true, {
        partnerBigPetes: true,
        activePartner: "unknown-brand",
      }),
    ).toBeNull();
    expect(
      resolveActivePartner("barbecueLab", false, {
        partnerBigPetes: true,
        activePartner: "barbecueLab",
      }),
    ).toBeNull();
  });
});