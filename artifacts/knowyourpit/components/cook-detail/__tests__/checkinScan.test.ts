import {
  classifyCheckinScanFailure,
  extractCheckinScanTemperatures,
} from "../checkinScan";

describe("check-in image scan parsing", () => {
  it("uses labeled pit and meat channels from the structured analysis", () => {
    expect(
      extractCheckinScanTemperatures({
        probes: [
          { probeName: "Pit / Ambient", finishingTempF: 247 },
          { probeName: "Brisket", finishingTempF: 158 },
        ],
      }),
    ).toEqual({ pitTempF: 247, internalTempF: 158 });
  });

  it("falls back to readable temperatures in raw thermometer text", () => {
    expect(
      extractCheckinScanTemperatures({
        probes: [],
        rawExtraction: "Pit 275°F · Internal 164°F",
      }),
    ).toEqual({ pitTempF: 275, internalTempF: 164 });
  });

  it("returns nulls when an image has no usable temperatures", () => {
    expect(
      extractCheckinScanTemperatures({
        noDataFound: true,
        rawExtraction: "Thermometer app home screen",
      }),
    ).toEqual({ pitTempF: null, internalTempF: null });
  });

  it("distinguishes offline and paywall failures", () => {
    expect(classifyCheckinScanFailure({ message: "Network request failed" })).toBe("offline");
    expect(classifyCheckinScanFailure({ status: 402 })).toBe("limit");
    expect(classifyCheckinScanFailure({ message: "Unexpected response" })).toBe("error");
  });
});