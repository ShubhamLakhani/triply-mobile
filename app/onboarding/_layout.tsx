import { Stack } from 'expo-router';

import { colors } from '@/theme';

/** Steps replace each other (no stack growth), so Android back is handled by each step. */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'fade',
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
