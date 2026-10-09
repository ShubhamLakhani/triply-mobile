export {
  DISCOVERY_PREFERENCE_COLUMNS,
  fetchOwnDiscoveryPreferences,
  fetchOwnGenderPreferences,
  setGenderPreferences,
  updateDiscoveryPreferences,
} from './api/preference-api';
export { PreferenceError, type PreferenceErrorCode } from './api/preference-errors';
export { preferenceKeys } from './api/preference-keys';
export {
  useDiscoveryPreferences,
  useGenderPreferences,
  useSetGenderPreferences,
  useUpdateDiscoveryPreferences,
} from './hooks/use-preferences';
export {
  discoveryPreferencesUpdateSchema,
  genderPreferencesSchema,
  type DiscoveryPreferencesUpdateInput,
  type GenderPreferencesInput,
} from './schemas/preferences.schema';
export { PREFERENCE_LIMITS, type DiscoveryPreferences, type GenderPreference } from './types';
