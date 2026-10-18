import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { Surface } from '@/components/ui/Surface';
import { colors, spacing } from '@/theme';

import type { AccountState } from '../types';

type RestrictedStatus = Exclude<AccountState['status'], 'active'>;

const COPY: Record<RestrictedStatus, { title: string; body: string }> = {
  suspended: {
    title: 'Your account is suspended',
    body: 'While it’s suspended you can’t use Triply’s features, and other travellers can’t see you.',
  },
  banned: {
    title: 'This account is no longer available',
    body: 'This account was closed because it didn’t follow Triply’s community guidelines.',
  },
  deletion_pending: {
    title: 'Your account is being deleted',
    body: 'We received a request to delete this account. Restoring it isn’t available in the app yet.',
  },
};

function formatDate(iso: string): string | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

export interface RestrictedAccountScreenProps {
  state: AccountState & { status: RestrictedStatus };
  onSignOut: () => void;
}

/**
 * Shown instead of the app for a signed-in account that is not active. Only sign-out is
 * offered; every product action is also rejected server-side (TR001), so this screen is UX,
 * not the enforcement. The internal safety hold never reaches here (it stays silent).
 */
export function RestrictedAccountScreen({ state, onSignOut }: RestrictedAccountScreenProps) {
  const copy = COPY[state.status];
  const until =
    state.status === 'suspended' && state.suspended_until
      ? formatDate(state.suspended_until)
      : null;
  return (
    <View style={styles.root} testID="restricted-account-screen">
      <AppText variant="h1" color="primary">
        Triply
      </AppText>
      <View style={styles.body} testID={`restricted-status-${state.status}`}>
        <AppText variant="h3" align="center">
          {copy.title}
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          {copy.body}
        </AppText>
        {until ? (
          <AppText variant="bodyStrong" align="center" testID="restricted-until">
            Suspended until {until}
          </AppText>
        ) : null}
        <Surface tone="tinted">
          <AppText variant="small" color="textSecondary">
            If you think this is a mistake, contact Triply support. A way to reach support from the
            app is coming soon.
          </AppText>
        </Surface>
      </View>
      <AppButton
        label="Sign out"
        variant="secondary"
        onPress={onSignOut}
        testID="restricted-sign-out"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  body: { gap: spacing.md, alignItems: 'stretch', maxWidth: 420 },
});
