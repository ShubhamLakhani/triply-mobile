# features/auth

Session, sign-in/up and the root routing guard.

- `providers/AuthProvider.tsx`: the app's **single** auth subscription. Exposes
  `session`, `user`, `userId`, `isAuthenticated`, `isInitializing`, `restoreError` /
  `retryRestore`, `linkError` / `dismissLinkError`, `passwordRecovery` /
  `finishPasswordRecovery`, `signOut`; clears the query cache on sign-out or account switch
  (`createAuthCacheReset`); identifies analytics with the opaque user id; still completes old
  email-confirmation deep links (`auth-links.ts`, deprecated) once the stored session is known.
- `hooks/use-auth-session.ts`: reads the provider (no per-screen subscriptions).
- `api/auth-api.ts`: `signInWithPassword`, `signUpWithPassword` (returns
  `needsEmailConfirmation`), `verifySignUpCode`, `resendSignUpCode`, `requestPasswordReset`,
  `verifyRecoveryCode`, `updatePassword`, `signOut`, `getCurrentSession`,
  `subscribeToAuthChanges`. Every call runs under `AUTH_REQUEST_TIMEOUT_MS` (20 s) and settles
  with an `AppAuthError`; the transport also aborts stalled sockets
  (`services/supabase/timeout-fetch.ts`) and refreshes stale connections before writes.
- `api/auth-errors.ts`: `AppAuthError` with stable codes (`invalid_credentials`,
  `email_not_confirmed`, `email_taken`, `weak_password`, `same_password`, `rate_limited`,
  `invalid_input`, `email_undeliverable`, `signup_disabled`, `network`, `timeout`,
  `code_invalid`, `code_expired`, `link_expired`, `link_invalid`, `unknown`) and fixed,
  user-safe messages. Raw provider text is never shown. `toCodeError` tells a wrong code from an
  expired one by the time since it was sent (Supabase answers both with `otp_expired`).
- `api/auth-links.ts`: **deprecated** strict deep-link handling for old confirmation links
  (PKCE only, see below). Remove after one release.
- `state/pending-verification.ts`: the email waiting for its sign-up code (memory only, never a
  route param). `hooks/use-resend-cooldown.ts`: the 60 s resend countdown.
- `routing/resolve-area.ts` + `routing/use-app-area.ts`: pure decision
  `bootstrap | auth | onboarding | app | restricted | error` from the session, the account
  state (`features/account`) and the persisted profile row, with the reason for `error`
  (`session` restore failed, `account` / `profile` failed, device `offline`).
- `components/`: `WelcomeScreen`, `SignInScreen` (forgot password, "Enter my code" for an
  unconfirmed email), `SignUpScreen`, `VerifyEmailScreen`, `ForgotPasswordScreen`,
  `EmailCodeForm` + `CodeInput` (shared 6-digit entry), `AuthLinkNotice` (failed-link message),
  `BootstrapScreen` (loader or retry/sign-out state), `RootNavigator` (Expo Router
  `Stack.Protected` guards; renders `RestrictedAccountScreen` for inactive accounts).

Sign-up and password reset (6-digit email codes, no links):

- Sign up: email + password → Supabase emails a 6-digit code (template `{{ .Token }}`) → the
  user types it on `/verify-email` → `verifyOtp({ type: 'email' })` creates the session →
  the root guard moves to onboarding. The code works from any device's inbox: nothing is bound
  to this install. Resend after 60 s; only the newest code works; codes expire after 1 hour.
- Sign in with an unconfirmed email → `email_not_confirmed` → "Enter my code" opens the same
  screen (resend available immediately).
- Forgot password (`/forgot-password`): email → recovery code → `verifyOtp({ type: 'recovery' })`
  signs the user in with `PASSWORD_RECOVERY`; `AuthProvider.passwordRecovery` keeps the router
  on the reset screen until `updatePassword` succeeds (or the user cancels and signs out). The
  request screen never says whether an account exists.
- Code input: one numeric field (paste and one-time-code autofill work; non-digits stripped),
  auto-submit on the sixth digit.

Deprecated auth callback (PKCE), kept for one compatibility release:

- The Supabase client uses `flowType: 'pkce'`. Email links come back as
  `<this install's scheme>://auth/callback?code=…` and the code is exchanged with the code
  verifier stored on this device. A link opened elsewhere cannot sign anyone in.
- Only this install's exact scheme + `auth/callback` path is considered. Raw
  `access_token` / `refresh_token` links are **rejected** (never `setSession`), as are malformed
  or empty callbacks.
- A callback that arrives while a session exists is ignored (`already_signed_in`): a link can
  never replace the signed-in account. Each code is exchanged at most once per process.
- Expired / used / foreign-device links surface as `link_expired` / `link_invalid` through
  `AuthLinkNotice` ("That link didn't work …"). The email is already confirmed by Supabase at
  that point, so signing in with the password works.
- Only the newest confirmation email signs in automatically (auth-js keeps the latest
  verifier); older links still confirm the address.

Rules:

- Routing is server state only: account status (`get_my_account_state`) and
  `profiles.onboarding_completed_at` (set by `complete_onboarding()`). The local onboarding
  marker only picks the step to resume.
- No infinite spinner: auth requests time out, an offline cold start with an expired access
  token shows a retry state (the stored session is kept), and a profile request paused offline
  shows an offline state. Each offers sign-out.
- Sign-out always clears this device: auth-js removes the local session even when the revoke
  request fails, and `signOut()` treats `network` / `timeout` as signed out.
- The sign-up password field uses `textContentType="password"`, not `newPassword`: iOS would
  otherwise fill an invisible "Automatic Strong Password" that is not offered back at sign-in
  without Associated Domains (found in simulator E2E).
- Writes after a quiet period refresh the connection first (`services/supabase/warm-up.ts`,
  `fresh-connection-fetch.ts`): iOS otherwise reuses a silently dead HTTP/3 connection and the
  POST fails with -1005 (seen on sign-in and the code exchange).
- Email + password with email codes (Pre-3M). Social sign-in is deferred.
- Hosted Supabase Auth needs custom SMTP and the code templates (see `supabase/README.md` →
  "Auth emails"). The redirect URLs `triply-dev://auth/callback`,
  `triply-preview://auth/callback` and `triply://auth/callback` stay listed until the
  deprecated callback is removed.
