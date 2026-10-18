import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppText } from '@/components/ui/AppText';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { signInWithPassword } from '../api/auth-api';

import { AuthHero } from './AuthHero';
import { AuthLinkNotice } from './AuthLinkNotice';
import { CredentialsForm } from './CredentialsForm';

export function SignInScreen() {
  const analytics = useAnalytics();
  return (
    <AppScreen
      scroll
      keyboardAware
      testID="sign-in-screen"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader />
      <AuthHero compact />
      <View style={styles.heading}>
        <AppText variant="h2">Welcome back</AppText>
        <AppText variant="body" color="textSecondary">
          Sign in to pick up where you left off.
        </AppText>
      </View>
      <AuthLinkNotice />
      <CredentialsForm
        mode="sign-in"
        onSubmit={async (values) => {
          await signInWithPassword(values);
          analytics.track('sign_in_completed', { method: 'password' });
          // The root guard routes to onboarding or the app once the session lands.
        }}
      />
      <View style={styles.footer}>
        <AppText variant="small" color="textSecondary">
          New here?{' '}
        </AppText>
        <Link href="/sign-up" replace accessibilityRole="link" testID="link-sign-up">
          <AppText variant="small" color="primary" style={styles.link}>
            Create an account
          </AppText>
        </Link>
      </View>
      <AppText variant="caption" color="textSecondary">
        Forgot your password? Password reset arrives in a later release; for now, contact support.
      </AppText>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center' },
  link: { fontFamily: 'Inter_600SemiBold' },
});
