# features/interests

Controlled interest catalog + the signed-in user's selections (see `supabase/README.md → Preferences + interests`).

- `api/interest-api.ts`: `fetchActiveInterests`, `fetchOwnInterests`, `replaceOwnInterests`
  (atomic `replace_profile_interests` RPC: the only write path since Pre-3M; direct table
  writes are revoked)
- `api/interest-keys.ts`: `interestKeys.catalog()`, `interestKeys.own(userId)`
- `hooks/use-interests.ts`: `useInterests`, `useOwnInterests`, `useReplaceInterests`
- `hooks/use-interest-selection.ts`: draft selection for the picker (`meetsMinimum` = 3–8). With
  `{ draftStore }` the unsaved draft is kept per user on the device and `draftPersistFailed`
  reports a failed device write; `save()` only calls the server when the selection changed and
  drops the draft once the server has it.
- `drafts.ts`: `onboardingInterestsDraft`, the onboarding step's device draft store (validated
  uuid list, max 8). Not used by the profile edit screen.
- `schemas/interest.schema.ts`: UUID ids, max 8 (`MAX_INTERESTS`), duplicates collapsed

Rules: 3–8 interests (`MIN_INTERESTS`/`MAX_INTERESTS`). Fewer than 3 can be saved while
onboarding is in progress; once onboarding is complete the database rejects it
(`minimum_required`, SQLSTATE `TR003`). The catalog (30 interests) ships in migrations, not
`seed.sql`. No free-text interests.
