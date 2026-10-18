import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { useAnalytics } from '@/services/analytics';
import { spacing } from '@/theme';

import { resendSignUpCode, verifySignUpCode } from '../api/auth-api';
import { usePendingVerification } from '../state/pending-verification';

import { AuthHero } from './AuthHero';
import { EmailCodeForm } from './EmailCodeForm';

/**
 * Sign-up step 2: type the 6-digit code from the confirmation email. A successful verification
 * creates the session; the root guard then moves the user into onboarding. No deep link.
 */
export function VerifyEmailScreen() {
  const analytics = useAnalytics();
  const email = usePendingVerification((state) => state.email);
  const sentAt = usePendingVerification((state) => state.sentAt);
  const markSent = usePendingVerification((state) => state.markSent);
  const clear = usePendingVerification((state) => state.clear);
  const verified = useRef(false);

  // Forget the address once this screen goes away after a successful verification (clearing
  // earlier would re-render the "start again" state for a frame before the router moves on).
  useEffect(() => () => (verified.current ? clear() : undefined), [clear]);

  if (!email) {
    return (
      <AppScreen testID="verify-email-missing" edges={['top', 'left', 'right', 'bottom']}>
        <ScreenHeader />
        <View style={styles.missing}>
          <AppText variant="h2">Let’s try that again</AppText>
          <AppText variant="body" color="textSecondary">
            Sign in with your email and password and we’ll send you a new code.
          </AppText>
          <AppButton
            label="Sign in"
            fullWidth
            onPress={() => router.replace('/sign-in')}
            testID="verify-email-go-sign-in"
          />
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen
      scroll
      keyboardAware
      testID="verify-email-screen"
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader />
      <AuthHero compact />
      <AppText variant="h2">Check your email</AppText>
      <EmailCodeForm
        email={email}
        sentAt={sentAt}
        verify={async (code) => {
          await verifySignUpCode({ email, code, sentAt });
          verified.current = true;
          analytics.track('sign_up_code_verified', {});
        }}
        resend={async () => {
          await resendSignUpCode(email);
          markSent(Date.now());
          analytics.track('sign_up_code_resent', {});
        }}
        onChangeEmail={() => {
          clear();
          router.replace('/sign-up');
        }}
        testID="verify-email"
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  missing: { gap: spacing.lg, paddingTop: spacing.md },
});
