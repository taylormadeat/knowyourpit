/**
 * Unit tests for the technique quick-pick AsyncStorage helpers.
 *
 * Critical invariants under test:
 *   1. saveLastCookMethod (and siblings) write to AsyncStorage using the
 *      correct namespaced key so values survive across app restarts.
 *   2. loadLastCookMethod (and siblings) return null when the stored value is
 *      not a recognised member of the corresponding QP_* tuple — stale data
 *      from an older app version must not be surfaced.
 *   3. loadLastCookMethod (and siblings) return the stored value when it
 *      matches a known member of the QP_* tuple.
 *
 * No React or Expo APIs are exercised — the only I/O boundary is
 * AsyncStorage, which is mocked below so the tests are synchronous and
 * hermetic.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  COOK_METHOD_STORAGE_PREFIX,
  INJECTION_STORAGE_PREFIX,
  MEAT_START_TEMP_STORAGE_PREFIX,
  SPRITZ_STORAGE_PREFIX,
  WRAP_FINISH_STORAGE_PREFIX,
  loadLastCookMethod,
  loadLastInjection,
  loadLastMeatStartTemp,
  loadLastSpritz,
  loadLastWrapFinish,
  saveLastCookMethod,
  saveLastInjection,
  saveLastMeatStartTemp,
  saveLastSpritz,
  saveLastWrapFinish,
} from "../cookQuickPickStorage";

// ── AsyncStorage mock ──────────────────────────────────────────────────────────

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
  clear: jest.fn(() => {
    for (const k of Object.keys(storageData)) delete storageData[k];
    return Promise.resolve();
  }),
}));

beforeEach(() => {
  // Wipe in-memory store and clear call history between tests.
  for (const k of Object.keys(storageData)) delete storageData[k];
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

const CUT = "brisket (whole packer)";

// ── 1. save* writes with the correct key ──────────────────────────────────────

describe("save helpers write to the correct AsyncStorage key", () => {
  it("saveLastCookMethod writes to COOK_METHOD_STORAGE_PREFIX + cutName", async () => {
    await saveLastCookMethod(CUT, "Low & Slow");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      COOK_METHOD_STORAGE_PREFIX + CUT,
      "Low & Slow",
    );
  });

  it("saveLastInjection writes to INJECTION_STORAGE_PREFIX + cutName", async () => {
    await saveLastInjection(CUT, "Injected");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      INJECTION_STORAGE_PREFIX + CUT,
      "Injected",
    );
  });

  it("saveLastMeatStartTemp writes to MEAT_START_TEMP_STORAGE_PREFIX + cutName", async () => {
    await saveLastMeatStartTemp(CUT, "Cold from Fridge");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      MEAT_START_TEMP_STORAGE_PREFIX + CUT,
      "Cold from Fridge",
    );
  });

  it("saveLastSpritz writes to SPRITZ_STORAGE_PREFIX + cutName", async () => {
    await saveLastSpritz(CUT, "Every Hour");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      SPRITZ_STORAGE_PREFIX + CUT,
      "Every Hour",
    );
  });

  it("saveLastWrapFinish writes to WRAP_FINISH_STORAGE_PREFIX + cutName", async () => {
    await saveLastWrapFinish(CUT, "Butcher Paper at Stall");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      WRAP_FINISH_STORAGE_PREFIX + CUT,
      "Butcher Paper at Stall",
    );
  });

  it("keys are cut-name-scoped — different cuts use different keys", async () => {
    const otherCut = "pork shoulder (boston butt)";
    await saveLastCookMethod(CUT, "Low & Slow");
    await saveLastCookMethod(otherCut, "Hot & Fast");

    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      COOK_METHOD_STORAGE_PREFIX + CUT,
      "Low & Slow",
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      COOK_METHOD_STORAGE_PREFIX + otherCut,
      "Hot & Fast",
    );
  });
});

// ── 2. load* returns null for unrecognised / stale values ─────────────────────

describe("load helpers return null for unrecognised stored values", () => {
  it("loadLastCookMethod returns null when stored value is not a known QpCookMethod", async () => {
    storageData[COOK_METHOD_STORAGE_PREFIX + CUT] = "Old Method That No Longer Exists";

    const result = await loadLastCookMethod(CUT);

    expect(result).toBeNull();
  });

  it("loadLastCookMethod returns null when nothing is stored for that cut", async () => {
    const result = await loadLastCookMethod(CUT);
    expect(result).toBeNull();
  });

  it("loadLastInjection returns null for an unrecognised stored value", async () => {
    storageData[INJECTION_STORAGE_PREFIX + CUT] = "heavy brine";

    const result = await loadLastInjection(CUT);

    expect(result).toBeNull();
  });

  it("loadLastMeatStartTemp returns null for an unrecognised stored value", async () => {
    storageData[MEAT_START_TEMP_STORAGE_PREFIX + CUT] = "straight from the freezer";

    const result = await loadLastMeatStartTemp(CUT);

    expect(result).toBeNull();
  });

  it("loadLastSpritz returns null for an unrecognised stored value", async () => {
    storageData[SPRITZ_STORAGE_PREFIX + CUT] = "constantly";

    const result = await loadLastSpritz(CUT);

    expect(result).toBeNull();
  });

  it("loadLastWrapFinish returns null for an unrecognised stored value", async () => {
    storageData[WRAP_FINISH_STORAGE_PREFIX + CUT] = "old wrap option";

    const result = await loadLastWrapFinish(CUT);

    expect(result).toBeNull();
  });

  it("loadLastCookMethod returns null when stored value is an empty string", async () => {
    storageData[COOK_METHOD_STORAGE_PREFIX + CUT] = "";

    const result = await loadLastCookMethod(CUT);

    expect(result).toBeNull();
  });
});

// ── 3. load* returns the stored value for a known QP member ───────────────────

describe("load helpers return the stored value when it is a known QP option", () => {
  it("loadLastCookMethod returns a recognised QpCookMethod", async () => {
    await saveLastCookMethod(CUT, "Hot & Fast");

    const result = await loadLastCookMethod(CUT);

    expect(result).toBe("Hot & Fast");
  });

  it("loadLastCookMethod round-trips every recognised QpCookMethod value", async () => {
    const methods = [
      "Low & Slow",
      "Hot & Fast",
      "Rotisserie",
      "Reverse Sear",
      "Direct Heat",
      "Indirect Heat",
      "Braised",
      "Sous Vide + Smoke",
    ] as const;

    for (const method of methods) {
      storageData[COOK_METHOD_STORAGE_PREFIX + CUT] = method;
      const result = await loadLastCookMethod(CUT);
      expect(result).toBe(method);
    }
  });

  it("loadLastInjection returns a recognised QpInjectionOption", async () => {
    await saveLastInjection(CUT, "Not Injected");

    const result = await loadLastInjection(CUT);

    expect(result).toBe("Not Injected");
  });

  it("loadLastInjection returns 'Injected' when that is the stored value", async () => {
    await saveLastInjection(CUT, "Injected");

    const result = await loadLastInjection(CUT);

    expect(result).toBe("Injected");
  });

  it("loadLastMeatStartTemp returns a recognised QpMeatStartTemp", async () => {
    await saveLastMeatStartTemp(CUT, "Tempered to Room Temp");

    const result = await loadLastMeatStartTemp(CUT);

    expect(result).toBe("Tempered to Room Temp");
  });

  it("loadLastSpritz returns a recognised QpSpritzFrequency", async () => {
    await saveLastSpritz(CUT, "Every 2 Hours");

    const result = await loadLastSpritz(CUT);

    expect(result).toBe("Every 2 Hours");
  });

  it("loadLastWrapFinish returns a recognised QpWrapFinishOption", async () => {
    await saveLastWrapFinish(CUT, "Foil at Stall (Texas Crutch)");

    const result = await loadLastWrapFinish(CUT);

    expect(result).toBe("Foil at Stall (Texas Crutch)");
  });
});

// ── 4. Round-trip: save then load ─────────────────────────────────────────────

describe("save → load round-trips", () => {
  it("saveLastCookMethod then loadLastCookMethod returns the same value", async () => {
    await saveLastCookMethod(CUT, "Reverse Sear");
    expect(await loadLastCookMethod(CUT)).toBe("Reverse Sear");
  });

  it("saveLastInjection then loadLastInjection returns the same value", async () => {
    await saveLastInjection(CUT, "Injected");
    expect(await loadLastInjection(CUT)).toBe("Injected");
  });

  it("overwriting a stored value returns the latest value", async () => {
    await saveLastCookMethod(CUT, "Low & Slow");
    await saveLastCookMethod(CUT, "Hot & Fast");
    expect(await loadLastCookMethod(CUT)).toBe("Hot & Fast");
  });

  it("values are scoped per cut — loading a different cut returns null", async () => {
    await saveLastCookMethod(CUT, "Low & Slow");
    const result = await loadLastCookMethod("chicken wings");
    expect(result).toBeNull();
  });
});
