import { act, renderHook } from "@testing-library/react-native";

const mockUpload = jest.fn();

jest.mock("@workspace/api-client-react", () => ({
  __esModule: true,
  getListTemperatureReadingsQueryKey: jest.fn(() => ["temperature-readings"]),
  useListTemperatureReadings: jest.fn(() => ({ data: [] })),
  useUploadTemperatureData: jest.fn(() => ({ mutate: mockUpload })),
}));

jest.mock("@/lib/localCooks", () => ({
  __esModule: true,
  isLocalCookId: jest.fn(() => false),
}));

import { appendLiveReading, useLiveReadings } from "../useLiveReadings";

const START_MS = new Date("2030-07-04T12:00:00.000Z").getTime();

function probeState(lastSeenMs = START_MS) {
  return {
    tempMode: "probe" as const,
    selectedMeatProbeId: "bleCtx-meat",
    selectedPitProbeId: null,
    probeLabels: {},
    selectedInkbirdProbe: null,
    selectedInkbirdPitProbe: null,
    selectedBleContextDevice: {
      id: "meat",
      name: "Meat",
      probeTempF: 155,
      ambientTempF: 250,
      lastSeenMs,
    },
    selectedBleContextPitDevice: null,
    selectedLanProbe: null,
    selectedLanPitProbe: null,
    lanProbes: [],
    bleContextDevices: [],
    hasActiveProbe: true,
  } as any;
}

type HookProps = { state: ReturnType<typeof probeState> };

describe("useLiveReadings idempotence", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(START_MS);
    mockUpload.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the existing array for an equivalent final sample", () => {
    const readings = [{ timeMinutes: 1, tempF: 155 }];
    expect(appendLiveReading(readings, { timeMinutes: 1, tempF: 155 })).toBe(readings);
  });

  it("does not accumulate or upload again when renders recreate the same probe sample", () => {
    const { result, rerender } = renderHook<ReturnType<typeof useLiveReadings>, HookProps>(
      ({ state }) => useLiveReadings({
        id: "42",
        cookStatus: "active",
        cook: { actualStartAt: new Date(START_MS).toISOString() },
        cookCheckins: [],
        probeState: state,
      }),
      { initialProps: { state: probeState() } },
    );

    expect(result.current.liveReadings).toHaveLength(1);
    expect(result.current.livePitReadings).toHaveLength(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);

    act(() => {
      rerender({ state: probeState() });
      rerender({ state: probeState() });
    });

    expect(result.current.liveReadings).toHaveLength(1);
    expect(result.current.livePitReadings).toHaveLength(1);
    expect(mockUpload).toHaveBeenCalledTimes(1);
  });

  it("accepts one new reading and upload when the sample timestamp advances", () => {
    const { result, rerender } = renderHook<ReturnType<typeof useLiveReadings>, HookProps>(
      ({ state }) => useLiveReadings({
        id: "42",
        cookStatus: "active",
        cook: { actualStartAt: new Date(START_MS).toISOString() },
        cookCheckins: [],
        probeState: state,
      }),
      { initialProps: { state: probeState() } },
    );

    act(() => {
      jest.setSystemTime(START_MS + 15_000);
      rerender({ state: probeState(START_MS + 15_000) });
    });

    expect(result.current.liveReadings).toHaveLength(2);
    expect(result.current.livePitReadings).toHaveLength(2);
    expect(mockUpload).toHaveBeenCalledTimes(2);
  });
});