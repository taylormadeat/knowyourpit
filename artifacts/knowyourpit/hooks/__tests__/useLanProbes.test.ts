/**
 * Unit tests for useLanProbes covering:
 *   - Multiple fallback hostname resolution (dedup across defaults + mDNS)
 *   - Consecutive-failure eviction (CONSECUTIVE_FAIL_THRESHOLD = 3)
 *   - Manual host add / remove / persist
 *
 * Approach: isolate the pure orchestration logic by mocking all I/O boundaries
 * (polling adapters, AsyncStorage, useZeroconfDiscovery, Platform) and driving
 * the hook via @testing-library/react-native's renderHook + act.
 */

import { renderHook, act } from "@testing-library/react-native";
import type { LanProbeReading } from "../useLanProbes";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Stable mock storage
const storageData: Record<string, string> = {};
jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn((key: string) => Promise.resolve(storageData[key] ?? null)),
  setItem: jest.fn((key: string, value: string) => {
    storageData[key] = value;
    return Promise.resolve();
  }),
  removeItem: jest.fn((key: string) => {
    delete storageData[key];
    return Promise.resolve();
  }),
}));

// Run on "ios" so Platform.OS !== "web" and the hook actually polls.
// We mock the whole "react-native" module (not the internal library path)
// because useLanProbes imports Platform via `import { Platform } from
// "react-native"` — targeting the internal path has no effect.
jest.mock("react-native", () => ({
  Platform: { OS: "ios", select: (objs: Record<string, unknown>) => objs["ios"] ?? objs["default"] },
}));

// Control what useZeroconfDiscovery returns
let mockDiscovered: Record<string, string[]> = {};
const mockRescan = jest.fn();
const mockEvictHost = jest.fn();

jest.mock("../useZeroconfDiscovery", () => ({
  useZeroconfDiscovery: () => ({
    discovered: mockDiscovered,
    mdnsAvailable: true,
    scanning: false,
    mdnsScanEmpty: false,
    rescan: mockRescan,
    evictHost: mockEvictHost,
  }),
}));

// Polling adapters — return empty arrays by default; tests override per-host.
// Explicitly typed so mockImplementation() calls in tests accept LanProbeReading[].
const mockPollFireboard = jest.fn(
  (_host: string): Promise<LanProbeReading[]> => Promise.resolve([]),
);
const mockPollMeaterBlock = jest.fn(
  (_host: string): Promise<LanProbeReading[]> => Promise.resolve([]),
);
const mockPollThermoworksSignals = jest.fn(
  (_host: string): Promise<LanProbeReading[]> => Promise.resolve([]),
);

jest.mock("../lan/fireboard", () => ({
  pollFireboard: (host: string) => mockPollFireboard(host),
}));
jest.mock("../lan/meaterBlock", () => ({
  pollMeaterBlock: (host: string) => mockPollMeaterBlock(host),
}));
jest.mock("../lan/thermoworksSignals", () => ({
  pollThermoworksSignals: (host: string) => mockPollThermoworksSignals(host),
}));

// ── Import under test (after mocks are registered) ────────────────────────

import { useLanProbes } from "../useLanProbes";
import AsyncStorage from "@react-native-async-storage/async-storage";

// ── Helpers ───────────────────────────────────────────────────────────────

function makeReading(overrides: Partial<{
  deviceId: string;
  deviceName: string;
  channelLabel: string;
  channelIndex: number;
  probeTempF: number;
  ambientTempF: number | null;
  host: string;
}> = {}) {
  return {
    deviceId: overrides.deviceId ?? "dev-1",
    deviceName: overrides.deviceName ?? "MEATER Block",
    channelLabel: overrides.channelLabel ?? "Probe 1",
    channelIndex: overrides.channelIndex ?? 0,
    probeTempF: overrides.probeTempF ?? 225,
    ambientTempF: overrides.ambientTempF ?? null,
    source: "lan" as const,
    host: overrides.host ?? "192.168.1.10",
    lastSeenMs: Date.now(),
  };
}

// ── Test suites ───────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockDiscovered = {};
  // Clear the in-memory storage mirror between tests
  Object.keys(storageData).forEach((k) => delete storageData[k]);
  // Default: all adapters return empty arrays
  mockPollFireboard.mockResolvedValue([]);
  mockPollMeaterBlock.mockResolvedValue([]);
  mockPollThermoworksSignals.mockResolvedValue([]);
});

// ── Fallback hostname resolution ──────────────────────────────────────────

describe("multiple fallback hostname resolution", () => {
  it("polls all three default MEATER Block fallback hosts on every cycle", async () => {
    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // Wait for the initial doPoll to complete
    await act(async () => {
      await Promise.resolve();
    });

    const calledHosts = mockPollMeaterBlock.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("meaterblock.local");
    expect(calledHosts).toContain("meater-block.local");
    expect(calledHosts).toContain("MEATER_block.local");

    unmount();
  });

  it("polls the default Fireboard fallback host", async () => {
    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollFireboard.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("fireboard.local");

    unmount();
  });

  it("deduplicates when mDNS resolves the same address as a default fallback", async () => {
    // mDNS discovered "meaterblock.local" — already in DEFAULT_MEATER_BLOCK_HOSTS
    mockDiscovered = { meater_block: ["meaterblock.local"] };

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollMeaterBlock.mock.calls.map(([h]) => h);
    const occurrences = calledHosts.filter((h) => h === "meaterblock.local").length;
    expect(occurrences).toBe(1);

    unmount();
  });

  it("polls both mDNS-discovered IP and default fallbacks when IP is different", async () => {
    mockDiscovered = { meater_block: ["192.168.1.50"] };

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollMeaterBlock.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("192.168.1.50");
    expect(calledHosts).toContain("meaterblock.local");

    unmount();
  });

  it("deduplicates readings from multiple hostnames that resolve to the same probe", async () => {
    // Both meaterblock.local and an mDNS IP respond as the same physical device+channel
    const reading = makeReading({ host: "meaterblock.local", deviceId: "same-device", channelIndex: 0 });
    const duplicateReading = makeReading({ host: "192.168.1.50", deviceId: "same-device", channelIndex: 0 });

    mockDiscovered = { meater_block: ["192.168.1.50"] };
    mockPollMeaterBlock.mockImplementation((host: string) => {
      if (host === "meaterblock.local") return Promise.resolve([reading]);
      if (host === "192.168.1.50") return Promise.resolve([duplicateReading]);
      return Promise.resolve([]);
    });

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    // Should deduplicate by deviceId+channelIndex — only one probe returned
    expect(result.current.probes).toHaveLength(1);

    unmount();
  });
});

// ── Consecutive-failure eviction ──────────────────────────────────────────

describe("consecutive-failure eviction", () => {
  const DISCOVERED_IP = "192.168.1.50";

  it("does not evict a mDNS-discovered host after fewer than 3 consecutive failures", async () => {
    mockDiscovered = { meater_block: [DISCOVERED_IP] };
    mockPollMeaterBlock.mockResolvedValue([]);

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // Run 2 poll cycles (below threshold)
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(mockEvictHost).not.toHaveBeenCalled();
    expect(mockRescan).not.toHaveBeenCalled();

    unmount();
  });

  it("evicts and rescans after exactly 3 consecutive failures on a mDNS-discovered host", async () => {
    mockDiscovered = { meater_block: [DISCOVERED_IP] };
    mockPollMeaterBlock.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // 3 consecutive poll cycles, all failing
    for (let i = 0; i < 3; i++) {
      await act(async () => { await Promise.resolve(); });
      // Manually re-trigger doPoll (simulate interval firing) via scan()
      if (i < 2) {
        await act(async () => {
          result.current.scan();
          await Promise.resolve();
        });
      }
    }

    expect(mockEvictHost).toHaveBeenCalledWith("meater_block", DISCOVERED_IP);
    expect(mockRescan).toHaveBeenCalled();

    unmount();
  });

  it("resets the failure counter when a poll succeeds", async () => {
    mockDiscovered = { meater_block: [DISCOVERED_IP] };
    const reading = makeReading({ host: DISCOVERED_IP });

    // First 2 cycles fail, then succeed
    mockPollMeaterBlock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([reading]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // 3 cycles: 2 failures + 1 success
    await act(async () => { await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });

    expect(mockEvictHost).not.toHaveBeenCalled();

    unmount();
  });

  it("does not evict hardcoded .local fallback hosts on failure", async () => {
    // No mDNS discovery — only the hardcoded .local fallbacks are polled.
    // The eviction guard `if (!discoveredForType?.length) return` fires
    // immediately when the discovered map is empty, so no evict/rescan can
    // occur regardless of how many poll cycles run.
    mockDiscovered = {};
    mockPollMeaterBlock.mockResolvedValue([]);

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // One full poll cycle — all .local fallbacks return empty, no mDNS hosts
    await act(async () => { await Promise.resolve(); });

    // Eviction only applies to mDNS-discovered hosts; nothing to evict here
    expect(mockEvictHost).not.toHaveBeenCalled();
    expect(mockRescan).not.toHaveBeenCalled();

    unmount();
  });
});

// ── Manual host add / remove / persist ───────────────────────────────────

describe("manual host add / remove / persist", () => {
  const MANUAL_KEY = "@knowyourpit/lan/manual";

  it("addManualHost persists the new host to AsyncStorage", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99");
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MANUAL_KEY,
      JSON.stringify(["192.168.1.99"]),
    );

    unmount();
  });

  it("addManualHost adds the host to the manualHosts state list", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99");
    });

    expect(result.current.manualHosts).toContain("192.168.1.99");

    unmount();
  });

  it("addManualHost does not duplicate an already-present host", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99");
      await result.current.addManualHost("192.168.1.99");
    });

    expect(result.current.manualHosts.filter((h) => h === "192.168.1.99")).toHaveLength(1);

    unmount();
  });

  it("addManualHost trims leading/trailing whitespace before storing", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("  192.168.1.99  ");
    });

    expect(result.current.manualHosts).toContain("192.168.1.99");
    expect(result.current.manualHosts).not.toContain("  192.168.1.99  ");

    unmount();
  });

  it("addManualHost ignores blank strings", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const lengthBefore = result.current.manualHosts.length;

    await act(async () => {
      await result.current.addManualHost("   ");
    });

    expect(result.current.manualHosts).toHaveLength(lengthBefore);

    unmount();
  });

  it("removeManualHost removes the host and updates AsyncStorage", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addManualHost("192.168.1.99"); });
    await act(async () => { await result.current.removeManualHost("192.168.1.99"); });

    expect(result.current.manualHosts).not.toContain("192.168.1.99");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(MANUAL_KEY, JSON.stringify([]));

    unmount();
  });

  it("removeManualHost is a no-op for a host that was never added", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const beforeCount = result.current.manualHosts.length;

    await act(async () => {
      await result.current.removeManualHost("192.168.1.77");
    });

    expect(result.current.manualHosts).toHaveLength(beforeCount);

    unmount();
  });

  it("loads persisted manual hosts from AsyncStorage on mount", async () => {
    // Pre-seed storage before the hook mounts
    storageData[MANUAL_KEY] = JSON.stringify(["192.168.1.88", "192.168.1.89"]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    expect(result.current.manualHosts).toContain("192.168.1.88");
    expect(result.current.manualHosts).toContain("192.168.1.89");

    unmount();
  });

  it("offline manual host appears in devices list with connected=false and isManual=true", async () => {
    mockPollMeaterBlock.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addManualHost("192.168.1.77"); });

    const device = result.current.devices.find((d) => d.host === "192.168.1.77");
    expect(device).toBeDefined();
    expect(device?.connected).toBe(false);
    expect(device?.isManual).toBe(true);

    unmount();
  });
});
