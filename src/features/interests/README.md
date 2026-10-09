# features/interests

Controlled interest catalog + the signed-in user's selections (see `supabase/README.md → Preferences + interests`).

- `api/interest-api.ts`: `fetchActiveInterests`, `fetchOwnInterests`, `addInterest`, `removeInterest`,
  `replaceOwnInterests` (atomic `replace_profile_interests` RPC)
- `api/interest-keys.ts`: `interestKeys.catalog()`, `interestKeys.own(userId)`
- `hooks/use-interests.ts`: `useInterests`, `useOwnInterests`, `useAddInterest`, `useRemoveInterest`, `useReplaceInterests`
- `schemas/interest.schema.ts`: UUID ids, max 10 (`MAX_INTERESTS`), duplicates collapsed

No free-text interests. The database enforces the 10-interest limit and active-only selection.
Prefer `useReplaceInterests` for multi-select screens.
