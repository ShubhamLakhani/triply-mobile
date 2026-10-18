# Maestro E2E

Critical-flow E2E tests (Architecture v2 §24). Selectors are `testID`s only, never copy.
`tests/config/maestro-ids.test.ts` (Jest) fails if a flow references an ID that no longer
exists in the app, so the flows cannot silently drift from the code.

## Flows

| Flow                                          | Backend                              | What it proves                                                                                                                       |
| --------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `flows/smoke-tab-shell.yaml`                  | none                                 | Fresh install lands on Welcome (tabs guarded); Sign up / Sign in / Forgot password reachable; on-device validation; back navigation. |
| `flows/backend/sign-up-check-email.yaml`      | **creates an account**               | Sign-up settles within the auth budget and reaches the 6-digit code screen (resend on cooldown).                                     |
| `flows/backend/sign-up-verify-code.yaml`      | confirms that account                | Same app session: typing the emailed code signs in and lands on onboarding (no link, no tabs).                                       |
| `flows/backend/onboarding-fresh-account.yaml` | writes profile/interests/preferences | Confirmed, never-onboarded account: profile → 3 interests → "Everyone" → photos step (no detour through the tabs).                   |
| `flows/backend/onboarding-finish.yaml`        | completes onboarding                 | After adding a photo by hand (system picker): photos → ready → `complete_onboarding` → Discover, sign out.                           |
| `flows/backend/sign-in-existing.yaml`         | read only                            | Confirmed, onboarded account: sign in → tabs → edit profile → sign out → relaunch stays signed out.                                  |

`maestro test tests/e2e/maestro` runs only the top-level (no-backend) flows. Backend flows are
run one by one, with credentials passed as Maestro env vars (never committed):

```bash
maestro test -e TRIPLY_E2E_EMAIL=you@example.com -e TRIPLY_E2E_PASSWORD='…' \
  tests/e2e/maestro/flows/backend/sign-in-existing.yaml
```

Use the **Development** Supabase project only. Sign-up and password reset use a 6-digit code
from the email (any device can read it; nothing is bound to the install). The pending sign-up
email is kept in memory only, so run `sign-up-verify-code.yaml` in the same app session
(`-e TRIPLY_E2E_CODE=123456`) without relaunching.

## Run locally

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
2. Install and launch a **development build** on a simulator/emulator (`npm run ios` /
   `npm run android`) with Metro running (`npm start`).
3. From the repo root: `maestro test tests/e2e/maestro`

Notes:

- `header-back` is the in-app back button. Android hardware back inside onboarding goes to the
  previous step (unit-tested in `OnboardingShell.test.tsx`); exercise it on Android with `back`.
- Flows target `cc.toolmint.triply.dev`. Use `--app-id` / env overrides for preview builds later.
