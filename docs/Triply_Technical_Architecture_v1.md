# Triply Technical Architecture v1.0
**Founder Engineering Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Production architecture definition  
**Status:** Working source of truth for stack, security boundaries, deployment, realtime, observability, testing, and CI/CD

---

# 1. Architecture Goal

Build Triply as a production-ready web-first consumer product that is:

- secure,
- simple enough for a founder-led team,
- fast to iterate,
- reliable under early real-world usage,
- easy to observe and debug,
- capable of supporting matching, realtime chat, moderation, and marketplace analytics,
- structured so native mobile can be added later without rewriting the core backend.

The architecture should avoid both:
- prototype shortcuts that become dangerous in a dating product,
- premature complexity designed for millions of users before product-market fit.

---

# 2. Recommended Stack

## Frontend
**Next.js 16 + React 19 + TypeScript**

Why:
- existing Triply web experience already uses the Next.js ecosystem,
- excellent mobile-first web support,
- server rendering where useful,
- route handlers/server actions available,
- strong TypeScript support,
- straightforward Vercel deployment.

## Styling
**Tailwind CSS + design tokens**

Use a small component system rather than adopting a visually dominant UI library.

## Motion
**Framer Motion**

Use selectively for:
- onboarding transitions,
- date-overlap visuals,
- discovery cards,
- match moments,
- brand motion.

## Database
**PostgreSQL via Supabase**

## Auth
**Supabase Auth**

## Storage
**Supabase Storage**

## Realtime
**Supabase Realtime initially**

Primary use:
- new chat messages,
- match/message state refresh,
- lightweight presence only if genuinely needed later.

## Email
**Resend**

## Product Analytics
**PostHog**

## Hosting
**Vercel**

## Error Monitoring
**Sentry**

## Rate Limiting / lightweight ephemeral state
**Upstash Redis**

Use for:
- rate limits,
- short-lived idempotency keys where useful,
- abuse controls,
- lightweight caching.

Do not make Redis the source of truth for product state.

---

# 3. Architecture Style

Use a **modular monolith** for MVP.

This means:
- one deployable application,
- clearly separated product domains,
- one relational database,
- strong server-side boundaries.

Do not introduce microservices yet.

Recommended domains:

- Auth
- Profiles
- Trips
- Discovery
- Matching
- Messaging
- Safety
- Moderation
- Notifications
- Analytics
- Admin

This keeps ownership simple while preserving clean boundaries.

---

# 4. High-Level Topology

```text
Browser / Mobile Web
        |
        v
Next.js Application (Vercel)
        |
        +--> Server Components / Route Handlers / Server Actions
        |
        +--> Supabase Auth
        |
        +--> PostgreSQL
        |
        +--> Supabase Storage
        |
        +--> Supabase Realtime
        |
        +--> Upstash Redis
        |
        +--> Resend
        |
        +--> PostHog
        |
        +--> Sentry
```

Admin/moderation should be a protected area in the same application initially.

---

# 5. Client / Server Boundary

Triply should treat the browser as untrusted.

The client may:
- render profiles,
- submit forms,
- request discovery,
- send user actions,
- subscribe to authorized realtime events.

The client must **not** be trusted to:
- decide match eligibility,
- create a match directly,
- change another user's data,
- bypass block/report rules,
- send a message without server authorization,
- assign moderation state,
- normalize destination identity,
- expose hidden trip/profile records.

All sensitive mutations must be authorized server-side.

---

# 6. Application Layers

Recommended layers:

## UI
React components and pages.

## Application Services
Business operations such as:
- createTrip
- getDiscoveryCandidates
- likeUser
- blockUser
- sendMessage
- submitReport

## Domain Logic
Pure functions for:
- overlap calculation
- preference compatibility
- match-market rules
- ranking
- moderation state transitions

## Data Access
Typed database queries and transactions.

## External Integrations
- Resend
- PostHog
- Sentry
- Redis
- destination provider

Keep domain logic independent from UI whenever practical.

---

# 7. Suggested Project Structure

```text
src/
  app/
    (public)/
    (auth)/
    (product)/
    admin/
    api/

  components/
    ui/
    profile/
    trip/
    discovery/
    match/
    chat/
    safety/

  domains/
    auth/
    profiles/
    trips/
    destinations/
    discovery/
    matching/
    messaging/
    safety/
    moderation/
    notifications/

  lib/
    db/
    auth/
    analytics/
    email/
    rate-limit/
    storage/
    observability/

  types/
  config/
  tests/
```

Avoid dumping business rules into page components.

---

# 8. Authentication Architecture

Use Supabase Auth.

## MVP method
Primary:
- email magic link or OTP

Optional:
- Google
- Apple later

## Rules
- verified account required before onboarding completion
- all private product routes require authenticated session
- server verifies user identity independently of client-supplied IDs
- user ID comes from session, never request body

## Session security
- secure HTTP-only/session handling where supported
- short-lived access tokens
- refresh-token rotation through provider
- revoke sessions on ban/delete

---

# 9. Database Access Strategy

Use two access modes:

## User-context access
For safe, simple own-record operations where RLS is clear.

## Trusted server/service access
For:
- discovery queries
- match creation
- moderation
- block workflows
- admin operations
- sensitive multi-table transactions

Do not expose complex matching tables directly to the client.

---

# 10. Row-Level Security

RLS should be enabled on user-sensitive tables.

Minimum principles:

- user can update own profile only
- user can manage own trips only
- user cannot enumerate other users arbitrarily
- messages readable only by match participants
- reports not readable by reported user
- moderation tables inaccessible to ordinary users
- blocks managed only by blocker
- likes not broadly enumerable

Discovery should preferably return a server-composed safe view rather than raw table access.

---

# 11. Database Functions / RPC

Good candidates for controlled DB functions or transactional server operations:

- `create_like_and_maybe_match`
- `block_user`
- `submit_report`
- `get_discovery_candidates`
- `mark_trip_complete`
- `close_match`

Use DB functions where they improve atomicity and reduce race conditions.

Do not push all business logic into SQL.

---

# 12. Matching Engine Architecture

The matching engine remains rule-based.

Execution pipeline:

1. validate requester
2. validate selected trip
3. query same `match_market_id`
4. apply date-overlap filter
5. apply active-account/profile filters
6. apply mutual preferences
7. apply blocks/reports
8. apply prior likes/passes/matches
9. deduplicate users
10. rank
11. paginate

On Like:
- revalidate hard eligibility
- insert like idempotently
- check reciprocal
- create match transactionally

---

# 13. Destination Provider

Triply needs normalized places.

Recommended approach:
Use an external place-search provider for autocomplete, but store Triply-owned canonical destination records.

Potential providers:
- Google Places
- Mapbox Search
- GeoNames / curated dataset for lower cost

Important:
External provider result IDs should not become Triply's only source of truth.

Store:
- external_place_id
- canonical name
- country
- coordinates
- timezone
- Triply `match_market_id`

---

# 14. Bali / Travel-Market Mapping

Use a Triply-controlled market layer.

Example:

```text
Bali Market
  |- Bali
  |- Canggu
  |- Seminyak
  |- Ubud
  |- Denpasar
```

All can share one `match_market_id` if product testing confirms that this feels natural.

This mapping should be editable without destructive migrations.

---

# 15. Messaging Architecture

MVP messaging should use:

- PostgreSQL as durable source of truth,
- Supabase Realtime for delivery/update subscriptions.

Flow:

1. client submits message
2. server validates:
   - session
   - active match
   - block state
   - sender account status
   - rate limit
3. insert message
4. realtime update reaches recipient
5. notification generated if recipient inactive

Do not rely on realtime delivery as persistence.

---

# 16. Message Ordering

Use:
- server `created_at`
- unique message ID

UI should order by:
`created_at, id`

Avoid client-clock ordering.

---

# 17. Realtime Channels

Subscribe only to authorized data.

Recommended:
- one channel per active match/conversation
- or secure user-scoped stream if provider architecture makes that cleaner

Do not create global message channels.

Presence/typing indicators are optional and should be deferred if they add complexity.

---

# 18. Storage Architecture

Supabase Storage buckets:

## Profile photos
Private or signed-access strategy preferred.

Potential structure:

```text
profile-photos/
  {user_id}/
    {photo_id}.webp
```

Server/database determines which photos are public-safe.

## Rules
- validate MIME
- size limit
- image resize/compression
- strip unnecessary EXIF metadata
- avoid original filenames where possible
- delete storage object when retention policy allows

---

# 19. Image Processing

Before final storage:
- resize to controlled maximum dimensions
- compress
- generate optimized WebP/AVIF variants if practical
- strip location metadata

Important:
Photos may contain EXIF GPS information. Strip metadata before serving.

---

# 20. Email Architecture

Use Resend for:
- auth-adjacent transactional email if needed
- account notices
- match/message digests later
- safety notices
- deletion confirmation
- moderation/support notifications where appropriate

Do not put sensitive message content in email.

Use a dedicated transactional sender domain.

---

# 21. Notifications

MVP:
- in-app
- email where useful

Later:
- web push / native push

Notification pipeline:

1. domain event occurs
2. notification record created
3. preference check
4. in-app delivery
5. optional email delivery

Avoid synchronous email calls blocking user actions.

---

# 22. Background Jobs

Triply will need scheduled/background work.

Examples:
- complete past trips
- notification digests
- cleanup expired passes
- moderation reminders
- account-deletion processing
- analytics aggregation
- stale upload cleanup

Early implementation options:
- Vercel Cron
- Supabase scheduled functions
- queue service later

Keep jobs idempotent.

---

# 23. Rate Limiting

Use Upstash Redis or equivalent.

Rate-limit:
- auth attempts
- OTP/magic link resend
- likes
- messages
- reports
- photo uploads
- destination search
- admin sensitive actions

Use separate keys by:
- user ID
- IP where appropriate
- route/action

Do not rely on IP alone.

---

# 24. Abuse Controls

MVP:
- verified email
- rate limits
- block/report
- spam thresholds
- moderation
- account states

Later:
- device fingerprint/risk signals
- suspicious account clustering
- link reputation
- automated content moderation
- verification

Avoid invasive anti-abuse tooling before necessary.

---

# 25. Admin Architecture

Admin should be a protected internal route group.

Example:
`/admin`

Requirements:
- separate admin authorization/role check
- no client-only gating
- audit all moderation actions
- minimal user-data access
- sensitive views server-rendered where useful

Admin functions:
- report queue
- case detail
- user review
- warn/restrict/suspend/ban
- audit trail

---

# 26. Authorization Model

Recommended roles:
- `user`
- `moderator`
- `admin`

Keep roles minimal.

Do not encode business-specific moderation states as auth roles.

Authorization should combine:
- authenticated user
- system role
- ownership
- resource relationship
- account status

---

# 27. Analytics Architecture

Use PostHog for:
- acquisition
- funnel
- cohort analysis
- feature usage
- retention

Server-side capture for critical events where possible:
- signup completed
- trip created
- match created
- report submitted

Client events may cover:
- screen views
- interaction detail

Avoid sensitive content in analytics.

---

# 28. Analytics Identity

Use:
- internal random user UUID after signup
- anonymous ID pre-signup
- alias/link when user converts

Do not use email as analytics identity.

---

# 29. Observability

Use Sentry for:
- frontend exceptions
- server exceptions
- route/action errors
- performance traces where useful

Also log structured operational events:
- match transaction failures
- realtime failures
- moderation action failures
- email failures
- cron failures

---

# 30. Logging

Use structured logs.

Include:
- request ID
- user ID when safe
- domain
- action
- result
- duration

Never log:
- passwords
- auth tokens
- message content by default
- full email unnecessarily
- exact DOB
- sensitive report details unless required in protected audit systems

---

# 31. Health Checks

Provide:

## `/api/health`
Basic app health.

## `/api/ready`
Checks essential dependencies:
- database
- auth/provider reachability as appropriate

Avoid exposing sensitive diagnostics publicly.

---

# 32. Error Handling

Create typed application errors:

- Unauthorized
- Forbidden
- ValidationError
- NotFound
- Conflict
- RateLimited
- SafetyRestricted
- DependencyUnavailable

Map them to stable user-safe responses.

Do not leak database/internal errors to clients.

---

# 33. Idempotency Strategy

Required for:
- likes
- match creation
- report submission retry
- account deletion request
- background jobs

Use:
- DB uniqueness
- transactions
- optional idempotency keys for external-facing actions

---

# 34. Security Headers

Production should include:
- strict HTTPS
- HSTS
- Content-Security-Policy
- frame protections
- Referrer-Policy
- Permissions-Policy
- secure cookies

Review CSP carefully for PostHog/Sentry/Resend-related integrations.

---

# 35. CSRF / Request Security

For authenticated browser mutations:
- use framework/provider protections
- validate origin where appropriate
- prefer same-site cookies
- do not trust arbitrary cross-origin requests

---

# 36. Input Validation

Use a shared schema library such as **Zod**.

Validate:
- all API inputs
- server actions
- query parameters
- destination provider responses where needed
- admin actions

Never rely only on frontend validation.

---

# 37. Data Serialization

Public DTOs should be explicit.

Example:
`PublicDiscoveryProfile`

Should include only:
- safe profile fields
- safe trip fields
- overlap summary

Do not spread entire DB rows into API responses.

---

# 38. Secrets Management

Store secrets only in deployment environment settings.

Examples:
- Supabase service role
- Resend key
- PostHog server key if used
- Sentry DSN
- destination API key
- Redis token

Never expose server-only keys through `NEXT_PUBLIC_*`.

---

# 39. Environment Strategy

Recommended:

- local
- preview
- staging
- production

At minimum:
- development
- production

Prefer a dedicated staging database before closed launch.

Never test moderation/deletion workflows against production user data casually.

---

# 40. Vercel Deployment

Use Vercel for:
- production
- preview deployments
- protected staging if needed

Configure:
- production domain
- environment-specific variables
- deployment protection for staging/admin previews
- server regions near primary early user base where possible

---

# 41. Database Environments

Use separate Supabase projects for:
- staging
- production

Local Supabase can be used during development.

Never reuse production service-role keys locally.

---

# 42. CI/CD

Git-based workflow.

Recommended pipeline:

1. install dependencies
2. lint
3. typecheck
4. unit tests
5. database/schema checks
6. integration tests
7. build
8. deploy preview
9. E2E smoke tests
10. production deploy after approval

For founder speed, keep pipeline fast but non-negotiable on critical checks.

---

# 43. Branching

Recommended simple model:
- `main` = production-ready
- short-lived feature branches
- preview deployment per PR/branch

Avoid complex Gitflow.

---

# 44. Database Migration Workflow

Use version-controlled SQL migrations.

Flow:
1. develop migration locally
2. test from clean database
3. test against staging
4. verify backward compatibility
5. backup/checkpoint
6. production migration
7. smoke test

Never edit production schema manually without a migration record.

---

# 45. Testing Strategy

## Unit tests
Pure logic:
- date overlap
- age compatibility
- preference compatibility
- ranking
- account-state transitions

## Integration tests
Database/service operations:
- like → match
- block
- report
- trip edits
- message authorization

## E2E tests
Critical flows:
- signup
- onboarding
- create trip
- discovery
- mutual like
- chat
- report/block
- admin enforcement

## Security tests
- unauthorized access
- RLS
- IDOR/resource ownership
- stale sessions
- suspended account restrictions

---

# 46. Test Framework Direction

Likely:
- Vitest for unit/integration
- Playwright for E2E

Use database fixtures designed around Triply edge cases.

---

# 47. Critical Automated Test Suite

Must cover:

- exact one-day trip overlap
- incompatible preference exclusion
- block override
- simultaneous like race
- duplicate like retry
- one active match per pair
- suspended user cannot send
- cancelled trip excluded from discovery
- private fields absent from discovery DTO
- moderator action logged
- message requires active match
- deletion hides profile

---

# 48. Performance Strategy

Do not prematurely optimize.

Priorities:
- optimized profile images
- indexed trip queries
- cursor pagination
- server-side filtering
- lazy load noncritical UI
- efficient chat pagination

Measure before adding complex caches.

---

# 49. Discovery Performance

Initial target:
- candidate query should remain comfortably interactive for early cohorts
- avoid N+1 queries
- prejoin needed profile/trip fields
- compute shared-interest counts efficiently

If discovery becomes expensive:
1. inspect query plan
2. improve indexes
3. materialize safe derived signals if necessary
4. only then consider heavier caching

---

# 50. Chat Pagination

Use cursor pagination by:
- `created_at`
- `id`

Load latest messages first and fetch older history on demand.

Do not load entire chat history at once.

---

# 51. Data Privacy & Compliance

Before public scale, obtain legal review for:
- privacy policy
- terms
- dating/safety disclaimers
- data retention
- account deletion
- age handling
- international data processing
- identity verification if introduced

Architecture should support:
- user data export later
- deletion/anonymization
- consent/version tracking if required

---

# 52. Disaster Recovery

At minimum:
- automated DB backups
- storage backup/recovery strategy
- migration rollback/runbook
- production incident contacts/process
- restore test before significant growth

---

# 53. Incident Response

Create a simple founder runbook:

1. detect
2. assess severity
3. contain
4. preserve evidence
5. communicate if necessary
6. fix
7. postmortem
8. add regression test

High-severity safety/security incidents take precedence over feature work.

---

# 54. Dependency Philosophy

Use external services where they:
- reduce founder workload,
- are mature,
- handle commodity infrastructure.

Do not outsource:
- matching rules
- safety decisions
- core marketplace data model
- product analytics interpretation

Triply must own its core product logic.

---

# 55. Cost Discipline

Early architecture should remain inexpensive.

Likely cost centers:
- Vercel
- Supabase
- Resend
- PostHog
- Sentry
- Redis
- destination API
- identity verification later

Monitor cost per:
- active user
- active trip
- message volume
- image storage

Avoid adding paid infrastructure before required.

---

# 56. Native Mobile Path

Do not build native apps yet.

Architecture should still make later mobile possible by keeping core business logic behind stable server APIs/services.

Future options:
- React Native / Expo
- native iOS/Android

A native app should become a strategic decision based on:
- retention
- messaging usage
- push notification need
- user feedback

---

# 57. PWA

Possible intermediate step:
- installable web app
- web push later
- app-like navigation

Do not make PWA requirements block MVP launch.

---

# 58. Recommended Initial Technology Decisions

| Area | Decision |
|---|---|
| Frontend | Next.js 16 + React 19 + TypeScript |
| Styling | Tailwind + Triply design tokens |
| Motion | Framer Motion |
| Database | PostgreSQL |
| BaaS | Supabase |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| Realtime | Supabase Realtime |
| Email | Resend |
| Analytics | PostHog |
| Error monitoring | Sentry |
| Rate limiting | Upstash Redis |
| Hosting | Vercel |
| Validation | Zod |
| Unit tests | Vitest |
| E2E | Playwright |

---

# 59. Locked Architecture Decisions

| Decision | Status |
|---|---|
| Web-first MVP | **Locked for MVP** |
| Modular monolith | **Locked** |
| Next.js/TypeScript | **Locked** |
| PostgreSQL | **Locked** |
| Supabase foundation | **Locked** |
| Server-authorized matching/mutations | **Locked** |
| Postgres is messaging source of truth | **Locked** |
| Realtime is delivery layer, not persistence | **Locked** |
| RLS + server-side boundaries | **Locked** |
| Separate staging/production data | **Locked before cohort launch** |
| Microservices | **Rejected for MVP** |
| Native apps | **Deferred** |
| AI matching infrastructure | **Deferred** |

---

# 60. Open Architecture Decisions

Resolve during implementation planning:

- magic link vs email OTP primary auth UX
- Google/Apple auth at MVP
- exact destination provider
- whether discovery logic is route handler vs DB RPC vs hybrid
- exact admin role implementation
- exact PostHog server/client event split
- whether Redis is needed from day one or introduced at first abuse/load signal
- staging environment depth during earliest build
- web-push support before/after closed cohort
- image moderation provider timing
- exact verification provider if identity verification becomes necessary

---

# 61. Architecture Release Gates

Before closed cohort:

## Security
- RLS reviewed
- no service keys exposed
- critical routes authorization-tested
- rate limits enabled where required

## Product
- matching transaction safe
- chat persistence reliable
- blocks/reports override interactions

## Reliability
- migrations tested
- backups active
- error monitoring active

## Analytics
- critical events verified
- acquisition attribution preserved

## Moderation
- admin access protected
- actions audited

## Deployment
- staging works
- production env isolated
- rollback path understood

---

# 62. Next Step

## Triply UI/UX Specification v1.0

The next document should turn the PRD and user flows into exact screen and component behavior:

- information architecture
- navigation
- onboarding screens
- trip creation
- discovery cards
- date-overlap component
- profile detail
- match state
- chat
- trips
- settings
- safety/report flows
- admin screens
- responsive behavior
- loading/empty/error states
- design tokens
- interaction/motion rules

After UI/UX Specification:

1. Implementation Roadmap
2. Build kickoff

---

# Founder Conclusion

Triply should be architected like a real consumer product, but operated like an early-stage founder company.

That means:

> **Strong data integrity, strong safety boundaries, clean modular design, and minimal infrastructure complexity.**

We should spend engineering effort on the things that define Triply:
- trip matching,
- marketplace correctness,
- messaging,
- trust,
- safety,
- analytics.

Not on infrastructure theater.
