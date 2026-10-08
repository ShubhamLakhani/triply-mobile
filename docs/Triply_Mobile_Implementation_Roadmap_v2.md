# Triply Mobile Implementation Roadmap v2.0

**Date:** 7 October 2026  
**Supersedes:** web-first execution assumptions in Triply Implementation Roadmap v1.0

## Phase 0M — Mobile foundation
- separate `triply-mobile` repo
- Expo + Expo Router
- TypeScript strict
- EAS profiles
- CI
- design tokens
- TanStack Query
- Zustand
- React Hook Form + Zod
- Reanimated + Gesture Handler
- Supabase
- PostHog
- Sentry
- Android + iOS development builds

**Gate:** clean development build on both platforms.

## Phase 1M — Auth + schema
- staging/prod Supabase
- migrations
- RLS
- email auth
- deep links
- persistent session
- protected routes
- account-state enforcement

**Gate:** signup/login/logout survives app restart on both platforms.

## Phase 2M — Onboarding/profile
- identity
- 18+ validation
- photos
- bio/interests
- preferences
- resumable onboarding

**Gate:** complete profile persists correctly on iOS and Android.

## Phase 3M — Trips/destinations
- destination provider
- canonical markets
- date selection
- create/edit/cancel trips
- selected-trip state

**Gate:** normalized future trip behaves identically on both platforms.

## Phase 4M — Discovery/matching
- RPC/server eligibility
- discovery card
- date overlap
- like/pass
- transaction-safe match
- pagination

**Gate:** simultaneous mutual like creates exactly one match.

## Phase 5M — Chat
- matches
- realtime text chat
- pagination
- retries
- keyboard behavior
- push-token registration

**Gate:** reliable conversation on iOS and Android.

## Phase 6M — Safety/moderation
- block
- report
- unmatch
- Safety Center
- account restrictions
- moderation backend/admin surface

**Gate:** block immediately removes every communication path.

## Phase 7M — Push + analytics
- Expo Notifications
- deep links
- PostHog
- attribution
- Sentry alerts

**Gate:** push opens correct screen and funnel is traceable.

## Phase 8M — Native quality pass
- safe areas
- Android back behavior
- keyboard
- permissions
- connectivity
- accessibility
- performance
- image optimization

**Gate:** zero known cross-platform release blockers.

## Phase 9M — Internal distribution
- TestFlight
- Google Play internal testing
- staging builds
- Maestro smoke suite
- store metadata/privacy drafts

## Phase 10M — Bali closed cohort
- production builds
- small invitation batch
- monitor activation, liquidity, chat, safety
- expand gradually

## Release discipline
A feature is done only when:
- typecheck passes
- tests pass
- staging migration passes
- iOS checked
- Android checked
- analytics added
- privacy/safety reviewed
- Claude reports changed files and deviations

## Claude operating rule
Use one scoped prompt per milestone.

Never ask:
> Build the entire Triply app.

First task:
> **Implement Phase 0M mobile foundation only.**
