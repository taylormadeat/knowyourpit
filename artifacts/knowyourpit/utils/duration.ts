export type FmtMinutesOpts = {
  zero?: string;
};

export function fmtMinutes(mins: number, opts: FmtMinutesOpts = {}): string {
  const total = Math.max(0, Math.round(mins));
  if (total === 0 && opts.zero !== undefined) return opts.zero;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function fmtDurationMs(ms: number, opts?: FmtMinutesOpts): string {
  return fmtMinutes(Math.abs(ms) / 60000, opts);
}

export function fmtRelMinutes(targetMs: number, nowMs: number): string {
  const diffMin = Math.round((targetMs - nowMs) / 60000);
  if (Math.abs(diffMin) < 1) return "now";
  const body = fmtMinutes(Math.abs(diffMin));
  return diffMin > 0 ? `in ${body}` : `${body} ago`;
}
