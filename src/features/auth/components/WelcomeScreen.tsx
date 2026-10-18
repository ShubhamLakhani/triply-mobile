import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { spacing } from '@/theme';

import { AuthHero } from './AuthHero';
import { AuthLinkNotice } from './AuthLinkNotice';

export function WelcomeScreen() {
  return (
    <AppScreen
      testID="welcome-screen"
      edges={['top', 'left', 'right', 'bottom']}
      contentStyle={styles.content}
    >
      <View style={styles.hero}>
        <AuthHero />
      </View>
      <View style={styles.actions}>
        <AuthLinkNotice />
        <AppButton
          label="Create account"
          fullWidth
          onPress={() => router.push('/sign-up')}
          testID="welcome-sign-up"
        />
        <AppButton
          label="I already have an account"
          variant="secondary"
          fullWidth
          onPress={() => router.push('/sign-in')}
          testID="welcome-sign-in"
        />
        <AppText variant="caption" color="textSecondary" align="center">
          Triply is for adults 18 and over. By continuing you agree to keep things kind and safe.
        </AppText>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'space-between', paddingTop: spacing.xxl },
  hero: { flex: 1, justifyContent: 'center' },
  actions: { gap: spacing.sm },
});
