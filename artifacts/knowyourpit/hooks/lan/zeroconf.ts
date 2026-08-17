/**
 * Zeroconf / mDNS browser — thin wrapper around react-native-zeroconf.
 *
 * Scans `_http._tcp` services on the local network.
 * Falls back silently on web or when the native module is unavailable
 * (e.g. Expo Go without a dev-client rebuild).
 *
 * Device identification heuristics (applied to `_http._tcp` services)
 * -------------------------------------------------------------------------
 * Fireboard     — name/host contains "fireboard"
 *
 * The caller is responsible for passing the discovered host to the
 * appropriate polling adapter (pollFireboard, etc.).
 */

export type ZeroconfDeviceType = "fireboard" | "unknown";

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

function classifyService(name: string, host: string, _port: number): ZeroconfDeviceType {
  const haystack = `${name} ${host}`.toLowerCase();
  if (haystack.includes("fireboard")) return "fireboard";
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
