import { resolvePartnerVisibility } from "../useRemoteConfig";

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
});