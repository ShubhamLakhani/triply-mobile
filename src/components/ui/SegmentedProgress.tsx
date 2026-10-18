import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, radius, spacing } from '@/theme';

export interface SegmentedProgressProps {
  total: number;
  /** Zero-based index of the current step. */
  current: number;
  accessibilityLabel?: string;
}

function Segment({ fill, duration }: { fill: number; duration: number }) {
  const width = useSharedValue(fill);
  useEffect(() => {
    width.value = withTiming(fill, { duration });
  }, [fill, duration, width]);
  const animated = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));
  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, animated]} />
    </View>
  );
}

/** Step progress as equal segments; the current segment fills, previous ones are full. */
export function SegmentedProgress({ total, current, accessibilityLabel }: SegmentedProgressProps) {
  const { duration } = useMotionPreference();
  return (
    <View
      style={styles.row}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel ?? `Step ${current + 1} of ${total}`}
      accessibilityValue={{ min: 0, max: total, now: current + 1 }}
    >
      {Array.from({ length: total }, (_, index) => (
        <Segment
          key={index}
          fill={index < current ? 1 : index === current ? 1 : 0}
          duration={duration('standard')}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs },
  track: {
    flex: 1,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.full, backgroundColor: colors.primary },
});
