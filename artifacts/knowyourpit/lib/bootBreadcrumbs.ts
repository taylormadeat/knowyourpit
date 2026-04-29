/**
 * Boot-time breadcrumbs.
 *
 * Records timestamped events from app start until Clerk finishes loading
 * (or the escape hatch fires). The BootDiagnostic screen reads this list
 * and renders the most recent N events so we can see — on a real device,
 * in production, with no debugger — exactly which step is blocking the
 * boot.
 *
 * Why a module-level array instead of React state:
 * - It must capture events that happen *before* React mounts.
 * - It must not trigger re-renders, which would themselves slow down boot.
 * - Reads are cheap (snapshot the array on each render of the diagnostic).
 *
 * The list is capped to avoid unbounded memory growth in long-running
 * sessions. Order is oldest-first.
 */

interface Breadcrumb {
  /** Milliseconds since the JS bundle first executed. */
  t: number;
  /** Short event label, eg "fonts.loaded" or "fetch.start". */
  label: string;
  /** Optional detail, eg the URL or duration. */
  detail?: string;
}

const MAX_CRUMBS = 80;
const T0 = Date.now();
const crumbs: Breadcrumb[] = [];

export function mark(label: string, detail?: string): void {
  const c: Breadcrumb = { t: Date.now() - T0, label };
  if (detail !== undefined) c.detail = detail;
  crumbs.push(c);
  if (crumbs.length > MAX_CRUMBS) crumbs.shift();
}

export function getBreadcrumbs(): Breadcrumb[] {
  return crumbs.slice();
}

export function formatBreadcrumbs(list: Breadcrumb[] = crumbs): string {
  return list
    .map((c) => {
      const ts = (c.t / 1000).toFixed(2).padStart(6, " ");
      return c.detail ? `${ts}s  ${c.label}  ${c.detail}` : `${ts}s  ${c.label}`;
    })
    .join("\n");
}

/**
 * True when this URL targets one of Clerk's hosts (custom-domain FAPI like
 * `clerk.knowyourpit.com`, or Clerk's underlying CDN host
 * `frontend-api.clerk.services`). Used to decide whether to rewrite headers.
 */
function isClerkRequest(url: string): boolean {
  return /clerk/i.test(url);
}

/**
 * Rewrite headers on outbound Clerk requests so the production Clerk
 * instance accepts them.
 *
 * The bug this fixes: builds 40/42/44/48 hung at the splash for ~10s
 * because Clerk's `/v1/client` and `/v1/environment` requests came back
 * with HTTP 400 `origin_invalid` ("The Request HTTP Origin header must be
 * equal to or a subdomain of the requesting URL"). The Clerk SDK has no
 * retry path on this error, so it sat silent until the escape hatch fired.
 *
 * Reproducing the same request from this server:
 * - `Origin: capacitor://localhost`              → HTTP 400
 * - `Origin: com.knowyourpit.app://`             → HTTP 400
 * - `Origin: https://clerk.knowyourpit.com`      → HTTP 200
 * - no `Origin` header at all                    → HTTP 200
 *
 * So we strip `Origin` entirely (both casings to defend against
 * non-spec-compliant Headers polyfills) so the request looks like a
 * native client call rather than a cross-origin browser call. We also
 * drop `Referer` defensively — Clerk never requires it and removing it
 * eliminates one more degree of freedom for the server to reject on.
 *
 * The `url` arg is unused now but kept for future header rewrites that
 * may need to know the target host (e.g. switching strategies per
 * Clerk subdomain).
 */
function fixClerkHeaders(_url: string, headers: Headers): void {
  try {
    headers.delete("Origin");
    headers.delete("origin");
    headers.delete("Referer");
    headers.delete("referer");
  } catch {
    // Headers may be immutable in rare cases; tolerate and continue.
  }
}

/**
 * Wrap globalThis.fetch so every HTTP call gets recorded as a pair of
 * crumbs (start + end with duration). Idempotent: a second call is a
 * no-op. Only marks Clerk-related URLs by default to keep the log focused
 * on the boot bottleneck — pass `{ all: true }` to record everything.
 *
 * Beyond breadcrumbs, this wrapper ALSO rewrites the Origin header on
 * Clerk requests (see `fixClerkHeaders` for the reasoning) and captures
 * the response body of any non-2xx Clerk response as an additional
 * breadcrumb so future failures are diagnosable on-device without a
 * round trip.
 */
let fetchWrapped = false;
export function installFetchTracker(opts: { all?: boolean } = {}): void {
  if (fetchWrapped) return;
  fetchWrapped = true;

  const original = globalThis.fetch;
  if (typeof original !== "function") return;

  const shouldTrack = (url: string): boolean => {
    if (opts.all) return true;
    return /clerk|frontend-api|appstore|knowyourpit/i.test(url);
  };

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
        ? input.toString()
        : (input as Request).url ?? String(input);

    // Apply the Clerk-Origin fix BEFORE either tracking or forwarding.
    // This must work whether the caller passed (string, init) or a
    // pre-built Request — the SDK uses both shapes in different paths.
    let finalInput: RequestInfo | URL = input;
    let finalInit: RequestInit | undefined = init;

    if (isClerkRequest(url)) {
      try {
        if (input instanceof Request) {
          // Clone the Request with rewritten headers. We can't mutate
          // a Request's headers in place reliably across implementations,
          // so build a fresh one from a clone of the original. Cloning
          // first ensures the body is duplicated so the original is left
          // un-disturbed in case anything else still holds a reference,
          // and the new Request gets its own readable body stream.
          const cloneSource =
            typeof input.clone === "function" ? input.clone() : input;
          const newHeaders = new Headers(input.headers);
          fixClerkHeaders(url, newHeaders);
          finalInput = new Request(cloneSource, { headers: newHeaders });

          // Per fetch spec, when both `Request` and `init` are passed,
          // `init.headers` overrides the request's headers. So if a
          // caller did `fetch(req, { headers: ... })` with a bad Origin
          // in init, our Request rewrite would be undone. Sanitize
          // `init.headers` too — strip Origin/Referer from any init
          // override so nothing can re-introduce the rejected headers.
          if (init?.headers) {
            const cleanedInit = new Headers(init.headers as HeadersInit);
            fixClerkHeaders(url, cleanedInit);
            finalInit = { ...init, headers: cleanedInit };
          }
        } else {
          // String/URL input: rewrite via init.headers. Build a Headers
          // instance so we get a uniform .set/.delete API regardless of
          // what the caller passed (object literal, array, or Headers).
          const newHeaders = new Headers(
            (init?.headers as HeadersInit | undefined) ?? {},
          );
          fixClerkHeaders(url, newHeaders);
          finalInit = { ...(init ?? {}), headers: newHeaders };
        }
      } catch (rewriteErr) {
        // If the rewrite itself blew up, fall back to the original
        // request unchanged. We'd rather see the original 400 in the
        // breadcrumbs than crash the boot completely.
        const msg =
          rewriteErr instanceof Error
            ? rewriteErr.message
            : String(rewriteErr);
        mark("fetch.rewrite.fail", msg.slice(0, 80));
      }
    }

    if (!shouldTrack(url)) {
      return original(finalInput as RequestInfo, finalInit);
    }

    // Trim long URLs for readability — we only need the host + path.
    const short = url.replace(/^https?:\/\//, "").slice(0, 80);
    const startedAt = Date.now();
    mark("fetch.start", short);
    try {
      const res = await original(finalInput as RequestInfo, finalInit);
      const ms = Date.now() - startedAt;
      mark("fetch.end", `${short} → ${res.status} (${ms}ms)`);

      // For non-2xx Clerk responses, also capture the response body so
      // we can see WHY Clerk rejected the request without needing
      // another build round-trip. Clone first so the SDK's downstream
      // .json() / .text() still works.
      if (res.status >= 400 && isClerkRequest(url)) {
        try {
          const cloned = res.clone();
          const body = await cloned.text();
          // First ~200 chars is enough for the first error message.
          const trimmed = body.replace(/\s+/g, " ").trim().slice(0, 200);
          mark(`fetch.body.${res.status}`, trimmed);
        } catch (bodyErr) {
          const msg =
            bodyErr instanceof Error ? bodyErr.message : String(bodyErr);
          mark(`fetch.body.${res.status}.fail`, msg.slice(0, 80));
        }
      }

      return res;
    } catch (err) {
      const ms = Date.now() - startedAt;
      const msg = err instanceof Error ? err.message : String(err);
      mark("fetch.fail", `${short} → ${msg.slice(0, 60)} (${ms}ms)`);
      throw err;
    }
  };
}
