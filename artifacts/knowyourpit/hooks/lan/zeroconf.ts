/**
 * Zeroconf / mDNS browser — thin wrapper around react-native-zeroconf.
 *
 * Scans both `_http._tcp` and `_meater._tcp` services on the local network.
 * Falls back silently on web or when the native module is unavailable
 * (e.g. Expo Go without a dev-client rebuild).
 *
 * Device identification heuristics (applied to `_http._tcp` services only)
 * -------------------------------------------------------------------------
 * MEATER Block  — port 2345, or name/host contains "meater"
 * Fireboard     — name/host contains "fireboard"
 * ThermoWorks   — name/host contains "thermoworks" or "signals"
 *
 * All `_meater._tcp` services are unconditionally classified as `meater_block`
 * by the caller — `classifyService` is not invoked for those events.
 *
 * The caller is responsible for passing the discovered host to the
 * appropriate polling adapter (pollMeaterBlock, pollFireboard, etc.).
 */

export type ZeroconfDeviceType = "meater_block" | "fireboard" | "thermoworks_signals" | "unknown";

export interface ZeroconfService {
  name: string;
  host: string;
  port: number;
  addresses: string[];
  deviceType: ZeroconfDeviceType;
}

export interface ZeroconfBrowser {
  /**
   * scan(type?, protocol?, domain?)
   * type and protocol are WITHOUT leading underscores — the native module
   * adds them.  e.g. scan('http', 'tcp', 'local.')
   */
  scan: (type?: string, protocol?: string, domain?: string) => void;
  stop: () => void;
  on: (
    event: "resolved" | "removed" | "error" | "start" | "stop" | "update",
    listener: (...args: any[]) => void,
  ) => void;
  removeDeviceListeners: () => void;
}

function classifyService(name: string, host: string, port: number): ZeroconfDeviceType {
  const haystack = `${name} ${host}`.toLowerCase();
  if (port === 2345 || haystack.includes("meater")) return "meater_block";
  if (haystack.includes("fireboard")) return "fireboard";
  if (
    haystack.includes("thermoworks") ||
    haystack.includes("signals") ||
    haystack.includes("rfx-gateway") ||
    haystack.includes("rfxgateway") ||
    /\brfx\b/.test(haystack)
  )
    return "thermoworks_signals";
  return "unknown";
}

let _ZeroconfClass: any = null;

function getZeroconfClass(): any {
  if (_ZeroconfClass !== null) return _ZeroconfClass;
  try {
    // Dynamic require so bundlers don't hard-fail on web
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-zeroconf");
    _ZeroconfClass = mod.default ?? mod.Zeroconf ?? mod;
    return _ZeroconfClass;
  } catch {
    return null;
  }
}

/**
 * Attempt to create a Zeroconf browser instance.
 * Returns null if the native module is unavailable.
 */
export function createZeroconfBrowser(): ZeroconfBrowser | null {
  const ZeroconfClass = getZeroconfClass();
  if (!ZeroconfClass) return null;
  try {
    return new ZeroconfClass() as ZeroconfBrowser;
  } catch {
    return null;
  }
}

export { classifyService };
