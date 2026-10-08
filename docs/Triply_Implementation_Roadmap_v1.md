# Triply Implementation Roadmap v1.0

**Founder Execution Document**  
**Date:** 6 October 2026  
**Stage:** Final pre-build planning  
**Status:** Ready-to-execute roadmap for MVP build, testing, staging, closed-cohort launch, and post-launch measurement

## 1. Objective

This document converts Triply strategy and product specifications into an execution plan.

The roadmap answers:
- what to build first,
- what depends on what,
- how to sequence database and product work,
- when to test,
- when to use staging,
- what defines “ready”,
- when to launch a closed cohort,
- what metrics to watch after launch.

Operating principle:

> **Build the smallest production-quality system that can prove Triply's core loop safely and measurably.**

## 2. Planning inputs

This roadmap is based on:
1. Founder Market Decision Brief
2. Business Plan
3. Brand Strategy
4. Visual Identity
5. Acquisition & Ad Campaign System
6. Founder Blueprint
7. PRD
8. User Flow Specification
9. Safety Architecture
10. Matching Logic Specification
11. Data Model
12. Technical Architecture
13. UI/UX Specification

These are the current source of truth.

## 3. Build philosophy

Triply should be built in vertical slices.

Preferred pattern:
- schema
- server logic
- UI
- validation
- analytics
- tests

for one product slice at a time.

Avoid building all frontend first and integrating the backend later.

## 4. Build phases

### Phase 0 — Repository & Environment Foundation
### Phase 1 — Data Model & Auth
### Phase 2 — Profile & Onboarding
### Phase 3 — Trips & Destinations
### Phase 4 — Discovery & Matching
### Phase 5 — Matches & Chat
### Phase 6 — Safety & Moderation
### Phase 7 — Notifications, Analytics & Observability
### Phase 8 — UI Polish, Accessibility & Reliability
### Phase 9 — Staging & Closed-Cohort Readiness
### Phase 10 — Bali Closed Cohort Launch
### Phase 11 — Post-Launch Iteration

## 5. Phase 0 — Repository & Environment Foundation

### Goals
Create a clean production-grade base.

### Tasks
- initialize/confirm Next.js 16 app
- TypeScript strict mode
- Tailwind and design tokens
- linting/formatting
- Vitest
- Playwright
- environment validation
- Supabase local/staging setup
- PostHog
- Sentry
- Resend
- deployment config
- basic CI

### Exit gate
No feature work starts until:
- build passes
- lint/typecheck pass
- test runner works
- staging exists

## 6. Phase 1 — Database & Authentication

### Database migrations
Create:
- users
- profiles
- photos
- interests
- preferences
- destination markets
- destinations
- trips
- likes
- passes
- matches
- messages
- blocks
- reports
- moderation
- notifications
- audit records

### Seed data
- interests
- initial destination market
- Bali mappings for development

### Auth
- email magic link or OTP
- verified session
- private route protection
- logout
- account status checks

### Security
- baseline RLS
- service-role isolation
- no client-side direct match creation

### Exit gate
A verified user can sign in and safely access only their own private product shell.

## 7. Phase 2 — Profile & Onboarding

### Build order
1. Identity
2. Photos
3. Bio/interests
4. Matching preferences
5. Onboarding persistence
6. Profile completeness

### Tests
- under-18 rejection
- incomplete profile
- image upload failure
- resume onboarding
- private-field protection

### Exit gate
User can complete a valid profile and retain state across refresh/re-login.

## 8. Phase 3 — Trips & Destinations

### Tasks
- destination provider integration
- Triply canonical destination mapping
- `match_market_id`
- create/edit/cancel/list trips
- date validation
- timezone-safe DATE storage
- Bali market mapping

### Tests
- duplicate trip
- invalid dates
- destination alias resolution
- cancelled/completed exclusion

### Exit gate
A user can create a valid normalized future trip.

## 9. Phase 4 — Discovery & Matching

### Tasks
- selected trip context
- same market filter
- date overlap
- mutual age/gender compatibility
- account/profile eligibility
- block/report suppression
- like/pass/match exclusions
- ranking
- cursor pagination
- date-overlap UI
- like/pass actions
- idempotent like transaction
- atomic reciprocal match creation

### Critical tests
- one-day overlap
- no overlap
- blocked pair
- simultaneous likes
- duplicate like
- stale candidate
- multi-trip user
- person-level deduplication

### Exit gate
Two compatible seeded users can discover each other, like each other, and produce exactly one match.

## 10. Phase 5 — Matches & Chat

### Tasks
- match list
- unread state
- text chat
- realtime subscriptions
- durable DB persistence
- retry state
- message history pagination
- active-match authorization

### Tests
- unauthorized chat
- inactive match
- network retry
- ordering
- duplicate send protection
- suspended user attempt

### Exit gate
Matched users can exchange persistent messages across sessions.

## 11. Phase 6 — Safety & Moderation

### Tasks
- block
- report
- unmatch
- Safety Center
- moderation queue
- report detail
- warn/restrict/suspend/ban
- audit logs
- underage handling
- account-status enforcement

### Tests
- block after match
- report after unmatch
- banned user login
- underage concern
- moderation audit
- deleted user with open report

### Exit gate
A real test report can be submitted, reviewed, actioned, and audited end-to-end.

## 12. Phase 7 — Notifications, Analytics & Observability

### Notifications
- new match
- new message
- trip reminders
- account/safety notices

### Analytics
Verify:
- signup
- profile complete
- trip created
- discovery opened
- like
- match
- conversation started
- two-way conversation
- report/block
- return session

### Attribution
- source
- medium
- campaign
- content

### Observability
- Sentry
- structured logs
- health endpoint
- readiness endpoint
- cron monitoring

### Exit gate
Founder can trace:
**campaign → signup → trip → like → match → conversation**

## 13. Phase 8 — UX Polish, Accessibility & Reliability

### Tasks
- loading states
- empty states
- error/retry states
- low-liquidity state
- mobile responsiveness
- keyboard/focus behavior
- reduced motion
- accessible dialogs
- copy review
- image performance
- discovery performance
- chat pagination
- session recovery

### Exit gate
Core experience passes mobile-browser usability and accessibility review.

## 14. Phase 9 — Staging & Closed-Cohort Readiness

### Data
- staging migrations clean
- test data separated
- production DB isolated

### Security
- RLS reviewed
- service keys private
- auth checked
- no private-field leakage

### Safety
- report/block/unmatch tested
- moderation protected
- audit logging works

### Reliability
- backups enabled
- monitoring active
- health checks green
- rollback path known

### Analytics
- critical events verified
- UTM attribution verified

### Product
- core loop passes E2E

### Exit gate
No critical open blocker.

## 15. Phase 10 — Closed Cohort Launch

### Recommended first cohort
**Bali**

Exact dates should be chosen based on:
- seasonality
- real trip demand
- content/community opportunity
- enough lead time

### Launch objective
Create a useful concentration of real travelers.

### Channels
- Instagram
- destination landing page
- community outreach
- SEO
- referrals

Do not expand to a second destination until the first cohort produces interpretable marketplace data.

## 16. Closed-Cohort Success Metrics

### Acquisition
- qualified visits
- signup conversion
- trip creation conversion

### Liquidity
- % trips with ≥1 eligible profile
- % trips with ≥5 eligible profiles
- median candidates/trip

### Connection
- like rate
- mutual match rate
- conversation-start rate
- two-way conversation rate

### Retention
- return sessions
- return to chat
- repeat discovery
- second trip later

### Safety
- report rate
- block rate
- moderation response time

## 17. Diagnostic framework

If signups are low:
- inspect creative, positioning, landing page

If signups are good but trip creation is low:
- inspect onboarding friction and trust around sharing dates

If trip creation is good but discovery is empty:
- liquidity/cohort problem

If discovery exists but likes are low:
- relevance/profile quality/target audience problem

If matches happen but chats do not:
- intent or conversation-friction problem

If chats happen but retention is low:
- episodic value/lifecycle problem

## 18. Dependency graph

```text
Foundation
   |
   v
Auth + Schema
   |
   v
Profile
   |
   v
Trip + Destination
   |
   v
Discovery Eligibility
   |
   v
Like + Match
   |
   v
Chat
   |
   +------> Safety/Moderation
   |
   +------> Notifications
   |
   v
Analytics + Reliability
   |
   v
Closed Cohort Launch
```

## 19. Migration order

1. extensions/enums
2. users
3. profiles
4. photos
5. interests
6. preferences
7. destination markets
8. destinations
9. trips
10. likes
11. passes
12. matches
13. messages
14. blocks
15. reports
16. moderation
17. notifications
18. audit/attribution
19. RLS/policies
20. helper functions/indexes

## 20. Testing milestones

### A
Auth + profile tests pass.

### B
Trip/date/destination tests pass.

### C
Matching-engine suite passes.

### D
Like/match race tests pass.

### E
Chat authorization/realtime tests pass.

### F
Safety workflows pass.

### G
Full E2E passes on staging.

No launch before G.

## 21. AI-assisted development workflow

AI should accelerate implementation, not own architecture.

Recommended loop:
1. choose milestone
2. provide only relevant spec sections
3. ask for implementation plan first
4. review plan
5. implement one vertical slice
6. run tests
7. review diff
8. fix issues
9. update specs only if behavior intentionally changes
10. commit

Avoid giant “build all of Triply” prompts.

## 22. Coding-agent prompt structure

Each task prompt should include:
- Context
- Source of truth
- Goal
- Constraints
- Acceptance criteria
- Required output

Required output should usually include:
- implementation
- tests
- migration if needed
- concise report

## 23. Definition of done

A feature is done only when:
- requirements met
- authorization correct
- DB constraints correct
- loading/error/empty states handled
- analytics implemented
- tests pass
- E2E updated if core flow
- mobile checked
- accessibility checked
- no critical runtime errors
- docs updated if behavior changed

## 24. Founder workload priorities

Spend time in this order:
1. Product decisions
2. Architecture review
3. Core implementation
4. Testing/correctness
5. User acquisition
6. Analytics review
7. Polish

Do not over-invest early in:
- animation perfection
- unused admin features
- generic design-system expansion
- monetization
- speculative scale

## 25. Suggested cadence

Planning target:

### Week 1
Foundation + Auth + schema

### Week 2
Profile + onboarding

### Week 3
Trips + destination normalization

### Week 4
Discovery + matching

### Week 5
Likes + match + chat

### Week 6
Safety + moderation

### Week 7
Analytics + notifications + observability

### Week 8
UX polish + staging + E2E + cohort prep

This is a target, not a promise. Quality gates matter more than dates.

## 26. Parallel growth during build

Maintain:
- 2–3 useful social posts/week
- waitlist collection
- destination-interest tracking
- content testing
- early user conversations

Purpose:
build the first cohort while the app is being built.

## 27. Pre-launch recruitment

Recruit around one destination/date window.

Collect:
- destination
- travel dates
- willingness to test
- preferred contact
- basic intent

Do not fill the cohort with irrelevant users.

## 28. Closed-cohort launch checklist

### Product
- auth
- profile
- trip
- discovery
- like
- match
- chat

### Safety
- block
- report
- moderation
- underage handling
- safety center

### Technical
- production deployment
- backups
- monitoring
- analytics
- rate limits
- health checks

### Legal
- privacy
- terms
- community standards
- safety guidance

### Growth
- landing page
- UTM links
- launch creatives
- cohort list
- support contact

## 29. Launch day

1. verify production
2. check health/readiness
3. verify analytics
4. invite small first batch
5. monitor onboarding
6. monitor errors
7. monitor empty discovery
8. monitor chat
9. monitor safety
10. expand slowly

Do not invite everyone at once.

## 30. First 72 hours

Review:
- signup failures
- profile completion
- trip creation
- candidate pool size
- matching
- chat delivery
- support
- reports/blocks
- performance
- analytics accuracy

Fix correctness before adding features.

## 31. First 2 weeks

Daily founder review:
- cohort size
- liquidity
- match rate
- conversation rate
- empty-state frequency
- safety
- retention

Talk to:
- users who matched
- users who saw nobody
- users who signed up but did not create a trip
- users who matched but did not message

## 32. Post-launch decisions

### Scale
If trip creation, liquidity, matching, conversations, and safety are healthy.

### Iterate
If one funnel layer is weak.

### Narrow
If only certain destination/date cohorts work.

### Reposition
If users strongly prefer social connection over dating, or vice versa.

### Pause
If the core loop repeatedly fails despite focused fixes.

## 33. Do not build during first cohort

Do not add:
- AI match scores
- video
- native apps
- bookings
- itinerary tools
- feeds
- group chat
- boosts
- subscriptions
- super likes

unless real behavior justifies them.

## 34. First expansion rule

Add a second destination only when:
- first cohort gives interpretable data
- onboarding is stable
- discovery/match/chat work
- safety load is manageable
- acquisition process is repeatable

## 35. Founder dashboard

Before launch, show:
- campaign visitors
- signup conversion
- profile completion
- trip creation
- trips by destination/week
- eligible candidates per trip
- likes
- matches
- conversations
- return sessions
- reports
- blocks
- major errors

## 36. Build kickoff sequence

First build session:
1. repo audit / initialize app
2. environment setup
3. CI
4. Supabase local/staging
5. migration baseline
6. auth shell
7. protected product shell

Do not start with discovery cards or animations.

## 37. First coding milestone

### Milestone 1 — Foundation

A verified user can:
- sign in
- access protected app
- sign out

And the project has:
- clean CI
- staging
- Supabase connection
- error monitoring
- tests

Only then start profile onboarding.

## 38. Implementation decision log

| Decision | Status |
|---|---|
| Build in vertical slices | **Locked** |
| Foundation before feature UI | **Locked** |
| Closed cohort before broad launch | **Locked** |
| Bali first cohort | **Working hypothesis** |
| No second destination until first is interpretable | **Locked** |
| AI agents used in scoped tasks | **Locked** |
| Every feature requires tests | **Locked** |
| Product behavior changes specs only deliberately | **Locked** |
| Gradual launch | **Locked** |
| First 72h closely monitored | **Locked** |

## 39. Planning completion criteria

Planning is complete when:
- Founder Blueprint exists
- PRD exists
- User flows exist
- Safety architecture exists
- Matching logic exists
- Data model exists
- Technical architecture exists
- UI/UX specification exists
- Implementation roadmap exists

**Status: COMPLETE**

From here, create new docs only when implementation or evidence requires them.

## 40. Immediate next step

# BUILD KICKOFF

The planning phase is complete.

Next:
- create/confirm repository
- verify whether the current landing-page codebase should host the app or remain separate
- configure staging/production
- create initial migrations
- implement auth shell
- establish CI/test baseline

# Founder conclusion

Triply is sufficiently defined to build.

The discipline from here is:

> **Do not let implementation drift turn Triply into a different product than the one we deliberately designed.**

Build the core loop first. Measure it. Then let real users earn the next features.
