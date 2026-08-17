/**
 * Smoke test — probe label and role persistence round-trip.
 *
 * Verifies that saveMeatProbeId / savePitProbeId / saveProbeLabels /
 * buildUpdatedProbeLabels + loadProbeState correctly survive a simulated
 * "app restart" (fresh in-memory state; data persists only through storage).
 *
 * The persistence logic below mirrors artifacts/knowyourpit/utils/probePersistence.ts
 * exactly.  Any drift between the two files should be treated as a bug.
 *
 * Run:
 *   pnpm --filter @workspace/scripts run test:probe-persistence
 */

// ---------------------------------------------------------------------------
// Persistence interface + pure functions (mirrors probePersistence.ts)
// ---------------------------------------------------------------------------

interface ProbeStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface LoadedProbeState {
  meatProbeId: string | null;
  pitProbeId: string | null;
  probeLabels: Record<string, string>;
}

async function loadProbeState(
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

  return { meatProbeId: meatVal ?? null, pitProbeId: pitVal ?? null, probeLabels };
}

async function saveMeatProbeId(
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

async function savePitProbeId(
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

async function saveProbeLabels(
  cookId: string | number,
  labels: Record<string, string>,
  storage: ProbeStorage,
): Promise<void> {
  await storage.setItem(`probe_labels_${cookId}`, JSON.stringify(labels)).catch(() => {});
}

function buildUpdatedProbeLabels(
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

// ---------------------------------------------------------------------------
// Minimal in-memory ProbeStorage (simulates AsyncStorage across restart)
// ---------------------------------------------------------------------------
function makeMemoryStorage(): ProbeStorage {
  const store = new Map<string, string>();
  return {
    getItem: async (key) => store.get(key) ?? null,
    setItem: async (key, value) => { store.set(key, value); },
    removeItem: async (key) => { store.delete(key); },
  };
}

// ---------------------------------------------------------------------------
// Assertion helpers
// ---------------------------------------------------------------------------
let passCount = 0;
let failCount = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓  ${message}`);
    passCount++;
  } else {
    console.error(`  ✗  ${message}`);
    failCount++;
  }
}

function assertEqual<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ✓  ${label}: ${JSON.stringify(actual)}`);
    passCount++;
  } else {
    console.error(`  ✗  ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    failCount++;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testBasicRoundTrip(): Promise<void> {
  console.log("\n[1] Basic round-trip — save then load (simulated restart)");
  const storage = makeMemoryStorage();
  const cookId = 42;

  await saveMeatProbeId(cookId, "inkbird:channel-1", storage);
  await savePitProbeId(cookId, "inkbird:ch-2", storage);

  let labels = buildUpdatedProbeLabels({}, "inkbird:channel-1", "Brisket Ch 1");
  labels = buildUpdatedProbeLabels(labels, "inkbird:ch-2", "Pit Probe");
  await saveProbeLabels(cookId, labels, storage);

  // Simulate restart — in-memory React state is gone; only storage persists
  const state = await loadProbeState(cookId, storage);
  assertEqual(state.meatProbeId, "inkbird:channel-1", "meatProbeId");
  assertEqual(state.pitProbeId, "inkbird:ch-2", "pitProbeId");
  assertEqual(state.probeLabels["inkbird:channel-1"], "Brisket Ch 1", "meat label");
  assertEqual(state.probeLabels["inkbird:ch-2"], "Pit Probe", "pit label");
}

async function testEmptyStorage(): Promise<void> {
  console.log("\n[2] Empty storage — fresh cook, no prior data");
  const storage = makeMemoryStorage();

  const state = await loadProbeState(999, storage);
  assertEqual(state.meatProbeId, null, "meatProbeId null");
  assertEqual(state.pitProbeId, null, "pitProbeId null");
  assertEqual(JSON.stringify(state.probeLabels), "{}", "probeLabels empty object");
}

async function testClearMeatProbe(): Promise<void> {
  console.log("\n[3] Clearing meat probe removes it from storage");
  const storage = makeMemoryStorage();
  const cookId = 7;

  await saveMeatProbeId(cookId, "inkbird:channel-3", storage);
  let state = await loadProbeState(cookId, storage);
  assertEqual(state.meatProbeId, "inkbird:channel-3", "meat probe set");

  await saveMeatProbeId(cookId, null, storage);
  state = await loadProbeState(cookId, storage);
  assertEqual(state.meatProbeId, null, "meat probe cleared");
}

async function testClearPitProbe(): Promise<void> {
  console.log("\n[4] Clearing pit probe removes it from storage");
  const storage = makeMemoryStorage();
  const cookId = 8;

  await savePitProbeId(cookId, "inkbird:ch-1", storage);
  let state = await loadProbeState(cookId, storage);
  assertEqual(state.pitProbeId, "inkbird:ch-1", "pit probe set");

  await savePitProbeId(cookId, null, storage);
  state = await loadProbeState(cookId, storage);
  assertEqual(state.pitProbeId, null, "pit probe cleared");
}

async function testRemoveLabelWhenEmpty(): Promise<void> {
  console.log("\n[5] Whitespace-only label string removes the key");
  const storage = makeMemoryStorage();
  const cookId = 11;

  const labels0 = buildUpdatedProbeLabels({}, "inkbird:ch-1", "My Probe");
  await saveProbeLabels(cookId, labels0, storage);

  const labels1 = buildUpdatedProbeLabels(labels0, "inkbird:ch-1", "  ");
  await saveProbeLabels(cookId, labels1, storage);

  const state = await loadProbeState(cookId, storage);
  assert(!("inkbird:ch-1" in state.probeLabels), "label key absent after empty save");
}

async function testLegacyKeyMigration(): Promise<void> {
  console.log("\n[6] Legacy probe_selection_* key is migrated to probe_meat_*");
  const storage = makeMemoryStorage();
  const cookId = 20;

  await storage.setItem(`probe_selection_${cookId}`, "inkbird:legacy-ch");

  const state = await loadProbeState(cookId, storage);
  assertEqual(state.meatProbeId, "inkbird:legacy-ch", "legacy key migrated → meatProbeId");

  const legacyAfter = await storage.getItem(`probe_selection_${cookId}`);
  const meatAfter = await storage.getItem(`probe_meat_${cookId}`);
  assertEqual(legacyAfter, null, "legacy key removed after migration");
  assertEqual(meatAfter, "inkbird:legacy-ch", "meat key written after migration");
}

async function testIsolationBetweenCooks(): Promise<void> {
  console.log("\n[7] Data is isolated per cook id");
  const storage = makeMemoryStorage();

  await saveMeatProbeId(1, "inkbird:ch-A", storage);
  await saveMeatProbeId(2, "inkbird:ch-B", storage);

  const s1 = await loadProbeState(1, storage);
  const s2 = await loadProbeState(2, storage);
  assertEqual(s1.meatProbeId, "inkbird:ch-A", "cook 1 meat probe");
  assertEqual(s2.meatProbeId, "inkbird:ch-B", "cook 2 meat probe");
}

async function testCorruptLabelsJson(): Promise<void> {
  console.log("\n[8] Corrupt labels JSON falls back to empty object");
  const storage = makeMemoryStorage();
  const cookId = 55;

  await storage.setItem(`probe_labels_${cookId}`, "NOT_VALID_JSON{{");
  const state = await loadProbeState(cookId, storage);
  assertEqual(JSON.stringify(state.probeLabels), "{}", "corrupt JSON → empty probeLabels");
}

async function testMultipleLabelsRoundTrip(): Promise<void> {
  console.log("\n[9] Multiple probes — all labels survive restart");
  const storage = makeMemoryStorage();
  const cookId = 77;
  const keys = ["inkbird:ch-1", "inkbird:ch-2", "ble:ch-3", "lan:ch-1"];

  let labels: Record<string, string> = {};
  for (const k of keys) {
    labels = buildUpdatedProbeLabels(labels, k, `Label for ${k}`);
  }
  await saveProbeLabels(cookId, labels, storage);

  const state = await loadProbeState(cookId, storage);
  for (const k of keys) {
    assertEqual(state.probeLabels[k], `Label for ${k}`, `label for ${k}`);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  console.log("=== Probe persistence smoke test ===");

  await testBasicRoundTrip();
  await testEmptyStorage();
  await testClearMeatProbe();
  await testClearPitProbe();
  await testRemoveLabelWhenEmpty();
  await testLegacyKeyMigration();
  await testIsolationBetweenCooks();
  await testCorruptLabelsJson();
  await testMultipleLabelsRoundTrip();

  console.log(`\n${"─".repeat(44)}`);
  console.log(`  Passed: ${passCount}  |  Failed: ${failCount}`);

  if (failCount > 0) {
    console.error("\nSome assertions failed.");
    process.exit(1);
  } else {
    console.log("\nAll assertions passed.");
  }
}

main().catch((err: unknown) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
