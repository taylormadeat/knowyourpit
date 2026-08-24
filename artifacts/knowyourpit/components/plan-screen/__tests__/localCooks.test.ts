/**
 * Failure-injection tests for the local planning outbox.
 *
 * These tests intentionally model the response arriving late, not arriving at
 * all, or arriving after a local edit/delete. The assertions inspect the
 * persisted snapshot so they cover the app-restart boundary as well as the
 * in-memory state.
 */
const STORAGE_KEY = "knowyourpit.local-cooks.v1";
const OWNER_ID = "planning-test-user";
const SESSION_ID = "session-123";
const NOW = new Date("2030-07-04T12:00:00.000Z");

const mockStorage = new Map<string, string>();
const mockGetItem = jest.fn();
const mockSetItem = jest.fn();
const mockRemoveItem = jest.fn();
const mockCreateCook = jest.fn();
const mockUpdateCook = jest.fn();
const mockDeleteCook = jest.fn();
const mockReconcileLiveCookSession = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: mockGetItem,
    setItem: mockSetItem,
    removeItem: mockRemoveItem,
  },
}));

jest.mock("@workspace/api-client-react", () => ({
  createCook: mockCreateCook,
  updateCook: mockUpdateCook,
  deleteCook: mockDeleteCook,
  reconcileLiveCookSession: mockReconcileLiveCookSession,
}));

type LocalCooksModule = typeof import("../../../lib/localCooks");
type StoredSnapshot = {
  version: number;
  cooks: Array<Record<string, any>>;
  sessionOperations: Array<Record<string, any>>;
};

function loadLocalCooks(): LocalCooksModule {
  jest.resetModules();
  return require("../../../lib/localCooks") as LocalCooksModule;
}

function readSnapshot(): StoredSnapshot {
  const raw = mockStorage.get(STORAGE_KEY);
  if (!raw) throw new Error("Expected local cook snapshot to be persisted.");
  return JSON.parse(raw) as StoredSnapshot;
}

async function flushMicrotasks() {
  // Fresh local-cook snapshots intentionally wait one event-loop turn so the
  // foreground route can start before AsyncStorage is invoked.
  jest.advanceTimersByTime(0);
  for (let index = 0; index < 12; index += 1) {
    await Promise.resolve();
  }
}

async function waitForMockCalls(mock: { mock: { calls: unknown[][] } }, count = 1) {
  for (let index = 0; index < 40; index += 1) {
    if (mock.mock.calls.length >= count) return;
    await Promise.resolve();
  }
  throw new Error(`Expected mock to receive ${count} call(s).`);
}

function sessionBaseline(overrides: {
  anchorPayload?: Record<string, unknown>;
  addedPayload?: Record<string, unknown>;
  sequenceData?: Record<string, unknown>;
} = {}) {
  const sequenceData = overrides.sequenceData ?? {
    type: "multi_cook",
    schedule: [],
    revision: 1,
  };
  return {
    ownerId: OWNER_ID,
    sessionId: SESSION_ID,
    anchorPayload: {
      foodType: "Brisket",
      status: "active",
      sessionId: SESSION_ID,
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      ...overrides.anchorPayload,
    },
    addedPayload: {
      foodType: "Ribs",
      status: "planned",
      sessionId: SESSION_ID,
      plannedStartAt: "2030-07-04T15:00:00.000Z",
      ...overrides.addedPayload,
    },
    sequenceData,
  };
}

function responseFor(operation: Record<string, any>, firstId = 700) {
  return {
    operationId: operation.operationId,
    sessionId: operation.sessionId,
    cooks: operation.members.map((member: Record<string, any>, index: number) => ({
      id: member.serverId ?? firstId + index,
      sessionId: operation.sessionId,
      foodType: member.foodType,
      plannedStartAt: member.plannedStartAt,
      status: member.status,
    })),
  };
}

describe("local planning outbox failure recovery", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockGetItem.mockReset();
    mockSetItem.mockReset();
    mockRemoveItem.mockReset();
    mockGetItem.mockImplementation(async (key: string) => mockStorage.get(key) ?? null);
    mockSetItem.mockImplementation(async (key: string, value: string) => {
      mockStorage.set(key, value);
    });
    mockRemoveItem.mockImplementation(async (key: string) => {
      mockStorage.delete(key);
    });
    mockCreateCook.mockReset();
    mockUpdateCook.mockReset();
    mockDeleteCook.mockReset();
    mockReconcileLiveCookSession.mockReset();
    mockCreateCook.mockResolvedValue({ id: 501 });
    mockUpdateCook.mockResolvedValue({ id: 77 });
    mockDeleteCook.mockResolvedValue(undefined);
    mockReconcileLiveCookSession.mockResolvedValue({
      operationId: "unused",
      sessionId: SESSION_ID,
      cooks: [],
    });
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("reports the server ID after a local cook finishes syncing", async () => {
    const localCooks = loadLocalCooks();
    const localCook = localCooks.createLocalCook(OWNER_ID, {
      foodType: "Chicken Breast",
      status: "active",
      sessionId: "handoff-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    const serverId = localCooks.waitForLocalCookServerId(localCook.id);

    await localCooks.syncLocalCooks(OWNER_ID);

    await expect(serverId).resolves.toBe(501);
  });

  it("reports a confirmed server ID before a slow durable sync write recovers", async () => {
    const localCooks = loadLocalCooks();
    const localCook = localCooks.createLocalCook(OWNER_ID, {
      foodType: "Chicken Breast",
      status: "active",
      sessionId: "handoff-storage-timeout-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    let finishLateWrite!: () => void;
    mockSetItem
      .mockImplementationOnce(async (key: string, value: string) => {
        mockStorage.set(key, value);
      })
      .mockImplementationOnce(async (key: string, value: string) => {
        mockStorage.set(key, value);
      })
      .mockImplementationOnce((key: string, value: string) => new Promise<void>((resolve) => {
        finishLateWrite = () => {
          mockStorage.set(key, value);
          resolve();
        };
      }));
    const serverId = localCooks.waitForLocalCookServerId(localCook.id);
    const syncAttempt = localCooks.syncLocalCooks(OWNER_ID);

    await expect(serverId).resolves.toBe(501);
    jest.advanceTimersByTime(localCooks.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await syncAttempt;
    finishLateWrite();
  });

  it("keeps an invalid create response retryable instead of accepting its ID", async () => {
    const localCooks = loadLocalCooks();
    mockCreateCook.mockResolvedValueOnce({ id: -1 });
    await localCooks.createLocalCook(OWNER_ID, {
      foodType: "Chicken Breast",
      status: "active",
      sessionId: "invalid-server-id-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });

    await localCooks.syncLocalCooks(OWNER_ID);

    expect(readSnapshot().cooks[0]).toMatchObject({
      serverId: null,
      syncState: "error",
    });
  });

  it("keeps one server mirror while repeated offline edits collapse to the newest revision", async () => {
    const localCooks = loadLocalCooks();
    const first = await localCooks.upsertLocalServerCook(
      OWNER_ID,
      77,
      { foodType: "Brisket", plannedStartAt: "2030-07-04T14:00:00.000Z" },
    );
    await localCooks.upsertLocalServerCook(
      OWNER_ID,
      77,
      { plannedStartAt: "2030-07-04T15:00:00.000Z" },
    );
    await localCooks.upsertLocalServerCook(
      OWNER_ID,
      77,
      { plannedStartAt: "2030-07-04T16:00:00.000Z" },
    );
    await flushMicrotasks();

    let snapshot = readSnapshot();
    expect(snapshot.cooks).toHaveLength(1);
    expect(snapshot.cooks[0]).toMatchObject({
      localId: first.id,
      serverId: 77,
      revision: 3,
      syncState: "pending",
    });
    expect(snapshot.cooks[0].syncPayload.plannedStartAt).toBe("2030-07-04T16:00:00.000Z");

    await localCooks.syncLocalCooks(OWNER_ID);

    expect(mockUpdateCook).toHaveBeenCalledTimes(1);
    expect(mockUpdateCook).toHaveBeenCalledWith(
      77,
      expect.objectContaining({ plannedStartAt: "2030-07-04T16:00:00.000Z" }),
      expect.anything(),
    );
    snapshot = readSnapshot();
    expect(snapshot.cooks).toHaveLength(1);
    expect(snapshot.cooks[0]).toMatchObject({ serverId: 77, syncState: "synced" });
  });

  it("coalesces repeated session revisions and persists the latest member revisions", async () => {
    const localCooks = loadLocalCooks();
    const baseline = await localCooks.saveLiveCookSessionBaseline(sessionBaseline());

    await localCooks.updateLocalCookSession(OWNER_ID, SESSION_ID, {
      plannedStartAt: "2030-07-04T17:00:00.000Z",
    });
    await localCooks.enqueueLiveCookSessionReconciliation(
      OWNER_ID,
      SESSION_ID,
      null,
      [baseline.anchor.id, baseline.added.id],
      { type: "multi_cook", revision: 2 },
    );
    await flushMicrotasks();

    const snapshot = readSnapshot();
    expect(snapshot.sessionOperations).toHaveLength(1);
    expect(snapshot.sessionOperations[0].sequenceData).toEqual({
      type: "multi_cook",
      revision: 2,
    });
    expect(snapshot.sessionOperations[0].memberLocalIds).toEqual(
      expect.arrayContaining([baseline.anchor.id, baseline.added.id]),
    );
    expect(snapshot.sessionOperations[0].memberRevisions).toEqual([2, 2]);
    expect(snapshot.sessionOperations[0].members).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ plannedStartAt: "2030-07-04T17:00:00.000Z" }),
      ]),
    );
  });

  it("does not lose an edit made while session reconciliation is in flight", async () => {
    const localCooks = loadLocalCooks();
    const baseline = await localCooks.saveLiveCookSessionBaseline(sessionBaseline());
    let releaseReconcile!: (value: ReturnType<typeof responseFor>) => void;
    let releaseUpdate!: (value: unknown) => void;
    mockReconcileLiveCookSession.mockImplementation(
      () => new Promise((resolve) => {
        releaseReconcile = resolve;
      }),
    );
    mockUpdateCook.mockImplementation(
      () => new Promise((resolve) => {
        releaseUpdate = resolve;
      }),
    );

    const syncPromise = localCooks.syncLocalCooks(OWNER_ID);
    await flushMicrotasks();
    expect(mockReconcileLiveCookSession).toHaveBeenCalledTimes(1);

    await localCooks.updateLocalCook(baseline.anchor.id, {
      plannedStartAt: "2030-07-04T18:00:00.000Z",
    });
    const operation = readSnapshot().sessionOperations[0];
    const anchorServerId = 700 + operation.memberLocalIds.indexOf(baseline.anchor.id);
    releaseReconcile(responseFor(operation));
    await waitForMockCalls(mockUpdateCook);

    let snapshot = readSnapshot();
    const edited = snapshot.cooks.find((cook) => cook.localId === baseline.anchor.id);
    expect(edited).toMatchObject({
      serverId: anchorServerId,
      sessionOperationId: null,
      syncState: "syncing",
      revision: 2,
    });
    expect(edited?.syncPayload.plannedStartAt).toBe("2030-07-04T18:00:00.000Z");

    releaseUpdate({ id: anchorServerId });
    await syncPromise;

    expect(mockReconcileLiveCookSession).toHaveBeenCalledTimes(1);
    expect(mockUpdateCook).toHaveBeenCalledWith(
      anchorServerId,
      expect.objectContaining({ plannedStartAt: "2030-07-04T18:00:00.000Z" }),
      expect.anything(),
    );
    snapshot = readSnapshot();
    expect(snapshot.cooks.find((cook) => cook.localId === baseline.anchor.id)).toMatchObject({
      syncState: "synced",
      serverId: anchorServerId,
    });
  });

  it("keeps a delete tombstone until a member committed by the old request can be deleted", async () => {
    const localCooks = loadLocalCooks();
    const baseline = await localCooks.saveLiveCookSessionBaseline(sessionBaseline());
    let releaseReconcile!: (value: ReturnType<typeof responseFor>) => void;
    let releaseDelete!: (value?: unknown) => void;
    mockReconcileLiveCookSession.mockImplementation(
      () => new Promise((resolve) => {
        releaseReconcile = resolve;
      }),
    );
    mockDeleteCook.mockImplementation(
      () => new Promise((resolve) => {
        releaseDelete = resolve;
      }),
    );

    const syncPromise = localCooks.syncLocalCooks(OWNER_ID);
    await flushMicrotasks();
    await localCooks.deleteLocalCook(baseline.added.id);
    const operation = readSnapshot().sessionOperations[0];
    const addedServerId = 700 + operation.memberLocalIds.indexOf(baseline.added.id);
    releaseReconcile(responseFor(operation));
    await waitForMockCalls(mockDeleteCook);

    let snapshot = readSnapshot();
    expect(mockDeleteCook).toHaveBeenCalledWith(addedServerId, expect.anything());
    expect(snapshot.cooks.find((cook) => cook.localId === baseline.added.id)).toMatchObject({
      serverId: addedServerId,
      deletedAt: expect.any(String),
      sessionOperationId: null,
      syncState: "syncing",
    });

    releaseDelete();
    await syncPromise;
    snapshot = readSnapshot();
    expect(snapshot.cooks).toHaveLength(1);
    expect(snapshot.cooks.some((cook) => cook.localId === baseline.added.id)).toBe(false);
  });

  it("replays a persisted syncing operation after app restart", async () => {
    const firstModule = loadLocalCooks();
    await firstModule.saveLiveCookSessionBaseline(sessionBaseline());
    await flushMicrotasks();
    const interrupted = readSnapshot();
    interrupted.sessionOperations[0].syncState = "syncing";
    delete interrupted.sessionOperations[0].memberRevisions;
    interrupted.cooks = interrupted.cooks.map((cook) => ({
      ...cook,
      syncState: "syncing",
    }));
    mockStorage.set(STORAGE_KEY, JSON.stringify(interrupted));

    const restartedModule = loadLocalCooks();
    await restartedModule.hydrateLocalCooks();

    let snapshot = readSnapshot();
    expect(snapshot.sessionOperations[0]).toMatchObject({
      syncState: "pending",
      syncError: null,
      nextRetryAt: null,
    });
    expect(snapshot.sessionOperations[0].memberRevisions).toEqual([1, 1]);
    expect(snapshot.cooks.every((cook) => cook.syncState === "pending")).toBe(true);

    mockReconcileLiveCookSession.mockImplementation(async (
      _sessionId: string,
      body: Record<string, any>,
    ) => responseFor({
      operationId: body.operationId,
      sessionId: SESSION_ID,
      members: body.members,
    }));
    await restartedModule.syncLocalCooks(OWNER_ID);

    expect(mockReconcileLiveCookSession).toHaveBeenCalledTimes(1);
    snapshot = readSnapshot();
    expect(snapshot.sessionOperations).toHaveLength(0);
    expect(snapshot.cooks).toHaveLength(2);
    expect(snapshot.cooks.map((cook) => cook.serverId)).toEqual(
      expect.arrayContaining([700, 701]),
    );
  });

  it("reconnects with the same operation after an unknown response outcome", async () => {
    const localCooks = loadLocalCooks();
    await localCooks.saveLiveCookSessionBaseline(sessionBaseline());
    const lostResponse = Object.assign(new Error("response lost after commit"), { status: 0 });
    mockReconcileLiveCookSession.mockRejectedValueOnce(lostResponse);

    await localCooks.syncLocalCooks(OWNER_ID);

    let snapshot = readSnapshot();
    const failedOperation = snapshot.sessionOperations[0];
    expect(failedOperation).toMatchObject({
      syncState: "error",
      syncError: "response lost after commit",
      syncAttempts: 1,
      nextRetryAt: NOW.getTime() + 5_000,
    });
    expect(snapshot.cooks.every((cook) => cook.syncState === "error")).toBe(true);

    mockReconcileLiveCookSession.mockImplementation(async (
      _sessionId: string,
      body: Record<string, any>,
    ) => responseFor({
      operationId: body.operationId,
      sessionId: SESSION_ID,
      members: body.members,
    }));
    jest.setSystemTime(new Date(NOW.getTime() + 5_000));
    await localCooks.syncLocalCooks(OWNER_ID);

    expect(mockReconcileLiveCookSession).toHaveBeenCalledTimes(2);
    expect(mockReconcileLiveCookSession.mock.calls[1][1].operationId)
      .toBe(mockReconcileLiveCookSession.mock.calls[0][1].operationId);
    expect(mockReconcileLiveCookSession.mock.calls[1][1])
      .toEqual(mockReconcileLiveCookSession.mock.calls[0][1]);
    snapshot = readSnapshot();
    expect(snapshot.sessionOperations).toHaveLength(0);
    expect(snapshot.cooks.every((cook) => cook.syncState === "synced")).toBe(true);
    expect(snapshot.cooks.map((cook) => cook.serverId)).toEqual(
      expect.arrayContaining([700, 701]),
    );
  });

  it("times out a stalled local read and allows a clean retry", async () => {
    const localCooks = loadLocalCooks();
    let releaseRead!: (value: string | null) => void;
    mockGetItem.mockImplementationOnce(() => new Promise<string | null>((resolve) => {
      releaseRead = resolve;
    }));

    const stalledHydration = localCooks.hydrateLocalCooks();
    await flushMicrotasks();
    jest.advanceTimersByTime(localCooks.LOCAL_COOK_STORAGE_TIMEOUT_MS);

    await expect(stalledHydration).rejects.toMatchObject({
      code: "LOCAL_COOK_STORAGE_UNAVAILABLE",
      operation: "read",
      timedOut: true,
    });

    // A native callback resolving after the UI timeout is ignored. The next
    // user attempt starts a fresh read rather than inheriting the stuck one.
    releaseRead(null);
    await flushMicrotasks();
    await expect(localCooks.hydrateLocalCooks()).resolves.toBeUndefined();
  });

  it("creates immediately and never duplicates when its background write finishes late", async () => {
    const localCooks = loadLocalCooks();
    let finishLateWrite!: () => void;
    mockSetItem.mockImplementationOnce((key: string, value: string) => new Promise<void>((resolve) => {
      finishLateWrite = () => {
        mockStorage.set(key, value);
        resolve();
      };
    }));
    const payload = {
      foodType: "Brisket",
      status: "active",
      sessionId: "local-write-retry-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    };

    const firstAttempt = localCooks.createLocalCook(OWNER_ID, payload, {
      localCreateKey: payload.sessionId,
    });
    const first = await firstAttempt;
    expect(first.id).toBeLessThan(0);

    // The local record is returned before the native snapshot settles, so a
    // stalled bridge cannot keep Start Cooking Now spinning.
    await flushMicrotasks();
    jest.advanceTimersByTime(localCooks.LOCAL_COOK_STORAGE_TIMEOUT_MS);

    // Once the original native write settles, a retry reuses the in-memory
    // record for the same session instead of adding another cook.
    finishLateWrite();
    await flushMicrotasks();
    const retry = await localCooks.createLocalCook(OWNER_ID, payload, {
      localCreateKey: payload.sessionId,
    });
    jest.advanceTimersByTime(localCooks.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await flushMicrotasks();
    const snapshot = readSnapshot();

    expect(snapshot.cooks).toHaveLength(1);
    expect(snapshot.cooks[0]).toMatchObject({
      localId: first.id,
      ownerId: OWNER_ID,
      syncPayload: expect.objectContaining({ sessionId: payload.sessionId }),
    });
    expect(retry.id).toBe(first.id);
  });

  it("commits a new cook before starting any native storage work", async () => {
    const localCooks = loadLocalCooks();

    const created = localCooks.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "foreground-transition-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });

    // The submit handler can route with this synchronous local value before
    // AsyncStorage receives either a read or a write. This is the foreground
    // path that must not require backgrounding the app to finish.
    expect(created.id).toBeLessThan(0);
    expect(mockGetItem).not.toHaveBeenCalled();
    expect(mockSetItem).not.toHaveBeenCalled();

    jest.advanceTimersByTime(0);
    await flushMicrotasks();

    expect(mockGetItem).toHaveBeenCalledTimes(1);
    expect(mockSetItem).toHaveBeenCalledTimes(1);
  });

  it("persists both old and newly created cooks when cold-start hydration returns late", async () => {
    const seeded = loadLocalCooks();
    const oldCook = await seeded.createLocalCook(OWNER_ID, {
      foodType: "Pork Shoulder",
      status: "planned",
      sessionId: "existing-before-hydration",
      plannedStartAt: "2030-07-04T13:00:00.000Z",
    });
    await flushMicrotasks();
    const delayedSnapshot = mockStorage.get(STORAGE_KEY)!;

    let releaseRead!: (value: string) => void;
    mockGetItem.mockImplementationOnce(() => new Promise<string>((resolve) => {
      releaseRead = resolve;
    }));
    const current = loadLocalCooks();
    const hydration = current.hydrateLocalCooks();
    await flushMicrotasks();

    const newCook = await current.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "created-during-hydration",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    await flushMicrotasks();
    releaseRead(delayedSnapshot);
    await hydration;
    await flushMicrotasks();

    expect(readSnapshot().cooks.map((cook) => cook.localId)).toEqual(
      expect.arrayContaining([oldCook.id, newCook.id]),
    );

    const restarted = loadLocalCooks();
    await restarted.hydrateLocalCooks();
    expect(readSnapshot().cooks.map((cook) => cook.localId)).toEqual(
      expect.arrayContaining([oldCook.id, newCook.id]),
    );
  });

  it("retries a failed post-hydration merge write without losing either cook", async () => {
    const seeded = loadLocalCooks();
    const oldCook = await seeded.createLocalCook(OWNER_ID, {
      foodType: "Pork Shoulder",
      status: "planned",
      sessionId: "existing-before-retry",
      plannedStartAt: "2030-07-04T13:00:00.000Z",
    });
    await flushMicrotasks();
    const delayedSnapshot = mockStorage.get(STORAGE_KEY)!;

    let releaseRead!: (value: string) => void;
    mockGetItem.mockImplementationOnce(() => new Promise<string>((resolve) => {
      releaseRead = resolve;
    }));
    const current = loadLocalCooks();
    const hydration = current.hydrateLocalCooks();
    await flushMicrotasks();
    const newCook = await current.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "created-before-merge-retry",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    await flushMicrotasks();

    // The new-only snapshot has safely reached storage. Simulate a transient
    // failure when late hydration tries to write its merged snapshot.
    mockSetItem.mockImplementationOnce(async () => {
      throw new Error("temporary storage failure");
    });
    releaseRead(delayedSnapshot);
    await hydration;
    await flushMicrotasks();
    jest.advanceTimersByTime(current.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await flushMicrotasks();

    expect(readSnapshot().cooks.map((cook) => cook.localId)).toEqual(
      expect.arrayContaining([oldCook.id, newCook.id]),
    );

    const restarted = loadLocalCooks();
    await restarted.hydrateLocalCooks();
    expect(readSnapshot().cooks.map((cook) => cook.localId)).toEqual(
      expect.arrayContaining([oldCook.id, newCook.id]),
    );
  });

  it("keeps and repairs a cook created while a delayed cold-start read is malformed", async () => {
    let releaseRead!: (value: string) => void;
    mockGetItem.mockImplementationOnce(() => new Promise<string>((resolve) => {
      releaseRead = resolve;
    }));
    const current = loadLocalCooks();
    const hydration = current.hydrateLocalCooks();
    await flushMicrotasks();

    const created = await current.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "created-during-corrupt-hydration",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    releaseRead("{not-json");
    await hydration;
    await flushMicrotasks();

    expect(readSnapshot().cooks).toEqual(
      expect.arrayContaining([expect.objectContaining({ localId: created.id })]),
    );

    const restarted = loadLocalCooks();
    await restarted.hydrateLocalCooks();
    expect(readSnapshot().cooks).toEqual(
      expect.arrayContaining([expect.objectContaining({ localId: created.id })]),
    );
  });

  it("deduplicates a server create that arrives before the local server ID is persisted", () => {
    const localCooks = loadLocalCooks();
    const local = {
      id: -123,
      _localCook: true,
      _syncState: "syncing",
      sessionId: "single-cook-create",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      foodType: "Chicken Breast",
    } as any;
    const server = {
      id: 456,
      sessionId: "single-cook-create",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      foodType: "Chicken Breast",
      status: "active",
    } as any;

    expect(localCooks.mergeLocalAndServerCooks([server], [local])).toEqual([local]);
  });

  it("uses canonical server state after a local cook is synced", () => {
    const localCooks = loadLocalCooks();
    const local = {
      id: -123,
      _localCook: true,
      _syncState: "synced",
      _serverId: 456,
      sessionId: "single-cook-create",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      status: "active",
    } as any;
    const server = {
      id: 456,
      sessionId: "single-cook-create",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      status: "completed",
      actualEndAt: "2030-07-04T18:00:00.000Z",
    } as any;

    expect(localCooks.mergeLocalAndServerCooks([server], [local])).toEqual([server]);
  });

  it("deduplicates multi-cook members that share both a session and start time", () => {
    const localCooks = loadLocalCooks();
    const localMembers = ["Chicken Breast", "Ribs"].map((foodType, index) => ({
      id: -123 - index,
      _localCook: true,
      _syncState: "syncing",
      sessionId: "shared-multi-cook-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      foodType,
    })) as any[];
    const serverMembers = ["Chicken Breast", "Ribs"].map((foodType, index) => ({
      id: 456 + index,
      sessionId: "shared-multi-cook-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
      foodType,
      status: "active",
    })) as any[];

    expect(localCooks.mergeLocalAndServerCooks(serverMembers, localMembers)).toEqual(localMembers);
  });

  it("keeps every member when a multi-cook session uses one shared session ID", async () => {
    const localCooks = loadLocalCooks();
    const first = await localCooks.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "planned",
      sessionId: "shared-multi-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    const second = await localCooks.createLocalCook(OWNER_ID, {
      foodType: "Ribs",
      status: "planned",
      sessionId: "shared-multi-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    await flushMicrotasks();

    expect(first.id).not.toBe(second.id);
    const snapshot = readSnapshot();
    expect(snapshot.cooks).toHaveLength(2);
    expect(snapshot.cooks.map((cook) => cook.syncPayload.foodType)).toEqual(
      expect.arrayContaining(["Brisket", "Ribs"]),
    );
  });

  it("recovers a cook whose background-sync state write timed out", async () => {
    const localCooks = loadLocalCooks();
    await localCooks.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "sync-timeout-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });

    let finishLateWrite!: () => void;
    mockSetItem.mockImplementationOnce((key: string, value: string) => new Promise<void>((resolve) => {
      finishLateWrite = () => {
        mockStorage.set(key, value);
        resolve();
      };
    }));
    const syncAttempt = localCooks.syncLocalCooks(OWNER_ID);
    await flushMicrotasks();
    jest.advanceTimersByTime(localCooks.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await syncAttempt;

    // The timed-out native write eventually persists its older "syncing"
    // snapshot. A restart must normalize it back to pending and retry it.
    finishLateWrite();
    await flushMicrotasks();
    const restarted = loadLocalCooks();
    await restarted.hydrateLocalCooks();
    expect(readSnapshot().cooks[0]).toMatchObject({ syncState: "pending" });

    await restarted.syncLocalCooks(OWNER_ID);
    expect(mockCreateCook).toHaveBeenCalledTimes(1);
    expect(readSnapshot().cooks[0]).toMatchObject({ syncState: "synced", serverId: 501 });
  });

  it("keeps a valid recovered cook when its hydration repair write times out", async () => {
    const firstModule = loadLocalCooks();
    await firstModule.createLocalCook(OWNER_ID, {
      foodType: "Brisket",
      status: "active",
      sessionId: "hydrate-recovery-session",
      plannedStartAt: "2030-07-04T14:00:00.000Z",
    });
    await flushMicrotasks();
    const interrupted = readSnapshot();
    interrupted.cooks[0].syncState = "syncing";
    mockStorage.set(STORAGE_KEY, JSON.stringify(interrupted));

    let finishLateWrite!: () => void;
    mockSetItem.mockImplementationOnce((key: string, value: string) => new Promise<void>((resolve) => {
      finishLateWrite = () => {
        mockStorage.set(key, value);
        resolve();
      };
    }));
    const restarted = loadLocalCooks();
    const hydration = restarted.hydrateLocalCooks();
    await flushMicrotasks();
    await expect(hydration).resolves.toBeUndefined();
    jest.advanceTimersByTime(restarted.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await flushMicrotasks();

    // The late repair write contains the parsed cook normalized to pending;
    // a fresh bounded hydration must retain it rather than treating it as
    // corrupt storage and clearing the local outbox.
    finishLateWrite();
    await flushMicrotasks();
    jest.advanceTimersByTime(restarted.LOCAL_COOK_STORAGE_TIMEOUT_MS);
    await flushMicrotasks();
    const recovered = loadLocalCooks();
    await recovered.hydrateLocalCooks();
    expect(readSnapshot().cooks).toHaveLength(1);
    expect(readSnapshot().cooks[0]).toMatchObject({ syncState: "pending" });
  });
});