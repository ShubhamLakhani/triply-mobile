import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { resolveDuration, type MotionDurationToken } from '@/theme';

/**
 * Tracks the OS "reduce motion" setting (iOS Reduce Motion / Android "Remove animations") and
 * updates live when the user changes it. Animations should use `duration()` so they resolve
 * instantly when reduced motion is on.
 */
export function useMotionPreference() {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return {
    reduceMotion,
    duration: (token: MotionDurationToken) => resolveDuration(token, reduceMotion),
  };
}
