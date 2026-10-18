import { StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { spacing } from '@/theme';

export interface RetryNoticeProps {
  message: string;
  onRetry: () => void;
  retrying?: boolean;
  testID?: string;
}

/** Inline "couldn't load" state with a retry action, for content inside a screen. */
export function RetryNotice({ message, onRetry, retrying, testID }: RetryNoticeProps) {
  return (
    <View style={styles.root} testID={testID}>
      <InlineMessage tone="error" message={message} />
      <AppButton
        label="Try again"
        variant="secondary"
        onPress={onRetry}
        loading={retrying}
        testID={testID ? `${testID}-retry` : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
});
