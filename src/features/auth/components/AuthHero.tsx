import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, radius, spacing } from '@/theme';

/**
 * Brand mark + tagline used across the auth entry screens. Three soft "stamp" tiles stand in
 * for destination imagery until the visual identity assets land.
 */
export function AuthHero({ compact = false }: { compact?: boolean }) {
  const { reduceMotion, duration } = useMotionPreference();
  const entering = (delay: number) =>
    reduceMotion ? undefined : FadeInDown.duration(duration('brand')).delay(delay);
  return (
    <View style={styles.root}>
      {compact ? null : (
        <View
          style={styles.stamps}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Animated.View entering={entering(0)} style={[styles.stamp, styles.stampA]} />
          <Animated.View entering={entering(80)} style={[styles.stamp, styles.stampB]} />
          <Animated.View entering={entering(160)} style={[styles.stamp, styles.stampC]} />
        </View>
      )}
      <Animated.View entering={entering(compact ? 0 : 240)} style={styles.wordmark}>
        <AppText variant={compact ? 'h3' : 'display'} color="primary" accessibilityRole="header">
          Triply
        </AppText>
        {compact ? null : (
          <AppText variant="body" color="textSecondary">
            Meet people who’ll be where you’re going.
          </AppText>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  stamps: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm, height: 164 },
  stamp: { flex: 1, borderRadius: radius.lg },
  stampA: { height: 120, backgroundColor: colors.primarySubtle },
  stampB: { height: 164, backgroundColor: colors.accentSubtle },
  stampC: { height: 96, backgroundColor: colors.warmSubtle },
  wordmark: { gap: spacing.xs },
});
