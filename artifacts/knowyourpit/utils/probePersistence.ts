/**
 * Probe-persistence utilities.
 *
 * Extracted from app/cooks/[id].tsx so the save/load round-trip can be
 * exercised in isolation (e.g. in the smoke test at
 * scripts/src/probePersistenceSmoke.ts) without pulling in any React Native
 * dependencies.
 *
 * The `ProbeStorage` interface mirrors the subset of the AsyncStorage API
 * that these helpers use.  The mobile app passes AsyncStorage directly; tests
 * pass a simple in-memory map.
 */

export interface ProbeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface LoadedProbeState {
  meatProbeId: string | null;
  pitProbeId: string | null;
  probeLabels: Record<string, string>;
}

/**
 * Read the saved probe selection + labels for a cook.
 *
 * Also handles the one-time migration from the legacy `probe_selection_{id}`
 * key to `probe_meat_{id}`.
 */
export async function loadProbeState(
  cookId: string | number,
  storage: ProbeStorage,
): Promise<LoadedProbeState> {
  const legacyKey = `probe_selection_${cookId}`;
  const meatKey = `probe_meat_${cookId}`;
  const pitKey = `probe_pit_${cookId}`;
  const labelsKey = `probe_labels_${cookId}`;

  const legacy = await storage.getItem(legacyKey);
  if (legacy) {
    await storage.setItem(meatKey, legacy).catch(() => {});
    await storage.removeItem(legacyKey).catch(() => {});
  }

  const [meatVal, pitVal, labelsRaw] = await Promise.all([
    storage.getItem(meatKey),
    storage.getItem(pitKey),
    storage.getItem(labelsKey),
  ]);

  let probeLabels: Record<string, string> = {};
  if (labelsRaw) {
    try {
      probeLabels = JSON.parse(labelsRaw) as Record<string, string>;
    } catch {
      /* ignore corrupt JSON */
    }
  }

  return {
    meatProbeId: meatVal ?? null,
    pitProbeId: pitVal ?? null,
    probeLabels,
  };
}

/**
 * Persist (or clear) the meat-probe selection for a cook.
 */
export async function saveMeatProbeId(
  cookId: string | number,
  probeId: string | null,
  storage: ProbeStorage,
): Promise<void> {
  const key = `probe_meat_${cookId}`;
  if (probeId == null) {
    await storage.removeItem(key).catch(() => {});
  } else {
    await storage.setItem(key, probeId).catch(() => {});
  }
}

/**
 * Persist (or clear) the pit-probe selection for a cook.
 */
export async function savePitProbeId(
  cookId: string | number,
  probeId: string | null,
  storage: ProbeStorage,
): Promise<void> {
  const key = `probe_pit_${cookId}`;
  if (probeId == null) {
    await storage.removeItem(key).catch(() => {});
  } else {
    await storage.setItem(key, probeId).catch(() => {});
  }
}

/**
 * Persist the full probe-labels map for a cook.
 */
export async function saveProbeLabels(
  cookId: string | number,
  labels: Record<string, string>,
  storage: ProbeStorage,
): Promise<void> {
  await storage.setItem(`probe_labels_${cookId}`, JSON.stringify(labels)).catch(() => {});
}

/**
 * Return a new labels map with the given probeKey set (or removed when
 * `label` is empty).  Pure — does not touch storage; callers must call
 * `saveProbeLabels` afterwards.
 */
export function buildUpdatedProbeLabels(
  prev: Record<string, string>,
  probeKey: string,
  label: string,
): Record<string, string> {
  const next = { ...prev };
  if (label.trim()) {
    next[probeKey] = label.trim();
  } else {
    delete next[probeKey];
  }
  return next;
}

// ── Last-used Inkbird probe ───────────────────────────────────────────────────

const LAST_INKBIRD_KEY = "ble_last_inkbird";

export interface LastInkbird {
  deviceId: string;
  deviceName: string;
}

/**
 * Persist the most-recently-used Inkbird device so it can be highlighted the
 * next time a cook screen opens.
 */
export async function saveLastInkbird(
  lastInkbird: LastInkbird,
  storage: ProbeStorage,
): Promise<void> {
  await storage.setItem(LAST_INKBIRD_KEY, JSON.stringify(lastInkbird)).catch(() => {});
}

/**
 * Read back the last-used Inkbird device, or null if none has been saved yet.
 */
export async function loadLastInkbird(
  storage: ProbeStorage,
): Promise<LastInkbird | null> {
  try {
    const raw = await storage.getItem(LAST_INKBIRD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as LastInkbird;
  } catch {
    return null;
  }
}

/**
 * Remove the last-used Inkbird entry (called when the user unassigns a BLE
 * probe from a cook).
 */
export async function clearLastInkbird(storage: ProbeStorage): Promise<void> {
  await storage.removeItem(LAST_INKBIRD_KEY).catch(() => {});
}
