import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { LoadingState } from '@/components/feedback/LoadingState';
import { PlaceholderScreen } from '@/components/layout/PlaceholderScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme';

/**
 * Profile placeholder. Also hosts Phase 0M foundation checks used during native verification:
 * pushing routes from another group (navigation + Android back) and the Reanimated indicator.
 */
export default function ProfileScreen() {
  return (
    <PlaceholderScreen
      testID="profile-screen"
      title="Profile"
      description="Your profile, preferences, Safety Center and account settings."
      plannedPhase="Phase 2M"
    >
      <View style={styles.section}>
        <AppText variant="h3">Foundation checks</AppText>
        <AppButton
          label="Open sign-in placeholder"
          variant="secondary"
          fullWidth
          testID="open-sign-in"
          onPress={() => router.push('/sign-in')}
        />
        <AppButton
          label="Open onboarding placeholder"
          variant="secondary"
          fullWidth
          testID="open-onboarding"
          onPress={() => router.push('/start')}
        />
        <LoadingState label="Reanimated check" testID="reanimated-check" />
      </View>
    </PlaceholderScreen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
