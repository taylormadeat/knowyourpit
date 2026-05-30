/**
 * Inkbird IBT-series BLE adapter (advertisement-based).
 *
 * Inkbird IBT-2X / IBT-4XS / IBT-6XS / IBS-TH broadcast manufacturer data
 * in every BLE advertisement packet — no GATT connection is required.
 *
 * Byte format (after base64 decode):
 *   [0:1] = manufacturer ID (skipped)
 *   [2:3] = probe channel 0 temp (little-endian uint16)
 *   [4:5] = probe channel 1 temp
 *   … up to 6 channels (IBT-6XS)
 *   0xFFFF / 0xFFFE = probe not inserted
 *
 * Temperature unit: firmware sends values in 1/10 °C by default.
 * Some older firmware revisions report 1/10 °F — detected via flag byte or
 * plausibility heuristic (see parseInkbirdTemps).
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
 *
 * Note: "tpms" was removed — TPMS (tyre pressure) sensors from many non-Inkbird
 * brands share this prefix and have a completely different data payload, causing
 * them to appear in the device list with invalid temperature readings.
 */
export const INKBIRD_NAME_PREFIXES = [
  "ibbq",
  "inkbird",
  "ibt-",
  "ibt_",
  "ibt-6",
  "ibs-th",
  "inkbird_ib",
];

/**
 * Service UUIDs advertised by Inkbird devices.
 *
 * 0xFFF0 — primary IBT-series service (all known BBQ probes)
 * 0xFFF5 — alternate seen on some IBS-TH2 humidity/temp sensors
 * 0xFFE0 — seen on some TPMS and generic Inkbird-OEM units
 *
 * Both full 128-bit and short 16-bit forms are included because iOS
 * (react-native-ble-plx on CoreBluetooth) returns short UUIDs in their
 * collapsed form ("fff0") for some device firmware versions rather than
 * expanding them to the full Bluetooth base UUID form.
 */
export const INKBIRD_SERVICE_UUIDS = [
  "0000fff0-0000-1000-8000-00805f9b34fb",
  "0000fff5-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "fff0",
  "fff5",
  "ffe0",
];

// Plausible BBQ temperature bounds in Celsius.
const MAX_PLAUSIBLE_CELSIUS = 650;
const MIN_PLAUSIBLE_CELSIUS = -50;

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

/**
 * Parse probe temperatures from an Inkbird IBT-series BLE advertisement.
 *
 * Handles both 2/4-channel (IBT-2X, IBT-4XS) and 6-channel (IBT-6XS) formats.
 * The wire format is identical — the 6-channel devices simply carry more pairs.
 *
 * Unit detection (in priority order):
 *  1. Unit flag byte — the byte immediately after all channel pairs, when present:
 *       0x00       → source is °C (most firmware versions)
 *       0xFF/0x01  → source is °F (some regional/older firmware)
 *  2. Plausibility heuristic — if a raw÷10 value would be unreasonably high or
 *     low for Celsius (outside -50 … 650 °C) but plausible as °F, treat as °F.
 *  3. Default → assume °C.
 *
 * Returns an array of tempF values, one per inserted probe channel.
 * Channels with no probe inserted (raw value ≥ 0xFFFE) are omitted.
 */
export function parseInkbirdTemps(manufacturerData: string | null): number[] {
  if (!manufacturerData) return [];
  const bytes = base64ToBytes(manufacturerData);
  if (bytes.length < 4) return [];

  const maxChannels = 6;
  const rawValues: number[] = [];
  for (
    let i = 2, ch = 0;
    i + 1 < bytes.length && ch < maxChannels;
    i += 2, ch++
  ) {
    const raw = (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8);
    rawValues.push(raw);
  }

  const unitFlagIdx = 2 + rawValues.length * 2;
  let sourceIsCelsius = true;
  if (unitFlagIdx < bytes.length) {
    const flag = bytes[unitFlagIdx];
    if (flag === 0xff || flag === 0x01) {
      sourceIsCelsius = false;
    } else if (flag === 0x00) {
      sourceIsCelsius = true;
    }
  }

  const temps: number[] = [];
  for (const raw of rawValues) {
    if (raw >= 0xfffe) continue;

    const value = raw / 10;

    let tempF: number;
    if (sourceIsCelsius) {
      if (value > MAX_PLAUSIBLE_CELSIUS || value < MIN_PLAUSIBLE_CELSIUS) {
        tempF = value;
      } else {
        tempF = (value * 9) / 5 + 32;
      }
    } else {
      tempF = value;
    }

    temps.push(Math.round(tempF * 10) / 10);
  }
  return temps;
}

/**
 * Returns true if the scanned BLE device is an Inkbird thermometer.
 *
 * Detection is name-only. Service UUID fallback was intentionally removed:
 * 0xFFF0 and 0xFFE0 are generic UUIDs shared by hundreds of unrelated device
 * categories (fitness bands, smart plugs, generic sensors). Using them as a
 * detection signal caused every nearby device advertising those UUIDs to appear
 * as an Inkbird thermometer in the Connected Devices list.
 *
 * In practice all Inkbird BBQ probes broadcast a recognisable name
 * (iBBQ, IBT-4XS, Inkbird …) so name-only matching is sufficient.
 */
export function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  return INKBIRD_NAME_PREFIXES.some((p) => name.startsWith(p));
}
