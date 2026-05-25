/**
 * Govee H5051 / H5074 / H5075 BLE adapter.
 *
 * Govee thermometers broadcast temperature data in BLE advertisement packets.
 * No GATT connection is required — readings arrive passively from scan events.
 *
 * Advertisement format (manufacturer data, after stripping 2-byte company ID):
 *   Bytes 0-1: temperature * 10 in units (°C if positive, absolute °C if >0x8000 means negative)
 *   Byte  2:   humidity %
 *   Byte  3:   battery %
 *
 * Reference: https://github.com/Thrilleratplay/GoveeWatcher (community decode)
 */

export const GOVEE_ADAPTER = "govee";

const GOVEE_NAME_PREFIXES = ["gvh5051", "gvh5074", "gvh5075", "govee"];
const GOVEE_COMPANY_IDS = [0xec88, 0x0001];

export function isGoveeDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  return GOVEE_NAME_PREFIXES.some((p) => name.startsWith(p));
}

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

export interface GoveeReading {
  probeTempF: number | null;
  ambientTempF: null;
  batteryPct: number | null;
  humidity: number | null;
}

export function decodeGoveeAdvertisement(manufacturerData: string | null): GoveeReading {
  const empty: GoveeReading = { probeTempF: null, ambientTempF: null, batteryPct: null, humidity: null };
  if (!manufacturerData) return empty;

  const bytes = base64ToBytes(manufacturerData);

  // Format: [companyId_lo, companyId_hi, temp_hi, temp_lo, humidity, battery, ...]
  // Some models prepend 2-byte company ID, others start with data directly.
  // Try with and without the 2-byte company ID prefix.
  for (const offset of [2, 0]) {
    if (bytes.length < offset + 4) continue;

    const tempHi = bytes[offset] ?? 0;
    const tempLo = bytes[offset + 1] ?? 0;
    const humidity = bytes[offset + 2] ?? null;
    const battery = bytes[offset + 3] ?? null;

    const rawTemp = (tempHi << 8) | tempLo;

    // Handle negative temperatures: if bit 15 set → negative
    let tempC: number;
    if (rawTemp > 0x8000) {
      tempC = -(rawTemp & 0x7fff) / 10;
    } else {
      tempC = rawTemp / 10;
    }

    // Sanity check: Govee thermometers measure -30°C to +70°C
    if (tempC < -40 || tempC > 100) continue;

    const tempF = Math.round((tempC * 9) / 5 + 32);

    return {
      probeTempF: tempF,
      ambientTempF: null,
      batteryPct: battery != null && battery >= 0 && battery <= 100 ? battery : null,
      humidity: humidity != null && humidity >= 0 && humidity <= 100 ? humidity : null,
    };
  }

  return empty;
}
