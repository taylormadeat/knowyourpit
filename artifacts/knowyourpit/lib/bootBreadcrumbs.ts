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

const MAX_CRUMBS = 60;
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
 * Wrap globalThis.fetch so every HTTP call gets recorded as a pair of
 * crumbs (start + end with duration). Idempotent: a second call is a
 * no-op. Only marks Clerk-related URLs by default to keep the log focused
 * on the boot bottleneck — pass `{ all: true }` to record everything.
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

    if (!shouldTrack(url)) {
      return original(input as RequestInfo, init);
    }

    // Trim long URLs for readability — we only need the host + path.
    const short = url.replace(/^https?:\/\//, "").slice(0, 80);
    const startedAt = Date.now();
    mark("fetch.start", short);
    try {
      const res = await original(input as RequestInfo, init);
      const ms = Date.now() - startedAt;
      mark("fetch.end", `${short} → ${res.status} (${ms}ms)`);
      return res;
    } catch (err) {
      const ms = Date.now() - startedAt;
      const msg = err instanceof Error ? err.message : String(err);
      mark("fetch.fail", `${short} → ${msg.slice(0, 60)} (${ms}ms)`);
      throw err;
    }
  };
}
