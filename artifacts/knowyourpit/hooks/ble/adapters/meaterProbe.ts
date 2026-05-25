/**
 * MEATER single probe BLE adapter.
 *
 * The MEATER probe communicates over GATT. The probe's tip temperature and
 * handle (ambient) temperature are read from a proprietary characteristic.
 *
 * Service UUID  : a75cc7fc-c956-488f-ac2a-2dbc08b63a04
 * Temp char     : 7edda774-045e-4bbf-909b-45d1991a2876
 *   → 4 bytes big-endian: [tip_hi, tip_lo, ambient_hi, ambient_lo]
 *   → raw / 10 = °C
 * Battery char  : 0x2a19 (standard battery service 0x180f)
 *   → 1 byte, 0–100
 *
 * Reference: https://github.com/nathanfain/meater-ble (community reverse engineering)
 */

export const MEATER_PROBE_ADAPTER = "meater_probe";

export const MEATER_PROBE_SERVICE_UUID = "a75cc7fc-c956-488f-ac2a-2dbc08b63a04";
export const MEATER_PROBE_TEMP_CHAR_UUID = "7edda774-045e-4bbf-909b-45d1991a2876";
export const MEATER_BATTERY_SERVICE_UUID = "0000180f-0000-1000-8000-00805f9b34fb";
export const MEATER_BATTERY_CHAR_UUID = "00002a19-0000-1000-8000-00805f9b34fb";

const MEATER_NAME_PREFIXES = ["meater"];

export function isMeaterProbeDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (MEATER_NAME_PREFIXES.some((p) => name.includes(p))) return true;
  const serviceUUIDs: string[] = device?.serviceUUIDs ?? [];
  return serviceUUIDs.some(
    (u) => u.toLowerCase() === MEATER_PROBE_SERVICE_UUID.toLowerCase(),
  );
}

export interface MeaterProbeReading {
  probeTempF: number | null;
  ambientTempF: number | null;
  batteryPct: number | null;
}

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

export function decodeMeaterTempChar(base64Value: string): Pick<MeaterProbeReading, "probeTempF" | "ambientTempF"> {
  const bytes = base64ToBytes(base64Value);
  if (bytes.length < 4) return { probeTempF: null, ambientTempF: null };

  const tipRaw = ((bytes[0] ?? 0) << 8) | (bytes[1] ?? 0);
  const ambientRaw = ((bytes[2] ?? 0) << 8) | (bytes[3] ?? 0);

  if (tipRaw === 0xffff || ambientRaw === 0xffff) {
    return { probeTempF: null, ambientTempF: null };
  }

  const tipC = tipRaw / 10;
  const ambientC = ambientRaw / 10;

  return {
    probeTempF: Math.round((tipC * 9) / 5 + 32),
    ambientTempF: Math.round((ambientC * 9) / 5 + 32),
  };
}

export function decodeBatteryChar(base64Value: string): number | null {
  const bytes = base64ToBytes(base64Value);
  if (bytes.length < 1) return null;
  const pct = bytes[0] ?? 0;
  if (pct < 0 || pct > 100) return null;
  return pct;
}
