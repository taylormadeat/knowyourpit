/**
 * Unit tests for useLanProbes covering:
 *   - Fireboard fallback hostname resolution (dedup across default + mDNS)
 *   - Consecutive-failure eviction (CONSECUTIVE_FAIL_THRESHOLD = 3)
 *   - Manual host add / remove / persist
 *
 * Approach: isolate the pure orchestration logic by mocking all I/O boundaries
 * (polling adapters, AsyncStorage, useZeroconfDiscovery, Platform) and driving
 * the hook via @testing-library/react-native's renderHook + act.
 */

import { renderHook, act } from "@testing-library/react-native";
import type { LanProbeReading, ManualEntry } from "../useLanProbes";

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

// Polling adapter — returns empty array by default; tests override per-host.
// Explicitly typed so mockImplementation() calls in tests accept LanProbeReading[].
const mockPollFireboard = jest.fn(
  (_host: string): Promise<LanProbeReading[]> => Promise.resolve([]),
);

jest.mock("../lan/fireboard", () => ({
  pollFireboard: (host: string) => mockPollFireboard(host),
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
    deviceName: overrides.deviceName ?? "Fireboard",
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
  // Default: adapter returns empty arrays
  mockPollFireboard.mockResolvedValue([]);
});

// ── Fallback hostname resolution ──────────────────────────────────────────

describe("fallback hostname resolution", () => {
  it("polls the default Fireboard fallback host", async () => {
    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollFireboard.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("fireboard.local");

    unmount();
  });

  it("deduplicates when mDNS resolves the same address as the default fallback", async () => {
    // mDNS discovered "fireboard.local" — already the default host
    mockDiscovered = { fireboard: ["fireboard.local"] };

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollFireboard.mock.calls.map(([h]) => h);
    const occurrences = calledHosts.filter((h) => h === "fireboard.local").length;
    expect(occurrences).toBe(1);

    unmount();
  });

  it("polls both mDNS-discovered IP and default fallback when IP is different", async () => {
    mockDiscovered = { fireboard: ["192.168.1.50"] };

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const calledHosts = mockPollFireboard.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("192.168.1.50");
    expect(calledHosts).toContain("fireboard.local");

    unmount();
  });

  it("deduplicates readings from multiple hostnames that resolve to the same probe", async () => {
    // Both fireboard.local and an mDNS IP respond as the same physical device+channel
    const reading = makeReading({ host: "fireboard.local", deviceId: "same-device", channelIndex: 0 });
    const duplicateReading = makeReading({ host: "192.168.1.50", deviceId: "same-device", channelIndex: 0 });

    mockDiscovered = { fireboard: ["192.168.1.50"] };
    mockPollFireboard.mockImplementation((host: string) => {
      if (host === "fireboard.local") return Promise.resolve([reading]);
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
  const DISCOVERED_IP = "192.168.1.60";

  it("does not evict a mDNS-discovered host after fewer than 3 consecutive failures", async () => {
    mockDiscovered = { fireboard: [DISCOVERED_IP] };
    mockPollFireboard.mockResolvedValue([]);

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // Run 2 poll cycles (below threshold)
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(mockEvictHost).not.toHaveBeenCalled();
    expect(mockRescan).not.toHaveBeenCalled();

    unmount();
  });

  it("evicts and rescans after exactly 3 consecutive failures on a mDNS-discovered host", async () => {
    mockDiscovered = { fireboard: [DISCOVERED_IP] };
    mockPollFireboard.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    // 3 consecutive poll cycles, all failing
    await act(async () => { await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });

    expect(mockEvictHost).toHaveBeenCalledWith("fireboard", DISCOVERED_IP);
    expect(mockRescan).toHaveBeenCalled();

    unmount();
  });

  it("resets the failure counter when a poll succeeds", async () => {
    mockDiscovered = { fireboard: [DISCOVERED_IP] };
    const reading = makeReading({ host: DISCOVERED_IP });

    // First 2 cycles fail, then succeed
    mockPollFireboard
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValue([reading]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    await act(async () => { await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });

    expect(mockEvictHost).not.toHaveBeenCalled();

    unmount();
  });

  it("does not evict hardcoded .local fallback hosts on failure", async () => {
    // No mDNS discovery — only the hardcoded .local fallback is polled.
    // The eviction guard `if (!discoveredForType?.length) return` fires
    // immediately when the discovered map is empty, so no evict/rescan can
    // occur regardless of how many poll cycles run.
    mockDiscovered = {};
    mockPollFireboard.mockResolvedValue([]);

    const { unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));

    await act(async () => { await Promise.resolve(); });

    expect(mockEvictHost).not.toHaveBeenCalled();
    expect(mockRescan).not.toHaveBeenCalled();

    unmount();
  });

  it("Fireboard: readings resume at new IP after IP change mid-cook", async () => {
    const OLD_FB = "192.168.1.60";
    const NEW_FB = "192.168.1.85";
    const newReading = makeReading({ host: NEW_FB, deviceId: "fb-1" });

    mockDiscovered = { fireboard: [OLD_FB] };
    mockPollFireboard.mockImplementation((host: string) => {
      if (host === NEW_FB) return Promise.resolve([newReading]);
      return Promise.resolve([]);
    });

    const { result, rerender, unmount } = renderHook(
      ({ pollIntervalMs }: { pollIntervalMs: number }) =>
        useLanProbes({ enabled: true, pollIntervalMs }),
      { initialProps: { pollIntervalMs: 60_000 } },
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });

    expect(mockEvictHost).toHaveBeenCalledWith("fireboard", OLD_FB);

    // Simulate mDNS re-discovering device at NEW_FB + force re-render so
    // discoveredRef.current is updated before the recovery poll fires.
    mockDiscovered = { fireboard: [NEW_FB] };
    rerender({ pollIntervalMs: 60_000 });

    await act(async () => { result.current.scan(); await Promise.resolve(); });

    expect(result.current.probes).toHaveLength(1);
    expect(result.current.probes[0].host).toBe(NEW_FB);

    unmount();
  });

  it("new IP starts with a fresh failure counter — does not inherit old IP's history", async () => {
    const OLD_IP = "192.168.1.60";
    const NEW_IP = "192.168.1.85";

    mockDiscovered = { fireboard: [OLD_IP] };
    mockPollFireboard.mockResolvedValue([]);

    const { result, rerender, unmount } = renderHook(
      ({ pollIntervalMs }: { pollIntervalMs: number }) =>
        useLanProbes({ enabled: true, pollIntervalMs }),
      { initialProps: { pollIntervalMs: 60_000 } },
    );

    // 3 failures on OLD_IP → eviction
    await act(async () => { await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    expect(mockEvictHost).toHaveBeenCalledWith("fireboard", OLD_IP);
    mockEvictHost.mockClear();

    // Rescan found NEW_IP — force re-render so discoveredRef picks up NEW_IP
    mockDiscovered = { fireboard: [NEW_IP] };
    rerender({ pollIntervalMs: 60_000 });

    // 2 failures at the new address (below the eviction threshold)
    await act(async () => { result.current.scan(); await Promise.resolve(); });
    await act(async () => { result.current.scan(); await Promise.resolve(); });

    // NEW_IP should NOT be evicted — only 2 failures so far (threshold is 3)
    expect(mockEvictHost).not.toHaveBeenCalled();

    unmount();
  });
});

// ── Manual host add / remove / persist ───────────────────────────────────

describe("manual host add / remove / persist", () => {
  const MANUAL_KEY = "@knowyourpit/lan/manual_v2";

  it("addManualHost persists the new entry to AsyncStorage", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99", "fireboard");
    });

    const expected: ManualEntry[] = [{ host: "192.168.1.99", type: "fireboard" }];
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(MANUAL_KEY, JSON.stringify(expected));

    unmount();
  });

  it("addManualHost adds the entry to manualEntries state", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99", "fireboard");
    });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).toContain("192.168.1.99");
    const entry = result.current.manualEntries.find((e) => e.host === "192.168.1.99");
    expect(entry?.type).toBe("fireboard");

    unmount();
  });

  it("addManualHost does not duplicate an already-present host", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("192.168.1.99", "fireboard");
      await result.current.addManualHost("192.168.1.99", "fireboard");
    });

    const count = result.current.manualEntries.filter((e) => e.host === "192.168.1.99").length;
    expect(count).toBe(1);

    unmount();
  });

  it("addManualHost trims leading/trailing whitespace before storing", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => {
      await result.current.addManualHost("  192.168.1.99  ", "fireboard");
    });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).toContain("192.168.1.99");
    expect(hosts).not.toContain("  192.168.1.99  ");

    unmount();
  });

  it("addManualHost ignores blank strings", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const lengthBefore = result.current.manualEntries.length;

    await act(async () => {
      await result.current.addManualHost("   ", "fireboard");
    });

    expect(result.current.manualEntries).toHaveLength(lengthBefore);

    unmount();
  });

  it("removeManualHost removes the entry and updates AsyncStorage", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addManualHost("192.168.1.99", "fireboard"); });
    await act(async () => { await result.current.removeManualHost("192.168.1.99"); });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).not.toContain("192.168.1.99");
    expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(MANUAL_KEY, JSON.stringify([]));

    unmount();
  });

  it("removeManualHost is a no-op for a host that was never added", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const beforeCount = result.current.manualEntries.length;

    await act(async () => {
      await result.current.removeManualHost("192.168.1.77");
    });

    expect(result.current.manualEntries).toHaveLength(beforeCount);

    unmount();
  });

  it("loads persisted ManualEntry[] from AsyncStorage on mount", async () => {
    const seeded: ManualEntry[] = [
      { host: "192.168.1.88", type: "fireboard" },
      { host: "192.168.1.89", type: "fireboard" },
    ];
    storageData[MANUAL_KEY] = JSON.stringify(seeded);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).toContain("192.168.1.88");
    expect(hosts).toContain("192.168.1.89");
    expect(result.current.manualEntries.every((e) => e.type === "fireboard")).toBe(true);

    unmount();
  });

  it("drops persisted entries whose type is no longer supported", async () => {
    // Legacy persisted data may still contain removed device types — these
    // must be filtered out on load.
    storageData[MANUAL_KEY] = JSON.stringify([
      { host: "192.168.1.88", type: "fireboard" },
      { host: "192.168.1.89", type: "legacy_removed_type" },
    ]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).toContain("192.168.1.88");
    expect(hosts).not.toContain("192.168.1.89");

    unmount();
  });

  it("migrates legacy string[] entries to typed fireboard entries on load", async () => {
    storageData[MANUAL_KEY] = JSON.stringify(["192.168.1.10", "192.168.1.11"]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    const hosts = result.current.manualEntries.map((e) => e.host);
    expect(hosts).toContain("192.168.1.10");
    expect(hosts).toContain("192.168.1.11");
    expect(result.current.manualEntries.every((e) => e.type === "fireboard")).toBe(true);

    unmount();
  });

  it("routes manual fireboard entry to pollFireboard adapter", async () => {
    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });
    // Clear calls from initial poll
    mockPollFireboard.mockClear();

    await act(async () => { await result.current.addManualHost("192.168.1.55", "fireboard"); });

    const calledHosts = mockPollFireboard.mock.calls.map(([h]) => h);
    expect(calledHosts).toContain("192.168.1.55");

    unmount();
  });

  it("offline manual host appears in devices list with correct deviceName per type", async () => {
    mockPollFireboard.mockResolvedValue([]);

    const { result, unmount } = renderHook(() => useLanProbes({ enabled: true, pollIntervalMs: 60_000 }));
    await act(async () => { await Promise.resolve(); });

    await act(async () => { await result.current.addManualHost("192.168.1.77", "fireboard"); });

    const device = result.current.devices.find((d) => d.host === "192.168.1.77");
    expect(device).toBeDefined();
    expect(device?.connected).toBe(false);
    expect(device?.isManual).toBe(true);
    expect(device?.deviceName).toBe("Fireboard");

    unmount();
  });
});
