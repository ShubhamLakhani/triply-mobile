import { Tabs } from 'expo-router';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colors, fontFamily } from '@/theme';

const TAB_ICONS: Record<string, IconName> = {
  discover: 'compass',
  matches: 'hearts',
  trips: 'suitcase',
  profile: 'person',
};

/**
 * Bottom tabs (Architecture v2 §6): Discover · Matches · Trips · Profile.
 * Each tab owns a nested Stack so detail screens push inside the tab and Android hardware back
 * pops within the tab before leaving it. The tab bar applies the bottom safe-area inset itself.
 */
export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fontFamily.semibold, fontSize: 11 },
        tabBarIcon: ({ color }) => (
          <Icon name={TAB_ICONS[route.name] ?? 'compass'} size={22} rawColor={String(color)} />
        ),
        sceneStyle: { backgroundColor: colors.background },
      })}
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
