import { useRef } from 'react';
import { Controller, useFormState } from 'react-hook-form';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AppInput } from '@/components/forms/AppInput';
import { FormField } from '@/components/forms/FormField';
import { OptionGroup } from '@/components/forms/OptionGroup';
import { AppText } from '@/components/ui/AppText';
import { useZodForm } from '@/hooks/use-zod-form';
import { spacing } from '@/theme';

import { MINIMUM_AGE } from '../age';
import { profileBasicsFormSchema, toFormValues } from '../schemas/profile-form.schema';
import { BIO_MAX_LENGTH, type Gender, type Profile } from '../types';

export const GENDER_OPTIONS: readonly { value: Gender; label: string }[] = [
  { value: 'woman', label: 'Woman' },
  { value: 'man', label: 'Man' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Another identity' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function genderLabel(gender: string | null | undefined): string | null {
  return GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? null;
}

export function useProfileBasicsForm(profile: Profile | null | undefined) {
  return useZodForm(profileBasicsFormSchema, {
    defaultValues: toFormValues(profile),
    mode: 'onTouched',
  });
}

export type ProfileBasicsForm = ReturnType<typeof useProfileBasicsForm>;

export interface ProfileBasicsFieldsProps {
  form: ProfileBasicsForm;
  /** Hide the "about you" fields (onboarding keeps the first step short). */
  compact?: boolean;
  /**
   * Date of birth is read-only (onboarding complete: the database rejects changes, and the
   * update payload leaves it out). Corrections go through support.
   */
  dobLocked?: boolean;
}

/** The basic profile fields. Required: first name, date of birth (18+), gender. */
export function ProfileBasicsFields({
  form,
  compact = false,
  dobLocked = false,
}: ProfileBasicsFieldsProps) {
  const { control, setFocus } = form;
  // Subscribe explicitly: `form.formState` is mutated in place on a stable object, so with the
  // React Compiler this component would never re-render for it and date-of-birth errors
  // (including "18 or over") would stay hidden (found in simulator E2E).
  const { errors } = useFormState({ control, name: ['dob_day', 'dob_month', 'dob_year'] });
  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);
  const dobError = errors.dob_day?.message ?? errors.dob_month?.message ?? errors.dob_year?.message;

  return (
    <View style={styles.fields}>
      <Controller
        control={control}
        name="first_name"
        render={({ field, fieldState }) => (
          <FormField
            label="First name"
            error={fieldState.error?.message}
            helper="Only your first name is shown to others."
          >
            <AppInput
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(fieldState.error)}
              placeholder="e.g. Maya"
              autoCapitalize="words"
              autoComplete="given-name"
              textContentType="givenName"
              returnKeyType="next"
              onSubmitEditing={() => setFocus('dob_day')}
              maxLength={80}
              accessibilityLabel="First name"
              testID="field-first-name"
            />
          </FormField>
        )}
      />

      <FormField
        label="Date of birth"
        error={dobLocked ? undefined : dobError}
        helper={
          dobLocked
            ? 'Your date of birth can’t be changed after sign-up. Contact support if it’s wrong.'
            : `Triply is for adults only (${MINIMUM_AGE}+). Your age is shown, never your birthday.`
        }
      >
        <View style={styles.dobRow}>
          <Controller
            control={control}
            name="dob_day"
            // The date is validated as a whole (error shown on dob_day): re-check all parts.
            rules={{ deps: ['dob_month', 'dob_year'] }}
            render={({ field }) => (
              <AppInput
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text.replace(/\D/g, ''));
                  if (text.length === 2) monthRef.current?.focus();
                }}
                onBlur={field.onBlur}
                invalid={!dobLocked && Boolean(dobError)}
                editable={!dobLocked}
                placeholder="DD"
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                onSubmitEditing={() => monthRef.current?.focus()}
                accessibilityLabel="Day of birth"
                style={styles.dobPart}
                testID="field-dob-day"
              />
            )}
          />
          <Controller
            control={control}
            name="dob_month"
            rules={{ deps: ['dob_day', 'dob_year'] }}
            render={({ field }) => (
              <AppInput
                ref={monthRef}
                value={field.value}
                onChangeText={(text) => {
                  field.onChange(text.replace(/\D/g, ''));
                  if (text.length === 2) yearRef.current?.focus();
                }}
                onBlur={field.onBlur}
                invalid={!dobLocked && Boolean(dobError)}
                editable={!dobLocked}
                placeholder="MM"
                keyboardType="number-pad"
                maxLength={2}
                returnKeyType="next"
                onSubmitEditing={() => yearRef.current?.focus()}
                accessibilityLabel="Month of birth"
                style={styles.dobPart}
                testID="field-dob-month"
              />
            )}
          />
          <Controller
            control={control}
            name="dob_year"
            rules={{ deps: ['dob_day', 'dob_month'] }}
            render={({ field }) => (
              <AppInput
                ref={yearRef}
                value={field.value}
                onChangeText={(text) => field.onChange(text.replace(/\D/g, ''))}
                onBlur={field.onBlur}
                invalid={!dobLocked && Boolean(dobError)}
                editable={!dobLocked}
                placeholder="YYYY"
                keyboardType="number-pad"
                maxLength={4}
                returnKeyType="done"
                accessibilityLabel="Year of birth"
                style={[styles.dobPart, styles.dobYear]}
                testID="field-dob-year"
              />
            )}
          />
        </View>
      </FormField>

      <Controller
        control={control}
        name="gender"
        render={({ field, fieldState }) => (
          <FormField label="I am a" error={fieldState.error?.message}>
            <OptionGroup
              options={GENDER_OPTIONS}
              value={field.value || null}
              onChange={(value) => field.onChange(value)}
              accessibilityLabel="Gender"
              testID="field-gender"
            />
          </FormField>
        )}
      />

      {compact ? null : (
        <>
          <AppText variant="h3" style={styles.sectionTitle}>
            About you
          </AppText>
          <Controller
            control={control}
            name="bio"
            render={({ field, fieldState }) => (
              <FormField
                label="Bio"
                optional
                error={fieldState.error?.message}
                meta={`${field.value.length}/${BIO_MAX_LENGTH}`}
              >
                <AppInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  invalid={Boolean(fieldState.error)}
                  placeholder="What kind of traveller are you? What are you hoping to find?"
                  multiline
                  maxLength={BIO_MAX_LENGTH}
                  accessibilityLabel="Bio"
                  testID="field-bio"
                />
              </FormField>
            )}
          />
          <View style={styles.pair}>
            <Controller
              control={control}
              name="home_city"
              render={({ field, fieldState }) => (
                <View style={styles.half}>
                  <FormField label="Home city" optional error={fieldState.error?.message}>
                    <AppInput
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Lisbon"
                      autoCapitalize="words"
                      maxLength={120}
                      accessibilityLabel="Home city"
                      testID="field-home-city"
                    />
                  </FormField>
                </View>
              )}
            />
            <Controller
              control={control}
              name="home_country"
              render={({ field, fieldState }) => (
                <View style={styles.half}>
                  <FormField label="Country" optional error={fieldState.error?.message}>
                    <AppInput
                      value={field.value}
                      onChangeText={field.onChange}
                      onBlur={field.onBlur}
                      placeholder="Portugal"
                      autoCapitalize="words"
                      maxLength={120}
                      accessibilityLabel="Home country"
                      testID="field-home-country"
                    />
                  </FormField>
                </View>
              )}
            />
          </View>
          <Controller
            control={control}
            name="occupation"
            render={({ field, fieldState }) => (
              <FormField label="What you do" optional error={fieldState.error?.message}>
                <AppInput
                  value={field.value}
                  onChangeText={field.onChange}
                  onBlur={field.onBlur}
                  placeholder="Product designer, nurse, founder…"
                  autoCapitalize="sentences"
                  maxLength={120}
                  accessibilityLabel="Occupation"
                  testID="field-occupation"
                />
              </FormField>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fields: { gap: spacing.lg },
  dobRow: { flexDirection: 'row', gap: spacing.xs },
  dobPart: { flex: 1, textAlign: 'center' },
  dobYear: { flex: 1.6 },
  sectionTitle: { marginTop: spacing.xs },
  pair: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
});
