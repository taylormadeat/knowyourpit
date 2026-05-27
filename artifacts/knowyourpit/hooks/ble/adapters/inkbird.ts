/**
 * Inkbird IBT-series BLE adapter (advertisement-based).
 *
 * Inkbird IBT-2X / IBT-4XS / IBT-6XS / IBS-TH broadcast manufacturer data
 * in every BLE advertisement packet — no GATT connection is required.
 *
 * This file re-exports the detection guard used by the adapter registry.
 * The actual parsing lives in hooks/useInkbirdBLE.ts (legacy hook kept intact).
 */

/**
 * Known name prefixes (case-insensitive) used by Inkbird devices.
 *
 * Covered models:
 *   - ibbq          → iBBQ / generic ibbq series
 *   - inkbird       → generic Inkbird branding
 *   - ibt-          → IBT-2X, IBT-4XS, IBT-4X, IBT-4XP, IBT-6XS, IBT-6XP
 *   - ibt_          → firmware variants that use underscore separator
 *   - ibt-6         → IBT-6XS / IBT-6XP (6-channel, distinct prefix in some FW)
 *   - ibs-th        → IBS-TH1 / IBS-TH2 temperature & humidity sensors
 *   - inkbird_ib    → older batch-branded units
 *   - tpms          → Inkbird TPMS (tyre pressure) sensors that share the same
 *                     BLE stack (some pitmasters use them for grill-lid temps)
 */
export const INKBIRD_NAME_PREFIXES = [
  "ibbq",
  "inkbird",
  "ibt-",
  "ibt_",
  "ibt-6",
  "ibs-th",
  "inkbird_ib",
  "tpms",
];

/**
 * Service UUIDs advertised by Inkbird devices.
 *
 * 0xFFF0 — primary IBT-series service (all known BBQ probes)
 * 0xFFF5 — alternate seen on some IBS-TH2 humidity/temp sensors
 * 0xFFE0 — seen on some TPMS and generic Inkbird-OEM units
 */
export const INKBIRD_SERVICE_UUIDS = [
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000fff5-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
];

export function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (INKBIRD_NAME_PREFIXES.some((p) => name.startsWith(p))) return true;

  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  const lowerUUIDs = serviceUUIDs.map((u: string) => u.toLowerCase());
  if (INKBIRD_SERVICE_UUIDS.some((uuid) => lowerUUIDs.includes(uuid))) return true;

  const serviceData: Record<string, string> = device?.serviceData ?? {};
  const lowerKeys = Object.keys(serviceData).map((k) => k.toLowerCase());
  return INKBIRD_SERVICE_UUIDS.some((uuid) => lowerKeys.includes(uuid));
}
