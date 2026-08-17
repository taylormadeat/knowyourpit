/**
 * Unit tests for classifyService — the _http._tcp heuristic classifier.
 *
 * Only Fireboard is detected on the LAN; every other service is "unknown".
 */

import { classifyService } from "../zeroconf";

describe("classifyService — _http._tcp classification", () => {
  describe("Fireboard detection", () => {
    it("classifies name containing 'fireboard' as fireboard", () => {
      expect(classifyService("fireboard2", "192.168.1.51", 80)).toBe("fireboard");
    });

    it("classifies name containing 'Fireboard' (mixed case) as fireboard", () => {
      expect(classifyService("Fireboard Drive", "192.168.1.51", 80)).toBe("fireboard");
    });

    it("classifies host containing 'fireboard' as fireboard", () => {
      expect(classifyService("SomeDevice", "fireboard.local", 80)).toBe("fireboard");
    });
  });

  describe("Unknown / unclassified services", () => {
    it("returns unknown for an unrelated service name", () => {
      expect(classifyService("AppleTV", "appletv.local", 7000)).toBe("unknown");
    });

    it("returns unknown for an empty name and unrecognised host", () => {
      expect(classifyService("", "192.168.1.99", 80)).toBe("unknown");
    });

    it("does not false-positive on partial substring matches (e.g. 'firma')", () => {
      expect(classifyService("firma-device", "firma.local", 80)).toBe("unknown");
    });
  });
});
