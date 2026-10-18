# features/onboarding

Resumable onboarding: `profile → interests → preferences → photos → ready`.

- `progress.ts`: per-user local marker of the furthest step completed on this device
  (`triply.onboarding.v1.<userId>` in device storage; a step name only). `resolveResumeStep`
  always restarts at `profile` while the server row is incomplete, otherwise continues after the
  last completed step. `clearOnboardingProgress` runs when `ready` finishes.
- `hooks/use-onboarding-step.ts`: view tracking, `advance()` (marks the step, `router.replace`
  to the next route) and `back()`.
- `components/OnboardingShell.tsx`: header + segmented progress + animated content + pinned
  primary/secondary actions. Steps only supply fields. Every step has a **Sign out** header
  action, and Android hardware back goes to the previous step (platform default on the first).
- Steps: `ProfileStep` (required: name, DOB 18+, gender), `InterestsStep` (≤10, skippable),
  `PreferencesStep` (defaults exist server-side; skippable only if they cannot be loaded),
  `PhotosStep` (skippable), `ReadyStep` (re-checks the profile row; finishes only when the
  server says complete).

Routing race (fixed in Phase 2M hardening): `ProfileStep` marks onboarding as started
**before** saving. The saved row is cached as soon as the save succeeds, so without the marker
the root guard would briefly treat the account as finished and show the tabs. A failed save
leaves only the "started" marker, which is harmless: an incomplete row always resumes at the
profile step. `ReadyStep` only clears the marker; the guard then hands over to Discover (no
navigation into the still-guarded tabs).

Load failures never become saves: interests and preferences are editable only after the
server data has loaded (`status: 'ready'`); otherwise the step shows Retry (and Skip).

Routes live in `app/onboarding/*` (`/onboarding`, `/onboarding/interests`, …).

Rules: never set `is_profile_complete` from the client; required steps cannot be skipped; each
step persists through the existing feature APIs as the user progresses.
