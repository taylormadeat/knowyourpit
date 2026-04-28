export const CANONICAL_ORIGIN = "https://www.knowyourpit.com";
export const CANONICAL_HOST = "www.knowyourpit.com";

const DEV_HOST_SUFFIXES = [
  ".replit.dev",
  ".janeway.replit.dev",
];

const DEV_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1"]);

export function isDevHost(hostname: string): boolean {
  if (DEV_HOSTS.has(hostname)) return true;
  return DEV_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix));
}

export function isCanonicalHost(hostname: string): boolean {
  return hostname === CANONICAL_HOST;
}

export function canonicalUrlForPath(pathname: string): string {
  const cleanPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${CANONICAL_ORIGIN}${cleanPath}`;
}

export function redirectToCanonicalIfNeeded(): boolean {
  if (typeof window === "undefined") return false;
  const { hostname, pathname, search, hash, protocol } = window.location;
  if (isDevHost(hostname)) return false;
  if (isCanonicalHost(hostname) && protocol === "https:") return false;
  const target = `${CANONICAL_ORIGIN}${pathname}${search}${hash}`;
  window.location.replace(target);
  return true;
}
