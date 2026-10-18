# features/auth

Session, sign-in/up and the root routing guard.

- `providers/AuthProvider.tsx`: the app's **single** auth subscription. Exposes
  `session`, `user`, `userId`, `isAuthenticated`, `isInitializing`, `restoreError` /
  `retryRestore`, `linkError` / `dismissLinkError`, `signOut`; clears the query cache on
  sign-out or account switch (`createAuthCacheReset`); identifies analytics with the opaque user
  id; completes email-confirmation deep links (`auth-links.ts`) once the stored session is known.
- `hooks/use-auth-session.ts`: reads the provider (no per-screen subscriptions).
- `api/auth-api.ts`: `signInWithPassword`, `signUpWithPassword` (returns
  `needsEmailConfirmation`), `resendSignUpEmail`, `signOut`, `getCurrentSession`,
  `subscribeToAuthChanges`. Every call runs under `AUTH_REQUEST_TIMEOUT_MS` (20 s) and settles
  with an `AppAuthError`; the transport also aborts stalled sockets
  (`services/supabase/timeout-fetch.ts`).
- `api/auth-errors.ts`: `AppAuthError` with stable codes (`invalid_credentials`,
  `email_not_confirmed`, `email_taken`, `weak_password`, `rate_limited`, `invalid_input`,
  `email_undeliverable`, `signup_disabled`, `network`, `timeout`, `link_expired`,
  `link_invalid`, `unknown`) and fixed, user-safe messages. Raw provider text is never shown.
- `api/auth-links.ts`: redirect URL (`<scheme>://auth/callback`) and strict deep-link handling
  (PKCE only, see below).
- `routing/resolve-area.ts` + `routing/use-app-area.ts`: pure decision
  `bootstrap | auth | onboarding | app | error` from session + persisted profile row, with the
  reason for `error` (`session` restore failed, `profile` failed, device `offline`).
- `components/`: `WelcomeScreen`, `SignInScreen`, `SignUpScreen` (with check-email state),
  `AuthLinkNotice` (failed-link message on the signed-out screens), `BootstrapScreen`
  (loader or retry/sign-out state), `RootNavigator` (Expo Router `Stack.Protected` guards).

Auth callback (PKCE):

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

- Completeness comes from `profiles.is_profile_complete` (database-maintained). The only local
  input is the onboarding progress marker, which can keep a complete profile inside onboarding
  until the optional steps finish on this device, never the other way round.
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
- Email/password only in Phase 2M. Password reset and social sign-in are deferred.
- Supabase Auth must list the redirect URLs `triply-dev://auth/callback`,
  `triply-preview://auth/callback` and `triply://auth/callback` (URL Configuration).
