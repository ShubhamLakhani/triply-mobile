# features/interests

Controlled interest catalog + the signed-in user's selections (see `supabase/README.md → Preferences + interests`).

- `api/interest-api.ts`: `fetchActiveInterests`, `fetchOwnInterests`, `replaceOwnInterests`
  (atomic `replace_profile_interests` RPC: the only write path since Pre-3M; direct table
  writes are revoked)
- `api/interest-keys.ts`: `interestKeys.catalog()`, `interestKeys.own(userId)`
- `hooks/use-interests.ts`: `useInterests`, `useOwnInterests`, `useReplaceInterests`
- `hooks/use-interest-selection.ts`: draft selection for the picker (`meetsMinimum` = 3–8)
- `schemas/interest.schema.ts`: UUID ids, max 8 (`MAX_INTERESTS`), duplicates collapsed

Rules: 3–8 interests (`MIN_INTERESTS`/`MAX_INTERESTS`). Fewer than 3 can be saved while
onboarding is in progress; once onboarding is complete the database rejects it
(`minimum_required`, SQLSTATE `TR003`). The catalog (30 interests) ships in migrations, not
`seed.sql`. No free-text interests.
