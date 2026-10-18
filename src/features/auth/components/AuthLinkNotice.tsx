import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { spacing } from '@/theme';

import { useAuth } from '../providers/AuthProvider';

/**
 * Shows the latest failed confirmation link (expired, already used, opened on another device)
 * on the signed-out screens, so a user is never dropped at Welcome without an explanation.
 * The copy is the fixed AppAuthError sentence; raw provider text is never shown.
 */
export function AuthLinkNotice() {
  const { linkError, dismissLinkError } = useAuth();
  if (!linkError) return null;
  return (
    <View style={styles.root}>
      <InlineMessage
        tone="error"
        title="That link didn’t work"
        message={linkError.message}
        testID="auth-link-error"
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss link message"
        onPress={dismissLinkError}
        hitSlop={12}
        style={styles.dismiss}
        testID="auth-link-error-dismiss"
      >
        <AppText variant="small" color="primary">
          Dismiss
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  dismiss: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
});
