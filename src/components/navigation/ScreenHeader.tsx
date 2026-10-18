import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { IconButton } from '@/components/ui/IconButton';
import { MIN_TOUCH_TARGET, spacing } from '@/theme';

export interface ScreenHeaderProps {
  title?: string;
  /** Shows a back chevron; defaults to router.back(). */
  onBack?: (() => void) | false;
  right?: ReactNode;
  testID?: string;
}

/** Compact header row: back · centred title · optional trailing action. */
export function ScreenHeader({ title, onBack, right, testID }: ScreenHeaderProps) {
  const showBack = onBack !== false;
  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.side}>
        {showBack ? (
          <IconButton
            icon="chevron-left"
            accessibilityLabel="Back"
            onPress={onBack ?? (() => (router.canGoBack() ? router.back() : undefined))}
            testID={testID ? `${testID}-back` : 'header-back'}
          />
        ) : null}
      </View>
      {title ? (
        <AppText variant="bodyStrong" align="center" style={styles.title} numberOfLines={1}>
          {title}
        </AppText>
      ) : (
        <View style={styles.title} />
      )}
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    marginHorizontal: -spacing.xs,
  },
  side: { width: MIN_TOUCH_TARGET + spacing.md, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1 },
});
