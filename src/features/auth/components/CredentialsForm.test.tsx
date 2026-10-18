import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { getSupabaseClient } from '@/services/supabase';

import { AUTH_REQUEST_TIMEOUT_MS, signInWithPassword, signUpWithPassword } from '../api/auth-api';

import { CredentialsForm } from './CredentialsForm';

jest.mock('@/services/supabase', () => ({ getSupabaseClient: jest.fn() }));
jest.mock('expo-linking', () => ({ createURL: (path: string) => `triply-dev://${path}` }));

function useAuthClient(auth: Record<string, jest.Mock>) {
  jest.mocked(getSupabaseClient).mockReturnValue({ auth } as never);
}

async function fillAndSubmit(email: string, password: string) {
  await fireEvent.changeText(screen.getByTestId('auth-email'), email);
  await fireEvent.changeText(screen.getByTestId('auth-password'), password);
  await fireEvent.press(screen.getByTestId('auth-submit'));
}

const isBusy = () => screen.getByTestId('auth-submit').props.accessibilityState.busy as boolean;

describe('CredentialsForm (real auth API, mocked Supabase)', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('leaves the loading state with a friendly message when sign-up never answers', async () => {
    jest.useFakeTimers();
    useAuthClient({ signUp: jest.fn(() => new Promise(() => undefined)) });
    await render(
      <CredentialsForm
        mode="sign-up"
        onSubmit={async (values) => {
          await signUpWithPassword(values);
        }}
      />,
    );
    await fillAndSubmit('maya@example.com', 'password123');
    expect(isBusy()).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(AUTH_REQUEST_TIMEOUT_MS);
    });
    expect(isBusy()).toBe(false);
    expect(screen.getByTestId('auth-error')).toHaveTextContent(
      'This is taking longer than it should. Check your connection and try again.',
    );
  });

  it('shows the mapped message (never raw provider text) when sign-in is rejected', async () => {
    useAuthClient({
      signInWithPassword: jest.fn().mockResolvedValue({
        data: { session: null },
        error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
      }),
    });
    await render(
      <CredentialsForm
        mode="sign-in"
        onSubmit={async (values) => {
          await signInWithPassword(values);
        }}
      />,
    );
    await fillAndSubmit('maya@example.com', 'password123');
    expect(await screen.findByTestId('auth-error')).toHaveTextContent(
      'That email and password don’t match.',
    );
    expect(isBusy()).toBe(false);
  });

  it('never asks iOS to generate a strong password the user cannot see', async () => {
    await render(<CredentialsForm mode="sign-up" onSubmit={jest.fn()} />);
    const password = screen.getByTestId('auth-password');
    expect(password.props.textContentType).toBe('password');
    // Android autofill still knows it is a new password.
    expect(password.props.autoComplete).toBe('new-password');
  });

  it('validates on the device before any request is sent', async () => {
    const signUp = jest.fn();
    useAuthClient({ signUp });
    await render(
      <CredentialsForm
        mode="sign-up"
        onSubmit={async (values) => {
          await signUpWithPassword(values);
        }}
      />,
    );
    await fillAndSubmit('not-an-email', 'short');
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(screen.getByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(signUp).not.toHaveBeenCalled();
  });
});
