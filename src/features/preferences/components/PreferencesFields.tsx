import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FormField } from '@/components/forms/FormField';
import { OptionGroup } from '@/components/forms/OptionGroup';
import { Stepper } from '@/components/forms/Stepper';
import { GENDER_OPTIONS } from '@/features/profile/components/ProfileBasicsFields';
import { GENDERS, type Gender } from '@/features/profile/types';
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

/** UI-only option: "Everyone" is stored as every canonical gender value (no DB sentinel). */
export const EVERYONE = 'everyone' as const;
type GenderChoice = Gender | typeof EVERYONE;

const GENDER_CHOICE_OPTIONS: readonly {
  value: GenderChoice;
  label: string;
  description?: string;
}[] = [
  {
    value: EVERYONE,
    label: 'Everyone',
    description: 'Any gender, including people who prefer not to say.',
  },
  ...GENDER_PREFERENCE_OPTIONS,
];

export function isEveryone(genders: readonly Gender[]): boolean {
  return GENDERS.every((gender) => genders.includes(gender));
}

/**
 * Applies a tap on a gender option. "Everyone" selects every value (or clears them all when
 * everything is already selected); an individual value toggles just that value, so deselecting
 * one from "Everyone" leaves the other four selected. Output is in canonical order.
 */
export function toggleGenderPreference(current: readonly Gender[], choice: GenderChoice): Gender[] {
  if (choice === EVERYONE) return isEveryone(current) ? [] : [...GENDERS];
  const next = current.includes(choice)
    ? current.filter((gender) => gender !== choice)
    : [...current, choice];
  return GENDERS.filter((gender) => next.includes(gender));
}

export function formatOverlapDays(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Discovery preferences: who you want to meet (at least one, or Everyone), age range, and
 * minimum trip overlap.
 */
export function PreferencesFields({ value, onChange }: PreferencesFieldsProps) {
  const [touchedGenders, setTouchedGenders] = useState(false);
  const selected: GenderChoice[] = isEveryone(value.genders)
    ? [EVERYONE, ...value.genders]
    : value.genders;

  return (
    <View style={styles.root}>
      <FormField
        label="I’d like to meet"
        helper="Choose at least one, or Everyone."
        error={
          touchedGenders && value.genders.length === 0 ? 'Choose at least one option.' : undefined
        }
      >
        <OptionGroup
          options={GENDER_CHOICE_OPTIONS}
          value={selected}
          onChange={(choice) => {
            setTouchedGenders(true);
            onChange({ ...value, genders: toggleGenderPreference(value.genders, choice) });
          }}
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
