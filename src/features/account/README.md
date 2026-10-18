# features/account

The signed-in user's own account status (Pre-3M M-02).

- `api/account-api.ts`: `fetchOwnAccountState()` via the `get_my_account_state` RPC. The
  `account_states` table has no client privileges; the RPC returns only the effective `status`
  (`active | suspended | banned | deletion_pending`) and `suspended_until`. The internal safety
  hold and reason codes are never exposed.
- `hooks/use-account-state.ts`: `useOwnAccountState(userId)`, consumed by the root routing
  (`features/auth/routing`). A non-active status routes to `RestrictedAccountScreen` (sign-out
  only; support contact is a documented future action).
- `api/account-errors.ts`: `isAccountInactiveError()` recognises `account_inactive` feature
  errors and raw `TR001`. Any query/mutation failing that way re-fetches the account state
  (`services/query/query-client.ts`), so a suspension shows up immediately.

Enforcement is server-side: every profile, preference, interest, photo and onboarding write
calls `private.assert_active_actor()` (SQLSTATE `TR001`). This feature is only the UX.
