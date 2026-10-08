/** Extracts an HTTP-like status code from unknown errors (Supabase/PostgREST/fetch shapes). */
export function getErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const candidate =
    'status' in error ? error.status : 'statusCode' in error ? error.statusCode : undefined;
  if (typeof candidate === 'number') return candidate;
  if (typeof candidate === 'string' && /^\d{3}$/.test(candidate)) return Number(candidate);
  return undefined;
}

/** 4xx errors (except 408 timeout / 429 rate limit) are not worth retrying. */
export function isNonRetryableError(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (status === undefined) return false;
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}

export function toError(value: unknown): Error {
  if (value instanceof Error) return value;
  return new Error(typeof value === 'string' ? value : 'Unknown error');
}
