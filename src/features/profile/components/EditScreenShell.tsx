import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppScreen } from '@/components/layout/AppScreen';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { AppButton } from '@/components/ui/AppButton';
import { AppText } from '@/components/ui/AppText';
import { InlineMessage } from '@/components/ui/InlineMessage';
import { spacing } from '@/theme';

export interface EditScreenShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  saveLabel?: string;
  onSave?: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
  error?: string | null;
  success?: string | null;
  testID?: string;
}

/** Shared chrome for the profile edit screens: header, scrolling body, pinned save button. */
export function EditScreenShell({
  title,
  subtitle,
  children,
  saveLabel = 'Save',
  onSave,
  saving,
  saveDisabled,
  error,
  success,
  testID,
}: EditScreenShellProps) {
  return (
    <AppScreen
      keyboardAware
      testID={testID}
      contentStyle={styles.content}
      edges={['top', 'left', 'right', 'bottom']}
    >
      <ScreenHeader title={title} />
      <AppScreen.Scroll>
        {subtitle ? (
          <AppText variant="body" color="textSecondary">
            {subtitle}
          </AppText>
        ) : null}
        {children}
      </AppScreen.Scroll>
      {onSave ? (
        <View style={styles.footer}>
          {error ? (
            <InlineMessage
              tone="error"
              message={error}
              testID={testID ? `${testID}-error` : undefined}
            />
          ) : null}
          {success ? (
            <InlineMessage
              tone="success"
              message={success}
              testID={testID ? `${testID}-success` : undefined}
            />
          ) : null}
          <AppButton
            label={saveLabel}
            fullWidth
            onPress={onSave}
            loading={saving}
            disabled={saveDisabled}
            testID={testID ? `${testID}-save` : undefined}
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, gap: spacing.sm, paddingBottom: spacing.md },
  footer: { gap: spacing.sm },
});
