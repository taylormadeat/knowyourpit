/**
 * Unit tests for the pure helpers exported from useZeroconfDiscovery:
 *   - addHost   — host deduplication and "unknown" type filtering
 *   - removeHost — pruning hosts from the discovered map
 *
 * The hook wiring (mdnsScanEmpty, evictHost, persistence) is covered by the
 * integration-level tests in useLanProbes.test.ts.
 */

// AsyncStorage and Platform are imported by the module under test even though
// the pure functions being tested here don't use them — mock both so the
// module can be loaded in a Jest environment without native modules.
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (obj: Record<string, unknown>) => obj["ios"] ?? obj["default"] },
  useEffect: jest.fn(),
  useState: jest.fn(),
  useRef: jest.fn(),
  useCallback: jest.fn(),
}));

import { addHost, removeHost } from "../useZeroconfDiscovery";
import type { DiscoveredHosts } from "../useZeroconfDiscovery";

describe("addHost", () => {
  describe("mDNS host deduplication", () => {
    it("adds a host to an empty map", () => {
      const result = addHost({}, "meater_block", "192.168.1.10");
      expect(result).toEqual({ meater_block: ["192.168.1.10"] });
    });

    it("appends a new host to an existing list", () => {
      const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
      const result = addHost(initial, "meater_block", "192.168.1.11");
      expect(result.meater_block).toEqual(["192.168.1.10", "192.168.1.11"]);
    });

    it("does not duplicate a host that is already in the list", () => {
      const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
      const result = addHost(initial, "meater_block", "192.168.1.10");
      expect(result.meater_block).toEqual(["192.168.1.10"]);
    });

    it("does not mutate the original map", () => {
      const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
      addHost(initial, "meater_block", "192.168.1.11");
      expect(initial.meater_block).toEqual(["192.168.1.10"]);
    });

    it("keeps different device-type slots independent", () => {
      const initial: DiscoveredHosts = { fireboard: ["192.168.1.20"] };
      const result = addHost(initial, "meater_block", "192.168.1.10");
      expect(result.fireboard).toEqual(["192.168.1.20"]);
      expect(result.meater_block).toEqual(["192.168.1.10"]);
    });

    it("ignores 'unknown' type — never adds to the map", () => {
      const result = addHost({}, "unknown", "192.168.1.99");
      expect(result).toEqual({});
    });
  });

  describe("_meater._tcp vs _http._tcp — forced type path", () => {
    it("adds a host as meater_block when forced type is used (simulating _meater._tcp)", () => {
      const result = addHost({}, "meater_block", "192.168.1.50");
      expect(result).toEqual({ meater_block: ["192.168.1.50"] });
    });

    it("deduplicates when the same IP is discovered via both _meater._tcp and _http._tcp", () => {
      const afterHttpTcp = addHost({}, "meater_block", "192.168.1.50");
      const afterMeaterTcp = addHost(afterHttpTcp, "meater_block", "192.168.1.50");
      expect(afterMeaterTcp.meater_block).toEqual(["192.168.1.50"]);
    });
  });
});

describe("removeHost", () => {
  it("removes a host from the discovered map", () => {
    const initial: DiscoveredHosts = { meater_block: ["192.168.1.10", "192.168.1.11"] };
    const result = removeHost(initial, "meater_block", "192.168.1.10");
    expect(result.meater_block).toEqual(["192.168.1.11"]);
  });

  it("removes the key entirely when the last host is removed", () => {
    const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
    const result = removeHost(initial, "meater_block", "192.168.1.10");
    expect(result.meater_block).toBeUndefined();
  });

  it("returns the map unchanged when the type key is absent", () => {
    const initial: DiscoveredHosts = { fireboard: ["192.168.1.20"] };
    const result = removeHost(initial, "meater_block", "192.168.1.10");
    expect(result).toEqual(initial);
  });

  it("returns the map unchanged when the host is not in the list", () => {
    const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
    const result = removeHost(initial, "meater_block", "192.168.1.99");
    expect(result.meater_block).toEqual(["192.168.1.10"]);
  });

  it("does not mutate the original map", () => {
    const initial: DiscoveredHosts = { meater_block: ["192.168.1.10"] };
    removeHost(initial, "meater_block", "192.168.1.10");
    expect(initial.meater_block).toEqual(["192.168.1.10"]);
  });

  it("leaves other device-type slots untouched during removal", () => {
    const initial: DiscoveredHosts = {
      meater_block: ["192.168.1.10"],
      fireboard: ["192.168.1.20"],
    };
    const result = removeHost(initial, "meater_block", "192.168.1.10");
    expect(result.fireboard).toEqual(["192.168.1.20"]);
  });
});
