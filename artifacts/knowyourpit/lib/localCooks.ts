import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import {
  createCook as createCookRequest,
  updateCook as updateCookRequest,
  deleteCook as deleteCookRequest,
  type Cook,
} from "@workspace/api-client-react";

const STORAGE_KEY = "knowyourpit.local-cooks.v1";
const SYNC_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [5_000, 15_000, 45_000, 120_000, 300_000];

export type LocalCookSyncState = "pending" | "syncing" | "synced" | "error";

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
}

interface StoredLocalCooks {
  version: 1;
  cooks: LocalCookRecord[];
}

let records: LocalCookRecord[] = [];
let hydrated = false;
let hydratePromise: Promise<void> | null = null;
let persistQueue: Promise<void> = Promise.resolve();
let syncInProgress = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

function sanitizeStored(value: unknown): LocalCookRecord[] {
  if (!value || typeof value !== "object") return [];
  const stored = value as Partial<StoredLocalCooks>;
  if (stored.version !== 1 || !Array.isArray(stored.cooks)) return [];
  return stored.cooks.filter((record): record is LocalCookRecord => (
    !!record &&
    typeof record.localId === "number" &&
    typeof record.ownerId === "string" &&
    !!record.cook &&
    !!record.syncPayload
  ));
}

function persist() {
  const snapshot: StoredLocalCooks = { version: 1, cooks: records };
  persistQueue = persistQueue
    .catch(() => {})
    .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)));
  return persistQueue;
}

export async function hydrateLocalCooks() {
  if (hydrated) return;
  if (!hydratePromise) {
    hydratePromise = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          try {
            records = sanitizeStored(JSON.parse(raw));
          } catch {
            records = [];
          }
        }
      })
      .finally(() => {
        hydrated = true;
        notify();
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

export async function createLocalCook(
  ownerId: string | null | undefined,
  payload: Record<string, unknown>,
  options: LocalCookCreateOptions = {},
) {
  await hydrateLocalCooks();
  const now = new Date().toISOString();
  const localId = newLocalId();
  const record: LocalCookRecord = {
    localId,
    ownerId: ownerId || "anonymous",
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
  };
  records = [record, ...records];
  notify();
  await persist();
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
  await persist();
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
  await persist();
}

async function claimAnonymousCooks(ownerId: string) {
  const claimable = records.filter((record) => record.ownerId === "anonymous");
  if (claimable.length === 0) return;
  records = records.map((record) => record.ownerId === "anonymous"
    ? { ...record, ownerId, syncState: record.syncState === "synced" ? "synced" : "pending" }
    : record);
  notify();
  await persist();
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
  await persist();
}

function errorStatus(error: any) {
  return Number(error?.status ?? error?.statusCode ?? error?.response?.status ?? 0);
}

function isRetryableError(error: any) {
  const status = errorStatus(error);
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

function scheduleRetry(ownerId: string) {
  if (retryTimer) clearTimeout(retryTimer);
  const nextRetryAt = records
    .filter((record) => ownerMatches(record, ownerId) && record.nextRetryAt != null)
    .map((record) => record.nextRetryAt!)
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
  try {
    const now = Date.now();
    for (const record of records.filter((item) =>
      ownerMatches(item, ownerKey) && (
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
  } finally {
    syncInProgress = false;
    if (records.some((record) => ownerMatches(record, ownerKey) && record.syncState === "pending")) {
      setTimeout(() => void syncLocalCooks(ownerKey), 0);
    }
    scheduleRetry(ownerKey);
  }
}

export function mergeLocalAndServerCooks(serverCooks: Cook[] | undefined, localCooks: Cook[]) {
  const localServerIds = new Set(
    localCooks
      .map((cook) => (cook as any)._serverId)
      .filter((id): id is number => typeof id === "number"),
  );
  return [
    ...localCooks,
    ...((serverCooks ?? []).filter((cook) => !localServerIds.has(cook.id))),
  ];
}