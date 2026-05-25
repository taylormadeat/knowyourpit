/**
 * Inkbird IBT-series BLE adapter (advertisement-based).
 *
 * Inkbird IBT-2X / IBT-4XS / IBT-6XS broadcast manufacturer data in every
 * BLE advertisement packet — no GATT connection is required.
 *
 * This file re-exports the detection guard used by the adapter registry.
 * The actual parsing lives in hooks/useInkbirdBLE.ts (legacy hook kept intact).
 */

const INKBIRD_PREFIXES = ["ibbq", "inkbird", "ibt-", "ibt_"];
const INKBIRD_SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";

export function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (INKBIRD_PREFIXES.some((p) => name.toLowerCase().startsWith(p))) return true;
  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  if (serviceUUIDs.some((u: string) => u.toLowerCase() === INKBIRD_SERVICE_UUID)) return true;
  const serviceData: Record<string, string> = device?.serviceData ?? {};
  return Object.keys(serviceData).some((k) => k.toLowerCase() === INKBIRD_SERVICE_UUID);
}
