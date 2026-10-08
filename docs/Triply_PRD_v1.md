# Triply Product Requirements Document (PRD) v1.0
**Founder Product Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Product definition  
**Status:** Working source of truth for MVP scope, requirements, acceptance criteria, safety, analytics, and release readiness

---

# 1. Product Summary

## Product
**Triply**

## Product category
Travel dating / pre-trip connection

## Core product thesis
Triply helps travelers discover compatible people who will be in the same destination during overlapping travel dates, so they can connect before arrival.

## Core loop

> **Account → Profile → Future Trip → Relevant Discovery → Like → Mutual Match → Chat**

The MVP is successful if users can complete this loop reliably, safely, and with enough marketplace density to make the experience useful.

---

# 2. Product Goal

Build the smallest serious production-ready product that can answer:

> **Will travelers create real future trips, discover relevant people, match, start conversations, and return?**

The MVP is not intended to prove every future Triply business model or feature.

It is designed to validate:
- trip creation intent
- destination/date matching value
- marketplace liquidity
- match behavior
- conversation behavior
- trust/safety usability
- repeat trip behavior

---

# 3. Product Principles

1. **Trip-first, not swipe-first**
2. **Density before scale**
3. **Safety before aggressive growth**
4. **Simple matching before “AI matching”**
5. **Useful supply over total registrations**
6. **Clear date overlap is a core UX element**
7. **Exact accommodation/location remains private**
8. **Every key action is measurable**
9. **No feature enters MVP unless it supports the core loop**
10. **The product should feel production-ready, not like a prototype**

---

# 4. User Roles

## 4.1 Traveler
Primary end user.

Can:
- sign up
- create/edit profile
- create/manage trips
- discover eligible people
- like/pass
- match
- chat
- block/report/unmatch
- manage account/privacy

## 4.2 Moderator/Admin
Internal role.

Can:
- review reports
- inspect reported accounts/content
- warn/suspend/ban users
- review moderation history
- resolve cases
- manage abuse categories
- view limited operational analytics

## 4.3 System
Automated actor.

Responsible for:
- eligibility checks
- match creation
- trip-date overlap logic
- notifications
- anti-spam limits
- moderation flags
- analytics events

---

# 5. Primary Persona

## Independent Traveler
Approximate initial range: **21–35**

Characteristics:
- planning an upcoming leisure trip
- solo or semi-solo traveler
- comfortable with dating/social apps
- open to romantic or meaningful social connection
- willing to share destination and travel dates
- prefers to talk before meeting
- expects modern trust and safety controls

---

# 6. Jobs To Be Done

## Core JTBD
> “When I have an upcoming trip, help me discover compatible people who will be there during the same dates so I can decide whether to connect before I arrive.”

## Supporting jobs
- create a trustworthy profile
- communicate travel intent
- understand trip overlap quickly
- avoid irrelevant profiles
- control who can contact me
- stop unwanted contact
- return to active matches/conversations
- create another trip later

---

# 7. MVP Scope Overview

## Included
1. Authentication
2. Age gate
3. Onboarding
4. User profile
5. Photos
6. Interests
7. Dating/matching preferences
8. Trip creation
9. Destination normalization
10. Date overlap
11. Discovery
12. Like/pass
13. Mutual match
14. Chat
15. Notifications
16. Block
17. Report
18. Unmatch
19. Basic moderation/admin
20. Analytics
21. Privacy settings
22. Account deletion

## Excluded from MVP
- AI compatibility scoring
- video profiles
- voice notes
- travel bookings
- hotel/flight integrations
- itinerary planner
- group trips
- public social feed
- map-first discovery
- native apps
- subscription billing
- boosts/super likes
- influencer system
- social stories
- advanced identity verification unless needed for safety launch
- live location sharing
- exact hotel/accommodation disclosure

---

# 8. Authentication

## Requirements
Users must be able to:
- create an account
- log in
- log out
- recover access
- verify email
- delete account

## Preferred MVP methods
- email + magic link or OTP
- optionally Google / Apple later if implementation cost is low

## Requirements
- no discovery before account setup
- session persistence
- secure token handling
- brute-force/rate-limit protections

## Acceptance criteria
- valid user can sign up successfully
- invalid/expired verification link fails safely
- logged-out user cannot access private routes
- deleted/suspended users cannot log in normally

---

# 9. Age Gate

## Requirement
Triply is for adults only.

## MVP rule
Minimum age: **18+**

## Acceptance criteria
- user must confirm DOB or birth year/date during onboarding
- underage account cannot proceed
- DOB cannot be casually changed after setup
- underage concern can be reported
- admin can suspend accounts pending review

---

# 10. Onboarding

## Goal
Get the user to a complete-enough profile and first trip with minimal friction.

## Recommended order

### Step 1 — Account
Email verification.

### Step 2 — Basic identity
- first name
- date of birth
- gender
- orientation / who they want to meet

### Step 3 — Profile
- photos
- short bio
- interests
- home city/country
- languages optional

### Step 4 — Matching preferences
- preferred genders
- age range

### Step 5 — First trip
- destination
- arrival date
- departure date

### Step 6 — Ready state
Show eligible people or honest low-liquidity state.

## Acceptance criteria
- onboarding state persists if interrupted
- user can resume
- user cannot enter discovery without minimum required data
- first trip is strongly encouraged before entering discovery

---

# 11. User Profile

## Required fields
- first name
- date of birth
- age derived, not manually stored as editable display
- gender
- profile photo
- short bio
- at least 3 interests
- home city/country
- who they want to meet
- age preference

## Optional fields
- additional photos
- languages
- occupation
- relationship intent
- travel style
- social links later, not MVP default

## Privacy
Do not show:
- email
- full DOB
- exact address
- phone
- exact home location

## Acceptance criteria
- incomplete required fields block discovery
- profile edits update future discovery results
- age updates automatically from DOB
- hidden/private fields never appear in public profile payloads

---

# 12. Profile Photos

## MVP
- minimum 1 photo
- recommended 2–4
- maximum 6

## Requirements
- image upload
- reorder
- delete
- one primary image
- file size/type validation
- image compression/resizing
- moderation-ready storage references

## Safety
Do not support public image URLs that expose internal storage paths if avoidable.

## Acceptance criteria
- primary photo always exists before discovery
- deleted photo disappears from all active profile surfaces
- unsupported files fail gracefully

---

# 13. Interests

## MVP
Use predefined interests for consistency.

Examples:
- beaches
- nightlife
- food
- hiking
- cafés
- photography
- music
- wellness
- culture
- museums
- adventure
- festivals
- remote work
- diving
- surfing

## Requirements
- choose 3–8 interests
- used for context, not hard eligibility in v1

---

# 14. Matching Preferences

## MVP preferences
- genders interested in
- minimum age
- maximum age

## Rules
- user must fall inside the other person's allowed preference
- mutual compatibility is required

## Future
- relationship intent
- languages
- interests
- distance from destination center
- travel style

These should not complicate MVP matching prematurely.

---

# 15. Trip Creation

## Trip fields
- destination
- arrival date
- departure date
- optional note later
- trip status

## Rules
- departure >= arrival
- historical trips cannot be created
- excessively long trips may require validation
- duplicate identical trips should be prevented or merged
- destination must use normalized destination entity

## Trip statuses
- upcoming
- active
- completed
- cancelled

## Acceptance criteria
- valid trip saves correctly
- invalid date ranges rejected
- updating dates recalculates eligibility
- cancelling a trip removes it from active matching
- past trip automatically becomes completed

---

# 16. Destination System

## Requirement
Do not rely on raw user-entered destination strings as the matching key.

Use a normalized destination entity.

## Destination record should support
- canonical name
- country
- region/state optional
- type
- latitude/longitude
- timezone
- external place ID if used

## Matching level
MVP should match at city/destination level.

Examples:
- Bali may need product-specific handling because it is a region/island, not a city.
- Ubud / Canggu / Seminyak decisions should be deliberate.

## Acceptance criteria
- “Bali” entries map consistently
- spelling variants do not create separate markets
- destination changes recalculate matching cohort

---

# 17. Date Overlap Logic

Two trips overlap when:

> `max(arrivalA, arrivalB) <= min(departureA, departureB)`

## Minimum overlap
MVP default: at least **1 calendar day**.

This is a working rule and may be adjusted from evidence.

## Display
Always show overlap clearly.

Example:
- Your trip: Dec 4–12
- Their trip: Dec 6–10
- Overlap: Dec 6–10

## Acceptance criteria
- exact-boundary overlap works correctly
- no overlap excludes candidate
- edited dates update discovery immediately or predictably
- overlap display matches backend eligibility

---

# 18. Discovery

## Goal
Show eligible people relevant to a selected active trip.

## Entry state
User selects or has one active/upcoming trip.

## Card should show
- primary photo
- first name
- age
- destination
- trip dates
- overlap dates
- interests
- short bio
- verification marker if available later

## Actions
- like
- pass
- report/block via secondary menu

## Eligibility filters
Exclude:
- self
- incompatible preferences
- non-overlapping trips
- different destination
- blocked users
- suspended/banned users
- users already passed recently, based on product rule
- users already matched

## Acceptance criteria
- no ineligible user appears
- date overlap is correct
- action is idempotent
- low-liquidity state is honest

---

# 19. Ranking

## MVP ranking
Do not build complex AI ranking.

Recommended deterministic ranking:
1. strongest date overlap
2. profile completeness/quality
3. recent activity
4. shared interests as a soft tie-breaker
5. randomization to avoid static ordering

## Future
Behavioral ranking may come later.

---

# 20. Like / Pass

## Like
Creates one-way interest.

## Pass
Hides candidate for a defined period.

## Requirements
- idempotent like
- duplicate like impossible
- mutual like creates match exactly once
- pass does not notify other user

## Acceptance criteria
- one-way like does not open chat
- mutual like creates one match
- repeated requests do not create duplicates
- block overrides like/match

---

# 21. Match Creation

## Trigger
Two mutually eligible users like each other.

## Match record
Should include:
- user A
- user B
- source trip context
- match status
- created timestamp

## Match states
- active
- unmatched
- blocked
- moderation_closed

## Acceptance criteria
- duplicate match impossible
- match references valid trip context
- both users see same match
- inactive/banned user cannot create new matches

---

# 22. Chat

## MVP features
- 1:1 text messaging
- timestamps
- unread count
- delivery persistence
- basic realtime updates
- block/report access
- chat disabled after unmatch/block

## Not MVP
- voice
- video
- images
- disappearing messages
- group chat
- read receipts optional, likely defer

## Safety
Rate-limit spam.

## Acceptance criteria
- only matched users can message
- unmatched/blocked users cannot send
- message history persists unless policy requires moderation retention
- moderation can access necessary reported message context securely

---

# 23. Notifications

## MVP notification types
- new match
- new message
- new relevant traveler later if technically straightforward
- account/safety notice

## Channels
- in-app
- email where useful

Push notification later if native/PWA strategy supports it.

## Requirements
- notification preferences
- no sensitive content in email subject/body
- prevent notification spam

---

# 24. Block

## Behavior
When A blocks B:
- both disappear from discovery
- match/chat becomes inaccessible
- B cannot contact A
- future trip overlap does not reconnect them

## Privacy
Blocked user should not be told explicit internal details.

## Acceptance criteria
Block is immediate and system-wide.

---

# 25. Unmatch

## Behavior
- active match ends
- chat closes
- users are removed from each other's match list
- user can optionally report during unmatch flow

## Product decision
Unmatch should not automatically equal permanent block unless the user chooses it.

---

# 26. Report

## Categories
- fake profile
- spam/scam
- harassment
- sexual/inappropriate behavior
- underage concern
- impersonation
- safety concern
- other

## Report fields
- category
- optional details
- source context
- reported user
- reporter
- relevant match/message references
- timestamp

## Requirements
- reporter can optionally block immediately
- reported user is not told reporter identity
- high-risk categories can trigger priority review

---

# 27. Moderation/Admin

## MVP admin capabilities
- list open reports
- filter by severity/status
- view reported user profile
- view relevant report context
- inspect prior reports/actions
- warn
- suspend
- ban
- close report
- add internal notes

## Audit requirements
Every admin action should log:
- moderator
- action
- target
- reason
- timestamp

---

# 28. Anti-Spam / Abuse Controls

MVP protections:
- request rate limits
- message rate limits
- like limits if abuse emerges
- account creation throttling
- email verification
- repeated-report detection
- suspicious automation detection where practical

Do not gamify limits as monetization in v1.

---

# 29. Privacy Requirements

## Publicly visible
Only intentional profile and trip-level data.

## Never publicly expose
- email
- phone
- exact accommodation
- exact home address
- full DOB
- auth identifiers
- internal moderation status
- precise live location

## Trip privacy
Show destination and dates only as required for matching.

Exact hotel or live coordinates are not part of MVP.

---

# 30. Account Deletion

Users must be able to request deletion.

## Deletion behavior
- remove profile from discovery immediately
- disable login
- anonymize/delete personal data according to retention/legal requirements
- preserve only legally/safety-required moderation records where appropriate

This policy needs legal/privacy review before public scale.

---

# 31. Trip Completion

When a trip ends:
- status becomes completed
- user is removed from that trip's active discovery
- matches/chats may remain accessible
- prompt for new trip later
- optional post-trip feedback

Do not auto-delete matches.

---

# 32. Empty States

## No eligible people
**Not enough people here yet.**

Support:
**We’ll let you know when more travelers match your dates.**

Actions:
- edit dates
- explore another trip
- invite someone
- enable notification

## No matches
Avoid rejection-coded copy.

## No messages
Encourage natural first message, not manipulative urgency.

---

# 33. Error States

Must handle:
- lost network
- failed image upload
- failed message send
- expired session
- destination service unavailable
- duplicate requests
- stale discovery card
- trip changed while browsing
- account suspended

All errors should be recoverable where possible.

---

# 34. Analytics Requirements

## Acquisition
- `landing_viewed`
- `cta_clicked`

## Auth
- `signup_started`
- `signup_completed`

## Onboarding
- `onboarding_step_completed`
- `profile_completed`

## Trip
- `trip_creation_started`
- `trip_created`
- `trip_updated`
- `trip_cancelled`

## Discovery
- `discovery_opened`
- `eligible_profiles_viewed`
- `profile_opened`
- `like_sent`
- `pass_sent`

## Match
- `match_created`

## Chat
- `conversation_opened`
- `message_sent`
- `conversation_started`
- `two_way_conversation`

## Safety
- `block_created`
- `report_submitted`
- `unmatch_created`

## Retention
- `return_session`
- `second_trip_created`

All events should include safe, non-sensitive contextual properties.

---

# 35. Key Event Properties

Where appropriate:
- destination_id
- destination_name
- trip_start_week
- trip_length_bucket
- overlap_days
- acquisition source/medium/campaign/content
- profile completeness bucket
- cohort identifier

Never send:
- message text
- email
- exact DOB
- sensitive orientation data unless strictly necessary and appropriately handled
- exact location

---

# 36. Core Product Metrics

## Activation
- signup completion
- profile completion
- first trip creation

## Marketplace
- % trips with ≥1 eligible profile
- % trips with ≥5 eligible profiles
- median eligible profiles/trip

## Connection
- like rate
- mutual-match rate
- conversation-start rate
- two-way conversation rate

## Retention
- session return during active trip
- second-trip creation
- conversation return rate

## Safety
- reports per 1,000 active users
- blocks per 1,000 active users
- repeat reports
- moderation response time

---

# 37. Non-Functional Requirements

## Performance
- primary pages should feel fast on typical mobile connections
- discovery interaction should not block on unnecessary requests
- image delivery optimized

## Reliability
- idempotent likes/matches
- durable messages
- recoverable async failures
- no duplicate match creation

## Security
- server-side authorization
- row-level/data-access protection where supported
- secure storage policies
- rate limiting
- secret separation
- audit logging for admin actions

## Accessibility
- WCAG AA target
- keyboard-accessible web UI
- visible focus states
- 44×44 px tap targets
- reduced-motion support
- color not sole status indicator

## Responsive
Mobile-first. Desktop supported.

---

# 38. Product Screens

MVP screen inventory:

1. Landing
2. Sign up / login
3. Verify email
4. Onboarding intro
5. Basic identity
6. Photos
7. Bio/interests
8. Preferences
9. Create trip
10. Onboarding complete
11. Home / active trip
12. Discovery
13. Full profile
14. Match modal/state
15. Matches list
16. Chat
17. Trips list
18. Create/edit trip
19. Profile/settings
20. Safety center
21. Report flow
22. Block/unmatch flow
23. Notifications
24. Empty states
25. Account/privacy settings
26. Delete account
27. Admin login
28. Admin reports queue
29. Admin report detail
30. Admin user action panel

---

# 39. Release Gates

## Gate 1 — Core flow
User can:
- sign up
- complete profile
- create trip
- discover eligible person
- like
- match
- chat

## Gate 2 — Matching correctness
No incorrect destination/date matches in test suite.

## Gate 3 — Safety
Block/report/unmatch fully functional.

## Gate 4 — Privacy
No private field leakage.

## Gate 5 — Analytics
Critical funnel events verified end-to-end.

## Gate 6 — Moderation
Admin can resolve a real report.

## Gate 7 — Reliability
No duplicate likes/matches; chat persistence works.

## Gate 8 — Mobile usability
Core flow passes mobile browser test.

---

# 40. MVP Acceptance Criteria

The MVP is ready for closed cohort launch when:

- account creation works reliably
- required profile data is validated
- first trip can be created/edited/cancelled
- destination normalization is stable
- date overlap is correct
- eligibility filtering is correct
- discovery shows only valid users
- like/pass is idempotent
- mutual like creates exactly one match
- matched users can chat
- blocked/unmatched users cannot contact each other
- report workflow reaches admin
- moderation action is audited
- analytics events fire correctly
- privacy-sensitive fields are protected
- product works on modern mobile browsers
- critical errors are observable

---

# 41. Critical Edge Cases

Must explicitly test:

1. same arrival/departure boundary day
2. user changes dates after sending likes
3. destination renamed/merged
4. mutual like occurs simultaneously
5. user blocks immediately after match
6. user reports after unmatch
7. account suspended during active chat
8. trip cancelled while match exists
9. user has multiple trips to same destination
10. duplicate network request for like
11. message sent during network loss
12. age range changes after matching
13. user turns 18/age calculation boundary
14. timezone boundary around trip dates
15. deleted account referenced by historic report
16. user with no eligible profiles
17. user has two overlapping trips
18. admin action race/conflict
19. abusive rapid messaging
20. profile photo deleted while cached

---

# 42. Open Product Decisions

These require resolution in subsequent specs:

- trip-first vs profile-first onboarding experiment
- pass cooldown/permanence
- whether relationship intent is MVP
- exact destination hierarchy for Bali-like regions
- minimum required overlap days
- notification cadence
- whether prior matches survive large preference changes
- whether user can have multiple active trips
- verification level at launch
- whether web PWA notifications are worth implementing
- whether completed-trip chats remain indefinitely
- moderation retention policy

---

# 43. Product Decision Log

| Decision | Status |
|---|---|
| Trip is central object | **Locked** |
| 18+ only | **Locked** |
| Destination + date overlap is hard eligibility | **Locked** |
| Compatibility preferences are mutual | **Locked** |
| Advanced AI ranking not MVP | **Locked** |
| Chat only after mutual match | **Locked** |
| Exact accommodation/private location hidden | **Locked** |
| Safety controls in MVP | **Locked** |
| Admin moderation in MVP | **Locked** |
| Native mobile app | **Deferred** |
| Video/voice chat | **Deferred** |
| Subscription/billing | **Deferred** |
| 1-day minimum overlap | **Working decision** |
| Multiple simultaneous trips | **Open** |
| Verification depth | **Open** |

---

# 44. Next Product Documents

The PRD should now feed directly into:

## 1. User Flow Specification
Exact step-by-step product journeys and branching states.

## 2. Safety Architecture
Moderation, policy, privacy, abuse handling, escalation.

## 3. Matching Logic Specification
Exact eligibility, overlap, exclusions, ranking, edge cases.

## 4. Data Model
Database entities, relationships, constraints, indexes.

## 5. Technical Architecture
Frontend, backend, auth, database, realtime, storage, analytics, deployment.

## 6. UI/UX Specification
Screen-by-screen interactions and component behavior.

## 7. Implementation Roadmap
Build order, milestones, testing, release criteria.

---

# 45. Founder Conclusion

The Triply MVP should not be judged by how many features it contains.

It should be judged by whether it can reliably create the sequence:

> **A real traveler creates a real trip → sees relevant people → expresses interest → gets a mutual match → starts a safe conversation before arrival.**

That is the product we are building first.
