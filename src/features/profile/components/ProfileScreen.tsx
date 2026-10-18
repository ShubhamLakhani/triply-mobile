import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppChip } from '@/components/ui/AppChip';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';
import { useOwnInterests } from '@/features/interests/hooks/use-interests';
import { useOwnProfilePhotos } from '@/features/photos/hooks/use-profile-photos';
import {
  formatOverlapDays,
  GENDER_PREFERENCE_OPTIONS,
  isEveryone,
} from '@/features/preferences/components/PreferencesFields';
import {
  useDiscoveryPreferences,
  useGenderPreferences,
} from '@/features/preferences/hooks/use-preferences';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { ageFromDateOfBirth } from '../age';
import { useOwnProfile } from '../hooks/use-own-profile';

import { genderLabel } from './ProfileBasicsFields';
import { ProfileHeaderPhoto } from './ProfileHeaderPhoto';
import { ProfileRow } from './ProfileRow';

/** Production Profile tab: photo hero, identity, about, interests, preferences, account. */
export function ProfileScreen() {
  const { userId, signOut } = useAuthSession();
  const analytics = useAnalytics();
  const profile = useOwnProfile(userId);
  const photos = useOwnProfilePhotos(userId);
  const interests = useOwnInterests(userId);
  const discovery = useDiscoveryPreferences(userId);
  const genders = useGenderPreferences(userId);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const primary = useMemo(
    () => photos.data?.find((p) => p.is_primary) ?? photos.data?.[0] ?? null,
    [photos.data],
  );
  const p = profile.data;
  const age = p?.date_of_birth ? ageFromDateOfBirth(p.date_of_birth) : null;
  const home = [p?.home_city, p?.home_country].filter(Boolean).join(', ');
  const open = (section: 'basics' | 'interests' | 'preferences' | 'photos', path: string) => {
    analytics.track('profile_edit_opened', { section });
    router.push(path as never);
  };

  const preferenceSummary = (() => {
    if (!discovery.data) return null;
    // Empty is "not set" (onboarding requires at least one); every value is "Everyone".
    const who = !genders.data
      ? null
      : genders.data.length === 0
        ? 'Not set'
        : isEveryone(genders.data)
          ? 'Everyone'
          : genders.data
              .map((g) => GENDER_PREFERENCE_OPTIONS.find((o) => o.value === g)?.label ?? g)
              .join(', ');
    if (who === null) return null;
    return `${who} · ${discovery.data.min_age}–${discovery.data.max_age} · ${formatOverlapDays(discovery.data.minimum_overlap_days)} overlap`;
  })();

  return (
    <AppScreen scroll testID="profile-screen" contentStyle={styles.content}>
      <ProfileHeaderPhoto
        photo={primary}
        photoCount={photos.data?.length ?? 0}
        isLoading={photos.isLoading && !photos.data}
        onManage={() => open('photos', '/profile/photos')}
      />

      <View style={styles.identity}>
        {profile.isLoading && !p ? (
          <>
            <Skeleton width={180} height={32} />
            <Skeleton width={120} height={18} />
          </>
        ) : (
          <>
            <AppText variant="h1" testID="profile-name">
              {p?.first_name ?? 'Your name'}
              {age !== null ? (
                <AppText variant="h1" color="textSecondary">{`, ${age}`}</AppText>
              ) : null}
            </AppText>
            <AppText variant="body" color="textSecondary">
              {[genderLabel(p?.gender), p?.occupation, home].filter(Boolean).join(' · ') ||
                'Tell people a little about you'}
            </AppText>
          </>
        )}
      </View>

      {profile.isError ? (
        <InlineMessage
          tone="error"
          message="Couldn’t refresh your profile. Showing what we have."
        />
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="h3">About</AppText>
          <AppButton
            label="Edit"
            variant="secondary"
            onPress={() => open('basics', '/profile/edit')}
            testID="profile-edit"
          />
        </View>
        {p?.bio ? (
          <AppText variant="body">{p.bio}</AppText>
        ) : (
          <AppText variant="body" color="textSecondary">
            A few lines about how you travel go a long way.
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText variant="h3">Interests</AppText>
          <AppButton
            label={interests.data?.length ? 'Edit' : 'Add'}
            variant="secondary"
            onPress={() => open('interests', '/profile/interests')}
            testID="profile-interests"
          />
        </View>
        {interests.data && interests.data.length > 0 ? (
          <View style={styles.chips}>
            {interests.data.map((item) => (
              <AppChip
                key={item.interest_id}
                label={item.interest?.label ?? 'Interest'}
                selected
                onPress={() => open('interests', '/profile/interests')}
              />
            ))}
          </View>
        ) : (
          <AppText variant="body" color="textSecondary">
            Pick up to 10 things you love doing on a trip.
          </AppText>
        )}
      </View>

      <View style={styles.section}>
        <AppText variant="h3">Discovery</AppText>
        <ProfileRow
          label="Looking to meet"
          value={preferenceSummary}
          placeholder="Set your preferences"
          onPress={() => open('preferences', '/profile/preferences')}
          testID="profile-preferences"
        />
        <ProfileRow
          label="Photos"
          value={photos.data?.length ? `${photos.data.length} of 6` : null}
          placeholder="Add photos"
          onPress={() => open('photos', '/profile/photos')}
        />
      </View>

      <View style={styles.section}>
        <AppText variant="h3">Account</AppText>
        {signOutError ? <InlineMessage tone="error" message={signOutError} /> : null}
        <AppButton
          label="Sign out"
          variant="secondary"
          fullWidth
          loading={signingOut}
          onPress={async () => {
            setSignOutError(null);
            setSigningOut(true);
            try {
              await signOut();
            } catch {
              setSignOutError('Couldn’t sign out. Check your connection and try again.');
            } finally {
              setSigningOut(false);
            }
          }}
          testID="profile-sign-out"
        />
        <AppText variant="caption" color="textSecondary">
          Safety tools (block, report) and account deletion arrive with the next releases.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingBottom: spacing.xxl },
  identity: { gap: spacing.xxs },
  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
