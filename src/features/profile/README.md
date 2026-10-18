# features/profile

Own profile data layer plus the Profile tab and edit screens (Phase 2M).

- `api/`, `hooks/use-own-profile.ts`: `useOwnProfile`, `useUpdateProfile` (column-granted
  UPDATE; the server recomputes `is_profile_complete`).
- `schemas/profile.schema.ts`: strict update schema (protected columns rejected).
- `schemas/profile-form.schema.ts`: UI form model with a three-field date of birth
  (day/month/year), 18+ check and `toProfileUpdate` / `toFormValues` mappers.
- `components/ProfileBasicsFields.tsx`: shared fields for onboarding and editing
  (`compact` hides the "about you" section). `GENDER_OPTIONS` maps backend values to labels.
- `components/ProfileScreen.tsx`: Profile tab (photo hero, name/age, about, interests,
  discovery summary, account/sign-out).
- `components/Edit*Screen.tsx`: edit basics, interests, preferences, photos (routes under
  `app/(tabs)/profile/*`, pushed inside the tab stack). After onboarding: the date of birth is
  read-only and never sent (the database locks it), interests cannot be saved below 3, gender
  preferences cannot be saved empty, and the last photo can only be replaced.
- `components/profile-messages.ts`: user-safe messages for profile, interest and preference
  errors (incl. `under_18`, `date_of_birth_locked`, `account_inactive`).
- Limits: bio optional, ≤ 500 characters. Server-owned: `is_profile_complete`,
  `onboarding_completed_at`, `discovery_paused_at`; `is_discoverable` is deprecated and unread.
- `age.ts`: `isAdult`, `ageFromDateOfBirth` (client-side mirrors; the database is the authority).

Design notes: the date of birth uses three numeric fields instead of a native picker to avoid a
new dependency and keep iOS/Android identical; no phone, address or live location is collected.

React Compiler note: components that receive a `form` prop must read errors with
`useFormState({ control })`, not `form.formState` (mutated in place on a stable object, so the
compiler skips the re-render and errors never show; found in simulator E2E on the 18+ check).
