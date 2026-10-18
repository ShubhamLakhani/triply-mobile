import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

export interface SurfaceProps {
  children: ReactNode;
  /** `tinted` uses the soft lavender brand surface; `plain` is white with a hairline border. */
  tone?: 'plain' | 'tinted' | 'warm';
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/** The one card-like container. Use sparingly: most content sits directly on the background. */
export function Surface({
  children,
  tone = 'plain',
  elevated = false,
  style,
  testID,
}: SurfaceProps) {
  return (
    <View
      testID={testID}
      style={[
        styles.base,
        tone === 'plain' && styles.plain,
        tone === 'tinted' && styles.tinted,
        tone === 'warm' && styles.warm,
        elevated && shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm },
  plain: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  tinted: { backgroundColor: colors.primarySubtle },
  warm: { backgroundColor: colors.warmSubtle },
});
