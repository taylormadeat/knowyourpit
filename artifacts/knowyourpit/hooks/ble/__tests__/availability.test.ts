import {
  bleAvailabilityLabel,
  bleAvailabilityMessage,
  getBleAvailability,
  shouldClearSavedPermissionWarning,
  shouldKeepScanButtonBusy,
} from "../availability";

describe("BLE availability", () => {
  it.each([
    ["PoweredOn", "ready"],
    ["Unauthorized", "permissionDenied"],
    ["PoweredOff", "poweredOff"],
    ["Unsupported", "unsupported"],
    ["Unknown", "initializing"],
    ["Resetting", "initializing"],
  ] as const)("classifies %s as %s", (state, expected) => {
    expect(getBleAvailability(state)).toBe(expected);
  });

  it("clears an old saved permission warning unless iOS still reports a real denial", () => {
    expect(shouldClearSavedPermissionWarning("PoweredOn")).toBe(true);
    expect(shouldClearSavedPermissionWarning("PoweredOff")).toBe(true);
    expect(shouldClearSavedPermissionWarning("Unknown")).toBe(true);
    expect(shouldClearSavedPermissionWarning("Unauthorized")).toBe(false);
  });

  it("keeps the user-facing recovery guidance specific to the problem", () => {
    expect(bleAvailabilityLabel("permissionDenied")).toBe("Bluetooth permission denied");
    expect(bleAvailabilityMessage("permissionDenied")).toContain("Settings");
    expect(bleAvailabilityLabel("poweredOff")).toBe("Bluetooth is turned off");
    expect(bleAvailabilityMessage("poweredOff")).toContain("Turn on Bluetooth");
    expect(bleAvailabilityLabel("unsupported")).toBe("Bluetooth is not available on this device");
  });

  it("keeps the scan button retryable when BLE is blocked and Wi-Fi is not scanning", () => {
    expect(shouldKeepScanButtonBusy("blocked", false)).toBe(false);
    expect(shouldKeepScanButtonBusy("blocked", true)).toBe(true);
    expect(shouldKeepScanButtonBusy("started", false)).toBe(true);
  });
});