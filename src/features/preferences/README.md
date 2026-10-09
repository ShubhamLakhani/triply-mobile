# features/preferences

The signed-in user's discovery preferences (see `supabase/README.md → Preferences + interests`).

- `api/preference-api.ts`: `fetchOwnDiscoveryPreferences`, `updateDiscoveryPreferences`,
  `fetchOwnGenderPreferences`, `setGenderPreferences` (atomic `set_discovery_gender_preferences` RPC)
- `api/preference-keys.ts`: `preferenceKeys.discovery(userId)`, `preferenceKeys.genders(userId)`
- `hooks/use-preferences.ts`: `useDiscoveryPreferences`, `useUpdateDiscoveryPreferences`,
  `useGenderPreferences`, `useSetGenderPreferences`
- `schemas/preferences.schema.ts`: age 18–99 (max ≥ min), overlap 1–60 days, optional
  distance 1–20000 km, gender values from `GENDERS`

The preferences row is created automatically with the profile, so the app only reads and
updates it. "Everyone" means selecting all gender values; an empty list means not configured
yet. `max_distance_km` is future-facing only: Triply never collects live location.
