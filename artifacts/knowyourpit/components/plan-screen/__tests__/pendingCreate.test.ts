/**
 * Tests for the Start-Cook pending-create helpers — the idempotency-key reuse
 * rules that guarantee retry paths (manual retry after cancel, foreground
 * recovery, timeout auto-retry) never create a duplicate cook, and never
 * silently dedup a retry whose create intent the user has since changed.
 */
import {
  PENDING_CREATE_TTL_MS,
  isPendingCreateFresh,
  shouldReusePendingCreate,
  findPendingCook,
  createIntentFingerprint,
  createLocalCreateKey,
  type PendingCreate,
} from "../pendingCreate";

const NOW = 1_700_000_000_000;

const INTENT = {
  foodType: "Brisket",
  weightLbs: 12,
  grillId: 1,
  targetTempF: "203",
  cookTempF: "250",
};
const FP = createIntentFingerprint(INTENT);

const pending = (over: Partial<PendingCreate> = {}): PendingCreate => ({
  sessionId: "abc-123",
  plannedStartAt: new Date(NOW),
  fingerprint: FP,
  startedAt: NOW,
  ...over,
});

describe("createIntentFingerprint", () => {
  it("is stable for the same intent and differs when any value changes", () => {
    expect(createIntentFingerprint(INTENT)).toBe(FP);
    expect(createIntentFingerprint({ ...INTENT, grillId: 2 })).not.toBe(FP);
    expect(createIntentFingerprint({ ...INTENT, cookTempF: "275" })).not.toBe(FP);
  });
});

describe("createLocalCreateKey", () => {
  it("creates a stable opaque key without native crypto", () => {
    const first = createLocalCreateKey(NOW, 0.25);
    const second = createLocalCreateKey(NOW, 0.25);
    const differentAttempt = createLocalCreateKey(NOW, 0.5);

    expect(first).toBe(second);
    expect(first).toMatch(/^local-[a-z0-9]+-[a-z0-9]+$/);
    expect(differentAttempt).not.toBe(first);
  });
});

describe("isPendingCreateFresh", () => {
  it("is false for null/undefined", () => {
    expect(isPendingCreateFresh(null, NOW)).toBe(false);
    expect(isPendingCreateFresh(undefined, NOW)).toBe(false);
  });

  it("is true within the TTL and false past it", () => {
    expect(isPendingCreateFresh(pending(), NOW + PENDING_CREATE_TTL_MS)).toBe(true);
    expect(isPendingCreateFresh(pending(), NOW + PENDING_CREATE_TTL_MS + 1)).toBe(false);
  });
});

describe("shouldReusePendingCreate", () => {
  it("reuses the key for an identical intent within the TTL", () => {
    expect(shouldReusePendingCreate(pending(), FP, NOW + 5_000)).toBe(true);
  });

  it("never reuses the key when ANY create-affecting value changed", () => {
    // Cancel → change grill → Start again must be a NEW cook, not a silent
    // dedup to the original one (which would discard the revised intent).
    const changed = createIntentFingerprint({ ...INTENT, grillId: 2 });
    expect(shouldReusePendingCreate(pending(), changed, NOW + 5_000)).toBe(false);
    const differentCut = createIntentFingerprint({ ...INTENT, foodType: "Chicken Thighs" });
    expect(shouldReusePendingCreate(pending(), differentCut, NOW + 5_000)).toBe(false);
  });

  it("reuses the key after a cancel/blur mid-attempt so a manual re-tap never duplicates", () => {
    // cancelSubmitWait (Cancel button or tab-blur cleanup) aborts the fetch
    // but deliberately KEEPS the pending record. A re-tap with the unchanged
    // intent must reuse the same idempotency key so the server dedup guard
    // returns the original cook if the aborted request actually landed.
    expect(shouldReusePendingCreate(pending(), FP, NOW + 30_000)).toBe(true);
  });

  it("never reuses a stale key", () => {
    expect(shouldReusePendingCreate(pending(), FP, NOW + PENDING_CREATE_TTL_MS + 1)).toBe(false);
  });
});

describe("findPendingCook", () => {
  const cooks = [
    { id: 1, sessionId: null },
    { id: 2, sessionId: "other" },
    { id: 3, sessionId: "abc-123" },
  ];

  it("finds the cook created by the pending request", () => {
    expect(findPendingCook(cooks, pending())?.id).toBe(3);
  });

  it("returns null when absent or when there is no pending record", () => {
    expect(findPendingCook(cooks.slice(0, 2), pending())).toBeNull();
    expect(findPendingCook(cooks, null)).toBeNull();
    expect(findPendingCook(null, pending())).toBeNull();
  });
});
