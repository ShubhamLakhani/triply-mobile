# Triply Matching Logic Specification v1.0
**Founder Product & Engineering Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Matching engine definition  
**Status:** Working source of truth for eligibility, filtering, ranking, multi-trip behavior, stale-state handling, and match creation

## 1. Purpose
This document defines exactly how Triply decides who can be shown to whom, which trip context is used, what “same destination” means, what “overlapping dates” means, how mutual preference compatibility works, how safety states affect discovery, how passes/likes/matches behave, how candidates are ranked, and how duplicate likes/matches are prevented.

The MVP should be predictable, explainable, safe, idempotent, efficient, and easy to test. It should not use opaque AI scoring.

## 2. Core Matching Principle
A candidate is eligible only when all hard requirements pass:

> **Same destination + overlapping dates + mutual preference compatibility + active account + valid profile + no safety conflict + no existing active match**

Ranking happens only after eligibility.

## 3. Matching Context
Every discovery request operates inside one selected trip context.

If User A has:
- Bali: Dec 4–12
- Bangkok: Jan 8–14

and opens Bali discovery, only the Bali trip is used. `selected_trip_id` must therefore be explicit.

## 4. Requester Preconditions
Requester must have:
- active account
- verified email
- age >= 18
- complete minimum profile
- at least one valid profile photo
- matching preferences
- selected trip in upcoming or active state
- normalized destination
- valid dates

If not, discovery should not execute.

## 5. Candidate Preconditions
Candidate must:
- be active
- not be the requester
- have complete minimum profile
- have at least one valid public photo
- have a trip in the same canonical market
- have overlapping dates
- mutually match age/gender preferences
- have no block conflict
- have no safety suppression
- have no existing active match
- have trip state upcoming or active

## 6. Destination Equality
Do not match raw text.

Two trips are destination-compatible when their destination records resolve to the same canonical `match_market_id`.

Examples like “Bali” and “Bali, Indonesia” must resolve consistently.

## 7. Destination Hierarchy
Support:
- country
- region
- city
- travel-market grouping

Recommended destination fields:
- `id`
- `canonical_name`
- `country_code`
- `region_name`
- `destination_type`
- `parent_destination_id`
- `match_market_id`

This allows explicit grouping for places like Bali, Goa, Phuket, Ibiza, or Greek islands.

## 8. Date Overlap
Two trips overlap when:

`max(start_a, start_b) <= min(end_a, end_b)`

Derived values:
- `overlap_start`
- `overlap_end`
- `overlap_days`

Working MVP threshold:
**minimum 1 calendar day**

This is configurable.

## 9. Timezone Handling
Trip dates are calendar dates, not precise UTC moments. Store and compare them as local date concepts so timezone conversion does not accidentally change overlap.

## 10. Age Compatibility
A and B are compatible only if:
- `age(B)` is within A’s range
- `age(A)` is within B’s range

Both directions are required.

## 11. Gender / Orientation Compatibility
Eligibility requires:
- `B.gender ∈ A.interested_in`
- `A.gender ∈ B.interested_in`

Do not assume heterosexual matching.

## 12. Relationship Intent
Not a hard filter in MVP unless product evidence supports it. It may later become a soft ranking or strict optional filter.

## 13. Interests
Interests are not hard eligibility filters in MVP. Use them only as profile context and soft ranking.

## 14. Profile Completeness
Minimum public-discovery completeness:
- first name
- DOB
- gender
- interested_in
- bio if required
- 1+ photo
- minimum interests
- home city/country if retained as required field

## 15. Account Eligibility
Exclude accounts that are:
- restricted from discovery
- suspended
- banned
- deleted

Default safer rule: restricted accounts do not enter discovery.

## 16. Block Exclusion
Any block in either direction permanently disqualifies the pair unless explicit unblock behavior is added later.

Block overrides:
- likes
- passes
- matches
- trip changes

## 17. Report Exclusion
Recommended MVP:
- any report by A against B suppresses B from A’s future discovery immediately
- high-severity reports may suppress both directions pending review
- if user chooses block, block rules apply

## 18. Existing Match Exclusion
If an active match exists, do not show the pair in discovery.

For prior unmatched/blocked/moderation-closed pairs, default to no automatic resurfacing in MVP.

## 19. Existing Like
If A already liked B and no match exists, do not repeatedly show B to A.

B may still see A if eligible.

## 20. Pass State
Recommended MVP:
- suppress passed candidate for **30 days**
- optionally reset suppression after material context change such as a new trip or major date change

This value should be configurable.

## 21. Multi-Trip Behavior
Support multiple trips in data model even if UI initially keeps usage simple.

Discovery always uses one selected trip.

If the same pair overlaps on multiple trips, show the most relevant context but deduplicate by person.

## 22. Candidate Trip Selection
If candidate has multiple matching trips, choose:
1. maximum overlap days
2. earliest overlap start
3. nearest upcoming trip

## 23. Ranking Philosophy
No black-box AI in v1.

Suggested signals:
1. overlap strength
2. profile quality
3. recent activity
4. shared interests
5. exploration/randomness

## 24. Example Ranking Weights
Illustrative:
- overlap: 45%
- profile quality: 15%
- activity: 15%
- shared interests: 10%
- exploration: 15%

Keep configurable.

## 25. Overlap Score
Possible formula:

`overlap_ratio = overlap_days / min(duration_a, duration_b)`

Example combined score:

`0.6 * normalized_overlap_days + 0.4 * overlap_ratio`

## 26. Profile Quality
Possible inputs:
- number of photos
- bio completion
- interests completion
- verification later

Do not reward oversharing.

## 27. Activity Score
Possible inputs:
- recent login
- recent trip update
- recent discovery activity

Cap recency impact.

## 28. Shared Interests
Example:
`shared_interests / union_interests`

Soft signal only.

## 29. Exploration Score
Controlled randomization avoids permanently static ordering.

## 30. Ranking Guardrails
Never use:
- race/ethnicity
- religion
- income
- inferred attractiveness
- sensitive traits

Never infer sensitive traits from photos.

## 31. Discovery Pagination
Use cursor-based pagination.

Cursor may include:
- score
- tie-break ID
- selected trip
- discovery-session seed

## 32. Discovery Session
Recommended lightweight context:
- requester_user_id
- selected_trip_id
- created_at
- ranking_seed
- cursor

## 33. Stale Candidate Revalidation
When user acts, re-check critical eligibility.

Example: if candidate cancels trip, blocks requester, or gets suspended after card render, do not trust the stale card.

## 34. Like Creation Logic
Pseudo-flow:
1. authenticate actor
2. validate source trip
3. validate target
4. re-check hard eligibility
5. insert like idempotently
6. check reciprocal like
7. if reciprocal exists, create match transactionally
8. return state

## 35. Idempotency
Like creation must be idempotent.

Recommended semantics:
**person-level like**, with source trip context stored as provenance.

The user is liking the person, not each individual trip.

## 36. Reciprocal Like
Create match only when:
- A likes B
- B likes A
- no block conflict
- both accounts remain eligible
- a valid overlapping trip context still exists

## 37. Match Context
Store snapshot/provenance:
- user A
- user B
- source trip A
- source trip B
- destination market
- overlap start
- overlap end
- created_at

## 38. Match Uniqueness
Normalize pair ordering:
- `user_low_id`
- `user_high_id`

Enforce one active match pair via unique/partial unique DB constraint.

## 39. Simultaneous Likes
If A and B like each other at the same time, exactly one match must be created using a transaction and unique pair constraint.

## 40. Match After Trip Edit
Existing match/chat survives trip edits even if future overlap disappears.

New discovery uses updated trip data.

## 41. Match After Trip Cancellation
Do not auto-unmatch. Preserve chat; remove cancelled trip from future discovery.

## 42. Preference Changes After Match
Do not auto-unmatch existing users. Preference changes affect future discovery only.

## 43. Account Suspension After Match
- remove user from discovery
- disable new interaction
- preserve internal match history

## 44. Deleted Account After Match
Counterpart sees neutral unavailable state. Do not expose reason.

## 45. Candidate Deduplication
Within one discovery session, never show the same person twice even if they have multiple matching trips.

## 46. Candidate Pool Query Order
Recommended:
1. selected trip
2. candidate trips in same `match_market_id`
3. date overlap
4. active account
5. complete profile
6. mutual preferences
7. block/report exclusions
8. existing match exclusion
9. like/pass suppression
10. rank
11. deduplicate by user
12. paginate

## 47. Query-Level Hard Filters
Put as many hard filters as possible in server/DB query logic for efficiency, but always revalidate on write actions.

## 48. Caching
Correctness before caching.

If later added:
- short TTL
- cache only safe IDs/derived data
- invalidate on block/suspension/trip change
- revalidate at action time

## 49. Low-Liquidity Fallback
Never relax:
- safety
- block rules
- destination compatibility
- age/gender compatibility

Do not silently show irrelevant users to fill the feed.

## 50. Future Date Expansion
Optional later:
**Show travelers arriving within ±3 days?**

Must be explicit opt-in.

## 51. Future Nearby-Destination Expansion
Use predefined market grouping, not arbitrary distance, and make it explicit.

## 52. Explainability
Users should understand why someone appears:
- same destination
- overlapping dates
- shared interests

Do not imply deep compatibility prediction.

## 53. Analytics
Track:
- candidate pool size
- eligible_profiles_viewed
- overlap_days
- like rate
- pass rate
- match rate
- no-result rate
- time to first eligible profile
- destination liquidity

## 54. Matching Health Metrics
- % trips with ≥1 candidate
- % trips with ≥5 candidates
- median candidates/trip
- median overlap days
- like rate
- reciprocal like rate
- match rate
- conversation-start rate

## 55. Reference Pseudocode
```text
function getDiscoveryCandidates(requester, selectedTrip):
    assert requester.active
    assert requester.profileComplete
    assert selectedTrip.belongsTo(requester)
    assert selectedTrip.matchable

    candidateTrips = query trips where:
        match_market_id == selectedTrip.match_market_id
        status in [upcoming, active]
        overlap(selectedTrip, candidateTrip) >= MIN_OVERLAP

    candidates = []

    for candidateTrip in candidateTrips:
        candidate = candidateTrip.user

        if candidate == requester: continue
        if !candidate.active: continue
        if !candidate.profileComplete: continue
        if !mutualPreferenceCompatible(requester, candidate): continue
        if blockedEitherDirection(requester, candidate): continue
        if reportSuppressionExists(requester, candidate): continue
        if activeMatchExists(requester, candidate): continue
        if pendingLikeAlreadySent(requester, candidate): continue
        if passSuppressionActive(requester, candidate): continue

        add candidate using best matching trip context

    deduplicate by user
    score
    sort
    cursorPaginate
```

## 56. Match Creation Pseudocode
```text
function likeUser(actor, target, sourceTrip):
    begin transaction

    revalidateEligibility(actor, target, sourceTrip)

    insertLikeIfAbsent(actor, target, sourceTrip)

    if reciprocalLikeExists(target, actor):
        context = resolveCurrentValidOverlap(actor, target)

        if context exists:
            match = insertMatchIfAbsent(
                normalizedPair(actor, target),
                context
            )

            commit
            return MATCH_CREATED

    commit
    return LIKE_RECORDED
```

## 57. Required DB Constraints
At minimum:
- canonical destination uniqueness
- valid trip date checks
- valid user foreign keys
- unique block direction
- unique like direction
- unique active match pair
- no self-like
- no self-block
- no self-match

## 58. Critical Test Cases
1. exact one-day overlap
2. no overlap by one day
3. destination alias resolution
4. different destination same country
5. Bali market grouping
6. mutual age compatibility
7. one-way age incompatibility
8. mutual gender compatibility
9. one-way gender incompatibility
10. block either direction
11. report suppression
12. already liked
13. pass cooldown
14. simultaneous likes
15. duplicate like retry
16. duplicate match race
17. candidate suspended after render
18. trip cancelled after render
19. requester changes trip
20. multiple candidate trips
21. multiple requester trips
22. person-level deduplication
23. existing match
24. prior unmatched pair
25. deleted account
26. destination merge
27. timezone date boundary
28. large candidate pool pagination
29. stale cursor
30. candidate profile becomes incomplete

## 59. Open Matching Decisions
- exact pass cooldown
- whether unmatched pairs ever resurface
- whether minimum overlap should become >1 day
- relationship-intent filtering
- exact Bali market grouping
- how much activity influences ranking
- whether verification influences ranking
- very long trips handling

## 60. Locked Matching Decisions
| Decision | Status |
|---|---|
| Same canonical match market required | **Locked** |
| Date overlap required | **Locked** |
| Mutual age compatibility | **Locked** |
| Mutual gender/preference compatibility | **Locked** |
| Blocks exclude pair | **Locked** |
| Active matches excluded from discovery | **Locked** |
| Interests are soft ranking only | **Locked** |
| No AI ranking in MVP | **Locked** |
| Person-level deduplication | **Locked** |
| Revalidate eligibility at action time | **Locked** |
| Existing matches survive trip edits | **Locked** |
| Existing matches survive preference edits | **Locked** |
| 1-day minimum overlap | **Working decision** |
| 30-day pass cooldown | **Working decision** |

## 61. Next Step
### Triply Data Model v1.0

Next we convert this logic into schema design:
- users
- profiles
- profile photos
- interests
- profile interests
- preferences
- destinations
- destination markets
- trips
- likes
- passes
- matches
- messages
- blocks
- reports
- moderation cases
- moderation actions
- notifications
- audit records
- indexes
- constraints
- status enums

After Data Model:
1. Technical Architecture
2. UI/UX Specification
3. Implementation Roadmap

# Founder Conclusion
Triply's matching engine should remain easy to explain:

> **Same place, overlapping time, mutual preferences, no safety conflict.**

Everything else is ranking.

That simplicity is an advantage because it gives us a system that is measurable, testable, and honest with users.
