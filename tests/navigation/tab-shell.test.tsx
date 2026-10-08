import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import SignInPlaceholder from '../../app/(auth)/sign-in';
import OnboardingStartPlaceholder from '../../app/(onboarding)/start';
import TabsLayout from '../../app/(tabs)/_layout';
import DiscoverScreen from '../../app/(tabs)/discover/index';
import MatchesScreen from '../../app/(tabs)/matches/index';
import ProfileScreen from '../../app/(tabs)/profile/index';
import TripsScreen from '../../app/(tabs)/trips/index';
import Index from '../../app/index';
import AuthLayout from '../../app/(auth)/_layout';
import OnboardingLayout from '../../app/(onboarding)/_layout';
import TabStackLayout from '../../app/(tabs)/discover/_layout';

/** Mirrors app/_layout.tsx's navigator without fonts/env/providers (covered by other tests). */
function RootStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

/** Uses the real route components with Expo Router's in-memory test harness. */
const routes = {
  _layout: RootStack,
  index: Index,
  '(auth)/_layout': AuthLayout,
  '(auth)/sign-in': SignInPlaceholder,
  '(onboarding)/_layout': OnboardingLayout,
  '(onboarding)/start': OnboardingStartPlaceholder,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/discover/_layout': TabStackLayout,
  '(tabs)/discover/index': DiscoverScreen,
  '(tabs)/matches/_layout': TabStackLayout,
  '(tabs)/matches/index': MatchesScreen,
  '(tabs)/trips/_layout': TabStackLayout,
  '(tabs)/trips/index': TripsScreen,
  '(tabs)/profile/_layout': TabStackLayout,
  '(tabs)/profile/index': ProfileScreen,
};

describe('tab shell navigation', () => {
  it('redirects the entry route to Discover', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });
    await router;
    expect(await screen.findByTestId('discover-screen')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/discover');
  });

  it('switches between the four tabs', async () => {
    const router = renderRouter(routes, { initialUrl: '/discover' });
    await router;

    for (const [tab, screenId, path] of [
      ['tab-matches', 'matches-screen', '/matches'],
      ['tab-trips', 'trips-screen', '/trips'],
      ['tab-profile', 'profile-screen', '/profile'],
      ['tab-discover', 'discover-screen', '/discover'],
    ] as const) {
      await fireEvent.press(screen.getByTestId(tab));
      expect(await screen.findByTestId(screenId)).toBeOnTheScreen();
      expect(router.getPathname()).toBe(path);
    }
  });

  it('pushes auth and onboarding placeholders and navigates back', async () => {
    const router = renderRouter(routes, { initialUrl: '/' });
    await router;
    await fireEvent.press(await screen.findByTestId('tab-profile'));
    expect(await screen.findByTestId('profile-screen')).toBeOnTheScreen();

    await fireEvent.press(await screen.findByTestId('open-sign-in'));
    expect(await screen.findByTestId('sign-in-placeholder')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/sign-in');

    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(router.getPathname()).toBe('/profile');

    await fireEvent.press(screen.getByTestId('open-onboarding'));
    expect(await screen.findByTestId('onboarding-placeholder')).toBeOnTheScreen();
    expect(router.getPathname()).toBe('/start');
  });
});
