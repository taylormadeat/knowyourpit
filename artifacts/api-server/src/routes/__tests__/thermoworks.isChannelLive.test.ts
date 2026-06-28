import { describe, it, expect } from "vitest";
import {
  isChannelLive,
  READING_FRESH_WINDOW_MS,
  type ChannelReading,
} from "../thermoworks";

const freshDate = (): Date => new Date(Date.now() - 30_000);
const staleDate = (): Date => new Date(Date.now() - READING_FRESH_WINDOW_MS - 1_000);

function channel(overrides: Partial<ChannelReading> = {}): ChannelReading {
  return {
    channelNumber: "1",
    label: "Probe 1",
    status: "CONNECTED",
    units: "F",
    value: 225,
    lastSeen: freshDate(),
    connected: null,
    signalStrength: null,
    ...overrides,
  };
}

describe("isChannelLive", () => {
  it("returns false when connected is explicitly false (RFX empty slot)", () => {
    expect(isChannelLive(channel({ connected: false }))).toBe(false);
  });

  it("returns false when connected is null and signalStrength is 0 (RFX firmware omit case)", () => {
    expect(isChannelLive(channel({ connected: null, signalStrength: 0 }))).toBe(false);
  });

  it("passes the connected checks when connected is null and signalStrength is null (non-RFX device)", () => {
    expect(
      isChannelLive(channel({ connected: null, signalStrength: null })),
    ).toBe(true);
  });

  describe("isRfx=true (RFX MEAT receiver ghost-slot guard)", () => {
    it("returns false when connected is null and signalStrength is null (phantom RFX MEAT channel slot)", () => {
      expect(
        isChannelLive(
          channel({ connected: null, signalStrength: null, status: "CONNECTED", value: 155, lastSeen: freshDate() }),
          true,
        ),
      ).toBe(false);
    });

    it("returns false when connected is false (explicitly empty RFX slot)", () => {
      expect(
        isChannelLive(channel({ connected: false, status: "CONNECTED", value: 155, lastSeen: freshDate() }), true),
      ).toBe(false);
    });

    it("returns false when connected is null and signalStrength is 0", () => {
      expect(
        isChannelLive(
          channel({ connected: null, signalStrength: 0, status: "CONNECTED", value: 155, lastSeen: freshDate() }),
          true,
        ),
      ).toBe(false);
    });

    it("returns true when connected is explicitly true and channel is otherwise healthy", () => {
      expect(
        isChannelLive(
          channel({ connected: true, status: "CONNECTED", value: 155, lastSeen: freshDate() }),
          true,
        ),
      ).toBe(true);
    });
  });

  describe("isRfx=false (non-RFX devices unaffected by RFX guard)", () => {
    it("returns true when connected is null and signalStrength is null (normal non-RFX channel)", () => {
      expect(
        isChannelLive(
          channel({ connected: null, signalStrength: null, status: "CONNECTED", value: 155, lastSeen: freshDate() }),
          false,
        ),
      ).toBe(true);
    });
  });

  it("returns true when connected is true with valid status and fresh timestamp", () => {
    expect(
      isChannelLive(
        channel({
          connected: true,
          status: "CONNECTED",
          value: 155,
          lastSeen: freshDate(),
        }),
      ),
    ).toBe(true);
  });

  it("returns true for a healthy non-RFX channel with valid status and fresh timestamp", () => {
    expect(
      isChannelLive(
        channel({
          connected: null,
          signalStrength: null,
          status: "CONNECTED",
          value: 155,
          lastSeen: freshDate(),
        }),
      ),
    ).toBe(true);
  });

  it("returns true for each status in the active-status allowlist", () => {
    const statuses = [
      "CONNECTED",
      "ACTIVE",
      "OK",
      "IN_SESSION",
      "LIVE",
      "MEASURING",
      "RECORDING",
      "PROBE_CONNECTED",
    ];
    for (const status of statuses) {
      expect(isChannelLive(channel({ status }))).toBe(true);
    }
  });

  it("returns false when lastSeen is older than the freshness window (stale)", () => {
    expect(isChannelLive(channel({ lastSeen: staleDate() }))).toBe(false);
  });

  it("returns false when status is 'OPEN' (open-circuit / no probe)", () => {
    expect(isChannelLive(channel({ status: "OPEN" }))).toBe(false);
  });

  it("returns false when status is an unknown / unrecognised string", () => {
    expect(isChannelLive(channel({ status: "UNKNOWN_FUTURE_STATUS" }))).toBe(false);
  });

  it("returns false when status is null", () => {
    expect(isChannelLive(channel({ status: null }))).toBe(false);
  });

  it("returns false when the channel value is null (null probe reading)", () => {
    expect(isChannelLive(channel({ value: null }))).toBe(false);
  });

  it("returns false when lastSeen is null (no timestamp available)", () => {
    expect(isChannelLive(channel({ lastSeen: null }))).toBe(false);
  });

  it("returns false for a null-like object (safety: all fields null)", () => {
    expect(
      isChannelLive({
        channelNumber: "3",
        label: null,
        status: null,
        units: null,
        value: null,
        lastSeen: null,
        connected: null,
        signalStrength: null,
      }),
    ).toBe(false);
  });

  it("respects the exact freshness boundary (just inside window → live)", () => {
    const justInside = new Date(Date.now() - READING_FRESH_WINDOW_MS + 500);
    expect(isChannelLive(channel({ lastSeen: justInside }))).toBe(true);
  });

  it("respects the exact freshness boundary (just outside window → stale)", () => {
    const justOutside = new Date(Date.now() - READING_FRESH_WINDOW_MS - 500);
    expect(isChannelLive(channel({ lastSeen: justOutside }))).toBe(false);
  });
});
