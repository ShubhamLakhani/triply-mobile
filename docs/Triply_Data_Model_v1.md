# Triply Data Model v1.0
**Founder Product & Engineering Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Database design  
**Status:** Working source of truth for entities, relationships, constraints, indexes, auditability, and data lifecycle

---

# 1. Purpose

This document translates the Triply PRD, user flows, safety architecture, and matching logic into a production-oriented relational data model.

The model should support:

- user identity and profiles
- preferences
- normalized destinations
- future trips
- discovery and matching
- likes and passes
- chat
- blocks and reports
- moderation
- notifications
- analytics references
- auditability
- deletion and retention

The design should prioritize:

- correctness
- safety
- data integrity
- explainability
- idempotency
- query efficiency
- future extensibility without over-engineering

---

# 2. Recommended Database

**PostgreSQL**

Why:
- strong relational integrity
- transactions
- partial indexes
- check constraints
- JSONB where appropriate
- excellent date handling
- good fit for Supabase/Postgres infrastructure
- easy to reason about for matching queries

---

# 3. High-Level Entity Map

Core entities:

1. `users`
2. `profiles`
3. `profile_photos`
4. `interests`
5. `profile_interests`
6. `matching_preferences`
7. `destination_markets`
8. `destinations`
9. `trips`
10. `likes`
11. `passes`
12. `matches`
13. `messages`
14. `blocks`
15. `reports`
16. `moderation_cases`
17. `moderation_actions`
18. `notifications`
19. `user_notification_preferences`
20. `audit_logs`

Optional supporting entities later:
- device/risk signals
- verification records
- appeals
- referrals
- acquisition attribution
- experiments

---

# 4. Users

## Table: `users`

Purpose:
Core account record.

Suggested fields:

- `id UUID PRIMARY KEY`
- `email CITEXT UNIQUE NOT NULL`
- `email_verified_at TIMESTAMPTZ NULL`
- `date_of_birth DATE NOT NULL`
- `account_status user_account_status NOT NULL DEFAULT 'active'`
- `onboarding_status onboarding_status NOT NULL DEFAULT 'started'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `deleted_at TIMESTAMPTZ NULL`
- `last_active_at TIMESTAMPTZ NULL`

## Account status enum

- `active`
- `restricted`
- `suspended`
- `banned`
- `deleted`

## Rules

- age must be 18+ at onboarding completion
- deleted accounts excluded from normal product queries
- email should not be exposed publicly
- DOB should not be returned in public profile payloads

---

# 5. Profiles

## Table: `profiles`

Purpose:
Public-facing traveler profile.

Fields:

- `user_id UUID PRIMARY KEY REFERENCES users(id)`
- `first_name VARCHAR(80) NOT NULL`
- `gender_code VARCHAR(64) NOT NULL`
- `bio VARCHAR(500) NULL`
- `home_city VARCHAR(120) NULL`
- `home_country_code CHAR(2) NULL`
- `languages TEXT[] NULL`
- `profile_status profile_status NOT NULL DEFAULT 'incomplete'`
- `profile_completion_score SMALLINT NOT NULL DEFAULT 0`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Profile status enum

- `incomplete`
- `complete`
- `hidden`
- `moderation_hidden`

## Notes

Age should be computed from `users.date_of_birth`, not manually maintained.

Avoid storing sensitive derived labels unless clearly needed.

---

# 6. Profile Photos

## Table: `profile_photos`

Fields:

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `storage_key TEXT NOT NULL`
- `position SMALLINT NOT NULL`
- `is_primary BOOLEAN NOT NULL DEFAULT false`
- `moderation_status photo_moderation_status NOT NULL DEFAULT 'pending'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `deleted_at TIMESTAMPTZ NULL`

## Constraints

- position >= 0
- max 6 active photos enforced in application/transaction logic
- one primary active photo per user via partial unique index if practical

## Indexes

- `(user_id, position)`
- partial index on active photos where `deleted_at IS NULL`

---

# 7. Interests

## Table: `interests`

Fields:

- `id SMALLSERIAL PRIMARY KEY`
- `slug VARCHAR(80) UNIQUE NOT NULL`
- `label VARCHAR(120) NOT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `sort_order SMALLINT NOT NULL DEFAULT 0`

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
- remote-work
- diving
- surfing

---

# 8. Profile Interests

## Table: `profile_interests`

Fields:

- `user_id UUID REFERENCES users(id)`
- `interest_id SMALLINT REFERENCES interests(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Primary key:
- `(user_id, interest_id)`

Application rule:
- minimum 3
- maximum 8

---

# 9. Matching Preferences

## Table: `matching_preferences`

Fields:

- `user_id UUID PRIMARY KEY REFERENCES users(id)`
- `min_age SMALLINT NOT NULL`
- `max_age SMALLINT NOT NULL`
- `interested_in_codes TEXT[] NOT NULL`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Constraints

- `min_age >= 18`
- `max_age >= min_age`
- reasonable max age cap, e.g. 100

Future:
- relationship intent
- language preference
- strict/soft filters

---

# 10. Destination Markets

## Table: `destination_markets`

Purpose:
Defines actual matching markets.

Examples:
- Bali
- Bangkok
- Barcelona

Fields:

- `id UUID PRIMARY KEY`
- `slug VARCHAR(120) UNIQUE NOT NULL`
- `name VARCHAR(160) NOT NULL`
- `country_code CHAR(2) NOT NULL`
- `timezone VARCHAR(80) NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

This lets multiple destinations map into one matching market.

---

# 11. Destinations

## Table: `destinations`

Fields:

- `id UUID PRIMARY KEY`
- `canonical_name VARCHAR(180) NOT NULL`
- `country_code CHAR(2) NOT NULL`
- `region_name VARCHAR(160) NULL`
- `destination_type destination_type NOT NULL`
- `parent_destination_id UUID NULL REFERENCES destinations(id)`
- `match_market_id UUID NOT NULL REFERENCES destination_markets(id)`
- `latitude NUMERIC(9,6) NULL`
- `longitude NUMERIC(9,6) NULL`
- `timezone VARCHAR(80) NULL`
- `external_place_id TEXT NULL`
- `is_active BOOLEAN NOT NULL DEFAULT true`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Destination type enum

- `country`
- `region`
- `island`
- `city`
- `district`
- `other`

## Constraints / indexes

- unique external place ID where present
- index on `match_market_id`
- index on `(country_code, canonical_name)`

---

# 12. Trips

## Table: `trips`

Fields:

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `destination_id UUID NOT NULL REFERENCES destinations(id)`
- `match_market_id UUID NOT NULL REFERENCES destination_markets(id)`
- `arrival_date DATE NOT NULL`
- `departure_date DATE NOT NULL`
- `status trip_status NOT NULL DEFAULT 'upcoming'`
- `visibility trip_visibility NOT NULL DEFAULT 'eligible_only'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `cancelled_at TIMESTAMPTZ NULL`
- `completed_at TIMESTAMPTZ NULL`

## Trip status enum

- `upcoming`
- `active`
- `completed`
- `cancelled`

## Visibility enum

- `eligible_only`
- `hidden`

## Constraints

- `departure_date >= arrival_date`
- future-trip creation rule enforced at application layer
- `match_market_id` should be derived from selected destination and validated server-side

## Indexes

Critical:
- `(match_market_id, arrival_date, departure_date, status)`
- `(user_id, status)`
- `(destination_id)`
- partial index on active/upcoming trips

---

# 13. Trip Date Query

Core overlap condition:

```sql
candidate.arrival_date <= requester.departure_date
AND candidate.departure_date >= requester.arrival_date
```

This should be used with `match_market_id`.

---

# 14. Likes

## Table: `likes`

Purpose:
One-way person-level interest.

Fields:

- `id UUID PRIMARY KEY`
- `liker_user_id UUID NOT NULL REFERENCES users(id)`
- `liked_user_id UUID NOT NULL REFERENCES users(id)`
- `source_trip_id UUID NOT NULL REFERENCES trips(id)`
- `source_candidate_trip_id UUID NULL REFERENCES trips(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Constraints

- no self-like
- unique `(liker_user_id, liked_user_id)`

This implements person-level like semantics.

## Indexes

- `(liked_user_id, liker_user_id)`
- `(liker_user_id, created_at)`
- `(liked_user_id, created_at)`

---

# 15. Passes

## Table: `passes`

Fields:

- `id UUID PRIMARY KEY`
- `passer_user_id UUID NOT NULL REFERENCES users(id)`
- `passed_user_id UUID NOT NULL REFERENCES users(id)`
- `source_trip_id UUID NOT NULL REFERENCES trips(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `expires_at TIMESTAMPTZ NULL`
- `reason pass_reason NULL`

## Constraints

- no self-pass
- one active pass per pair/direction can be enforced logically

## Working behavior

Default:
- `expires_at = created_at + 30 days`

Future:
- clear earlier on meaningful context change

---

# 16. Matches

## Table: `matches`

Fields:

- `id UUID PRIMARY KEY`
- `user_low_id UUID NOT NULL REFERENCES users(id)`
- `user_high_id UUID NOT NULL REFERENCES users(id)`
- `source_trip_low_id UUID NOT NULL REFERENCES trips(id)`
- `source_trip_high_id UUID NOT NULL REFERENCES trips(id)`
- `match_market_id UUID NOT NULL REFERENCES destination_markets(id)`
- `overlap_start DATE NOT NULL`
- `overlap_end DATE NOT NULL`
- `status match_status NOT NULL DEFAULT 'active'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `ended_at TIMESTAMPTZ NULL`
- `ended_by_user_id UUID NULL REFERENCES users(id)`

## Match status enum

- `active`
- `unmatched`
- `blocked`
- `moderation_closed`

## Constraints

- `user_low_id < user_high_id` conceptually; application normalizes UUID ordering
- `overlap_end >= overlap_start`
- no self-match
- one active match per pair via partial unique index

## Partial unique index concept

Unique on `(user_low_id, user_high_id)` where status = `active`.

---

# 17. Messages

## Table: `messages`

Fields:

- `id UUID PRIMARY KEY`
- `match_id UUID NOT NULL REFERENCES matches(id)`
- `sender_user_id UUID NOT NULL REFERENCES users(id)`
- `body TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `edited_at TIMESTAMPTZ NULL`
- `deleted_at TIMESTAMPTZ NULL`
- `delivery_status message_delivery_status NOT NULL DEFAULT 'sent'`

## Constraints

- message body length limit
- sender must be one participant in match
- match must be active at send time, enforced server-side

## Indexes

- `(match_id, created_at)`
- `(sender_user_id, created_at)`

MVP:
text only.

---

# 18. Blocks

## Table: `blocks`

Fields:

- `id UUID PRIMARY KEY`
- `blocker_user_id UUID NOT NULL REFERENCES users(id)`
- `blocked_user_id UUID NOT NULL REFERENCES users(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Constraints

- unique `(blocker_user_id, blocked_user_id)`
- no self-block

## Indexes

- `(blocker_user_id, blocked_user_id)`
- `(blocked_user_id, blocker_user_id)`

Block presence in either direction excludes pair.

---

# 19. Reports

## Table: `reports`

Fields:

- `id UUID PRIMARY KEY`
- `reporter_user_id UUID NOT NULL REFERENCES users(id)`
- `reported_user_id UUID NOT NULL REFERENCES users(id)`
- `category report_category NOT NULL`
- `severity report_severity NOT NULL`
- `details TEXT NULL`
- `match_id UUID NULL REFERENCES matches(id)`
- `message_id UUID NULL REFERENCES messages(id)`
- `status report_status NOT NULL DEFAULT 'open'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Report category enum

- `fake_profile`
- `spam_scam`
- `harassment`
- `sexual_inappropriate`
- `underage`
- `impersonation`
- `threat_safety`
- `hate_abuse`
- `other`

## Severity enum

- `low`
- `medium`
- `high`

## Report status

- `open`
- `in_review`
- `resolved`
- `escalated`

---

# 20. Moderation Cases

## Table: `moderation_cases`

Purpose:
Allows multiple reports to be grouped into a single review case.

Fields:

- `id UUID PRIMARY KEY`
- `target_user_id UUID NOT NULL REFERENCES users(id)`
- `priority moderation_priority NOT NULL`
- `status moderation_case_status NOT NULL DEFAULT 'open'`
- `assigned_admin_id UUID NULL`
- `summary TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `closed_at TIMESTAMPTZ NULL`

Future:
create separate admin users table if needed.

---

# 21. Moderation Case Reports

## Table: `moderation_case_reports`

Fields:

- `case_id UUID REFERENCES moderation_cases(id)`
- `report_id UUID REFERENCES reports(id)`

Primary key:
- `(case_id, report_id)`

---

# 22. Moderation Actions

## Table: `moderation_actions`

Fields:

- `id UUID PRIMARY KEY`
- `case_id UUID NULL REFERENCES moderation_cases(id)`
- `target_user_id UUID NOT NULL REFERENCES users(id)`
- `admin_id UUID NOT NULL`
- `action moderation_action_type NOT NULL`
- `reason TEXT NOT NULL`
- `previous_account_status user_account_status NULL`
- `new_account_status user_account_status NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Action types

- `no_action`
- `warn`
- `restrict`
- `suspend`
- `ban`
- `restore`
- `close_case`
- `escalate`

---

# 23. Notifications

## Table: `notifications`

Fields:

- `id UUID PRIMARY KEY`
- `user_id UUID NOT NULL REFERENCES users(id)`
- `type notification_type NOT NULL`
- `title VARCHAR(180) NOT NULL`
- `body VARCHAR(500) NULL`
- `entity_type VARCHAR(80) NULL`
- `entity_id UUID NULL`
- `read_at TIMESTAMPTZ NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

## Notification types

- `new_match`
- `new_message`
- `new_eligible_traveler`
- `trip_reminder`
- `account_notice`
- `safety_notice`

## Index

- `(user_id, read_at, created_at DESC)`

---

# 24. Notification Preferences

## Table: `user_notification_preferences`

Fields:

- `user_id UUID PRIMARY KEY REFERENCES users(id)`
- `new_match BOOLEAN NOT NULL DEFAULT true`
- `new_message BOOLEAN NOT NULL DEFAULT true`
- `new_eligible_traveler BOOLEAN NOT NULL DEFAULT true`
- `trip_reminder BOOLEAN NOT NULL DEFAULT true`
- `email_enabled BOOLEAN NOT NULL DEFAULT true`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Security/safety notices may bypass optional preferences when legally necessary.

---

# 25. Audit Logs

## Table: `audit_logs`

Purpose:
Track sensitive internal actions.

Fields:

- `id UUID PRIMARY KEY`
- `actor_type audit_actor_type NOT NULL`
- `actor_id UUID NULL`
- `action VARCHAR(120) NOT NULL`
- `target_type VARCHAR(120) NULL`
- `target_id UUID NULL`
- `metadata JSONB NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`

Use for:
- moderation actions
- account status changes
- administrative access
- sensitive configuration changes

Do not dump secrets or message contents into audit metadata.

---

# 26. Acquisition Attribution

Recommended supporting table:

## `user_acquisition_attribution`

Fields:

- `user_id UUID PRIMARY KEY REFERENCES users(id)`
- `utm_source VARCHAR(120) NULL`
- `utm_medium VARCHAR(120) NULL`
- `utm_campaign VARCHAR(180) NULL`
- `utm_content VARCHAR(180) NULL`
- `landing_path TEXT NULL`
- `first_seen_at TIMESTAMPTZ NOT NULL`
- `last_seen_at TIMESTAMPTZ NULL`

This keeps attribution available beyond client analytics.

---

# 27. Analytics Event Storage

Primary product analytics should remain in PostHog or equivalent rather than duplicating all events into the application DB.

Store only business-critical derived values internally if needed.

Do not store:
- full message text in analytics
- email
- exact DOB
- unnecessary sensitive preference data

---

# 28. Verification Records

Future table:

## `verifications`

Possible fields:
- `id`
- `user_id`
- `type`
- `provider`
- `status`
- `verified_at`
- `expires_at`
- `provider_reference`

Do not store raw identity documents unless absolutely necessary and legally justified.

---

# 29. Appeals

Future table:

## `moderation_appeals`

Fields:
- `id`
- `user_id`
- `moderation_action_id`
- `reason`
- `status`
- `created_at`
- `resolved_at`

Not required for closed MVP if support channel is enough.

---

# 30. Referential Behavior

Recommended deletion behavior:

### User deletion
Do not hard-cascade all safety records blindly.

Use:
- soft delete / anonymization
- preserve moderation evidence where justified
- remove profile from discovery immediately

### Trip deletion
Prefer status/cancelled/completed over hard delete if referenced by likes/matches.

### Match deletion
Do not hard delete because chat/history/moderation may reference it.

### Message deletion
Soft-delete if product supports deletion later.

---

# 31. Soft Delete Policy

Use soft delete for:
- users
- profile photos
- possibly messages later

Prefer status transitions for:
- trips
- matches
- moderation cases

Avoid soft deleting everything unnecessarily.

---

# 32. Row-Level Access Rules

If using Supabase/Postgres RLS, minimum policy intent:

## Users
User can read/update own account fields only.

## Profiles
Public-safe fields readable only when discovery/match rules allow or through secure server query.

## Trips
User manages own trips.

Do not expose arbitrary trip rows publicly.

## Likes
User can create/read only own outbound likes; reciprocal/internal checks should happen server-side.

## Matches
Only participants can read their matches.

## Messages
Only active match participants can read/send, subject to safety status.

## Blocks
User can manage only own outbound blocks.

## Reports
Reporter can create; user should not broadly read report records.

## Moderation
Admin/service role only.

For complex matching logic, prefer server-side controlled RPC/API rather than giving clients direct table access.

---

# 33. Server-Side Service Boundaries

Sensitive mutations should happen through trusted server logic:

- create like
- create match
- send message
- block user
- submit report
- account deletion
- moderation action
- destination normalization
- discovery query

Client should not be able to insert matches directly.

---

# 34. Transaction Boundaries

Use transactions for:

## Like → Match
- insert like
- detect reciprocal
- insert one match

## Block
- insert block
- close active match
- revoke interaction state

## Moderation suspension
- update account status
- remove from discoverability
- create action/audit record

## Account deletion
- mark deleted
- revoke session/access
- hide profile
- begin anonymization workflow

---

# 35. Critical Indexes

At minimum:

### Trips
`(match_market_id, arrival_date, departure_date, status)`

### Likes
`(liked_user_id, liker_user_id)`

### Matches
`(user_low_id, user_high_id, status)`

### Messages
`(match_id, created_at)`

### Blocks
both directional indexes

### Reports
`(reported_user_id, status, severity, created_at)`

### Notifications
`(user_id, read_at, created_at DESC)`

### Profiles
status/completeness index if needed

---

# 36. Check Constraints

Recommended DB checks:

- no self-like
- no self-block
- no self-match
- departure >= arrival
- overlap_end >= overlap_start
- min_age >= 18
- max_age >= min_age
- profile photo position >= 0
- report reporter != reported
- normalized match pair IDs differ

---

# 37. Enums

Suggested enums:

- `user_account_status`
- `onboarding_status`
- `profile_status`
- `trip_status`
- `trip_visibility`
- `destination_type`
- `match_status`
- `report_category`
- `report_severity`
- `report_status`
- `moderation_priority`
- `moderation_case_status`
- `moderation_action_type`
- `notification_type`
- `photo_moderation_status`

Use enums where states are stable and operationally meaningful.

---

# 38. Matching Query Sketch

Simplified SQL concept:

```sql
SELECT ...
FROM trips ct
JOIN users cu ON cu.id = ct.user_id
JOIN profiles cp ON cp.user_id = cu.id
WHERE
  ct.match_market_id = :requester_market
  AND ct.status IN ('upcoming', 'active')
  AND ct.arrival_date <= :requester_departure
  AND ct.departure_date >= :requester_arrival
  AND cu.id <> :requester_user_id
  AND cu.account_status = 'active'
  AND cp.profile_status = 'complete'
  AND NOT EXISTS (
    SELECT 1 FROM blocks b
    WHERE
      (b.blocker_user_id = :requester AND b.blocked_user_id = cu.id)
      OR
      (b.blocker_user_id = cu.id AND b.blocked_user_id = :requester)
  )
  ...
```

Mutual preference compatibility can be handled in SQL, server logic, or a database function depending on implementation clarity.

---

# 39. Match Creation Transaction Sketch

```text
BEGIN

insert like if absent

check reciprocal like

if reciprocal:
    normalize pair
    resolve active overlapping trip context
    insert match if no active pair exists

COMMIT
```

Unique constraints make this safe during simultaneous likes.

---

# 40. Data Lifecycle

## Active user
All product data active.

## Suspended user
Data retained; discovery/messaging restricted.

## Banned user
Public visibility removed; moderation evidence retained.

## Deleted user
Profile hidden immediately; personal data enters deletion/anonymization workflow.

## Completed trip
Remains historical if needed for match provenance, but is not discoverable.

---

# 41. Privacy-Sensitive Fields

Treat as sensitive:
- email
- DOB
- gender/orientation preferences
- future travel dates
- moderation history
- messages
- reports
- home city/country
- IP/device risk signals later

Minimize access.

Do not expose via public client queries unless strictly necessary.

---

# 42. Data Minimization Rules

Do not collect in MVP:
- exact home address
- hotel/accommodation address
- passport details
- government ID
- live GPS
- payment data
- unnecessary employment/income data

Only add later with explicit product/safety rationale.

---

# 43. Backup & Recovery

Production should support:
- automated backups
- point-in-time recovery if available
- migration rollback strategy
- tested restore process before scale

Safety/moderation data should not silently disappear during restoration.

---

# 44. Migration Discipline

Every schema change should:
- be version controlled
- be reversible where practical
- include data migration plan
- preserve constraints
- be tested on staging
- avoid destructive production edits without backup

---

# 45. Seed Data

Seed:
- interest catalog
- initial destination markets
- destination aliases/mappings
- moderation categories if table-driven
- test users only in non-production environments

Do not mix fake users into production discovery.

---

# 46. Initial Destination Seed

For launch preparation, seed:
- Bali market
- Bali canonical destination
- optional child destinations:
  - Canggu
  - Seminyak
  - Ubud
  - Denpasar

Whether these share one `match_market_id` should be explicitly decided before the cohort launch.

---

# 47. Test Data Strategy

Create fixtures for:

- compatible pair
- incompatible age pair
- incompatible gender pair
- one-day overlap
- no-overlap pair
- blocked pair
- reported pair
- simultaneous likes
- multiple-trip user
- completed trip
- suspended user
- deleted user
- active moderator case

---

# 48. Data Model Acceptance Criteria

The data model is ready for implementation when:

- every PRD entity has a storage home
- matching logic can be expressed without denormalized hacks
- blocks and moderation override discovery cleanly
- one active match per pair is enforceable
- likes are idempotent
- trip overlap is query-efficient
- user deletion does not destroy required safety records
- public/private fields are clearly separated
- moderation actions are auditable
- core queries have appropriate indexes
- multi-trip support does not require redesign

---

# 49. Locked Data Decisions

| Decision | Status |
|---|---|
| PostgreSQL relational model | **Locked** |
| Trip remains central entity | **Locked** |
| `match_market_id` used for destination matching | **Locked** |
| Person-level likes | **Locked** |
| One active match per pair | **Locked** |
| Text-only messages in MVP | **Locked** |
| Blocks are directional records but exclude both ways | **Locked** |
| Reports preserved for moderation | **Locked** |
| Match stores original overlap context | **Locked** |
| Trips use DATE, not timestamp, for travel range | **Locked** |
| Multi-trip support in schema | **Locked** |
| Hard deletes avoided for safety-critical records | **Locked** |

---

# 50. Open Data Decisions

Need final implementation choice:

- whether `users` is app-owned or maps directly to auth provider user table
- exact gender/preference representation
- whether languages stay array or normalized table
- whether admin users live in same users table or separate table
- exact trip duplicate constraint
- pass uniqueness/expiry implementation
- whether relationship intent is added before MVP
- exact profile completion calculation
- exact photo moderation workflow
- message retention duration
- deleted-user anonymization strategy
- exact Bali destination grouping

---

# 51. Next Step

## Triply Technical Architecture v1.0

Next we define:

- application architecture
- frontend framework
- backend/API boundary
- authentication
- PostgreSQL/Supabase strategy
- realtime messaging
- file storage
- destination provider
- email/notifications
- analytics
- moderation/admin architecture
- rate limiting
- observability
- deployment
- security boundaries
- environment management
- testing strategy
- CI/CD
- production topology

After Technical Architecture:
1. UI/UX Specification
2. Implementation Roadmap
3. Build kickoff

---

# Founder Conclusion

The Triply data model should make the core product easy to reason about:

> **Users create trips. Trips define where and when. Eligibility produces discovery. Likes create mutual matches. Matches create conversations. Safety records can override every social state.**

The schema should protect those invariants at the database level wherever possible, not only in application code.
