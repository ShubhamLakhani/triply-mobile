/** Extracts an HTTP-like status code from unknown errors (Supabase/PostgREST/fetch shapes). */
export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate =
    'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined;
  if (typeof candidate === 'number') return candidate;
  if (typeof candidate === 'string' && /^\d{3}$/.test(candidate)) return Number(candidate);
  return undefined;
}

/** A string `code` on an error object (typed feature errors, PostgREST, Postgres, Auth). */
export function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) return undefined;
  return typeof error.code === 'string' && error.code !== '' ? error.code : undefined;
}

/** SQLSTATE classes worth retrying: connection, transaction rollback, resources, operator, system. */
const RETRYABLE_SQLSTATE_CLASSES = new Set(['08', '40', '53', '57', '58']);
const MAX_CAUSE_DEPTH = 3;

/**
 * Deterministic failures are not worth retrying:
 * - HTTP 4xx (except 408 timeout / 429 rate limit);
 * - typed feature errors (`TripError`, `PhotoError`, …): their lowercase `code` is a stable,
 *   deterministic outcome (not_allowed, not_found, invalid_input, limit_reached, …). Only
 *   `unknown` is inspected further via its `cause`;
 * - PostgREST (`PGRST…`) and Postgres SQLSTATE codes outside the transient classes.
 * Plain network failures (no status, no code) remain retryable.
 */
export function isNonRetryableError(error: unknown, depth = 0): boolean {
  const status = getErrorStatus(error);
  if (status !== undefined) {
    return status >= 400 && status < 500 && status !== 408 && status !== 429;
  }
  const code = getErrorCode(error);
  if (code === undefined) return false;
  if (/^[a-z][a-z0-9_]*$/.test(code)) {
    if (code !== 'unknown') return true;
    const cause = error instanceof Error ? error.cause : undefined;
    return cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? isNonRetryableError(cause, depth + 1)
      : false;
  }
  if (code.startsWith('PGRST')) return true;
  if (/^[0-9A-Z]{5}$/.test(code)) return !RETRYABLE_SQLSTATE_CLASSES.has(code.slice(0, 2));
  return false;
}

export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown error');
}
