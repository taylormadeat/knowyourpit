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
 *   - Weber iGrill 2/3/Mini → weberIGrill.ts
 *
 * Setup-only adapters:
 *   - ThermoWorks RFX Gateway → rfxGateway.ts
 */

export * from "./govee";
export * from "./weberIGrill";
export * from "./rfxGateway";

import { isGoveeDevice, GOVEE_ADAPTER } from "./govee";
import { isIGrillDevice, IGRILL_ADAPTER } from "./weberIGrill";
import { isInkbirdDevice } from "./inkbird";
import { isRfxGatewayDevice, RFX_GATEWAY_ADAPTER } from "./rfxGateway";
export { isInkbirdDevice };

export type BleAdapterKey = "inkbird" | "govee" | "weber_igrill" | "thermoworks_rfx";

/**
 * Returns the adapter key for a scanned BLE device, or null if unrecognised.
 */
export function detectAdapter(device: any): BleAdapterKey | null {
  if (isGoveeDevice(device)) return GOVEE_ADAPTER as BleAdapterKey;
  if (isIGrillDevice(device)) return IGRILL_ADAPTER as BleAdapterKey;
  if (isInkbirdDevice(device)) return "inkbird";
  if (isRfxGatewayDevice(device)) return RFX_GATEWAY_ADAPTER as BleAdapterKey;
  return null;
}

export const ADAPTER_LABELS: Record<BleAdapterKey, string> = {
  inkbird: "Inkbird",
  govee: "Govee",
  weber_igrill: "Weber iGrill",
  thermoworks_rfx: "ThermoWorks RFX Gateway",
};

/**
 * Adapter keys that require a GATT connection (vs. passive advertisement reads).
 */
export const GATT_ADAPTERS: BleAdapterKey[] = ["weber_igrill"];
