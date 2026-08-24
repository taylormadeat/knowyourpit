import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  createCook as createCookRequest,
  reconcileLiveCookSession,
  updateCook as updateCookRequest,
  deleteCook as deleteCookRequest,
  type Cook,
  type LiveCookSessionMember,
  type ReconcileLiveCookSessionBody,
} from "@workspace/api-client-react";

const STORAGE_KEY = "knowyourpit.local-cooks.v1";
const SYNC_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000, 300_000];
// AsyncStorage is normally quick, but a stalled native bridge must never trap a
// cook-start interaction. Writes have a deadline for recovery purposes, while
// the visible local commit and navigation happen before the background flush.
export const LOCAL_COOK_STORAGE_TIMEOUT_MS = 5_000;

export type LocalCookSyncState = "pending" | "syncing" | "synced" | "error";

export class LocalCookStorageError extends Error {
  readonly code = "LOCAL_COOK_STORAGE_UNAVAILABLE";

  constructor(
    readonly operation: "read" | "write",
    readonly timedOut: boolean,
  ) {
    super(
      timedOut
        ? `Local storage ${operation} timed out.`
        : `Local storage ${operation} is still recovering.`,
    );
    this.name = "LocalCookStorageError";
  }
}

export function isLocalCookStorageError(error: unknown): error is LocalCookStorageError {
  return error instanceof LocalCookStorageError ||
    (typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "LOCAL_COOK_STORAGE_UNAVAILABLE");
}

export interface LocalCookRecord {
  localId: number;
  ownerId: string;
  serverId: number | null;
  cook: Record<string, unknown>;
  syncPayload: Record<string, unknown>;
  syncState: LocalCookSyncState;
  syncError: string | null;
  revision: number;
  syncAttempts: number;
  nextRetryAt: number | null;
  updatedAt: string;
  deletedAt: string | null;
  /** Stable per-cook retry identity; multi-cook members share a sessionId. */
  localCreateKey?: string | null;
  sessionOperationId?: string | null;
}

export interface LocalCookSessionOperation {
  operationId: string;
  ownerId: string;
  sessionId: string;
  anchorCookId: number | null;
  memberLocalIds: number[];
  /** Revisions captured when this operation was created. */
  memberRevisions?: number[];
  members: LiveCookSessionMember[];
  sequenceData: Record<string, unknown>;
  syncState: LocalCookSyncState;
  syncError: string | null;
  syncAttempts: number;
  nextRetryAt: number | null;
  updatedAt: string;
}

export interface LocalCookCreateOptions {
  /**
   * A server-backed cook can be represented locally while a new plan revision
   * waits in the outbox. The negative local ID keeps Expo Router and the
   * existing local-detail behavior intact; serverId selects PATCH on sync.
   */
  serverId?: number | null;
  /** Full server response used for local rendering; never sent back on sync. */
  snapshot?: Record<string, unknown>;
  /**
   * Stable identity for retrying this individual local create. This must not
   * use a shared multi-cook sessionId because each session member is distinct.
   */
  localCreateKey?: string | null;
}

interface StoredLocalCooks {
  version: 2;
  cooks: LocalCookRecord[];
  sessionOperations: LocalCookSessionOperation[];
}

let records: LocalCookRecord[] = [];
let sessionOperations: LocalCookSessionOperation[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let storageWriteBlocked = false;
let unresolvedStorageWrite: Promise<void> | null = null;
let persistRetryTimer: ReturnType<typeof setTimeout> | null = null;
let deferredPersistTimer: ReturnType<typeof setTimeout> | null = null;
let deferredHydrationTimer: ReturnType<typeof setTimeout> | null = null;
let syncInProgress = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function sanitizeStored(value: unknown): Pick<StoredLocalCooks, "cooks" | "sessionOperations"> {
  if (!value || typeof value !== "object") return { cooks: [], sessionOperations: [] };
  const stored = value as Omit<Partial<StoredLocalCooks>, "version"> & { version?: number };
  if ((stored.version !== 1 && stored.version !== 2) || !Array.isArray(stored.cooks)) {
    return { cooks: [], sessionOperations: [] };
  }
  const cooks = stored.cooks.filter((record): record is LocalCookRecord => (
    !!record &&
    typeof record.localId === "number" &&
    typeof record.ownerId === "string" &&
    !!record.cook &&
    !!record.syncPayload
  ));
  const sessionOperations = Array.isArray(stored.sessionOperations)
    ? stored.sessionOperations.filter((operation): operation is LocalCookSessionOperation => (
        !!operation &&
        typeof operation.operationId === "string" &&
        typeof operation.ownerId === "string" &&
        typeof operation.sessionId === "string" &&
        Array.isArray(operation.memberLocalIds) &&
        Array.isArray(operation.members) &&
        !!operation.sequenceData
      ))
    : [];
  return { cooks, sessionOperations };
}

function withStorageTimeout<T>(
  operation: "read" | "write",
  operationPromise: Promise<T>,
) {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new LocalCookStorageError(operation, true));
    }, LOCAL_COOK_STORAGE_TIMEOUT_MS);
    operationPromise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function persist() {
  if (storageWriteBlocked) {
    return Promise.reject(new LocalCookStorageError("write", false));
  }
  const snapshot: StoredLocalCooks = { version: 2, cooks: records, sessionOperations };
  persistQueue = persistQueue
    .catch(() => {})
    .then(async () => {
      // Do not start a second full-snapshot write while a timed-out native write
      // might still complete. A late older snapshot could otherwise overwrite a
      // newer one and lose a cook. Once it settles, a manual retry can proceed.
      if (storageWriteBlocked) {
        throw new LocalCookStorageError("write", false);
      }
      const nativeWrite = AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
      unresolvedStorageWrite = nativeWrite;
      nativeWrite.then(
        () => {
          if (unresolvedStorageWrite === nativeWrite) {
            unresolvedStorageWrite = null;
            storageWriteBlocked = false;
          }
        },
        () => {
          if (unresolvedStorageWrite === nativeWrite) {
            unresolvedStorageWrite = null;
            storageWriteBlocked = false;
          }
        },
      );
      try {
        await withStorageTimeout("write", nativeWrite);
      } catch (error) {
        if (
          isLocalCookStorageError(error) &&
          error.timedOut &&
          unresolvedStorageWrite === nativeWrite
        ) {
          storageWriteBlocked = true;
        }
        throw error;
      }
    });
  return persistQueue;
}

/**
 * Local UI state is the source of truth for an offline-first cook. A native
 * AsyncStorage bridge can stall while the app is still perfectly able to show,
 * edit, and sync the in-memory record; never make a button or navigation wait
 * for that bridge. Keep retrying the serialized snapshot in the background.
 */
function queuePersist() {
  void persist().catch(() => {
    if (persistRetryTimer) return;
    persistRetryTimer = setTimeout(() => {
      persistRetryTimer = null;
      queuePersist();
    }, LOCAL_COOK_STORAGE_TIMEOUT_MS);
  });
}

/**
 * A fresh local cook must be visible before its first native storage write is
 * allowed to start. AsyncStorage can briefly stall on iOS; scheduling this
 * snapshot on the next event-loop turn keeps that bridge out of the tap and
 * route-transition call stack while retaining the regular retry behavior.
 */
function queuePersistAfterForegroundTransition() {
  if (deferredPersistTimer) return;
  deferredPersistTimer = setTimeout(() => {
    deferredPersistTimer = null;
    queuePersist();
  }, 0);
}

/**
 * A first-time storage read can stall on the same native bridge as a write.
 * Starting it from createLocalCook would put that read back on the CTA's
 * critical path, so a cold outbox hydrates on the next turn and merges any
 * already-committed in-memory record when it arrives.
 */
function queueHydrationAfterForegroundTransition() {
  if (hydrated || hydratePromise || deferredHydrationTimer) return;
  deferredHydrationTimer = setTimeout(() => {
    deferredHydrationTimer = null;
    void hydrateLocalCooks().catch(() => {});
  }, 0);
}

export async function hydrateLocalCooks() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = withStorageTimeout("read", AsyncStorage.getItem(STORAGE_KEY))
      .then(async (raw) => {
        if (!raw) return;
        let stored: Pick<StoredLocalCooks, "cooks" | "sessionOperations">;
        try {
          stored = sanitizeStored(JSON.parse(raw));
        } catch {
          // A cold read may return after a user has already started a new cook.
          // Corrupt *stored* data must never erase that in-memory commit; write
          // the good current snapshot over it instead. A clean cold start still
          // treats malformed storage as empty.
          if (records.length > 0 || sessionOperations.length > 0) {
            queuePersist();
          } else {
            records = [];
            sessionOperations = [];
          }
          return;
        }
        // A cook can be started before a slow cold-start read returns. Merge
        // rather than replace in-memory commits so that late hydration can
        // never erase the cook the pitmaster has already been routed into.
        const inMemoryRecords = records;
        const hadPreHydrationRecords = inMemoryRecords.length > 0;
        const inMemoryIds = new Set(inMemoryRecords.map((record) => record.localId));
        records = [
          ...inMemoryRecords,
          ...stored.cooks.filter((record) => !inMemoryIds.has(record.localId)),
        ];
        const hadPreHydrationOperations = sessionOperations.length > 0;
        const inMemoryOperationIds = new Set(sessionOperations.map((operation) => operation.operationId));
        const recordsByLocalId = new Map(records.map((record) => [record.localId, record]));
        const needsMemberRevisionMigration = stored.sessionOperations.some((operation) =>
          !Array.isArray(operation.memberRevisions) ||
          operation.memberRevisions.length !== operation.memberLocalIds.length,
        );
        const normalizedOperations = stored.sessionOperations
          .filter((operation) => !inMemoryOperationIds.has(operation.operationId))
          .map((operation) => ({
          ...operation,
          memberRevisions: Array.isArray(operation.memberRevisions) &&
            operation.memberRevisions.length === operation.memberLocalIds.length
            ? operation.memberRevisions
            : operation.memberLocalIds.map(
                (localId) => recordsByLocalId.get(localId)?.revision ?? 0,
              ),
        }));
        const interruptedOperationIds = new Set(
          normalizedOperations
            .filter((operation) => operation.syncState === "syncing")
            .map((operation) => operation.operationId),
        );
        const interruptedCookIds = new Set(
          records
            .filter((record) => record.syncState === "syncing")
            .map((record) => record.localId),
        );
        // A process may be killed after persisting "syncing" and before a
        // response arrives. On the next launch it is safe to replay the
        // idempotent session operation, never to strand it forever.
        sessionOperations = [
          ...sessionOperations,
          ...normalizedOperations.map((operation) =>
          interruptedOperationIds.has(operation.operationId)
            ? {
                ...operation,
                syncState: "pending" as const,
                syncError: null,
                nextRetryAt: null,
              }
            : operation,
          ),
        ];
        if (
          interruptedOperationIds.size > 0 ||
          interruptedCookIds.size > 0 ||
          needsMemberRevisionMigration ||
          hadPreHydrationRecords ||
          hadPreHydrationOperations
        ) {
          records = records.map((record) => (
            interruptedCookIds.has(record.localId) ||
            interruptedOperationIds.has(record.sessionOperationId ?? "")
              ? {
                  ...record,
                  syncState: "pending" as const,
                  syncError: null,
                  nextRetryAt: null,
                }
              : record
          ));
          queuePersist();
        }
      })
      .then(() => {
        hydrated = true;
        notify();
      })
      .catch((error) => {
        // A timed-out native read may settle later, but its result must not
        // mutate this module. Let a later user retry start a clean read.
        hydrated = false;
        hydratePromise = null;
        notify();
        throw error;
      });
  }
  return hydratePromise;
}

function ownerMatches(record: LocalCookRecord, ownerId: string | null | undefined) {
  return record.ownerId === (ownerId || "anonymous");
}

function toCook(record: LocalCookRecord): Cook {
  return {
    ...record.cook,
    id: record.localId,
    _localCook: true,
    _syncState: record.syncState,
    _syncError: record.syncError,
    _serverId: record.serverId,
  } as unknown as Cook;
}

export function isLocalCookId(id: string | number | null | undefined) {
  return Number(id) < 0;
}

export function useLocalCooks(ownerId: string | null | undefined) {
  const [, setVersion] = useState(0);
  const ownerKey = ownerId || "anonymous";

  useEffect(() => {
    const onChange = () => setVersion((version) => version + 1);
    listeners.add(onChange);
    void hydrateLocalCooks();
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  useEffect(() => {
    if (!hydrated || ownerKey === "anonymous") return;
    void claimAnonymousCooks(ownerKey).then(() => syncLocalCooks(ownerKey));
  }, [ownerKey, hydrated]);

  useEffect(() => {
    if (!hydrated || ownerKey === "anonymous") return;
    void syncLocalCooks(ownerKey);
  }, [ownerKey, hydrated]);

  return {
    isHydrated: hydrated,
    cooks: records
      .filter((record) => ownerMatches(record, ownerKey) && !record.deletedAt)
      .map(toCook),
  };
}

export function useLocalCook(id: string | number | null | undefined, ownerId: string | null | undefined) {
  const { cooks, isHydrated } = useLocalCooks(ownerId);
  const localId = Number(id);
  return {
    isHydrated,
    cook: cooks.find((cook) => cook.id === localId),
  };
}

function newLocalId() {
  // Negative IDs are accepted by Expo Router and can never collide with the
  // database's positive serial IDs. The random suffix also protects rapid taps.
  return -(Date.now() * 1000 + Math.floor(Math.random() * 1000));
}

export function createLocalCook(
  ownerId: string | null | undefined,
  payload: Record<string, unknown>,
  options: LocalCookCreateOptions = {},
) {
  // Do not put a cold or stalled native read on the create CTA's critical
  // path. Hydration runs after the foreground transition and merges late
  // storage data with this already-committed record.
  if (!hydrated) queueHydrationAfterForegroundTransition();
  const ownerKey = ownerId || "anonymous";
  const localCreateKey = options.localCreateKey ?? null;
  // A write can time out after the native layer has accepted it. Keep that
  // in-memory record and reuse that individual create key on retry instead of
  // adding a duplicate. A multi-cook session shares one sessionId across its
  // members, so sessionId alone is not safe as a local deduplication key.
  if (localCreateKey) {
    const existing = records.find((record) =>
      ownerMatches(record, ownerKey) &&
      !record.deletedAt &&
      record.localCreateKey === localCreateKey,
    );
    if (existing) {
      queuePersistAfterForegroundTransition();
      return toCook(existing);
    }
  }
  const now = new Date().toISOString();
  const localId = newLocalId();
  const record: LocalCookRecord = {
    localId,
    ownerId: ownerKey,
    serverId: options.serverId ?? null,
    cook: {
      ...options.snapshot,
      ...payload,
      id: localId,
      createdAt: now,
      updatedAt: now,
      confirmedSteps: (payload.confirmedSteps as Record<string, string> | undefined) ?? {},
    },
    syncPayload: { ...payload },
    syncState: "pending",
    syncError: null,
    revision: 1,
    syncAttempts: 0,
    nextRetryAt: null,
    updatedAt: now,
    deletedAt: null,
    localCreateKey,
  };
  records = [record, ...records];
  notify();
  queuePersistAfterForegroundTransition();
  return toCook(record);
}

/**
 * Keep exactly one local working copy for a server cook. Planning revisions can
 * be saved repeatedly while offline; creating a fresh mirror each time would
 * make competing PATCHes and duplicate list rows.
 */
export async function upsertLocalServerCook(
  ownerId: string | null | undefined,
  serverId: number,
  payload: Record<string, unknown>,
  snapshot?: Record<string, unknown>,
) {
  if (serverId <= 0) {
    throw new Error("A server mirror requires a positive server ID.");
  }
  await hydrateLocalCooks();
  const existing = records.find((record) =>
    ownerMatches(record, ownerId) && record.serverId === serverId && !record.deletedAt,
  );
  if (existing) return updateLocalCook(existing.localId, payload);
  return createLocalCook(ownerId, payload, { serverId, snapshot });
}

export async function updateLocalCook(
  localId: number,
  patch: Record<string, unknown>,
) {
  await hydrateLocalCooks();
  const index = records.findIndex((record) => record.localId === localId);
  if (index < 0) throw new Error("This local cook is no longer available.");
  const record = records[index];
  const now = new Date().toISOString();
  const next: LocalCookRecord = {
    ...record,
    cook: { ...record.cook, ...patch, updatedAt: now },
    syncPayload: { ...record.syncPayload, ...patch },
    syncState: "pending",
    syncError: null,
    revision: (record.revision ?? 0) + 1,
    nextRetryAt: null,
    updatedAt: now,
  };
  records = records.map((item, itemIndex) => itemIndex === index ? next : item);
  notify();
  queuePersist();
  return toCook(next);
}

/** Apply one coherent session revision to every locally persisted member. */
export async function updateLocalCookSession(
  ownerId: string | null | undefined,
  sessionId: string,
  patch: Record<string, unknown>,
) {
  await hydrateLocalCooks();
  const matching = records
    .filter((record) => ownerMatches(record, ownerId) && !record.deletedAt && record.cook.sessionId === sessionId)
    .map((record) => record.localId);
  for (const localId of matching) {
    await updateLocalCook(localId, patch);
  }
}

function toLiveSessionMember(record: LocalCookRecord): LiveCookSessionMember {
  const payload = record.syncPayload;
  const nullableNumber = (value: unknown) => typeof value === "number" ? value : null;
  const nullableString = (value: unknown) => typeof value === "string" ? value : null;
  return {
    serverId: record.serverId,
    foodType: String(payload.foodType ?? record.cook.foodType ?? "Cook"),
    weightLbs: nullableNumber(payload.weightLbs),
    cookTempF: nullableNumber(payload.cookTempF),
    targetTempF: nullableNumber(payload.targetTempF),
    grillId: nullableNumber(payload.grillId),
    status: payload.status === "active" ? "active" : "planned",
    plannedStartAt: nullableString(payload.plannedStartAt),
    plannedEndAt: nullableString(payload.plannedEndAt),
    preheatMinutes: nullableNumber(payload.preheatMinutes),
    restMinutes: nullableNumber(payload.restMinutes),
    wrapMethod: nullableString(payload.wrapMethod),
    wrapAtMinutes: nullableNumber(payload.wrapAtMinutes),
    wrapTempF: nullableNumber(payload.wrapTempF),
    wrapReason: nullableString(payload.wrapReason),
    cookingMethod: nullableString(payload.cookingMethod),
    fromFrozen: typeof payload.fromFrozen === "boolean" ? payload.fromFrozen : null,
    thawMethod: nullableString(payload.thawMethod),
    notes: nullableString(payload.notes),
  };
}

function newSessionOperationId() {
  return `live-session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Replace any unsent reconciliation for this session with one complete,
 * idempotent operation. Individual member records are held out of the normal
 * create/PATCH outbox until this operation succeeds or reaches a recovery state.
 */
export async function enqueueLiveCookSessionReconciliation(
  ownerId: string | null | undefined,
  sessionId: string,
  anchorCookId: number | null,
  memberLocalIds: number[],
  sequenceData: Record<string, unknown>,
) {
  await hydrateLocalCooks();
  const ownerKey = ownerId || "anonymous";
  const requestedIds = new Set(memberLocalIds);
  const members = records.filter((record) =>
    ownerMatches(record, ownerKey) &&
    !record.deletedAt &&
    (requestedIds.has(record.localId) || record.cook.sessionId === sessionId),
  );
  if (members.length === 0) {
    throw new Error("The local live cook plan is no longer available.");
  }

  const operationId = newSessionOperationId();
  const now = new Date().toISOString();
  const operation: LocalCookSessionOperation = {
    operationId,
    ownerId: ownerKey,
    sessionId,
    anchorCookId,
    memberLocalIds: members.map((record) => record.localId),
    memberRevisions: members.map((record) => record.revision ?? 0),
    members: members.map(toLiveSessionMember),
    sequenceData,
    syncState: "pending",
    syncError: null,
    syncAttempts: 0,
    nextRetryAt: null,
    updatedAt: now,
  };

  // Coalescing means a second offline add sends one complete, newest revision
  // rather than replaying stale intermediate membership changes on reconnect.
  sessionOperations = sessionOperations.filter((item) =>
    !(item.ownerId === ownerKey && item.sessionId === sessionId && item.syncState !== "syncing"),
  );
  records = records.map((record) => operation.memberLocalIds.includes(record.localId)
    ? {
        ...record,
        sessionOperationId: operationId,
        syncState: "pending",
        syncError: null,
        nextRetryAt: null,
        updatedAt: now,
      }
    : record);
  sessionOperations = [...sessionOperations, operation];
  notify();
  queuePersist();
  return operation;
}

/**
 * Persists the changed anchor, every visible member, the new item, and the
 * session operation in one AsyncStorage snapshot. This is intentionally not
 * composed from create/update helpers: a process death between those writes
 * would otherwise let independent cook retries escape the session operation.
 */
export async function saveLiveCookSessionBaseline(input: {
  ownerId: string | null | undefined;
  sessionId: string;
  anchorLocalId?: number | null;
  anchorServerId?: number | null;
  anchorPayload: Record<string, unknown>;
  anchorSnapshot?: Record<string, unknown>;
  addedPayload: Record<string, unknown>;
  sequenceData: Record<string, unknown>;
}) {
  await hydrateLocalCooks();
  const ownerKey = input.ownerId || "anonymous";
  const now = new Date().toISOString();
  const anchorIndex = records.findIndex((record) =>
    ownerMatches(record, ownerKey) &&
    !record.deletedAt &&
    (record.localId === input.anchorLocalId ||
      (input.anchorServerId != null && record.serverId === input.anchorServerId)),
  );
  const anchorRecord: LocalCookRecord = anchorIndex >= 0
    ? {
        ...records[anchorIndex],
        cook: { ...records[anchorIndex].cook, ...input.anchorPayload, updatedAt: now },
        syncPayload: { ...records[anchorIndex].syncPayload, ...input.anchorPayload },
        syncState: "pending",
        syncError: null,
        revision: records[anchorIndex].revision + 1,
        nextRetryAt: null,
        updatedAt: now,
      }
    : {
        localId: newLocalId(),
        ownerId: ownerKey,
        serverId: input.anchorServerId ?? null,
        cook: {
          ...input.anchorSnapshot,
          ...input.anchorPayload,
          id: 0,
          createdAt: now,
          updatedAt: now,
          confirmedSteps: {},
        },
        syncPayload: { ...input.anchorPayload },
        syncState: "pending",
        syncError: null,
        revision: 1,
        syncAttempts: 0,
        nextRetryAt: null,
        updatedAt: now,
        deletedAt: null,
      };
  anchorRecord.cook.id = anchorRecord.localId;

  const addedRecord: LocalCookRecord = {
    localId: newLocalId(),
    ownerId: ownerKey,
    serverId: null,
    cook: {
      ...input.addedPayload,
      id: 0,
      createdAt: now,
      updatedAt: now,
      confirmedSteps: {},
    },
    syncPayload: { ...input.addedPayload },
    syncState: "pending",
    syncError: null,
    revision: 1,
    syncAttempts: 0,
    nextRetryAt: null,
    updatedAt: now,
    deletedAt: null,
  };
  addedRecord.cook.id = addedRecord.localId;

  const nextRecords = records
    .map((record, index) => {
      if (index === anchorIndex) return anchorRecord;
      if (ownerMatches(record, ownerKey) && !record.deletedAt && record.cook.sessionId === input.sessionId) {
        return {
          ...record,
          cook: { ...record.cook, sequenceData: input.sequenceData, updatedAt: now },
          syncPayload: { ...record.syncPayload, sequenceData: input.sequenceData },
          syncState: "pending" as const,
          syncError: null,
          nextRetryAt: null,
          updatedAt: now,
        };
      }
      return record;
    });
  if (anchorIndex < 0) nextRecords.unshift(anchorRecord);
  nextRecords.unshift(addedRecord);
  const memberRecords = nextRecords.filter((record) =>
    ownerMatches(record, ownerKey) && !record.deletedAt && record.cook.sessionId === input.sessionId,
  );
  const operationId = newSessionOperationId();
  const operation: LocalCookSessionOperation = {
    operationId,
    ownerId: ownerKey,
    sessionId: input.sessionId,
    anchorCookId: anchorRecord.serverId,
    memberLocalIds: memberRecords.map((record) => record.localId),
    memberRevisions: memberRecords.map((record) => record.revision ?? 0),
    members: memberRecords.map(toLiveSessionMember),
    sequenceData: input.sequenceData,
    syncState: "pending",
    syncError: null,
    syncAttempts: 0,
    nextRetryAt: null,
    updatedAt: now,
  };
  records = nextRecords.map((record) => operation.memberLocalIds.includes(record.localId)
    ? { ...record, sessionOperationId: operationId, syncState: "pending", syncError: null, nextRetryAt: null }
    : record);
  sessionOperations = [
    ...sessionOperations.filter((item) =>
      !(item.ownerId === ownerKey && item.sessionId === input.sessionId && item.syncState !== "syncing"),
    ),
    operation,
  ];
  notify();
  queuePersist();
  return { anchor: toCook(anchorRecord), added: toCook(addedRecord), operation };
}

export async function deleteLocalCook(localId: number) {
  await hydrateLocalCooks();
  const record = records.find((item) => item.localId === localId);
  if (!record) return;
  // Keep a hidden tombstone even before the create receives a server ID. If
  // the create is already in flight, the outbox can then delete the eventual
  // server copy instead of accidentally resurrecting it.
  records = records.map((item) => item.localId === localId
    ? {
        ...item,
        deletedAt: new Date().toISOString(),
        syncState: "pending",
        syncError: null,
        revision: (item.revision ?? 0) + 1,
        nextRetryAt: null,
      }
    : item);
  notify();
  queuePersist();
}

/**
 * A permanent server rejection is intentionally retained for review. If the
 * pitmaster chooses to discard it, remove the complete local revision so the
 * last canonical server plan can show again rather than replaying it forever.
 */
export async function discardRejectedLiveCookSession(localId: number) {
  await hydrateLocalCooks();
  const record = records.find((item) => item.localId === localId);
  const operation = record?.sessionOperationId
    ? sessionOperations.find((item) => item.operationId === record.sessionOperationId)
    : undefined;
  if (!operation || operation.syncState !== "error" || operation.nextRetryAt != null) {
    throw new Error("This saved session is not awaiting review.");
  }
  const memberLocalIds = new Set(operation.memberLocalIds);
  records = records.filter((item) => !memberLocalIds.has(item.localId));
  sessionOperations = sessionOperations.filter((item) => item.operationId !== operation.operationId);
  notify();
  queuePersist();
}

async function claimAnonymousCooks(ownerId: string) {
  const claimable = records.filter((record) => record.ownerId === "anonymous");
  if (claimable.length === 0) return;
  records = records.map((record) => record.ownerId === "anonymous"
    ? { ...record, ownerId, syncState: record.syncState === "synced" ? "synced" : "pending" }
    : record);
  notify();
  queuePersist();
}

async function requestWithTimeout<T>(request: (signal: AbortSignal) => Promise<T>) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);
  try {
    return await request(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
}

async function replaceRecord(localId: number, next: LocalCookRecord) {
  records = records.map((record) => record.localId === localId ? next : record);
  notify();
  try {
    await persist();
  } catch (error) {
    // A timed-out full-snapshot write can still settle late. Keep the in-memory
    // outbox retryable until that native operation settles instead of leaving
    // this cook permanently marked as syncing.
    const previous = records.find((record) => record.localId === localId);
    if (previous === next) {
      records = records.map((record) => record.localId === localId
        ? { ...record, syncState: "pending", syncError: null, nextRetryAt: null }
        : record);
      notify();
    }
    throw error;
  }
}

function errorStatus(error: any) {
  return Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
}

function isRetryableError(error: any) {
  const status = errorStatus(error);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function sessionOperationMatches(operation: LocalCookSessionOperation, ownerId: string) {
  return operation.ownerId === ownerId;
}

async function replaceSessionOperation(operationId: string, next: LocalCookSessionOperation | null) {
  const previous = sessionOperations.find((operation) => operation.operationId === operationId) ?? null;
  sessionOperations = next
    ? sessionOperations.map((operation) => operation.operationId === operationId ? next : operation)
    : sessionOperations.filter((operation) => operation.operationId !== operationId);
  notify();
  try {
    await persist();
  } catch (error) {
    // Same recovery rule as individual cooks: don't retain an unconfirmed
    // syncing transition when storage timed out before it became durable.
    if (previous && sessionOperations.find((operation) => operation.operationId === operationId) === next) {
      sessionOperations = sessionOperations.map((operation) =>
        operation.operationId === operationId
          ? { ...previous, syncState: "pending", syncError: null, nextRetryAt: null }
          : operation,
      );
      notify();
    }
    throw error;
  }
}

function responseCookForMember(
  cooks: Cook[],
  member: LiveCookSessionMember,
) {
  if (member.serverId != null) {
    return cooks.find((cook) => cook.id === member.serverId);
  }
  const plannedStart = member.plannedStartAt ? new Date(member.plannedStartAt).getTime() : null;
  return cooks.find((cook) =>
    plannedStart != null &&
    cook.plannedStartAt != null &&
    new Date(cook.plannedStartAt).getTime() === plannedStart,
  );
}

async function syncLiveCookSessionOperations(ownerId: string, now: number) {
  const dueOperations = sessionOperations.filter((operation) =>
    sessionOperationMatches(operation, ownerId) && (
      operation.syncState === "pending" ||
      (operation.syncState === "error" && operation.nextRetryAt != null && operation.nextRetryAt <= now)
    ),
  );

  for (const operation of dueOperations) {
    const syncing: LocalCookSessionOperation = {
      ...operation,
      syncState: "syncing",
      syncError: null,
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    };
    await replaceSessionOperation(operation.operationId, syncing);
    try {
      const response = await requestWithTimeout((signal) =>
        reconcileLiveCookSession(
          syncing.sessionId,
          {
            operationId: syncing.operationId,
            anchorCookId: syncing.anchorCookId,
            members: syncing.members,
            sequenceData: syncing.sequenceData,
          } as ReconcileLiveCookSessionBody,
          { signal },
        ),
      );
      const latest = sessionOperations.find((item) => item.operationId === syncing.operationId);
      if (!latest) continue;

      // A newer local revision can arrive while the request is in flight. Its
      // record ownership must win, but the successful response can still fill
      // server IDs for the operation that just committed.
      records = records.map((record) => {
        const memberIndex = syncing.memberLocalIds.indexOf(record.localId);
        if (memberIndex < 0) return record;
        const remote = responseCookForMember(response.cooks, syncing.members[memberIndex]);
        const stillOwnedByThisOperation = record.sessionOperationId === syncing.operationId;
        const unchangedSinceOperation = syncing.memberRevisions == null ||
          (record.revision ?? 0) === syncing.memberRevisions[memberIndex];
        return {
          ...record,
          ...(remote ? {
            serverId: remote.id,
            cook: { ...record.cook, ...remote, id: record.localId },
          } : {}),
          ...(stillOwnedByThisOperation && unchangedSinceOperation && !record.deletedAt ? {
            sessionOperationId: null,
            syncState: "synced" as const,
            syncError: null,
            syncAttempts: 0,
            nextRetryAt: null,
          } : stillOwnedByThisOperation && (record.deletedAt || !unchangedSinceOperation) ? {
            // The old request committed, but this member changed while it was
            // in flight. Give the newer revision to the ordinary outbox after
            // applying any server ID returned by the old reconciliation. A
            // tombstone therefore deletes a just-created member instead of
            // resurrecting it, and an edit becomes a PATCH rather than a
            // duplicate create.
            sessionOperationId: null,
            syncState: "pending" as const,
            syncError: null,
            nextRetryAt: null,
          } : {}),
        };
      });
      sessionOperations = sessionOperations.filter((item) => item.operationId !== syncing.operationId);
      notify();
      await persist();
    } catch (error: any) {
      const latest = sessionOperations.find((item) => item.operationId === syncing.operationId);
      if (!latest) continue;
      const syncAttempts = latest.syncAttempts + 1;
      const retryable = isRetryableError(error);
      const recoveryError = retryable
        ? error?.message || "Waiting to reconnect and reconcile this live session."
        : error?.message || "The live session could not be reconciled. Your local plan is still saved.";
      const next: LocalCookSessionOperation = {
        ...latest,
        syncState: "error",
        syncError: recoveryError,
        syncAttempts,
        nextRetryAt: retryable
          ? Date.now() + RETRY_DELAYS_MS[Math.min(syncAttempts - 1, RETRY_DELAYS_MS.length - 1)]
          : null,
        updatedAt: new Date().toISOString(),
      };
      sessionOperations = sessionOperations.map((item) => item.operationId === syncing.operationId ? next : item);
      records = records.map((record) => record.sessionOperationId === syncing.operationId
        ? {
            ...record,
            syncState: "error",
            syncError: recoveryError,
            syncAttempts,
            nextRetryAt: next.nextRetryAt,
          }
        : record);
      notify();
      await persist();
    }
  }
}

function scheduleRetry(ownerId: string) {
  if (retryTimer) clearTimeout(retryTimer);
  const nextRetryAt = [
    ...records
      .filter((record) => ownerMatches(record, ownerId) && record.nextRetryAt != null)
      .map((record) => record.nextRetryAt!),
    ...sessionOperations
      .filter((operation) => sessionOperationMatches(operation, ownerId) && operation.nextRetryAt != null)
      .map((operation) => operation.nextRetryAt!),
  ]
    .sort((a, b) => a - b)[0];
  if (nextRetryAt == null) return;
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void syncLocalCooks(ownerId);
  }, Math.max(0, nextRetryAt - Date.now()));
}

export async function syncLocalCooks(ownerId: string | null | undefined) {
  const ownerKey = ownerId || "anonymous";
  if (ownerKey === "anonymous" || syncInProgress) return;
  await hydrateLocalCooks();
  syncInProgress = true;
  let storageRetryPending = false;
  try {
    const now = Date.now();
    await syncLiveCookSessionOperations(ownerKey, now);
    for (const record of records.filter((item) =>
      ownerMatches(item, ownerKey) && !item.sessionOperationId && (
        item.syncState === "pending" ||
        (item.syncState === "error" && item.nextRetryAt != null && item.nextRetryAt <= now)
      ),
    )) {
      const syncing = { ...record, syncState: "syncing" as const, syncError: null };
      await replaceRecord(record.localId, syncing);
      try {
        if (syncing.deletedAt && syncing.serverId) {
          try {
            await requestWithTimeout((signal) => deleteCookRequest(syncing.serverId!, { signal } as any));
          } catch (error: any) {
            // The delete may have committed before its response was lost.
            // A 404 already represents the desired deleted server state.
            if (errorStatus(error) !== 404) throw error;
          }
          records = records.filter((item) => item.localId !== syncing.localId);
          notify();
          await persist();
          continue;
        }
        if (syncing.deletedAt) {
          records = records.filter((item) => item.localId !== syncing.localId);
          notify();
          await persist();
          continue;
        }
        if (!syncing.serverId) {
          const created = await requestWithTimeout((signal) =>
            createCookRequest(syncing.syncPayload as any, { signal }),
          );
          const latest = records.find((item) => item.localId === syncing.localId);
          if (latest) {
            await replaceRecord(syncing.localId, {
              ...latest,
              serverId: (created as Cook).id,
              syncState: (latest.revision ?? 0) === (syncing.revision ?? 0) ? "synced" : "pending",
              syncError: null,
              syncAttempts: 0,
              nextRetryAt: null,
            });
          }
        } else {
          await requestWithTimeout((signal) =>
            updateCookRequest(syncing.serverId!, syncing.syncPayload as any, { signal } as any),
          );
          const latest = records.find((item) => item.localId === syncing.localId);
          if (latest && (latest.revision ?? 0) === (syncing.revision ?? 0)) {
            await replaceRecord(syncing.localId, {
              ...latest,
              syncState: "synced",
              syncError: null,
              syncAttempts: 0,
              nextRetryAt: null,
            });
          } else if (latest) {
            await replaceRecord(syncing.localId, {
              ...latest,
              syncState: "pending",
              syncError: null,
              nextRetryAt: null,
            });
          }
        }
      } catch (error: any) {
        const latest = records.find((item) => item.localId === syncing.localId);
        if (latest && (latest.revision ?? 0) === (syncing.revision ?? 0)) {
          const syncAttempts = (latest.syncAttempts ?? 0) + 1;
          // Transient connectivity failures should never abandon a cook. The
          // delay is bounded at five minutes, but the durable outbox continues
          // retrying until it reaches the requested server state.
          const retryable = isRetryableError(error);
          await replaceRecord(syncing.localId, {
            ...latest,
            syncState: "error",
            syncError: error?.message || "Will retry when a connection is available.",
            syncAttempts,
            nextRetryAt: retryable
              ? Date.now() + RETRY_DELAYS_MS[Math.min(syncAttempts - 1, RETRY_DELAYS_MS.length - 1)]
              : null,
          });
        }
      }
    }
  } catch (error) {
    if (!isLocalCookStorageError(error)) throw error;
    // The native operation that timed out is still serialized by persist().
    // Retrying on the next tick would only spin on the blocked write; wait for
    // a fresh bounded attempt instead. Hydration also repairs any late
    // "syncing" snapshot if the app closes before this retry.
    storageRetryPending = true;
  } finally {
    syncInProgress = false;
    if (storageRetryPending) {
      setTimeout(() => {
        void syncLocalCooks(ownerKey).catch(() => {});
      }, LOCAL_COOK_STORAGE_TIMEOUT_MS);
    } else if (
      records.some((record) => ownerMatches(record, ownerKey) && !record.sessionOperationId && record.syncState === "pending") ||
      sessionOperations.some((operation) => sessionOperationMatches(operation, ownerKey) && operation.syncState === "pending")
    ) {
      setTimeout(() => void syncLocalCooks(ownerKey), 0);
    }
    scheduleRetry(ownerKey);
  }
}

export function mergeLocalAndServerCooks(serverCooks: Cook[] | undefined, localCooks: Cook[]) {
  const serverRows = serverCooks ?? [];
  const matchedServerIds = new Set<number>();
  const serverMatchByLocalIndex = new Map<number, Cook>();
  const createGroupKey = (cook: Cook): string | null => {
    const candidate = cook as any;
    if (!candidate.sessionId || !candidate.plannedStartAt) return null;
    const start = new Date(candidate.plannedStartAt).getTime();
    return Number.isFinite(start) ? `${candidate.sessionId}:${start}` : null;
  };

  // Rows that already have a server ID can be paired exactly, including local
  // edits that are still pending an update.
  localCooks.forEach((localCook, index) => {
    const serverId = (localCook as any)._serverId;
    if (typeof serverId !== "number") return;
    const matchingServer = serverRows.find((serverCook) => serverCook.id === serverId);
    if (!matchingServer) return;
    serverMatchByLocalIndex.set(index, matchingServer);
    matchedServerIds.add(matchingServer.id);
  });

  // A create can commit before the outbox gets to persist its server IDs. Match
  // those rows as complete groups, not one at a time: multi-cook members can
  // share both a session ID and a planned start. Pairing only a full one-to-one
  // group keeps the local rows visible exactly once until reconciliation wins.
  const unacknowledgedLocalGroups = new Map<string, Array<{ index: number; cook: Cook }>>();
  localCooks.forEach((localCook, index) => {
    if (serverMatchByLocalIndex.has(index)) return;
    const key = createGroupKey(localCook);
    if (!key) return;
    const group = unacknowledgedLocalGroups.get(key) ?? [];
    group.push({ index, cook: localCook });
    unacknowledgedLocalGroups.set(key, group);
  });

  for (const [key, localGroup] of unacknowledgedLocalGroups) {
    const serverGroup = serverRows.filter((serverCook) =>
      !matchedServerIds.has(serverCook.id) && createGroupKey(serverCook) === key,
    );
    if (serverGroup.length !== localGroup.length) continue;
    localGroup.forEach(({ index }, groupIndex) => {
      const matchingServer = serverGroup[groupIndex];
      serverMatchByLocalIndex.set(index, matchingServer);
      matchedServerIds.add(matchingServer.id);
    });
  }

  const localRows = localCooks.map((localCook, index) => {
    const matchingServer = serverMatchByLocalIndex.get(index);
    if (!matchingServer) return localCook;
    // Once sync is confirmed, always show canonical server state. Keeping the
    // stale local snapshot would otherwise mask server-side completion/status
    // changes across a relaunch. Pending/error edits remain local-first.
    return (localCook as any)._syncState === "synced" ? matchingServer : localCook;
  });

  return [
    ...localRows,
    ...serverRows.filter((cook) => !matchedServerIds.has(cook.id)),
  ];
}