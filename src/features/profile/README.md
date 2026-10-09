# features/profile

Own-profile data layer over `public.profiles` (see `supabase/README.md → Profiles`).

- `api/profile-api.ts`: `fetchOwnProfile(userId)`, `updateOwnProfile(userId, input)`
  (explicit column list; validated editable fields only)
- `api/profile-keys.ts`: `profileKeys.own(userId)`. Profile server state lives only in TanStack Query
- `api/profile-errors.ts`: `ProfileError` with stable codes mapped from Postgres/PostgREST
- `hooks/use-own-profile.ts`: `useCurrentProfile()`, `useOwnProfile(userId)`, `useUpdateProfile(userId)`
- `schemas/profile.schema.ts`: Zod schema for editable fields (UX mirror of database rules)
- `age.ts`: client mirror of `private.is_adult()` for instant feedback

The database is authoritative for completeness, the 18+ rule and discoverability.
`is_profile_complete` is read-only for the app.
