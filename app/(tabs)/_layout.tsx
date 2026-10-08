import { Tabs } from 'expo-router';

import { colors, fontFamily } from '@/theme';

/**
 * Bottom tabs (Architecture v2 §6): Discover · Matches · Trips · Profile.
 * Each tab owns a nested Stack so detail screens push inside the tab and Android hardware back
 * pops within the tab before leaving it. The tab bar applies the bottom safe-area inset itself.
 *
 * Tab icons are deferred until the icon set is chosen (no icon dependency added in Phase 0M).
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 12 },
        tabBarIconStyle: { display: 'none' },
        tabBarLabelPosition: 'below-icon',
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="discover"
        options={{ title: 'Discover', tabBarButtonTestID: 'tab-discover' }}
      />
      <Tabs.Screen
        name="matches"
        options={{ title: 'Matches', tabBarButtonTestID: 'tab-matches' }}
      />
      <Tabs.Screen name="trips" options={{ title: 'Trips', tabBarButtonTestID: 'tab-trips' }} />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarButtonTestID: 'tab-profile' }}
      />
    </Tabs>
  );
}
