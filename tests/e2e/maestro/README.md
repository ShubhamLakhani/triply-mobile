# Maestro E2E

Critical-flow E2E tests (Architecture v2 §24). Phase 0M ships one smoke flow; product flows
(signup, onboarding, trip, discovery, match, chat, report/block) are added in their milestones.

## Run locally

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro
2. Install and launch a **development build** on a simulator/emulator (`npm run ios` / `npm run android`)
   with Metro running (`npm start`).
3. From the repo root: `maestro test tests/e2e/maestro`

Notes:

- `back` presses the Android hardware back button; on iOS, Maestro performs a back-swipe
  equivalent. The smoke flow therefore verifies Android hardware-back behaviour on Android.
- Selectors use `testID`s, never copy, so flows survive text changes.
- Flows target `cc.toolmint.triply.dev`. Use `--app-id` / env overrides for preview builds later.
