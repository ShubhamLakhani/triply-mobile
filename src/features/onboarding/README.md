# features/onboarding

Resumable onboarding: `profile → interests → preferences → photos → ready`. Every step is
required; the server decides when onboarding is finished.

- `api/onboarding-api.ts`: `completeOnboarding()` → the `complete_onboarding` RPC. The database
  validates everything in one transaction (core profile 18+, a primary photo, 3–8 interests, at
  least one gender preference, a valid age range) and sets `profiles.onboarding_completed_at`
  once. Missing items come back as `OnboardingError('incomplete', { missing })` (SQLSTATE
  `TR002` + `details`); an inactive account as `account_inactive`.
- `hooks/use-complete-onboarding.ts`: the mutation; on success the returned row replaces the
  cached profile, which flips the root guard to the app.
- `progress.ts`: per-user local marker of the furthest step completed on this device
  (`triply.onboarding.v1.<userId>`; a step name only). It only decides **where to resume**:
  `resolveResumeStep` restarts at `profile` while the core profile is incomplete, otherwise
  continues after the last completed step. It never decides whether onboarding is done. A
  failing device write never fails a step (the marker is best effort).
  `clearOnboardingProgress` also drops the step drafts below.
- **Step drafts (found on the iOS simulator in Pre-3M review):** the profile, interests and
  preferences steps keep their unsaved input per user on the device
  (`services/storage/user-draft-store.ts`; stores in `features/profile/drafts.ts`,
  `features/interests/drafts.ts` and `features/preferences/drafts.ts`), so a force-close
  before Continue resumes with the same text/chips/values. The profile step drafts exactly what
  was typed (a half-entered date included) through the form's `watch` subscription and overlays
  it on the server row at mount; hidden "about you" fields always keep the server value. The draft is validated on read (corrupt or outdated values are ignored), keyed by
  user id (an account switch never shows another user's draft), cleared once the server save
  succeeds, and dropped when onboarding finishes. If the device copy cannot be written the
  step keeps working from memory and shows "We couldn't keep a copy … on this device". The
  server rules are unchanged: nothing is saved until Continue, and `complete_onboarding()`
  still requires 3–8 interests and at least one gender preference. The profile edit screens do
  not use drafts (an abandoned edit is dropped on purpose).
- `hooks/use-onboarding-step.ts`: view tracking, `advance()` (marks the step, `router.replace`
  to the next route) and `back()`.
- `components/OnboardingShell.tsx`: header + segmented progress + animated content + pinned
  primary/secondary actions. Every step has a **Sign out** header action, and Android hardware
  back goes to the previous step (platform default on the first).
- Steps: `ProfileStep` (name, DOB 18+, gender), `InterestsStep` (3–8; Continue disabled below
  3), `PreferencesStep` (at least one gender or Everyone; age range; overlap), `PhotosStep` (at
  least one photo), `ReadyStep` (calls `complete_onboarding`; on `incomplete` it lists what is
  missing and offers "Fix it now" to the earliest missing step). No step can be skipped.

Routing: the root guard keeps the user in onboarding until `onboarding_completed_at` is set, so
saving a complete core profile can never flash the tabs (the Phase 2M "mark before save"
workaround is gone). `ReadyStep` never navigates into the tabs itself.

Load failures never become saves: interests and preferences are editable only after the
server data has loaded (`status: 'ready'`); otherwise the step shows Retry. A restored draft
is applied only once that data is ready, and it wins over the (older) server values.

Photos need no draft: every upload is registered on the server immediately.

Routes live in `app/onboarding/*` (`/onboarding`, `/onboarding/interests`, …).

Rules: never write `is_profile_complete` or `onboarding_completed_at` from the client (no
column privilege); each step persists through the existing feature APIs as the user
progresses.
