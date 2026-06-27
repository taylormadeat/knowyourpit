/**
 * Unit tests for classifyService — the _http._tcp heuristic classifier.
 *
 * All `_meater._tcp` services bypass classifyService entirely and use a forced
 * "meater_block" type — that branch is covered in useZeroconfDiscovery.test.ts.
 */

import { classifyService } from "../zeroconf";

describe("classifyService — _http._tcp classification", () => {
  describe("MEATER Block detection", () => {
    it("classifies port 2345 as meater_block regardless of name", () => {
      expect(classifyService("SomeDevice", "somedevice.local", 2345)).toBe("meater_block");
    });

    it("classifies name containing 'meater' (lowercase) as meater_block", () => {
      expect(classifyService("meater-block", "192.168.1.50", 80)).toBe("meater_block");
    });

    it("classifies name containing 'MEATER' (uppercase) as meater_block", () => {
      expect(classifyService("MEATER Block", "192.168.1.50", 80)).toBe("meater_block");
    });

    it("classifies host containing 'meater' as meater_block", () => {
      expect(classifyService("SomeDevice", "meaterblock.local", 80)).toBe("meater_block");
    });

    it("classifies mixed-case 'MEATER_block.local' host as meater_block", () => {
      expect(classifyService("Unknown", "MEATER_block.local", 80)).toBe("meater_block");
    });
  });

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

  describe("ThermoWorks / Signals — classified as unknown (cloud devices, no LAN adapter)", () => {
    it("returns unknown for a 'thermoworks' service name", () => {
      expect(classifyService("thermoworks-signals", "192.168.1.52", 80)).toBe("unknown");
    });

    it("returns unknown for a 'signals' service name", () => {
      expect(classifyService("signals-bbq", "192.168.1.52", 80)).toBe("unknown");
    });

    it("returns unknown for 'thermoworks-signals.local' host", () => {
      expect(classifyService("Unknown", "thermoworks-signals.local", 80)).toBe("unknown");
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

  describe("Priority ordering", () => {
    it("prefers meater_block over fireboard when both name-substrings appear", () => {
      expect(classifyService("meater-fireboard", "192.168.1.53", 80)).toBe("meater_block");
    });

    it("prefers meater_block by port even when host looks like fireboard", () => {
      expect(classifyService("Unknown", "fireboard.local", 2345)).toBe("meater_block");
    });
  });
});
