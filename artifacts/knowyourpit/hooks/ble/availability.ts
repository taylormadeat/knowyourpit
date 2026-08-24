/**
 * BLE availability is separate from a user's app-level authorization. iOS
 * reports both through the same manager state API, so keep the interpretation
 * in one place for device discovery and diagnostics.
 */
export type BleAvailability =
  | "ready"
  | "permissionDenied"
  | "poweredOff"
  | "unsupported"
  | "initializing";

export type BleScanStartResult = "started" | "blocked";

export function getBleAvailability(state: string | null | undefined): BleAvailability {
  switch (state) {
    case "PoweredOn":
      return "ready";
    case "Unauthorized":
      return "permissionDenied";
    case "PoweredOff":
      return "poweredOff";
    case "Unsupported":
      return "unsupported";
    default:
      return "initializing";
  }
}

/**
 * A saved app warning is only a hint. It must not keep blocking a scan when
 * iOS now reports any state other than an actual authorization denial.
 */
export function shouldClearSavedPermissionWarning(
  state: string | null | undefined,
): boolean {
  return getBleAvailability(state) !== "permissionDenied";
}

export function bleAvailabilityLabel(availability: BleAvailability): string {
  switch (availability) {
    case "ready":
      return "Bluetooth ready";
    case "permissionDenied":
      return "Bluetooth permission denied";
    case "poweredOff":
      return "Bluetooth is turned off";
    case "unsupported":
      return "Bluetooth is not available on this device";
    default:
      return "Checking Bluetooth status";
  }
}

export function bleAvailabilityMessage(availability: BleAvailability): string {
  switch (availability) {
    case "permissionDenied":
      return "Allow Bluetooth for knowyourpit in Settings, then return here and scan again.";
    case "poweredOff":
      return "Turn on Bluetooth in Control Center or Settings, then scan again.";
    case "unsupported":
      return "This device does not support Bluetooth Low Energy scanning.";
    default:
      return "";
  }
}

/**
 * The screen-owned scan affordance must remain retryable when BLE was blocked
 * and there is no concurrent LAN scan to drive its loading state back down.
 */
export function shouldKeepScanButtonBusy(
  bleResult: BleScanStartResult,
  lanScanRequested: boolean,
): boolean {
  return bleResult === "started" || lanScanRequested;
}