/**
 * Inkbird IBT-series BLE adapter (advertisement-based).
 *
 * Inkbird IBT-2X / IBT-4XS / IBT-6XS / IBS-TH broadcast manufacturer data
 * in every BLE advertisement packet — no GATT connection is required.
 *
 * Byte format (after base64 decode):
 *   [0:1]  = manufacturer ID (skipped)
 *   [2:3]  = probe channel 0 temp (little-endian uint16, 1/10 °C or 1/10 °F)
 *   [4:5]  = probe channel 1 temp
 *   …      up to N channels (2 for IBT-2X, 4 for IBT-4XS/IBT-4XP, 6 for IBT-6XS/IBT-6XP)
 *   [2+N*2]   = unit flag: 0x00 → °C (default), 0xFF/0x01 → °F
 *   [2+N*2+1] = battery percentage (0–100, may be absent on older firmware)
 *   0xFFFF / 0xFFFE = probe not inserted
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
// Tightened to 0°C–600°C (32°F–1112°F) to match realistic BBQ ranges.
// Most low-and-slow cooks run 107–135°C (225–275°F); high-heat searing up to
// ~315°C (600°F); anything above 600°C (1112°F) or below 0°C (32°F) is
// certainly garbage data from an unplugged/faulty channel.
// NOTE: 0°C (32°F) is treated as a disconnected-probe sentinel for iBBQ
// devices — unplugged channels report exactly 0°C rather than the 0xFFFF
// sentinel used by IBT-series firmware. The lower bound is therefore exclusive
// (values must be strictly greater than 0°C to be considered valid).
const MAX_PLAUSIBLE_CELSIUS = 600;
const MIN_PLAUSIBLE_CELSIUS = 0;

function base64ToBytes(b64: string): number[] {
  try {
    const str = atob(b64);
    return Array.from(str, (c) => c.charCodeAt(0));
  } catch {
    return [];
  }
}

// Plausible BBQ temperature bounds in Fahrenheit (derived from Celsius bounds).
// Any computed tempF at or below MIN_PLAUSIBLE_F (32°F / 0°C) is treated as a
// no-probe / disconnected-channel reading and filtered out, regardless of the
// declared unit. Exactly 32°F is the open-circuit sentinel on iBBQ devices.
const MIN_PLAUSIBLE_F = MIN_PLAUSIBLE_CELSIUS * 9 / 5 + 32; // 32 °F (exclusive lower bound)
const MAX_PLAUSIBLE_F = MAX_PLAUSIBLE_CELSIUS * 9 / 5 + 32; // 1112 °F

/**
 * Returns the maximum number of probe channels for the given device model.
 *
 * IBT-2X    → 2 channels
 * IBT-4XS / IBT-4XP / IBT-4X → 4 channels
 * IBT-6XS / IBT-6XP           → 6 channels
 * Unknown / IBS-TH             → 6 (safe upper bound; empty channels are filtered)
 *
 * Exported so the UI can display the model-cap label (e.g. "IBT-4XS · 4 probes")
 * alongside each device group header, confirming the correct device was detected.
 */
export function getChannelCap(deviceName: string): number {
  const lower = deviceName.toLowerCase();
  // Match 2-channel variants: ibt-2, ibt_2, ibt2
  if (/ibt[-_]?2/.test(lower)) return 2;
  // Match 4-channel variants: ibt-4, ibt_4, ibt4, ibt-4xs, ibt-4xp
  if (/ibt[-_]?4/.test(lower)) return 4;
  // Match 6-channel variants: ibt-6, ibt_6, ibt6, ibt-6xs, ibt-6xp
  if (/ibt[-_]?6/.test(lower)) return 6;
  return 6; // Safe default — sentinel + range checks filter empty slots anyway
}

export interface InkbirdParseResult {
  /** Temperatures in °F for channels with a physical probe inserted. */
  temps: number[];
  /**
   * Battery percentage (0–100) parsed from the byte immediately after the unit
   * flag in the manufacturer data payload:
   *   byte 2+N*2   = unit flag (N = channel count cap)
   *   byte 2+N*2+1 = battery %
   * Null when the byte is absent (short payload) or out of the 0–100 range.
   */
  batteryPct: number | null;
}

/**
 * Parse probe temperatures and battery level from an Inkbird IBT-series BLE
 * advertisement.
 *
 * Handles 2/4/6-channel devices. The channel count is capped per deviceName
 * to prevent phantom channels: IBT-4XS/IBT-4XP → 4, IBT-6XS/IBT-6XP → 6,
 * IBT-2X → 2. When deviceName is omitted the cap defaults to 6.
 *
 * Unit detection (in priority order):
 *  1. Unit flag byte — the byte immediately after all channel pairs, when present:
 *       0x00       → source is °C (most firmware versions)
 *       0xFF/0x01  → source is °F (some regional/older firmware)
 *  2. Default → assume °C.
 *
 * Returns an object with:
 *  - `temps`: array of tempF values, one per channel with a valid probe reading.
 *    Channels are omitted when:
 *      - raw value ≥ 0xFFFE   (device sentinel for "no probe inserted")
 *      - computed tempF is outside 32°F–1112°F (garbage / no-probe data
 *        that did not use the sentinel, common on some IBT-4XS firmware)
 *  - `batteryPct`: 0–100 or null if absent / invalid.
 */
export function parseInkbirdTemps(
  manufacturerData: string | null,
  deviceName?: string,
): InkbirdParseResult {
  if (!manufacturerData) return { temps: [], batteryPct: null };
  const bytes = base64ToBytes(manufacturerData);
  if (bytes.length < 4) return { temps: [], batteryPct: null };

  const channelCap = deviceName ? getChannelCap(deviceName) : 6;

  const rawValues: number[] = [];
  for (
    let i = 2, ch = 0;
    i + 1 < bytes.length && ch < channelCap;
    i += 2, ch++
  ) {
    const raw = (bytes[i] ?? 0) | ((bytes[i + 1] ?? 0) << 8);
    rawValues.push(raw);
  }

  // Unit flag byte: immediately after all channel pairs.
  // Battery byte: one byte after the unit flag.
  // Layout: [0:1] mfr ID · [2 .. 2+N*2-1] channel pairs · [2+N*2] unit flag · [2+N*2+1] battery %.
  const unitFlagIdx = 2 + rawValues.length * 2;
  const batteryIdx = unitFlagIdx + 1;

  let sourceIsCelsius = true;
  if (unitFlagIdx < bytes.length) {
    const flag = bytes[unitFlagIdx];
    if (flag === 0xff || flag === 0x01) {
      sourceIsCelsius = false;
    } else if (flag === 0x00) {
      sourceIsCelsius = true;
    }
  }

  // Battery byte is 0–100 when present. Values outside that range (e.g. 0xFF)
  // indicate the byte is not a battery reading on this firmware variant.
  const rawBattery = batteryIdx < bytes.length ? (bytes[batteryIdx] ?? null) : null;
  const batteryPct = rawBattery != null && rawBattery <= 100 ? rawBattery : null;

  const temps: number[] = [];
  for (const raw of rawValues) {
    // Explicit "no probe" sentinel used by most Inkbird firmware.
    if (raw >= 0xfffe) continue;

    const value = raw / 10;

    let tempF: number;
    if (sourceIsCelsius) {
      // If the Celsius value is outside the plausible range the raw bytes are
      // garbage (some firmware variants send non-sentinel junk for empty slots).
      // Drop the channel rather than re-interpreting it as Fahrenheit — that
      // was the previous behaviour and caused readings like 5661°F / 3103°F.
      if (value > MAX_PLAUSIBLE_CELSIUS || value <= MIN_PLAUSIBLE_CELSIUS) continue;
      tempF = (value * 9) / 5 + 32;
    } else {
      tempF = value;
    }

    // Final bounds gate — catches any remaining outliers regardless of unit flag.
    // Uses <= for the lower bound so that exactly 32°F (0°C open-circuit reads
    // on iBBQ devices) is excluded along with sub-freezing garbage values.
    if (tempF <= MIN_PLAUSIBLE_F || tempF > MAX_PLAUSIBLE_F) continue;

    temps.push(Math.round(tempF * 10) / 10);
  }

  return { temps, batteryPct };
}

/**
 * Returns true if the scanned BLE device is an Inkbird thermometer.
 *
 * Detection uses two guards:
 *  1. Name-prefix match: device name must start with one of INKBIRD_NAME_PREFIXES.
 *  2. Manufacturer data length: the payload must be ≥ 6 bytes (2-byte manufacturer
 *     ID + at least 2 channel pairs). Non-Inkbird BLE devices whose names happen
 *     to share a prefix (fitness trackers, smart plugs, etc.) typically carry no
 *     manufacturer data or carry very short payloads and are rejected here.
 *
 * Service UUID fallback was intentionally removed: 0xFFF0 and 0xFFE0 are generic
 * UUIDs shared by hundreds of unrelated device categories (fitness bands, smart
 * plugs, generic sensors). Using them as a detection signal caused every nearby
 * device advertising those UUIDs to appear as an Inkbird thermometer.
 */
export function isInkbirdDevice(device: any): boolean {
  const name = ((device?.name ?? device?.localName ?? "") as string).toLowerCase();
  if (!INKBIRD_NAME_PREFIXES.some((p) => name.startsWith(p))) return false;
  // Secondary guard: Inkbird thermometers always carry manufacturer data of at
  // least 6 bytes (2-byte manufacturer ID + at least 2 channel pairs = 4 bytes).
  const mfr = device?.manufacturerData as string | null | undefined;
  if (!mfr) return false;
  return base64ToBytes(mfr).length >= 6;
}
