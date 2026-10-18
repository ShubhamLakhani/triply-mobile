import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import { AppText } from '@/components/ui/AppText';
import { useAuthSession } from '@/features/auth/hooks/use-auth-session';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';

import { OnboardingShell } from './OnboardingShell';

jest.mock('@/features/auth/hooks/use-auth-session', () => ({ useAuthSession: jest.fn() }));
jest.mock('expo-router', () => ({ router: { back: jest.fn(), canGoBack: () => false } }));
jest.mock('@/services/storage/local-storage', () => ({
  getDeviceLocalStorage: () => ({ getItem: () => null, setItem: jest.fn(), removeItem: jest.fn() }),
}));

function mockSession(signOut: jest.Mock) {
  jest.mocked(useAuthSession).mockReturnValue({
    session: null,
    userId: 'u1',
    isAuthenticated: true,
    isLoading: false,
    isInitializing: false,
    restoreError: null,
    retryRestore: jest.fn(),
    signOut,
  });
}

/** Captures the hardware-back listener the shell registers. */
function captureBackHandler() {
  type Listener = Parameters<typeof BackHandler.addEventListener>[1];
  const handlers: Listener[] = [];
  const remove = jest.fn();
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event, handler) => {
    handlers.push(handler);
    return { remove };
  });
  return { press: () => handlers[handlers.length - 1]?.({} as never), remove };
}

async function renderShell(props: { onBack: (() => void) | false; step?: 'profile' | 'photos' }) {
  const { wrapper } = createTestProviders();
  return render(
    <OnboardingShell
      step={props.step ?? 'photos'}
      title="Step"
      primaryLabel="Continue"
      onPrimary={jest.fn()}
      onBack={props.onBack}
      testID="shell"
    >
      <AppText>Body</AppText>
    </OnboardingShell>,
    { wrapper },
  );
}

describe('OnboardingShell recovery paths', () => {
  afterEach(() => jest.restoreAllMocks());

  it('offers sign-out on every step so nobody is trapped', async () => {
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockSession(signOut);
    captureBackHandler();
    await renderShell({ onBack: false, step: 'profile' });
    await fireEvent.press(screen.getByTestId('onboarding-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('shows a calm error if sign-out fails, and lets the user try again', async () => {
    const signOut = jest.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    mockSession(signOut);
    captureBackHandler();
    await renderShell({ onBack: false, step: 'profile' });
    await fireEvent.press(screen.getByTestId('onboarding-sign-out'));
    expect(await screen.findByTestId('shell-error')).toHaveTextContent(/Couldn’t sign out/);
    await fireEvent.press(screen.getByTestId('onboarding-sign-out'));
    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it('Android back on a middle step goes to the previous step instead of leaving the app', async () => {
    mockSession(jest.fn());
    const back = captureBackHandler();
    const onBack = jest.fn();
    await renderShell({ onBack });
    expect(back.press()).toBe(true);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Android back on the first step keeps the platform default', async () => {
    mockSession(jest.fn());
    const back = captureBackHandler();
    const { unmount } = await renderShell({ onBack: false, step: 'profile' });
    expect(back.press()).toBe(false);
    await unmount();
    expect(back.remove).toHaveBeenCalled();
  });
});
