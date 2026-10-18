/**
 * Triply's own SQLSTATE contract for RPC / trigger errors (see the M-02 / M-03 migrations and
 * supabase/README.md). Feature error mappers switch on these; the `details` field carries a
 * stable key, never user-facing text.
 */
export const TRIPLY_SQLSTATE = {
  /** The caller's account is not active (suspended, banned, deletion pending). */
  accountInactive: 'TR001',
  /** complete_onboarding(): requirements missing; `details` = comma-separated keys. */
  onboardingIncomplete: 'TR002',
  /** A change that would break a completed profile; `details` names the guard. */
  blockedAfterOnboarding: 'TR003',
} as const;

/** The PostgREST/Postgres `details` string of an error, if any. */
export function getErrorDetails(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('details' in error)) return undefined;
  return typeof error.details === 'string' && error.details !== '' ? error.details : undefined;
}
