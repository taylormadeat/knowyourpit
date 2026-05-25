/**
 * Weber iGrill 2 / iGrill 3 / iGrill Mini BLE adapter.
 *
 * Weber iGrill devices use a proprietary GATT service for temperature channels.
 * The device name begins with "iGrill" or "Weber_iGrill".
 *
 * GATT Service: 64ac0001-4a4b-5948-2d4b-57544c4c4243
 * Battery char: 00002a19-0000-1000-8000-00805f9b34fb (standard)
 *
 * Probe temp characteristics (one per channel, 1-indexed):
 *   Ch1: 64ac0002-4a4b-5948-2d4b-57544c4c4243
 *   Ch2: 64ac0003-4a4b-5948-2d4b-57544c4c4243
 *   Ch3: 64ac0004-4a4b-5948-2d4b-57544c4c4243
 *   Ch4: 64ac0005-4a4b-5948-2d4b-57544c4c4243
 *
 * Characteristic format: 2 bytes little-endian int16.
 *   Value = -32768 → probe not inserted
 *   Otherwise value / 10 = °C
 *
 * Reference: https://github.com/mikeheijmans/igrill-py (community reverse engineering)
 */

export const IGRILL_ADAPTER = "weber_igrill";

export const IGRILL_SERVICE_UUID = "64ac0001-4a4b-5948-2d4b-57544c4c4243";
export const IGRILL_BATTERY_CHAR_UUID = "00002a19-0000-1000-8000-00805f9b34fb";

export const IGRILL_PROBE_CHAR_UUIDS = [
  "64ac0002-4a4b-5948-2d4b-57544c4c4243",
  "64ac0003-4a4b-5948-2d4b-57544c4c4243",
  "64ac0004-4a4b-5948-2d4b-57544c4c4243",
  "64ac0005-4a4b-5948-2d4b-57544c4c4243",
];

const IGRILL_NAME_PREFIXES = ["igrill", "weber_igrill", "weber igrill"];

export function isIGrillDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (IGRILL_NAME_PREFIXES.some((p) => name.startsWith(p))) return true;
  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  return serviceUUIDs.some(
    (u) => u.toLowerCase() === IGRILL_SERVICE_UUID.toLowerCase(),
  );
}

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

export function decodeIGrillProbeChar(base64Value: string): number | null {
  const bytes = base64ToBytes(base64Value);
  if (bytes.length < 2) return null;

  const raw = (bytes[1]! << 8) | bytes[0]!;
  const signed = raw > 0x7fff ? raw - 0x10000 : raw;

  if (signed === -32768) return null;

  const tempC = signed / 10;
  return Math.round((tempC * 9) / 5 + 32);
}

export function decodeIGrillBatteryChar(base64Value: string): number | null {
  const bytes = base64ToBytes(base64Value);
  if (bytes.length < 1) return null;
  const pct = bytes[0] ?? 0;
  return pct >= 0 && pct <= 100 ? pct : null;
}
