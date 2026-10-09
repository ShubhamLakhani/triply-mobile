# features/auth

Supabase Auth integration. `auth.users` is the identity source; no credentials or tokens are
stored or logged by app code. Sessions persist via the Supabase client's expo-sqlite
`localStorage` and refresh while the app is foregrounded (`src/services/supabase`).

- `api/auth-api.ts`: `getCurrentSession`, `getCurrentUser`, `subscribeToAuthChanges`
- `api/auth-cache.ts`: clears TanStack Query caches on `SIGNED_OUT` (wired in `AppProviders`)
- `hooks/use-auth-session.ts`: `useAuthSession()` → `{ session, userId, isLoading }`

Phase 1M-B ships no sign-in UI. Email OTP / magic-link screens, deep-link callbacks and
protected routing come with onboarding. Social providers (Apple/Google) are out of scope.
