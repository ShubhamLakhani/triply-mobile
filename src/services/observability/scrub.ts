/**
 * PII / credential scrubbing applied to every Sentry event and breadcrumb.
 * Defence in depth: we also never attach user email, message text or tokens deliberately.
 */

const REDACTED = '[redacted]';

const PATTERNS: readonly RegExp[] = [
  // Email addresses
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  // Bearer tokens
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g,
  // JWTs (access / refresh / legacy Supabase keys)
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // Supabase new-style keys
  /sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g,
  // OAuth / magic-link tokens in query strings
  /([?&#](?:access_token|refresh_token|token|code|apikey)=)[^&#\s]+/gi,
];

const SENSITIVE_KEYS =
  /^(authorization|cookie|set-cookie|apikey|password|token|access_token|refresh_token|email|phone)$/i;

export function scrubString(input: string): string {
  return PATTERNS.reduce(
    (value, pattern) =>
      value.replace(pattern, (match: string, prefix?: unknown) =>
        typeof prefix === 'string' && match.startsWith(prefix) ? `${prefix}${REDACTED}` : REDACTED,
      ),
    input,
  );
}

/** Recursively scrubs strings and drops values stored under sensitive keys. */
export function scrubValue(value: unknown, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, depth + 1));
  if (value && typeof value === 'object') {
    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      output[key] = SENSITIVE_KEYS.test(key) ? REDACTED : scrubValue(entry, depth + 1);
    }
    return output;
  }
  return value;
}

interface ScrubbableEvent {
  user?: { id?: string | number } & Record<string, unknown>;
  request?: unknown;
}

/** Keeps only the opaque user id; scrubs the rest of the event payload. */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  const scrubbed = scrubValue(event) as T;
  if (event.user) {
    scrubbed.user = event.user.id !== undefined ? { id: event.user.id } : {};
  }
  if (scrubbed.request !== undefined) {
    delete scrubbed.request;
  }
  return scrubbed;
}
