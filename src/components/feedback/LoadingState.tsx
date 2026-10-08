import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/ui/AppText';
import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, radius, spacing } from '@/theme';

export interface LoadingStateProps {
  label?: string;
  testID?: string;
}

/**
 * Calm loading indicator. Uses a subtle Reanimated opacity pulse (proves the Reanimated/worklets
 * setup on both platforms) and renders static when the user prefers reduced motion.
 */
export function LoadingState({ label = 'Loading', testID }: LoadingStateProps) {
  const { reduceMotion, duration } = useMotionPreference();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 1;
      return undefined;
    }
    opacity.value = withRepeat(withTiming(0.35, { duration: duration('brand') }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, duration, opacity]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <View
      style={styles.container}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityLiveRegion="polite"
      testID={testID}
    >
      <Animated.View style={[styles.dot, dotStyle]} />
      <AppText variant="small" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
  },
  dot: { width: 16, height: 16, borderRadius: radius.full, backgroundColor: colors.primary },
});
