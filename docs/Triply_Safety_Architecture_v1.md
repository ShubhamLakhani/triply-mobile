# Triply Safety Architecture v1.0
**Founder Product & Trust Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Safety system design  
**Status:** Working source of truth for trust, moderation, abuse handling, privacy, enforcement, and escalation

---

# 1. Purpose

Triply operates at the intersection of dating and travel, which creates a higher trust burden than a standard social app.

Users may:
- be traveling alone
- be in unfamiliar countries
- be far from their normal support network
- share future travel intent
- meet someone they have never met before
- be more vulnerable to scams or coercion

Therefore safety must be treated as **core product architecture**, not a policy page added later.

This document defines the minimum safety system Triply should have before closed-cohort launch.

---

# 2. Safety Principles

1. **Users stay in control**
2. **Exact private location is never required**
3. **Reporting must be fast and easy**
4. **Blocking must work immediately**
5. **Safety actions override growth mechanics**
6. **High-risk reports receive priority**
7. **Moderator access is limited and auditable**
8. **Sensitive user data is minimized**
9. **We do not reveal reporter identities**
10. **No growth experiment should weaken safety protections**
11. **Travel context increases caution, not data exposure**
12. **We prefer false negatives in growth over false negatives in serious safety**

---

# 3. Safety Threat Model

Triply should explicitly protect against:

## Identity risk
- fake profiles
- impersonation
- catfishing
- underage users

## Communication abuse
- harassment
- sexual coercion
- threats
- hate speech
- repeated unwanted contact

## Scam/fraud risk
- romance scams
- payment requests
- crypto/investment scams
- travel booking scams
- fake emergency requests
- phishing

## Location risk
- exact hotel/accommodation disclosure
- stalking
- coercive meetup pressure
- unsafe meetup suggestions

## Platform abuse
- spam
- botting
- scraping
- mass liking/messaging
- account farming

## Travel-specific risk
- targeting solo travelers
- local exploitation
- pressure to move conversation off-platform immediately
- manipulation around transport/accommodation

---

# 4. Community Standards

Triply should prohibit:

- underage use
- impersonation
- harassment
- threats
- stalking
- hate or identity-based abuse
- non-consensual sexual content
- sexual exploitation
- coercion
- spam
- scams
- fraudulent solicitations
- trafficking-related behavior
- requests for money
- attempts to obtain passwords or sensitive information
- malicious links
- deliberate false travel information used to manipulate others
- doxxing
- sharing someone else’s private information
- repeated unwanted contact
- promotion of illegal activity where applicable

---

# 5. Account Safety States

Every account should have a safety status.

## Active
Normal use.

## Restricted
Some actions limited:
- messaging
- likes
- discovery
- profile visibility

Used for suspicious but unresolved behavior.

## Suspended
Temporary access restriction pending review or for a fixed period.

## Banned
Permanent platform removal.

## Deleted
User-initiated or system-completed deletion state.

## Under review
Internal moderation state; may coexist with restricted/suspended status.

---

# 6. Enforcement Ladder

Use proportional enforcement.

## Level 0 — No action
Report not substantiated.

## Level 1 — Warning
For lower-severity first-time violations.

## Level 2 — Feature restriction
Examples:
- messaging disabled
- profile hidden
- likes limited

## Level 3 — Temporary suspension
For repeated or serious violations.

## Level 4 — Permanent ban
For:
- underage use
- serious threats
- severe harassment
- scam/fraud networks
- impersonation with harm
- sexual exploitation
- repeat high-severity abuse

## Level 5 — Legal / emergency escalation
For credible imminent threats, exploitation, or situations requiring legal response.

This requires jurisdiction-specific legal counsel and process before public scale.

---

# 7. Report Severity Model

## Severity 1 — Low
Examples:
- rude behavior
- inappropriate profile content
- repeated low-level spam

Target:
standard moderation queue.

## Severity 2 — Medium
Examples:
- harassment
- scam solicitation
- impersonation
- repeated unwanted contact

Target:
faster review.

## Severity 3 — High
Examples:
- underage concern
- credible threat
- stalking
- blackmail
- sexual coercion
- trafficking indicators
- severe fraud

Target:
priority queue, immediate protective restriction where justified.

---

# 8. Report Categories

User-facing categories:
- Fake profile
- Spam or scam
- Harassment
- Sexual or inappropriate behavior
- Underage concern
- Impersonation
- Threat or safety concern
- Hate or abusive behavior
- Other

Internal categories may be more granular.

---

# 9. Report Workflow

## Step 1
User taps Report from:
- profile
- match
- chat

## Step 2
Select category.

## Step 3
Optional details.

## Step 4
Offer:
**Also block this person**

## Step 5
Submit.

## Step 6
System:
- stores report
- captures relevant context
- assigns severity
- flags high-risk cases
- updates moderation queue

## Step 7
User sees:
**Report received. Thank you.**

Do not reveal:
- investigation details
- reporter identity
- moderation outcome unless policy supports it

---

# 10. Automatic Protective Actions

For selected high-risk categories, the system may temporarily:
- hide reported profile from reporter
- disable messaging between the pair
- restrict reported account
- prioritize moderator review

Do not automatically ban solely based on one report unless the content/risk is clearly severe.

---

# 11. Block Behavior

Block must be immediate.

When A blocks B:
- both disappear from each other’s discovery
- existing match is closed
- chat becomes inaccessible
- no new likes/messages
- future overlapping trips do not reconnect them
- B is not told “A blocked you”

Block must override all other product states.

---

# 12. Unmatch Behavior

Unmatch:
- closes active match
- stops chat
- removes from match list

Unmatch does **not** automatically create a block.

Prompt user:
**Do you also want to block or report this person?**

---

# 13. Underage Handling

Triply is 18+.

## Detection sources
- DOB during onboarding
- user report
- moderation evidence
- suspicious profile content

## If underage is confirmed
- immediately suspend
- remove from discovery
- disable messaging
- prohibit re-registration where feasible
- retain only necessary evidence per policy/legal requirements

## If underage is suspected
- restrict/suspend pending review
- prioritize moderation

This policy should be legally reviewed before public scale.

---

# 14. Scam & Fraud Handling

Common scam indicators:
- asking for money
- investment/crypto pitches
- emergency money requests
- fake travel booking offers
- payment links
- account takeover attempts
- repetitive scripted messaging

## MVP response
- report category
- moderator review
- messaging restriction
- account suspension/ban where substantiated

## Future automation
- repeated outbound-link detection
- payment-request pattern detection
- suspicious message velocity
- device/account clustering
- known-scam phrase models

Avoid automated decisions without human review for serious enforcement unless confidence is very high.

---

# 15. Harassment Handling

Examples:
- repeated unwanted messages
- degrading language
- sexual pressure
- threats
- retaliation after rejection

## User controls
- block
- report
- unmatch

## Moderator actions
- warning
- message restriction
- suspension
- ban

Repeat patterns should increase severity.

---

# 16. Threats & Imminent Harm

If a report indicates:
- credible threat of violence
- stalking
- blackmail
- coercion
- immediate physical danger

Triply should:
1. prioritize review
2. restrict relevant account(s)
3. preserve evidence
4. provide the reporting user with appropriate safety guidance
5. escalate internally
6. follow applicable legal/emergency process

Triply should not promise emergency-response capabilities it does not have.

---

# 17. Travel Location Privacy

Triply should never require:
- hotel name
- room number
- Airbnb address
- exact live GPS
- exact meetup location in profile

Public/match-level travel data should remain at:
- destination
- date range

Potential later feature:
optional rough area/neighborhood sharing after match.

Default should remain privacy-preserving.

---

# 18. Home Location Privacy

Store only what is needed.

Public display:
- home city/country optional

Never display:
- street address
- exact coordinates
- private contact details

---

# 19. Date Privacy

Future travel dates are sensitive.

## Default visibility
Only users eligible for the same destination context should see trip dates.

Do not expose a user’s entire travel history publicly.

Past trips should not remain broadly discoverable.

---

# 20. Messaging Safety

MVP chat should support:
- text only
- block/report access
- spam throttling
- abuse review context

Do not support in MVP:
- image sharing
- file attachments
- disappearing messages
- live location
- money-transfer links
- voice/video

This intentionally reduces moderation complexity.

---

# 21. Link Safety

If clickable links are later supported:
- warn for external URLs
- detect suspicious domains
- rate-limit
- consider disabling in first-message stage

For MVP, links may remain plain text or be limited.

---

# 22. Profile Moderation

Profile surfaces to moderate:
- photo
- bio
- name
- interests if free text later
- destination notes if added later

## Prohibited profile content
- nudity
- explicit sexual content
- hate speech
- scams
- contact/payment solicitation
- impersonation
- illegal content

---

# 23. Photo Safety

MVP should include:
- file validation
- moderation review capability
- ability to remove photo
- ability to suspend profile

Future:
- automated NSFW moderation
- duplicate-photo detection
- reverse-image or face-risk systems if justified

Do not over-collect biometric data without strong legal and privacy basis.

---

# 24. Verification Strategy

## MVP
- verified email
- age declaration/DOB
- profile completeness
- moderation history

## Phase 2
Optional:
- selfie verification
- liveness check
- identity verification

## Verification principle
Verification should reduce risk without creating an unrealistic “this person is safe” guarantee.

UI should communicate:
> **Verified identity/profile signal**

Not:
> **Safe person**

---

# 25. Verified Badge Rules

If introduced:
- badge meaning must be explicit
- badge should expire/revalidate if needed
- users should know what was verified
- no implication of endorsement

---

# 26. Safety Center

Triply should include a dedicated Safety Center covering:

- meeting in public
- telling someone where you are going
- keeping accommodation private
- not sending money
- staying on-platform initially
- recognizing common scams
- blocking/reporting
- emergency/local authority guidance
- consent and boundaries

Keep tone calm and practical.

---

# 27. Meetup Safety Copy

Recommended:
- Meet in a public place.
- Tell someone you trust where you’re going.
- Keep your accommodation private until you’re comfortable.
- Never send money to someone you haven’t met.
- Leave if anything feels wrong.
- You can block or report at any time.

---

# 28. Privacy by Design

Triply should minimize collection of:
- exact location
- legal identity
- biometric data
- contact data
- unnecessary personal history

Only collect sensitive information when:
1. product value clearly requires it,
2. safety benefit is substantial,
3. legal basis is clear.

---

# 29. Moderator Access Controls

Moderators should access only what is necessary.

Use role-based access.

## Moderator can access
- report details
- reported profile
- relevant chat excerpts
- moderation history
- enforcement tools

## Moderator should not access by default
- unrelated chats
- private account data
- full user export
- billing data later
- passwords/auth secrets

---

# 30. Audit Logging

Every moderation action should log:
- moderator ID
- target user/report
- action
- reason
- timestamp
- previous state
- resulting state

Audit records should be immutable where practical.

---

# 31. Moderation Case States

- Open
- In review
- Awaiting information
- Resolved — no action
- Resolved — warning
- Resolved — restricted
- Resolved — suspended
- Resolved — banned
- Escalated

---

# 32. Moderator Notes

Internal notes:
- not visible to users
- factual, not speculative
- no unnecessary sensitive commentary
- should support future review

---

# 33. Appeals

MVP minimum:
- provide support route for suspended/banned users

Future:
- structured appeal workflow
- second-review mechanism
- appeal status tracking

Do not make appeal impossible for ordinary moderation mistakes.

---

# 34. Rate Limits

MVP should consider rate limits for:
- account creation
- login attempts
- likes
- messages
- reports
- profile edits
- photo uploads

Rate limits should reduce abuse without harming legitimate travel users.

---

# 35. Device / Account Abuse

Future anti-abuse signals:
- repeated signups from same device
- multiple banned accounts
- suspicious IP patterns
- disposable email domains
- impossible activity velocity

Treat these as risk signals, not automatic guilt.

---

# 36. Safety Analytics

Track:
- reports per 1,000 active users
- blocks per 1,000 active users
- report categories
- repeat-offender rate
- reports per destination cohort
- moderation response time
- suspension/ban rate
- appeal overturn rate later
- scam incident rate
- underage reports

Never expose reporter identity in analytics surfaces.

---

# 37. Safety KPIs

Important safety metrics:
- time to review high-severity report
- time to action
- repeat abuse after warning
- report-to-action ratio
- false-positive reversal rate
- block-after-match rate
- scam report frequency
- underage incident frequency

---

# 38. High-Risk Cohort Monitoring

Travel-specific cohorts may show elevated risk.

Monitor:
- high-volume tourist destinations
- festival/event windows
- gender imbalance
- spikes in scam reports
- unusually high outbound-link activity
- sudden account clusters

Do not treat destination itself as evidence of abuse.

---

# 39. Data Retention

Retention policy must eventually be legally reviewed.

Working principle:
- retain only what is needed for product, safety, legal, or fraud prevention
- delete/anonymize user data after account deletion where legally permitted
- retain moderation evidence only when justified
- define separate retention for messages, reports, and enforcement records

---

# 40. Message Retention

MVP working principle:
- persist messages for active user experience
- preserve relevant message context for safety investigations
- deleted-account handling should anonymize where appropriate

Exact retention duration remains open pending legal/privacy review.

---

# 41. Emergency Escalation

Before public scale, Triply should create an internal playbook for:
- imminent violence
- trafficking/exploitation
- self-harm references if encountered
- child safety
- blackmail/extortion
- law-enforcement requests

Triply should involve qualified legal counsel before establishing external escalation commitments.

---

# 42. Law-Enforcement Requests

Do not improvise.

Future requirements:
- designated contact
- lawful-request validation
- data minimization
- logging
- emergency request process
- jurisdiction review

---

# 43. Safety Copy Tone

Safety language should be:
- calm
- direct
- practical
- non-judgmental

Avoid:
- fear marketing
- victim-blaming
- implying Triply guarantees safety

---

# 44. User Education Timing

Safety guidance should appear:
- onboarding briefly
- before first meetup-related experience
- in Safety Center
- in report/block flows where relevant

Do not overload onboarding with a long legal lecture.

---

# 45. Safety Release Gates

Triply should not launch a closed cohort until:

## Gate 1
Block works immediately across discovery, match, and chat.

## Gate 2
Report reaches admin/moderation reliably.

## Gate 3
High-severity reports can be prioritized.

## Gate 4
Admin can warn, suspend, ban.

## Gate 5
Every moderator action is logged.

## Gate 6
Exact accommodation/live location is not exposed.

## Gate 7
Suspended/banned users cannot continue interacting.

## Gate 8
Underage handling exists.

## Gate 9
Privacy-sensitive fields are not present in public payloads.

## Gate 10
Safety Center content exists.

---

# 46. Safety Test Cases

Must explicitly test:

1. blocked user appears in discovery after trip edit
2. blocked user attempts to message through stale session
3. user reports after unmatch
4. underage report during active match
5. banned user tries to log back in
6. suspended user opens existing chat
7. duplicate report submission
8. moderator takes simultaneous conflicting actions
9. report references deleted message/user
10. scammer sends repeated payment language
11. abusive user creates second account
12. profile photo removed after report
13. user cancels trip after threatening message
14. report submitted from low-connectivity session
15. account deletion while report remains open

---

# 47. Safety Decision Log

| Decision | Status |
|---|---|
| Safety is core architecture | **Locked** |
| 18+ only | **Locked** |
| Exact accommodation hidden | **Locked** |
| Live location not MVP | **Locked** |
| Block overrides all product states | **Locked** |
| Reporter identity protected | **Locked** |
| High-severity reports prioritized | **Locked** |
| Moderator actions audited | **Locked** |
| Text-only chat in MVP | **Locked** |
| No images/files in chat | **Locked** |
| Verification badge = limited signal, not safety guarantee | **Locked** |
| Selfie verification at launch | **Open** |
| ID verification at launch | **Open** |
| Exact retention periods | **Open/legal review** |

---

# 48. Open Safety Decisions

To resolve before public scale:
- whether selfie/liveness is required before messaging
- whether verified profiles get discovery priority
- exact report SLA targets
- exact moderation staffing model
- exact message/report retention
- appeal workflow depth
- underage evidence process
- law-enforcement request process
- scam-link filtering level
- external safety partner needs

---

# 49. Next Step

## Triply Matching Logic Specification v1.0

The next document should define:

- destination equality
- destination hierarchy
- date overlap
- preference compatibility
- age compatibility
- trip eligibility
- account eligibility
- blocking/report exclusions
- multi-trip behavior
- pass behavior
- ranking
- tie-breaking
- match creation
- stale candidate handling
- edge cases
- database constraints
- pseudocode/reference logic

After Matching Logic:
1. Data Model
2. Technical Architecture
3. UI/UX Specification
4. Implementation Roadmap

---

# Founder Conclusion

Triply should make people feel adventurous, not exposed.

The correct safety standard is:

> **Users should be able to explore connection while retaining control over who sees them, who can contact them, what travel information is visible, and how quickly they can end an interaction.**

Safety is not separate from product-market fit. In a travel dating product, trust is part of the value proposition.
