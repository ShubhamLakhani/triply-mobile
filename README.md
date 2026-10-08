# Triply Mobile

Production iOS + Android app for **Triply**, built from one React Native + Expo codebase.

The source of truth for product and architecture is [`docs/`](./docs). Start with
`Triply_Mobile_Technical_Architecture_v2.md` and `Triply_Mobile_Implementation_Roadmap_v2.md`.
The marketing site is a separate repository and is not a dependency.

**Current milestone:** Phase 0M, the mobile foundation. No product features exist yet.

## Stack

Expo SDK 57 · React Native 0.86 (New Architecture, Hermes) · React 19.2 · TypeScript (strict) ·
Expo Router · TanStack Query · Zustand · React Hook Form + Zod · Reanimated 4 + Gesture Handler ·
Supabase JS · Sentry · PostHog · Expo Notifications · expo-image / expo-image-picker · Jest
(jest-expo) + React Native Testing Library · Maestro · EAS Build / Submit / Update.

## Prerequisites

| Tool           | Version                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------- |
| Node.js        | **22 LTS** (≥ 22.13; see `.nvmrc`). Run `nvm use`                                           |
| npm            | 10+ (bundled with Node 22). **npm is the only package manager**; commit `package-lock.json` |
| Xcode          | Latest stable release supported by Expo SDK 57, with an iOS Simulator runtime installed     |
| CocoaPods      | Installed automatically by `expo run:ios` if missing (or `brew install cocoapods`)          |
| Android Studio | Latest stable, with Android SDK Platform 36, an emulator (AVD) and `ANDROID_HOME` set       |
| JDK            | 17 (the one bundled with Android Studio works)                                              |
| EAS CLI        | Run with `npx eas-cli@latest …`; no global install needed                                   |
| Maestro        | Optional, for E2E: https://docs.maestro.dev                                                 |

Expo Go is **not** supported. This app uses native modules, so you run it with a development
build (`expo-dev-client`).

## Install

```bash
nvm use
npm ci
cp .env.example .env.local   # then fill in the values (see "Environment")
```

## Run

```bash
npm run ios        # build and install the development build on the iOS Simulator, start Metro
npm run android    # build and install the development build on an Android emulator, start Metro
npm start          # start Metro only (dev client already installed)
npm run start:clear
```

Until the Sentry project exists, prefix local native builds with `SENTRY_DISABLE_AUTO_UPLOAD=true`
(for example `SENTRY_DISABLE_AUTO_UPLOAD=true npm run ios`) so the Sentry build step doesn't try
to upload source maps without credentials.

`npm run ios` and `npm run android` run `expo prebuild` behind the scenes. The generated `ios/`
and `android/` folders are **not committed** (Continuous Native Generation). All native
configuration lives in `app.config.ts` and config plugins.

## Quality checks

```bash
npm run lint           # ESLint (expo config + architecture import guardrails), zero warnings
npm run typecheck      # tsc --noEmit, strict
npm test               # Jest + React Native Testing Library
npm run test:watch
npm run format:check   # Prettier (npm run format to fix)
npm run security:check # secret scan, EXPO_PUBLIC allowlist, committed .env files
npm run config:check   # evaluates app.config.ts for all three variants
npm run doctor         # expo-doctor
npm run verify         # everything above except doctor
npm run export:ios && npm run export:android   # Metro → Hermes bundle for both platforms
```

CI (`.github/workflows/ci.yml`) runs the same checks on every pull request. It never builds or
publishes store binaries.

## Environment

There are three variants, selected by `APP_VARIANT`:

| Variant     | Bundle ID / package          | Scheme           | Backend         | EAS profile                            |
| ----------- | ---------------------------- | ---------------- | --------------- | -------------------------------------- |
| development | `cc.toolmint.triply.dev`     | `triply-dev`     | local / staging | `development`, `development-simulator` |
| preview     | `cc.toolmint.triply.preview` | `triply-preview` | **staging**     | `preview`                              |
| production  | `cc.toolmint.triply`         | `triply`         | production      | `production`                           |

All three can be installed side by side, and deep links can't open the wrong build.

- **Local:** `.env.local` (gitignored), copied from `.env.example`. Restart Metro after editing.
- **EAS builds:** set values in _EAS Environment Variables_ for the `development`, `preview` and
  `production` environments on expo.dev. Each EAS profile selects its environment.
- **Validation:** `src/config/env.ts` validates every public value with Zod at launch. A missing
  or unsafe value shows a clear configuration error screen instead of failing later. Supabase
  secret / service-role keys are rejected outright.
- **Guard:** set `TRIPLY_PRODUCTION_SUPABASE_REF` in the dev/preview environments, and the build
  refuses to point a non-production variant at the production Supabase project.

Public (bundled) variables: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`EXPO_PUBLIC_POSTHOG_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`, `EXPO_PUBLIC_ANALYTICS_ENABLED`,
`EXPO_PUBLIC_SENTRY_DSN`. Anything prefixed `EXPO_PUBLIC_` ships inside the app binary.

**Never** put any of these in the app or in `EXPO_PUBLIC_*`: the Supabase service-role / secret
key, the database password, the Resend key, moderation/admin secrets, or `SENTRY_AUTH_TOKEN`.
`SENTRY_AUTH_TOKEN` only exists as an EAS secret (or in your shell) for source-map upload.

Integrations by variant:

- **Sentry:** off in development builds; on in preview and production when a DSN is present.
  PII is disabled and events are scrubbed.
- **PostHog:** off unless `EXPO_PUBLIC_ANALYTICS_ENABLED=true`. Session replay and autocapture
  are off. Identity is the Supabase user UUID, never an email.

## EAS

One-time setup (requires your Expo account):

```bash
npx eas-cli@latest login
npx eas-cli@latest init          # creates the EAS project and prints the project ID
```

Paste the printed ID into `EAS_PROJECT_ID` in `app.config.ts`. This enables EAS Update and is not
a secret.

Profiles (`eas.json`):

- `development`: dev client, internal distribution (devices need registering: `npx eas-cli device:create`)
- `development-simulator`: dev client for the iOS Simulator. No Apple credentials needed
- `preview`: internal QA build against the staging backend (Android builds an APK)
- `production`: App Store / Play Store build, auto-incremented build numbers

```bash
npm run build:dev:ios-sim     # iOS Simulator dev client (no Apple account)
npm run build:dev:android     # Android dev client APK
npm run build:dev:ios         # physical iOS device (Apple Developer account required)
npm run build:preview
```

Production builds and store submission are always run manually. Submit credentials are
intentionally not stored in `eas.json`.

OTA updates use `runtimeVersion: { policy: "appVersion" }`. Bump `version` in `app.config.ts`
whenever native code or config changes.

## Project structure

```
app/                     Expo Router routes only (thin screens, no business logic)
  _layout.tsx            Root: env validation, Sentry, fonts/splash, providers, root Stack
  index.tsx              Entry redirect (becomes the auth gate in Phase 1M)
  (auth)/sign-in.tsx     Placeholder (Phase 1M)
  (onboarding)/start.tsx Placeholder (Phase 2M)
  (tabs)/                Discover · Matches · Trips · Profile, each with its own Stack
src/
  features/<feature>/    Feature modules (api/, components/, schemas/, hooks/), filled from Phase 1M
  components/ui|feedback|layout   Small internal primitives (AppText, AppButton, AppScreen, LoadingState…)
  services/              Single owners of vendor SDKs:
    supabase/            The one Supabase client + AppState auto-refresh
    storage/             Device storage (expo-sqlite localStorage for the auth session)
    query/               QueryClient defaults + focus/online managers
    observability/       Sentry init, scrubbing, captureError
    analytics/           Typed analytics wrapper over PostHog
    notifications/       Notification permission/handler service (no prompt at launch)
  providers/             Root provider composition
  config/                Validated runtime environment
  theme/                 Design tokens: colors, spacing, radius, typography, motion, shadows
  hooks/ stores/ schemas/ types/ constants/ utils/
assets/                  Placeholder brand assets (replace before distribution)
supabase/migrations/     Database migrations (from Phase 1M)
scripts/                 security + config check scripts
tests/                   Jest setup, shared test utils, navigation tests, Maestro E2E
```

Rules enforced by lint:

- Vendor SDKs (`@supabase/supabase-js`, `posthog-react-native`, `expo-notifications`,
  `@sentry/react-native`) can only be imported inside their `src/services/*` owner, or a feature's
  `api/` module for Supabase.
- `any` is banned.
- `console.log` is banned.

Unit and component tests live next to the code they test (`*.test.ts(x)`). Never put tests inside
`app/`, because Expo Router would treat them as routes.

## State and data conventions

- **Server state:** TanStack Query only, via feature `api/` hooks.
- **Local UI state:** small Zustand stores (`src/stores`). Never mirror server data there.
- **Forms:** React Hook Form + Zod (`useZodForm`), with schemas in `src/schemas` or the feature's
  `schemas/`. The backend re-validates.
- **Styling:** tokens from `@/theme`. Light mode only for now.
