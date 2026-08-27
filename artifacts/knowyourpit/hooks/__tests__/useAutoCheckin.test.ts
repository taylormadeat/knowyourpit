import { act, renderHook } from "@testing-library/react-native";

const mockMutateAsync = jest.fn();

jest.mock("@workspace/api-client-react", () => ({
  __esModule: true,
  useCreateCookCheckin: () => ({ mutateAsync: mockMutateAsync }),
}));

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

import { useAutoCheckin } from "../useAutoCheckin";
import { createLocalCook, hydrateLocalCooks, useLocalCook } from "@/lib/localCooks";

const NOW = new Date("2030-07-04T12:00:00.000Z").getTime();

function options(cookId: number) {
  return {
    cookId,
    cookStatus: "active",
    scheduledCheckins: [{
      id: "manual-phase",
      phaseKey: "manual-phase",
      phaseLabel: "Manual Phase",
      scheduledAt: NOW,
      phase: {} as any,
    }],
    existingCheckins: [],
    probeReading: {
      internalTempF: 155,
      pitTempF: null,
      probeSource: "ble" as const,
      fetchedAtMs: NOW,
    },
    onAutoCheckinFired: jest.fn(),
  };
}

describe("useAutoCheckin local cook routing", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    mockMutateAsync.mockReset().mockResolvedValue({ id: 1 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("queues an automatic check-in locally and never posts a negative cook ID", async () => {
    await act(async () => {
      await hydrateLocalCooks();
    });
    const localCook = createLocalCook(null, {
      foodType: "Brisket",
      status: "active",
    });
    const hookOptions = options(localCook.id);
    const localDetail = renderHook(() => useLocalCook(localCook.id, null));

    renderHook(() => useAutoCheckin(hookOptions));
    await act(async () => {
      await Promise.resolve();
    });

    expect((localDetail.result.current.cook as any)?._localCheckins).toEqual([
      expect.objectContaining({
        cookId: localCook.id,
        internalTempF: 155,
        isAutomatic: true,
        phaseKey: "manual-phase",
        clientOperationId: "auto-checkin-manual-phase",
      }),
    ]);
    expect(mockMutateAsync).not.toHaveBeenCalled();
    expect(hookOptions.onAutoCheckinFired).toHaveBeenCalledTimes(1);
  });

  it("keeps the existing server mutation path for positive cook IDs", async () => {
    const hookOptions = options(42);

    renderHook(() => useAutoCheckin(hookOptions));
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      id: 42,
      data: expect.objectContaining({
        internalTempF: 155,
        isAutomatic: true,
        phaseKey: "manual-phase",
        clientOperationId: "auto-checkin-manual-phase",
      }),
    });
  });
});