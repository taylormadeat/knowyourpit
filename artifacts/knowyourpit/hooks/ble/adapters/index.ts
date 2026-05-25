/**
 * BLE adapter registry.
 *
 * Each adapter exports:
 *   - An `isXxxDevice(device)` guard that returns true if a scanned BLE
 *     advertisement matches that adapter's device family.
 *   - An adapter key string constant (used to tag devices in the registry).
 *
 * Advertisement-based adapters (no GATT connection required):
 *   - Inkbird IBT-series  → see hooks/useInkbirdBLE.ts (legacy, still used)
 *   - Govee H5051/H5075   → govee.ts
 *
 * GATT-connection adapters (require an explicit connect() call):
 *   - MEATER single probe → meaterProbe.ts
 *   - Weber iGrill 2/3/Mini → weberIGrill.ts
 */

export * from "./govee";
export * from "./meaterProbe";
export * from "./weberIGrill";

import { isGoveeDevice, GOVEE_ADAPTER } from "./govee";
import { isMeaterProbeDevice, MEATER_PROBE_ADAPTER } from "./meaterProbe";
import { isIGrillDevice, IGRILL_ADAPTER } from "./weberIGrill";
import { isInkbirdDevice } from "./inkbird";
export { isInkbirdDevice };

export type BleAdapterKey = "inkbird" | "govee" | "meater_probe" | "weber_igrill";

/**
 * Returns the adapter key for a scanned BLE device, or null if unrecognised.
 */
export function detectAdapter(device: any): BleAdapterKey | null {
  if (isGoveeDevice(device)) return GOVEE_ADAPTER as BleAdapterKey;
  if (isMeaterProbeDevice(device)) return MEATER_PROBE_ADAPTER as BleAdapterKey;
  if (isIGrillDevice(device)) return IGRILL_ADAPTER as BleAdapterKey;
  if (isInkbirdDevice(device)) return "inkbird";
  return null;
}

export const ADAPTER_LABELS: Record<BleAdapterKey, string> = {
  inkbird: "Inkbird",
  govee: "Govee",
  meater_probe: "MEATER",
  weber_igrill: "Weber iGrill",
};

/**
 * Adapter keys that require a GATT connection (vs. passive advertisement reads).
 */
export const GATT_ADAPTERS: BleAdapterKey[] = ["meater_probe", "weber_igrill"];
