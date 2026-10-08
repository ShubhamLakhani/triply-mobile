# Triply User Flow Specification v1.0
**Founder Product Document**  
**Date:** 6 October 2026  
**Stage:** Pre-MVP / Detailed UX flow definition  
**Status:** Working source of truth for core user journeys, branches, errors, empty states, and recovery paths

---

# 1. Purpose

This document translates the Triply PRD into exact user journeys.

The objective is to define:
- where each flow starts,
- which screens/states appear,
- what the user can do,
- what the system must check,
- what happens on failure,
- what happens next.

The core MVP journey is:

> **Sign up → Build profile → Add trip → Discover compatible travelers → Like → Match → Chat → Manage safety → Return for current/future trips**

---

# 2. Global UX Principles

1. **Trip context should always be clear.**
2. **Users should know why someone is being shown to them.**
3. **Date overlap should be visible, not hidden.**
4. **Low liquidity must be communicated honestly.**
5. **Safety actions must be reachable within one or two interactions.**
6. **No dead-end screens.**
7. **Every recoverable error should offer a recovery action.**
8. **Never expose exact accommodation or live location.**
9. **Primary CTA should be obvious on every major screen.**
10. **Do not create artificial urgency or manipulative engagement loops.**

---

# 3. Entry States

A user entering Triply can be in one of these states:

### State A — New visitor
No account.

### State B — Account exists, email unverified
Needs verification.

### State C — Verified, onboarding incomplete
Resume onboarding.

### State D — Profile complete, no trip
Prompt to create first trip.

### State E — Trip exists, no eligible profiles
Show low-liquidity state.

### State F — Trip exists, discovery available
Enter discovery.

### State G — Returning user with matches/messages
Prioritize active conversations and selected trip context.

### State H — Suspended/banned account
Restrict access and show account status.

---

# 4. Flow 1 — New User Signup

## Entry
Landing page or campaign landing page.

## Steps

### 1. User taps:
**Add your trip** / **Join Triply** / **See who’s going**

### 2. Authentication screen
User enters:
- email

### 3. System validates email format

If invalid:
- inline error
- preserve input

If valid:
- send magic link / OTP

### 4. Verification screen
User sees:
- “Check your email”
- resend option
- change email option

### 5. User verifies successfully

System:
- creates verified account/session
- checks onboarding state

### 6. Route to onboarding

## Failure branches

### Expired link/code
Show:
**That link has expired.**
CTA:
**Send a new one**

### Too many attempts
Rate limit and show safe retry message.

### Existing account
If email exists:
- sign user in or route to login verification
- do not create duplicate account

---

# 5. Flow 2 — Resume Incomplete Onboarding

## Entry
Returning user logs in but onboarding is not complete.

System checks:
- completed onboarding steps
- required fields

Route user to first incomplete step.

Example:
- photos missing → Photos step
- preferences missing → Preferences step
- trip missing → Create Trip step

User should never be forced to restart onboarding from the beginning.

---

# 6. Flow 3 — Basic Identity

## Fields
- first name
- date of birth
- gender
- who they want to meet

## Validation

### First name
Required.
Reasonable max length.

### DOB
Must confirm user is 18+.

If under 18:
- stop onboarding
- explain adult-only requirement
- account cannot proceed

### Gender/preferences
Use inclusive options with simple UX.

## Success
Save and continue.

## Failure
Inline field errors.
No data loss.

---

# 7. Flow 4 — Profile Photos

## Entry
After identity.

## Requirement
At least one valid profile photo.

## User actions
- upload
- crop if needed
- reorder
- delete
- set primary implicitly through order

## Success
At least one accepted photo exists.

## Failures

### Upload failure
Show:
**Upload failed. Try again.**

### Unsupported type
Explain allowed types.

### File too large
Offer compression/retry guidance.

### User tries to continue with no photo
Block continue with clear reason.

---

# 8. Flow 5 — Bio & Interests

## Fields
- short bio
- minimum 3 interests
- home city/country
- languages optional

## UX rule
Keep it fast.

Interest selection should use chips/tags.

## Success
Required fields saved.

## Empty bio
If bio is required in MVP:
- block continue

If optional decision changes later:
- allow skip but lower profile completeness.

---

# 9. Flow 6 — Matching Preferences

## Fields
- interested in
- minimum age
- maximum age

## Validation
- min age ≥ 18
- max age ≥ min age
- sensible upper bound

## Success
Preferences saved.

System uses mutual compatibility later.

---

# 10. Flow 7 — Create First Trip

## Entry
After profile setup.

## Fields
- destination
- arrival date
- departure date

## Destination interaction
User searches/selects from normalized destination system.

Do not allow arbitrary unmatched free text as final value.

## Date interaction
Use date-range picker.

## Validation

### Arrival in past
Reject.

### Departure before arrival
Reject.

### Same-day trip
Allow only if product rule permits; otherwise explain minimum duration.

### Duplicate identical trip
Offer:
- use existing trip
- edit existing trip

## Success
Create trip.
Trigger:
`trip_created`

Then calculate eligible profiles.

---

# 11. Flow 8 — Onboarding Completion

## If eligible profiles exist
Show:
**You’re ready. See who overlaps with your trip.**

CTA:
**Start discovering**

## If no eligible profiles
Show:
**Not enough people here yet.**

Support:
**We’ll let you know when more travelers match your dates.**

Actions:
- edit dates
- invite someone
- view trip
- enable notifications if available

Do not make the product feel broken.

---

# 12. Flow 9 — Home / Active Trip

## Entry
Returning authenticated user.

## Home should show

### Active/upcoming trip
- destination
- date range
- trip status
- eligible traveler count if useful

### Primary CTA
**Discover people**

### Secondary modules
- recent matches
- unread messages
- upcoming trip countdown
- new overlap found

## If multiple trips exist
User selects active discovery trip.

---

# 13. Flow 10 — Discovery

## Entry
User has:
- complete profile
- valid active/upcoming trip

## System checks
- selected trip
- eligibility
- blocks
- existing matches
- pass state
- account status

## Discovery card
Show:
- photo
- first name
- age
- destination
- their trip dates
- overlap dates
- interests
- short bio

## Actions
- Like
- Pass
- Open full profile
- More menu → Report / Block

---

# 14. Flow 11 — Open Full Profile

## User taps profile/card

Full profile shows:
- photos
- first name / age
- bio
- interests
- home city/country
- trip destination
- trip dates
- overlap visualization
- safety/verification markers if available

Actions:
- Like
- Pass
- Report
- Block
- Back

No exact accommodation or live location.

---

# 15. Flow 12 — Like

## User taps Like

System:
1. validates current eligibility
2. writes idempotent like
3. checks reciprocal like

### If no reciprocal like
Show light confirmation and continue discovery.

### If reciprocal like exists
Create one match.

Then show Match state.

## Failure
If user became ineligible because trip changed/account blocked:
- do not create like
- show refreshed state

---

# 16. Flow 13 — Pass

## User taps Pass

System:
- saves pass state
- removes candidate from current stack

No notification to other user.

## Future resurfacing
Controlled by pass-cooldown policy, still open.

---

# 17. Flow 14 — Match State

## Trigger
Mutual like.

## Match screen/modal
Show:
- both profile images
- destination
- overlap dates
- friendly message

Example:
**You matched**
**You’re both going to Bali around the same time.**

Primary CTA:
**Say hi**

Secondary:
**Keep discovering**

No excessive confetti or casino-style effects.

---

# 18. Flow 15 — Matches List

## Entry
Main navigation.

Show active matches with:
- photo
- name
- destination
- latest message preview
- unread indicator
- trip status

Sort recommendation:
1. unread
2. recent activity
3. trip proximity

Do not expose hidden/private data.

---

# 19. Flow 16 — Chat

## Entry
From match state or matches list.

## Chat screen
Show:
- name
- destination
- overlap summary
- safety menu
- text messages
- composer

## Allowed
- text messages

## Not MVP
- image
- voice
- video
- live location

## Message send
Optimistic UI allowed if delivery state is clear.

### On success
Persist message.

### On failure
Show retry state.

### If match is no longer active
Disable composer and explain:
**This conversation is no longer active.**

---

# 20. Flow 17 — First Message Assist

Optional lightweight prompt:
- “Ask about their trip”
- “What are you most excited to do in Bali?”

Do not auto-send.

Do not over-script conversations.

---

# 21. Flow 18 — Block From Profile

## User opens More → Block

Confirmation:
**Block [Name]?**
They will no longer be able to find or contact you.

Actions:
- Cancel
- Block

## On confirm
System:
- creates block
- hides both users from discovery
- closes/locks match/chat if any

User returns to safe prior screen.

---

# 22. Flow 19 — Report From Profile

## User opens Report

Choose category:
- fake profile
- spam/scam
- harassment
- inappropriate behavior
- underage concern
- impersonation
- safety concern
- other

Optional:
- add details

Offer:
**Also block this person**

## On submit
Show:
**Report received. Thank you.**

Do not reveal moderation internals.

---

# 23. Flow 20 — Report From Chat

Same report categories.

System attaches:
- match ID
- chat context reference
- reported user

User can:
- report only
- report + block
- report + unmatch

---

# 24. Flow 21 — Unmatch

## Entry
Chat or match settings.

Confirmation:
**Unmatch with [Name]?**

Explain:
- chat will close
- they will be removed from matches

Optional:
**Report a concern**

## On confirm
- update match state
- close chat
- remove from active match list

Do not automatically block unless chosen.

---

# 25. Flow 22 — Edit Trip

## Entry
Trips list or active trip card.

User can change:
- destination
- arrival date
- departure date

## Warning
If edit materially changes active matching:
**Changing this trip may change who you can discover.**

## After save
System:
- re-evaluates discovery eligibility
- preserves existing matches unless policy later decides otherwise

---

# 26. Flow 23 — Cancel Trip

## Confirmation
**Cancel this trip?**

Explain:
- it will stop appearing in active discovery
- existing conversations will not automatically be deleted

On confirm:
- status = cancelled
- remove from discovery
- return to trips list

---

# 27. Flow 24 — Trip Completion

System automatically marks past trip completed.

## Returning user sees
**How was your trip?**

Optional feedback later.

Primary CTA:
**Add your next trip**

Existing matches/chats remain accessible unless otherwise restricted.

---

# 28. Flow 25 — Add Another Trip

## Entry
Trips page.

User taps:
**Add trip**

Same trip-creation flow.

## If multiple active/upcoming trips allowed
User chooses active discovery context when entering discovery.

This remains an open product decision but flow should support it if enabled.

---

# 29. Flow 26 — Low Liquidity

## Trigger
No eligible profiles.

Show:
**Not enough people here yet.**

Support:
**We’ll let you know when more travelers match your dates.**

Actions:
1. Edit dates
2. Invite someone
3. Return home
4. Enable updates

Avoid:
- “No matches found”
- fake profiles
- irrelevant profiles from other destinations

---

# 30. Flow 27 — Returning User With New Eligible Travelers

## Entry
Home or notification.

Show:
**New travelers match your Bali dates.**

CTA:
**See who’s new**

Take user directly into relevant trip discovery.

---

# 31. Flow 28 — Returning User With Unread Message

Home displays unread state.

CTA opens conversation.

If match became inactive:
- show conversation closed state
- do not show broken composer

---

# 32. Flow 29 — Notification Preferences

Settings → Notifications.

User can control:
- new match
- new message
- new compatible traveler
- trip reminders
- safety/account updates where legally required

Mandatory security/account notices cannot be disabled if necessary.

---

# 33. Flow 30 — Profile Editing

Settings/Profile.

User can update:
- photo order
- bio
- interests
- home city
- languages
- matching preferences

Sensitive identity changes such as DOB should be restricted.

After preference change:
- discovery updates
- existing matches remain unless safety/eligibility policy dictates otherwise

---

# 34. Flow 31 — Account Deletion

Settings → Account → Delete account.

## Step 1
Explain consequences.

## Step 2
Confirm identity.

## Step 3
Final confirmation.

## On success
- immediately hide profile
- terminate active sessions
- disable matching/messages
- begin deletion/anonymization workflow

Show confirmation.

---

# 35. Flow 32 — Suspended Account

## Entry
Suspended user logs in or session refreshes.

Show:
**Your account is temporarily restricted.**

Provide:
- high-level reason category where appropriate
- appeal/support route if offered

Block:
- discovery
- likes
- chat sending
- profile visibility

---

# 36. Flow 33 — Banned Account

Show final account restriction state.

No normal product access.

Do not expose moderation methods or reporter identity.

---

# 37. Flow 34 — Lost Network During Discovery

If action cannot be confirmed:
- do not silently advance permanently
- preserve UI state where possible
- retry idempotently

Message:
**Connection lost. We’ll retry.**

Avoid duplicate likes/passes.

---

# 38. Flow 35 — Lost Network During Chat

User types and sends.

If send fails:
- message remains locally visible with failed state
- CTA: Retry

Do not duplicate on retry.

---

# 39. Flow 36 — Image Upload Failure

Keep user on photo screen.

Show failed item individually.

Allow:
- retry
- remove
- choose another

Do not discard successful uploads.

---

# 40. Flow 37 — Destination Service Failure

If destination autocomplete is unavailable:
- show retry state
- optionally allow cached popular destinations
- do not commit raw unnormalized text as valid destination

---

# 41. Flow 38 — Trip Date Becomes Invalid

Example:
User started creation yesterday, returns later and selected arrival is now in the past.

Show:
**These dates need updating.**

Preserve destination.
Return to date picker.

---

# 42. Flow 39 — User Changes Preferences During Discovery

On save:
- invalidate stale discovery stack
- refresh candidate set

If current visible card becomes ineligible:
- remove safely
- show next valid candidate

---

# 43. Flow 40 — Block During Active Chat

If A blocks B:
- chat immediately becomes unavailable to both
- no further message send
- match disappears from active matches

A sees confirmation.

B should not receive explicit “A blocked you” message.

---

# 44. Flow 41 — Admin Report Queue

## Entry
Admin authentication.

Queue shows:
- report ID
- category
- severity
- reported user
- submitted time
- status

Filters:
- open
- priority
- underage
- scam
- harassment
- resolved

---

# 45. Flow 42 — Admin Report Review

Admin opens report.

Show:
- report details
- reported profile
- relevant match/chat context
- prior reports
- prior moderation actions

Actions:
- no action
- warn
- suspend
- ban
- request further review
- close report

Every action requires:
- reason
- audit log

---

# 46. Flow 43 — Admin User Suspension

Admin chooses Suspend.

Set:
- reason
- duration or indefinite pending review

System:
- removes user from discovery
- blocks new interactions
- preserves necessary records

---

# 47. Flow 44 — Admin Ban

Admin confirms ban.

System:
- removes profile from public surfaces
- revokes sessions
- disables product access
- preserves moderation evidence per retention policy

---

# 48. Navigation Model

Recommended primary mobile navigation:

1. **Discover**
2. **Matches**
3. **Trips**
4. **Profile**

Home can either:
- be Discover with trip context, or
- remain a lightweight dashboard.

Avoid five-plus primary tabs in MVP.

---

# 49. Core Empty States

## No trips
**Where are you going next?**
CTA:
**Add a trip**

## No eligible people
**Not enough people here yet.**
CTA:
**Edit trip**

## No matches
**No matches yet.**
Support:
**Keep discovering people going when you are.**

## No messages
**Start the conversation when you’re ready.**

## No notifications
**You’re all caught up.**

---

# 50. Core Confirmation States

## Trip created
**Trip added.**

## Like
Subtle confirmation only.

## Match
Dedicated warm match state.

## Report
**Report received.**

## Block
**Blocked.**

## Trip cancelled
**Trip cancelled.**

## Account deletion
**Your account deletion request has started.**

---

# 51. Accessibility Flow Requirements

Every flow must support:
- keyboard navigation on web
- visible focus states
- semantic labels
- accessible dialogs
- screen-reader-friendly validation
- non-color error indicators
- reduced-motion preference
- 44×44 px tap targets

---

# 52. Analytics Mapping by Flow

## Signup
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
- `report_submitted`
- `block_created`
- `unmatch_created`

## Retention
- `return_session`
- `second_trip_created`

---

# 53. Critical UX Decisions

## Locked
- Trip is required for discovery
- Profile must reach minimum completeness before discovery
- Chat requires mutual match
- Date overlap is visible
- Low liquidity is shown honestly
- Block/report are always accessible
- No exact accommodation
- No live location
- Existing chats survive trip completion

## Working decisions
- trip-first vs profile-first onboarding order
- pass cooldown
- multiple active trips
- relationship intent field
- notification frequency
- exact empty-state actions

---

# 54. Flow Acceptance Criteria

The user-flow layer is ready for UI design when:

- every core PRD feature has an entry path
- every flow has a clear success state
- critical failures have recovery paths
- no safety action causes a dead end
- trip context is preserved through discovery
- low-liquidity state is defined
- onboarding can resume
- blocking removes all contact paths
- match/chat states remain internally consistent
- admin moderation flows are defined

---

# 55. Next Step

## Triply Safety Architecture v1.0

The next document should define:

- safety principles
- community rules
- prohibited behavior
- report severity model
- moderation workflow
- account enforcement states
- block/unmatch behavior
- underage handling
- scam/fraud handling
- harassment handling
- image/profile moderation
- message abuse handling
- privacy rules
- location/travel-data protection
- incident escalation
- audit logging
- moderator access controls
- retention rules
- future verification roadmap

After Safety Architecture:
1. Matching Logic Specification
2. Data Model
3. Technical Architecture
4. UI/UX Specification
5. Implementation Roadmap

---

# Founder Conclusion

A successful Triply flow should make the user feel:

> **I know where I’m going, I understand who overlaps with my trip, I can decide whether to connect, and I remain in control throughout the experience.**

The product should feel simple on the surface because the rules underneath it are disciplined.
