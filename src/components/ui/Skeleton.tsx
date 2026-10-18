import { useEffect } from 'react';
import { StyleSheet, type DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useMotionPreference } from '@/hooks/use-motion-preference';
import { colors, radius } from '@/theme';

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  round?: boolean;
}

/** Quiet loading placeholder; static when reduced motion is on. */
export function Skeleton({ width = '100%', height = 16, round = false }: SkeletonProps) {
  const { reduceMotion, duration } = useMotionPreference();
  const opacity = useSharedValue(0.6);
  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.6;
      return undefined;
    }
    opacity.value = withRepeat(withTiming(1, { duration: duration('brand') }), -1, true);
    return () => cancelAnimation(opacity);
  }, [reduceMotion, duration, opacity]);
  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.base,
        { width, height, borderRadius: round ? radius.full : radius.sm },
        animated,
      ]}
    />
  );
}

const styles = StyleSheet.create({ base: { backgroundColor: colors.border } });
