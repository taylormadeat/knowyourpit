/**
 * isPgError — type guard for PostgreSQL error codes thrown from drizzle-orm.
 *
 * drizzle-orm/node-postgres wraps pg errors in a DrizzleQueryError, putting
 * the real pg error code in `err.cause.code`. Some future drivers (or raw pg
 * usage) may surface it directly on `err.code`. This helper checks both so
 * callers never have to remember which level the code lives at.
 *
 * @param err   The caught value (unknown).
 * @param code  The pg error code to test, e.g. "23505" (unique_violation).
 */
export function isPgError(err: unknown, code: string): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; cause?: { code?: unknown } };
  return e.code === code || e.cause?.code === code;
}
