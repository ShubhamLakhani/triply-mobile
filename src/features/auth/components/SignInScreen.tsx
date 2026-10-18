import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { signInWithPassword } from '../api/auth-api';
import { AppAuthError } from '../api/auth-errors';
import { emailSchema } from '../schemas/auth.schema';
import { usePendingVerification } from '../state/pending-verification';

import { AuthHero } from './AuthHero';
import { AuthLinkNotice } from './AuthLinkNotice';
import { CredentialsForm } from './CredentialsForm';

export function SignInScreen() {
  const analytics = useAnalytics();
  const startVerification = usePendingVerification((state) => state.start);
  // Set when the account exists but its email was never confirmed: offer the code screen.
  const [unconfirmedEmail, setUnconfirmedEmail] = useState<string | null>(null);

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
          setUnconfirmedEmail(null);
          try {
            await signInWithPassword(values);
          } catch (error) {
            if (error instanceof AppAuthError && error.code === 'email_not_confirmed') {
              setUnconfirmedEmail(emailSchema.parse(values.email));
            }
            throw error;
          }
          analytics.track('sign_in_completed', { method: 'password' });
          // The root guard routes to onboarding or the app once the session lands.
        }}
      />
      {unconfirmedEmail ? (
        <AppButton
          label="Enter my code"
          variant="secondary"
          fullWidth
          onPress={() => {
            // The last code's age is unknown here, so a new one can be requested right away.
            startVerification(unconfirmedEmail, null);
            router.push('/verify-email');
          }}
          testID="sign-in-enter-code"
        />
      ) : null}
      <Link href="/forgot-password" accessibilityRole="link" testID="link-forgot-password">
        <AppText variant="small" color="primary" style={styles.link}>
          Forgot your password?
        </AppText>
      </Link>
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
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.xs },
  footer: { flexDirection: 'row', alignItems: 'center' },
  link: { fontFamily: 'Inter_600SemiBold' },
});
