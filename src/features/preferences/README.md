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

The preferences row is created automatically with the profile, so the app only reads and
updates it. At least one gender preference is required to finish onboarding and to save once
onboarding is complete (`gender_required`, SQLSTATE `TR003`). **"Everyone"** is a UI option that
stores every canonical gender value (there is no `everyone` value in the database); deselecting
one value from Everyone keeps the other four. `max_distance_km` is deprecated: not read, not
writable (no location-based matching), dropped in Phase 4M.
