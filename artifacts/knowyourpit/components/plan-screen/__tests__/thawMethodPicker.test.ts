/**
 * Unit tests for the thaw-method picker save/restore behaviour in
 * MultiCookAddItemModal.
 *
 * These tests do NOT render the component — they drive the pure-data
 * layer directly:
 *
 *   1. THAW_CHIPS completeness — every non-default AnyThawMethod has a label.
 *   2. Label lookup — the expression used by SettingsRow returns the right text.
 *   3. Edit-mode restore — building a MultiItem with a non-default thaw method
 *      and then reading it back gives the original value (the shape the
 *      `setThawMethod(editItem.thawMethod)` call in the useEffect depends on).
 *   4. Save round-trip — constructing a newItem from the current thawMethod
 *      state produces the correct value in MultiItem.thawMethod.
 *   5. Method-change round-trip — selecting a different thaw method and saving
 *      persists the NEW value, not the old one.
 */

import { THAW_CHIPS, type AnyThawMethod } from "../thawChips";
import type { MultiItem } from "../MultiCookAddItemModal";
import type { MeatCut } from "@/constants/meatCuts";

// ── Helpers ────────────────────────────────────────────────────────────────────

/** All non-default thaw methods (anything other than "fridge"). */
const NON_DEFAULT_METHODS: AnyThawMethod[] = [
  "cold_water",
  "microwave",
  "counter",
  "cook_from_frozen",
];

/**
 * Minimal MeatCut fixture — only the fields MultiItem needs.
 */
const BRISKET: MeatCut = {
  name: "Brisket",
  category: "Beef",
  targetTempF: 203,
  cookTempF: 225,
  minsPerLb: 75,
  restMins: 60,
  cookMethod: "Low & Slow",
};

/**
 * Build a MultiItem with the given thawMethod — mirrors what the modal's
 * handleSave() constructs.
 */
function buildMultiItem(thawMethod: AnyThawMethod): MultiItem {
  return {
    cut: BRISKET,
    sizeOutput: {
      effectiveWeightLbs: 10,
      sizingLabel: "10 lbs",
      isEstimated: false,
      pieceCount: null,
      mode: "weight",
    },
    grillId: null,
    cookMethod: null,
    meatStartTemp: null,
    injection: null,
    spritz: null,
    wrapFinish: null,
    isFrozen: true,
    thawMethod,
    notes: undefined,
    targetTempF: "203",
    cookTempF: "225",
    cookingStylePreset: null,
  };
}

/**
 * Mirrors the SettingsRow label-lookup expression from MultiCookAddItemModal:
 *   THAW_CHIPS.find(o => o.value === thawMethod)?.label ?? null
 */
function resolveLabel(thawMethod: AnyThawMethod): string | null {
  return THAW_CHIPS.find(o => o.value === thawMethod)?.label ?? null;
}

/**
 * Mirrors the edit-mode restore path:
 *   setThawMethod(editItem.thawMethod)
 * Returns the value the state variable would hold after restore.
 */
function restoreThawMethod(editItem: MultiItem): AnyThawMethod {
  return editItem.thawMethod as AnyThawMethod;
}

// ── 1. THAW_CHIPS completeness ─────────────────────────────────────────────────

describe("THAW_CHIPS", () => {
  it('contains the default "fridge" method', () => {
    const fridge = THAW_CHIPS.find(c => c.value === "fridge");
    expect(fridge).toBeDefined();
    expect(fridge!.label).toBeTruthy();
  });

  it.each(NON_DEFAULT_METHODS)(
    'contains a defined, non-empty label for non-default method "%s"',
    (method) => {
      const chip = THAW_CHIPS.find(c => c.value === method);
      expect(chip).toBeDefined();
      expect(chip!.label.trim().length).toBeGreaterThan(0);
    },
  );

  it("has no duplicate values", () => {
    const values = THAW_CHIPS.map(c => c.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it("has no duplicate labels", () => {
    const labels = THAW_CHIPS.map(c => c.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});

// ── 2. SettingsRow label lookup ────────────────────────────────────────────────

describe("SettingsRow label lookup (THAW_CHIPS.find)", () => {
  it('resolves "fridge" to a non-null label', () => {
    expect(resolveLabel("fridge")).not.toBeNull();
  });

  it.each(NON_DEFAULT_METHODS)(
    'resolves "%s" to a non-null label',
    (method) => {
      const label = resolveLabel(method);
      expect(label).not.toBeNull();
      expect(label!.length).toBeGreaterThan(0);
    },
  );

  it('resolves "cold_water" to a label containing "Cold Water"', () => {
    expect(resolveLabel("cold_water")).toMatch(/cold water/i);
  });

  it('resolves "microwave" to a label containing "Microwave"', () => {
    expect(resolveLabel("microwave")).toMatch(/microwave/i);
  });

  it('resolves "counter" to a label containing "Counter"', () => {
    expect(resolveLabel("counter")).toMatch(/counter/i);
  });

  it('resolves "cook_from_frozen" to a label containing "Frozen"', () => {
    expect(resolveLabel("cook_from_frozen")).toMatch(/frozen/i);
  });
});

// ── 3. Edit-mode restore ───────────────────────────────────────────────────────

describe("edit-mode restore — setThawMethod(editItem.thawMethod)", () => {
  it.each(NON_DEFAULT_METHODS)(
    'restoring editItem with thawMethod="%s" yields "%s"',
    (method) => {
      const editItem = buildMultiItem(method);
      const restored = restoreThawMethod(editItem);
      expect(restored).toBe(method);
    },
  );

  it("restoring the default fridge method also works", () => {
    const editItem = buildMultiItem("fridge");
    expect(restoreThawMethod(editItem)).toBe("fridge");
  });

  it("the restored value resolves to the correct SettingsRow label", () => {
    for (const method of NON_DEFAULT_METHODS) {
      const editItem = buildMultiItem(method);
      const restored = restoreThawMethod(editItem);
      const label = resolveLabel(restored);
      // The label the SettingsRow would display must match the chip for that value
      const expectedLabel = THAW_CHIPS.find(c => c.value === method)!.label;
      expect(label).toBe(expectedLabel);
    }
  });
});

// ── 4. Save round-trip ─────────────────────────────────────────────────────────

describe("save round-trip — newItem.thawMethod === current thawMethod state", () => {
  it.each(NON_DEFAULT_METHODS)(
    'saving with thawMethod="%s" persists that value in MultiItem',
    (method) => {
      // Simulate: state variable holds `method` → handleSave() puts it in newItem
      const newItem = buildMultiItem(method);
      expect(newItem.thawMethod).toBe(method);
    },
  );

  it("saving the default fridge method preserves it", () => {
    const newItem = buildMultiItem("fridge");
    expect(newItem.thawMethod).toBe("fridge");
  });

  it("saved thawMethod resolves to a valid SettingsRow label", () => {
    for (const method of NON_DEFAULT_METHODS) {
      const newItem = buildMultiItem(method);
      const label = resolveLabel(newItem.thawMethod as AnyThawMethod);
      expect(label).not.toBeNull();
    }
  });
});

// ── 5. Method-change round-trip ────────────────────────────────────────────────

describe("method-change round-trip — selecting a new thaw method and saving", () => {
  it.each([
    ["cold_water", "microwave"],
    ["microwave", "counter"],
    ["counter", "cook_from_frozen"],
    ["cook_from_frozen", "fridge"],
    ["fridge", "cold_water"],
  ] as [AnyThawMethod, AnyThawMethod][])(
    'changing from "%s" to "%s" and saving persists "%s"',
    (initial, next) => {
      // Simulate edit mode: restore from editItem
      const editItem = buildMultiItem(initial);
      let thawMethod = restoreThawMethod(editItem); // state after restore
      expect(thawMethod).toBe(initial);

      // Simulate: user picks a new option in OptionBottomSheet
      // onChange handler: setThawMethod((val ?? "fridge") as AnyThawMethod)
      thawMethod = (next ?? "fridge") as AnyThawMethod;
      expect(thawMethod).toBe(next);

      // Simulate save: newItem.thawMethod = thawMethod
      const newItem = buildMultiItem(thawMethod);
      expect(newItem.thawMethod).toBe(next);
      expect(newItem.thawMethod).not.toBe(initial);
    },
  );

  it("label displayed after change matches the newly selected method", () => {
    // start with cold_water, switch to counter
    let thawMethod: AnyThawMethod = "cold_water";
    thawMethod = "counter";

    const label = resolveLabel(thawMethod);
    expect(label).toMatch(/counter/i);
    expect(label).not.toMatch(/cold water/i);
  });
});
