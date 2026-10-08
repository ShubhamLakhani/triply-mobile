# Triply Mobile Technical Architecture v2.0

**Founder Engineering Decision Document**  
**Date:** 7 October 2026  
**Supersedes:** Triply Technical Architecture v1.0 for the consumer app  
**Status:** Architecture lock for iOS + Android MVP

## 1. Core decision

Triply will use **two separate repositories**:

1. `triply-marketing` — existing landing/validation site
2. `triply-mobile` — production mobile application

The production app will target **iOS and Android** using **React Native + Expo**.

## 2. Locked technology stack

- React Native + Expo
- Expo Router
- TypeScript strict
- React Native New Architecture
- EAS Build / Submit / Update
- TanStack Query for server state
- Zustand for small local UI state
- React Hook Form + Zod
- Reanimated + Gesture Handler
- PostgreSQL via Supabase
- Supabase Auth
- Supabase Storage
- Supabase Realtime
- Supabase RPC / Edge Functions for sensitive operations
- Expo Notifications
- expo-image / expo-image-picker
- PostHog
- Sentry
- Resend
- React Native Testing Library
- Maestro for critical E2E flows

## 3. Why Expo

Expo is the production framework choice, not a prototype shortcut.

It gives us:
- one cross-platform codebase,
- reliable Android/iOS build pipelines,
- development builds,
- app-signing support,
- TestFlight/Google Play distribution,
- OTA JS updates,
- native module support,
- EAS CI/CD.

Use **development builds**, not Expo Go, once native integrations are introduced.

Expo's current supported SDKs run on React Native's New Architecture, so Triply should be built for New Architecture from day one.

## 4. Repository layout

```text
triply-mobile/
  app/
  src/
  assets/
  supabase/
  scripts/
  tests/
  .github/
  app.config.ts
  eas.json
  package.json
  tsconfig.json
```

The landing-page repository remains independent.

## 5. App architecture

Use a **feature-first modular structure**:

```text
app/
  _layout.tsx
  (auth)/
  (onboarding)/
  (tabs)/
    discover/
    matches/
    trips/
    profile/
  chat/
  safety/
  modal/

src/
  features/
    auth/
    onboarding/
    profile/
    destinations/
    trips/
    discovery/
    matching/
    chat/
    notifications/
    safety/

  components/
    ui/
    feedback/
    layout/

  services/
    supabase/
    analytics/
    notifications/
    storage/
    observability/

  hooks/
  stores/
  schemas/
  types/
  constants/
  utils/
  theme/
```

Rules:
- no business logic in screen components,
- no scattered direct Supabase calls,
- one data-access layer,
- feature modules own queries/mutations/UI,
- DTOs and schemas remain typed.

## 6. Navigation

Use **Expo Router**.

Route groups:
- `(auth)`
- `(onboarding)`
- `(tabs)`
- modal routes

Bottom tabs:
1. Discover
2. Matches
3. Trips
4. Profile

Deep links must support:
- auth callbacks,
- push-notification destinations,
- chat/match routes,
- future referral links.

## 7. State management

### Server state
Use **TanStack Query** for:
- profile
- trips
- discovery
- matches
- messages
- notifications

### Local UI state
Use **Zustand** only for:
- selected trip ID
- transient modal state
- small onboarding UI state
- feature flags if needed

Do not mirror server records into a global Zustand store.

## 8. Forms

Use:
- React Hook Form
- Zod

Every important input has one reusable schema.

Validation occurs:
1. on-device for UX,
2. again in trusted backend/database logic.

## 9. Backend and database

Keep **Supabase + PostgreSQL**.

Reasons:
- relational integrity,
- transactions,
- RLS,
- realtime,
- storage,
- auth,
- efficient date-overlap queries.

PostgreSQL remains the system of record.

## 10. Security boundary

Direct client Supabase access is allowed only where RLS makes the operation safe.

Sensitive operations must run through:
- PostgreSQL RPC, and/or
- Supabase Edge Functions.

Sensitive operations include:
- discovery
- like + maybe-match
- block
- report
- account deletion
- moderation
- push-notification fan-out

Never ship:
- service-role key,
- DB password,
- private Resend key,
- moderation secrets.

## 11. Authentication

Use Supabase Auth.

Recommended:
- email OTP or magic link initially,
- plan Apple Sign In if social login is added on iOS,
- Google Sign In when conversion benefit justifies it.

Auth must correctly handle:
- cold launch,
- token refresh,
- background/foreground,
- revoked session,
- suspended/banned account.

## 12. Environments

Use:
1. local
2. staging
3. production

Separate Supabase projects for staging and production.

Migrations live under:

```text
supabase/migrations/
```

## 13. Realtime chat

Use:
- PostgreSQL for durable messages,
- Supabase Realtime for delivery.

Flow:
1. validate active match/safety state,
2. persist message,
3. broadcast via realtime,
4. update recipient,
5. send push if needed.

Realtime is never the source of truth.

## 14. Push notifications

Use `expo-notifications`.

Initial types:
- new match
- new message
- new compatible traveler
- trip reminder
- account/safety notice

Store push tokens server-side.

Do not expose sensitive message text in lock-screen notifications by default.

## 15. Images

Use:
- `expo-image-picker`
- `expo-image`
- Supabase Storage

Before upload:
- validate,
- resize/compress,
- strip EXIF/location metadata where possible,
- use random storage keys.

## 16. Motion

Use:
- React Native Reanimated
- Gesture Handler

For:
- onboarding,
- discovery transitions,
- date overlap,
- bottom sheets,
- match convergence.

Avoid Tinder-style swipe mechanics as the core interaction.

## 17. UI foundation

Use native React Native primitives plus a small internal design system.

Avoid a large UI framework that overrides Triply's identity.

Use typed tokens for:
- color
- spacing
- radius
- typography
- shadow/elevation

## 18. Connectivity

Triply is online-first, but must handle weak mobile networks.

Required:
- network awareness,
- retry,
- failed-send state,
- cached safe query data,
- idempotent mutation retries.

TanStack Query should integrate with app focus/connectivity.

## 19. Error monitoring

Use Sentry React Native for:
- JS crashes,
- native crashes,
- handled exceptions,
- performance where useful.

Critical alerts:
- auth spikes,
- discovery errors,
- match transaction failures,
- chat failures,
- moderation failures.

## 20. Analytics

Use PostHog React Native.

Critical events:
- signup_completed
- profile_completed
- trip_created
- discovery_opened
- like_sent
- match_created
- conversation_started
- two_way_conversation
- report_submitted
- block_created
- return_session

Do not send sensitive content.

## 21. EAS configuration

Use three EAS profiles:

- `development`
- `preview`
- `production`

Development:
- dev client
- debugging

Preview:
- internal QA
- staging backend

Production:
- App Store / Play Store
- production backend

Preview must never silently use production data.

## 22. Cross-platform quality rule

Every feature must be tested on:
- iOS
- Android
- small screen
- common screen size

A feature is not done after iOS-only testing.

Use platform-specific files only when behavior genuinely differs.

## 23. Mobile platform details

Explicitly handle:
- iOS safe areas
- Android system bars
- keyboard
- Android hardware back
- modal dismissal
- deep-link back stack
- app lifecycle

These are release-blocking if broken.

## 24. Testing

### Unit
- overlap logic
- preferences
- ranking
- state transitions

### Component
React Native Testing Library.

### Integration
- RPC/Edge Function operations
- matching transaction
- block/report
- message authorization

### E2E
Use **Maestro initially** for:
- signup
- onboarding
- trip
- discovery
- match
- chat
- report/block

## 25. CI/CD

Use GitHub Actions + EAS.

Pull request:
1. install
2. lint
3. typecheck
4. tests
5. migration/schema checks

Main branch:
- preview/update as appropriate,
- EAS build when native/runtime changes require it.

Production releases remain explicit.

## 26. Claude development workflow

Claude is the primary coding agent.

For every task:
1. give one milestone,
2. provide only relevant Triply specs,
3. require Claude to inspect current code,
4. require implementation plan first,
5. require cross-platform risk analysis,
6. implement scoped change,
7. run tests,
8. verify iOS + Android,
9. report changed files,
10. report unresolved issues.

Never ask Claude to build the whole app in one prompt.

## 27. Claude guardrails

Every prompt should say:
- preserve architecture,
- no dependency without justification,
- Expo/New-Architecture compatibility required,
- test iOS and Android,
- never expose secrets,
- never weaken RLS,
- avoid `any`,
- do not suppress errors,
- update tests,
- do not modify unrelated files,
- disclose architectural deviations before making them.

## 28. Dependency policy

Before adding any library, verify:
1. Expo compatibility
2. New Architecture compatibility
3. active maintenance
4. iOS support
5. Android support
6. why it is needed
7. whether Expo already provides equivalent functionality

Prefer Expo SDK modules.

## 29. App-store readiness

Before public release:

### Apple
- App Store Connect
- privacy labels
- age rating
- in-app account deletion
- Apple auth compliance if social auth exists

### Google
- Play Console
- Data Safety
- content rating
- account deletion disclosure
- testing-track requirements

Dating/UGC review requires real report/block/moderation features.

## 30. Final architecture lock

| Area | Decision |
|---|---|
| Repositories | Marketing and mobile separate |
| Platforms | iOS + Android |
| Framework | React Native + Expo |
| Navigation | Expo Router |
| Architecture | Feature-first modular |
| Build system | EAS |
| Server state | TanStack Query |
| Local state | Zustand |
| Forms | React Hook Form + Zod |
| Motion | Reanimated + Gesture Handler |
| Database | PostgreSQL / Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Sensitive backend | RPC / Edge Functions |
| Push | Expo Notifications |
| Analytics | PostHog |
| Monitoring | Sentry |
| Email | Resend |
| Mobile E2E | Maestro initially |
| Coding agent | Claude |

## 31. Immediate next step

### Phase 0M — Mobile Foundation

Claude should create `triply-mobile` with:
- current stable Expo SDK,
- Expo Router,
- TypeScript strict,
- New Architecture,
- folder architecture above,
- development/preview/production EAS profiles,
- lint/typecheck/test pipeline,
- React Hook Form + Zod,
- TanStack Query,
- Zustand,
- Reanimated,
- Gesture Handler,
- Supabase client,
- PostHog,
- Sentry,
- environment validation,
- auth route-group placeholders,
- tab-shell placeholders,
- CI.

**No real feature work until Android and iOS development builds both pass.**
