import { StyleSheet, View } from 'react-native';

import { FormField } from '@/components/forms/FormField';
import { OptionGroup } from '@/components/forms/OptionGroup';
import { Stepper } from '@/components/forms/Stepper';
import { GENDER_OPTIONS } from '@/features/profile/components/ProfileBasicsFields';
import type { Gender } from '@/features/profile/types';
import { spacing } from '@/theme';

import { PREFERENCE_LIMITS } from '../types';

export interface PreferencesDraft {
  min_age: number;
  max_age: number;
  minimum_overlap_days: number;
  genders: Gender[];
}

export interface PreferencesFieldsProps {
  value: PreferencesDraft;
  onChange: (next: PreferencesDraft) => void;
}

export const GENDER_PREFERENCE_OPTIONS = GENDER_OPTIONS.map((option) => ({
  ...option,
  label:
    option.value === 'other'
      ? 'People of another identity'
      : option.value === 'prefer_not_to_say'
        ? 'People who prefer not to say'
        : option.value === 'man'
          ? 'Men'
          : option.value === 'woman'
            ? 'Women'
            : 'Non-binary people',
}));

export function formatOverlapDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** Discovery preferences: who you want to meet, age range, and minimum trip overlap. */
export function PreferencesFields({ value, onChange }: PreferencesFieldsProps) {
  const toggleGender = (gender: Gender) =>
    onChange({
      ...value,
      genders: value.genders.includes(gender)
        ? value.genders.filter((g) => g !== gender)
        : [...value.genders, gender],
    });

  return (
    <View style={styles.root}>
      <FormField
        label="I’d like to meet"
        helper="Choose as many as you like. Leaving all unselected means everyone."
      >
        <OptionGroup
          options={GENDER_PREFERENCE_OPTIONS}
          value={value.genders}
          onChange={toggleGender}
          multiple
          accessibilityLabel="Genders you want to meet"
          testID="pref-genders"
        />
      </FormField>
      <FormField
        label="Age range"
        helper={`Between ${PREFERENCE_LIMITS.minAge} and ${PREFERENCE_LIMITS.maxAge}.`}
      >
        <View style={styles.stack}>
          <Stepper
            label="Youngest"
            value={value.min_age}
            min={PREFERENCE_LIMITS.minAge}
            max={value.max_age}
            onChange={(min_age) => onChange({ ...value, min_age })}
            testID="pref-min-age"
          />
          <Stepper
            label="Oldest"
            value={value.max_age}
            min={value.min_age}
            max={PREFERENCE_LIMITS.maxAge}
            onChange={(max_age) => onChange({ ...value, max_age })}
            testID="pref-max-age"
          />
        </View>
      </FormField>
      <FormField
        label="Minimum trip overlap"
        helper="We only suggest people whose trip overlaps yours by at least this many days — so there’s real time to meet."
      >
        <Stepper
          label="Overlap"
          value={value.minimum_overlap_days}
          min={PREFERENCE_LIMITS.minOverlapDays}
          max={PREFERENCE_LIMITS.maxOverlapDays}
          onChange={(minimum_overlap_days) => onChange({ ...value, minimum_overlap_days })}
          format={formatOverlapDays}
          testID="pref-overlap"
        />
      </FormField>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  stack: { gap: spacing.xs },
});
