import {
  buildCenterTemperatureReadouts,
  formatCheckinRecency,
  getTemperatureVariance,
} from "../temperatureChips";

describe("temperature chip state", () => {
  const nowMs = Date.parse("2026-08-23T18:00:00.000Z");

  it("describes meat and pit readings above, below, and at their targets", () => {
    expect(getTemperatureVariance(165, 160, "target")?.text).toBe("+5°F · above target");
    expect(getTemperatureVariance(325, 350, "setpoint")?.text).toBe("−25°F · below setpoint");
    expect(getTemperatureVariance(349.6, 350, "setpoint")?.text).toBe("±0°F · at setpoint");
  });

  it("uses both current live readings and never substitutes planned values", () => {
    const readouts = buildCenterTemperatureReadouts({
      liveMeatTempF: 157,
      livePitTempF: 284,
      manualMeatTempF: 140,
      manualPitTempF: 225,
      manualCreatedAt: "2026-08-23T17:00:00.000Z",
      nowMs,
    });

    expect(readouts.source).toBe("live");
    expect(readouts.meat?.tempF).toBe(157);
    expect(readouts.pit?.tempF).toBe(284);
    expect(readouts.meat?.recencyLabel).toBeNull();
  });

  it("uses the latest manual values only when no live channel exists", () => {
    const readouts = buildCenterTemperatureReadouts({
      manualMeatTempF: 142,
      manualPitTempF: 245,
      manualCreatedAt: "2026-08-23T17:42:00.000Z",
      nowMs,
    });

    expect(readouts.source).toBe("manual");
    expect(readouts.meat?.tempF).toBe(142);
    expect(readouts.pit?.tempF).toBe(245);
    expect(readouts.meat?.recencyLabel).toBe("18 min ago");
  });

  it("omits unavailable values and does not mix manual data into partial live state", () => {
    const readouts = buildCenterTemperatureReadouts({
      liveMeatTempF: 151,
      livePitTempF: null,
      manualPitTempF: 230,
      manualCreatedAt: "2026-08-23T17:30:00.000Z",
      nowMs,
    });

    expect(readouts.meat?.tempF).toBe(151);
    expect(readouts.pit).toBeNull();
  });

  it("formats check-in recency for a manual-only display", () => {
    expect(formatCheckinRecency("2026-08-23T17:59:30.000Z", nowMs)).toBe("just now");
    expect(formatCheckinRecency("2026-08-23T15:00:00.000Z", nowMs)).toBe("3h ago");
    expect(formatCheckinRecency(null, nowMs)).toBeNull();
  });
});