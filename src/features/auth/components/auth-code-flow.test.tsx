import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { createTestProviders } from '../../../../tests/utils/render-with-providers';
import {
  requestPasswordReset,
  resendSignUpCode,
  signInWithPassword,
  signUpWithPassword,
  updatePassword,
  verifyRecoveryCode,
  verifySignUpCode,
} from '../api/auth-api';
import { authError } from '../api/auth-errors';
import { CODE_RESEND_COOLDOWN_S, cooldownSecondsLeft } from '../hooks/use-resend-cooldown';
import { useAuth } from '../providers/AuthProvider';
import { usePendingVerification } from '../state/pending-verification';

import { ForgotPasswordScreen } from './ForgotPasswordScreen';
import { SignInScreen } from './SignInScreen';
import { SignUpScreen } from './SignUpScreen';
import { VerifyEmailScreen } from './VerifyEmailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => true },
  Link: ({ children }: { children: unknown }) => children,
}));
jest.mock('../api/auth-api', () => ({
  requestPasswordReset: jest.fn(),
  resendSignUpCode: jest.fn(),
  signInWithPassword: jest.fn(),
  signUpWithPassword: jest.fn(),
  updatePassword: jest.fn(),
  verifyRecoveryCode: jest.fn(),
  verifySignUpCode: jest.fn(),
}));
jest.mock('../providers/AuthProvider', () => ({ useAuth: jest.fn() }));

const EMAIL = 'maya@example.com';

function mockAuth(overrides: Partial<ReturnType<typeof useAuth>> = {}) {
  const value = {
    passwordRecovery: false,
    finishPasswordRecovery: jest.fn(),
    signOut: jest.fn().mockResolvedValue(undefined),
    linkError: null,
    dismissLinkError: jest.fn(),
    ...overrides,
  };
  jest.mocked(useAuth).mockReturnValue(value as unknown as ReturnType<typeof useAuth>);
  return value;
}

describe('resend cooldown', () => {
  it('counts down from 60 s after a send and is 0 when the send time is unknown', () => {
    const sentAt = 1_000_000;
    expect(cooldownSecondsLeft(sentAt, sentAt)).toBe(CODE_RESEND_COOLDOWN_S);
    expect(cooldownSecondsLeft(sentAt, sentAt + 59_001)).toBe(1);
    expect(cooldownSecondsLeft(sentAt, sentAt + 60_000)).toBe(0);
    expect(cooldownSecondsLeft(null)).toBe(0);
  });
});

describe('VerifyEmailScreen (sign-up code)', () => {
  beforeEach(() => mockAuth());
  afterEach(async () => {
    // Still mounted here (RNTL unmounts afterwards): the store update must be inside act.
    await act(async () => usePendingVerification.getState().clear());
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  it('without a pending sign-up, offers sign-in instead of a dead end', async () => {
    const { wrapper } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    expect(screen.getByTestId('verify-email-missing')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('verify-email-go-sign-in'));
    expect(router.replace).toHaveBeenCalledWith('/sign-in');
  });

  it('the sixth digit submits; a pasted "123 456" is cleaned up', async () => {
    const sentAt = Date.now();
    usePendingVerification.getState().start(EMAIL, sentAt);
    jest.mocked(verifySignUpCode).mockResolvedValue({} as never);
    const { wrapper, transport } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    expect(screen.getByTestId('verify-email-email')).toHaveTextContent(EMAIL);
    await fireEvent.changeText(screen.getByTestId('verify-email-code'), '123 456');
    await waitFor(() =>
      expect(verifySignUpCode).toHaveBeenCalledWith({ email: EMAIL, code: '123456', sentAt }),
    );
    expect(transport.capture).toHaveBeenCalledWith('sign_up_code_verified', {});
  });

  it.each([
    ['code_invalid', /isn’t right/],
    ['code_expired', /has expired/],
    ['rate_limited', /Too many attempts/],
    ['timeout', /taking longer than it should/],
    ['network', /offline/],
  ] as const)('a %s failure settles with a fixed message', async (code, message) => {
    usePendingVerification.getState().start(EMAIL, Date.now());
    jest.mocked(verifySignUpCode).mockRejectedValue(authError(code));
    const { wrapper } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    await fireEvent.changeText(screen.getByTestId('verify-email-code'), '000000');
    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(message);
    // Never a spinner forever: the input is editable again.
    expect(screen.getByTestId('verify-email-code').props.editable).toBe(true);
    if (code === 'code_invalid' || code === 'code_expired') {
      expect(screen.getByTestId('verify-email-code').props.value).toBe('');
    }
  });

  it('resend waits for the cooldown, then sends a new code and restarts it', async () => {
    jest.useFakeTimers();
    usePendingVerification.getState().start(EMAIL, Date.now());
    jest.mocked(resendSignUpCode).mockResolvedValue(undefined);
    const { wrapper, transport } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    const resend = () => screen.getByTestId('verify-email-resend');
    expect(resend()).toHaveTextContent('Resend code in 1:00');
    expect(resend().props.accessibilityState.disabled).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(CODE_RESEND_COOLDOWN_S * 1000);
    });
    expect(resend()).toHaveTextContent('Resend code');
    expect(resend().props.accessibilityState.disabled).toBe(false);

    await fireEvent.press(resend());
    await waitFor(() => expect(resendSignUpCode).toHaveBeenCalledWith(EMAIL));
    expect(await screen.findByTestId('verify-email-notice')).toHaveTextContent(/new code/);
    expect(transport.capture).toHaveBeenCalledWith('sign_up_code_resent', {});
    expect(resend().props.accessibilityState.disabled).toBe(true);
  });

  it('a rate-limited resend explains itself', async () => {
    usePendingVerification.getState().start(EMAIL, null);
    jest.mocked(resendSignUpCode).mockRejectedValue(authError('rate_limited'));
    const { wrapper } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    await fireEvent.press(screen.getByTestId('verify-email-resend'));
    expect(await screen.findByTestId('verify-email-error')).toHaveTextContent(/Too many attempts/);
  });

  it('"Use a different email" forgets the pending address and returns to sign-up', async () => {
    usePendingVerification.getState().start(EMAIL, Date.now());
    const { wrapper } = createTestProviders();
    await render(<VerifyEmailScreen />, { wrapper });
    await fireEvent.press(screen.getByTestId('verify-email-change-email'));
    expect(usePendingVerification.getState().email).toBeNull();
    expect(router.replace).toHaveBeenCalledWith('/sign-up');
  });
});

describe('sign-up and sign-in hand off to the code screen', () => {
  beforeEach(() => mockAuth());
  afterEach(async () => {
    await act(async () => usePendingVerification.getState().clear());
    jest.clearAllMocks();
  });

  it('sign-up stores the address in memory (not a route param) and opens the code screen', async () => {
    jest
      .mocked(signUpWithPassword)
      .mockResolvedValue({ needsEmailConfirmation: true, session: null });
    const { wrapper } = createTestProviders();
    await render(<SignUpScreen />, { wrapper });
    await fireEvent.changeText(screen.getByTestId('auth-email'), ' Maya@Example.com ');
    await fireEvent.changeText(screen.getByTestId('auth-password'), 'password123');
    await fireEvent.press(screen.getByTestId('auth-submit'));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith('/verify-email'));
    expect(usePendingVerification.getState().email).toBe(EMAIL);
    expect(usePendingVerification.getState().sentAt).not.toBeNull();
  });

  it('signing in with an unconfirmed email offers the code screen', async () => {
    jest.mocked(signInWithPassword).mockRejectedValue(authError('email_not_confirmed'));
    const { wrapper } = createTestProviders();
    await render(<SignInScreen />, { wrapper });
    await fireEvent.changeText(screen.getByTestId('auth-email'), EMAIL);
    await fireEvent.changeText(screen.getByTestId('auth-password'), 'password123');
    await fireEvent.press(screen.getByTestId('auth-submit'));
    expect(await screen.findByTestId('auth-error')).toHaveTextContent(/6-digit code/);
    await fireEvent.press(screen.getByTestId('sign-in-enter-code'));
    expect(usePendingVerification.getState()).toMatchObject({ email: EMAIL, sentAt: null });
    expect(router.push).toHaveBeenCalledWith('/verify-email');
  });
});

describe('ForgotPasswordScreen', () => {
  afterEach(() => jest.clearAllMocks());

  it('requests a code, verifies it and never reveals whether the email exists', async () => {
    mockAuth();
    jest.mocked(requestPasswordReset).mockResolvedValue(undefined);
    jest.mocked(verifyRecoveryCode).mockRejectedValueOnce(authError('code_invalid'));
    const { wrapper, transport } = createTestProviders();
    await render(<ForgotPasswordScreen />, { wrapper });
    expect(screen.getByTestId('reset-email-screen')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('reset-email'), 'not-an-email');
    await fireEvent.press(screen.getByTestId('reset-request-submit'));
    expect(await screen.findByText('Enter a valid email address.')).toBeOnTheScreen();
    expect(requestPasswordReset).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('reset-email'), EMAIL);
    await fireEvent.press(screen.getByTestId('reset-request-submit'));
    expect(await screen.findByTestId('reset-code-screen')).toBeOnTheScreen();
    expect(requestPasswordReset).toHaveBeenCalledWith(EMAIL);
    expect(transport.capture).toHaveBeenCalledWith('password_reset_requested', {});
    expect(screen.getByText(/If an account exists/)).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('reset-code-code'), '111111');
    expect(await screen.findByTestId('reset-code-error')).toHaveTextContent(/isn’t right/);
    expect(verifyRecoveryCode).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, code: '111111' }),
    );
  });

  it('after a verified code: validates, saves the new password and ends the hold', async () => {
    const auth = mockAuth({ passwordRecovery: true });
    jest
      .mocked(updatePassword)
      .mockRejectedValueOnce(authError('same_password'))
      .mockResolvedValueOnce(undefined);
    const { wrapper, transport } = createTestProviders();
    await render(<ForgotPasswordScreen />, { wrapper });
    expect(screen.getByTestId('reset-password-screen')).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId('reset-new-password'), 'short');
    await fireEvent.changeText(screen.getByTestId('reset-confirm-password'), 'different');
    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    expect(await screen.findByText('Use at least 8 characters.')).toBeOnTheScreen();
    expect(screen.getByText('Passwords don’t match.')).toBeOnTheScreen();
    expect(updatePassword).not.toHaveBeenCalled();

    await fireEvent.changeText(screen.getByTestId('reset-new-password'), 'a-new-password');
    await fireEvent.changeText(screen.getByTestId('reset-confirm-password'), 'a-new-password');
    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    expect(await screen.findByTestId('reset-password-error')).toHaveTextContent(
      /haven’t used for this account/,
    );
    expect(auth.finishPasswordRecovery).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('reset-password-submit'));
    await waitFor(() => expect(auth.finishPasswordRecovery).toHaveBeenCalledTimes(1));
    expect(updatePassword).toHaveBeenLastCalledWith('a-new-password');
    expect(transport.capture).toHaveBeenCalledWith('password_reset_completed', {});
  });

  it('cancelling a verified recovery signs out', async () => {
    const auth = mockAuth({ passwordRecovery: true });
    const { wrapper } = createTestProviders();
    await render(<ForgotPasswordScreen />, { wrapper });
    await fireEvent.press(screen.getByTestId('reset-cancel'));
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });
});
