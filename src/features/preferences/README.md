# features/preferences

The signed-in user's discovery preferences (see `supabase/README.md → Preferences + interests`).

- `api/preference-api.ts`: `fetchOwnDiscoveryPreferences`, `updateDiscoveryPreferences`,
  `fetchOwnGenderPreferences`, `setGenderPreferences` (atomic `set_discovery_gender_preferences` RPC)
- `api/preference-keys.ts`: `preferenceKeys.discovery(userId)`, `preferenceKeys.genders(userId)`
- `hooks/use-preferences.ts`: `useDiscoveryPreferences`, `useUpdateDiscoveryPreferences`,
  `useGenderPreferences`, `useSetGenderPreferences`
- `schemas/preferences.schema.ts`: age 18–99 (max ≥ min), overlap 1–60 days, gender values
  from `GENDERS`
- `components/PreferencesFields.tsx`: the fields; `toggleGenderPreference` / `isEveryone`
- `hooks/use-preferences-draft.ts`: editable copy of both tables. With `{ draftStore }` the
  unsaved values are kept per user on the device (`draftPersistFailed` reports a failed device
  write); `save()` drops the draft only once both tables were saved, so a half-saved attempt is
  completed on retry.
- `drafts.ts`: `onboardingPreferencesDraft`, the onboarding step's device draft store
  (validated with `preferencesDraftSchema`). Not used by the profile edit screen.

The preferences row is created automatically with the profile, so the app only reads and
updates it. At least one gender preference is required to finish onboarding and to save once
onboarding is complete (`gender_required`, SQLSTATE `TR003`). **"Everyone"** is a UI option that
stores every canonical gender value (there is no `everyone` value in the database); deselecting
one value from Everyone keeps the other four. `max_distance_km` is deprecated: not read, not
writable (no location-based matching), dropped in Phase 4M.
